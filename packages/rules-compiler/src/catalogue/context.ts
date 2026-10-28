// Context catalogue (S10, S152; workbook Tabs 3a, 3b and 6c section D). DECISIONS B-07.
import type { SettingClass, SnapshotEnvironment, SnapshotOption } from '@figcit/engine';

/** Tools each setting class removes (Tab 3b "Tools excluded", 6c section D "Excluded"). */
export const SETTING_EXCLUSIONS: Readonly<Record<SettingClass, readonly string[]>> = {
  private: [],
  in_bed: ['move', 'step_out', 'movement_plus', 'walking_practice'],
  work_school: ['move', 'create', 'movement_plus'],
  observed: ['move', 'create', 'movement_plus', 'body_scan'],
  formal: [
    'move',
    'create',
    'sounds',
    'sounds_plus',
    'movement_plus',
    'step_out',
    'body_scan',
    'walking_practice',
    'dump_voice',
    'reflect_checkout',
  ],
  exam: [
    'move',
    'create',
    'sounds',
    'sounds_plus',
    'movement_plus',
    'step_out',
    'body_scan',
    'walking_practice',
    'dump_voice',
    'dump_text',
    'reflect_checkout',
    'stillness',
    'settle_3',
    'settle_5',
    'settle_10',
    'settle_20',
    'trusted_contact',
    'quick_message',
  ],
  clinical: [
    'move',
    'create',
    'sounds',
    'sounds_plus',
    'movement_plus',
    'body_scan',
    'walking_practice',
    'reflect_checkout',
    'stillness',
    'settle_5',
    'settle_10',
    'settle_20',
  ],
  public: ['move', 'create', 'movement_plus', 'body_scan', 'walking_practice'],
  transit: ['move', 'create', 'movement_plus', 'body_scan', 'walking_practice', 'step_out'],
  unfamiliar: ['move', 'create', 'movement_plus', 'body_scan'],
  caring: ['body_scan', 'step_out', 'sleep_winddown'],
  prayer_room: ['move', 'movement_plus'],
  worship: [
    'sounds',
    'sounds_plus',
    'create',
    'move',
    'movement_plus',
    'reflect_checkout',
    'end_of_day',
  ],
  outdoors: [],
  social_event: ['sounds', 'sounds_plus', 'create'],
};

const env = (
  code: string,
  label: string,
  settingClass: SettingClass,
  common = false,
): SnapshotEnvironment => ({
  code,
  label,
  settingClass,
  common,
  excludeTools: SETTING_EXCLUSIONS[settingClass],
});

// The first eleven are the S10 chips; the rest sit under "More places" (Tab 3b rows).
export const ENVIRONMENTS: readonly SnapshotEnvironment[] = [
  env('home', 'Home', 'private', true),
  env('school', 'School', 'work_school', true),
  env('work', 'Work', 'work_school', true),
  env('public', 'Public', 'public', true),
  env('transit', 'Transit', 'transit', true),
  env('restaurant', 'Restaurant', 'public', true),
  env('mall', 'Mall', 'public', true),
  env('station', 'Bus / train station', 'unfamiliar', true),
  env('worship', 'Place of worship', 'worship', true),
  env('prayer_room', 'Prayer or quiet room', 'prayer_room', true),
  env('in_bed', "In bed / can't get up", 'in_bed', true),
  env('open_plan', 'Open-plan office', 'observed'),
  env('library', 'Library / study space', 'work_school'),
  env('lab', 'Lab / workshop', 'work_school'),
  env('lecture', 'Lecture hall', 'public'),
  env('seminar', 'Seminar room / tutorial', 'formal'),
  env('meeting', 'Meeting room', 'formal'),
  env('online_meeting', 'Online meeting, camera on', 'formal'),
  env('exam_hall', 'Exam hall', 'exam'),
  env('clinical', 'Placement ward / clinical setting', 'clinical'),
  env('caring', 'Caring for a child or someone', 'caring'),
  env('travelling', 'Unfamiliar place / travelling', 'unfamiliar'),
  env('waiting_room', 'Waiting room', 'public'),
  env('social_event', 'Social event / party', 'social_event'),
  env('cafe', 'Café', 'public'),
  env('gym_outdoors', 'Gym / outdoors', 'outdoors'),
  env('somewhere_else', 'Somewhere else', 'private'),
];

export const SOCIALS: readonly (SnapshotOption & {
  readonly observed: boolean;
  readonly othersPresent: boolean;
})[] = [
  { code: 'alone', label: 'Alone', observed: false, othersPresent: false },
  { code: 'family', label: 'Family', observed: false, othersPresent: true },
  { code: 'friends', label: 'Friends', observed: false, othersPresent: true },
  { code: 'classmates', label: 'Classmates', observed: true, othersPresent: true },
  { code: 'colleagues', label: 'Colleagues', observed: true, othersPresent: true },
  { code: 'strangers', label: 'Strangers', observed: true, othersPresent: true },
];

export const TIMES: readonly SnapshotOption[] = [
  { code: 'no_rush', label: 'No rush' },
  { code: 'some_time', label: 'Some time' },
  { code: 'limited', label: 'Limited' },
  { code: 'right_now', label: 'Right now' },
];

export const SUPPORTS: readonly SnapshotOption[] = [
  { code: 'just_me', label: 'Just me' },
  { code: 'can_call', label: 'Can call someone' },
  { code: 'someone_with_me', label: 'Someone with me' },
  { code: 'headphones', label: 'Headphones / headset' },
];

export const SENSITIVITY_FLAGS: readonly SnapshotOption[] = [
  { code: 'sound', label: 'Sound', emoji: '🔊' },
  { code: 'noise', label: 'Noise', emoji: '📢' },
  { code: 'lights', label: 'Lights', emoji: '💡' },
  { code: 'crowd', label: 'Crowd', emoji: '👥' },
  { code: 'smell', label: 'Smell', emoji: '👃' },
  { code: 'temperature', label: 'Temperature', emoji: '🌡' },
  { code: 'touch', label: 'Touch', emoji: '✋' },
  { code: 'visual_clutter', label: 'Visual clutter', emoji: '🧩' },
];
