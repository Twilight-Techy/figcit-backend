// Shared fixtures for the format tests: the real v3.3 workbook, imported with its added tables.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { catalogueOf, readWorkbook, withAdditions, type Catalogue } from '../src/index.js';

const dir = resolve(import.meta.dirname, '../../../docs/specs/rules-engine-v3.3');
export const files: Record<string, string> = {};
for (const name of readdirSync(dir)) {
  if (name.endsWith('.csv')) files[name] = readFileSync(resolve(dir, name), 'utf8');
}
export const imported = withAdditions(readWorkbook(files));
export const { catalogue, issues: catalogueIssues } = catalogueOf(imported.records);
export const codes = (c: Catalogue, domain: Parameters<Catalogue['get']>[0]): string[] =>
  (c.get(domain) ?? []).map((v) => v.code);

/** EX-1 as engine columns: one rule, read straight from the Tab 10 text. */
export const ex1 = {
  stage: 'capacity_fit',
  rules: [
    {
      when: {
        any: [
          { fact: 'peak.negative', op: 'gte', value: { band: 'high' } },
          { fact: 'sensation.intensity', key: 'pain', op: 'gte', value: 7 },
          { fact: 'families', op: 'contains', value: 'shutdown_freeze_numb' },
        ],
      },
      then: [{ kind: 'band.lower', steps: 1 }],
    },
  ],
};

/** The catalogue as imported; it now holds the tools too (E-49). */
export const withExtras = catalogueOf(imported.records).catalogue;
