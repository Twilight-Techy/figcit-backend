import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Light } from '@figcit/engine';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { AppError, BadInput, Forbidden, NotFound } from '../../common/errors/errors.js';
import { ConsentService } from '../consent/consent.service.js';

const DAY = 86_400_000;
const WEEKS = 8;
const LIGHTS: readonly Light[] = ['green', 'yellow', 'amber', 'red', 'blue'];

export function weekStart(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7; // Monday
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}

/**
 * Institution licences (M16, S80–S90). Staff of an institution only ever see group trends at or
 * above the anonymity floor, from members who chose to share, and what a member writes when they
 * ask for support. Never a person's check-ins, words or reflections (RF-4, D-16, D-17).
 */
@Injectable()
export class InstitutionsService {
  private readonly logger = new Logger('Institutions');

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly consent: ConsentService,
  ) {}

  async join(userId: string, code: string): Promise<{ tenantId: string; name: string }> {
    const invite = await this.prisma.inviteCode.findUnique({
      where: { code: code.toUpperCase() },
      include: { tenant: true },
    });
    if (
      !invite ||
      (invite.expiresAt && invite.expiresAt < new Date()) ||
      (invite.maxUses !== null && invite.uses >= invite.maxUses)
    )
      throw new BadInput('That code is not valid any more. Ask your institution for a new one.');
    const existing = await this.prisma.tenantMembership.findFirst({
      where: { userId, leftAt: null },
    });
    if (existing && existing.tenantId !== invite.tenantId)
      throw new AppError(
        409,
        'already_member',
        'You are already linked to an institution',
        'Leave it first in Settings.',
      );
    await this.prisma.$transaction([
      this.prisma.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: invite.tenantId, userId } },
        create: { tenantId: invite.tenantId, userId },
        update: { leftAt: null },
      }),
      this.prisma.inviteCode.update({
        where: { code: invite.code },
        data: { uses: { increment: 1 } },
      }),
      this.prisma.user.update({ where: { id: userId }, data: { tenantId: invite.tenantId } }),
      this.prisma.entitlement.create({
        data: {
          userId,
          planCode: 'institution',
          source: 'institution',
          status: 'active',
          tenantId: invite.tenantId,
        },
      }),
    ]);
    return { tenantId: invite.tenantId, name: invite.tenant.name };
  }

  async mine(userId: string): Promise<{
    tenant: { id: string; name: string; kind: string } | null;
    role: string | null;
    sharing: boolean;
  }> {
    const m = await this.prisma.tenantMembership.findFirst({
      where: { userId, leftAt: null },
      include: { tenant: true },
    });
    if (!m) return { tenant: null, role: null, sharing: false };
    return {
      tenant: { id: m.tenant.id, name: m.tenant.name, kind: m.tenant.kind },
      role: m.role,
      sharing: await this.consent.has(userId, 'institution_sharing'),
    };
  }

  async leave(userId: string): Promise<void> {
    const m = await this.prisma.tenantMembership.findFirst({ where: { userId, leftAt: null } });
    if (!m) throw new NotFound('institution membership');
    await this.prisma.$transaction([
      this.prisma.tenantMembership.update({ where: { id: m.id }, data: { leftAt: new Date() } }),
      this.prisma.user.update({ where: { id: userId }, data: { tenantId: null } }),
      this.prisma.entitlement.updateMany({
        where: { userId, source: 'institution', status: 'active' },
        data: { status: 'expired', endsAt: new Date() },
      }),
    ]);
  }

  /** "Ask for support": only what the member writes here reaches the support lead (D-17). */
  async outreach(userId: string, message: string, preferred: string): Promise<{ id: string }> {
    const m = await this.prisma.tenantMembership.findFirst({ where: { userId, leftAt: null } });
    if (!m) throw new NotFound('institution membership');
    const c = await this.crypto.forUser(userId);
    return this.prisma.outreachRequest.create({
      data: { tenantId: m.tenantId, userId, messageEnc: c.enc(message), preferred },
      select: { id: true },
    });
  }

  async assertLead(userId: string, tenantId: string): Promise<void> {
    const m = await this.prisma.tenantMembership.findFirst({
      where: { userId, tenantId, leftAt: null, role: { in: ['support_lead', 'admin'] } },
    });
    if (!m) throw new Forbidden('This is for your institution’s support team.');
  }

  async dashboard(
    userId: string,
    tenantId: string,
  ): Promise<{
    tenant: { name: string; anonymityFloor: number };
    members: number;
    sharing: number | null;
    weeks: {
      weekStart: string;
      metric: string;
      dimension: string;
      value: number | null;
      suppressed: boolean;
    }[];
  }> {
    await this.assertLead(userId, tenantId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const [members, rows] = await Promise.all([
      this.prisma.tenantMembership.count({ where: { tenantId, leftAt: null } }),
      this.prisma.cohortAggregate.findMany({
        where: { tenantId },
        orderBy: [{ weekStart: 'asc' }, { metric: 'asc' }],
      }),
    ]);
    const sharing = rows.filter((r) => r.metric === 'sharing_members').at(-1);
    return {
      tenant: { name: tenant.name, anonymityFloor: tenant.anonymityFloor },
      members,
      sharing: sharing?.suppressed ? null : (sharing?.value ?? null),
      weeks: rows.map((r) => ({
        weekStart: r.weekStart.toISOString().slice(0, 10),
        metric: r.metric,
        dimension: r.dimension,
        value: r.suppressed ? null : r.value,
        suppressed: r.suppressed,
      })),
    };
  }

  async outreachList(
    userId: string,
    tenantId: string,
  ): Promise<
    {
      id: string;
      message: string;
      preferred: string;
      status: string;
      createdAt: string;
      contact: string | null;
    }[]
  > {
    await this.assertLead(userId, tenantId);
    const rows = await this.prisma.outreachRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { email: true, nickname: true } } },
    });
    const out = [];
    for (const r of rows) {
      const c = await this.crypto.forUser(r.userId);
      out.push({
        id: r.id,
        message: c.dec(r.messageEnc),
        preferred: r.preferred,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        contact: r.user.nickname ? `${r.user.nickname} <${r.user.email ?? ''}>` : r.user.email,
      });
    }
    return out;
  }

  async handleOutreach(
    userId: string,
    tenantId: string,
    id: string,
    status: 'acknowledged' | 'closed',
  ): Promise<void> {
    await this.assertLead(userId, tenantId);
    const res = await this.prisma.outreachRequest.updateMany({
      where: { id, tenantId },
      data: { status, handledById: userId, handledAt: new Date() },
    });
    if (res.count === 0) throw new NotFound('request');
  }

  async inviteCode(
    userId: string,
    tenantId: string,
    maxUses: number | undefined,
    days: number,
  ): Promise<{ code: string; expiresAt: string }> {
    await this.assertLead(userId, tenantId);
    const code = randomBytes(6)
      .toString('base64url')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, 'X')
      .slice(0, 8);
    const expiresAt = new Date(Date.now() + days * DAY);
    await this.prisma.inviteCode.create({
      data: { code, tenantId, maxUses: maxUses ?? null, expiresAt },
    });
    return { code, expiresAt: expiresAt.toISOString() };
  }

  /** Worker (`institutions.aggregate`, nightly): weekly trends, suppressed under the floor. */
  async aggregate(now = new Date()): Promise<number> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, anonymityFloor: true },
    });
    let written = 0;
    for (const t of tenants) written += await this.aggregateTenant(t.id, t.anonymityFloor, now);
    return written;
  }

  private async sharingMembers(tenantId: string): Promise<string[]> {
    const members = await this.prisma.tenantMembership.findMany({
      where: { tenantId, leftAt: null },
      select: { userId: true },
    });
    const ids: string[] = [];
    for (const m of members)
      if (await this.consent.has(m.userId, 'institution_sharing')) ids.push(m.userId);
    return ids;
  }

  private async aggregateTenant(tenantId: string, floor: number, now: Date): Promise<number> {
    const users = await this.sharingMembers(tenantId);
    let written = 0;
    for (let w = 0; w < WEEKS; w += 1) {
      const start = weekStart(new Date(now.getTime() - w * 7 * DAY));
      const end = new Date(start.getTime() + 7 * DAY);
      const recs = await this.prisma.recommendation.findMany({
        where: { userId: { in: users }, createdAt: { gte: start, lt: end }, parentId: null },
        select: { userId: true, light: true },
      });
      const cells: { metric: string; dimension: string; value: number; people: number }[] = [
        { metric: 'sharing_members', dimension: '', value: users.length, people: users.length },
        {
          metric: 'checkins',
          dimension: '',
          value: recs.length,
          people: new Set(recs.map((r) => r.userId)).size,
        },
        ...LIGHTS.map((l) => {
          const xs = recs.filter((r) => r.light === l);
          return {
            metric: 'light',
            dimension: l,
            value: xs.length,
            people: new Set(xs.map((r) => r.userId)).size,
          };
        }),
      ];
      for (const cell of cells) {
        const suppressed = cell.people < floor;
        await this.prisma.cohortAggregate.upsert({
          where: {
            tenantId_weekStart_metric_dimension: {
              tenantId,
              weekStart: start,
              metric: cell.metric,
              dimension: cell.dimension,
            },
          },
          create: {
            tenantId,
            weekStart: start,
            metric: cell.metric,
            dimension: cell.dimension,
            value: suppressed ? null : cell.value,
            suppressed,
          },
          update: { value: suppressed ? null : cell.value, suppressed },
        });
        written += 1;
      }
    }
    this.logger.debug(`tenant ${tenantId}: ${String(written)} cells`);
    return written;
  }
}
