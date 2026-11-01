import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { valuesOf, type EngineInput, type Trace } from '@figcit/engine-v2';
import type { Prisma } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';
import { NotFound } from '../../common/errors/errors.js';
import { DomainEvents } from '../../platform/events/domain-events.js';
import type { CheckInInput } from '../checkin/checkin.schemas.js';
import type { CardDto, whySchema } from '../recommendation/recommendation.schemas.js';
import { RulesService } from '../rules/rules.service.js';
import { CheckInOptionsService } from '../rulesets/checkin-options.service.js';
import { SafetyService, type SafetyMatch } from '../safety/safety.service.js';
import type { z } from 'zod';
import { DecisionsService, type Prepared } from './decisions.service.js';
import type { Runnable } from './engine-runtime.service.js';
import { present, type CardIds, type Presentation } from './present.js';

type Why = z.infer<typeof whySchema>;

/**
 * What a v2 recommendation row keeps in `trace` (M8, E-53): the decision it presents, the card as
 * shown and its reasons, so the card re-renders exactly and replay goes through the decision.
 */
export interface V2Trace {
  readonly engine: 'v2';
  readonly decisionId: string;
  readonly card: CardDto;
  readonly why: Why;
}

/** The input with the declined tool's pathway marked as just rejected (Tab 7 non-negotiables). */
function withRejected(
  input: EngineInput,
  engine: Runnable,
  declinedTool: string | null,
): EngineInput {
  const pathway = declinedTool
    ? valuesOf(engine.ruleset.catalogue, 'tool').find((t) => t.code === declinedTool)?.group
    : undefined;
  const before = (input['signals.rejected'] as string[] | undefined) ?? [];
  const rejected = [...new Set([...before, ...(pathway ? [pathway] : [])])];
  return rejected.length > 0 ? { ...input, 'signals.rejected': rejected } : input;
}

/** The re-check rules, most telling first: Blue (RC-1), no Blue (RC-5), unchanged (RC-4). */
const RECHECK_RULES = ['RC-1', 'RC-5', 'RC-4', 'RC-3', 'RC-2'];

/** Which re-check rule fired, as v1 reported it to the session's feedback. */
function recheckRuleOf(trace: Trace, engine: Runnable): string | null {
  const fired = new Set(trace.fired.map((id) => engine.refOf.get(id)?.split(' · ')[1]));
  return RECHECK_RULES.find((r) => fired.has(r)) ?? null;
}

export const isV2Trace = (t: unknown): t is V2Trace =>
  typeof t === 'object' && t !== null && (t as { engine?: unknown }).engine === 'v2';

/** Intensity as a word before a feeling (E-47): "overwhelmed (strong)". */
const FEELING_WORD: Readonly<Record<string, string>> = {
  mild: 'mild',
  moderate: 'moderate',
  high: 'strong',
  very_high: 'very strong',
};

export interface Made {
  readonly id: string;
  readonly card: CardDto;
  readonly cellId: string;
  readonly decisionId: string;
  /** What triggered the support screen: a phrase the screen matched, else the Hopeless chip. */
  readonly risk: SafetyMatch | null;
  /** The re-check rule (RC-1 to RC-5) that applied, for the session's recovery (Tab 10). */
  readonly recheckRule: string | null;
}

/**
 * The check-in's engine is v2 once a v2 rule set with check-in options is published (M8, E-53):
 * each card is a decision record plus the recommendation row that sessions, actions and re-checks
 * hang off, presented in the app's card contract.
 */
@Injectable()
export class CardBridgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly decisions: DecisionsService,
    private readonly options: CheckInOptionsService,
    private readonly rules: RulesService,
    private readonly safety: SafetyService,
    private readonly events: DomainEvents,
  ) {}

  async enabled(): Promise<boolean> {
    return (await this.options.current()) !== null;
  }

  /** A signed-in check-in, in the check-in's own transaction. */
  async checkIn(
    tx: Tx,
    a: {
      body: CheckInInput;
      userId: string;
      checkInId: string;
      taskId: string | null;
      taskTitle: string | null;
      now: Date;
    },
  ): Promise<Made> {
    const previous = a.body.recheckOfId
      ? await this.previousOf(a.userId, a.body.recheckOfId)
      : null;
    const recheck = previous
      ? await this.decisions.previousFacts(a.userId, previous.decisionId, previous.completed)
      : undefined;
    const prepared = await this.decisions.prepare(a.body, a.userId, a.now, recheck);
    return this.store(tx, prepared, {
      userId: a.userId,
      checkInId: a.checkInId,
      taskId: a.taskId,
      parentId: null,
      origin: a.body.origin,
      recheckOfId: previous?.decisionId ?? null,
      said: this.said(a.body, prepared),
      taskTitle: a.taskTitle,
      now: a.now,
    });
  }

  /** Browse: the decision is recorded without an account; no recommendation row (E-05, E-46). */
  async browse(body: CheckInInput, now: Date): Promise<{ card: CardDto; cellId: string }> {
    const prepared = await this.decisions.prepare(body, undefined, now);
    const { record, card, trace } = await this.decisions.record(this.prisma, prepared, {
      userId: undefined,
      recheckOfId: null,
      now,
    });
    const ids: CardIds = {
      id: record.id,
      checkInId: body.id ?? randomUUID(),
      createdAt: now,
      taskId: null,
      origin: body.origin,
    };
    const shown = present(
      card,
      await this.presentation(prepared.engine, prepared.input, trace, {
        said: this.said(body, prepared),
        taskTitle: body.demand?.title ?? null,
      }),
      ids,
    );
    return { card: shown.card, cellId: shown.card.state.cellId };
  }

  /**
   * "Try another" or Adapt on a Browse card (E-53): the Browse decision again, with the declined
   * pathway just rejected, recorded without an account. Browse cards are decisions, not rows.
   */
  async browseAnother(decisionId: string, declinedTool: string | null): Promise<CardDto> {
    const decision = await this.prisma.decisionRecord.findFirst({
      where: { id: decisionId, mode: 'browse' },
    });
    if (!decision) throw new NotFound('card');
    const engine = await this.decisions.engineFor(decision.versionId);
    const input = withRejected(decision.input as EngineInput, engine, declinedTool);
    const now = new Date();
    const { record, card, trace } = await this.decisions.record(
      this.prisma,
      { engine, input },
      { userId: undefined, recheckOfId: null, now },
    );
    const ids: CardIds = {
      id: record.id,
      checkInId: record.id,
      createdAt: now,
      taskId: null,
      origin: 'online',
    };
    const shown = await this.presentation(engine, input, trace, { said: [], taskTitle: null });
    return present(card, shown, ids).card;
  }

  /**
   * "Try another" or Adapt on a v2 card: the same input again, with the declined pathway marked as
   * just rejected (Tab 7: not repeated at once). Adaptations have no v2 fact yet (T-26).
   */
  async rerun(
    userId: string,
    recommendationId: string,
    declinedTool: string | null,
  ): Promise<CardDto> {
    const rec = await this.prisma.recommendation.findFirst({
      where: { id: recommendationId, userId },
    });
    if (!rec || !isV2Trace(rec.trace)) throw new NotFound('recommendation');
    const decision = await this.prisma.decisionRecord.findUniqueOrThrow({
      where: { id: rec.trace.decisionId },
    });
    const engine = await this.decisions.engineFor(decision.versionId);
    const prepared = {
      engine,
      risk: null,
      input: withRejected(decision.input as EngineInput, engine, declinedTool),
    };
    const made = await this.prisma.$transaction((tx) =>
      this.store(tx, prepared, {
        userId,
        checkInId: rec.checkInId,
        taskId: rec.taskId,
        parentId: rec.id,
        origin: rec.origin,
        recheckOfId: decision.recheckOfId,
        said: [],
        taskTitle: null,
        now: new Date(),
      }),
    );
    this.announce(userId, made);
    return made.card;
  }

  /** Domain events and the safety log, after the transaction that stored the card. */
  announce(userId: string, made: Pick<Made, 'id' | 'card' | 'risk'>): void {
    this.events.emit('recommendation.created', {
      userId,
      recommendationId: made.id,
      light: made.card.light,
    });
    if (!made.card.safetyTriggered) return;
    void this.safety.record({
      userId,
      sourceModule: 'checkin',
      trigger: made.risk ? 'phrase' : 'option',
      ruleId: made.risk?.ruleId ?? 'SF-1',
      category: made.risk?.category ?? null,
    });
  }

  private async store(
    tx: Tx,
    p: Pick<Prepared, 'engine' | 'input' | 'risk'>,
    m: {
      userId: string;
      checkInId: string;
      taskId: string | null;
      parentId: string | null;
      origin: 'online' | 'offline';
      recheckOfId: string | null;
      said: readonly string[];
      taskTitle: string | null;
      now: Date;
    },
  ): Promise<Made> {
    const { record, card, trace } = await this.decisions.record(tx, p, {
      userId: m.userId,
      recheckOfId: m.recheckOfId,
      now: m.now,
    });
    const id = randomUUID();
    const ids: CardIds = {
      id,
      checkInId: m.checkInId,
      createdAt: m.now,
      taskId: m.taskId,
      origin: m.origin,
    };
    const shown = present(card, await this.presentation(p.engine, p.input, trace, m), ids);
    const stored: V2Trace = {
      engine: 'v2',
      decisionId: record.id,
      card: shown.card,
      why: shown.why,
    };
    await tx.recommendation.create({
      data: {
        id,
        userId: m.userId,
        checkInId: m.checkInId,
        taskId: m.taskId,
        parentId: m.parentId,
        band: card.band ?? 'conditional',
        light: shown.card.light,
        cellId: shown.card.state.cellId,
        primary: shown.card.primary,
        alternatives: shown.card.alternatives,
        ...(shown.card.queuedStep ? { queuedStep: shown.card.queuedStep } : {}),
        patterns: shown.card.patterns.map(String),
        gates: [],
        rationaleTemplateId: null,
        safetyTriggered: shown.card.safetyTriggered,
        trace: stored as unknown as Prisma.InputJsonValue,
        engineVersion: record.engineVersion,
        snapshotVersion: p.engine.label,
        origin: m.origin,
        createdAt: m.now,
      },
    });
    return {
      id,
      card: shown.card,
      cellId: shown.card.state.cellId,
      decisionId: record.id,
      risk: p.risk,
      recheckRule: recheckRuleOf(trace, p.engine),
    };
  }

  /** Crisis routes for the user's region; the UK for Browse (crisis routes are GB, E-46). */
  private async routesFor(userId: string | undefined): Promise<CardDto['crisisRoutes']> {
    const user = userId
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { region: true } })
      : null;
    return [...(await this.safety.routes(user?.region ?? 'GB'))];
  }

  /** The earlier check-in's v2 decision, and whether the support it offered was finished. */
  private async previousOf(
    userId: string,
    checkInId: string,
  ): Promise<{ decisionId: string; completed: boolean } | null> {
    const rec = await this.prisma.recommendation.findFirst({
      where: { userId, checkInId },
      orderBy: { createdAt: 'desc' },
      select: {
        trace: true,
        sessions: { orderBy: { startedAt: 'desc' }, take: 1, select: { completed: true } },
      },
    });
    if (!rec || !isV2Trace(rec.trace)) return null;
    return { decisionId: rec.trace.decisionId, completed: rec.sessions[0]?.completed ?? false };
  }

  /** The feelings the user picked, in their own chip words with a strength word (E-47). */
  private said(body: CheckInInput, p: Prepared): string[] {
    const labels = new Map(p.offered.options.feeling.map((o) => [o.code, o.label]));
    const bands = valuesOf(p.engine.ruleset.catalogue, 'intensity_band');
    return body.emotions.flatMap((e) => {
      const label = labels.get(e.code);
      if (!label) return [];
      const band =
        e.intensity === null
          ? undefined
          : bands.find(
              (b) =>
                e.intensity !== null && e.intensity >= (b.from ?? 0) && e.intensity <= (b.to ?? 10),
            );
      const word = band ? FEELING_WORD[band.code] : undefined;
      return [`${label.toLowerCase()}${word ? ` (${word})` : ''}`];
    });
  }

  private async presentation(
    engine: Runnable,
    input: EngineInput,
    trace: Trace,
    m: { said: readonly string[]; taskTitle: string | null; userId?: string },
  ): Promise<Presentation> {
    const { snapshot } = await this.rules.current();
    const e = input['state.energy'];
    const mo = input['state.mood'];
    const cell =
      typeof e === 'number' && typeof mo === 'number'
        ? snapshot.cells.find((c) => c.id === `E${String(e)}M${String(mo)}`)
        : undefined;
    const copy = engine.copy;
    const state: CardDto['state'] = cell
      ? {
          cellId: cell.id,
          name: cell.name,
          icon: cell.icon,
          meaning: cell.meaning,
          confirmed: true,
        }
      : {
          cellId: 'NS-1',
          name: copy.get('state.not_sure.name') ?? '',
          icon: copy.get('state.not_sure.icon') ?? '',
          meaning: copy.get('state.not_sure.meaning') ?? '',
          confirmed: false,
        };
    const patterns = [
      ...new Set(
        trace.fired.flatMap((id) => {
          const n = engine.patternOf.get(id);
          return n === undefined ? [] : [n];
        }),
      ),
    ].sort((a, b) => a - b);
    return {
      copy,
      lights: snapshot.lights,
      state,
      routes: await this.routesFor(m.userId),
      said: m.said,
      taskTitle: m.taskTitle,
      version: engine.label,
      patterns,
      timeline: typeof input['demand.timeline'] === 'string' ? input['demand.timeline'] : null,
      rejected: (input['signals.rejected'] as string[] | undefined) ?? [],
    };
  }
}
