import type { Condition, Effect } from '../format/types.js';
import type { RowMapping, TabMapping } from './types.js';

// Tab 4 (timeline codes) and Tab 6 (demand characteristics), read for the engine (M3, E-49).
// Timeline never overrides safety or accessibility (Tab 4 footnote): these rules only tag drivers,
// cap steps and shorten sessions; none touches the band.

const set = (kind: string, params: Record<string, unknown> = {}): Effect => ({ kind, ...params });
const due = (code: string): Condition => ({ fact: 'demand.timeline', op: 'eq', value: code });
const urgency = (weight: number): Effect => set('drivers.add', { drivers: ['urgency'], weight });

/** Tab 4's words for the urgency weight, as numbers: maximum 4, high 3, moderate 2, low 1. */
function timeline(
  code: string,
  then: readonly Effect[],
  reason: string,
  mapping: 'exact' | 'interpreted' = 'interpreted',
): RowMapping {
  return {
    mapping,
    reason,
    engine: { stage: 'demand_analysis', rules: [{ when: due(code), then }] },
  };
}

const WEIGHTS =
  'Urgency weights are words in the workbook (IG-16); read as maximum 4, high 3, moderate 2, low 1.';

export const TIMELINES: TabMapping = {
  rows: {
    T0: timeline(
      'T0',
      [urgency(4), set('step_cap.set', { max: 3 }), set('minutes.cap', { max: 2 })],
      `Maximum urgency; breakdown capped at 3 micro-steps; a needed reset is kept, shortened to 2 minutes. ${WEIGHTS}`,
    ),
    T1: {
      mapping: 'interpreted',
      reason: `High urgency; breakdown capped at 5 steps; the body double defaults to the AI one (no lead time to invite a person). ${WEIGHTS}`,
      engine: {
        stage: 'demand_analysis',
        layer: 'task_due',
        rules: [
          {
            when: due('T1'),
            then: [
              urgency(3),
              set('step_cap.set', { max: 5 }),
              set('tools.prefer', { tools: ['ai_body_double'] }),
            ],
          },
        ],
      },
    },
    T2: timeline(
      'T2',
      [urgency(2), set('step_cap.set', { max: null })],
      `Moderate urgency; "fuller breakdown allowed" read as no cap. Inviting a person to body-double is an option inside that tool. ${WEIGHTS}`,
    ),
    T3: timeline(
      'T3',
      [urgency(1)],
      `Low urgency, so Challenge and Exploration rank above it when tagged. ${WEIGHTS}`,
    ),
    T4: timeline(
      'T4',
      [urgency(1)],
      `"Same as T3": low urgency; Routine and Interest rank above it when tagged. ${WEIGHTS}`,
    ),
    T5: timeline(
      'T5',
      [set('drivers.add', { drivers: ['exploration', 'interest'] })],
      'Urgency inactive; "treat as Exploration/Interest-led if the user wants to engage now", so those two are tagged.',
    ),
    T6: {
      mapping: 'reference',
      reason: 'No deadline: no urgency and nothing else to apply; the other drivers decide.',
    },
    TX: {
      mapping: 'interpreted',
      reason:
        'High urgency; the first step is repair: Express a short factual message first, then the smallest remaining step, in words without blame. Ranked with a task due now.',
      engine: {
        stage: 'demand_analysis',
        layer: 'task_due',
        rules: [
          {
            when: due('TX'),
            then: [
              urgency(3),
              set('propose', {
                slot: 'primary',
                target: { pathway: 'express' },
                copy: 'card.overdue.repair',
              }),
              set('propose', { slot: 'queued', target: { tool: 'smallest_step' } }),
              set('copy.use', { slot: 'primary', key: 'card.tone.no_blame' }),
            ],
          },
        ],
      },
    },
    TR: timeline(
      'TR',
      [set('drivers.add', { drivers: ['routine'] })],
      'Adds Routine. Urgency "from the NEXT occurrence" needs the next due time, which no input carries yet (IG-16); until then a recurring task gets no urgency. "Repeatedly skipped → long-avoided" is the system setting that characteristic.',
    ),
  },
};

const has = (code: string): Condition => ({
  fact: 'demand.characteristics',
  op: 'contains',
  value: code,
});
const tags = (
  code: string,
  drivers: readonly string[],
  reason: string,
  mapping: 'exact' | 'interpreted' = 'exact',
): RowMapping => ({
  mapping,
  reason,
  engine: {
    stage: 'drivers',
    rules: [{ when: has(code), then: [set('drivers.add', { drivers })] }],
  },
});
const DEFERRED =
  'Deferred in the MVP (ADR 0004, deferred list): the characteristic is recorded but changes nothing yet.';

export const DEMAND_CHARACTERISTICS: TabMapping = {
  rows: {
    'Unfamiliar / first-time activity': tags(
      'unfamiliar_first_time_activity',
      ['novelty'],
      'Tags Novelty.',
    ),
    'Time-bound with real consequence': tags(
      'time_bound_with_real_consequence',
      ['urgency'],
      'Tags Urgency. "Timeline T0/T1/T2" is part of how the characteristic is detected, upstream of the engine.',
    ),
    'Complex / multi-step / effortful': tags(
      'complex_multi_step_effortful',
      ['challenge'],
      'Tags Challenge.',
    ),
    'Familiar / previously completed / low-decision': tags(
      'familiar_previously_completed_low_decision',
      ['routine'],
      'Tags Routine.',
    ),
    'Matches stated interests/hobbies': tags(
      'matches_stated_interests_hobbies',
      ['interest'],
      'Tags Interest.',
    ),
    'Connected to stated values/goals': tags(
      'connected_to_stated_values_goals',
      ['passion'],
      'Tags Passion.',
    ),
    'Involves other people inherently': tags(
      'involves_other_people_inherently',
      ['collaboration'],
      'Tags Collaboration.',
    ),
    'Requires learning / research / investigation': tags(
      'requires_learning_research_investigation',
      ['exploration'],
      'Tags Exploration.',
    ),
    'Several competing demands': {
      mapping: 'reference',
      reason:
        '"Only the ONE the user picks proceeds": the app takes one task per check-in, and the "Decide what matters now" need runs pattern 22.',
    },
    'Imposed by someone else': { mapping: 'reference', reason: DEFERRED },
    'Long-avoided task': tags(
      'long_avoided_task',
      ['routine'],
      '"Routine or Novelty hook" read as Routine (the familiar way in); the 2-minute start is pattern 17.',
      'interpreted',
    ),
    'Switching / transition': { mapping: 'reference', reason: DEFERRED },
    'Stopping / winding down': { mapping: 'reference', reason: DEFERRED },
    'Asking for help or an adjustment': {
      mapping: 'interpreted',
      reason: 'Tags Collaboration and puts Express (draft, never auto-sent) forward.',
      engine: {
        stage: 'drivers',
        layer: 'trigger',
        rules: [
          {
            when: has('asking_for_help_or_an_adjustment'),
            then: [
              set('drivers.add', { drivers: ['collaboration'] }),
              set('propose', { slot: 'primary', target: { pathway: 'express' } }),
            ],
          },
        ],
      },
    },
    'Recurring personal practice (prayer times, daily ritual, meditation habit)': tags(
      'recurring_personal_practice',
      ['routine'],
      'Tags Routine. "+ Passion if the user marks it as meaningful" and "Urgency from the next occurrence" need inputs that don\'t exist yet (IG-16, IG-21).',
      'interpreted',
    ),
    'Reflective work required by a course or job (reflective log, placement reflection, supervision or appraisal prep, PDP)':
      tags(
        'reflective_work_required_by_a_course_or_job',
        ['challenge', 'routine'],
        'Tags Challenge and Routine; "+ Collaboration if for a supervisor" comes from that characteristic when also set. Urgency comes from the timeline.',
        'interpreted',
      ),
    'Preparing for a significant event (interview, exam, assessment, medical appointment)': tags(
      'preparing_for_a_significant_event',
      ['urgency', 'challenge'],
      'Tags Urgency and Challenge; Novelty and Collaboration come from those characteristics when also set. The supports (Meditate settle, Adapt) are the "Prepare for an event" need.',
      'interpreted',
    ),
  },
};
