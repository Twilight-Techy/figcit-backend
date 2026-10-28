import { Injectable } from '@nestjs/common';
import type { Light } from '@figcit/engine';
import { PrismaService } from '../../common/db/prisma.service.js';
import { localParts } from '../../common/time/timeline.js';
import { RulesService } from '../rules/rules.service.js';
import type { ProgressDto } from './progress.schemas.js';

const DAY = 86_400_000;
const LIGHT_ORDER: readonly Light[] = ['red', 'amber', 'yellow', 'blue', 'green'];
const round = (n: number): number => Math.round(n * 10) / 10;

/** Progress: what happened and what helped, without scores, streaks or blame (M12, S47, S49). */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
  ) {}

  async didItHelp(userId: string, since: Date): Promise<ProgressDto['didItHelp']> {
    const { snapshot } = await this.rules.current();
    const rows = await this.prisma.$queryRaw<
      {
        tool_id: string;
        pathway: string;
        sessions: number;
        helped: number;
        a_bit: number;
        not_really: number;
      }[]
    >`
      SELECT s.tool_id, s.pathway::text AS pathway, COUNT(*)::int AS sessions,
        COUNT(*) FILTER (WHERE f.outcome = 'helped')::int AS helped,
        COUNT(*) FILTER (WHERE f.outcome = 'a_bit')::int AS a_bit,
        COUNT(*) FILTER (WHERE f.outcome = 'not_really')::int AS not_really
      FROM pathway_sessions s LEFT JOIN feedback f ON f.session_id = s.id
      WHERE s.user_id = ${userId}::uuid AND s.started_at > ${since}
      GROUP BY s.tool_id, s.pathway ORDER BY helped DESC, sessions DESC LIMIT 20`;
    const names = new Map(snapshot.tools.map((t) => [t.id, t.name]));
    return rows.map((r) => ({
      toolId: r.tool_id,
      name: names.get(r.tool_id) ?? r.tool_id,
      pathway: r.pathway,
      sessions: r.sessions,
      helped: r.helped,
      aBit: r.a_bit,
      notReally: r.not_really,
    }));
  }

  private days(
    rangeDays: number,
    now: Date,
    tz: string,
    rows: readonly {
      createdAt: Date;
      mood: number | null;
      energy: number | null;
      light: Light | null;
    }[],
  ): ProgressDto['days'] {
    const byDate = new Map<string, typeof rows>();
    for (const r of rows) {
      const d = localParts(r.createdAt, tz).date;
      byDate.set(d, [...(byDate.get(d) ?? []), r]);
    }
    return Array.from({ length: rangeDays }, (_, i) => {
      const date = localParts(new Date(now.getTime() - (rangeDays - 1 - i) * DAY), tz).date;
      const xs = byDate.get(date) ?? [];
      const mood = xs.flatMap((x) => (x.mood === null ? [] : [x.mood]));
      const energy = xs.flatMap((x) => (x.energy === null ? [] : [x.energy]));
      // The hardest light of the day, so a tough moment is not averaged away.
      const light = LIGHT_ORDER.find((l) => xs.some((x) => x.light === l)) ?? null;
      return {
        date,
        checkIns: xs.length,
        light,
        averageMood: mood.length ? round(mood.reduce((a, b) => a + b, 0) / mood.length) : null,
        averageEnergy: energy.length
          ? round(energy.reduce((a, b) => a + b, 0) / energy.length)
          : null,
      };
    });
  }

  async progress(userId: string, rangeDays: number, now = new Date()): Promise<ProgressDto> {
    const since = new Date(now.getTime() - rangeDays * DAY);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    const [checkIns, pathways, didItHelp, done, stepsDone, open, reflections, wins] =
      await Promise.all([
        this.prisma.checkIn.findMany({
          where: { userId, deletedAt: null, createdAt: { gt: since } },
          select: {
            createdAt: true,
            mood: true,
            energy: true,
            recommendations: { orderBy: { createdAt: 'desc' }, take: 1, select: { light: true } },
          },
        }),
        this.prisma.pathwaySession.groupBy({
          by: ['pathway'],
          where: { userId, startedAt: { gt: since } },
          _count: { _all: true },
          _sum: { lengthSeconds: true },
        }),
        this.didItHelp(userId, since),
        this.prisma.task.count({ where: { userId, deletedAt: null, doneAt: { gt: since } } }),
        this.prisma.taskStep.count({ where: { task: { userId }, doneAt: { gt: since } } }),
        this.prisma.task.count({ where: { userId, deletedAt: null, status: 'open' } }),
        this.prisma.reflection.count({
          where: { userId, deletedAt: null, createdAt: { gt: since } },
        }),
        this.prisma.reflection.count({
          where: { userId, deletedAt: null, variant: 'win', createdAt: { gt: since } },
        }),
      ]);
    const rows = checkIns.map((c) => ({
      createdAt: c.createdAt,
      mood: c.mood,
      energy: c.energy,
      light: c.recommendations[0]?.light ?? null,
    }));
    const lights = { green: 0, yellow: 0, amber: 0, red: 0, blue: 0 };
    for (const r of rows) if (r.light) lights[r.light] += 1;
    const days = this.days(rangeDays, now, user.timezone, rows);
    const best = didItHelp.find((d) => d.helped + d.aBit >= 2);
    const notes = [
      ...(best ? [`${best.name} helped ${String(best.helped + best.aBit)} times.`] : []),
      ...(lights.blue
        ? [
            `You found your way back to steadier ${String(lights.blue)} time${lights.blue === 1 ? '' : 's'}.`,
          ]
        : []),
      ...(rows.length === 0 ? ['No check-ins in this range. That is okay.'] : []),
    ];
    return {
      rangeDays,
      from: days[0]?.date ?? '',
      to: days.at(-1)?.date ?? '',
      checkIns: rows.length,
      days,
      lights,
      pathways: pathways.map((p) => ({
        pathway: p.pathway,
        sessions: p._count._all,
        minutes: Math.round((p._sum.lengthSeconds ?? 0) / 60),
      })),
      didItHelp,
      tasks: { done, stepsDone, open },
      reflections: { count: reflections, wins },
      notes,
    };
  }
}
