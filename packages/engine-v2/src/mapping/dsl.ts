import type { Action, LayerKey, StageKey } from '../format/registry.js';
import { TOOL_SEED } from '../format/tool-seed.js';
import type { Comparison, Condition, Effect, EngineRule, Target } from '../format/types.js';
import type { RowMapping } from './types.js';

// Small builders for the mapping file, so each row reads close to the workbook's own words.
// They only build plain data; the format check (validate.ts) is what decides a row is valid.

export const set = (kind: string, params: Record<string, unknown> = {}): Effect => ({
  kind,
  ...params,
});
export const all = (...c: Condition[]): Condition => ({ all: c });
export const any = (...c: Condition[]): Condition => ({ any: c });
export const not = (c: Condition): Condition => ({ not: c });

export const path = (pathway: string): Target => ({ pathway });
export const tool = (code: string): Target => ({ tool: code });
export const action = (name: Action): Target => ({ action: name });

export const propose = (slot: string, target: Target, copy?: string): Effect =>
  set('propose', { slot, target, ...(copy ? { copy } : {}) });
/** This must fill the slot (a requirement; later layers can't overrule it). */
export const must = (slot: string, target: Target): Effect => set('require', { slot, target });
/** Not on the card at all, or (with a slot) not in that slot. */
export const forbid = (target: Target, slot?: string): Effect =>
  set('forbid', { ...(slot ? { slot } : {}), target });

export const contains = (fact: string, value: string): Comparison => ({
  fact,
  op: 'contains',
  value,
});
export const containsAny = (fact: string, value: readonly string[]): Comparison => ({
  fact,
  op: 'contains_any',
  value,
});
export const is = (fact: string, value: boolean): Comparison => ({ fact, op: 'is', value });
export const eq = (fact: string, value: string): Comparison => ({ fact, op: 'eq', value });
export const lights = (...value: string[]): Comparison => ({ fact: 'light', op: 'in', value });

export const withTask: Comparison = is('demand.present', true);

/**
 * The family was felt, or (for families with a sensation group, E-19) one of that group's
 * sensations was chosen at S09.
 */
export function felt(family: string, group?: string): Condition {
  const chip = contains('families', family);
  return group ? any(chip, { fact: 'sensation.intensity', key: group, op: 'present' }) : chip;
}

/** Rated High or Very High (7-10); a sensation counts only when it was rated. */
export function high(family: string, group?: string): Condition {
  const chip: Comparison = {
    fact: 'family.intensity',
    key: family,
    op: 'gte',
    value: { band: 'high' },
  };
  return group
    ? any(chip, { fact: 'sensation.intensity', key: group, op: 'gte', value: { band: 'high' } })
    : chip;
}

/**
 * Rated Mild or Moderate (0-6). A skipped intensity is neither this nor High: no source says what
 * it means, and it must not read as mild (INPUT_GAPS IG-04).
 */
export const belowHigh = (family: string): Comparison => ({
  fact: 'family.intensity',
  key: family,
  op: 'lt',
  value: { band: 'high' },
});

/** A rule, optionally run at a later stage than its row (e.g. once the light is known). */
export function rule(
  when: Condition | null,
  then: readonly Effect[],
  stage?: StageKey,
): EngineRule {
  return { ...(stage ? { stage } : {}), when, then };
}

/** A mapped row: one stage and layer, its rules, and how the text was read. */
export function mapped(m: {
  readonly stage: StageKey;
  readonly layer?: LayerKey;
  readonly rules: readonly EngineRule[];
  readonly reason: string;
  readonly mapping?: 'exact' | 'interpreted';
}): RowMapping {
  return {
    mapping: m.mapping ?? 'interpreted',
    reason: m.reason,
    engine: { stage: m.stage, ...(m.layer ? { layer: m.layer } : {}), rules: m.rules },
  };
}

/** Tool codes of one pathway (Tab 6d section A), optionally leaving some in. */
export const toolsOf = (pathway: string, except: readonly string[] = []): string[] =>
  TOOL_SEED.filter(([code, , p]) => p === pathway && !except.includes(code)).map(([code]) => code);

/** A Tab 7 pattern: runs at orchestration (Tab 8 step 10), every rule gated by its trigger. */
export function pattern(m: {
  readonly when: Condition;
  readonly layer: LayerKey;
  readonly rules: readonly EngineRule[];
  readonly reason: string;
  readonly mapping?: 'exact' | 'interpreted';
}): RowMapping {
  return mapped({
    stage: 'orchestration',
    layer: m.layer,
    rules: m.rules.map((r) => ({ ...r, when: r.when ? all(m.when, r.when) : m.when })),
    reason: m.reason,
    mapping: m.mapping ?? 'interpreted',
  });
}

/** The wording key of a pattern's CTA or one of its alternatives (the text is M4 copy). */
export const copyOf = (n: number, part = 'cta'): string => `card.p${String(n)}.${part}`;
export const band = (...value: string[]): Comparison => ({ fact: 'band.final', op: 'in', value });
export const noTask: Comparison = is('demand.present', false);
export const due = (...value: string[]): Comparison => ({
  fact: 'demand.timeline',
  op: 'in',
  value,
});
export const peak = (op: 'gte' | 'lt', level: string): Comparison => ({
  fact: 'peak.negative',
  op,
  value: { band: level },
});
/** No harder feeling at all ("no distress trigger"). */
export const noDistress: Comparison = { fact: 'peak.negative', op: 'absent' };
export const remind = (minutes: number, copy: string): Effect =>
  set('reminder.offer', { minutes, copy });
