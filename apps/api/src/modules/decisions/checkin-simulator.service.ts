import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  canonicalJson,
  explainCheckIn,
  factsFromCheckIn,
  run,
  type EngineInput,
  type JsonValue,
} from '@figcit/engine-v2';
import { NotConfigured } from '../../common/errors/errors.js';
import { demandTimeline, validateOptions } from '../checkin/checkin.mapper.js';
import type { CheckInInput } from '../checkin/checkin.schemas.js';
import { CheckInOptionsService, type CheckInOptions } from '../rulesets/checkin-options.service.js';
import { SafetyService } from '../safety/safety.service.js';
import { CardBridgeService, saidOf, withRejected } from './card-bridge.service.js';
import { lastFact, recheckFacts, signalFacts } from './decision-facts.js';
import type { DecisionDto } from './decisions.schemas.js';
import { BROWSE_ZONE, screenedTexts } from './decisions.service.js';
import { EngineRuntimeService, type Runnable } from './engine-runtime.service.js';
import { present } from './present.js';
import type {
  SimulateCheckInBody,
  SimulateCheckInResult,
  UNUSED_WHY,
  SERVER_SOURCES,
} from './simulator.schemas.js';

type Unused = SimulateCheckInResult['unused'][number];
type ServerFact = {
  fact: string;
  value: unknown;
  source: (typeof SERVER_SOURCES)[number];
};
type Why = (typeof UNUSED_WHY)[number];

const same = (a: unknown, b: unknown): boolean =>
  canonicalJson(a as JsonValue) === canonicalJson(b as JsonValue);

const one = (v: string | number | undefined): string[] => (v === undefined ? [] : [String(v)]);

/**
 * Answers of the check-in the engine has no fact for at all, and why (INPUT_GAPS.md). Free text
 * only reaches the risk check (E-04), so it is listed without its words; drivers order the task
 * list, not the card.
 */
const UNREAD: readonly {
  readonly input: string;
  readonly why: Why;
  readonly gap?: string;
  /** Free text: listed when given, never shown. */
  readonly text?: true;
  readonly pick: (c: CheckInInput) => readonly string[];
}[] = [
  {
    input: 'state.answers',
    why: 'suggestion_only',
    gap: 'IG-02',
    pick: (c) => (c.state.kind === 'not_sure' ? (c.state.answers ?? []) : []),
  },
  {
    input: 'sensations.bodyRegions',
    why: 'no_fact',
    gap: 'IG-06',
    pick: (c) => c.sensations.flatMap((s) => s.bodyRegions ?? []),
  },
  { input: 'ownFeeling', why: 'risk_check', text: true, pick: (c) => one(c.ownFeeling) },
  {
    input: 'context.environmentOther',
    why: 'risk_check',
    text: true,
    pick: (c) => one(c.context.environmentOther),
  },
  { input: 'context.customTagIds', why: 'no_fact', pick: (c) => c.context.customTagIds ?? [] },
  { input: 'context.social', why: 'no_fact', gap: 'IG-08', pick: (c) => one(c.context.social) },
  { input: 'context.time', why: 'no_fact', gap: 'IG-09', pick: (c) => one(c.context.time) },
  { input: 'ownWords', why: 'risk_check', text: true, pick: (c) => one(c.ownWords) },
  { input: 'demand.title', why: 'risk_check', text: true, pick: (c) => one(c.demand?.title) },
  { input: 'demand.kind', why: 'no_fact', gap: 'IG-14', pick: (c) => one(c.demand?.kind) },
  { input: 'demand.count', why: 'no_fact', gap: 'IG-15', pick: (c) => one(c.demand?.count) },
  {
    input: 'demand.confirmedDrivers',
    why: 'task_order',
    pick: (c) => c.demand?.confirmedDrivers ?? [],
  },
  {
    input: 'demand.recurrenceRule',
    why: 'no_fact',
    text: true,
    pick: (c) => one(c.demand?.recurrenceRule),
  },
  { input: 'intent', why: 'no_fact', pick: (c) => one(c.intent) },
  { input: 'entry', why: 'no_fact', gap: 'IG-19', pick: (c) => [c.entry] },
];

function unreadOf(c: CheckInInput): Unused[] {
  return UNREAD.flatMap((u) =>
    u.pick(c).map((code) => ({
      from: { input: u.input, ...(u.text ? {} : { code }) },
      why: u.why,
      ...(u.gap ? { gap: u.gap } : {}),
    })),
  );
}

/**
 * The staff check-in Simulator (E-61): the same steps as a real check-in (the options check, the
 * risk check, `factsFromCheckIn`, the engine, the card as the app gets it) on any version, drafts
 * included, with each step's result. Nothing is stored and no safety event is made: the risk
 * check has no side effects, the safety log is written only when a real card is stored.
 */
@Injectable()
export class CheckInSimulatorService {
  constructor(
    private readonly runtime: EngineRuntimeService,
    private readonly options: CheckInOptionsService,
    private readonly safety: SafetyService,
    private readonly bridge: CardBridgeService,
  ) {}

  /** A version's check-in options (the Simulator's sections offer exactly these). */
  async optionsOf(label: string): Promise<CheckInOptions> {
    const engine = await this.runtime.byLabel(label);
    const offered = await this.options.ofVersion(engine.id);
    if (!offered) throw new NotConfigured(`${label} has no check-in options.`);
    return offered;
  }

  async simulate(
    label: string,
    body: SimulateCheckInBody,
    now = new Date(),
  ): Promise<SimulateCheckInResult> {
    const engine = await this.runtime.byLabel(label);
    const offered = await this.optionsOf(label);
    const c = body.checkIn;
    validateOptions(c, offered);
    const timeline = demandTimeline(c.demand, body.now ? new Date(body.now) : now, BROWSE_ZONE);
    const risk = await this.riskOf(c);
    const server = [
      ...this.accountFacts(body, engine),
      ...this.recheckOf(body, engine),
      { fact: 'safety.risk', value: risk.category !== null, source: 'risk_check' as const },
    ];
    const facts = Object.fromEntries(server.map((s) => [s.fact, s.value])) as EngineInput;
    // The same call a real check-in makes (DecisionsService.prepare), then "Try another" as the
    // app's rerun applies it (CardBridgeService.rerun).
    const built = body.declined.reduce(
      (input, tool) => withRejected(input, engine, tool),
      factsFromCheckIn(c, offered.options, engine.ruleset.catalogue, { timeline, facts }),
    );
    const explained = explainCheckIn(c, offered.options, engine.ruleset.catalogue, timeline);
    const rejected = built['signals.rejected'];
    const input = body.facts ?? built;
    return {
      version: { label: engine.label, status: engine.status },
      checkIn: c as unknown as Record<string, unknown>,
      contributions: [...explained.contributions],
      unused: [...explained.unmapped, ...unreadOf(c)],
      server: [
        ...server,
        ...(body.declined.length > 0 && rejected
          ? [{ fact: 'signals.rejected', value: rejected, source: 'try_another' as const }]
          : []),
      ],
      timeline: timeline
        ? { code: timeline, from: c.demand?.timeline ? 'picked' : 'due_date' }
        : null,
      risk,
      input: input,
      handEdited: body.facts !== undefined && !same(body.facts, built),
      outcome: await this.outcome(engine, offered, input, body),
    };
  }

  /** Each free text through the risk check on its own, so staff see which one matched. */
  private async riskOf(c: CheckInInput): Promise<SimulateCheckInResult['risk']> {
    const texts = screenedTexts(c).filter((t) => t.text);
    const matches = await Promise.all(texts.map((t) => this.safety.check([t.text])));
    return {
      checked: texts.map((t, i) => ({ input: t.input, matched: matches[i] !== null })),
      category: matches.find((m) => m !== null)?.category ?? null,
    };
  }

  /**
   * The account's facts as the server sends them: Browse gets only the free plan; a signed-in
   * user gets a new user's signals (`signalFacts` of an empty history), changed where asked.
   */
  private accountFacts(body: SimulateCheckInBody, engine: Runnable): ServerFact[] {
    if (body.account === 'browse')
      return [{ fact: 'signals.plan', value: 'free', source: 'account' }];
    const fresh: EngineInput = {
      ...signalFacts({ plan: 'free' }, engine.ruleset.catalogue),
      'signals.days_very_constrained': 0,
    };
    const changed = body.signals as Record<string, unknown>;
    return Object.entries({ ...fresh, 'signals.plan': body.account }).map(([fact, value]) =>
      fact === 'signals.plan'
        ? { fact, value, source: 'account' }
        : fact in changed
          ? { fact, value: changed[fact], source: 'advanced' }
          : { fact, value, source: 'new_user' },
    );
  }

  /** A re-check: the earlier run's facts, worked out as the server does from a stored decision. */
  private recheckOf(body: SimulateCheckInBody, engine: Runnable): ServerFact[] {
    if (!body.recheckOf) return [];
    const earlier = run(engine.ruleset, body.recheckOf.input, { trace: 'full' });
    if (!earlier.ok) return [];
    const facts = {
      ...recheckFacts({
        band: earlier.card.band,
        light: earlier.card.light,
        card: earlier.card,
        peak: lastFact(earlier.trace, 'peak.negative') as number | null | undefined,
        baseline: lastFact(earlier.trace, 'band.baseline') as string | undefined,
      }),
      ...(body.recheckOf.supportCompleted === undefined
        ? {}
        : { 'recheck.support_completed': body.recheckOf.supportCompleted }),
    };
    return Object.entries(facts).map(([fact, value]) => ({ fact, value, source: 'recheck' }));
  }

  /** The engine on the input, and the card as the app would receive it. */
  private async outcome(
    engine: Runnable,
    offered: CheckInOptions,
    input: EngineInput,
    body: SimulateCheckInBody,
  ): Promise<SimulateCheckInResult['outcome']> {
    const result = run(engine.ruleset, input, { trace: 'full' });
    if (!result.ok) return { ok: false, issues: [...result.issues] };
    // A rerun ("Try another") is presented as the app's rerun presents it: without the words.
    const rerun = body.declined.length > 0;
    const presentation = await this.bridge.presentation(engine, input, result.trace, {
      said: rerun ? [] : saidOf(body.checkIn, { offered, engine }),
      taskTitle: rerun ? null : (body.checkIn.demand?.title ?? null),
    });
    const ids = {
      id: randomUUID(),
      checkInId: body.checkIn.id ?? randomUUID(),
      createdAt: new Date(),
      taskId: null,
      origin: body.checkIn.origin,
    };
    return {
      ok: true,
      card: result.card as unknown as DecisionDto['card'],
      trace: result.trace,
      shown: present(result.card, presentation, ids).card,
    };
  }
}
