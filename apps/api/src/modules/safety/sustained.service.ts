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
    const candidates = await this.prisma.recommendation.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gt: new Date(now.getTime() - days.red * DAY) },
        band: { in: ['very_constrained', 'constrained'] },
      },
      _count: { _all: true },
    });
    let flagged = 0;
    for (const { userId } of candidates) {
      const recent = await this.prisma.safetyEvent.count({
        where: {
          userId,
          trigger: 'sustained',
          at: { gt: new Date(now.getTime() - QUIET_DAYS * DAY) },
        },
      });
      if (recent) continue;
      const points = await this.prisma.recommendation.findMany({
        where: { userId, createdAt: { gt: since }, parentId: null },
        select: { createdAt: true, band: true },
      });
      const flag = sustainedFlag(
        points.map((p) => ({ at: p.createdAt, band: p.band })),
        now,
        days,
      );
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
}
