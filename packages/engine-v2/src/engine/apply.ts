import type { Effect, Target } from '../format/types.js';
import type { RunState } from './state.js';
import type { CompiledRule } from './types.js';

/** Where an effect came from: its rule, and how strongly that rule's feelings were felt. */
export interface Origin {
  readonly rule: CompiledRule;
  readonly salience: number;
}

export interface Proposal extends Origin {
  readonly slot: string;
  readonly target: Target;
  readonly copy: string | null;
}

export interface Requirement extends Origin {
  /** null: anywhere on the card. */
  readonly slot: string | null;
  readonly target: Target;
}

/**
 * What the matched rules asked of the card, collected in run order. The card is built from it once
 * every stage has run (card.ts), so a later requirement still binds an earlier proposal.
 */
export class Material {
  readonly proposals: Proposal[] = [];
  readonly musts: Requirement[] = [];
  readonly forbids: Requirement[] = [];
  /** Tool → the rule that excluded it. */
  readonly excluded = new Map<string, string>();
  readonly prefers: (Origin & { readonly tools: readonly string[] })[] = [];
  readonly tiers = new Map<string, Set<string>>();
  readonly tierLimits: (Origin & { tier: string; max: number; slot: string | null })[] = [];
  readonly tierRequires: (Origin & { tier: string; slot: string })[] = [];
  readonly keepOnly: (Origin & { drivers: readonly string[] })[] = [];
  readonly stepCaps: (number | null)[] = [];
  readonly minutesCaps: number[] = [];
  readonly copyUses: (Origin & { slot: string; key: string })[] = [];
  readonly practice: {
    modes: readonly string[];
    maxMinutes: number | null;
    tools: readonly string[] | null;
  }[] = [];
  readonly reminders: (Origin & { minutes: number; copy: string | null })[] = [];
  support: string | null = null;
  stop: string | null = null;
}

const str = (e: Effect, k: string): string => String(e[k]);
const num = (e: Effect, k: string): number => Number(e[k]);
const list = (e: Effect, k: string): readonly string[] =>
  (e[k] as readonly string[] | undefined) ?? [];
const slotOf = (e: Effect): string | null => (typeof e['slot'] === 'string' ? e['slot'] : null);

/** Effects that change the facts (the band, the light, classes, drivers). */
function applyToState(e: Effect, state: RunState): boolean {
  switch (e.kind) {
    case 'band.set':
      state.setBand(str(e, 'to'));
      return true;
    case 'band.lower':
      state.lowerBand(num(e, 'steps'));
      return true;
    case 'band.cap':
      state.capBand(str(e, 'to'));
      return true;
    case 'band.hold':
      state.holdBand();
      return true;
    case 'band.limit_drop':
      state.limitDrop(num(e, 'steps'));
      return true;
    case 'band.limit_rise':
      state.limitRise(num(e, 'steps'));
      return true;
    case 'light.set':
      state.setLight(str(e, 'light'));
      return true;
    case 'light.overlay':
      state.overlayLight(str(e, 'light'));
      return true;
    case 'light.never':
      state.neverLight(str(e, 'light'));
      return true;
    case 'classes.add':
      for (const c of list(e, 'classes')) state.classes.add(c);
      return true;
    case 'drivers.add':
      state.addDrivers(list(e, 'drivers'), typeof e['weight'] === 'number' ? e['weight'] : 1);
      return true;
    default:
      return false;
  }
}

/** Effects about which actions and tools the card may hold. */
function applyToChoice(e: Effect, origin: Origin, m: Material): boolean {
  const target = e['target'] as Target;
  switch (e.kind) {
    case 'propose':
      m.proposals.push({
        ...origin,
        slot: str(e, 'slot'),
        target,
        copy: (e['copy'] as string | undefined) ?? null,
      });
      return true;
    case 'require':
      m.musts.push({ ...origin, slot: str(e, 'slot'), target });
      return true;
    case 'forbid':
      m.forbids.push({ ...origin, slot: slotOf(e), target });
      return true;
    case 'tools.exclude':
      for (const t of list(e, 'tools')) if (!m.excluded.has(t)) m.excluded.set(t, origin.rule.id);
      return true;
    case 'tools.prefer':
      m.prefers.push({ ...origin, tools: list(e, 'tools') });
      return true;
    case 'tools.tier': {
      const set = m.tiers.get(str(e, 'tier')) ?? new Set<string>();
      for (const t of list(e, 'tools')) set.add(t);
      m.tiers.set(str(e, 'tier'), set);
      return true;
    }
    case 'tier.limit':
      m.tierLimits.push({ ...origin, tier: str(e, 'tier'), max: num(e, 'max'), slot: slotOf(e) });
      return true;
    case 'tier.require':
      m.tierRequires.push({ ...origin, tier: str(e, 'tier'), slot: str(e, 'slot') });
      return true;
    default:
      return false;
  }
}

/** Effects about the card's frame: support, limits, wording, drivers kept. */
function applyToFrame(e: Effect, origin: Origin, m: Material): void {
  switch (e.kind) {
    case 'stop':
      m.stop ??= origin.rule.id;
      break;
    case 'support.show':
      m.support ??= origin.rule.id;
      break;
    case 'drivers.keep_only':
      m.keepOnly.push({ ...origin, drivers: list(e, 'drivers') });
      break;
    case 'step_cap.set':
      m.stepCaps.push(e['max'] === null ? null : num(e, 'max'));
      break;
    case 'minutes.cap':
      m.minutesCaps.push(num(e, 'max'));
      break;
    case 'copy.use':
      m.copyUses.push({ ...origin, slot: str(e, 'slot'), key: str(e, 'key') });
      break;
    case 'practice.limit':
      m.practice.push({
        modes: list(e, 'modes'),
        maxMinutes: typeof e['max_minutes'] === 'number' ? e['max_minutes'] : null,
        tools: Array.isArray(e['tools']) ? list(e, 'tools') : null,
      });
      break;
    case 'reminder.offer':
      m.reminders.push({
        ...origin,
        minutes: num(e, 'minutes'),
        copy: (e['copy'] as string | undefined) ?? null,
      });
      break;
    default:
      throw new Error(`the engine has no behaviour for effect "${e.kind}"`);
  }
}

/** Applies one effect of a matched rule. Every effect in the registry is handled here. */
export function applyEffect(e: Effect, origin: Origin, state: RunState, m: Material): void {
  if (applyToState(e, state)) return;
  if (applyToChoice(e, origin, m)) return;
  applyToFrame(e, origin, m);
}
