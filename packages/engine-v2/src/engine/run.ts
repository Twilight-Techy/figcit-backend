import { FACTS, STAGES } from '../format/registry.js';
import { applyEffect, Material } from './apply.js';
import { CardBuilder } from './card.js';
import { evaluate, salience } from './conditions.js';
import { checkInput } from './input.js';
import { RunState } from './state.js';
import type { CompiledRuleset, EngineInput, RuleCheck, RunResult, Trace } from './types.js';

/** The engine's own version, recorded with every recommendation (DESIGN §7). */
export const ENGINE_VERSION = '2.0.0';
/** Rule set formats this engine runs (DESIGN §5 "format versions"). */
export const ENGINE_FORMATS: readonly number[] = [3];

export interface RunOptions {
  /** `light`: the rules that fired; `full`: every rule checked and the facts after each stage. */
  readonly trace?: 'light' | 'full';
}

/**
 * The facts that have a value of their own, for the full trace. Defaults (a left-out boolean or
 * set) are not listed, so adding a fact to the registry doesn't change existing traces (replay).
 */
function snapshot(state: RunState): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of FACTS) {
    if (f.keyedBy || !state.has(f.name)) continue;
    const value = state.fact(f.name);
    if (value !== undefined) out[f.name] = value;
  }
  return out;
}

/**
 * Runs one check-in through a compiled rule set (DESIGN §5). Pure: the same input, rule set and
 * engine version give the same card and trace. The stages run in Tab 8 order; after the safety
 * override (stop) no further stage runs and the card is the support screen. O(rules × condition
 * size), then the card in O(proposals log proposals).
 */
export function run(
  ruleset: CompiledRuleset,
  input: EngineInput,
  options: RunOptions = {},
): RunResult {
  const issues = checkInput(input, ruleset.catalogue);
  if (issues.length > 0) return { ok: false, issues };
  const full = options.trace === 'full';
  const state = new RunState(input, ruleset.catalogue);
  const material = new Material();
  const fired: string[] = [];
  const stages: NonNullable<Trace['stages']>[number][] = [];
  let next = 0;
  for (const { key } of STAGES) {
    state.stage = key;
    const checks: RuleCheck[] = [];
    for (; next < ruleset.rules.length && ruleset.rules[next]?.stage === key; next += 1) {
      const rule = ruleset.rules[next];
      if (!rule) break;
      const result = evaluate(rule.when, state, ruleset.catalogue);
      if (full)
        checks.push({
          rule: rule.id,
          ref: rule.ref,
          matched: result.ok,
          ...(result.failedAt ? { failedAt: result.failedAt } : {}),
        });
      if (!result.ok) continue;
      fired.push(rule.id);
      const origin = { rule, salience: salience(rule.when, state) };
      for (const effect of rule.then) applyEffect(effect, origin, state, material);
    }
    if (full) stages.push({ stage: key, checks, facts: snapshot(state) });
    if (material.stop !== null) break;
  }
  state.stage = 'feedback';
  const builder = new CardBuilder(material, state, ruleset.catalogue);
  const card = builder.build();
  const notes = [...state.notes, ...builder.notes];
  const trace: Trace = full
    ? { level: 'full', fired, stages, proposals: builder.fates, notes }
    : { level: 'light', fired, notes };
  return { ok: true, card, trace };
}
