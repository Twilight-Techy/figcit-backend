#!/usr/bin/env node
// figcit-rules snapshot | fixtures [--workbook <dir>] [--out <dir>]
// Reads the workbook tabs (CSV export of the .xlsx), validates, and writes the snapshot JSON and
// the engine fixtures into packages/engine/fixtures (generated files; never hand-edit).
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildSnapshot } from './build-snapshot.js';
import { buildFixtures } from './fixtures.js';
import { validateSnapshot } from './validate.js';
import { readWorkbook } from './workbook.js';

const ROOT = resolve(import.meta.dirname, '../../..');

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const workbook = arg('--workbook', resolve(ROOT, 'docs/specs/rules-engine-v3.3'));
  const out = arg('--out', resolve(ROOT, 'packages/engine/fixtures'));
  const tables = await readWorkbook(workbook);
  const { snapshot, hash } = buildSnapshot(tables);
  const problems = validateSnapshot(snapshot, tables);
  if (problems.length > 0) {
    process.stderr.write(`Snapshot is invalid:\n  ${problems.join('\n  ')}\n`);
    process.exitCode = 1;
    return;
  }
  await mkdir(out, { recursive: true });
  if (command === 'snapshot' || command === 'fixtures') {
    await writeFile(resolve(out, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
    process.stdout.write(`snapshot ${snapshot.version} (sha256 ${hash})\n`);
  }
  if (command === 'fixtures') {
    const fixtures = buildFixtures(tables);
    await writeFile(resolve(out, 'scenarios.json'), `${JSON.stringify(fixtures, null, 2)}\n`);
    process.stdout.write(`${String(fixtures.length)} scenario fixtures\n`);
  }
  if (command !== 'snapshot' && command !== 'fixtures') {
    process.stderr.write('usage: figcit-rules snapshot|fixtures [--workbook dir] [--out dir]\n');
    process.exitCode = 2;
  }
}

await main();
