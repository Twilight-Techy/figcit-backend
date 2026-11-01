// The real v3.3 workbook, mapped and compiled, for engine tests.
import {
  applyMappings,
  catalogueOf,
  compile,
  run,
  type Card,
  type EngineInput,
  type Trace,
} from '../../src/index.js';
import { imported } from '../fixtures.js';

const { records } = applyMappings(imported.records, catalogueOf(imported.records).catalogue);
export const catalogue = catalogueOf(records).catalogue;
export const ruleset = compile(
  records.map((r) => ({ ...r, id: `${r.tab}·${r.sourceRef}` })),
  catalogue,
);

/** Runs one input; fails the test loudly on an input problem. */
export function cardFor(
  input: EngineInput,
  trace: 'light' | 'full' = 'light',
): { card: Card; trace: Trace } {
  const result = run(ruleset, input, { trace });
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result;
}
