// Built-in defaults for every content key. Published content items with the same key override them.
import type { ContentKind } from '@prisma/client';
import { ADAPT_LIBRARY, COMM_CARDS, type AdaptKind } from './adapt.js';
import { RELATIONSHIPS, STARTERS, type Starter } from './connect.js';
import { REFLECT_VARIANTS, type ReflectVariant } from './reflect.js';
import {
  BREATHE_PATTERNS,
  GROUND_STEPS,
  MOVE_ROUTINES,
  SOUNDS,
  STEP_OUT_PROMPTS,
} from './regulate.js';

export interface ContentMap {
  readonly 'reflect.variants': readonly ReflectVariant[];
  readonly 'connect.starters': readonly Starter[];
  readonly 'connect.relationships': readonly string[];
  readonly 'adapt.library': readonly AdaptKind[];
  readonly 'comm.cards': readonly { code: string; text: string }[];
  readonly 'regulate.breathe': typeof BREATHE_PATTERNS;
  readonly 'regulate.ground': typeof GROUND_STEPS;
  readonly 'regulate.move': typeof MOVE_ROUTINES;
  readonly 'regulate.step_out': typeof STEP_OUT_PROMPTS;
  readonly 'regulate.sounds': typeof SOUNDS;
}

export const DEFAULT_CONTENT: {
  readonly [K in keyof ContentMap]: { readonly kind: ContentKind; readonly body: ContentMap[K] };
} = {
  'reflect.variants': { kind: 'reflect_prompt', body: REFLECT_VARIANTS },
  'connect.starters': { kind: 'starter', body: STARTERS },
  'connect.relationships': { kind: 'copy', body: RELATIONSHIPS },
  'adapt.library': { kind: 'adaptation', body: ADAPT_LIBRARY },
  'comm.cards': { kind: 'comm_card', body: COMM_CARDS },
  'regulate.breathe': { kind: 'tool_script', body: BREATHE_PATTERNS },
  'regulate.ground': { kind: 'tool_script', body: GROUND_STEPS },
  'regulate.move': { kind: 'tool_script', body: MOVE_ROUTINES },
  'regulate.step_out': { kind: 'tool_script', body: STEP_OUT_PROMPTS },
  'regulate.sounds': { kind: 'tool_script', body: SOUNDS },
};

export type ContentKey = keyof ContentMap;
export type ContentBody<K extends ContentKey> = ContentMap[K];
