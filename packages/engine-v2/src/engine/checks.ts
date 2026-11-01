import { valuesOf, type Catalogue } from '../format/catalogue.js';
import { MAX_ALTERNATIVES } from './card.js';
import { run } from './run.js';
import type { Card, CardItem, CompiledRuleset, EngineInput } from './types.js';

/**
 * The workbook's fixed rules, checked on the engine's output before a version is published
 * (DESIGN §5). Each is a property every card must have, whatever the rows say.
 */
export const PUBLISH_CHECKS = [
  { id: 'red_support', rule: 'Tab 10: Red always shows "Get support now"' },
  { id: 'support_visible', rule: 'MD-6, Tab 7: support, once required, is never hidden' },
  { id: 'primary_in_plan', rule: "ENT-1: the primary is a tool the user's plan includes" },
  { id: 'no_advanced_amber_red', rule: 'Tab 6d D, ENT-3: no Advanced tool in Amber or Red' },
  { id: 'card_shape', rule: 'Tab 7: one primary and at most two alternatives' },
  { id: 'no_task_first_amber_red', rule: 'Tab 10: in Amber and Red the task is never the primary' },
  {
    id: 'hopeless_override',
    rule: 'SF-1, ADR 0004 §7: the Hopeless chip shows the support screen',
  },
  { id: 'no_reflect_amber_red', rule: 'RF-1: Reflect is not offered in Amber or Red' },
] as const;
export type PublishCheckId = (typeof PUBLISH_CHECKS)[number]['id'];

export interface Violation {
  readonly check: PublishCheckId;
  readonly input: EngineInput;
  /** The rule rows that put the offending item on the card, to fix or record in a gap. */
  readonly rows: readonly string[];
}

export interface PublishCheckReport {
  readonly ran: number;
  readonly violations: readonly Violation[];
  /** Violations per check, all of them (the list above keeps the first few of each). */
  readonly counts: Readonly<Partial<Record<PublishCheckId, number>>>;
}

/**
 * The inputs every version is checked on: each State Grid cell and "not given"; no feeling, or
 * one at a time at High; no task, or one due now or later; the free and the Plus plan. Places and
 * flags rotate through the catalogue so they are covered without multiplying the count.
 * Deterministic, so the same version always gives the same report.
 */
export function sweepInputs(catalogue: Catalogue): EngineInput[] {
  const cells: (EngineInput | null)[] = [null];
  for (let e = 1; e <= 4; e += 1)
    for (let m = 1; m <= 4; m += 1) cells.push({ 'state.energy': e, 'state.mood': m });
  const feelings = [null, ...valuesOf(catalogue, 'family').map((v) => v.code)];
  const settings = valuesOf(catalogue, 'context').map((v) => v.code);
  const flags = valuesOf(catalogue, 'sensitivity_flag').map((v) => v.code);
  const tasks: EngineInput[] = [
    {},
    { 'demand.present': true, 'demand.timeline': 'T0' },
    { 'demand.present': true, 'demand.timeline': 'T3' },
  ];
  const out: EngineInput[] = [];
  for (const cell of cells)
    for (const feeling of feelings)
      for (const taskInput of tasks)
        for (const plan of ['free', 'plus']) {
          const i = out.length;
          out.push({
            ...(cell ?? {}),
            ...(feeling ? { 'family.intensity': { [feeling]: 8 } } : {}),
            ...taskInput,
            'signals.plan': plan,
            ...(settings.length > 0 && i % 3 === 0
              ? { 'context.setting': settings[i % settings.length] }
              : {}),
            ...(flags.length > 1 && i % 5 === 0
              ? { 'sensitivity.flags': [flags[i % flags.length], flags[(i + 1) % flags.length]] }
              : {}),
          });
        }
  return out;
}

const items = (c: Card): CardItem[] => [
  ...(c.primary ? [c.primary] : []),
  ...c.alternatives,
  ...c.queued,
  ...c.visible,
];
const rowOf = (i: CardItem): string => i.from.split('#')[0] ?? i.from;
const amberRed = (c: Card): boolean => c.light === 'amber' || c.light === 'red';

const hasSupport = (c: Card): boolean =>
  c.visible.some((i) => 'action' in i.target && i.target.action === 'get_support_now');
const entitled = (input: EngineInput): boolean =>
  input['signals.plan'] === 'plus' || input['signals.plan'] === 'institution';
const felt = (input: EngineInput, family: string): boolean =>
  Object.keys((input['family.intensity'] as object | undefined) ?? {}).includes(family);

/** Each check: the rows responsible when a card breaks it (empty: no row to name), or null. */
const TESTS: Readonly<Record<PublishCheckId, (c: Card, input: EngineInput) => string[] | null>> = {
  red_support: (c) => (c.light === 'red' && !hasSupport(c) ? [] : null),
  support_visible: (c) => (c.supportVisible && !hasSupport(c) ? [] : null),
  primary_in_plan: (c, input) =>
    !entitled(input) && c.primary?.advanced ? [rowOf(c.primary)] : null,
  no_advanced_amber_red: (c) => {
    const advanced = items(c).filter((i) => i.advanced);
    return amberRed(c) && advanced.length > 0 ? advanced.map(rowOf) : null;
  },
  card_shape: (c) => (c.alternatives.length > MAX_ALTERNATIVES ? [] : null),
  no_task_first_amber_red: (c) =>
    amberRed(c) && c.primary?.pathway === 'execute' ? [rowOf(c.primary)] : null,
  hopeless_override: (c, input) =>
    felt(input, 'immediate_risk_language') && c.kind !== 'support_screen' ? [] : null,
  no_reflect_amber_red: (c) => {
    const reflect = items(c).filter((i) => i.pathway === 'reflect');
    return amberRed(c) && reflect.length > 0 ? reflect.map(rowOf) : null;
  },
};

/** Which checks a card breaks, with the rows responsible. */
function broken(card: Card, input: EngineInput): { check: PublishCheckId; rows: string[] }[] {
  return PUBLISH_CHECKS.flatMap(({ id }) => {
    const rows = TESTS[id](card, input);
    return rows === null ? [] : [{ check: id, rows }];
  });
}

/** Keeps the first few examples of each check, so a report stays readable. */
const EXAMPLES_PER_CHECK = 5;

/**
 * Runs the sweep through a compiled version and checks every card (DESIGN §5 "checks before
 * publish"). A version with any violation must not be published. O(inputs × run).
 */
export function publishChecks(
  ruleset: CompiledRuleset,
  inputs = sweepInputs(ruleset.catalogue),
): PublishCheckReport {
  const violations: Violation[] = [];
  const counts: Partial<Record<PublishCheckId, number>> = {};
  for (const input of inputs) {
    const result = run(ruleset, input);
    if (!result.ok) continue; // the sweep is built from the catalogue, so this is not expected
    for (const v of broken(result.card, input)) {
      counts[v.check] = (counts[v.check] ?? 0) + 1;
      if ((counts[v.check] ?? 0) <= EXAMPLES_PER_CHECK)
        violations.push({ check: v.check, input, rows: [...new Set(v.rows)] });
    }
  }
  return { ran: inputs.length, violations, counts };
}
