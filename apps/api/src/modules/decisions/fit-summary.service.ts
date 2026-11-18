import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotEntitled } from '../../common/errors/errors.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { EngineRuntimeService } from './engine-runtime.service.js';
import type { FitSummaryDto } from './v5.schemas.js';

/** RW-5: 2 to 4 weeks; the summary shows the last 28 days. */
const DAYS = 28;
const LIGHTS = ['green', 'yellow', 'blue', 'amber', 'red'];

/**
 * My fit summary (RW-5, Premium): the user's own v5.0 check-ins of the last 28 days, by colour,
 * with the kinds of task they brought (their chips, TK-1). Read from the decision records, which
 * hold no task titles. Owned by the user; nothing is shared from here.
 */
@Injectable()
export class FitSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
    private readonly runtime: EngineRuntimeService,
  ) {}

  async summary(userId: string, now = new Date()): Promise<FitSummaryDto> {
    if ((await this.entitlements.tierFor(userId, now)) !== 'premium')
      throw new NotEntitled('My fit summary', 'Premium');
    const from = new Date(now.getTime() - DAYS * 86_400_000);
    const rows = await this.prisma.decisionRecord.findMany({
      where: { userId, createdAt: { gte: from }, light: { not: null } },
      select: { light: true, input: true },
      take: 500,
    });
    const v5 = rows.filter(
      (r) => typeof (r.input as Record<string, unknown>)['checkin.mode'] === 'string',
    );
    const labels = await this.chipLabels();
    const lights = LIGHTS.map((light) => {
      const these = v5.filter((r) => r.light === light);
      const counts = new Map<string, number>();
      for (const r of these) {
        const chips = (r.input as Record<string, unknown>)['tasks.chips'];
        if (Array.isArray(chips))
          for (const c of chips) if (typeof c === 'string') counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      return {
        light,
        checkIns: these.length,
        chips: [...counts]
          .sort((a, b) => b[1] - a[1])
          .map(([chip, n]) => ({ chip, label: labels.get(chip) ?? chip, checkIns: n })),
      };
    }).filter((l) => l.checkIns > 0);
    return { from: from.toISOString(), to: now.toISOString(), checkIns: v5.length, lights };
  }

  /** The chips' plain words from the published version (Tab 10: "the usual things"). */
  private async chipLabels(): Promise<ReadonlyMap<string, string>> {
    const engine = await this.runtime.current().catch(() => null);
    const chips = engine?.ruleset.catalogue.get('task_chip') ?? [];
    return new Map(chips.map((c) => [c.code, c.label]));
  }
}
