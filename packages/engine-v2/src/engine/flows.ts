// The input sets the explorer runs (M7, DESIGN §8): every input fact at the values the rules tell
// apart, covered pairwise, plus a seeded random sample; and every combination of the inputs the
// safety rows read (E-21). Pure and deterministic: the same version and seed give the same inputs.
import { valuesOf, type Catalogue } from '../format/catalogue.js';
import { FACTS, type FactSpec } from '../format/registry.js';
import type { Condition } from '../format/types.js';
import { canonicalJson, type JsonValue } from '../ruleset/canonical.js';
import { sweepInputs } from './checks.js';
import type { CompiledRuleset, EngineInput } from './types.js';

/** The input facts a computed fact is worked out from (`RunState.computed`). */
export const COMPUTED_FROM: Readonly<Record<string, readonly string[]>> = {
  'state.cell': ['state.energy', 'state.mood'],
  families: ['family.intensity'],
  'peak.negative': ['family.intensity'],
  'sensitivity.count': ['sensitivity.flags'],
  'recheck.intensity_change': ['recheck.previous_peak', 'family.intensity'],
  'recheck.band_improved': ['recheck.previous_baseline', 'state.energy', 'state.mood'],
};

/**
 * The inputs that mostly decide a derived fact (band, light, classes, drivers). A safety row that
 * reads a derived fact is checked over these; the full dependency is every input, which the
 * all-flows set covers instead.
 */
const DERIVED_FROM = ['state.energy', 'state.mood', 'family.intensity', 'context.setting'] as const;

/** A fact only means something with another set: a task's timeline needs a task. */
const NEEDS: Readonly<Record<string, Readonly<Record<string, true>>>> = {
  'demand.timeline': { 'demand.present': true },
  'demand.characteristics': { 'demand.present': true },
  'recheck.previous_light': { 'recheck.present': true },
  'recheck.previous_peak': { 'recheck.present': true },
  'recheck.previous_band': { 'recheck.present': true },
  'recheck.previous_baseline': { 'recheck.present': true },
  'recheck.previous_pathway': { 'recheck.present': true },
  'recheck.support_completed': { 'recheck.present': true },
};

const SPEC = new Map(FACTS.map((f) => [f.name, f]));
const INPUT_FACTS = FACTS.filter((f) => !f.derived && !f.computed);

/** One dimension of the input space: a fact (or a keyed fact's key, or its level) and its values. */
interface Dim {
  readonly name: string;
  /** Index 0 is always "not given". */
  readonly values: readonly unknown[];
}
const ABSENT = Symbol('absent');

// ---- the values the rules tell apart ----

/** Every comparison in a condition tree. */
function* comparisons(c: Condition | null): Generator<{ fact: string; value?: unknown }> {
  if (!c) return;
  if ('all' in c) for (const x of c.all) yield* comparisons(x);
  else if ('any' in c) for (const x of c.any) yield* comparisons(x);
  else if ('not' in c) yield* comparisons(c.not);
  else yield c;
}

/** Numbers to test a number or intensity fact at: each threshold a rule uses and the one below it. */
function thresholds(ruleset: CompiledRuleset): Map<string, Set<number>> {
  const bands = valuesOf(ruleset.catalogue, 'intensity_band');
  const lower = (v: unknown): number | null => {
    if (typeof v === 'number') return v;
    if (typeof v === 'object' && v !== null && 'band' in v)
      return bands.find((b) => b.code === (v as { band: string }).band)?.from ?? null;
    return null;
  };
  const out = new Map<string, Set<number>>();
  const add = (fact: string, n: number): void => {
    const set = out.get(fact) ?? new Set<number>();
    set.add(n);
    set.add(n - 1);
    out.set(fact, set);
  };
  for (const rule of ruleset.rules)
    for (const c of comparisons(rule.when)) {
      const n = lower(c.value);
      if (n === null) continue;
      for (const fact of COMPUTED_FROM[c.fact] ?? [c.fact]) add(fact, n);
    }
  // Every intensity is also tested at each band's edges (3/4, 6/7, 8/9).
  for (const f of FACTS.filter((x) => x.type === 'intensity' && !x.computed))
    for (const b of bands) if (b.from !== null && b.from > 0) add(f.name, b.from);
  return out;
}

const within = (spec: FactSpec, n: number): boolean =>
  Number.isInteger(n) && n >= (spec.min ?? 0) && n <= (spec.max ?? 10);

/** The values of one fact worth telling apart; keyed facts become a key and a level dimension. */
function dimsOf(
  spec: FactSpec,
  catalogue: Catalogue,
  edges: ReadonlySet<number>,
  pairs: boolean,
): Dim[] {
  const codes = (d: FactSpec['domain']): string[] =>
    d ? valuesOf(catalogue, d).map((v) => v.code) : [];
  const numbers = (s: FactSpec): number[] => {
    const all =
      s.max !== undefined && s.max - (s.min ?? 0) <= 4
        ? Array.from({ length: s.max - (s.min ?? 0) + 1 }, (_, i) => (s.min ?? 0) + i)
        : [...edges, s.min ?? 0, s.max ?? 10];
    return [...new Set(all)].filter((n) => within(s, n)).sort((a, b) => a - b);
  };
  if (spec.keyedBy) {
    const keys = codes(spec.keyedBy);
    if (keys.length === 0) return [];
    // Two keys, so rules that read two feelings at once (one of them high) are reached too.
    const levels = [ABSENT, null, ...numbers(spec)];
    const one = [
      { name: `${spec.name}#key`, values: [ABSENT, ...keys] },
      { name: `${spec.name}#level`, values: levels },
    ];
    return pairs
      ? [
          ...one,
          { name: `${spec.name}#key2`, values: [ABSENT, ...keys] },
          { name: `${spec.name}#level2`, values: levels },
        ]
      : one;
  }
  switch (spec.type) {
    case 'boolean':
      return [{ name: spec.name, values: [ABSENT, true, false] }];
    case 'enum':
      return [{ name: spec.name, values: [ABSENT, ...codes(spec.domain)] }];
    case 'set':
      return [{ name: spec.name, values: [ABSENT, ...codes(spec.domain).map((c) => [c])] }];
    case 'number':
    case 'intensity':
      return [{ name: spec.name, values: [ABSENT, ...numbers(spec)] }];
  }
}

/** `pairs`: give keyed facts two keys (the all-flows set) or one (the exhaustive safety set). */
function dimensions(ruleset: CompiledRuleset, facts: readonly FactSpec[], pairs: boolean): Dim[] {
  const edges = thresholds(ruleset);
  return facts
    .flatMap((f) => dimsOf(f, ruleset.catalogue, edges.get(f.name) ?? new Set(), pairs))
    .filter((d) => d.values.length > 1);
}

/** Builds one input from a value index per dimension. */
function assemble(dims: readonly Dim[], at: readonly number[]): EngineInput {
  const input: Record<string, unknown> = {};
  const keyed = new Map<string, Partial<Record<string, unknown>>>();
  dims.forEach((d, i) => {
    const v = d.values[at[i] ?? 0];
    if (v === ABSENT) return;
    const [fact, part] = d.name.split('#') as [string, string | undefined];
    if (!part) input[fact] = v;
    else keyed.set(fact, { ...keyed.get(fact), [part]: v });
  });
  for (const [fact, parts] of keyed) {
    const value: Record<string, unknown> = {};
    // A key given without a level is rated high (8); a null level is "not rated". The first key
    // wins a clash.
    const level = (part: string): unknown => (part in parts ? parts[part] : 8);
    if (typeof parts['key2'] === 'string') value[parts['key2']] = level('level2');
    if (typeof parts['key'] === 'string') value[parts['key']] = level('level');
    if (Object.keys(value).length > 0) input[fact] = value;
  }
  for (const fact of Object.keys(input)) Object.assign(input, NEEDS[fact]);
  return input;
}

// ---- covering and sampling ----

/** mulberry32: a small seeded generator, so a run can be repeated exactly. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Every pair of values across two dimensions, numbered, with which are covered so far. */
class Pairs {
  private readonly offset: number[][] = [];
  private readonly covered: Uint8Array;
  /** How many pairs no row covers yet. */
  left = 0;
  private cursor = 0;

  constructor(private readonly sizes: readonly number[]) {
    let total = 0;
    for (let i = 0; i < sizes.length; i += 1) {
      const row: number[] = [];
      for (let j = 0; j < sizes.length; j += 1) {
        row.push(total);
        if (j > i) total += this.size(i) * this.size(j);
      }
      this.offset.push(row);
    }
    this.covered = new Uint8Array(total);
    this.left = total;
  }

  size(i: number): number {
    return this.sizes[i] ?? 0;
  }

  private key(i: number, a: number, j: number, b: number): number {
    return i < j
      ? (this.offset[i]?.[j] ?? 0) + a * this.size(j) + b
      : (this.offset[j]?.[i] ?? 0) + b * this.size(i) + a;
  }

  isCovered(i: number, a: number, j: number, b: number): boolean {
    return this.covered[this.key(i, a, j, b)] === 1;
  }

  /** The first pair not yet covered, as [dim, value, dim, value]. */
  next(): [number, number, number, number] {
    while (this.covered[this.cursor] === 1) this.cursor += 1;
    for (let i = 0; i < this.sizes.length; i += 1)
      for (let j = i + 1; j < this.sizes.length; j += 1) {
        const start = this.offset[i]?.[j] ?? 0;
        const span = this.size(i) * this.size(j);
        if (this.cursor < start + span) {
          const r = this.cursor - start;
          return [i, Math.floor(r / this.size(j)), j, r % this.size(j)];
        }
      }
    throw new Error('no pair left');
  }

  cover(row: readonly number[]): void {
    for (let i = 0; i < row.length; i += 1)
      for (let j = i + 1; j < row.length; j += 1) {
        const k = this.key(i, row[i] ?? 0, j, row[j] ?? 0);
        if (this.covered[k] === 0) {
          this.covered[k] = 1;
          this.left -= 1;
        }
      }
  }
}

/** The value of dimension `k` that covers the most new pairs with the values already chosen. */
function bestValue(pairs: Pairs, row: readonly number[], k: number, random: () => number): number {
  let best = 0;
  let bestGain = -1;
  for (let v = 0; v < pairs.size(k); v += 1) {
    let gain = 0;
    row.forEach((w, m) => {
      if (w >= 0 && m !== k && !pairs.isCovered(k, v, m, w)) gain += 1;
    });
    if (gain > bestGain || (gain === bestGain && random() < 0.5)) [best, bestGain] = [v, gain];
  }
  return best;
}

/**
 * A pairwise covering set (greedy, in the manner of AETG): every value of every dimension appears
 * with every value of every other dimension in at least one row. O(rows × dims² × values).
 */
export function pairwise(sizes: readonly number[], random: () => number): number[][] {
  const pairs = new Pairs(sizes);
  const rows: number[][] = [];
  while (pairs.left > 0) {
    const [i, a, j, b] = pairs.next();
    const row = new Array<number>(sizes.length).fill(-1);
    row[i] = a;
    row[j] = b;
    const rest = [...sizes.keys()].filter((k) => k !== i && k !== j);
    for (const k of shuffle(rest, random)) row[k] = bestValue(pairs, row, k, random);
    pairs.cover(row);
    rows.push(row);
  }
  return rows;
}

/** Fisher-Yates, in place. */
function shuffle<T>(list: T[], random: () => number): T[] {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j] as T, list[i] as T];
  }
  return list;
}

/** What nearly every check-in gives: the state and a feeling. Other facts are given less often. */
const CORE = new Set([
  'state.energy',
  'state.mood',
  'family.intensity#key',
  'family.intensity#level',
]);

/** A random input: a core fact is given 9 times in 10, any other fact 1 time in 3. */
function sampleRow(dims: readonly Dim[], random: () => number): number[] {
  return dims.map((d) => {
    const given = random() < (CORE.has(d.name) ? 0.9 : 1 / 3);
    return given ? 1 + Math.floor(random() * (d.values.length - 1)) : 0;
  });
}

const dedupe = (inputs: readonly EngineInput[]): EngineInput[] => {
  const seen = new Set<string>();
  return inputs.filter((i) => {
    const key = canonicalJson(i as JsonValue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// ---- the sets ----

export interface FlowOptions {
  /** How many random inputs to add (default 2,000). */
  readonly sample?: number;
  readonly seed?: number;
}

export interface FlowSet {
  readonly inputs: readonly EngineInput[];
  readonly parts: { readonly sweep: number; readonly pairwise: number; readonly sample: number };
}

export const DEFAULT_SAMPLE = 2000;
export const DEFAULT_SEED = 1;

/**
 * The all-flows set (DESIGN §8): the publish sweep; a pairwise covering set over every input fact
 * at each value the rules tell apart (every threshold edge); and a seeded random sample.
 */
export function flowInputs(ruleset: CompiledRuleset, options: FlowOptions = {}): FlowSet {
  const random = seeded(options.seed ?? DEFAULT_SEED);
  const dims = dimensions(ruleset, INPUT_FACTS, true);
  const sizes = dims.map((d) => d.values.length);
  const sweep = sweepInputs(ruleset.catalogue);
  const pairs = pairwise(sizes, random).map((row) => assemble(dims, row));
  const sample = Array.from({ length: options.sample ?? DEFAULT_SAMPLE }, () =>
    assemble(dims, sampleRow(dims, random)),
  );
  return {
    inputs: dedupe([...sweep, ...pairs, ...sample]),
    parts: { sweep: sweep.length, pairwise: pairs.length, sample: sample.length },
  };
}

export interface SafetySet {
  readonly inputs: readonly EngineInput[];
  /** The input facts the safety rows read (directly, or through computed and derived facts). */
  readonly facts: readonly string[];
  /** True when every combination was run; false when there were too many and pairs were run. */
  readonly exhaustive: boolean;
  readonly combinations: number;
}

/** About 15 s at 0.5 ms a run: still a request a reviewer waits for. */
export const SAFETY_CAP = 30_000;

/** The input facts a set of rules reads. */
export function factsRead(ruleset: CompiledRuleset, rowIds: ReadonlySet<string>): string[] {
  const out = new Set<string>();
  for (const rule of ruleset.rules) {
    if (!rowIds.has(rule.rowId)) continue;
    for (const c of comparisons(rule.when)) {
      const spec = SPEC.get(c.fact);
      if (!spec) continue;
      if (spec.derived) for (const f of DERIVED_FROM) out.add(f);
      else for (const f of COMPUTED_FROM[c.fact] ?? [c.fact]) out.add(f);
    }
  }
  return [...out].sort();
}

/**
 * The safety rows' impact set (E-21): every combination of the inputs those rows read, at the
 * values the rules tell apart (a keyed fact rated for one key at a time). Where that is more than
 * `cap`, a pairwise set over the same values instead, reported as not exhaustive.
 */
export function safetyInputs(
  ruleset: CompiledRuleset,
  rowIds: ReadonlySet<string>,
  cap = SAFETY_CAP,
): SafetySet {
  const facts = factsRead(ruleset, rowIds);
  const dims = dimensions(
    ruleset,
    facts.map((f) => SPEC.get(f)).filter((f): f is FactSpec => !!f),
    false,
  );
  const sizes = dims.map((d) => d.values.length);
  const combinations = sizes.reduce((p, s) => p * s, 1);
  if (combinations > cap)
    return {
      inputs: dedupe(pairwise(sizes, seeded(DEFAULT_SEED)).map((row) => assemble(dims, row))),
      facts,
      exhaustive: false,
      combinations,
    };
  const rows: number[][] = [[]];
  for (const s of sizes) {
    const next: number[][] = [];
    for (const row of rows) for (let v = 0; v < s; v += 1) next.push([...row, v]);
    rows.splice(0, rows.length, ...next);
  }
  return {
    inputs: dedupe(rows.map((row) => assemble(dims, row))),
    facts,
    exhaustive: true,
    combinations,
  };
}

/** The version without some rows: for "what does this rule affect" (compare the two). */
export function withoutRows(
  ruleset: CompiledRuleset,
  rowIds: ReadonlySet<string>,
): CompiledRuleset {
  return { ...ruleset, rules: ruleset.rules.filter((r) => !rowIds.has(r.rowId)) };
}
