import type { Comparison, Condition, Effect } from '../format/types.js';
import type { RowMapping, TabMapping } from './types.js';

// Tab 10 (bands and modifier rules) and Tab 1 (the State Grid), read for the engine (M3).

const is = (fact: string, value: unknown): Comparison => ({
  fact,
  op: 'is',
  value: value as boolean,
});
const eq = (fact: string, value: string): Comparison => ({ fact, op: 'eq', value });
const among = (fact: string, value: readonly string[]): Comparison => ({ fact, op: 'in', value });
const all = (...c: Condition[]): Condition => ({ all: c });
const any = (...c: Condition[]): Condition => ({ any: c });
const set = (kind: string, params: Record<string, unknown> = {}): Effect => ({ kind, ...params });
const finalIs = (band: string): Comparison => eq('band.final', band);
const withDemand = (band: string): Condition => all(finalIs(band), is('demand.present', true));

/** Families EX-1 names, at High or Very High. */
const EX1_FAMILIES = [
  'distress_overwhelm',
  'anxious_fearful',
  'anger_frustration',
  'shame_guilt',
  'sadness_low_mood',
  'grief_loss',
  'rejection_sensitivity_hurt',
  'sensory_overload_building_meltdown_risk',
  'social_hangover_masking_fatigue',
];

/** "A negative experience family" (CX-1): the harder families of Tab 2; the workbook gives no list. */
const NEGATIVE_FAMILIES = [
  ...EX1_FAMILIES,
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

/** A band row: its baseline cells (State stage), its light, and what it requires of the card. */
function bandRow({
  band,
  light,
  cells,
  card = [],
  reason,
  mapping = 'exact',
}: {
  readonly band: string;
  readonly light: string;
  readonly cells: readonly string[];
  readonly card?: readonly { readonly when: Condition; readonly then: readonly Effect[] }[];
  readonly reason: string;
  readonly mapping?: 'exact' | 'interpreted';
}): RowMapping {
  return {
    mapping,
    reason,
    engine: {
      stage: 'capacity_fit',
      rules: [
        { stage: 'state', when: among('state.cell', cells), then: [set('band.set', { to: band })] },
        { when: finalIs(band), then: [set('light.set', { light })] },
        ...card.map((r) => ({ stage: 'orchestration' as const, ...r })),
      ],
    },
  };
}

export const BANDS: TabMapping = {
  rows: {
    Available: bandRow({
      band: 'available',
      light: 'green',
      cells: ['E2M4', 'E3M3', 'E3M4', 'E4M4'],
      reason: 'Baseline cells, Green. "No intervention required" puts no requirement on the card.',
    }),
    Conditional: bandRow({
      band: 'conditional',
      light: 'yellow',
      cells: ['E2M2', 'E2M3', 'E3M1', 'E3M2', 'E4M2', 'E4M3'],
      card: [
        {
          when: withDemand('conditional'),
          then: [set('require', { slot: 'visible', target: { action: 'skip_to_task' } })],
        },
      ],
      reason:
        'Baseline cells (E4M1 is set by its own rule), Yellow, and "Skip to task always visible" when there is a task. "Light or optional intervention first" is left to the patterns, which propose it; a band-level proposal would outrank the feeling.',
      mapping: 'interpreted',
    }),
    Constrained: bandRow({
      band: 'constrained',
      light: 'amber',
      cells: ['E1M3', 'E1M4', 'E2M1'],
      card: [
        {
          when: withDemand('constrained'),
          then: [
            set('forbid', { slot: 'primary', target: { pathway: 'execute' } }),
            set('drivers.keep_only', { drivers: ['routine', 'urgency'] }),
            set('require', { slot: 'visible', target: { action: 'try_anyway' } }),
          ],
        },
      ],
      reason:
        '"Intervention is the forced primary": a task is never the primary. "Demand capped to Routine": only Routine is kept, with Urgency at T0/T1 as pattern 5 and Tab 9 say (ADR 0001 §9). "I\'ll try the task anyway" is never hidden.',
      mapping: 'interpreted',
    }),
    'Very Constrained': bandRow({
      band: 'very_constrained',
      light: 'red',
      cells: ['E1M1', 'E1M2'],
      card: [
        {
          when: finalIs('very_constrained'),
          then: [
            set('forbid', { slot: 'primary', target: { pathway: 'execute' } }),
            set('forbid', { target: { action: 'try_anyway' } }),
            set('drivers.keep_only', { drivers: [] }),
            set('support.show'),
          ],
        },
      ],
      reason:
        '"Intervention forced immediately; demand deferred; Support visible throughout". "Try anyway" is never shown in Red (ADR 0001 §3).',
      mapping: 'interpreted',
    }),
    'Recovery (overlay, not a band)': {
      mapping: 'reference',
      reason:
        'Blue is set by RC-1 and shaped by RC-2 to RC-5. The 45-minute window is a system setting the engine reads as signals.recovery_window_open.',
    },
  },
};

const ex1: Condition = any(
  ...EX1_FAMILIES.map((key) => ({
    fact: 'family.intensity',
    key,
    op: 'gte',
    value: { band: 'high' },
  })),
  { fact: 'sensation.intensity', key: 'pain', op: 'gte', value: { band: 'high' } },
  { fact: 'families', op: 'contains', value: 'shutdown_freeze_numb' },
  { fact: 'sensation.intensity', key: 'shutdown', op: 'present' },
);

export const BAND_RULES: TabMapping = {
  rows: {
    'EX-1': {
      mapping: 'interpreted',
      reason:
        'The trigger as written; "Body PAIN" is the pain sensation group, and "shutdown/freeze" includes the shutdown sensations (frozen, can\'t speak aloud, selective mutism), as the Tab 2 shutdown row reads it (E-50).',
      engine: {
        stage: 'capacity_fit',
        rules: [{ when: ex1, then: [set('band.lower', { steps: 1 })] }],
      },
    },
    'CX-1': {
      mapping: 'interpreted',
      reason:
        '"A negative experience family" has no list in the workbook: read as the harder families of Tab 2. Setting classes come from the Tab 3b rows (classes.add).',
      engine: {
        stage: 'capacity_fit',
        rules: [
          {
            when: all(
              { fact: 'sensitivity.count', op: 'gte', value: 2 },
              {
                fact: 'context.classes',
                op: 'contains_any',
                value: ['public', 'formal', 'observed', 'unfamiliar'],
              },
              any(
                { fact: 'families', op: 'contains_any', value: NEGATIVE_FAMILIES },
                { fact: 'sensation.intensity', key: 'sensory_overload', op: 'present' },
              ),
            ),
            then: [set('band.lower', { steps: 1 })],
          },
        ],
      },
    },
    'CAP-1': {
      mapping: 'exact',
      reason: 'At most two steps down in one check-in; Very Constrained is the lowest band anyway.',
      engine: {
        stage: 'capacity_fit',
        rules: [{ when: null, then: [set('band.limit_drop', { steps: 2 })] }],
      },
    },
    'UP-0': {
      mapping: 'reference',
      reason:
        'Built into the engine: within a check-in only band.set (the baseline) and band.lower change the band; nothing raises it.',
    },
    'DEM-0': {
      mapping: 'reference',
      reason:
        'Built into the engine: no demand or timeline fact is read by a band rule. A publish check can enforce it.',
    },
    E4M1: {
      mapping: 'interpreted',
      reason:
        'Baseline Conditional; one modifier takes it to Constrained. With both EX-1 and CX-1 it stops at Constrained (ADR 0001 §8), read as a floor.',
      engine: {
        stage: 'state',
        rules: [
          {
            when: eq('state.cell', 'E4M1'),
            then: [set('band.set', { to: 'conditional' }), set('band.cap', { to: 'constrained' })],
          },
        ],
      },
    },
    'NS-1': {
      mapping: 'exact',
      reason:
        'No confirmed cell ("Not sure", or skipped on quick entry): Conditional. EX-1 still applies on its own.',
      engine: {
        stage: 'state',
        rules: [
          {
            when: { fact: 'state.cell', op: 'absent' },
            then: [set('band.set', { to: 'conditional' })],
          },
        ],
      },
    },
    'SF-1': {
      mapping: 'exact',
      reason:
        'A selected risk option is the Hopeless chip (family "Immediate risk language"); the free-text flag is safety.risk. Pattern 28 is the support screen.',
      engine: {
        stage: 'safety',
        layer: 'safety',
        rules: [
          {
            when: any(is('safety.risk', true), {
              fact: 'families',
              op: 'contains',
              value: 'immediate_risk_language',
            }),
            then: [set('stop'), set('support.show')],
          },
        ],
      },
    },
    'RC-1': {
      mapping: 'interpreted',
      reason:
        '"Better cell" read as a higher baseline band than the last final band; "intensity down by 2+" on the harder feelings only (ADR 0001 §8); "intervention completed" as the support session being finished.',
      engine: {
        stage: 'feedback',
        rules: [
          {
            when: all(
              is('recheck.present', true),
              among('recheck.previous_light', ['yellow', 'amber', 'red']),
              is('recheck.support_completed', true),
              any(is('recheck.band_improved', true), {
                fact: 'recheck.intensity_change',
                op: 'lte',
                value: -2,
              }),
            ),
            then: [set('light.set', { light: 'blue' })],
          },
        ],
      },
    },
    'RC-2': {
      mapping: 'interpreted',
      reason:
        '"Routine / minimum-viable steps": only Routine is kept and at most 3 steps (Tab 4 T0\'s minimum). "Unless the user chooses them" is the user picking a task themselves, which the engine doesn\'t block.',
      engine: {
        stage: 'orchestration',
        rules: [
          {
            when: is('signals.recovery_window_open', true),
            then: [
              set('drivers.keep_only', { drivers: ['routine'] }),
              set('step_cap.set', { max: 3 }),
            ],
          },
        ],
      },
    },
    'RC-3': {
      mapping: 'exact',
      reason: 'At most one step up per re-check, from the last final band.',
      engine: {
        stage: 'feedback',
        rules: [
          { when: is('recheck.present', true), then: [set('band.limit_rise', { steps: 1 })] },
        ],
      },
    },
    'RC-4': {
      mapping: 'interpreted',
      reason:
        '"Light stays the same (or drops)" as no rise in band. "Offer a different route" is the engine\'s rejected-tools signal; "if Red, Support visible" is the Very Constrained row.',
      engine: {
        stage: 'feedback',
        rules: [
          {
            when: all(
              is('recheck.present', true),
              is('recheck.band_improved', false),
              any(
                { fact: 'recheck.intensity_change', op: 'absent' },
                { fact: 'recheck.intensity_change', op: 'gt', value: -2 },
              ),
            ),
            then: [set('band.limit_rise', { steps: 0 })],
          },
        ],
      },
    },
    'RC-5': {
      mapping: 'interpreted',
      reason:
        '"Blue is NOT shown automatically" after a safety override. The clinical pathway is not defined yet (Clinical Safety): meanwhile "Get support now" stays visible.',
      engine: {
        stage: 'feedback',
        rules: [
          {
            when: is('signals.safety_event_recently', true),
            then: [set('light.never', { light: 'blue' }), set('support.show')],
          },
        ],
      },
    },
    'SF-2': {
      mapping: 'interpreted',
      reason:
        '"Escalates the Support pathway" read as Get support now visible; the reminder itself is the sustained-state job. The two clauses are read as either one.',
      engine: {
        stage: 'capacity_fit',
        rules: [
          {
            when: any(
              { fact: 'signals.days_very_constrained', op: 'gte', value: 7 },
              { fact: 'signals.days_without_improvement', op: 'gte', value: 14 },
            ),
            then: [set('support.show')],
          },
        ],
      },
    },
  },
};

/** Tab 1: the four cells whose lean says "regulate first" get a reset even with no feeling (ADR 0001 §6). */
const leanFirst: RowMapping = {
  mapping: 'interpreted',
  reason:
    'Default lean "Regulate first", used for this cell only (ADR 0001 §6): a reset is proposed even when no feeling is picked.',
  engine: {
    stage: 'orchestration',
    layer: 'band',
    rules: [
      {
        when: { fact: 'families', op: 'empty' },
        then: [set('propose', { slot: 'primary', target: { pathway: 'regulate' } })],
      },
    ],
  },
};

export const STATE_GRID: TabMapping = {
  rows: { E2M1: leanFirst, E3M1: leanFirst, E4M1: leanFirst, E4M2: leanFirst },
  all: {
    mapping: 'reference',
    reason:
      "The cell's band comes from the Tab 10 band rows. Its default lean's NUCRIPCE, Reflect and Meditate hints are not used in the MVP (ADR 0001 §6).",
  },
};
