// Brings the published rule set's check-in options (the input mappings table, E-40) in line with
// the input seed: a new draft from the published version, each difference as one audited row
// change, then submit and publish. Rows the seed no longer has are retired, not deleted, so old
// check-ins still read. Run with NODE_ENV=production for production (the repo's .env otherwise
// points it at the dev database). Prints what it would do with DRY_RUN=1.
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { INPUT_MAPPINGS_HEADER, INPUT_SEED } from '@figcit/engine-v2';
import { DbModule } from '../../src/common/db/db.module.js';
import type { Actor } from '../../src/modules/rulesets/ruleset-audit.service.js';
import { RulesetLifecycleService } from '../../src/modules/rulesets/ruleset-lifecycle.service.js';
import { RulesetRecordsService } from '../../src/modules/rulesets/ruleset-records.service.js';
import { RulesetsModule } from '../../src/modules/rulesets/rulesets.module.js';
import { RulesetsService } from '../../src/modules/rulesets/rulesets.service.js';
import type { RecordDto } from '../../src/modules/rulesets/rulesets.dto.js';

const SYSTEM: Actor = { id: null, role: 'system' };
const TAB = 'input_mappings';
const REASON = process.env['REASON'] ?? 'Check-in options from the input seed';
const DRY = process.env['DRY_RUN'] === '1';
const COLUMN = new Map<string, number>(INPUT_MAPPINGS_HEADER.map((h, i) => [h, i]));

@Module({ imports: [DbModule, RulesetsModule] })
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- a Nest module is a decorated empty class
class SyncModule {}

type Cells = Record<string, string>;

/** Each seeded option's cells, keyed by `input · code`, in seed order. */
function wanted(): Map<string, Cells> {
  const out = new Map<string, Cells>();
  for (const seed of INPUT_SEED)
    seed.rows.forEach(([code, label, group, mapsTo, note = ''], i) =>
      out.set(`${seed.input} · ${code}`, {
        Input: seed.input,
        Code: code,
        Label: label,
        Group: group,
        Order: String(i + 1),
        'Maps to': mapsTo,
        Source: seed.source,
        Note: note,
      }),
    );
  return out;
}

const textOf = (r: RecordDto, header: string): string =>
  r.columns.find((c) => c.header === header)?.text ?? '';
const keyOf = (r: RecordDto): string => `${textOf(r, 'Input')} · ${textOf(r, 'Code')}`;
const cellsOf = (c: Cells): { col: number; text: string }[] =>
  [...COLUMN].map(([header, col]) => ({ col, text: c[header] ?? '' }));

interface Plan {
  readonly retire: RecordDto[];
  readonly edit: [string, Cells][];
  readonly restore: string[];
  readonly add: [string, Cells][];
}

/** What changes: live rows the seed dropped, rows whose cells differ, retired rows back, new rows. */
function plan(rows: readonly RecordDto[]): Plan {
  const want = wanted();
  const have = rows.filter((r) => r.frame !== null);
  const byKey = new Map(have.map((r) => [keyOf(r), r]));
  return {
    retire: have.filter((r) => r.status === 'active' && !want.has(keyOf(r))),
    edit: [...want].filter(([k, c]) => {
      const r = byKey.get(k);
      return r !== undefined && [...COLUMN.keys()].some((h) => textOf(r, h) !== c[h]);
    }),
    restore: [...want.keys()].filter((k) => byKey.get(k)?.status === 'retired'),
    add: [...want].filter(([k]) => !byKey.has(k)),
  };
}

function summary(p: Plan): string {
  const lines = [
    `retire ${String(p.retire.length)}, restore ${String(p.restore.length)}, edit ${String(p.edit.length)}, add ${String(p.add.length)}`,
    ...p.retire.map((r) => `  retire ${keyOf(r)}`),
    ...p.edit.map(([k]) => `  edit   ${k}`),
    ...p.restore.map((k) => `  restore ${k}`),
    ...p.add.map(([k]) => `  add    ${k}`),
  ];
  return lines.join('\n');
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SyncModule, { logger: ['error'] });
  try {
    const rulesets = app.get(RulesetsService);
    const records = app.get(RulesetRecordsService);
    const lifecycle = app.get(RulesetLifecycleService);
    const published = (await rulesets.list()).find((v) => v.status === 'published');
    if (!published) throw new Error('No published rule set');
    const { retire, edit, restore, add } = plan(await rulesets.tab(published.label, TAB));
    console.log(`from ${published.label}: ${summary({ retire, edit, restore, add })}`);
    if (DRY || retire.length + edit.length + add.length + restore.length === 0) return;
    const open = (await rulesets.list()).filter(
      (v) => v.status === 'draft' || v.status === 'in_review',
    );
    if (open.length > 0)
      throw new Error(`Finish or discard ${open.map((v) => v.label).join(', ')} first`);
    const draft = await rulesets.createDraft(SYSTEM, published.label, REASON);
    const rows = new Map(
      (await rulesets.tab(draft.label, TAB))
        .filter((r) => r.frame !== null)
        .map((r) => [keyOf(r), r]),
    );
    const id = (k: string): string => {
      const r = rows.get(k);
      if (!r) throw new Error(`No row ${k} in the draft`);
      return r.recordId;
    };
    for (const r of retire)
      await records.setStatus(SYSTEM, draft.label, id(keyOf(r)), 'retired', REASON);
    for (const k of restore) await records.setStatus(SYSTEM, draft.label, id(k), 'active', REASON);
    for (const [k, c] of edit)
      await records.edit(SYSTEM, draft.label, id(k), { cells: cellsOf(c), reason: REASON });
    // A new row goes after the last row of its input, so the table stays grouped.
    for (const [k, c] of add) {
      const current = (await rulesets.tab(draft.label, TAB)).filter((r) => r.frame !== null);
      const same = current.filter((r) => textOf(r, 'Input') === c['Input']);
      const after = (same.at(-1) ?? current.at(-1))?.recordId;
      if (!after) throw new Error(`Nowhere to add ${k}`);
      await records.add(SYSTEM, draft.label, { after, cells: cellsOf(c), reason: REASON });
    }
    await lifecycle.submit(SYSTEM, draft.label);
    await lifecycle.publish(SYSTEM, draft.label);
    console.log(`published ${draft.label}`);
  } finally {
    await app.close();
  }
}

await main();
