import { Injectable } from '@nestjs/common';
import type { Band, PreviousOutcome } from '@figcit/engine';
import { CryptoService, type UserCipher } from '../../common/crypto/crypto.service.js';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';
import { NotFound } from '../../common/errors/errors.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import type { CardDto } from '../recommendation/recommendation.schemas.js';
import {
  checkInData,
  decodeCursor,
  demandTimeline,
  encodeCursor,
  taskData,
  toEngineInput,
  toSummary,
  type Summary,
} from './checkin.mapper.js';
import { CheckInEngineService } from './checkin-engine.service.js';
import { CheckInInputService } from './checkin-input.service.js';
import { CheckInRepository } from './checkin.repository.js';
import type { CheckInInput } from './checkin.schemas.js';

@Injectable()
export class CheckInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CheckInRepository,
    private readonly input: CheckInInputService,
    private readonly engine: CheckInEngineService,
    private readonly crypto: CryptoService,
    private readonly events: DomainEvents,
  ) {}

  async create(
    userId: string,
    input: CheckInInput,
    now = new Date(),
  ): Promise<{ checkIn: Summary; card: CardDto }> {
    const snapshot = await this.input.snapshot();
    const replay = input.id ? await this.replay(userId, input.id) : null;
    if (replay) return replay;
    const lists = await this.input.validate(input);
    // Engine v2 makes the card once its rule set is published (M8, E-53).
    const v2 = await this.engine.v2();
    const [user, signals, previous] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }),
      this.engine.signals(userId, now),
      input.recheckOfId && !v2
        ? this.previousOutcome(userId, input.recheckOfId)
        : Promise.resolve(undefined),
    ]);
    const timeline = demandTimeline(input.demand, now, user.timezone);
    const v1Input = toEngineInput(input, timeline, previous, lists);
    const cipher = await this.crypto.forUser(userId);

    const outcome = await this.prisma.$transaction(async (tx) => {
      const taskId = await this.taskFor(tx, userId, input, { timeline, cipher });
      const places = input.context.customTagIds ?? [];
      if (places.length)
        await tx.customTag.updateMany({
          where: { id: { in: places }, userId, deletedAt: null },
          data: { useCount: { increment: 1 }, lastUsedAt: now },
        });
      const checkIn = await this.repo.create(
        tx,
        checkInData(input, { userId, snapshot, cipher, taskId, timeline, now }),
      );
      const run = await this.engine.run(tx, {
        v2,
        body: input,
        v1Input,
        signals,
        userId,
        checkInId: checkIn.id,
        taskId,
        taskTitle: input.demand?.title ?? null,
        now,
      });
      await tx.checkIn.update({ where: { id: checkIn.id }, data: { cellId: run.cellId } });
      return { checkInId: checkIn.id, run };
    });

    this.engine.announce(userId, outcome.run);
    this.events.emit('checkin.created', { userId, checkInId: outcome.checkInId });
    if (input.recheckOfId) {
      this.events.emit('recheck.evaluated', {
        userId,
        previousCheckInId: input.recheckOfId,
        checkInId: outcome.checkInId,
        light: outcome.run.card.light,
        rule: outcome.run.recheckRule,
      });
    }
    const row = await this.repo.summary(userId, outcome.checkInId);
    if (!row) throw new NotFound('check-in');
    return { checkIn: toSummary(row, snapshot), card: outcome.run.card };
  }

  /** The check-in's task: one the user owns, or a new one from the title they typed. */
  private async taskFor(
    tx: Tx,
    userId: string,
    input: CheckInInput,
    t: { timeline: ReturnType<typeof demandTimeline>; cipher: UserCipher },
  ): Promise<string | null> {
    const demand = input.demand;
    if (demand?.taskId) {
      const owned = await tx.task.findFirst({
        where: { id: demand.taskId, userId, deletedAt: null },
        select: { id: true },
      });
      if (!owned) throw new NotFound('task');
      return owned.id;
    }
    if (!demand?.title) return null;
    const task = await tx.task.create({
      data: taskData(userId, { ...demand, title: demand.title }, t.timeline, t.cipher),
      select: { id: true },
    });
    return task.id;
  }

  /** Offline replay: the same client id twice returns the first result (sync, SYSTEM_DESIGN §9). */
  private async replay(
    userId: string,
    id: string,
  ): Promise<{ checkIn: Summary; card: CardDto } | null> {
    const existing = await this.repo.summary(userId, id);
    if (!existing) return null;
    const card = await this.engine.latestCard(userId, existing.id);
    if (!card) return null;
    return { checkIn: toSummary(existing, await this.input.snapshot()), card };
  }

  /** What the engine needs to know about the check-in being re-checked (Tab 8 step 11). */
  async previousOutcome(userId: string, checkInId: string): Promise<PreviousOutcome> {
    const prev = await this.prisma.checkIn.findFirst({
      where: { id: checkInId, userId },
      select: {
        emotions: { select: { intensity: true } },
        recommendations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            cellId: true,
            band: true,
            light: true,
            safetyTriggered: true,
            sessions: {
              orderBy: { startedAt: 'desc' },
              take: 1,
              select: {
                toolId: true,
                pathway: true,
                completed: true,
                feedback: { select: { outcome: true } },
              },
            },
          },
        },
      },
    });
    const rec = prev?.recommendations[0];
    if (!prev || !rec) throw new NotFound('check-in to re-check');
    const session = rec.sessions[0];
    return {
      cellId: rec.cellId,
      finalBand: rec.band as Band,
      light: rec.light,
      peakIntensity: Math.max(0, ...prev.emotions.map((e) => e.intensity ?? 0)),
      supportCompleted: session?.completed ?? false,
      safetyTriggered: rec.safetyTriggered,
      ...(session ? { toolId: session.toolId, pathway: session.pathway } : {}),
      ...(session?.feedback ? { helped: session.feedback.outcome } : {}),
    };
  }

  async get(userId: string, id: string): Promise<{ checkIn: Summary; card: CardDto | null }> {
    const snapshot = await this.input.snapshot();
    const row = await this.repo.summary(userId, id);
    if (!row) throw new NotFound('check-in');
    return { checkIn: toSummary(row, snapshot), card: await this.engine.latestCard(userId, id) };
  }

  async list(
    userId: string,
    after: string | undefined,
    limit: number,
  ): Promise<{ items: Summary[]; next: string | null }> {
    const snapshot = await this.input.snapshot();
    const rows = await this.repo.page(userId, after ? decodeCursor(after) : null, limit + 1);
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items: items.map((r) => toSummary(r, snapshot)),
      next: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }
}
