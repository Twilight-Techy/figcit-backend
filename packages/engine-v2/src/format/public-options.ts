import type { WorkbookCell } from '../ruleset/types.js';
import { catalogueOf, cellText, type Catalogue, type Issue } from './catalogue.js';
import {
  inputOptionsOf,
  INPUTS,
  type InputKind,
  type InputOption,
  type InputOptions,
} from './inputs.js';

/** One option as the app sees it. Where it maps to stays on the server (O-16). */
export interface PublicOption {
  readonly code: string;
  readonly label: string;
  readonly group: string | null;
  /** Choosing it means immediate risk: the app offers support at once (E-43). */
  readonly risk?: true;
  /** A need that doesn't work without a task (Tab 6b): the task step is required (E-45). */
  readonly needsTask?: true;
  /** A Not-sure picture's level on the State Grid axis (energy or mood, 1-4), for the suggestion. */
  readonly level?: number;
  /** A sensation whose strength a rule reads: the app asks how strong it is, per kind. */
  readonly asksStrength?: StrengthKind;
}

type StrengthKind = 'pain' | 'overstimulation';

export interface PublicCell {
  readonly id: string;
  readonly energy: number;
  readonly mood: number;
  readonly name: string;
  readonly icon: string;
  readonly meaning: string;
  readonly band: string;
}

/** Everything the check-in screens offer (E-40), without version or hash. */
export interface CheckInOptionsView {
  readonly inputs: Readonly<Record<InputKind, readonly PublicOption[]>>;
  readonly intensityBands: readonly {
    readonly code: string;
    readonly label: string;
    readonly from: number | null;
    readonly to: number | null;
  }[];
  readonly cells: readonly PublicCell[];
}

export interface OptionsRow {
  readonly tab: string;
  readonly role: string;
  readonly status: string;
  readonly frame: number | null;
  readonly columns: readonly WorkbookCell[];
}

const CELL = /^E([1-4])M([1-4])$/;

/** The sensation groups whose number a rule compares against a threshold, as the app names them. */
const STRENGTH_KINDS: Readonly<Record<string, StrengthKind>> = {
  pain: 'pain',
  sensory_overload: 'overstimulation',
};

function strengthKind(input: InputKind, o: InputOption): StrengthKind | undefined {
  const to = o.mapsTo && 'domain' in o.mapsTo ? o.mapsTo : null;
  return input === 'sensation' && to?.domain === 'sensation_group'
    ? STRENGTH_KINDS[to.code]
    : undefined;
}

function publicOption(input: InputKind, o: InputOption, catalogue: Catalogue): PublicOption {
  const to = o.mapsTo && 'domain' in o.mapsTo ? o.mapsTo : null;
  const risk =
    input === 'feeling' && to?.domain === 'family' && to.code === 'immediate_risk_language';
  const needsTask =
    to?.domain === 'need' &&
    (catalogue.get('need') ?? []).some((v) => v.code === to.code && v.group === 'task_needed');
  const asksStrength = strengthKind(input, o);
  return {
    code: o.code,
    label: o.label,
    group: o.group,
    ...(risk ? { risk: true as const } : {}),
    ...(needsTask ? { needsTask: true as const } : {}),
    ...(o.mapsTo && 'axis' in o.mapsTo ? { level: o.mapsTo.level } : {}),
    ...(asksStrength ? { asksStrength } : {}),
  };
}

function cellOf(columns: readonly WorkbookCell[]): PublicCell | null {
  const id = cellText(columns, 'Cell ID');
  const m = CELL.exec(id);
  if (!m) return null;
  return {
    id,
    energy: Number(m[1]),
    mood: Number(m[2]),
    name: cellText(columns, 'Name'),
    // The workbook writes the emoji then its description ("✨ Sparkles"); the app shows the emoji.
    icon: cellText(columns, 'Icon').split(/\s+/)[0] ?? '',
    meaning: cellText(columns, 'Plain-language meaning (layman, no jargon)'),
    band: cellText(columns, 'Capacity band'),
  };
}

/**
 * The check-in options of a version's rows: the app's view (labels, groups and the flags it
 * needs), plus the server's (what each option maps to) and any problems found. O(n log n).
 */
export function checkInOptionsOf(rows: readonly OptionsRow[]): {
  view: CheckInOptionsView;
  options: InputOptions;
  catalogue: Catalogue;
  issues: Issue[];
} {
  const { catalogue } = catalogueOf(rows);
  const { options, issues } = inputOptionsOf(rows, catalogue);
  const inputs = Object.fromEntries(
    INPUTS.map((input) => [input, options[input].map((o) => publicOption(input, o, catalogue))]),
  ) as Record<InputKind, PublicOption[]>;
  const cells = rows
    .filter((r) => r.tab === 'state_grid' && r.role === 'rule' && r.status === 'active')
    .map((r) => cellOf(r.columns))
    .filter((c): c is PublicCell => c !== null);
  const intensityBands = (catalogue.get('intensity_band') ?? []).map((b) => ({
    code: b.code,
    label: b.label,
    from: b.from,
    to: b.to,
  }));
  return { view: { inputs, intensityBands, cells }, options, catalogue, issues };
}
