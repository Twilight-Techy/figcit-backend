import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type TenantInvoice, type TenantRole } from '@prisma/client';
import type { z } from 'zod';
import { ENV, type Env } from '../../common/config/env.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError, BadInput, NotFound } from '../../common/errors/errors.js';
import type { RequestUser } from '../../common/guards/request-user.js';
import { AuditService } from '../audit/audit.service.js';
import type {
  InvoiceDto,
  invoiceStatusSchema,
  issuedCodeSchema,
  newCodeSchema,
  newInvoiceSchema,
  newLeadSchema,
  newOrganisationSchema,
  OrganisationDto,
  updateOrganisationSchema,
} from './organisations.schemas.js';

const DAY = 86_400_000;
const iso = (d: Date | null): string | null => d?.toISOString() ?? null;
const day = (d: Date | null): string | null => d?.toISOString().slice(0, 10) ?? null;

/** Support leads see the dashboard; they aren't counted as seats. */
export const LEAD_ROLES: TenantRole[] = ['support_lead', 'admin'];

/** The seat price before VAT, in pence (Developer Brief: £10 a month or £100 a year). */
const SEAT_PRICE: Readonly<Record<'month' | 'year', number>> = { month: 1000, year: 10_000 };
const DUE_DAYS = 30;

/** Where an invoice can go next. */
const NEXT: Readonly<Record<string, readonly string[]>> = {
  draft: ['sent', 'void'],
  sent: ['paid', 'void'],
  paid: [],
  void: [],
};

/** An invoice as staff and the organisation's leads see it. */
export function invoiceDto(i: TenantInvoice): InvoiceDto {
  return {
    id: i.id,
    number: i.number,
    periodStart: day(i.periodStart) ?? '',
    periodEnd: day(i.periodEnd) ?? '',
    seats: i.seats,
    unitMinor: i.unitMinor,
    amountMinor: i.amountMinor,
    vatMinor: i.vatMinor,
    totalMinor: i.amountMinor + i.vatMinor,
    currency: i.currency,
    status: i.status as InvoiceDto['status'],
    note: i.note,
    issuedAt: iso(i.issuedAt),
    dueAt: day(i.dueAt),
    paidAt: iso(i.paidAt),
    createdAt: i.createdAt.toISOString(),
  };
}

/** The last day of a period that starts on `start` and runs a month or a year. */
function periodEnd(start: Date, interval: 'month' | 'year'): Date {
  const months = interval === 'year' ? 12 : 1;
  return new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate() - 1),
  );
}

/** Letters and digits people can read out: no 0/O or 1/I. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(): string {
  return Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join('');
}

function slugOf(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return `${base || 'org'}-${randomBytes(3).toString('hex')}`;
}

const INCLUDE = {
  inviteCodes: { orderBy: { createdAt: 'desc' }, take: 20 },
  memberships: {
    where: { leftAt: null, role: { in: LEAD_ROLES } },
    select: { user: { select: { email: true } } },
  },
  _count: { select: { memberships: { where: { leftAt: null, role: 'member' } } } },
} satisfies Prisma.TenantInclude;

/**
 * Organisations at launch (January 2027): FigCit staff create each one, issue its codes and invoice
 * it by hand. A code gives Premium straight away (ENT-7, T-22). Staff never see members' data here,
 * only how many places are in use.
 */
@Injectable()
export class OrganisationsService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private dto(t: Prisma.TenantGetPayload<{ include: typeof INCLUDE }>): OrganisationDto {
    return {
      id: t.id,
      name: t.name,
      kind: t.kind,
      plan: t.seatsPlanCode === 'pilot' ? 'pilot' : 'org_seat',
      seatsUsed: t._count.memberships,
      seatsPurchased: t.seatsPurchased,
      anonymityFloor: t.anonymityFloor,
      leads: t.memberships.map((m) => m.user.email ?? '').filter(Boolean),
      codes: t.inviteCodes.map((c) => ({
        code: c.code,
        uses: c.uses,
        maxUses: c.maxUses,
        expiresAt: iso(c.expiresAt),
      })),
      createdAt: t.createdAt.toISOString(),
    };
  }

  private async one(id: string): Promise<OrganisationDto> {
    const t = await this.prisma.tenant.findUnique({ where: { id }, include: INCLUDE });
    if (!t) throw new NotFound('organisation');
    return this.dto(t);
  }

  async list(): Promise<OrganisationDto[]> {
    const rows = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: INCLUDE,
    });
    return rows.map((t) => this.dto(t));
  }

  /** Seats agreed and the anonymity floor. */
  async update(
    staff: RequestUser,
    id: string,
    body: z.infer<typeof updateOrganisationSchema>,
  ): Promise<OrganisationDto> {
    await this.one(id);
    await this.prisma.tenant.update({
      where: { id },
      data: {
        ...(body.seatsPurchased === undefined ? {} : { seatsPurchased: body.seatsPurchased }),
        ...(body.anonymityFloor === undefined ? {} : { anonymityFloor: body.anonymityFloor }),
      },
    });
    await this.audit.record({
      actorId: staff.id,
      actorRole: 'admin',
      action: 'organisation.update',
      targetType: 'tenant',
      targetId: id,
      meta: { ...body },
    });
    return this.one(id);
  }

  /**
   * Makes an existing FigCit account the organisation's support lead: they see its dashboard and
   * support requests. One organisation per account, as for members.
   */
  async addLead(
    staff: RequestUser,
    id: string,
    body: z.infer<typeof newLeadSchema>,
  ): Promise<OrganisationDto> {
    await this.one(id);
    const user = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
      select: { id: true },
    });
    if (!user) throw new BadInput('No FigCit account uses that email. Ask them to sign up first.');
    const other = await this.prisma.tenantMembership.findFirst({
      where: { userId: user.id, leftAt: null, tenantId: { not: id } },
    });
    if (other)
      throw new AppError(
        409,
        'already_member',
        'That account belongs to another organisation',
        'They need to leave it first, in Settings.',
      );
    await this.prisma.$transaction([
      this.prisma.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: id, userId: user.id } },
        create: { tenantId: id, userId: user.id, role: 'support_lead' },
        update: { role: 'support_lead', leftAt: null },
      }),
      this.prisma.user.update({ where: { id: user.id }, data: { tenantId: id } }),
    ]);
    await this.audit.record({
      actorId: staff.id,
      actorRole: 'admin',
      action: 'organisation.lead',
      targetType: 'tenant',
      targetId: id,
      meta: { userId: user.id },
    });
    return this.one(id);
  }

  async invoices(id: string): Promise<InvoiceDto[]> {
    await this.one(id);
    const rows = await this.prisma.tenantInvoice.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map(invoiceDto);
  }

  /** A draft invoice for one period's seats, VAT worked out; staff send it from their own email. */
  async createInvoice(
    staff: RequestUser,
    id: string,
    body: z.infer<typeof newInvoiceSchema>,
  ): Promise<InvoiceDto> {
    const org = await this.one(id);
    const start = new Date(`${body.periodStart}T00:00:00Z`);
    const seats = body.seats ?? org.seatsPurchased ?? org.seatsUsed;
    const unitMinor = body.unitMinor ?? (org.plan === 'pilot' ? 0 : SEAT_PRICE[body.interval]);
    const amountMinor = seats * unitMinor;
    const vatMinor = Math.round((amountMinor * this.env.VAT_PERCENT) / 100);
    const year = start.getUTCFullYear();
    // Numbers run FC-<year>-0001 upwards; two staff at once may collide, so try the next.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const count = await this.prisma.tenantInvoice.count({
        where: { number: { startsWith: `FC-${String(year)}-` } },
      });
      const number = `FC-${String(year)}-${String(count + 1 + attempt).padStart(4, '0')}`;
      try {
        const row = await this.prisma.tenantInvoice.create({
          data: {
            tenantId: id,
            number,
            periodStart: start,
            periodEnd: periodEnd(start, body.interval),
            seats,
            unitMinor,
            amountMinor,
            vatMinor,
            note: body.note || null,
          },
        });
        await this.audit.record({
          actorId: staff.id,
          actorRole: 'admin',
          action: 'organisation.invoice',
          targetType: 'tenant',
          targetId: id,
          meta: { number, seats, amountMinor },
        });
        return invoiceDto(row);
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e;
      }
    }
    throw new AppError(409, 'invoice_number', 'Could not number the invoice', 'Try again.');
  }

  /** Sent (due in 30 days), paid, or void. */
  async setInvoiceStatus(
    staff: RequestUser,
    id: string,
    invoiceId: string,
    body: z.infer<typeof invoiceStatusSchema>,
  ): Promise<InvoiceDto> {
    const inv = await this.prisma.tenantInvoice.findFirst({
      where: { id: invoiceId, tenantId: id },
    });
    if (!inv) throw new NotFound('invoice');
    if (!(NEXT[inv.status] ?? []).includes(body.status))
      throw new AppError(
        409,
        'invoice_status',
        `A ${inv.status} invoice can't be marked ${body.status}`,
      );
    const now = new Date();
    const row = await this.prisma.tenantInvoice.update({
      where: { id: invoiceId },
      data: {
        status: body.status,
        ...(body.status === 'sent'
          ? { issuedAt: now, dueAt: new Date(now.getTime() + DUE_DAYS * DAY) }
          : {}),
        ...(body.status === 'paid' ? { paidAt: now } : {}),
      },
    });
    await this.audit.record({
      actorId: staff.id,
      actorRole: 'admin',
      action: `organisation.invoice_${body.status}`,
      targetType: 'tenant',
      targetId: id,
      meta: { number: inv.number },
    });
    return invoiceDto(row);
  }

  async create(
    staff: RequestUser,
    body: z.infer<typeof newOrganisationSchema>,
  ): Promise<OrganisationDto> {
    const t = await this.prisma.tenant.create({
      data: {
        name: body.name,
        slug: slugOf(body.name),
        kind: body.kind,
        seatsPlanCode: body.plan,
        anonymityFloor: body.anonymityFloor,
      },
    });
    await this.audit.record({
      actorId: staff.id,
      actorRole: 'admin',
      action: 'organisation.create',
      targetType: 'tenant',
      targetId: t.id,
      meta: { kind: body.kind, plan: body.plan },
    });
    return this.one(t.id);
  }

  async issueCode(
    staff: RequestUser,
    tenantId: string,
    body: z.infer<typeof newCodeSchema>,
  ): Promise<z.infer<typeof issuedCodeSchema>> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFound('organisation');
    const expiresAt = new Date(Date.now() + body.days * DAY);
    const row = await this.prisma.inviteCode.create({
      data: { code: newCode(), tenantId, maxUses: body.maxUses ?? null, expiresAt },
    });
    await this.audit.record({
      actorId: staff.id,
      actorRole: 'admin',
      action: 'organisation.code',
      targetType: 'tenant',
      targetId: tenantId,
      meta: { maxUses: body.maxUses ?? null, days: body.days },
    });
    return { code: row.code, uses: 0, maxUses: row.maxUses, expiresAt: iso(row.expiresAt) };
  }
}
