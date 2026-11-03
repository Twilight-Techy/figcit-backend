import type { Condition, Effect, EngineRule } from '../format/types.js';
import {
  action,
  all,
  any,
  containsAny,
  eq,
  felt,
  forbid,
  high,
  is,
  lights,
  mapped,
  not,
  path,
  propose,
  rule,
  set,
  tool,
  toolsOf,
} from './dsl.js';
import type { RowMapping, TabMapping } from './types.js';

// Tab 6c (Reflect and Meditate), read for the engine (M3, E-50). Section C gates every Reflect and
// Meditate offer however it arose; section D narrows them by setting, after Tab 3b. Sections A and
// B are the design argument and the definitions: reference.

/**
 * Reflect or Meditate was asked for: the Tab 2 feelings and Tab 6b needs whose rows offer it, or a
 * practice that is due. "Remind me later" and "find a space" only make sense then; the test
 * `reflect-meditate.test.ts` keeps these lists in step with those rows.
 */
export const REFLECT_FAMILIES = [
  'wanting_to_make_sense_of_an_experience',
  'relief_accomplishment_after_something_hard',
  'gratitude_contentment_wanting_to_savour',
];
export const REFLECT_NEEDS = [
  'make_sense_of_today',
  'learn_what_works_for_me',
  'prepare_to_speak_up_for_myself',
  'recover_after_an_event',
  'start_or_end_my_day_well',
];
export const MEDITATE_FAMILIES = [
  'anticipatory_unease_dread',
  'need_for_stillness_inner_quiet',
  'spiritual_faith_need',
  'gratitude_contentment_wanting_to_savour',
  'grief_loss',
  'social_hangover_masking_fatigue',
];
export const MEDITATE_NEEDS = [
  'find_stillness',
  'pray_or_do_my_practice',
  'start_or_end_my_day_well',
  'feel_connected_to_something_bigger',
  'recover_after_an_event',
];
export const REFLECT_ASKED: Condition = any(
  containsAny('families', REFLECT_FAMILIES),
  containsAny('needs', REFLECT_NEEDS),
);
export const MEDITATE_ASKED: Condition = any(
  containsAny('families', MEDITATE_FAMILIES),
  containsAny('needs', MEDITATE_NEEDS),
  is('signals.practice_due', true),
);

const REFLECT_TOOLS = toolsOf('reflect');
const MEDITATE_TOOLS = toolsOf('meditate');
const SPOKEN = ['recitation_player'];
const limit = (modes: string[], extra: { max_minutes?: number; tools?: string[] } = {}): Effect =>
  set('practice.limit', { modes, ...extra });
const remindLater = rule(REFLECT_ASKED, [propose('visible', action('save_for_later'))]);
const at = (...settings: string[]): Condition => ({
  fact: 'context.setting',
  op: 'in',
  value: settings,
});
const ref = (reason: string): RowMapping => ({ mapping: 'reference', reason });

/** A section D row: its rules run once the setting is known (Tab 8 step 5). */
function place(settings: readonly string[], rules: EngineRule[], reason: string) {
  const where = at(...settings);
  return mapped({
    stage: 'context',
    layer: 'offer',
    rules: rules.map((r) => ({ ...r, when: r.when ? all(where, r.when) : where })),
    reason,
  });
}

const DISTRESS_MODERATE: Condition = {
  fact: 'peak.negative',
  op: 'gte',
  value: { band: 'moderate' },
};

const DESIGN: NonNullable<TabMapping['rows']> = {
  'Reflect inside Dump': ref(
    'Design argument: kept separate. "Never the other way round in distress" is RF-1.',
  ),
  'Reflect inside Express': ref('Design argument: kept separate; the hand-off is pattern 35.'),
  'Reflect inside Regulate': ref('Design argument: kept separate; the gate is RF-1 and RF-2.'),
  'Meditate inside Regulate': ref(
    'Design argument: Breathe and Ground stay in Regulate, longer practice in Meditate, as the tool catalogue has them (E-49).',
  ),
  'Rituals inside Adapt': ref(
    'Design argument: Adapt may call a saved ritual (the transition planner); the ritual lives in Meditate.',
  ),
  'Prayer inside Connect': ref(
    'Design argument: Meditate holds the practice; Connect offers the group (the Tab 2 faith row).',
  ),
  Reflect: ref(
    'Definition. "Offered in" is RF-1; formats are the tools (E-49); the length is a tool setting.',
  ),
  'Meditate (Rituals / Prayer)': mapped({
    stage: 'context',
    rules: [
      rule(not(is('prefs.body_scan_opt_in', true)), [
        set('tools.exclude', { tools: ['body_scan'] }),
      ]),
    ],
    reason:
      'Definition, with one rule: "Body scan (opt-in only)", so no body scan unless the user opted in (a saved setting no screen collects yet, IG-21). "Offered in" is MD-1; the length is chosen by the user.',
  }),
};

const GATES: NonNullable<TabMapping['rows']> = {
  'RF-1': mapped({
    stage: 'orchestration',
    layer: 'offer',
    rules: [
      rule(
        any(lights('amber', 'red'), { fact: 'peak.negative', op: 'gte', value: { band: 'high' } }),
        [forbid(path('reflect'))],
      ),
      { ...remindLater, when: all(lights('amber'), REFLECT_ASKED) },
    ],
    reason:
      'No Reflect in Amber or Red, or with a harder feeling at High+. In Amber, "remind me later" where Reflect was asked for (a Reflect feeling or need). Red\'s Dump or Regulate is pattern 40.',
  }),
  'RF-2': mapped({
    stage: 'intervention',
    rules: [
      rule(felt('rumination_replay_loop'), [forbid(path('reflect'))]),
      rule(
        all(is('recheck.present', true), eq('recheck.previous_pathway', 'reflect'), {
          fact: 'recheck.intensity_change',
          op: 'gt',
          value: 0,
        }),
        [forbid(path('reflect'))],
      ),
    ],
    reason:
      'Blocked with rumination present, or when the re-check after Reflect is worse (harder feelings up, ADR 0007 §8). Blocking "that topic for 7 days" and "3+ times in 7 days" need topics, deferred (ADR 0007); until then it holds for this check-in. The route is pattern 40.',
  }),
  'RF-3': ref(
    'How a Reflect session runs (3 prompts, stop any time, no streaks): the tool, not the engine.',
  ),
  'RF-4': ref(
    'Saved reflections are private by default and deletable: the records (M5), not the engine.',
  ),
  'RF-5': ref(
    'Free text and voice pass the safety screen before the engine (Tab 8 step 0, OWNER_DISCUSSION O-03); it arrives as safety.risk (SF-1).',
  ),
  'MD-1': mapped({
    stage: 'orchestration',
    layer: 'offer',
    rules: [
      rule(all(lights('amber'), DISTRESS_MODERATE, MEDITATE_ASKED), [
        forbid(path('meditate'), 'primary'),
        propose('primary', path('regulate')),
        propose('alternative', tool('settle_3')),
        propose('alternative', tool('own_practice')),
        set('tools.exclude', { tools: toolsOf('meditate', ['settle_3', 'own_practice']) }),
        limit(['eyes_open'], { max_minutes: 3, tools: ['settle_3'] }),
      ]),
      rule(lights('red'), [forbid(path('meditate'), 'primary'), set('support.show')]),
    ],
    reason:
      '(a) and (b) restrict nothing. (c) "Amber with distress" read as a harder feeling at Moderate+ (b\'s complement), where Meditate was asked for: Regulate primary, the 3-minute eyes-open settle or the saved practice as alternatives. (d) Red: never the primary, support visible.',
  }),
  'MD-2': mapped({
    stage: 'intervention',
    layer: 'guard',
    rules: [
      rule(
        any(
          felt('shutdown_freeze_numb', 'shutdown'),
          { fact: 'sensation.intensity', key: 'detached', op: 'present' },
          high('sensory_overload_building_meltdown_risk', 'sensory_overload'),
          is('prefs.meditation_worse', true),
        ),
        [
          forbid(path('meditate'), 'primary'),
          set('tools.exclude', { tools: ['body_scan', 'own_practice', ...SPOKEN] }),
          limit(['eyes_open'], { tools: MEDITATE_TOOLS }),
        ],
      ),
      rule({ fact: 'sensation.intensity', key: 'detached', op: 'present' }, [
        propose('primary', path('regulate')),
        set('tools.prefer', { tools: ['breathe', 'ground'] }),
      ]),
    ],
    reason:
      'A guard (pattern 41): Meditate never primary, eyes-open only, no body scan. The saved prayer audio is left off the card so it plays only if the user starts it. "Regulate primary per patterns 16/19": shutdown and sensory overload get theirs from Tab 2 and those patterns; feeling detached, which neither covers, gets Breathe and Ground here. The "makes me feel worse" flag is a saved setting no screen collects yet (IG-21).',
  }),
  'MD-3': ref(
    "Structural: no fact carries profile fields (faith, ethnicity), so no rule can select content by them; the engine proposes tools, and the user's own practice is theirs.",
  ),
  'MD-4': mapped({
    stage: 'context',
    layer: 'offer',
    rules: [
      rule(containsAny('context.classes', ['public', 'formal', 'observed', 'caring']), [
        limit(['silent', 'eyes_open', 'headphones'], { max_minutes: 3, tools: MEDITATE_TOOLS }),
        set('tools.exclude', { tools: ['body_scan', ...SPOKEN] }),
      ]),
      rule(
        all(
          containsAny('context.classes', ['public', 'formal', 'observed', 'caring']),
          MEDITATE_ASKED,
        ),
        [propose('alternative', path('adapt'))],
      ),
    ],
    reason:
      'Silent, eyes-open, headphones, 3 minutes or less; no recitation out loud and no body scan. "Adapt offers to find a space" where Meditate was asked for.',
  }),
  'MD-5': ref(
    'Reminders respect quiet hours and "In worship", and missed practices are never failures: notification behaviour, not the engine.',
  ),
  'MD-6': ref(
    'Structural: "Get support now" is a requirement (support.show) that no proposal can remove, and the safety stop pauses everything. The publish check "Reflect and Meditate never instead of Support" (DESIGN §5) verifies it in M4.',
  ),
};

const SETTINGS: NonNullable<TabMapping['rows']> = {
  'Home / private space': ref('All formats; nothing excluded.'),
  'Work or school (open-plan, library)': place(
    ['work', 'school_study_space'],
    [
      rule(null, [
        limit(['short_chips'], { tools: REFLECT_TOOLS }),
        limit(['silent', 'eyes_open', 'headphones'], { tools: MEDITATE_TOOLS }),
        set('tools.exclude', { tools: ['body_scan', ...SPOKEN] }),
      ]),
      remindLater,
      rule(MEDITATE_ASKED, [propose('alternative', path('adapt'))]),
    ],
    'Reflect as short chips, or "remind me later"; Meditate silent, eyes-open, with headphones; no spoken prayer or body scan. "Suggest the quiet room" is Adapt, offered where Meditate was asked for.',
  ),
  'Public or transit (bus, cafe, station)': place(
    [
      'bus_street_commuting',
      'cinema_restaurant_mall_market',
      'waiting_room',
      'unfamiliar_place_travelling',
      'social_event_party',
    ],
    [
      rule(null, [
        forbid(path('reflect')),
        limit(['eyes_open', 'headphones'], { max_minutes: 3, tools: MEDITATE_TOOLS }),
        set('tools.exclude', { tools: ['body_scan', ...SPOKEN] }),
      ]),
      remindLater,
    ],
    'The public places of Tab 3b (not the gym or a place of worship, which have their own rows). Reflect only as "remind me later"; Meditate eyes-open, headphones, 3 minutes or less.',
  ),
  'Formal / observed (meeting, class, exam, online camera on, clinical placement)': place(
    [
      'meeting_classroom',
      'seminar_room_tutorial',
      'exam_hall',
      'online_meeting_camera_on',
      'placement_ward_clinical_setting',
      'lab_workshop',
    ],
    [
      rule(null, [forbid(path('reflect'))]),
      rule(at('exam_hall', 'placement_ward_clinical_setting'), [forbid(path('meditate'))]),
      rule(all(at('exam_hall', 'placement_ward_clinical_setting'), MEDITATE_ASKED), [
        propose('alternative', tool('breathe')),
      ]),
      rule(not(at('exam_hall', 'placement_ward_clinical_setting')), [
        set('tools.exclude', { tools: toolsOf('meditate', ['settle_3']) }),
        limit(['silent', 'eyes_open'], { max_minutes: 3, tools: ['settle_3'] }),
      ]),
    ],
    'Reflect not offered. Exam hall and clinical duties: no Meditate, Breathe instead. Elsewhere only the 3-minute eyes-open settle; "in a break" is the user\'s timing. The lab counts as a class.',
  ),
  'Caring for a child or dependant': place(
    ['home_caring_for_a_child_or_dependant'],
    [
      rule(null, [
        forbid(path('reflect')),
        limit(['eyes_open'], { tools: MEDITATE_TOOLS }),
        set('tools.exclude', { tools: ['body_scan', 'stillness'] }),
        set('tools.prefer', { tools: ['gratitude_practice', 'settle_3'] }),
      ]),
      remindLater,
    ],
    'Reflect only as "remind me later". Meditate eyes-open, gratitude or a short settle first (they can include the child); "anything needing silence" read as the stillness timer.',
  ),
  'Prayer / multi-faith / quiet room': ref(
    'All formats; nothing excluded. "Adapt can route here at a saved prayer time" is Adapt\'s transition planner.',
  ),
  'Place of worship / community gathering': place(
    ['place_of_worship_faith_or_community_gathering'],
    [
      rule(null, [
        forbid(path('reflect')),
        set('tools.exclude', { tools: toolsOf('meditate', ['own_practice', 'in_worship']) }),
        set('tools.prefer', { tools: ['in_worship'] }),
      ]),
    ],
    'No Reflect during the gathering; only the user\'s own practice, with "In worship" mode first. Muting notifications is that mode, in the app.',
  ),
  'Gym / outdoors': place(
    ['gym_outdoors'],
    [
      rule(null, [
        limit(['short_chips'], { tools: REFLECT_TOOLS }),
        set('tools.prefer', { tools: ['walking_practice', 'stillness'] }),
        limit(['eyes_open'], { tools: ['walking_practice'] }),
      ]),
    ],
    'Reflect as short chips; walking practice and stillness first; eyes open while moving.',
  ),
  "In bed / can't get up": place(
    ['in_bed_can_t_get_up'],
    [
      rule(null, [
        forbid(path('reflect'), 'primary'),
        set('tools.prefer', { tools: ['stillness', 'own_practice'] }),
        set('tools.exclude', { tools: ['walking_practice'] }),
      ]),
    ],
    'Reflect "not first thing" read as never the primary. Lying-down stillness and the saved prayer audio first; nothing needing standing. "Pairs with Recovery" is the Tab 3b row and the rest tool.',
  ),
};

export const REFLECT_MEDITATE: TabMapping = { rows: { ...DESIGN, ...GATES, ...SETTINGS } };
