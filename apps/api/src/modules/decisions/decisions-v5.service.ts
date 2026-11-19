import { Injectable } from '@nestjs/common';
import {
  factsFromCheckInV5,
  INPUT_SEED,
  run,
  type Card,
  type CheckInV5,
  type DroppedAnswer,
  type EngineInput,
} from '@figcit/engine-v2';
import { AppError, BadInput, NotConfigured } from '../../common/errors/errors.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { CheckInOptionsService, type CheckInOptions } from '../rulesets/checkin-options.service.js';
import { SafetyService, type SafetyMatch } from '../safety/safety.service.js';
import { ProfileService } from '../users/profile.service.js';
import { DecisionsService, type NotSureTaps } from './decisions.service.js';
import { EngineRuntimeService, type Runnable } from './engine-runtime.service.js';
import { menuOf, presentV5, previewV5, type PresentV5Sources } from './present-v5.js';
import type { CheckInV5Body, DecisionV5Dto, PreviewV5Dto } from './v5.schemas.js';

/** A v5.0 check-in as the published engine's input, with what the card's words need. */
interface PreparedV5 {
  readonly engine: Runnable;
  readonly input: EngineInput;
  readonly dropped: readonly DroppedAnswer[];
  readonly sources: PresentV5Sources;
  readonly offered: CheckInOptions;
  /** The free-text safety screen's match, if any (SF-1). */
  readonly risk: SafetyMatch | null;
}

const USUAL = 'usual';

/**
 * Rules Engine v5.0 decisions (docs/engine-v2/V5.md): the app's v5.0 check-in through the
 * published version's options, with the plan (Tab 9), Life right now (ME-4) and the safety check
 * on its free text (SF-1, SE-1). Both need an account (SU-1). The preview runs it as the person goes and stores nothing; the
 * decision is recorded as every engine v2 decision is, so it replays the same.
 */
/** The body map's regions (S09): seeded codes, the same lists the check-in screens show. */
const REGIONS = new Set(
  (INPUT_SEED.find((s) => s.input === 'body_region')?.rows ?? []).map(([code]) => code),
);

/**
 * The body map's answers worth keeping: a Full check-in's (CTX-U), for a body sign it picked, in
 * regions the map has. Nothing here reaches the engine (IG-06).
 */
export function bodyRegionsOf(body: CheckInV5Body): { sign: string; regions: string[] }[] {
  if (body.mode !== 'full') return [];
  const signs = new Set(body.body ?? []);
  return (body.bodyRegions ?? []).flatMap((b) => {
    const regions = [...new Set(b.regions.filter((r) => REGIONS.has(r)))];
    return signs.has(b.sign) && regions.length > 0 ? [{ sign: b.sign, regions }] : [];
  });
}

/**
 * Not sure's taps worth keeping: each one a picture the published version offers. A tap it doesn't
 * offer drops the lot, rather than keeping a half answer. Nothing here reaches the engine.
 */
export function notSureOf(body: CheckInV5Body, offered: CheckInOptions): NotSureTaps | null {
  const taps = body.notSure;
  if (!taps) return null;
  const has = (list: readonly { code: string }[], c: string): boolean =>
    list.some((o) => o.code === c);
  const o = offered.options;
  return has(o.not_sure_body, taps.body) &&
    has(o.not_sure_energy, taps.energy) &&
    has(o.not_sure_comfort, taps.comfort)
    ? { body: taps.body, energy: taps.energy, comfort: taps.comfort }
    : null;
}

@Injectable()
export class DecisionsV5Service {
  constructor(
    private readonly runtime: EngineRuntimeService,
    private readonly options: CheckInOptionsService,
    private readonly decisions: DecisionsService,
    private readonly entitlements: EntitlementsService,
    private readonly profile: ProfileService,
    private readonly safety: SafetyService,
  ) {}

  async preview(body: CheckInV5Body, userId: string): Promise<PreviewV5Dto> {
    const p = await this.prepare(body, userId, new Date());
    const card = this.cardOf(p);
    return previewV5(card, p.sources, p.dropped);
  }

  async decide(body: CheckInV5Body, userId: string, now = new Date()): Promise<DecisionV5Dto> {
    const recheck = body.recheckOfId
      ? await this.decisions.previousFacts(
          userId,
          body.recheckOfId,
          // RC-1: Blue needs the support finished, as the v3.3 bridge reads it from the session.
          await this.decisions.supportCompletedSince(userId, body.recheckOfId, now),
        )
      : undefined;
    const p = await this.prepare(body, userId, now, recheck);
    const { record, card } = await this.decisions.store(p, {
      userId,
      recheckOfId: recheck ? (body.recheckOfId ?? null) : null,
      now,
      bodyRegions: bodyRegionsOf(body),
      notSure: notSureOf(body, p.offered),
    });
    this.logSafety(userId, card, p.risk);
    return {
      id: record.id,
      createdAt: record.createdAt.toISOString(),
      ruleset: { label: p.engine.label, hash: record.rulesetHash },
      engineVersion: record.engineVersion,
      card: presentV5(card, p.sources),
      menu: menuOf(card, p.sources.catalogue),
      dropped: [...p.dropped],
    };
  }

  /**
   * The safety log (SE-1), as the v3.3 check-in keeps it: a Help/SOS or urgent screen is a
   * safety event. Risk words are a phrase match; otherwise an answer picked it (SF-4's urgent sign,
   * or the engine's own safety rules). The row also feeds `signals.safety_event_recently`.
   */
  private logSafety(userId: string, card: Card, risk: SafetyMatch | null): void {
    if (card.kind === 'card') return;
    void this.safety.record({
      userId,
      sourceModule: 'checkin',
      trigger: risk ? 'phrase' : 'option',
      ruleId: risk?.ruleId ?? (card.kind === 'urgent_screen' ? 'SF-4' : 'SF-1'),
      category: risk?.category ?? null,
    });
  }

  private cardOf(p: PreparedV5): Card {
    const result = run(p.engine.ruleset, p.input, { trace: 'light' });
    if (!result.ok)
      throw new AppError(500, 'engine_input_refused', 'The check-in could not be run', {
        extra: { issues: result.issues },
      });
    return result.card;
  }

  private async prepare(
    body: CheckInV5Body,
    userId: string,
    now: Date,
    recheck?: EngineInput,
  ): Promise<PreparedV5> {
    const [offered, engine] = await Promise.all([this.options.current(), this.runtime.current()]);
    if (!offered) throw new NotConfigured('No engine v2 rule set is published yet.');
    if (!isV5(offered))
      throw new AppError(409, 'ruleset_not_v5', 'The published rule set is not v5.0 yet.');
    // An urgent sign the rule set does not publish is never dropped quietly: that would give a
    // normal card to someone who said something feels wrong (SF-4).
    const known = new Set(offered.options.urgent.map((o) => o.code));
    const unknown = (body.urgent?.signs ?? []).filter((c) => !known.has(c));
    if (unknown.length > 0)
      throw new BadInput(`urgent.signs: unknown sign ${unknown.join(', ')}.`, {
        issues: unknown.map((c) => ({ path: 'urgent.signs', message: `Unknown sign ${c}.` })),
      });
    const risk = await this.safety.check([
      body.somethingElse?.text,
      ...(body.tasks ?? []).map((t) => t.title),
    ]);
    const server = await this.serverFacts(userId, offered, now);
    const checkIn: CheckInV5 = {
      ...body,
      somethingElseGroup: body.somethingElse?.group,
    };
    const { input, dropped } = factsFromCheckInV5(checkIn, offered.options, {
      ...server,
      ...recheck,
      'safety.risk': risk !== null,
    });
    const chips = new Set(offered.options.task_kind.map((o) => o.code));
    const tasks = (body.tasks ?? []).map((t) => ({
      title: t.title,
      chip: t.chip && chips.has(t.chip) ? t.chip : USUAL,
    }));
    return {
      engine,
      input,
      dropped,
      risk,
      offered,
      sources: { copy: engine.copy, catalogue: engine.ruleset.catalogue, tasks, input },
    };
  }

  /** The account's signals, its plan in v5.0's names (Tab 9), Life right now (ME-4) and RW-1. */
  private async serverFacts(
    userId: string,
    offered: CheckInOptions,
    now: Date,
  ): Promise<EngineInput> {
    const [base, tier, profile] = await Promise.all([
      this.decisions.serverFacts(userId, offered.catalogue, now),
      this.entitlements.tierFor(userId, now),
      this.profile.read(userId),
    ]);
    const lifeNow = profile.lifeNow.filter((l) => l !== 'prefer_not');
    return {
      ...base.facts,
      'signals.plan': tier,
      ...(lifeNow.length > 0 ? { 'life.now': lifeNow } : {}),
      // RW-1: back to work, study or training adds the day's load check (pattern 60).
      'prefs.return_to_work': profile.returnToWork,
    };
  }
}

/** A v5.0 version has the Help menu's question (Tab 7). */
const isV5 = (offered: CheckInOptions): boolean => offered.options.help.length > 0;
