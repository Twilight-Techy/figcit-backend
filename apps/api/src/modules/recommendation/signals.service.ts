import { Injectable } from '@nestjs/common';
import type { SavedPracticeSignal, UserSignals } from '@figcit/engine';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { dueNow, parseRule } from '../../common/time/rrule.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';

const SESSION_WINDOW_MS = 2 * 3_600_000; // a "session" for pattern 30 declines
const REJECTION_WINDOW_MS = 24 * 3_600_000;
const SAFETY_WINDOW_MS = 24 * 3_600_000;
const OUTCOME_WINDOW_MS = 90 * 86_400_000;

/** Loads what the engine needs to know about the user (UserSignals). The engine never queries. */
@Injectable()
export class SignalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly entitlements: EntitlementsService,
  ) {}

  private query(userId: string, now: Date) {
    return Promise.all([
      this.entitlements.tierFor(userId, now),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          region: true,
          timezone: true,
          preferences: { select: { patternPrompts: true, personalisation: true } },
        },
      }),
      this.prisma.recommendationAction.findMany({
        where: {
          userId,
          at: { gt: new Date(now.getTime() - REJECTION_WINDOW_MS) },
          action: { in: ['not_now', 'try_another', 'start'] },
        },
        orderBy: { at: 'desc' },
        take: 50,
        select: { action: true, toolId: true, at: true, reason: true },
      }),
      this.prisma.userTopicCount.findMany({
        where: { userId, count7d: { gte: 3 } },
        select: { topicTag: true },
        take: 20,
      }),
      this.prisma.practice.findMany({
        where: { userId, deletedAt: null },
        orderBy: { position: 'asc' },
        take: 50,
        select: {
          id: true,
          type: true,
          nameEnc: true,
          scheduleRule: true,
          helpsWhenStruggling: true,
          makesMeWorse: true,
          isTransitionRitual: true,
        },
      }),
      this.prisma.trustedContact.count({ where: { userId, deletedAt: null } }),
      this.prisma.safetyEvent.count({
        where: { userId, at: { gt: new Date(now.getTime() - SAFETY_WINDOW_MS) } },
      }),
      this.prisma.feedback.findFirst({
        where: { userId, recoveryEndsAt: { gt: now } },
        select: { id: true },
      }),
      this.prisma.$queryRaw<{ tool_id: string; score: number }[]>`
        SELECT s.tool_id, SUM(CASE f.outcome WHEN 'helped' THEN 1 WHEN 'a_bit' THEN 0.5 WHEN 'not_really' THEN -1 ELSE 0 END)::float AS score
        FROM feedback f JOIN pathway_sessions s ON s.id = f.session_id
        WHERE f.user_id = ${userId}::uuid AND f.created_at > ${new Date(now.getTime() - OUTCOME_WINDOW_MS)}
        GROUP BY s.tool_id`,
    ]);
  }

  async load(userId: string, now = new Date()): Promise<UserSignals> {
    const [plan, user, actions, topics, practices, contacts, safety, recovery, outcomes] =
      await this.query(userId, now);

    const sessionStart = now.getTime() - SESSION_WINDOW_MS;
    // Declines since the last "start" in this session (pattern 30).
    let declines = 0;
    for (const a of actions) {
      if (a.at.getTime() < sessionStart || a.action === 'start') break;
      declines += 1;
    }
    const rejected = [
      ...new Set(
        actions.filter((a) => a.action !== 'start' && a.toolId).map((a) => a.toolId as string),
      ),
    ];
    const cipher = practices.length > 0 ? await this.crypto.forUser(userId) : null;
    const saved: SavedPracticeSignal[] = practices.map((p) => {
      const rule = parseRule(p.scheduleRule);
      return {
        id: p.id,
        name: cipher ? cipher.dec(p.nameEnc) : 'my practice',
        type: p.type,
        helpsWhenStruggling: p.helpsWhenStruggling,
        isTransition: p.isTransitionRitual,
        dueNow: rule ? dueNow(rule, now, user.timezone) : false,
        opening: rule ? rule.minutes < 11 * 60 : false,
        closing: rule ? rule.minutes >= 19 * 60 : false,
      };
    });
    return {
      plan,
      declinesThisSession: declines,
      rejectedToolIds: rejected,
      ruminationTopics: topics.map((t) => t.topicTag),
      meditationMakesWorse: practices.some((p) => p.makesMeWorse),
      patternPromptsOff: user.preferences?.patternPrompts === false,
      savedPractices: saved,
      hasTrustedContact: contacts > 0,
      safetyEventRecently: safety > 0,
      recoveryActive: recovery !== null,
      toolScores: Object.fromEntries(outcomes.map((o) => [o.tool_id, o.score])),
      personalisation: user.preferences?.personalisation !== false,
      region: user.region,
    };
  }
}
