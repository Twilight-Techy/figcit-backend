import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Band, Light, SnapshotCell, SnapshotTimeline, TimelineCode } from '@figcit/engine';
import { clean, parseCsv } from './csv.js';

export interface WorkbookTables {
  readonly cells: readonly Omit<SnapshotCell, 'because'>[];
  readonly timelines: readonly Omit<SnapshotTimeline, 'stepCap' | 'urgency'>[];
  readonly lightHex: Readonly<Partial<Record<Light, string>>>;
  readonly patternIds: ReadonlySet<number>;
  /** Tab 0 rationale openings per cell ("Because you're <phrase> and …"). */
  readonly becauseByCell: ReadonlyMap<string, string>;
  readonly raw: ReadonlyMap<string, string[][]>;
}

export const TAB_FILES = {
  cells: '1-state-grid-16-cells.csv',
  timelines: '4-timeline-codes.csv',
  patterns: '7-recommendation-matrix.csv',
  bands: '10-band-safety-modifiers.csv',
  simplified: '0-simplified-matrix.csv',
  extended: '0b-extended-scenarios.csv',
  worked: '9-worked-example.csv',
} as const;

const BAND_BY_LABEL: Readonly<Record<string, Band>> = {
  'very constrained': 'very_constrained',
  constrained: 'constrained',
  conditional: 'conditional',
  available: 'available',
};

function bandOf(label: string): Band {
  // E4M1 is "Conditional / Constrained": the baseline is Conditional (Tab 10 rule E4M1).
  const first = clean(label).toLowerCase().split('/')[0]?.trim() ?? '';
  const band = BAND_BY_LABEL[first];
  if (!band) throw new Error(`Unknown capacity band "${label}"`);
  return band;
}

async function readTab(dir: string, file: string): Promise<string[][]> {
  return parseCsv(await readFile(join(dir, file), 'utf8'));
}

function readCells(rows: readonly string[][]): WorkbookTables['cells'] {
  return rows
    .filter((r) => /^E[1-4]M[1-4]$/.test(clean(r[0])))
    .map((r) => {
      const id = clean(r[0]);
      const icon = clean(r[4]).split(' ')[0] ?? '';
      return {
        id,
        energy: Number(id[1]),
        mood: Number(id[3]),
        name: clean(r[3]),
        icon,
        meaning: clean(r[5]),
        band: bandOf(r[6] ?? ''),
      };
    });
}

function readTimelines(rows: readonly string[][]): WorkbookTables['timelines'] {
  return rows
    .filter((r) => /^(T[0-6]|TX|TR)$/.test(clean(r[0])))
    .map((r) => ({
      code: clean(r[0]) as TimelineCode,
      label: clean(r[1]),
      definition: clean(r[2]),
    }));
}

function readLightHex(rows: readonly string[][]): WorkbookTables['lightHex'] {
  const out: Partial<Record<Light, string>> = {};
  const names: readonly [string, Light][] = [
    ['green', 'green'],
    ['yellow', 'yellow'],
    ['amber', 'amber'],
    ['red', 'red'],
    ['blue', 'blue'],
  ];
  for (const r of rows) {
    const cell = clean(r[1]).toLowerCase();
    const hex = /#[0-9a-f]{6}/i.exec(cell)?.[0];
    if (!hex) continue;
    for (const [word, light] of names) if (cell.startsWith(word)) out[light] = hex.toUpperCase();
  }
  return out;
}

function readPatternIds(rows: readonly string[][]): ReadonlySet<number> {
  const ids = new Set<number>();
  for (const r of rows) {
    const n = Number(clean(r[0]));
    if (Number.isInteger(n) && n >= 1 && n <= 99) ids.add(n);
  }
  return ids;
}

/** Most common "Because you're X and" phrase per cell in Tab 0 and 0b rationales. */
function readBecause(tables: readonly (readonly string[][])[]): ReadonlyMap<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const rows of tables) {
    for (const r of rows) {
      const cell = clean(r[2]);
      if (!/^E[1-4]M[1-4]$/.test(cell)) continue;
      const rationale = clean(r[22]);
      const match = /Because you(?:'|’)re ([^,.]+?) and /i.exec(rationale);
      if (!match?.[1]) continue;
      const phrase = match[1].trim();
      const perCell = counts.get(cell) ?? new Map<string, number>();
      perCell.set(phrase, (perCell.get(phrase) ?? 0) + 1);
      counts.set(cell, perCell);
    }
  }
  const out = new Map<string, string>();
  for (const [cell, perCell] of counts) {
    const best = [...perCell.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (best) out.set(cell, best[0]);
  }
  return out;
}

export async function readWorkbook(dir: string): Promise<WorkbookTables> {
  const raw = new Map<string, string[][]>();
  for (const file of Object.values(TAB_FILES)) raw.set(file, await readTab(dir, file));
  const get = (file: string): string[][] => raw.get(file) ?? [];
  return {
    cells: readCells(get(TAB_FILES.cells)),
    timelines: readTimelines(get(TAB_FILES.timelines)),
    lightHex: readLightHex(get(TAB_FILES.bands)),
    patternIds: readPatternIds(get(TAB_FILES.patterns)),
    becauseByCell: readBecause([get(TAB_FILES.simplified), get(TAB_FILES.extended)]),
    raw,
  };
}
