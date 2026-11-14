// Rules Engine v5.0, read, mapped and compiled, for the v5.0 checks (docs/engine-v2/V5.md).
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  applyMappings,
  catalogueOf,
  compile,
  readWorkbook,
  withAdditions,
  type RuleRecordDraft,
} from '../../src/index.js';

const dir = resolve(import.meta.dirname, '../../../../docs/specs/rules-engine-v5');
const files: Record<string, string> = {};
for (const name of readdirSync(dir))
  if (name.endsWith('.csv')) files[name] = readFileSync(resolve(dir, name), 'utf8');

export const read = readWorkbook(files);
export const imported = withAdditions(read);
const mapped = applyMappings(imported.records, catalogueOf(imported.records).catalogue);
export const { report } = mapped;
export const catalogue = catalogueOf(mapped.records).catalogue;
export const ruleset = compile(
  mapped.records.map((r) => ({ ...r, id: `${r.tab}·${r.sourceRef}` })),
  catalogue,
);

/** A tab's example rows (Tabs 18-21), each as { column heading: text }. */
export function examples(tab: RuleRecordDraft['tab']): Record<string, string>[] {
  return read.records
    .filter((r) => r.tab === tab && r.role === 'example')
    .map((r) => Object.fromEntries(r.columns.map((c) => [c.header, c.text.trim()])));
}

/** A catalogue value's code from its label (the workbook's words). */
export function codeOf(domain: Parameters<typeof catalogue.get>[0], label: string): string {
  const v = (catalogue.get(domain) ?? []).find((x) => x.label === label);
  if (!v) throw new Error(`no ${domain} labelled "${label}"`);
  return v.code;
}

/** Tabs 18 to 20 show the full toolkit: their checks run on Premium (Tab 9; T-19, T-20 are free). */
export const FULL = { 'signals.plan': 'premium' } as const;
