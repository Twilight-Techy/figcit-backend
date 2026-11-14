import { Injectable } from '@nestjs/common';
import {
  factsFromCheckInV5,
  run,
  type Card,
  type CheckInV5,
  type DroppedAnswer,
  type EngineInput,
} from '@figcit/engine-v2';
import { AppError, NotConfigured } from '../../common/errors/errors.js';
import { EntitlementsService } from '../entitlements/entitlements.service.js';
import { CheckInOptionsService, type CheckInOptions } from '../rulesets/checkin-options.service.js';
import { SafetyService } from '../safety/safety.service.js';
import { ProfileService } from '../users/profile.service.js';
import { DecisionsService } from './decisions.service.js';
import { EngineRuntimeService, type Runnable } from './engine-runtime.service.js';
import { menuOf, presentV5, previewV5, type PresentV5Sources } from './present-v5.js';
import type { CheckInV5Body, DecisionV5Dto, PreviewV5Dto } from './v5.schemas.js';

/** A v5.0 check-in as the published engine's input, with what the card's words need. */
interface PreparedV5 {
  readonly engine: Runnable;
  readonly input: EngineInput;
  readonly dropped: readonly DroppedAnswer[];
  readonly sources: PresentV5Sources;
}

const USUAL = 'usual';

/**
 * Rules Engine v5.0 decisions (docs/engine-v2/V5.md): the app's v5.0 check-in through the
 * published version's options, with the plan (Tab 9), Life right now (ME-4) and the safety check
 * on its free text (SF-1, SE-1). Both need an account (SU-1). The preview runs it as the person goes and stores nothing; the
 * decision is recorded as every engine v2 decision is, so it replays the same.
 */
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
      ? await this.decisions.previousFacts(userId, body.recheckOfId)
      : undefined;
    const p = await this.prepare(body, userId, now, recheck);
    const { record, card } = await this.decisions.store(p, {
      userId,
      recheckOfId: recheck ? (body.recheckOfId ?? null) : null,
      now,
    });
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
