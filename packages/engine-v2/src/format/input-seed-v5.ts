import type { RuleRecordDraft, TabKey } from '../ruleset/types.js';
import { cellText } from './catalogue.js';
import { INPUT_SEED } from './input-seed.js';
import type { InputKind } from './inputs.js';

// Rules Engine v5.0's check-in options (docs/engine-v2/V5.md): one row per option of each
// question, from the same workbook rows as the catalogue, so the code is the catalogue value's.
// Group is the plan that can pick it (Tab 9 "What each plan can select"; each tab's Plan column):
// `free`, `prime`, or `always_free`, which no plan, version or test may lock (ENT-13).

/** [code, label, group, maps to, note?], as the v3.3 seed has them. */
type Row = readonly [string, string, string, string, string?];
interface InputSeed {
  readonly input: InputKind;
  readonly source: string;
  readonly rows: readonly Row[];
}
type Slug = (label: string) => string;

const rows = (records: readonly RuleRecordDraft[], tab: TabKey, section?: string) =>
  records.filter(
    (r) =>
      r.tab === tab &&
      r.role === 'rule' &&
      (section === undefined || (r.section ?? '').startsWith(section)),
  );
const text = (r: RuleRecordDraft, header: string): string =>
  cellText(r.columns, header).replace(/\s+/g, ' ').trim();

/**
 * "Free (on screen)" is free, "Prime (under More)" Prime; "Always free" never locks. "Free (under
 * More)" is `more`: any plan picks it, and the app keeps it under More so the screen stays short.
 */
function planOf(plan: string, alwaysFree = false): string {
  if (alwaysFree) return 'always_free';
  if (/^prime|^premium/i.test(plan)) return 'prime';
  return /under more/i.test(plan) ? 'more' : 'free';
}

/** The emotions Tab 9 lists as always free (Tab 2's "Never locked?" says the same). */
const ALWAYS_FREE_EMOTIONS = ['EM03', 'EM04', 'EM07', 'EM12', 'EM15'];

/** Every question's options for a v5.0 rule set. */
export function v5InputSeed(records: readonly RuleRecordDraft[], slug: Slug): InputSeed[] {
  const option =
    (domain: string, label: string, plan: (r: RuleRecordDraft) => string) =>
    (r: RuleRecordDraft): Row => {
      const name = text(r, label);
      return [slug(name), name.replace(/\s*\(type it\)$/, ''), plan(r), `${domain}:${slug(name)}`];
    };
  return [
    {
      input: 'feeling',
      source: 'feelings (Tab 2) · The 20 emotions; Plan, Never locked?',
      rows: rows(records, 'feelings', 'The 20 emotions').map(
        option('family', 'Emotion', (r) =>
          planOf(
            text(r, 'Plan'),
            ALWAYS_FREE_EMOTIONS.includes(r.sourceRef) || /always/i.test(text(r, 'Never locked?')),
          ),
        ),
      ),
    },
    {
      input: 'body',
      source: 'body_senses (Tab 3) · Body tab; Plan',
      rows: rows(records, 'body_senses', 'Body tab').map(
        option('body_sign', 'Body sign', (r) => planOf(text(r, 'Plan'))),
      ),
    },
    {
      input: 'urgent',
      source: "body_senses (Tab 3) · Urgent signs row ('Something feels wrong'), always free",
      rows: rows(records, 'body_senses', 'Urgent signs').map(
        option('urgent_sign', 'Urgent sign (always free)', () => 'always_free'),
      ),
    },
    {
      input: 'sense',
      source: 'body_senses (Tab 3) · Senses tab; Plan',
      rows: rows(records, 'body_senses', 'Senses tab').map(
        option('sensitivity_flag', 'Sense', (r) => planOf(text(r, 'Plan'))),
      ),
    },
    {
      input: 'place',
      source: 'places (Tab 4); Plan',
      rows: rows(records, 'places').map(option('context', 'Place', (r) => planOf(text(r, 'Plan')))),
    },
    {
      input: 'support',
      source: 'devices (Tab 5); free (DV-R)',
      rows: rows(records, 'devices')
        .filter((r) => r.sourceRef.startsWith('DV-'))
        .map(option('support', 'Device or help', () => 'free')),
    },
    {
      input: 'task_kind',
      source: 'time_demand (Tab 10) · Task chips; free (TK-1)',
      rows: rows(records, 'time_demand', 'v5.0 — Task chips').map(
        option('task_chip', 'Chip shown', () => 'free'),
      ),
    },
    {
      input: 'help',
      source: 'help_menu (Tab 7); the Help menu is free (Tab 9)',
      rows: [
        ...rows(records, 'help_menu').filter((r) => /^HC-\d$/.test(r.sourceRef)),
        ...rows(records, 'help_menu', 'More needs'),
      ].map((r): Row => {
        const label = /^HC-/.test(r.sourceRef) ? text(r, 'What the user sees') : r.sourceRef;
        const code = slug(r.sourceRef);
        // I need help now is the safety override: it is never locked.
        return [
          code,
          label,
          code === 'i_need_help_now' ? 'always_free' : 'free',
          `support_card:${code}`,
        ];
      }),
    },
    // Not sure's three pictures (Figma S150): the app turns the energy and comfort taps into an Energy
    // and Mood state itself, by the levels these carry (E-45), so they are published with v5.0 too.
    ...INPUT_SEED.filter((seed) => seed.input.startsWith('not_sure_')),
  ];
}
