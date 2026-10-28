import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { sha256 } from '../../common/crypto/envelope.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { ConsentService } from '../consent/consent.service.js';

export interface IncomingEvent {
  readonly name: string;
  readonly props?: Record<string, string | number | boolean> | undefined;
  readonly at?: string | undefined;
}

const MAX_AGE_MS = 7 * 86_400_000;

/** Product analytics: codes only, a pseudonymous hash, and only with consent (rules §8). */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
  ) {}

  async ingest(
    caller: {
      userId?: string | undefined;
      browseToken?: string | undefined;
      deviceConsent: boolean;
    },
    events: readonly IncomingEvent[],
  ): Promise<{ accepted: number; dropped: number }> {
    const allowed = caller.userId
      ? await this.consent.has(caller.userId, 'analytics')
      : caller.deviceConsent;
    if (!allowed) return { accepted: 0, dropped: events.length };
    const userHash = caller.userId
      ? sha256(`a:${caller.userId}`)
      : caller.browseToken
        ? sha256(`a:b:${caller.browseToken}`)
        : null;
    const now = Date.now();
    const rows: Prisma.EventCreateManyInput[] = events.flatMap((e) => {
      const at = e.at ? new Date(e.at) : new Date(now);
      if (
        Number.isNaN(at.getTime()) ||
        now - at.getTime() > MAX_AGE_MS ||
        at.getTime() > now + 60_000
      )
        return [];
      return [{ name: e.name, userHash, props: e.props ?? {}, at }];
    });
    if (rows.length) await this.prisma.event.createMany({ data: rows });
    return { accepted: rows.length, dropped: events.length - rows.length };
  }

  /** Worker (daily): yesterday's counts per event name, for the admin metrics view. */
  async rollup(day = new Date(Date.now() - 86_400_000)): Promise<number> {
    const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    const end = new Date(start.getTime() + 86_400_000);
    const counts = await this.prisma.event.groupBy({
      by: ['name'],
      where: { at: { gte: start, lt: end } },
      _count: { _all: true },
    });
    const people = await this.prisma.$queryRaw<
      { n: bigint }[]
    >`SELECT COUNT(DISTINCT user_hash) AS n FROM events WHERE at >= ${start} AND at < ${end}`;
    const rows = [
      ...counts.map((c) => ({
        day: start,
        metric: `event.${c.name}`.slice(0, 48),
        dimension: '',
        value: BigInt(c._count._all),
      })),
      { day: start, metric: 'active_devices', dimension: '', value: people[0]?.n ?? 0n },
    ];
    for (const r of rows)
      await this.prisma.dailyRollup.upsert({
        where: { day_metric_dimension: { day: r.day, metric: r.metric, dimension: r.dimension } },
        create: r,
        update: { value: r.value },
      });
    return rows.length;
  }
}
