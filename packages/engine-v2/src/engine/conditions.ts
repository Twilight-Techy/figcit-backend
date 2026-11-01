import { valuesOf, type Catalogue } from '../format/catalogue.js';
import { FACTS } from '../format/registry.js';
import type { Comparison, Condition, ConditionValue } from '../format/types.js';
import type { RunState } from './state.js';

const FACT_BY_NAME = new Map(FACTS.map((f) => [f.name, f]));

export interface Evaluation {
  readonly ok: boolean;
  /** Path of the first part that decided a failure, e.g. `/all/1`. */
  readonly failedAt?: string;
}

const isComparison = (c: Condition): c is Comparison => 'fact' in c;

/** A number to compare an intensity with: a literal, or an intensity band's lower bound. */
function threshold(value: ConditionValue | undefined, catalogue: Catalogue): number | undefined {
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && 'band' in value)
    return (
      valuesOf(catalogue, 'intensity_band').find((v) => v.code === value.band)?.from ?? undefined
    );
  return undefined;
}

function ordered(op: string, a: number, b: number): boolean {
  switch (op) {
    case 'gte':
      return a >= b;
    case 'gt':
      return a > b;
    case 'lte':
      return a <= b;
    case 'lt':
      return a < b;
    case 'eq':
      return a === b;
    case 'ne':
      return a !== b;
    default:
      return false;
  }
}

function setOp(op: string, have: readonly unknown[], want: ConditionValue | undefined): boolean {
  const list: readonly unknown[] = Array.isArray(want) ? want : [want];
  switch (op) {
    case 'contains':
      return have.includes(want);
    case 'not_contains':
      return !have.includes(want);
    case 'contains_any':
      return list.some((v) => have.includes(v));
    case 'contains_all':
      return list.every((v) => have.includes(v));
    case 'empty':
      return have.length === 0;
    case 'not_empty':
      return have.length > 0;
    default:
      return false;
  }
}

/**
 * One comparison. A fact with no value matches only `absent` (and the set and boolean defaults the
 * run state gives); an unrated intensity is present but compares as nothing (IG-04: never mild).
 */
function compare(c: Comparison, state: RunState, catalogue: Catalogue): boolean {
  const value = state.fact(c.fact, c.key);
  if (c.op === 'present') return value !== undefined;
  if (c.op === 'absent') return value === undefined;
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return setOp(c.op, value, c.value);
  const type = FACT_BY_NAME.get(c.fact)?.type;
  if (type === 'intensity') {
    const bound = threshold(c.value, catalogue);
    return bound !== undefined && ordered(c.op, value as number, bound);
  }
  if (type === 'number') return ordered(c.op, value as number, c.value as number);
  return compareValue(c, value, state);
}

/** A boolean or enum fact; an ordered enum (the band) compares by catalogue order. */
function compareValue(c: Comparison, value: unknown, state: RunState): boolean {
  switch (c.op) {
    case 'is':
    case 'eq':
      return value === c.value;
    case 'ne':
      return value !== c.value;
    case 'in':
      return (c.value as readonly unknown[]).includes(value);
    case 'not_in':
      return !(c.value as readonly unknown[]).includes(value);
    default:
      return ordered(c.op, state.bandOrder(value), state.bandOrder(c.value));
  }
}

/** Evaluates a condition; null always holds. Short-circuits as written, like the workbook reads. */
export function evaluate(
  cond: Condition | null,
  state: RunState,
  catalogue: Catalogue,
  path = '',
): Evaluation {
  if (cond === null) return { ok: true };
  if (isComparison(cond))
    return compare(cond, state, catalogue) ? { ok: true } : { ok: false, failedAt: path || '/' };
  if ('all' in cond) {
    for (const [i, c] of cond.all.entries()) {
      const r = evaluate(c, state, catalogue, `${path}/all/${String(i)}`);
      if (!r.ok) return r;
    }
    return { ok: true };
  }
  if ('any' in cond) {
    const ok = cond.any.some(
      (c, i) => evaluate(c, state, catalogue, `${path}/any/${String(i)}`).ok,
    );
    return ok ? { ok: true } : { ok: false, failedAt: path || '/' };
  }
  return evaluate(cond.not, state, catalogue, `${path}/not`).ok
    ? { ok: false, failedAt: path || '/' }
    : { ok: true };
}

/**
 * How strongly the feelings and sensations a matched rule names are felt: the highest rating
 * among them (unrated counts 0). Ranks proposals within a layer, so the most intense feeling leads
 * (Tab 2: "use the HIGHEST intensity"). Parts under `not` don't count.
 */
export function salience(cond: Condition | null, state: RunState): number {
  if (cond === null) return 0;
  if (!isComparison(cond)) {
    if ('not' in cond) return 0;
    const parts = 'all' in cond ? cond.all : cond.any;
    return Math.max(0, ...parts.map((c) => salience(c, state)));
  }
  const felt = feltKey(cond);
  if (!felt) return 0;
  const v = state.fact(felt.fact, felt.key);
  return typeof v === 'number' ? v : 0;
}

/** The feeling or sensation a comparison names, as its keyed intensity fact. */
function feltKey(c: Comparison): { fact: string; key: string } | null {
  if (c.fact === 'families' && c.op === 'contains')
    return typeof c.value === 'string' ? { fact: 'family.intensity', key: c.value } : null;
  if ((c.fact === 'family.intensity' || c.fact === 'sensation.intensity') && c.key !== undefined)
    return { fact: c.fact, key: c.key };
  return null;
}

/** The input facts a matched rule read and found true, with their values: "Because you said X". */
export function because(
  cond: Condition | null,
  state: RunState,
  catalogue: Catalogue,
): { fact: string; key?: string; value: unknown }[] {
  if (cond === null) return [];
  if (!isComparison(cond)) {
    if ('not' in cond) return [];
    const parts = 'all' in cond ? cond.all : cond.any;
    return parts.flatMap((c) => because(c, state, catalogue));
  }
  const spec = FACT_BY_NAME.get(cond.fact);
  if (!spec || spec.derived || !compare(cond, state, catalogue)) return [];
  const chip = cond.fact === 'families' && cond.op === 'contains' && typeof cond.value === 'string';
  const fact = chip ? 'family.intensity' : cond.fact;
  const key = chip ? cond.value : cond.key;
  const value = state.fact(fact, key);
  if (value === undefined || value === false) return [];
  return [{ fact, ...(key === undefined ? {} : { key }), value }];
}
