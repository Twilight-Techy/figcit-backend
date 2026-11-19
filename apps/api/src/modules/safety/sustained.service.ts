import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service.js';
import { InboxService } from '../notifications/inbox.service.js';
import { RulesService } from '../rules/rules.service.js';
import { sustainedFlag } from './sustained.js';

const DAY = 86_400_000;
const QUIET_DAYS = 7;

/** Worker (daily, `checkin.sustained-red`): finds sustained strain and offers support gently. */
@Injectable()
export class SustainedService {
  private readonly logger = new Logger('SF-2');

  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly inbox: InboxService,
  ) {}

  async run(now = new Date()): Promise<number> {
    const { snapshot } = await this.rules.current();
    const days = {
      red: snapshot.thresholds.sustainedRedDays,
      noImprovement: snapshot.thresholds.sustainedNoImprovementDays,
    };
    const since = new Date(now.getTime() - days.noImprovement * DAY);
    const hard = {
      createdAt: { gt: new Date(now.getTime() - days.red * DAY) },
      band: { in: ['very_constrained', 'constrained'] },
    };
    // v1 and v3.3 check-ins keep a recommendation; v5.0's keep only their decision record.
    const [recs, decided] = await Promise.all([
      this.prisma.recommendation.findMany({
        where: hard,
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.decisionRecord.findMany({
        where: { ...hard, mode: 'signed_in', userId: { not: null } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);
    // A decision record outlives its account (it is the audit trail), so only live accounts.
    const ids = [...new Set([...recs, ...decided].flatMap((r) => (r.userId ? [r.userId] : [])))];
    const candidates = await this.prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    });
    let flagged = 0;
    for (const { id: userId } of candidates) {
      const recent = await this.prisma.safetyEvent.count({
        where: {
          userId,
          trigger: 'sustained',
          at: { gt: new Date(now.getTime() - QUIET_DAYS * DAY) },
        },
      });
      if (recent) continue;
      const points = await this.points(userId, since);
      const flag = sustainedFlag(points, now, days);
      if (!flag) continue;
      await this.prisma.safetyEvent.create({
        data: { userId, sourceModule: 'sf2', trigger: 'sustained', ruleId: 'SF-2', category: flag },
      });
      await this.inbox.add(userId, 'support_prompt', { type: 'sf2' });
      flagged += 1;
    }
    if (flagged) this.logger.log(`SF-2 raised for ${String(flagged)} users`);
    return flagged;
  }

  /**
   * One point per check-in since `since`: each recommendation (v1, v3.3), and each v5.0 decision
   * record, which has no recommendation. A v3.3 check-in keeps both, so a record a recommendation
   * already points to is skipped. A Help/SOS screen has no band of its own (a recommendation stores
   * it as Conditional), so it never counts as getting better: risk words must not quiet SF-2.
   */
  private async points(userId: string, since: Date): Promise<{ at: Date; band: string }[]> {
    const [recs, records] = await Promise.all([
      this.prisma.recommendation.findMany({
        // Re-runs too (Adapt, "correct"): not points, but their decision records are bridged.
        where: { userId, createdAt: { gt: since } },
        select: { createdAt: true, band: true, safetyTriggered: true, parentId: true, trace: true },
      }),
      this.prisma.decisionRecord.findMany({
        where: { userId, mode: 'signed_in', createdAt: { gt: since }, supportScreen: false },
        select: { id: true, createdAt: true, band: true },
      }),
    ]);
    const bridged = new Set(recs.flatMap((r) => decisionIdOf(r.trace)));
    return [
      ...recs
        .filter((r) => !r.parentId && !r.safetyTriggered)
        .map((r) => ({ at: r.createdAt, band: r.band })),
      ...records.flatMap((r) =>
        r.band && !bridged.has(r.id) ? [{ at: r.createdAt, band: r.band }] : [],
      ),
    ];
  }
}

/** The decision record a v3.3 recommendation was made from (its trace's `decisionId`). */
const decisionIdOf = (trace: unknown): string[] => {
  const id = (trace as { decisionId?: unknown } | null)?.decisionId;
  return typeof id === 'string' ? [id] : [];
};
