import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Snapshot } from '@figcit/engine';
import type { CardDto } from '../recommendation/recommendation.schemas.js';
import { CardBridgeService } from '../decisions/card-bridge.service.js';
import { RecommendationService } from '../recommendation/recommendation.service.js';
import { RulesService } from '../rules/rules.service.js';
import { CheckInOptionsService } from '../rulesets/checkin-options.service.js';
import {
  demandTimeline,
  toEngineInput,
  validateCodes,
  validateOptions,
  type OptionLists,
  type Summary,
} from './checkin.mapper.js';
import type { CheckInInput } from './checkin.schemas.js';

/**
 * The check-in's input: checking it against what the rule set offers, and Browse check-ins, which
 * run on the server without being stored (E-02, E-46).
 */
@Injectable()
export class CheckInInputService {
  constructor(
    private readonly rules: RulesService,
    private readonly options: CheckInOptionsService,
    private readonly recs: RecommendationService,
    private readonly bridge: CardBridgeService,
  ) {}

  async snapshot(): Promise<Snapshot> {
    return (await this.rules.current()).snapshot;
  }

  /**
   * Checks every value: against the published v2 options when a v2 rule set with options is
   * published (E-40), else against the v1 lists. Returns the v2 lists for the engine adapter.
   */
  async validate(input: CheckInInput): Promise<OptionLists | null> {
    const lists = await this.options.current();
    if (lists) validateOptions(input, lists);
    else validateCodes(input, await this.snapshot());
    return lists;
  }

  /** Browse on engine v2: the decision is recorded without an account (E-05, E-53). */
  private async browseV2(
    input: CheckInInput & { id: string },
    now: Date,
  ): Promise<{ checkIn: Summary; card: CardDto }> {
    const { card } = await this.bridge.browse(input, now);
    const state = input.state.kind === 'grid' ? input.state : null;
    return {
      checkIn: {
        id: input.id,
        createdAt: now.toISOString(),
        cellId: card.state.cellId,
        energy: state?.energy ?? null,
        mood: state?.mood ?? null,
        entry: input.entry,
        light: card.light,
        stateName: card.state.name,
        emotions: input.emotions.map((e) => ({ code: e.code, intensity: e.intensity })),
      },
      card,
    };
  }

  /** Browse mode: the engine runs here; the card stays on the device (v1, before E-53). */
  async browse(
    input: CheckInInput,
    now = new Date(),
  ): Promise<{ checkIn: Summary; card: CardDto }> {
    const lists = await this.validate(input);
    const id = input.id ?? randomUUID();
    if (await this.bridge.enabled()) return this.browseV2({ ...input, id }, now);
    // Browse has no profile, so no time zone: the UK, where the service runs (crisis routes are GB).
    const timeline = demandTimeline(input.demand, now, 'Europe/London');
    const run = await this.recs.preview(toEngineInput(input, timeline, undefined, lists), id, {
      plan: 'free',
      region: 'GB',
    });
    const state = input.state.kind === 'grid' ? input.state : null;
    return {
      checkIn: {
        id,
        createdAt: now.toISOString(),
        cellId: run.result.state.cellId,
        energy: state?.energy ?? null,
        mood: state?.mood ?? null,
        entry: input.entry,
        light: run.result.light,
        stateName: run.card.state.name,
        emotions: input.emotions.map((e) => ({ code: e.code, intensity: e.intensity })),
      },
      card: run.card,
    };
  }
}
