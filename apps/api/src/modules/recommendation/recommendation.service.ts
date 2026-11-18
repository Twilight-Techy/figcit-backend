import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  evaluate,
  type EngineInput,
  type EngineResult,
  type Light,
  type UserSignals,
} from '@figcit/engine';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';
import { NotFound } from '../../common/errors/errors.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import { RulesService } from '../rules/rules.service.js';
import { SafetyService } from '../safety/safety.service.js';
import { isV2Trace } from '../decisions/card-bridge.service.js';
import { toCard } from './card.js';
import type { CardDto } from './recommendation.schemas.js';
import { SignalsService } from './signals.service.js';

const STATE_FRESH_MS = 6 * 3_600_000;
const LIGHTS: readonly string[] = ['green', 'yellow', 'amber', 'red', 'blue'];
const isLight = (v: string | null): v is Light => v !== null && LIGHTS.includes(v);

/** What is stored in `recommendations.trace` so a card can be re-rendered and the decision replayed. */
interface StoredTrace {
  readonly input: EngineInput; // codes only: free text and the task title are never stored
  readonly result: Omit<EngineResult, 'trace'>;
  readonly steps: EngineResult['trace'];
}

export interface RunOptions {
  readonly userId: string;
  readonly checkInId: string;
  readonly taskId: string | null;
  readonly origin?: 'online' | 'offline';
  readonly parentId?: string | null;
  readonly signals?: UserSignals;
  /** Tools to avoid in this run on top of the user's recent rejections (try another). */
  readonly avoidTools?: readonly string[];
}

export interface RunOutcome {
  readonly id: string;
  readonly result: EngineResult;
  readonly card: CardDto;
}

/** Strips anything the user typed before the input is persisted. */
export function storableInput(input: EngineInput): EngineInput {
  const { freeText: _freeText, demand, ...rest } = input;
  if (!demand) return rest;
  const { title: _title, ...codes } = demand;
  return { ...rest, demand: codes };
}

@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rules: RulesService,
    private readonly signals: SignalsService,
    private readonly safety: SafetyService,
    private readonly events: DomainEvents,
  ) {}

  /** Runs the engine and stores the decision. Pass `tx` to store it in the caller's transaction. */
  async run(input: EngineInput, opts: RunOptions, tx?: Tx): Promise<RunOutcome> {
    const { snapshot } = await this.rules.current();
    const base = opts.signals ?? (await this.signals.load(opts.userId));
    const signals: UserSignals = opts.avoidTools?.length
      ? {
          ...base,
          rejectedToolIds: [...new Set([...(base.rejectedToolIds ?? []), ...opts.avoidTools])],
        }
      : base;
    const result = evaluate(input, snapshot, signals);
    const { trace: steps, ...rest } = result;
    const stored: StoredTrace = { input: storableInput(input), result: rest, steps };
    const db = tx ?? this.prisma;
    const row = await db.recommendation.create({
      data: {
        userId: opts.userId,
        checkInId: opts.checkInId,
        taskId: opts.taskId,
        parentId: opts.parentId ?? null,
        band: result.band.final,
        light: result.light,
        cellId: result.state.cellId,
        primary: result.primary as unknown as Prisma.InputJsonValue,
        alternatives: result.alternatives as unknown as Prisma.InputJsonValue,
        ...(result.queuedStep
          ? { queuedStep: result.queuedStep as unknown as Prisma.InputJsonValue }
          : {}),
        patterns: result.patterns.map(String),
        gates: result.gates.filter((g) => g.effect !== 'allowed').map((g) => g.rule),
        rationaleTemplateId: result.rationale.templateId,
        safetyTriggered: result.safety.triggered,
        trace: stored as unknown as Prisma.InputJsonValue,
        engineVersion: result.engineVersion,
        snapshotVersion: result.snapshotVersion,
        origin: opts.origin ?? 'online',
      },
      select: { id: true, createdAt: true },
    });
    const routes = await this.safety.routes(signals.region ?? 'GB');
    const card = toCard(result, snapshot, {
      id: row.id,
      checkInId: opts.checkInId,
      createdAt: row.createdAt,
      taskId: opts.taskId,
      origin: opts.origin ?? 'online',
      routes,
    });
    if (!tx) this.announce(opts.userId, row.id, result);
    return { id: row.id, result, card };
  }

  /**
   * Browse mode (DECISION_LOG E-46): runs the engine and builds the card without storing anything.
   * The card lives on the device; E-05's server-side Browse record arrives with the v2 decision
   * records (M5).
   */
  async preview(input: EngineInput, checkInId: string, signals: UserSignals): Promise<RunOutcome> {
    const { snapshot } = await this.rules.current();
    const result = evaluate(input, snapshot, signals);
    const routes = await this.safety.routes(signals.region ?? 'GB');
    const id = randomUUID();
    const card = toCard(result, snapshot, {
      id,
      checkInId,
      createdAt: new Date(),
      taskId: null,
      origin: 'online',
      routes,
    });
    return { id, result, card };
  }

  /**
   * The user's state from their latest card in the last few hours (Yellow when unknown), with the
   * check-in's peak negative intensity and families. Used by task order, the Reflect gate and the
   * nudge policy. A v5.0 check-in is a decision record, not a recommendation: the newest of the two
   * counts, so a Red or Amber v5.0 colour holds Reflect and nudges and orders tasks like the old one.
   */
  async currentState(
    userId: string,
    now = new Date(),
  ): Promise<{
    light: Light;
    known: boolean;
    peakNegative: number;
    families: string[];
    setting: string | null;
  }> {
    const since = new Date(now.getTime() - STATE_FRESH_MS);
    const [rec, v5] = await Promise.all([
      this.prisma.recommendation.findFirst({
        where: { userId, createdAt: { gt: since } },
        orderBy: { createdAt: 'desc' },
        select: {
          createdAt: true,
          light: true,
          checkIn: {
            select: {
              emotions: { select: { familyCode: true, intensity: true } },
              context: { select: { environment: true } },
            },
          },
        },
      }),
      this.latestV5Light(userId, since),
    ]);
    if (v5 && (!rec || v5.at > rec.createdAt))
      return { light: v5.light, known: true, peakNegative: 0, families: [], setting: null };
    if (!rec)
      return { light: 'yellow', known: false, peakNegative: 0, families: [], setting: null };
    const { snapshot } = await this.rules.current();
    const negative = new Set(
      snapshot.families.filter((f) => f.valence === 'negative').map((f) => f.code),
    );
    const emotions = rec.checkIn.emotions;
    return {
      light: rec.light,
      known: true,
      peakNegative: Math.max(
        0,
        // An unrated harder feeling counts as High (DECISION_LOG E-42).
        ...emotions.filter((e) => negative.has(e.familyCode)).map((e) => e.intensity ?? 7),
      ),
      families: [...new Set(emotions.map((e) => e.familyCode))],
      setting: rec.checkIn.context?.environment ?? null,
    };
  }

  /** The colour of the account's latest v5.0 decision since `since` (a record with `checkin.mode`). */
  private async latestV5Light(
    userId: string,
    since: Date,
  ): Promise<{ light: Light; at: Date } | null> {
    const rows = await this.prisma.decisionRecord.findMany({
      where: { userId, createdAt: { gt: since }, light: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { light: true, createdAt: true, input: true },
      take: 10,
    });
    const found = rows.find(
      (r) => typeof (r.input as Record<string, unknown>)['checkin.mode'] === 'string',
    );
    return found && isLight(found.light) ? { light: found.light, at: found.createdAt } : null;
  }

  signalsFor(userId: string, now = new Date()): Promise<UserSignals> {
    return this.signals.load(userId, now);
  }

  /** Domain events and safety logging, after the transaction that stored the decision. */
  announce(userId: string, id: string, result: EngineResult): void {
    this.events.emit('recommendation.created', {
      userId,
      recommendationId: id,
      light: result.light,
    });
    if (result.safety.triggered) {
      void this.safety.record({
        userId,
        sourceModule: 'checkin',
        trigger: result.safety.source === 'option' ? 'option' : 'phrase',
        ruleId: result.safety.ruleId ?? null,
        category: result.safety.category ?? null,
      });
    }
  }

  async stored(
    userId: string,
    id: string,
  ): Promise<{
    id: string;
    checkInId: string;
    taskId: string | null;
    createdAt: Date;
    origin: 'online' | 'offline';
    trace: StoredTrace;
  }> {
    const row = await this.prisma.recommendation.findFirst({
      where: { id, userId },
      select: {
        id: true,
        checkInId: true,
        taskId: true,
        createdAt: true,
        origin: true,
        trace: true,
      },
    });
    if (!row) throw new NotFound('recommendation');
    return { ...row, trace: row.trace as unknown as StoredTrace };
  }

  async card(userId: string, id: string): Promise<CardDto> {
    const row = await this.stored(userId, id);
    // A v2 card is kept as shown (M8, E-53): it re-renders exactly, without running anything.
    if (isV2Trace(row.trace)) return row.trace.card;
    const snapshot = await this.rules.byVersionOrCurrent(row.trace.result.snapshotVersion);
    const region =
      (await this.prisma.user.findUnique({ where: { id: userId }, select: { region: true } }))
        ?.region ?? 'GB';
    const result = { ...row.trace.result, trace: row.trace.steps } as EngineResult;
    return toCard(result, snapshot, {
      id: row.id,
      checkInId: row.checkInId,
      createdAt: row.createdAt,
      taskId: row.taskId,
      origin: row.origin,
      routes: await this.safety.routes(region),
    });
  }

  /** The latest card for a check-in (offline replay and the Home "last card"). */
  async latestFor(userId: string, checkInId: string): Promise<CardDto | null> {
    const row = await this.prisma.recommendation.findFirst({
      where: { userId, checkInId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return row ? this.card(userId, row.id) : null;
  }
}
