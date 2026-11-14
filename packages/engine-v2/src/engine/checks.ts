import { valuesOf, type Catalogue } from '../format/catalogue.js';
import { MAX_ALTERNATIVES } from './card.js';
import { run } from './run.js';
import type { Card, CardItem, CompiledRuleset, EngineInput, RunResult } from './types.js';

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
    rule: 'SF-1, ADR 0007 §7: the Hopeless chip shows the support screen',
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
  // v5.0 (its catalogue has task chips): tasks by chip, and v5.0's plans (Tab 9).
  const v5 = valuesOf(catalogue, 'task_chip').length > 0;
  const tasks: EngineInput[] = v5
    ? [
        {},
        { 'tasks.count': 1, 'tasks.chips': ['can_t_wait'] },
        { 'tasks.count': 3, 'tasks.chips': ['usual', 'hard'] },
      ]
    : [
        {},
        { 'demand.present': true, 'demand.timeline': 'T0' },
        { 'demand.present': true, 'demand.timeline': 'T3' },
      ];
  const plans = v5 ? ['free', 'premium'] : ['free', 'plus'];
  const out: EngineInput[] = [];
  for (const cell of cells)
    for (const feeling of feelings)
      for (const taskInput of tasks)
        for (const plan of plans) {
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
/** A tool the plan lacks: v3.3's Advanced without Plus; v5.0's Prime or Premium (Tab 9). */
const EVERYTHING = new Set(['premium', 'organisation_seat', 'pilot']);
const lacks = (i: CardItem, input: EngineInput): boolean => {
  const plan = input['signals.plan'];
  if (i.plan === 'premium') return typeof plan !== 'string' || !EVERYTHING.has(plan);
  if (i.plan === 'prime')
    return plan !== 'prime' && !(typeof plan === 'string' && EVERYTHING.has(plan));
  return i.advanced && !entitled(input);
};
/**
 * The task as the primary. v3.3: any Execute primary. v5.0 cuts the task to one small step in
 * Amber (TK-3; Tab 18 gives Smallest next step there), so in Amber only the task itself counts
 * (Start, Skip to); in Red any Execute primary does ("Tasks kept, not suggested now").
 */
const TASK_ITSELF = new Set(['start_task', 'skip_to_task']);
const taskFirst = (c: Card): boolean => {
  const p = c.primary;
  if (!p || !amberRed(c)) return false;
  if (c.pattern === undefined || c.light === 'red')
    return p.pathway === 'execute' || ('action' in p.target && TASK_ITSELF.has(p.target.action));
  return 'action' in p.target && TASK_ITSELF.has(p.target.action);
};
const felt = (input: EngineInput, family: string): boolean =>
  Object.keys((input['family.intensity'] as object | undefined) ?? {}).includes(family);

/** Each check: the rows responsible when a card breaks it (empty: no row to name), or null. */
const TESTS: Readonly<Record<PublishCheckId, (c: Card, input: EngineInput) => string[] | null>> = {
  red_support: (c) => (c.light === 'red' && !hasSupport(c) ? [] : null),
  support_visible: (c) => (c.supportVisible && !hasSupport(c) ? [] : null),
  primary_in_plan: (c, input) => (c.primary && lacks(c.primary, input) ? [rowOf(c.primary)] : null),
  // v3.3: no Advanced tool at all; v5.0 (ENT-3): no tool the plan lacks.
  no_advanced_amber_red: (c, input) => {
    const advanced = items(c).filter(
      (i) => i.advanced || (i.plan !== undefined && lacks(i, input)),
    );
    return amberRed(c) && advanced.length > 0 ? advanced.map(rowOf) : null;
  },
  card_shape: (c) => (c.alternatives.length > MAX_ALTERNATIVES ? [] : null),
  no_task_first_amber_red: (c) => (c.primary && taskFirst(c) ? [rowOf(c.primary)] : null),
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

/** What a set of inputs gives: how many cards of each light and primary, and the checks. */
export interface ExploreReport extends PublishCheckReport {
  /** Inputs the engine refused (not standard values). */
  readonly refused: number;
  readonly byLight: Readonly<Record<string, number>>;
  /** By the primary's tool, action or pathway; `support_screen`, or `none` for no primary. */
  readonly byPrimary: Readonly<Record<string, number>>;
  /** How many inputs each rule fired on; a rule that never fires is listed with 0. */
  readonly fired: Readonly<Record<string, number>>;
  /** State × strongest feeling → the most common outcome there (DESIGN §8 outcome map). */
  readonly map: readonly OutcomeCell[];
  /** Cards with nothing to offer: no primary, no alternatives, not a support screen. */
  readonly noOutcome: { readonly count: number; readonly examples: readonly EngineInput[] };
  /** The inputs that match a query, when one is given. */
  readonly matches?: { readonly count: number; readonly examples: readonly Outcome[] };
}

/** One input's outcome, as the explorer reports it. */
export interface Outcome {
  readonly input: EngineInput;
  readonly light: string | null;
  readonly primary: string;
}

export interface OutcomeCell {
  /** `E2M3`, or `none` when the state wasn't given. */
  readonly cell: string;
  /** The highest-rated feeling family, or `none`. */
  readonly family: string;
  readonly n: number;
  /** The most common light and primary here, and how many inputs gave exactly that. */
  readonly light: string | null;
  readonly primary: string;
  readonly share: number;
  /** How many different outcomes this cell and feeling gave. */
  readonly outcomes: number;
}

/** Which inputs to pick out (DESIGN §8 query): every given part must match. */
export interface Query {
  readonly light?: string;
  readonly primary?: string;
  /** Rows (IDs) at least one of whose rules fired. */
  readonly rows?: ReadonlySet<string>;
}

const QUERY_EXAMPLES = 25;

const cellOf = (input: EngineInput): string => {
  const e = input['state.energy'];
  const m = input['state.mood'];
  return typeof e === 'number' && typeof m === 'number' ? `E${String(e)}M${String(m)}` : 'none';
};
const familyOf = (input: EngineInput): string => {
  const rated = Object.entries(
    (input['family.intensity'] as Record<string, number | null> | undefined) ?? {},
  );
  let best: [string, number] = ['none', -1];
  for (const [f, v] of rated) if ((v ?? 0) > best[1]) best = [f, v ?? 0];
  return best[0];
};

/** Tallies outcomes per state and feeling, then keeps the most common one of each. */
class OutcomeMap {
  private readonly cells = new Map<string, Map<string, number>>();

  add(input: EngineInput, light: string | null, primary: string): void {
    const at = `${cellOf(input)}|${familyOf(input)}`;
    const tally = this.cells.get(at) ?? new Map<string, number>();
    const outcome = `${light ?? ''}|${primary}`;
    tally.set(outcome, (tally.get(outcome) ?? 0) + 1);
    this.cells.set(at, tally);
  }

  report(): OutcomeCell[] {
    return [...this.cells.entries()]
      .map(([at, tally]) => {
        const [cell = 'none', family = 'none'] = at.split('|');
        const [top = '|', share = 0] =
          [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? [];
        const [light = '', primary = 'none'] = top.split('|');
        const n = [...tally.values()].reduce((x, y) => x + y, 0);
        return { cell, family, n, light: light || null, primary, share, outcomes: tally.size };
      })
      .sort((a, b) => a.cell.localeCompare(b.cell) || a.family.localeCompare(b.family));
  }
}

const matchesQuery = (
  q: Query,
  card: Card,
  fired: readonly string[],
  rowOfRule: (id: string) => string,
): boolean =>
  (q.light === undefined || card.light === q.light) &&
  (q.primary === undefined || primaryKey(card) === q.primary) &&
  (q.rows === undefined || fired.some((id) => q.rows?.has(rowOfRule(id))));

/** The card's main suggestion as a code: its tool, action or pathway; `support_screen`; `none`. */
export const primaryKey = (card: Card): string => {
  if (card.kind === 'support_screen') return 'support_screen';
  const p = card.primary;
  if (!p) return 'none';
  return p.tool ?? ('action' in p.target ? p.target.action : (p.pathway ?? 'none'));
};
const bump = (into: Record<string, number>, key: string): void => {
  into[key] = (into[key] ?? 0) + 1;
};

/**
 * Runs inputs through a compiled version and summarises the cards (the staff explorer, DESIGN §8),
 * checking every card against the fixed rules on the way. O(inputs × run).
 */
export function explore(
  ruleset: CompiledRuleset,
  inputs: readonly EngineInput[] = sweepInputs(ruleset.catalogue),
  query?: Query,
): ExploreReport {
  const tally = new Tally(ruleset, query);
  for (const input of inputs) tally.add(input, run(ruleset, input));
  return tally.report(inputs.length);
}

/** What the explorer counts as it runs each input. */
class Tally {
  private readonly rowOfRule: ReadonlyMap<string, string>;
  private readonly map = new OutcomeMap();
  private readonly empty: EngineInput[] = [];
  private readonly matched: Outcome[] = [];
  private readonly violations: Violation[] = [];
  private readonly counts: Partial<Record<PublishCheckId, number>> = {};
  private readonly byLight: Record<string, number> = {};
  private readonly byPrimary: Record<string, number> = {};
  private readonly fired: Record<string, number>;
  private refused = 0;
  private emptyCount = 0;
  private matchCount = 0;

  constructor(
    ruleset: CompiledRuleset,
    private readonly query: Query | undefined,
  ) {
    this.rowOfRule = new Map(ruleset.rules.map((r) => [r.id, r.rowId]));
    this.fired = Object.fromEntries(ruleset.rules.map((r) => [r.id, 0]));
  }

  add(input: EngineInput, result: RunResult): void {
    if (!result.ok) {
      this.refused += 1;
      return;
    }
    const { card } = result;
    for (const id of result.trace.fired) this.fired[id] = (this.fired[id] ?? 0) + 1;
    bump(this.byLight, card.light ?? 'none');
    bump(this.byPrimary, primaryKey(card));
    this.map.add(input, card.light, primaryKey(card));
    if (card.kind === 'card' && !card.primary && card.alternatives.length === 0) {
      this.emptyCount += 1;
      if (this.empty.length < EXAMPLES_PER_CHECK) this.empty.push(input);
    }
    this.match(input, card, result.trace.fired);
    for (const v of broken(card, input)) {
      this.counts[v.check] = (this.counts[v.check] ?? 0) + 1;
      if ((this.counts[v.check] ?? 0) <= EXAMPLES_PER_CHECK)
        this.violations.push({ check: v.check, input, rows: [...new Set(v.rows)] });
    }
  }

  private match(input: EngineInput, card: Card, fired: readonly string[]): void {
    const q = this.query;
    if (!q || !matchesQuery(q, card, fired, (id) => this.rowOfRule.get(id) ?? id)) return;
    this.matchCount += 1;
    if (this.matched.length < QUERY_EXAMPLES)
      this.matched.push({ input, light: card.light, primary: primaryKey(card) });
  }

  report(ran: number): ExploreReport {
    return {
      ran,
      refused: this.refused,
      byLight: this.byLight,
      byPrimary: this.byPrimary,
      fired: this.fired,
      violations: this.violations,
      counts: this.counts,
      map: this.map.report(),
      noOutcome: { count: this.emptyCount, examples: this.empty },
      ...(this.query ? { matches: { count: this.matchCount, examples: this.matched } } : {}),
    };
  }
}

/**
 * The checks before publish (DESIGN §5): the sweep through a compiled version, every card checked.
 * A version with any violation must not be published (unless its gap is acknowledged, E-51).
 */
export function publishChecks(
  ruleset: CompiledRuleset,
  inputs: readonly EngineInput[] = sweepInputs(ruleset.catalogue),
): PublishCheckReport {
  const { ran, violations, counts } = explore(ruleset, inputs);
  return { ran, violations, counts };
}

/** One input whose card differs between two versions. */
export interface CardChange {
  readonly input: EngineInput;
  readonly before: { readonly light: string | null; readonly primary: string };
  readonly after: { readonly light: string | null; readonly primary: string };
}

export interface CompareReport {
  readonly ran: number;
  /** Inputs whose light or primary differs. */
  readonly changed: number;
  readonly examples: readonly CardChange[];
}

const COMPARE_EXAMPLES = 25;

/**
 * The impact of a change (M7, DESIGN §8): the same inputs through two versions, and where the
 * card's light or primary differs. Inputs either version refuses are skipped. O(inputs × run).
 */
export function compare(
  before: CompiledRuleset,
  after: CompiledRuleset,
  inputs: readonly EngineInput[] = sweepInputs(after.catalogue),
): CompareReport {
  let changed = 0;
  const examples: CardChange[] = [];
  for (const input of inputs) {
    const a = run(before, input);
    const b = run(after, input);
    if (!a.ok || !b.ok) continue;
    const was = { light: a.card.light, primary: primaryKey(a.card) };
    const now = { light: b.card.light, primary: primaryKey(b.card) };
    if (was.light === now.light && was.primary === now.primary) continue;
    changed += 1;
    if (examples.length < COMPARE_EXAMPLES) examples.push({ input, before: was, after: now });
  }
  return { ran: inputs.length, changed, examples };
}
