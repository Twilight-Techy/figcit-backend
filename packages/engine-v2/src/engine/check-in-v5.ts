import type { InputKind, InputOptions } from '../format/inputs.js';
import type { EngineInput } from './types.js';

// Rules Engine v5.0: the app's check-in (Tab 13's steps) as engine input. Each answer is checked
// against the version's check-in options: an option the plan can't pick is dropped (ENT-12; the
// app shows the lock), and a Quick check-in reads no body, senses or place (CTX-U).

/** The v5.0 check-in the app sends. Structural, so the API's own schema type fits it. */
export interface CheckInV5 {
  readonly mode: 'quick' | 'full';
  readonly state:
    | { readonly kind: 'grid'; readonly energy: number; readonly mood: number }
    | { readonly kind: 'not_sure' };
  /** Up to two emotions, each with its slider (1-10, Tab 2). */
  readonly emotions: readonly { readonly code: string; readonly level: number }[];
  /** SE-1's one tap after Something else: a group code (charged, low, shutdown, settled). */
  readonly somethingElseGroup?: string | undefined;
  readonly body?: readonly string[] | undefined;
  readonly urgent?:
    { readonly signs: readonly string[]; readonly answer: 'sudden_new' | 'familiar' } | undefined;
  readonly senses?: readonly string[] | undefined;
  readonly place?: { readonly code: string; readonly canStepAway: boolean } | undefined;
  readonly devices?: readonly string[] | undefined;
  /** The open tasks the check-in brings, by chip; no chip is Usual (TK-1). */
  readonly tasks?: readonly { readonly chip?: string | undefined }[] | undefined;
  /** The Help menu's pick (Tab 7): a support card or a 'More needs' entry. */
  readonly helpCard?: string | undefined;
}

export interface DroppedAnswer {
  readonly input: InputKind;
  readonly code: string;
  /**
   * `not_offered`: no such option; `locked`: the plan can't pick it (ENT-12); `not_asked`: a
   * Quick check-in doesn't ask it; `too_many`: past the limit (two emotions; three tasks on Free).
   */
  readonly why: 'not_offered' | 'locked' | 'not_asked' | 'too_many';
}

/** The plans that pick every option (Tab 9: Prime and above; ENT-14). */
const PICKS_ALL = new Set(['prime', 'premium', 'organisation_seat', 'pilot']);
/** Tab 2: up to two emotions. Tab 9: Free has up to three tasks. */
const MAX_EMOTIONS = 2;
const MAX_FREE_TASKS = 3;
const USUAL = 'usual';

class Reader {
  readonly dropped: DroppedAnswer[] = [];
  constructor(
    private readonly options: InputOptions,
    readonly plan: string,
  ) {}

  /** The option's catalogue code, when it is offered and the plan can pick it. */
  pick(input: InputKind, code: string): string | null {
    const option = this.options[input].find((o) => o.code === code);
    if (!option?.mapsTo || !('domain' in option.mapsTo)) {
      this.dropped.push({ input, code, why: 'not_offered' });
      return null;
    }
    if (option.group === 'prime' && !PICKS_ALL.has(this.plan)) {
      this.dropped.push({ input, code, why: 'locked' });
      return null;
    }
    return option.mapsTo.code;
  }

  picks(input: InputKind, codes: readonly string[] | undefined): string[] {
    return [...new Set((codes ?? []).map((c) => this.pick(input, c)).filter((c) => c !== null))];
  }

  notAsked(input: InputKind, codes: readonly string[]): void {
    for (const code of codes) this.dropped.push({ input, code, why: 'not_asked' });
  }
}

function feelingsOf(c: CheckInV5, r: Reader): EngineInput {
  const intensity: Record<string, number> = {};
  c.emotions.forEach((e, i) => {
    if (i >= MAX_EMOTIONS) {
      r.dropped.push({ input: 'feeling', code: e.code, why: 'too_many' });
      return;
    }
    const code = r.pick('feeling', e.code);
    if (code) intensity[code] = Math.min(10, Math.max(1, Math.round(e.level)));
  });
  return {
    ...(Object.keys(intensity).length > 0 ? { 'family.intensity': intensity } : {}),
    ...('something_else' in intensity && c.somethingElseGroup
      ? { 'feeling.something_else_group': c.somethingElseGroup }
      : {}),
  };
}

/** Body & senses and Where you are: the Full check-in's steps 4 and 5. */
function fullOf(c: CheckInV5, r: Reader): EngineInput {
  if (c.mode === 'quick') {
    r.notAsked('body', c.body ?? []);
    r.notAsked('sense', c.senses ?? []);
    if (c.place) r.notAsked('place', [c.place.code]);
    r.notAsked('support', c.devices ?? []);
    return {};
  }
  const place = c.place ? r.pick('place', c.place.code) : null;
  return {
    'body.signs': r.picks('body', c.body),
    'sensitivity.flags': r.picks('sense', c.senses),
    ...(place && c.place
      ? { 'context.setting': place, 'context.can_step_away': c.place.canStepAway }
      : {}),
    'context.supports': r.picks('support', c.devices),
  };
}

function tasksOf(c: CheckInV5, r: Reader): EngineInput {
  const limit = PICKS_ALL.has(r.plan) ? Infinity : MAX_FREE_TASKS;
  const chips: string[] = [];
  (c.tasks ?? []).forEach((t, i) => {
    if (i >= limit) {
      r.dropped.push({ input: 'task_kind', code: t.chip ?? USUAL, why: 'too_many' });
      return;
    }
    chips.push(r.pick('task_kind', t.chip ?? USUAL) ?? USUAL);
  });
  return chips.length > 0
    ? { 'tasks.count': chips.length, 'tasks.chips': [...new Set(chips)] }
    : {};
}

/**
 * The engine input a v5.0 check-in gives, and the answers it leaves out (and why). `server` is
 * what the API adds: `signals.plan`, `life.now`, `safety.risk`, the re-check and other signals.
 */
export function factsFromCheckInV5(
  c: CheckInV5,
  options: InputOptions,
  server: EngineInput = {},
): { input: EngineInput; dropped: readonly DroppedAnswer[] } {
  const plan = typeof server['signals.plan'] === 'string' ? server['signals.plan'] : 'free';
  const r = new Reader(options, plan);
  // Urgent signs are always free and asked in both check-ins (SF-4 comes first).
  const urgent = c.urgent ? r.picks('urgent', c.urgent.signs) : [];
  const help = c.helpCard ? r.pick('help', c.helpCard) : null;
  const input: EngineInput = {
    ...server,
    'checkin.mode': c.mode,
    ...(c.state.kind === 'grid'
      ? { 'state.energy': c.state.energy, 'state.mood': c.state.mood }
      : { 'state.not_sure': true }),
    ...feelingsOf(c, r),
    ...fullOf(c, r),
    ...(urgent.length > 0 && c.urgent
      ? { 'urgent.signs': urgent, 'urgent.answer': c.urgent.answer }
      : {}),
    ...tasksOf(c, r),
    ...(help ? { 'help.card': help } : {}),
  };
  return { input, dropped: r.dropped };
}
