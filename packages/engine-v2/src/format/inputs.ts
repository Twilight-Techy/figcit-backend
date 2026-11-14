import { CODE_PATTERN, cellText, valuesOf, type Catalogue, type Issue } from './catalogue.js';
import { DOMAINS, type Domain } from './registry.js';
import type { WorkbookCell } from '../ruleset/types.js';

/**
 * What the check-in asks (DECISION_LOG E-40). Each input is one question in the app; its options
 * are rows of the input mappings table, so the clinical admin can change them without a release.
 */
export const INPUTS = [
  'feeling',
  'sensation',
  'place',
  'social',
  'time',
  'support',
  'sense',
  'life_event',
  'need',
  'task_kind',
  'timeline',
  'not_sure_body',
  'not_sure_energy',
  'not_sure_comfort',
  'body_region',
  // v5.0: body signs, urgent signs ('Something feels wrong') and the Help menu's cards.
  'body',
  'urgent',
  'help',
] as const;
export type InputKind = (typeof INPUTS)[number];

/** The questions Rules Engine v5.0's check-in asks (Tab 13); every one needs options to publish. */
export const V5_INPUTS: readonly InputKind[] = [
  'feeling',
  'body',
  'urgent',
  'sense',
  'place',
  'support',
  'task_kind',
  'help',
];
const V5_ONLY: readonly InputKind[] = ['body', 'urgent', 'help'];

/** The questions a version's check-in asks: v5.0's when its catalogue has the Help menu (Tab 7). */
export function questionsOf(catalogue: Catalogue): readonly InputKind[] {
  return valuesOf(catalogue, 'support_card').length > 0
    ? V5_INPUTS
    : INPUTS.filter((i) => !V5_ONLY.includes(i));
}

/** The input mappings table's columns (an added table, E-19, E-40). */
export const INPUT_MAPPINGS_HEADER = [
  'Input',
  'Code',
  'Label',
  'Group',
  'Order',
  'Maps to',
  'Source',
  'Note',
] as const;

/**
 * What an option means for the engine: a catalogue value (`family:anxious_fearful`), an axis of
 * the State Grid (`energy:2`, `mood:3`, for the Not-sure pictures), or nothing (information only).
 */
export type MapsTo =
  | { readonly domain: Domain; readonly code: string }
  | { readonly axis: 'energy' | 'mood'; readonly level: number }
  | null;

export interface InputOption {
  readonly code: string;
  readonly label: string;
  readonly group: string | null;
  readonly order: number | null;
  readonly mapsTo: MapsTo;
}

export type InputOptions = Readonly<Record<InputKind, readonly InputOption[]>>;

const isInput = (v: string): v is InputKind => (INPUTS as readonly string[]).includes(v);
const isDomain = (v: string): v is Domain => (DOMAINS as readonly string[]).includes(v);
const AXIS = /^(energy|mood):([1-4])$/;
const VALUE = /^([a-z_]+):([A-Za-z0-9_]{1,48})$/;

/** Reads `Maps to`; returns an issue message when it can't. */
export function parseMapsTo(text: string): MapsTo | string {
  if (text === '') return null;
  const axis = AXIS.exec(text);
  if (axis) return { axis: axis[1] as 'energy' | 'mood', level: Number(axis[2]) };
  const value = VALUE.exec(text);
  if (!value || !isDomain(value[1] ?? ''))
    return `"${text}" is not a domain:code, energy:1-4 or mood:1-4`;
  return { domain: value[1] as Domain, code: value[2] ?? '' };
}

/** Checks one input mappings row on its own (the catalogue check is `inputOptionsOf`). */
export function readInputRow(
  columns: readonly WorkbookCell[],
  at = '',
): { input: InputKind; option: InputOption } | { issues: Issue[] } {
  const issues: Issue[] = [];
  const input = cellText(columns, 'Input');
  const code = cellText(columns, 'Code');
  const label = cellText(columns, 'Label');
  const orderText = cellText(columns, 'Order');
  if (!isInput(input)) issues.push({ path: `${at}/Input`, message: `unknown input "${input}"` });
  if (!CODE_PATTERN.test(code))
    issues.push({ path: `${at}/Code`, message: 'use 1-48 letters, digits or _' });
  if (label === '') issues.push({ path: `${at}/Label`, message: 'a label is needed' });
  if (orderText !== '' && !/^\d+$/.test(orderText))
    issues.push({ path: `${at}/Order`, message: `"${orderText}" is not a whole number` });
  const mapsTo = parseMapsTo(cellText(columns, 'Maps to'));
  if (typeof mapsTo === 'string') issues.push({ path: `${at}/Maps to`, message: mapsTo });
  if (issues.length > 0 || !isInput(input) || typeof mapsTo === 'string') return { issues };
  const group = cellText(columns, 'Group');
  return {
    input,
    option: {
      code,
      label,
      group: group === '' ? null : group,
      order: orderText === '' ? null : Number(orderText),
      mapsTo,
    },
  };
}

export interface InputRow {
  readonly tab: string;
  readonly status: string;
  readonly frame: number | null;
  readonly columns: readonly WorkbookCell[];
}

/**
 * The check-in's options from a version's rows, each checked against its catalogue: an option that
 * maps to a value the catalogue doesn't have is reported and left out. O(n log n).
 */
export function inputOptionsOf(
  rows: readonly InputRow[],
  catalogue: Catalogue,
): { options: InputOptions; issues: Issue[] } {
  const issues: Issue[] = [];
  const byInput = new Map<InputKind, { option: InputOption; at: number }[]>();
  rows.forEach((row, at) => {
    if (row.tab !== 'input_mappings' || row.status !== 'active' || row.frame === null) return;
    const path = `/input_mappings/${String(at)}`;
    const read = readInputRow(row.columns, path);
    if ('issues' in read) {
      issues.push(...read.issues);
      return;
    }
    const { mapsTo } = read.option;
    if (
      mapsTo &&
      'domain' in mapsTo &&
      !valuesOf(catalogue, mapsTo.domain).some((v) => v.code === mapsTo.code)
    ) {
      issues.push({
        path: `${path}/Maps to`,
        message: `"${mapsTo.domain}:${mapsTo.code}" is not in the catalogue`,
      });
      return;
    }
    const list = byInput.get(read.input) ?? [];
    if (list.some((o) => o.option.code === read.option.code)) {
      issues.push({
        path: `${path}/Code`,
        message: `"${read.option.code}" is already an option of ${read.input}`,
      });
      return;
    }
    list.push({ option: read.option, at });
    byInput.set(read.input, list);
  });
  const options = Object.fromEntries(
    INPUTS.map((input) => {
      const list = byInput.get(input) ?? [];
      list.sort(
        (a, b) =>
          (a.option.order !== null && b.option.order !== null
            ? a.option.order - b.option.order
            : 0) || a.at - b.at,
      );
      return [input, list.map((o) => o.option)];
    }),
  ) as Record<InputKind, InputOption[]>;
  return { options, issues };
}
