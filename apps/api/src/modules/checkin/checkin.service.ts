import { Injectable } from '@nestjs/common';
import type { Band, PreviousOutcome } from '@figcit/engine';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotFound } from '../../common/errors/errors.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import type { CardDto } from '../recommendation/recommendation.schemas.js';
import { RecommendationService } from '../recommendation/recommendation.service.js';
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
import { CheckInInputService } from './checkin-input.service.js';
import { CheckInRepository } from './checkin.repository.js';
import type { CheckInInput } from './checkin.schemas.js';

@Injectable()
export class CheckInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CheckInRepository,
    private readonly input: CheckInInputService,
    private readonly recs: RecommendationService,
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
    const [user, signals, previous] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }),
      this.recs.signalsFor(userId, now),
      input.recheckOfId
        ? this.previousOutcome(userId, input.recheckOfId)
        : Promise.resolve(undefined),
    ]);
    const timeline = demandTimeline(input.demand, now, user.timezone);
    const engineInput = toEngineInput(input, timeline, previous, lists);
    const cipher = await this.crypto.forUser(userId);
    const demand = input.demand;

    const outcome = await this.prisma.$transaction(async (tx) => {
      let taskId: string | null = null;
      if (demand?.taskId) {
        const owned = await tx.task.findFirst({
          where: { id: demand.taskId, userId, deletedAt: null },
          select: { id: true },
        });
        if (!owned) throw new NotFound('task');
        taskId = owned.id;
      } else if (demand?.title) {
        taskId = (
          await tx.task.create({
            data: taskData(userId, { ...demand, title: demand.title }, timeline, cipher),
            select: { id: true },
          })
        ).id;
      }
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
      const run = await this.recs.run(
        engineInput,
        { userId, checkInId: checkIn.id, taskId, origin: input.origin, signals },
        tx,
      );
      await tx.checkIn.update({
        where: { id: checkIn.id },
        data: { cellId: run.result.state.cellId },
      });
      return { checkInId: checkIn.id, run };
    });

    this.recs.announce(userId, outcome.run.id, outcome.run.result);
    this.events.emit('checkin.created', { userId, checkInId: outcome.checkInId });
    if (input.recheckOfId) {
      this.events.emit('recheck.evaluated', {
        userId,
        previousCheckInId: input.recheckOfId,
        checkInId: outcome.checkInId,
        light: outcome.run.result.light,
        rule: outcome.run.result.recheck?.rule ?? null,
      });
    }
    const row = await this.repo.summary(userId, outcome.checkInId);
    if (!row) throw new NotFound('check-in');
    return { checkIn: toSummary(row, snapshot), card: outcome.run.card };
  }

  /** Offline replay: the same client id twice returns the first result (sync, SYSTEM_DESIGN §9). */
  private async replay(
    userId: string,
    id: string,
  ): Promise<{ checkIn: Summary; card: CardDto } | null> {
    const existing = await this.repo.summary(userId, id);
    if (!existing) return null;
    const card = await this.recs.latestFor(userId, existing.id);
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
    return { checkIn: toSummary(row, snapshot), card: await this.recs.latestFor(userId, id) };
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
