import { valuesOf, type Catalogue, type Issue } from '../format/catalogue.js';
import { FACTS, type Domain, type FactSpec } from '../format/registry.js';
import type { EngineInput } from './types.js';

const FACT_BY_NAME = new Map(FACTS.map((f) => [f.name, f]));
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isIntensity = (v: unknown): boolean =>
  v === null || (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10);

/** The catalogue's codes for a domain, or null when it has none (nothing to check against). */
function codesOf(catalogue: Catalogue, domain: Domain | undefined): ReadonlySet<string> | null {
  if (!domain) return null;
  const values = valuesOf(catalogue, domain);
  return values.length > 0 ? new Set(values.map((v) => v.code)) : null;
}

type Check = (spec: FactSpec, value: unknown, codes: ReadonlySet<string> | null) => string | null;

const inRange = (spec: FactSpec, v: unknown): boolean =>
  Number.isInteger(v) &&
  (spec.min === undefined || (v as number) >= spec.min) &&
  (spec.max === undefined || (v as number) <= spec.max);

function setProblem(
  spec: FactSpec,
  value: unknown,
  codes: ReadonlySet<string> | null,
): string | null {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
    return 'expected a list of codes';
  if (new Set(value).size !== value.length) return 'a code is listed twice';
  const unknown = codes ? (value as string[]).filter((v) => !codes.has(v)) : [];
  return unknown.length > 0 ? `not ${String(spec.domain)} values: ${unknown.join(', ')}` : null;
}

/** One check per fact type (the registry's FactType). */
const CHECKS: Readonly<Record<FactSpec['type'], Check>> = {
  boolean: (_s, v) => (typeof v === 'boolean' ? null : 'expected true or false'),
  number: (spec, v) =>
    inRange(spec, v)
      ? null
      : `expected a whole number from ${String(spec.min)} to ${String(spec.max)}`,
  intensity: (_s, v) => (isIntensity(v) ? null : 'expected 0-10, or null when not rated'),
  enum: (spec, v, codes) => {
    if (typeof v !== 'string') return 'expected a code';
    return codes && !codes.has(v) ? `"${v}" is not a ${String(spec.domain)} value` : null;
  },
  set: setProblem,
};

/** The problem with one fact's value, or null. */
function valueProblem(spec: FactSpec, value: unknown, catalogue: Catalogue): string | null {
  return CHECKS[spec.type](spec, value, codesOf(catalogue, spec.domain));
}

/** A keyed fact: `{ key: intensity }`, each key a value of the keying domain. */
function keyedProblems(
  spec: FactSpec,
  value: unknown,
  catalogue: Catalogue,
  path: string,
): Issue[] {
  if (!isRecord(value)) return [{ path, message: 'expected { code: intensity }' }];
  const keys = codesOf(catalogue, spec.keyedBy);
  return Object.entries(value).flatMap(([key, v]): Issue[] => {
    if (keys && !keys.has(key))
      return [
        { path: `${path}/${key}`, message: `"${key}" is not a ${String(spec.keyedBy)} value` },
      ];
    const problem = valueProblem(spec, v, catalogue);
    return problem ? [{ path: `${path}/${key}`, message: problem }] : [];
  });
}

/**
 * Checks an input against the format and the version's catalogue (DESIGN §5: standard values
 * only; unknown values are refused with a clear error, never guessed). Returns every problem.
 */
export function checkInput(input: EngineInput, catalogue: Catalogue): Issue[] {
  if (!isRecord(input)) return [{ path: '', message: 'expected the input facts' }];
  return Object.entries(input).flatMap(([name, value]): Issue[] => {
    const path = `/${name}`;
    const spec = FACT_BY_NAME.get(name);
    if (!spec) return [{ path, message: 'no such fact' }];
    if (spec.derived) return [{ path, message: 'set by the rules, not sent' }];
    if (spec.computed) return [{ path, message: 'worked out by the engine, not sent' }];
    if (spec.keyedBy) return keyedProblems(spec, value, catalogue, path);
    const problem = valueProblem(spec, value, catalogue);
    return problem ? [{ path, message: problem }] : [];
  });
}
