import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotFound } from '../../common/errors/errors.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import { decodeCursor, encodeCursor } from '../checkin/checkin.mapper.js';
import { RulesService } from '../rules/rules.service.js';
import type {
  feedbackInputSchema,
  SessionDto,
  SessionStart,
  SessionUpdate,
} from './sessions.schemas.js';

const SELECT = {
  id: true,
  recommendationId: true,
  pathway: true,
  toolId: true,
  taskId: true,
  practiceId: true,
  startedAt: true,
  endedAt: true,
  lengthSeconds: true,
  completed: true,
  stoppedEarly: true,
  currentStepId: true,
  remainingSeconds: true,
  pausedAt: true,
  recommendation: { select: { light: true } },
  feedback: {
    select: {
      id: true,
      outcome: true,
      helpful: true,
      effort: true,
      recheckCheckInId: true,
      recheckRule: true,
      recoveryEndsAt: true,
    },
  },
} satisfies Prisma.PathwaySessionSelect;
type Row = Prisma.PathwaySessionGetPayload<{ select: typeof SELECT }>;

const STRAINED = new Set(['yellow', 'amber', 'red']);
const iso = (d: Date | null): string | null => d?.toISOString() ?? null;

function toDto(r: Row): SessionDto {
  const strained = r.recommendation ? STRAINED.has(r.recommendation.light) : false;
  return {
    id: r.id,
    recommendationId: r.recommendationId,
    pathway: r.pathway,
    toolId: r.toolId,
    taskId: r.taskId,
    practiceId: r.practiceId,
    startedAt: r.startedAt.toISOString(),
    endedAt: iso(r.endedAt),
    lengthSeconds: r.lengthSeconds,
    completed: r.completed,
    stoppedEarly: r.stoppedEarly,
    currentStepId: r.currentStepId,
    remainingSeconds: r.remainingSeconds,
    pausedAt: iso(r.pausedAt),
    feedback: r.feedback
      ? {
          ...r.feedback,
          recoveryEndsAt: iso(r.feedback.recoveryEndsAt),
          offerRecheck:
            strained && r.feedback.recheckCheckInId === null && r.feedback.outcome !== 'skipped',
        }
      : null,
  };
}

/** One row per tool use in any pathway, and "Did it help?" afterwards (S36–S38). */
@Injectable()
export class SessionsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: DomainEvents,
    private readonly rules: RulesService,
  ) {}

  onModuleInit(): void {
    this.events.on('recheck.evaluated', async (e) => {
      const { snapshot } = await this.rules.current();
      await this.linkRecheck(e.userId, e.previousCheckInId, {
        checkInId: e.checkInId,
        light: e.light,
        rule: e.rule,
        recoveryMinutes: snapshot.thresholds.recoveryMinutes,
      });
    });
  }

  private async owned(userId: string, id: string): Promise<Row> {
    const row = await this.prisma.pathwaySession.findFirst({
      where: { id, userId },
      select: SELECT,
    });
    if (!row) throw new NotFound('session');
    return row;
  }

  async get(userId: string, id: string): Promise<SessionDto> {
    return toDto(await this.owned(userId, id));
  }

  async start(userId: string, input: SessionStart): Promise<SessionDto> {
    if (input.id) {
      const existing = await this.prisma.pathwaySession.findFirst({
        where: { id: input.id, userId },
        select: SELECT,
      });
      if (existing) return toDto(existing);
    }
    await this.assertOwned(userId, input);
    const row = await this.prisma.pathwaySession.create({
      data: {
        ...(input.id ? { id: input.id } : {}),
        userId,
        recommendationId: input.recommendationId ?? null,
        pathway: input.pathway,
        toolId: input.toolId,
        taskId: input.taskId ?? null,
        practiceId: input.practiceId ?? null,
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
        eyesOpen: input.eyesOpen ?? null,
        contextPublic: input.contextPublic ?? null,
        origin: input.origin,
      },
      select: SELECT,
    });
    if (input.recommendationId) {
      await this.prisma.recommendationAction.create({
        data: {
          recommendationId: input.recommendationId,
          userId,
          action: 'start',
          toolId: input.toolId,
        },
      });
    }
    return toDto(row);
  }

  private async assertOwned(userId: string, input: SessionStart): Promise<void> {
    const [rec, task, practice] = await Promise.all([
      input.recommendationId
        ? this.prisma.recommendation.count({ where: { id: input.recommendationId, userId } })
        : 1,
      input.taskId
        ? this.prisma.task.count({ where: { id: input.taskId, userId, deletedAt: null } })
        : 1,
      input.practiceId
        ? this.prisma.practice.count({ where: { id: input.practiceId, userId, deletedAt: null } })
        : 1,
    ]);
    if (!rec) throw new NotFound('recommendation');
    if (!task) throw new NotFound('task');
    if (!practice) throw new NotFound('practice');
  }

  async update(userId: string, id: string, input: SessionUpdate): Promise<SessionDto> {
    const before = await this.owned(userId, id);
    const data: Prisma.PathwaySessionUncheckedUpdateInput = {
      ...(input.endedAt !== undefined ? { endedAt: new Date(input.endedAt) } : {}),
      ...(input.lengthSeconds !== undefined ? { lengthSeconds: input.lengthSeconds } : {}),
      ...(input.completed !== undefined ? { completed: input.completed } : {}),
      ...(input.stoppedEarly !== undefined ? { stoppedEarly: input.stoppedEarly } : {}),
      ...(input.currentStepId !== undefined ? { currentStepId: input.currentStepId } : {}),
      ...(input.remainingSeconds !== undefined ? { remainingSeconds: input.remainingSeconds } : {}),
      ...(input.paused !== undefined ? { pausedAt: input.paused ? new Date() : null } : {}),
    };
    if (
      (input.completed === true || input.stoppedEarly === true) &&
      !before.endedAt &&
      input.endedAt === undefined
    )
      data.endedAt = new Date();
    const row = await this.prisma.pathwaySession.update({ where: { id }, data, select: SELECT });
    if (input.completed === true && !before.completed)
      this.events.emit('session.completed', { userId, sessionId: id, pathway: row.pathway });
    return toDto(row);
  }

  async feedback(
    userId: string,
    id: string,
    input: z.infer<typeof feedbackInputSchema>,
  ): Promise<SessionDto> {
    await this.owned(userId, id);
    await this.prisma.feedback.upsert({
      where: { sessionId: id },
      create: {
        sessionId: id,
        userId,
        outcome: input.outcome,
        helpful: input.helpful ?? null,
        effort: input.effort ?? null,
      },
      update: {
        outcome: input.outcome,
        helpful: input.helpful ?? null,
        effort: input.effort ?? null,
      },
    });
    return this.get(userId, id);
  }

  async list(
    userId: string,
    q: { pathway?: SessionDto['pathway'] | undefined; after?: string | undefined; limit: number },
  ): Promise<{ items: SessionDto[]; next: string | null }> {
    const after = q.after ? decodeCursor(q.after) : null;
    const rows = await this.prisma.pathwaySession.findMany({
      where: {
        userId,
        ...(q.pathway ? { pathway: q.pathway } : {}),
        ...(after
          ? {
              OR: [
                { startedAt: { lt: after.createdAt } },
                { startedAt: after.createdAt, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: q.limit + 1,
      select: SELECT,
    });
    const items = rows.slice(0, q.limit);
    const last = items.at(-1);
    return {
      items: items.map(toDto),
      next: rows.length > q.limit && last ? encodeCursor(last.startedAt, last.id) : null,
    };
  }

  /**
   * Links a re-check to the feedback of the session before it and opens the Blue recovery
   * window when the engine says so (RC-1). Called by the check-in service.
   */
  async linkRecheck(
    userId: string,
    previousCheckInId: string,
    recheck: { checkInId: string; light: string; rule: string | null; recoveryMinutes: number },
  ): Promise<void> {
    const session = await this.prisma.pathwaySession.findFirst({
      where: { userId, recommendation: { checkInId: previousCheckInId } },
      orderBy: { startedAt: 'desc' },
      select: { id: true, feedback: { select: { id: true } } },
    });
    if (!session) return;
    const now = new Date();
    const blue = recheck.light === 'blue';
    const data = {
      recheckCheckInId: recheck.checkInId,
      recheckRule: recheck.rule,
      ...(blue
        ? {
            recoveryStartedAt: now,
            recoveryEndsAt: new Date(now.getTime() + recheck.recoveryMinutes * 60_000),
          }
        : {}),
    };
    await this.prisma.feedback.upsert({
      where: { sessionId: session.id },
      create: { sessionId: session.id, userId, outcome: 'skipped', ...data },
      update: data,
    });
  }
}
