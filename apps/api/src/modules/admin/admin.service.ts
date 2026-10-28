import { Injectable } from '@nestjs/common';
import type { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service.js';
import { BadInput, Forbidden, NotFound } from '../../common/errors/errors.js';
import { STAFF_ROLES } from '../../common/guards/auth.guard.js';
import type { RequestUser } from '../../common/guards/request-user.js';
import { AuditService } from '../audit/audit.service.js';
import { ContentService } from '../content/content.service.js';

const DAY = 86_400_000;

/** Staff views: decision log, safety events, metrics, staff roles, content (S70–S90). No user text. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly content: ContentService,
  ) {}

  async decisions(q: {
    light?: string | undefined;
    pattern?: string | undefined;
    limit: number;
  }): Promise<unknown[]> {
    const rows = await this.prisma.recommendation.findMany({
      where: {
        ...(q.light ? { light: q.light as never } : {}),
        ...(q.pattern ? { patterns: { has: q.pattern } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
      select: {
        id: true,
        light: true,
        cellId: true,
        band: true,
        patterns: true,
        gates: true,
        safetyTriggered: true,
        engineVersion: true,
        snapshotVersion: true,
        origin: true,
        createdAt: true,
        primary: true,
      },
    });
    return rows.map((r) => ({ ...r, primary: r.primary, createdAt: r.createdAt.toISOString() }));
  }

  /** One decision with its trace, for replay (codes only: free text never enters the trace). */
  async decision(staff: RequestUser, id: string): Promise<unknown> {
    const r = await this.prisma.recommendation.findUnique({
      where: { id },
      select: {
        id: true,
        light: true,
        cellId: true,
        band: true,
        patterns: true,
        gates: true,
        trace: true,
        engineVersion: true,
        snapshotVersion: true,
        createdAt: true,
      },
    });
    if (!r) throw new NotFound('decision');
    await this.audit.record({
      actorId: staff.id,
      actorRole: staff.roles[0] ?? 'staff',
      action: 'decision.view',
      targetType: 'recommendation',
      targetId: id,
    });
    return { ...r, createdAt: r.createdAt.toISOString() };
  }

  async safetyEvents(
    days: number,
  ): Promise<{ byDay: { day: string; trigger: string; count: number }[]; recent: unknown[] }> {
    const since = new Date(Date.now() - days * DAY);
    const byDay = await this.prisma.$queryRaw<{ day: Date; trigger: string; count: number }[]>`
      SELECT date_trunc('day', at) AS day, trigger::text AS trigger, COUNT(*)::int AS count
      FROM safety_events WHERE at > ${since} GROUP BY 1, 2 ORDER BY 1 DESC`;
    const recent = await this.prisma.safetyEvent.findMany({
      where: { at: { gt: since } },
      orderBy: { at: 'desc' },
      take: 100,
      select: {
        id: true,
        sourceModule: true,
        trigger: true,
        ruleId: true,
        category: true,
        routeChosen: true,
        origin: true,
        at: true,
      },
    });
    return {
      byDay: byDay.map((b) => ({
        day: b.day.toISOString().slice(0, 10),
        trigger: b.trigger,
        count: b.count,
      })),
      recent: recent.map((e) => ({ ...e, at: e.at.toISOString() })),
    };
  }

  async metrics(): Promise<Record<string, unknown>> {
    const week = new Date(Date.now() - 7 * DAY);
    const [users, active, checkIns, lights, plus, rollups, aiCalls] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.checkIn
        .groupBy({ by: ['userId'], where: { createdAt: { gt: week } } })
        .then((r) => r.length),
      this.prisma.checkIn.count({ where: { createdAt: { gt: week } } }),
      this.prisma.recommendation.groupBy({
        by: ['light'],
        where: { createdAt: { gt: week } },
        _count: { _all: true },
      }),
      this.prisma.entitlement.count({
        where: { status: { in: ['active', 'grace'] }, planCode: { not: 'free' } },
      }),
      this.prisma.dailyRollup.findMany({
        where: { day: { gt: new Date(Date.now() - 30 * DAY) } },
        orderBy: { day: 'asc' },
      }),
      this.prisma.aiCall.groupBy({
        by: ['task', 'outcome'],
        where: { at: { gt: week } },
        _count: { _all: true },
        _avg: { latencyMs: true },
      }),
    ]);
    return {
      users,
      activeUsers7d: active,
      checkIns7d: checkIns,
      lights7d: Object.fromEntries(lights.map((l) => [l.light, l._count._all])),
      plusSubscribers: plus,
      daily: rollups.map((r) => ({
        day: r.day.toISOString().slice(0, 10),
        metric: r.metric,
        dimension: r.dimension,
        value: Number(r.value),
      })),
      ai7d: aiCalls.map((a) => ({
        task: a.task,
        outcome: a.outcome,
        count: a._count._all,
        avgLatencyMs: Math.round(a._avg.latencyMs ?? 0),
      })),
    };
  }

  async staff(): Promise<{ id: string; email: string | null; roles: string[]; mfa: boolean }[]> {
    const rows = await this.prisma.user.findMany({
      where: { roles: { hasSome: [...STAFF_ROLES] }, deletedAt: null },
      select: { id: true, email: true, roles: true, _count: { select: { mfaFactors: true } } },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      roles: r.roles,
      mfa: r._count.mfaFactors > 0,
    }));
  }

  async setRoles(
    admin: RequestUser,
    userId: string,
    roles: readonly string[],
  ): Promise<{ id: string; roles: string[] }> {
    if (!admin.roles.includes('admin')) throw new Forbidden('Only an admin changes roles.');
    if (admin.id === userId && !roles.includes('admin'))
      throw new BadInput("You can't remove your own admin role.");
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    });
    if (!user) throw new NotFound('user');
    const kept = user.roles.filter((r) => !(STAFF_ROLES as readonly string[]).includes(r));
    const next = [...new Set([...kept, ...roles])] as UserRole[];
    await this.prisma.user.update({ where: { id: userId }, data: { roles: next } });
    await this.audit.record({
      actorId: admin.id,
      actorRole: 'admin',
      action: 'staff.roles',
      targetType: 'user',
      targetId: userId,
      meta: { roles: [...roles] },
    });
    return { id: userId, roles: next };
  }

  async contentItems(kind: string | undefined): Promise<unknown[]> {
    const rows = await this.prisma.contentItem.findMany({
      where: kind ? { kind: kind as never } : {},
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
      take: 200,
      select: {
        id: true,
        key: true,
        kind: true,
        version: true,
        status: true,
        touchesSafety: true,
        body: true,
        createdAt: true,
        publishedAt: true,
      },
    });
    return rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      publishedAt: r.publishedAt?.toISOString() ?? null,
    }));
  }

  async draftContent(
    staff: RequestUser,
    input: { key: string; kind: string; body: unknown; touchesSafety: boolean },
  ): Promise<{ id: string; version: number }> {
    const last = await this.prisma.contentItem.findFirst({
      where: { key: input.key, locale: 'en-GB' },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const row = await this.prisma.contentItem.create({
      data: {
        key: input.key,
        kind: input.kind as never,
        version: (last?.version ?? 0) + 1,
        body: input.body as Prisma.InputJsonValue,
        touchesSafety: input.touchesSafety,
        authorId: staff.id,
        status: 'in_review',
      },
      select: { id: true, version: true },
    });
    await this.audit.record({
      actorId: staff.id,
      actorRole: 'content_editor',
      action: 'content.draft',
      targetType: 'content_item',
      targetId: row.id,
    });
    return row;
  }

  /** Content that touches safety needs a safety reviewer, and never its own author. */
  async publishContent(staff: RequestUser, id: string): Promise<{ id: string; releaseId: number }> {
    const item = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!item) throw new NotFound('content item');
    if (item.authorId === staff.id) throw new Forbidden('Someone else needs to review this.');
    if (item.touchesSafety && !staff.roles.includes('safety_reviewer'))
      throw new Forbidden('A safety reviewer publishes this.');
    const release = await this.prisma.contentRelease.create({
      data: { publishedBy: staff.id, itemCount: 1 },
    });
    await this.prisma.contentItem.update({
      where: { id },
      data: {
        status: 'published',
        reviewerId: staff.id,
        reviewedAt: new Date(),
        publishedAt: new Date(),
        releaseId: release.id,
      },
    });
    this.content.invalidate();
    await this.audit.record({
      actorId: staff.id,
      actorRole: staff.roles[0] ?? 'staff',
      action: 'content.publish',
      targetType: 'content_item',
      targetId: id,
    });
    return { id, releaseId: release.id };
  }

  async auditLog(before: string | undefined): Promise<unknown[]> {
    const rows = await this.audit.list(before ? { before: new Date(before) } : {}, 100);
    return rows.map((r) => ({ ...r, at: r.at.toISOString() }));
  }
}
