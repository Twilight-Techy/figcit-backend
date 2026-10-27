// Stage 3: context → setting class, sensitivity count and tool filter (Tabs 3a, 3b, 6c D).
import type { CompiledSnapshot } from '../snapshot.js';
import type { ContextInput, EngineInput, SettingClass } from '../types.js';

export interface ContextResult {
  readonly settingClass: SettingClass;
  readonly environment: string | undefined;
  readonly sensitivity: ReadonlySet<string>;
  readonly sensitivityCount: number;
  /** CX-1 applies only in public, formal, observed or unfamiliar settings (B-07). */
  readonly cx1Setting: boolean;
  /** Private or prayer-room: eyes-closed and spoken practice allowed (MD-4). */
  readonly privateSetting: boolean;
  readonly othersPresent: boolean;
  readonly headphones: boolean;
  readonly timeShort: boolean;
  readonly excluded: ReadonlySet<string>;
}

const CX1_CLASSES: ReadonlySet<SettingClass> = new Set([
  'observed',
  'formal',
  'exam',
  'clinical',
  'public',
  'transit',
  'unfamiliar',
  'social_event',
]);
const PRIVATE_CLASSES: ReadonlySet<SettingClass> = new Set([
  'private',
  'in_bed',
  'prayer_room',
  'outdoors',
]);
const AUDIO_TOOLS = [
  'sounds',
  'sounds_plus',
  'sleep_winddown',
  'settle_10',
  'settle_20',
  'body_scan',
  'recitation_player',
];
const SCREEN_TOOLS = ['create', 'reset_games'];

/** Tab 3a: Sound/Noise make external audio unrealistic without headphones; Lights and Visual
 *  clutter rule out screen-heavy tools. */
function sensoryExclusions(
  ctx: ContextInput,
  settingClass: SettingClass,
  sensitivity: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  const headphones = ctx.support === 'headphones';
  const loud = sensitivity.has('sound') || sensitivity.has('noise');
  if (!headphones && (!PRIVATE_CLASSES.has(settingClass) || loud)) out.push(...AUDIO_TOOLS);
  if (sensitivity.has('lights') || sensitivity.has('visual_clutter')) out.push(...SCREEN_TOOLS);
  return out;
}

export function analyseContext(cs: CompiledSnapshot, input: EngineInput): ContextResult {
  const ctx = input.context ?? {};
  const env = ctx.environment ? cs.environmentByCode.get(ctx.environment) : undefined;
  const settingClass: SettingClass = env?.settingClass ?? 'private';
  const sensitivity = new Set(ctx.sensitivity ?? []);
  const excluded = new Set<string>([
    ...(env?.excludeTools ?? []),
    ...sensoryExclusions(ctx, settingClass, sensitivity),
  ]);
  const social = ctx.social ? cs.source.socials.find((s) => s.code === ctx.social) : undefined;
  const othersPresent = social?.othersPresent ?? false;
  return {
    settingClass,
    environment: env?.code,
    sensitivity,
    sensitivityCount: sensitivity.size,
    cx1Setting: CX1_CLASSES.has(settingClass),
    privateSetting: PRIVATE_CLASSES.has(settingClass) && !othersPresent,
    othersPresent,
    headphones: ctx.support === 'headphones',
    timeShort: ctx.time === 'limited' || ctx.time === 'right_now',
    excluded,
  };
}
