// The check-in options as the workbook fills them, bundled by the app for a first run offline
// (DECISION_LOG E-40). `UPDATE_FIXTURES=1 vitest run` rewrites the file; otherwise it must match.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalJson, checkInOptionsOf, type JsonValue } from '../src/index.js';
import { imported } from './fixtures.js';

const file = resolve(import.meta.dirname, '../fixtures/checkin-options.json');

describe('the bundled check-in options', () => {
  it('match what the workbook gives', () => {
    const { view, issues } = checkInOptionsOf(imported.records);
    expect(issues).toEqual([]);
    const body = view as unknown as JsonValue;
    const hash = createHash('sha256').update(canonicalJson(body)).digest('hex');
    const fixture = `${JSON.stringify({ version: 'bundled', hash, ...view }, null, 2)}\n`;
    if (process.env['UPDATE_FIXTURES'] === '1' || !existsSync(file)) writeFileSync(file, fixture);
    expect(readFileSync(file, 'utf8')).toBe(fixture);
  });

  it('flag only the sensations whose strength a rule reads', () => {
    const { view, options } = checkInOptionsOf(imported.records);
    const groupOf = new Map(
      options.sensation.map((o) => [
        o.code,
        o.mapsTo && 'domain' in o.mapsTo && o.mapsTo.domain === 'sensation_group'
          ? o.mapsTo.code
          : null,
      ]),
    );
    const expected: Record<string, string> = {
      pain: 'pain',
      sensory_overload: 'overstimulation',
    };
    for (const o of view.inputs.sensation)
      expect(o.asksStrength).toBe(expected[groupOf.get(o.code) ?? '']);
    const flagged = view.inputs.sensation.filter((o) => o.asksStrength);
    expect(flagged.map((o) => o.code)).toContain('pain_hard_to_locate');
    expect(flagged.map((o) => o.code)).toContain('overstimulated');
    for (const [input, list] of Object.entries(view.inputs))
      if (input !== 'sensation') expect(list.filter((o) => o.asksStrength)).toEqual([]);
  });
});
