import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotFound } from '../../common/errors/errors.js';
import type { RequestUser } from '../../common/guards/request-user.js';
import { AuditService } from '../audit/audit.service.js';
import type {
  issuedCodeSchema,
  newCodeSchema,
  newOrganisationSchema,
  OrganisationDto,
} from './organisations.schemas.js';

const DAY = 86_400_000;
const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

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

/**
 * Organisations at launch (January 2027): FigCit staff create each one, issue its codes and invoice
 * it by hand. A code gives Premium straight away (ENT-7, T-22). Staff never see members' data here,
 * only how many places are in use.
 */
@Injectable()
export class OrganisationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<OrganisationDto[]> {
    const rows = await this.prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        inviteCodes: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { memberships: { where: { leftAt: null } } } },
      },
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      kind: t.kind,
      plan: t.seatsPlanCode === 'pilot' ? 'pilot' : 'org_seat',
      seatsUsed: t._count.memberships,
      codes: t.inviteCodes.map((c) => ({
        code: c.code,
        uses: c.uses,
        maxUses: c.maxUses,
        expiresAt: iso(c.expiresAt),
      })),
      createdAt: t.createdAt.toISOString(),
    }));
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
    return {
      id: t.id,
      name: t.name,
      kind: t.kind,
      plan: body.plan,
      seatsUsed: 0,
      codes: [],
      createdAt: t.createdAt.toISOString(),
    };
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
