import type { Condition, Effect } from '../format/types.js';
import type { RowMapping, TabMapping } from './types.js';

// Tab 3b (where the user is) and Tab 3a (sensitivity flags), read for the engine (M3, E-49).
// Context only removes or orders tools; it never changes the pathway or a driver (Tab 3b intro).

const set = (kind: string, params: Record<string, unknown> = {}): Effect => ({ kind, ...params });
const at = (place: string): Condition => ({ fact: 'context.setting', op: 'eq', value: place });
const noHeadphones: Condition = {
  not: { fact: 'context.supports', op: 'contains', value: 'headphones' },
};
const SOUNDS = ['sounds', 'sounds_plus'];

interface Place {
  /** Catalogue code of the Tab 3b row. */
  readonly code: string;
  /** Setting classes (CX-1, MD-4); the workbook implies them but has no column for them (IG-07). */
  readonly classes: readonly string[];
  readonly exclude: readonly string[];
  /** "Sounds (headphones)": Sounds only when headphones are available. */
  readonly soundsWithHeadphonesOnly?: true;
  readonly reason: string;
}

function place(p: Place): RowMapping {
  const effects = [
    ...(p.classes.length ? [set('classes.add', { classes: p.classes })] : []),
    ...(p.exclude.length ? [set('tools.exclude', { tools: p.exclude })] : []),
  ];
  const rules = [
    ...(effects.length ? [{ when: at(p.code), then: effects }] : []),
    ...(p.soundsWithHeadphonesOnly
      ? [
          {
            when: { all: [at(p.code), noHeadphones] },
            then: [set('tools.exclude', { tools: SOUNDS })],
          },
        ]
      : []),
  ];
  if (!rules.length) return { mapping: 'reference', reason: p.reason };
  return { mapping: 'interpreted', reason: p.reason, engine: { stage: 'context', rules } };
}

const CLASSES_NOTE = 'Setting classes read from the row (no class column, IG-07).';

export const CONTEXTS: TabMapping = {
  rows: {
    'Home / private space': place({
      code: 'home_private_space',
      classes: [],
      exclude: [],
      reason:
        'All tools allowed, none excluded, no setting class: nothing for the engine to do here.',
    }),
    Work: place({
      code: 'work',
      classes: ['observed'],
      exclude: ['move', 'movement_plus', 'create'],
      soundsWithHeadphonesOnly: true,
      reason: `"Open-plan common" read as observed. Excludes large Move and visible Create; Sounds only with headphones. ${CLASSES_NOTE}`,
    }),
    'School / study space': place({
      code: 'school_study_space',
      classes: ['observed'],
      exclude: ['move', 'movement_plus'],
      soundsWithHeadphonesOnly: true,
      reason: `A shared study space read as observed. Excludes Move; "loud Sounds" read as Sounds without headphones. ${CLASSES_NOTE}`,
    }),
    'Bus / street / commuting': place({
      code: 'bus_street_commuting',
      classes: ['public'],
      exclude: ['move', 'movement_plus', 'create', 'step_out', 'walking_practice'],
      soundsWithHeadphonesOnly: true,
      reason: `"Anything requiring stopping" read as Step out and walking practice. ${CLASSES_NOTE}`,
    }),
    'Cinema / restaurant / mall / market (public, sensory-heavy)': place({
      code: 'cinema_restaurant_mall_market',
      classes: ['public'],
      exclude: ['move', 'movement_plus', 'create'],
      soundsWithHeadphonesOnly: true,
      reason: `"Sounds (external audio)" excluded: Sounds only with headphones. ${CLASSES_NOTE}`,
    }),
    'Meeting / classroom (formal social setting)': place({
      code: 'meeting_classroom',
      classes: ['formal', 'observed'],
      exclude: ['sounds', 'sounds_plus', 'move', 'movement_plus', 'create'],
      reason: `Sounds, Move and Create excluded as written. ${CLASSES_NOTE}`,
    }),
    'Exam hall': place({
      code: 'exam_hall',
      classes: ['formal', 'observed'],
      exclude: [
        'sounds',
        'sounds_plus',
        'move',
        'movement_plus',
        'create',
        'step_out',
        'attention_games',
        'dump_voice',
      ],
      reason: `"Anything visible" and "cannot leave" read as Step out, games and voice capture too. ${CLASSES_NOTE}`,
    }),
    'Placement ward / clinical setting': place({
      code: 'placement_ward_clinical_setting',
      classes: ['observed'],
      exclude: ['move', 'movement_plus', 'create', 'sounds', 'sounds_plus'],
      reason: `Move, Create and Sounds excluded as written; patient-safety duties are never deferred. ${CLASSES_NOTE}`,
    }),
    'Lab / workshop': place({
      code: 'lab_workshop',
      classes: ['observed'],
      exclude: ['create', 'sounds', 'sounds_plus', 'move', 'movement_plus'],
      reason: `"Check safety rules before suggesting movement" read as no Move; ear defenders, so no Sounds. ${CLASSES_NOTE}`,
    }),
    'Seminar room / tutorial': place({
      code: 'seminar_room_tutorial',
      classes: ['formal', 'observed'],
      exclude: ['sounds', 'sounds_plus', 'move', 'movement_plus', 'create'],
      reason: `As written. ${CLASSES_NOTE}`,
    }),
    "In bed / can't get up": place({
      code: 'in_bed_can_t_get_up',
      classes: [],
      exclude: ['move', 'movement_plus', 'step_out', 'walking_practice'],
      reason:
        '"Anything requiring standing or leaving the room first". A private setting: no class.',
    }),
    'Online meeting, camera on': place({
      code: 'online_meeting_camera_on',
      classes: ['formal', 'observed'],
      exclude: ['move', 'movement_plus', 'create'],
      soundsWithHeadphonesOnly: true,
      reason: `"External Sounds" excluded: Sounds only with headphones. ${CLASSES_NOTE}`,
    }),
    'Home, caring for a child or dependant': place({
      code: 'home_caring_for_a_child_or_dependant',
      classes: ['caring'],
      exclude: ['step_out', 'body_scan', 'sleep_winddown'],
      reason: `"Eyes closed, silence or leaving the room" read as Step out, body scan and sleep wind-down. ${CLASSES_NOTE}`,
    }),
    'Unfamiliar place / travelling (station, airport)': place({
      code: 'unfamiliar_place_travelling',
      classes: ['unfamiliar', 'public'],
      exclude: ['move', 'movement_plus', 'create'],
      soundsWithHeadphonesOnly: true,
      reason: `As written; Sounds with headphones. ${CLASSES_NOTE}`,
    }),
    'Waiting room (GP / hospital / office)': place({
      code: 'waiting_room',
      classes: ['public'],
      exclude: ['move', 'movement_plus', 'create'],
      soundsWithHeadphonesOnly: true,
      reason: `As written; Sounds with headphones. ${CLASSES_NOTE}`,
    }),
    'Social event / party': place({
      code: 'social_event_party',
      classes: ['public'],
      exclude: ['create'],
      soundsWithHeadphonesOnly: true,
      reason: `"Sounds (external)" excluded: Sounds only with headphones. ${CLASSES_NOTE}`,
    }),
    'Gym / outdoors': place({
      code: 'gym_outdoors',
      classes: ['public'],
      exclude: [],
      reason: `No tools excluded; a public place for CX-1 and the public-setting filter. ${CLASSES_NOTE}`,
    }),
    'Prayer room / multi-faith room / quiet room': place({
      code: 'prayer_room_multi_faith_room_quiet_room',
      classes: [],
      exclude: ['move', 'movement_plus'],
      soundsWithHeadphonesOnly: true,
      reason:
        'A protected, bookable room: no class. Large Move excluded; "loud Sounds" read as Sounds without headphones.',
    }),
    'Place of worship / faith or community gathering': place({
      code: 'place_of_worship_faith_or_community_gathering',
      classes: ['public'],
      exclude: ['create', 'move', 'movement_plus', 'reflect_checkout', 'end_of_day'],
      soundsWithHeadphonesOnly: true,
      reason: `"Written Reflect prompts mid-gathering" read as the check-out and end-of-day close. ${CLASSES_NOTE}`,
    }),
    'ALL public, formal, observed or caring settings (applies to the rows above)': {
      mapping: 'interpreted',
      reason:
        'Meditate only silent, eyes-open and 3 minutes or less: longer settles, body scan, walking practice and the recitation player (spoken) are excluded. Written Reflect only when no task is under way; "remind me later" is the Reflect save-for-later (Tab 6c).',
      engine: {
        stage: 'context',
        rules: [
          {
            when: {
              fact: 'context.classes',
              op: 'contains_any',
              value: ['public', 'formal', 'observed', 'caring'],
            },
            then: [
              set('tools.exclude', {
                tools: [
                  'settle_5',
                  'settle_10',
                  'settle_20',
                  'body_scan',
                  'walking_practice',
                  'recitation_player',
                ],
              }),
            ],
          },
          {
            when: {
              all: [
                {
                  fact: 'context.classes',
                  op: 'contains_any',
                  value: ['public', 'formal', 'observed', 'caring'],
                },
                { fact: 'demand.present', op: 'is', value: true },
              ],
            },
            then: [set('tools.exclude', { tools: ['reflect_checkout', 'end_of_day'] })],
          },
        ],
      },
    },
  },
};

const flag = (code: string): Condition => ({
  fact: 'sensitivity.flags',
  op: 'contains',
  value: code,
});
const flagRow = (
  code: string,
  then: readonly Effect[],
  reason: string,
  extra?: Condition,
): RowMapping => ({
  mapping: 'interpreted',
  reason,
  // A flag orders tools inside the chosen pathway; it ranks with the user's own triggers (ADR 0004 §2).
  engine: {
    stage: 'context',
    layer: 'trigger',
    rules: [{ when: extra ? { all: [flag(code), extra] } : flag(code), then }],
  },
});
const withTask: Condition = { fact: 'demand.present', op: 'is', value: true };

export const SENSITIVITY_FLAGS: TabMapping = {
  rows: {
    Sound: flagRow(
      'sound',
      [set('tools.exclude', { tools: SOUNDS })],
      '"Avoid sound-based tools unless headphone-routed". Silent notifications are an app setting.',
      noHeadphones,
    ),
    Noise: flagRow(
      'noise',
      [set('copy.use', { slot: 'visible', key: 'card.prompt.noise_reduction' })],
      '"Recommend headphones / noise reduction before any focus-demanding action": a prompt on the card when there is a task and no headphones.',
      { all: [withTask, noHeadphones] },
    ),
    Lights: flagRow(
      'lights',
      [
        set('tools.exclude', { tools: ['create', 'attention_games', 'movement_plus'] }),
        set('tools.prefer', { tools: ['breathe', 'sounds'] }),
      ],
      '"Avoid screen/video-based tools, prefer audio-only": Create, games and video movement excluded; Breathe and Sounds first. The low-stimulation theme is an app setting.',
    ),
    Crowd: flagRow(
      'crowd',
      [set('tools.prefer', { tools: ['ground', 'breathe', 'async_message'] })],
      '"Prefer private/low-visibility options (Ground, Breathe) over Connect; if Connect, text/async".',
    ),
    Smell: flagRow(
      'smell',
      [set('tools.prefer', { tools: ['step_out'] })],
      '"Prefer Step out / fresh-air options".',
    ),
    Temperature: flagRow(
      'temperature',
      [set('copy.use', { slot: 'visible', key: 'card.prompt.temperature' })],
      '"An interoception prompt (layer, drink, move) before focus work": a prompt on the card when there is a task.',
      withTask,
    ),
    'Touch / texture': flagRow(
      'touch_texture',
      [set('copy.use', { slot: 'visible', key: 'card.prompt.change_seat' })],
      '"Suggest a change of seat or clothing": a prompt on the card. Non-contact grounding is a Ground variant, not a separate tool.',
    ),
    'Visual clutter': flagRow(
      'visual_clutter',
      [set('copy.use', { slot: 'visible', key: 'card.prompt.low_stimulation' })],
      '"Low-stimulation theme; single-task screen; hide non-urgent notifications": app settings, offered as a prompt on the card.',
    ),
  },
};
