// Which rules a check-in can reach at all (E-61): a rule whose condition needs a value no option
// of the check-in leads to (a feeling family no chip maps to, a need the screen doesn't offer) can
// never fire from the app, whatever is answered. Pure.
import { valuesOf, type Catalogue } from '../format/catalogue.js';
import type { InputKind, InputOptions } from '../format/inputs.js';
import type { Domain } from '../format/registry.js';
import type { Comparison, Condition } from '../format/types.js';

/** For each input fact the options decide, the values (or keys) some option gives it. */
export type Producible = ReadonlyMap<string, ReadonlySet<string>>;

/** What the check-in can give: every option's "Maps to", and every task characteristic. */
export function producible(options: InputOptions, catalogue: Catalogue): Producible {
  const out = new Map<string, Set<string>>();
  const add = (fact: string, code: string): void => {
    out.set(fact, (out.get(fact) ?? new Set()).add(code));
  };
  const via = (kind: InputKind, domain: Domain, fact: string): void => {
    for (const o of options[kind])
      if (o.mapsTo && 'domain' in o.mapsTo && o.mapsTo.domain === domain) add(fact, o.mapsTo.code);
  };
  via('feeling', 'family', 'family.intensity');
  via('need', 'family', 'family.intensity');
  via('sensation', 'sensation_group', 'sensation.intensity');
  via('place', 'context', 'context.setting');
  via('support', 'support', 'context.supports');
  via('sense', 'sensitivity_flag', 'sensitivity.flags');
  // Sensory sensations carry the flags the senses question gave (owner review, 12 Nov 2026).
  via('sensation', 'sensitivity_flag', 'sensitivity.flags');
  via('need', 'need', 'needs');
  via('timeline', 'timeline', 'demand.timeline');
  // The task's characteristics are any catalogue value (the AI step, treated as working: E-44).
  for (const v of valuesOf(catalogue, 'demand_characteristic'))
    add('demand.characteristics', v.code);
  out.set('families', out.get('family.intensity') ?? new Set());
  return out;
}

const KEYED = new Set(['family.intensity', 'sensation.intensity']);
const NEGATIVE = new Set(['absent', 'not_contains', 'ne', 'not_in', 'empty']);

const listOf = (v: Comparison['value']): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? [...(v as readonly string[])] : [];

/** Why one comparison can't hold for any check-in, or null when it can. */
function leaf(c: Comparison, can: Producible): string[] | null {
  const values = can.get(c.fact);
  if (!values || NEGATIVE.has(c.op)) return null;
  const missing = (list: readonly string[]): string[] =>
    list.filter((v) => !values.has(v)).map((v) => `${c.fact} · ${v}`);
  if (KEYED.has(c.fact)) return c.key && !values.has(c.key) ? [`${c.fact} · ${c.key}`] : null;
  const wanted = listOf(c.value);
  if (wanted.length === 0) return null;
  const gone = missing(wanted);
  // "Any of" needs one value a check-in can give; the others need every value.
  const needsAll = !(c.op === 'contains_any' || c.op === 'in');
  return (needsAll ? gone.length > 0 : gone.length === wanted.length) ? gone : null;
}

/**
 * Why no check-in can meet a condition, or null when one might: a comparison needing a value no
 * option gives, through `all` (any part impossible) and `any` (every part impossible). A `not` is
 * taken as possible. Facts the options don't decide (signals, a re-check, what rules work out)
 * are taken as possible too.
 */
export function unreachable(when: Condition | null, can: Producible): string[] | null {
  if (!when) return null;
  if ('all' in when) {
    for (const c of when.all) {
      const why = unreachable(c, can);
      if (why) return why;
    }
    return null;
  }
  if ('any' in when) {
    const whys = when.any.map((c) => unreachable(c, can));
    const all = whys.filter((w): w is string[] => w !== null);
    return all.length === whys.length ? [...new Set(all.flat())] : null;
  }
  if ('not' in when) return null;
  return leaf(when, can);
}
