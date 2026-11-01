import { fromDraft, type RulesetRecord } from '../ruleset/store.js';
import type { ReadResult, RuleRecordDraft, TableFrame, TabKey } from '../ruleset/types.js';
import { CATALOGUE_HEADER, cellText, type CatalogueColumn } from './catalogue.js';
import { COPY_FILE, COPY_HEADER, copySeedRows } from './copy.js';
import { INPUT_SEED } from './input-seed.js';
import { SUPPORT_SEED, TOOL_SEED } from './tool-seed.js';
import { INPUT_MAPPINGS_HEADER } from './inputs.js';
import type { Domain } from './registry.js';

export const CATALOGUE_FILE = 'x-catalogue.csv';
export const INPUT_MAPPINGS_FILE = 'x-input-mappings.csv';

type SeedCells = Partial<Record<CatalogueColumn, string>>;
interface SeedRow {
  readonly domain: Domain;
  readonly cells: SeedCells;
  readonly mapping: 'exact' | 'interpreted';
}

/** A stable code from a label: lower case, words joined by `_`, brackets and quotes dropped. */
export function slug(label: string): string {
  const words = label
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w !== '');
  let out = '';
  for (const word of words) {
    const next = out === '' ? word : `${out}_${word}`;
    if (next.length > 48) break;
    out = next;
  }
  return out === '' ? 'value' : out;
}

const rowsOf = (records: readonly RuleRecordDraft[], tab: TabKey): RuleRecordDraft[] =>
  records.filter((r) => r.tab === tab && r.role === 'rule' && r.frame !== null);
const firstCell = (r: RuleRecordDraft): string =>
  (r.columns.find((c) => c.col === 0)?.text ?? '').replace(/\s+/g, ' ').trim();
const source = (r: RuleRecordDraft): string => `${r.tab} · ${r.sourceRef}`;

function simple(domain: Domain, records: readonly RuleRecordDraft[], tab: TabKey): SeedRow[] {
  return rowsOf(records, tab).map((r) => ({
    domain,
    mapping: 'exact',
    cells: { Code: slug(r.sourceRef), Label: r.sourceRef, Source: source(r) },
  }));
}

function bandsAndLights(records: readonly RuleRecordDraft[]): SeedRow[] {
  const out: SeedRow[] = [];
  for (const r of rowsOf(records, 'bands')) {
    const light = cellText(r.columns, 'Traffic light (muted hex)').split(/\s+/)[0] ?? '';
    if (!r.sourceRef.startsWith('Recovery'))
      out.push({
        domain: 'band',
        mapping: 'exact',
        cells: {
          Code: slug(r.sourceRef),
          Label: r.sourceRef,
          Order: cellText(r.columns, 'Order'),
          Source: source(r),
        },
      });
    if (light !== '')
      out.push({
        domain: 'light',
        mapping: 'exact',
        cells: { Code: slug(light), Label: light, Group: slug(r.sourceRef), Source: source(r) },
      });
  }
  return out;
}

const INTENSITY = /Mild=(\d+)-(\d+), Moderate=(\d+)-(\d+), High=(\d+)-(\d+), Very High=(\d+)-(\d+)/;

function intensityBands(records: readonly RuleRecordDraft[], notes: string[]): SeedRow[] {
  const note = records.find(
    (r) => r.tab === 'experience_triggers' && INTENSITY.test(r.columns[0]?.text ?? ''),
  );
  const m = INTENSITY.exec(note?.columns[0]?.text ?? '');
  if (!note || !m) {
    notes.push(
      'intensity_band: the Tab 2 note with the Mild/Moderate/High/Very High ranges was not found',
    );
    return [];
  }
  const labels = ['Mild', 'Moderate', 'High', 'Very High'];
  return labels.map((label, i) => ({
    domain: 'intensity_band',
    mapping: 'exact',
    cells: {
      Code: slug(label),
      Label: label,
      Order: String(i),
      From: m[i * 2 + 1] ?? '',
      To: m[i * 2 + 2] ?? '',
      Source: source(note),
    },
  }));
}

/**
 * The harder (negative) families: CX-1's "a negative experience family", which the workbook doesn't
 * list (E-48). Stored as the family's Group, so the engine's `peak.negative` and CX-1 read one list
 * that the clinical admin can change (E-51).
 */
export const HARDER_FAMILIES: readonly string[] = [
  'distress_overwhelm',
  'anxious_fearful',
  'anger_frustration',
  'shame_guilt',
  'sadness_low_mood',
  'grief_loss',
  'rejection_sensitivity_hurt',
  'sensory_overload_building_meltdown_risk',
  'social_hangover_masking_fatigue',
  'racing_disorganised_thoughts',
  'loneliness_isolation',
  'shutdown_freeze_numb',
  'task_paralysis_can_t_start',
  'confusion_decision_paralysis',
  'anticipatory_unease_dread',
  'rumination_replay_loop',
  'pain_illness_flare',
  'immediate_risk_language',
];

function families(records: readonly RuleRecordDraft[]): SeedRow[] {
  const seen = new Set<string>();
  const out: SeedRow[] = [];
  for (const r of rowsOf(records, 'experience_triggers')) {
    const name = firstCell(r);
    if (seen.has(name)) continue;
    seen.add(name);
    const code = slug(name);
    const harder = HARDER_FAMILIES.includes(code);
    out.push({
      domain: 'family',
      mapping: harder ? 'interpreted' : 'exact',
      cells: {
        Code: code,
        Label: name,
        Source: source(r),
        ...(harder
          ? { Group: 'harder', Note: 'Group: a harder family, read from CX-1 (E-48, E-51)' }
          : {}),
      },
    });
  }
  return out;
}

function contexts(records: readonly RuleRecordDraft[], notes: string[]): SeedRow[] {
  return simple('context', records, 'contexts').filter((row) => {
    const keep = !(row.cells.Label ?? '').startsWith('ALL ');
    if (!keep)
      notes.push(
        `context: "${row.cells.Label ?? ''}" is a rule about settings, not a setting; left out`,
      );
    return keep;
  });
}

function drivers(records: readonly RuleRecordDraft[]): SeedRow[] {
  return rowsOf(records, 'drivers').map((r) => {
    const [letter = '', name = r.sourceRef] = r.sourceRef.split(/\s+—\s+/);
    return {
      domain: 'driver',
      mapping: 'exact',
      cells: { Code: slug(name), Label: name.trim(), Group: letter, Source: source(r) },
    };
  });
}

/** Tools per pathway from Tab 6d section A's prose (E-49): `interpreted`, each naming its row. */
function tools(records: readonly RuleRecordDraft[]): SeedRow[] {
  const rows = rowsOf(records, 'tools_tiers').filter((r) => r.section?.startsWith('A.') ?? false);
  return TOOL_SEED.map(([code, label, pathway]) => {
    const row = rows.find((r) => slug(r.sourceRef.split(' · ')[0] ?? '') === pathway);
    return {
      domain: 'tool',
      mapping: 'interpreted',
      cells: {
        Code: code,
        Label: label,
        Group: pathway,
        Source: row ? source(row) : 'tools_tiers · A.',
        Note: 'Named from the prose; code added (E-49)',
      },
    };
  });
}

/** Groups the sensation-led rules read (E-40); filled from the text, so `interpreted`. */
const SENSATION_GROUPS = [
  'pain',
  'shutdown',
  'detached',
  'racing',
  'word_finding',
  'restless',
  'hyperfocus',
  'interoception_unmet',
  'sensory_overload',
] as const;

/** Needs, with Group `task_needed` where Tab 6b says the need doesn't work without a task. */
function needs(records: readonly RuleRecordDraft[]): SeedRow[] {
  return rowsOf(records, 'needs').map((r) => ({
    domain: 'need',
    mapping: 'exact',
    cells: {
      Code: slug(r.sourceRef),
      Label: r.sourceRef,
      Group: cellText(r.columns, 'Works with no task?').toLowerCase() === 'no' ? 'task_needed' : '',
      Source: source(r),
    },
  }));
}

function pathways(records: readonly RuleRecordDraft[]): SeedRow[] {
  return rowsOf(records, 'tools_tiers')
    .filter((r) => r.section?.startsWith('A.') ?? false)
    .map((r) => ({
      domain: 'pathway',
      mapping: 'exact',
      cells: {
        Code: slug(r.sourceRef.split(' · ')[0] ?? r.sourceRef),
        Label: r.sourceRef,
        Source: source(r),
      },
    }));
}

function asIs(
  domain: Domain,
  records: readonly RuleRecordDraft[],
  tab: TabKey,
  label: string,
): SeedRow[] {
  return rowsOf(records, tab).map((r) => {
    const extra = cellText(r.columns, label);
    return {
      domain,
      mapping: 'exact',
      cells: {
        Code: r.sourceRef,
        Label: extra === '' ? r.sourceRef : `${r.sourceRef} · ${extra}`.slice(0, 160),
        Source: source(r),
      },
    };
  });
}

function interpreted(domain: Domain, codes: readonly string[], from: string): SeedRow[] {
  return codes.map((code) => ({
    domain,
    mapping: 'interpreted',
    cells: {
      Code: code,
      Label: code.charAt(0).toUpperCase() + code.slice(1).replaceAll('_', ' '),
      Source: from,
      Note: 'Read from the text; confirm (E-19)',
    },
  }));
}

/** Every catalogue row the workbook gives, in domain order; codes made unique within a domain. */
function seedRows(records: readonly RuleRecordDraft[], notes: string[]): SeedRow[] {
  const rows = [
    ...asIs('cell', records, 'state_grid', 'Name'),
    ...bandsAndLights(records),
    ...families(records),
    ...intensityBands(records, notes),
    ...simple('sensitivity_flag', records, 'sensitivity_flags'),
    ...contexts(records, notes),
    ...interpreted(
      'setting_class',
      ['public', 'formal', 'observed', 'unfamiliar', 'caring'],
      'band_rules · CX-1; contexts · ALL public, formal, observed or caring settings',
    ),
    ...asIs('timeline', records, 'timelines', 'User-facing label'),
    ...drivers(records),
    ...simple('demand_characteristic', records, 'demand_characteristics'),
    ...needs(records),
    ...interpreted(
      'sensation_group',
      SENSATION_GROUPS,
      'experience_triggers (sensation-led rows); reflect_meditate · MD-2; PRD FR-M03-02',
    ),
    ...pathways(records),
    ...asIs('pattern', records, 'patterns', 'Capacity band + trigger pattern'),
    ...tools(records),
    ...SUPPORT_SEED.map(([code, label]): SeedRow => ({
      domain: 'support',
      mapping: 'interpreted',
      cells: {
        Code: code,
        Label: label,
        Source: 'Figma S10 (291:146); Tabs 3a, 3b, 6c (headphones)',
        Note: 'Confirm (IG-10)',
      },
    })),
    ...interpreted(
      'practice_mode',
      ['eyes_open', 'silent', 'headphones', 'short_chips'],
      'reflect_meditate · MD-2, MD-4 and D. (eyes-open, silent, headphones, short chips)',
    ),
    ...interpreted(
      'tier',
      ['advanced', 'floor'],
      'tools_tiers · A. (Advanced tools column; Safety floor column)',
    ),
    ...interpreted(
      'plan',
      ['free', 'plus', 'institution'],
      'tools_tiers · A. heading (NUCCESS Plus or institution licence)',
    ),
  ];
  const used = new Map<string, number>();
  return rows.map((row) => {
    const key = `${row.domain}|${row.cells.Code ?? ''}`;
    const n = (used.get(key) ?? 0) + 1;
    used.set(key, n);
    if (n === 1) return row;
    const code = `${row.cells.Code ?? ''}_${String(n)}`;
    notes.push(`${row.domain}: code "${row.cells.Code ?? ''}" repeated; the next one is "${code}"`);
    return { ...row, cells: { ...row.cells, Code: code } };
  });
}

const frameOf = (header: readonly string[]): TableFrame => ({ header: [...header], banner: [] });

/** The check-in options as first filled (E-40), as records without an order yet. */
function inputSeedRows(): Omit<RulesetRecord, 'order'>[] {
  return INPUT_SEED.flatMap((seed) =>
    seed.rows.map(([code, label, group, mapsTo, note = ''], i) => {
      const cells: Record<string, string> = {
        Input: seed.input,
        Code: code,
        Label: label,
        Group: group,
        Order: String(i + 1),
        'Maps to': mapsTo,
        Source: seed.source,
        Note: note,
      };
      return {
        tab: 'input_mappings' as const,
        role: 'rule' as const,
        section: null,
        sourceRef: `${seed.input} · ${code}`,
        columns: INPUT_MAPPINGS_HEADER.map((header, col) => ({
          header,
          text: cells[header] ?? '',
          col,
        })),
        origin: { file: INPUT_MAPPINGS_FILE, sheetRow: 0, range: '' },
        frame: 0,
        engine: null,
        mapping: 'interpreted' as const,
        status: 'active' as const,
        // The Hopeless chip carries the safety override (E-43): changing it is a safety change.
        safety: mapsTo === 'family:immediate_risk_language',
        workbookTag: null,
      };
    }),
  );
}

/** What `withAdditions` adds to an import. */
export interface AdditionsReport {
  readonly catalogue: number;
  /** Check-in options filled from Figma (E-40). */
  readonly inputs: number;
  /** Wording keys filled from the workbook (E-53). */
  readonly copy: number;
  readonly catalogueGiven: boolean;
  readonly inputMappingsGiven: boolean;
  readonly copyGiven: boolean;
  readonly notes: readonly string[];
}

/**
 * The rule set as imported: the workbook's rows plus the added tables (DESIGN §3.4). When the
 * upload carries the added tables (a re-import of an export) they are kept as given; otherwise the
 * catalogue is filled from the workbook and the input mappings table starts empty (E-19, M3).
 */
export function withAdditions(read: ReadResult): {
  records: RulesetRecord[];
  frames: Record<string, readonly TableFrame[]>;
  additions: AdditionsReport;
} {
  const records = read.records.map(fromDraft);
  const frames: Record<string, readonly TableFrame[]> = { ...read.frames };
  const notes: string[] = [];
  const catalogueGiven = CATALOGUE_FILE in read.frames;
  const inputMappingsGiven = INPUT_MAPPINGS_FILE in read.frames;
  let order = Math.max(0, ...records.map((r) => r.order));
  let seeded = 0;
  if (!catalogueGiven) {
    frames[CATALOGUE_FILE] = [frameOf(CATALOGUE_HEADER)];
    for (const row of seedRows(read.records, notes)) {
      order += 1;
      seeded += 1;
      const cells = { ...row.cells, Domain: row.domain };
      records.push({
        tab: 'catalogue',
        role: 'rule',
        section: null,
        sourceRef: `${row.domain} · ${cells.Code ?? ''}`,
        order,
        columns: CATALOGUE_HEADER.map((header, col) => ({
          header,
          text: cells[header] ?? '',
          col,
        })),
        origin: { file: CATALOGUE_FILE, sheetRow: 0, range: '' },
        frame: 0,
        engine: null,
        mapping: row.mapping,
        status: 'active',
        safety: false,
        workbookTag: null,
      });
    }
  }
  let inputs = 0;
  if (!inputMappingsGiven) {
    frames[INPUT_MAPPINGS_FILE] = [frameOf(INPUT_MAPPINGS_HEADER)];
    for (const row of inputSeedRows()) {
      order += 1;
      inputs += 1;
      records.push({ ...row, order });
    }
  }
  let copy = 0;
  const copyGiven = COPY_FILE in read.frames;
  if (!copyGiven) {
    frames[COPY_FILE] = [frameOf(COPY_HEADER)];
    for (const row of copySeedRows()) {
      order += 1;
      copy += 1;
      records.push({ ...row, order });
    }
  }
  return {
    records,
    frames,
    additions: {
      catalogue: seeded,
      inputs,
      copy,
      catalogueGiven,
      inputMappingsGiven,
      copyGiven,
      notes,
    },
  };
}
