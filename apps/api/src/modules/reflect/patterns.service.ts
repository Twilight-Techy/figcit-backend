import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { z } from 'zod';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotEntitled } from '../../common/errors/errors.js';
import { localParts } from '../../common/time/timeline.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { InboxService } from '../notifications/inbox.service.js';
import { RulesService } from '../rules/rules.service.js';
import type { monthlySchema, patternsSchema } from './reflect.schemas.js';
import { recurringStruggle, struggleAnswer } from './struggle.js';

const DAY = 86_400_000;
const WEEKDAYS = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];
const MIN_CHECKINS = 6;

interface CheckInPoint {
  readonly mood: number | null;
  readonly createdAt: Date;
}

/** Rule-based pattern cards: plain words, never a diagnosis (FR-M10, S43, S133, S137). */
export function patternCards(
  points: readonly CheckInPoint[],
  timeZone: string,
): { code: string; text: string; evidence: string }[] {
  const moods = points.filter((p): p is CheckInPoint & { mood: number } => p.mood !== null);
  if (moods.length < MIN_CHECKINS) return [];
  const avg = moods.reduce((n, p) => n + p.mood, 0) / moods.length;
  const cards: { code: string; text: string; evidence: string }[] = [];
  const byDay = new Map<number, number[]>();
  const byPart = new Map<'morning' | 'afternoon' | 'evening', number[]>();
  for (const p of moods) {
    const local = localParts(p.createdAt, timeZone);
    byDay.set(local.weekday, [...(byDay.get(local.weekday) ?? []), p.mood]);
    const part =
      local.minutes < 12 * 60 ? 'morning' : local.minutes < 18 * 60 ? 'afternoon' : 'evening';
    byPart.set(part, [...(byPart.get(part) ?? []), p.mood]);
  }
  const mean = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / xs.length;
  const harder = [...byDay.entries()]
    .filter(([, xs]) => xs.length >= 2)
    .sort((a, b) => mean(a[1]) - mean(b[1]))[0];
  if (harder && mean(harder[1]) <= avg - 0.6)
    cards.push({
      code: 'harder_weekday',
      text: `${WEEKDAYS[harder[0]] ?? 'Some days'} are often harder for you.`,
      evidence: `Based on ${String(harder[1].length)} check-ins`,
    });
  const easier = [...byPart.entries()]
    .filter(([, xs]) => xs.length >= 3)
    .sort((a, b) => mean(b[1]) - mean(a[1]))[0];
  if (easier && mean(easier[1]) >= avg + 0.4)
    cards.push({
      code: `easier_${easier[0]}`,
      text: `${easier[0][0]?.toUpperCase() ?? ''}${easier[0].slice(1)}s tend to feel a bit easier.`,
      evidence: `Based on ${String(easier[1].length)} check-ins`,
    });
  return cards;
}

export function weekdayMoods(
  moods: readonly CheckInPoint[],
  timeZone: string,
): { weekday: number; averageMood: number | null; checkIns: number }[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const xs = moods.flatMap((p) =>
      p.mood !== null && localParts(p.createdAt, timeZone).weekday === weekday ? [p.mood] : [],
    );
    const averageMood = xs.length
      ? Math.round((xs.reduce((n, x) => n + x, 0) / xs.length) * 10) / 10
      : null;
    return { weekday, averageMood, checkIns: xs.length };
  });
}

function winOf(json: string): { text: string; size: string | null } {
  const a = JSON.parse(json) as { answers: { chips: string[]; text?: string }[]; winSize?: string };
  const first = a.answers[0];
  return { text: first?.text ?? first?.chips[0] ?? 'A win', size: a.winSize ?? null };
}

@Injectable()
export class PatternsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly rules: RulesService,
    private readonly entitlements: EntitlementsService,
    private readonly events: DomainEvents,
    private readonly inbox: InboxService,
  ) {}

  onModuleInit(): void {
    // Pattern 34 asks only when the user is steady (Green, Yellow or Blue), once per window.
    this.events.on('recommendation.created', async (e) => {
      if (e.light === 'amber' || e.light === 'red') return;
      await this.nudgeIfDue(e.userId);
    });
  }

  /** One inbox message pointing at "this has come up a few times", if there's one to ask. */
  async nudgeIfDue(userId: string, now = new Date()): Promise<boolean> {
    const prefs = await this.prisma.preferences.findUnique({
      where: { userId },
      select: { patternPrompts: true },
    });
    if (prefs?.patternPrompts === false) return false;
    if (!(await this.struggleToAsk(userId, now))) return false;
    const recent = await this.prisma.inboxItem.count({
      where: {
        userId,
        kind: 'pattern_prompt',
        createdAt: { gt: new Date(now.getTime() - 14 * DAY) },
      },
    });
    if (recent) return false;
    await this.inbox.add(userId, 'pattern_prompt');
    return true;
  }

  private async helped(
    userId: string,
    since: Date,
  ): Promise<z.infer<typeof patternsSchema>['whatHelps']> {
    const { snapshot } = await this.rules.current();
    const rows = await this.prisma.$queryRaw<
      { tool_id: string; pathway: string; sessions: number; helped: number }[]
    >`
      SELECT s.tool_id, s.pathway::text AS pathway, COUNT(*)::int AS sessions,
             COUNT(*) FILTER (WHERE f.outcome IN ('helped', 'a_bit'))::int AS helped
      FROM pathway_sessions s LEFT JOIN feedback f ON f.session_id = s.id
      WHERE s.user_id = ${userId}::uuid AND s.started_at > ${since}
      GROUP BY s.tool_id, s.pathway
      HAVING COUNT(*) FILTER (WHERE f.outcome IN ('helped', 'a_bit')) > 0
      ORDER BY helped DESC, sessions DESC
      LIMIT 5`;
    const names = new Map(snapshot.tools.map((t) => [t.id, t.name]));
    return rows.map((r) => ({
      toolId: r.tool_id,
      name: names.get(r.tool_id) ?? r.tool_id,
      pathway: r.pathway,
      helped: r.helped,
      sessions: r.sessions,
    }));
  }

  async patterns(userId: string, now = new Date()): Promise<z.infer<typeof patternsSchema>> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true, preferences: { select: { patternPrompts: true } } },
    });
    const promptsOn = user.preferences?.patternPrompts !== false;
    const since = new Date(now.getTime() - 30 * DAY);
    const [whatHelps, points, topics, saved] = await Promise.all([
      this.helped(userId, since),
      this.prisma.checkIn.findMany({
        where: { userId, deletedAt: null, createdAt: { gt: since } },
        select: { mood: true, createdAt: true },
      }),
      this.prisma.reflection.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { topicTag: true },
      }),
      this.prisma.reflection.findMany({
        where: { userId, deletedAt: null, saved: true, takeawayEnc: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, takeawayEnc: true, createdAt: true },
      }),
    ]);
    const cards = promptsOn ? patternCards(points, user.timezone) : [];
    const topicCounts = new Map<string, number>();
    for (const t of topics)
      if (t.topicTag) topicCounts.set(t.topicTag, (topicCounts.get(t.topicTag) ?? 0) + 1);
    const recurring = [...topicCounts.entries()].find(([, n]) => n >= 3);
    if (promptsOn && recurring)
      cards.push({
        code: 'recurring_topic',
        text: `You mentioned ${recurring[0].replace(/_/g, ' ')} in ${String(recurring[1])} of your last ${String(topics.length)} reflections.`,
        evidence: 'Plain words, not a diagnosis.',
      });
    const c = saved.length ? await this.crypto.forUser(userId) : null;
    return {
      struggle: promptsOn ? await this.struggleToAsk(userId, now) : null,
      promptsOn,
      whatHelps,
      cards,
      saved: saved.flatMap((s) =>
        c && s.takeawayEnc
          ? [{ id: s.id, takeaway: c.dec(s.takeawayEnc), createdAt: s.createdAt.toISOString() }]
          : [],
      ),
    };
  }

  /** Pattern 34: the recurring struggle to ask about, unless the user said not now or never. */
  private async struggleToAsk(
    userId: string,
    now: Date,
  ): Promise<z.infer<typeof patternsSchema>['struggle']> {
    const { snapshot } = await this.rules.current();
    const struggle = await recurringStruggle(this.prisma, snapshot, userId, now);
    if (!struggle) return null;
    const answer = await struggleAnswer(this.prisma, userId, struggle.family, now);
    if (answer === 'never' || answer === 'not_now') return null;
    return { ...struggle, confirmed: answer === 'confirmed' };
  }

  /** The user's answer to "this has come up a few times" (pattern 34). */
  async answerStruggle(
    userId: string,
    family: string,
    answer: 'confirmed' | 'not_now' | 'never',
  ): Promise<void> {
    await this.prisma.struggleConfirmation.create({ data: { userId, family, answer } });
  }

  /** Advanced: a gentle look back at one month (S137). */
  async monthly(
    userId: string,
    month: string | undefined,
    now = new Date(),
  ): Promise<z.infer<typeof monthlySchema>> {
    if (!(await this.entitlements.paid(userId))) throw new NotEntitled('The monthly summary');
    const m = month ?? now.toISOString().slice(0, 7);
    const start = new Date(`${m}-01T00:00:00Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const range = { gte: start, lt: end };
    const { snapshot } = await this.rules.current();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const [checkIns, sessions, stepsDone, used, wins, takeaway, moods] = await Promise.all([
      this.prisma.checkIn.count({ where: { userId, deletedAt: null, createdAt: range } }),
      this.prisma.pathwaySession.count({ where: { userId, startedAt: range } }),
      this.prisma.taskStep.count({ where: { task: { userId }, doneAt: range } }),
      this.prisma.pathwaySession.groupBy({
        by: ['pathway', 'toolId'],
        where: { userId, startedAt: range },
        _count: { _all: true },
        orderBy: { _count: { toolId: 'desc' } },
        take: 4,
      }),
      this.prisma.reflection.findMany({
        where: { userId, deletedAt: null, variant: 'win', createdAt: range },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { answersEnc: true },
      }),
      this.prisma.reflection.findFirst({
        where: {
          userId,
          deletedAt: null,
          saved: true,
          takeawayEnc: { not: null },
          createdAt: range,
        },
        orderBy: { createdAt: 'desc' },
        select: { takeawayEnc: true },
      }),
      this.prisma.checkIn.findMany({
        where: { userId, deletedAt: null, createdAt: range },
        select: { mood: true, createdAt: true },
      }),
    ]);
    const c = await this.crypto.forUser(userId);
    const names = new Map(snapshot.tools.map((t) => [t.id, t.name]));
    const days = weekdayMoods(moods, user.timezone);
    return {
      month: m,
      checkIns,
      sessions,
      stepsDone,
      mostUsed: used.map((u) => ({
        pathway: u.pathway,
        toolId: u.toolId,
        name: names.get(u.toolId) ?? u.toolId,
        count: u._count._all,
      })),
      carryForward: takeaway?.takeawayEnc ? c.dec(takeaway.takeawayEnc) : null,
      wins: wins.map((w) => winOf(c.dec(w.answersEnc))),
      harderDays: days,
    };
  }
}
