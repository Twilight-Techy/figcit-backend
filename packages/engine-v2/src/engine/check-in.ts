import { valuesOf, type Catalogue } from '../format/catalogue.js';
import type { InputKind, InputOption, InputOptions } from '../format/inputs.js';
import type { Domain } from '../format/registry.js';
import type { EngineInput } from './types.js';

/**
 * The parts of the app's check-in (the v2 input contract, E-39) the engine reads. Structural, so
 * the API's own schema type fits it; free text is never read here (E-04).
 */
export interface CheckInValues {
  readonly state:
    | { readonly kind: 'grid'; readonly energy: number; readonly mood: number }
    | { readonly kind: 'not_given' }
    | { readonly kind: 'not_sure'; readonly confirmedCell?: string | undefined };
  readonly emotions: readonly { readonly code: string; readonly intensity: number | null }[];
  readonly sensations: readonly {
    readonly code: string;
    readonly intensity?: number | undefined;
  }[];
  readonly context: {
    readonly environment?: string | undefined;
    readonly support?: string | undefined;
    readonly supports?: readonly string[] | undefined;
    readonly sensitivity?: readonly string[] | undefined;
  };
  readonly needs: readonly string[];
  readonly parsedNeedCodes?: readonly string[] | undefined;
  readonly justSupport: boolean;
  readonly demand?:
    | { readonly traits?: readonly string[] | undefined; readonly puttingOff?: boolean | undefined }
    | undefined;
}

/** What the server knows that the check-in doesn't carry: the timeline, signals, the re-check. */
export interface ServerFacts {
  /** The task's timeline code, worked out from its due date (Tab 4). */
  readonly timeline?: string | undefined;
  /** Input facts by name: `signals.*`, `prefs.*`, `recheck.*`. */
  readonly facts?: EngineInput;
}

/** An answer of the check-in: where it sits in the check-in, and the option picked, if any. */
export interface AnswerRef {
  readonly input: string;
  readonly code?: string;
}

/**
 * One piece of engine input one answer gives (E-61): a whole fact, a rating of one key (the
 * strongest rating of a key is kept), or one member of a set.
 */
export type Contribution =
  | {
      readonly kind: 'value';
      readonly from: AnswerRef;
      readonly fact: string;
      readonly value: unknown;
    }
  | {
      readonly kind: 'rating';
      readonly from: AnswerRef;
      readonly fact: string;
      readonly key: string;
      readonly value: number | null;
    }
  | {
      readonly kind: 'member';
      readonly from: AnswerRef;
      readonly fact: string;
      readonly value: string;
    };

/**
 * An answer that gives no engine input, and why: its option maps to nothing ("information only"),
 * to a value this question doesn't read, or to no option at all; a task characteristic that isn't
 * a catalogue value; or a task left out because the user only wants support.
 */
export interface Unmapped {
  readonly from: AnswerRef;
  readonly why: 'maps_to_nothing' | 'not_read' | 'not_offered' | 'not_a_value' | 'support_only';
}

export interface CheckInExplained {
  readonly contributions: readonly Contribution[];
  readonly unmapped: readonly Unmapped[];
}

type Meanings = ReadonlyMap<string, InputOption['mapsTo']>;
const meanings = (options: InputOptions, kind: InputKind): Meanings =>
  new Map(options[kind].map((o) => [o.code, o.mapsTo]));

/** How a question reads an option's catalogue value: as a whole fact, a rating of it, or a set member. */
type Read =
  | { readonly as: 'value' | 'member'; readonly fact: string }
  | { readonly as: 'rating'; readonly fact: string; readonly rating: number | null };

/** Collects the contributions and the answers that give none, in check-in order. */
class Explainer {
  readonly contributions: Contribution[] = [];
  readonly unmapped: Unmapped[] = [];

  value(from: AnswerRef, fact: string, value: unknown): void {
    this.contributions.push({ kind: 'value', from, fact, value });
  }

  member(from: AnswerRef, fact: string, value: string): void {
    this.contributions.push({ kind: 'member', from, fact, value });
  }

  /**
   * One picked option of a question, through its "Maps to": read when it maps into a domain the
   * question reads, otherwise recorded as giving nothing.
   */
  option(
    m: Meanings,
    from: AnswerRef & { readonly code: string },
    reads: Partial<Record<Domain, Read>>,
  ): void {
    const to = m.get(from.code);
    if (to === undefined) this.unmapped.push({ from, why: 'not_offered' });
    else if (to === null) this.unmapped.push({ from, why: 'maps_to_nothing' });
    else {
      const read = 'domain' in to ? reads[to.domain] : undefined;
      // An axis (a Not-sure picture) is never read here: the State step reads it.
      if (!read || !('domain' in to)) this.unmapped.push({ from, why: 'not_read' });
      else if (read.as === 'rating')
        this.contributions.push({
          kind: 'rating',
          from,
          fact: read.fact,
          key: to.code,
          value: read.rating,
        });
      else if (read.as === 'member') this.member(from, read.fact, to.code);
      else this.value(from, read.fact, to.code);
    }
  }
}

/** Energy and mood: the grid, or the cell the user confirmed on the Not-sure path. */
function state(c: CheckInValues, x: Explainer): void {
  const from = { input: 'state' };
  if (c.state.kind === 'grid') {
    x.value(from, 'state.energy', c.state.energy);
    x.value(from, 'state.mood', c.state.mood);
    return;
  }
  if (c.state.kind === 'not_given') return;
  x.value(from, 'state.not_sure', true);
  const cell = /^E([1-4])M([1-4])$/.exec(c.state.confirmedCell ?? '');
  if (!cell) return;
  x.value(from, 'state.energy', Number(cell[1]));
  x.value(from, 'state.mood', Number(cell[2]));
}

/** Feelings by family; sensations by group. Only the strongest rating per key is kept. */
function feelings(c: CheckInValues, options: InputOptions, x: Explainer): void {
  const chips = meanings(options, 'feeling');
  for (const e of c.emotions)
    x.option(
      chips,
      { input: 'emotions', code: e.code },
      {
        family: { as: 'rating', fact: 'family.intensity', rating: e.intensity },
      },
    );
  const groups = meanings(options, 'sensation');
  for (const s of c.sensations)
    x.option(
      groups,
      { input: 'sensations', code: s.code },
      {
        sensation_group: { as: 'rating', fact: 'sensation.intensity', rating: s.intensity ?? null },
      },
    );
}

/** Place, supports and sensitivities. */
function context(c: CheckInValues, options: InputOptions, x: Explainer): void {
  const env = c.context.environment;
  if (env)
    x.option(
      meanings(options, 'place'),
      { input: 'context.environment', code: env },
      {
        context: { as: 'value', fact: 'context.setting' },
      },
    );
  const input = c.context.supports ? 'context.supports' : 'context.support';
  const supports = c.context.supports ?? (c.context.support ? [c.context.support] : []);
  const supportMeans = meanings(options, 'support');
  for (const code of supports)
    x.option(
      supportMeans,
      { input, code },
      { support: { as: 'member', fact: 'context.supports' } },
    );
  const senseMeans = meanings(options, 'sense');
  for (const code of c.context.sensitivity ?? [])
    x.option(
      senseMeans,
      { input: 'context.sensitivity', code },
      {
        sensitivity_flag: { as: 'member', fact: 'sensitivity.flags' },
      },
    );
}

/** Needs, picked or parsed from the user's words; a need can stand for a feeling ("I'm grateful", E-45). */
function needs(c: CheckInValues, options: InputOptions, x: Explainer): void {
  const m = meanings(options, 'need');
  const picked = [
    ...c.needs.map((code) => ({ input: 'needs', code })),
    ...(c.parsedNeedCodes ?? []).map((code) => ({ input: 'parsedNeedCodes', code })),
  ];
  for (const from of picked)
    x.option(m, from, {
      need: { as: 'member', fact: 'needs' },
      family: { as: 'rating', fact: 'family.intensity', rating: null },
    });
}

/** The task: its timeline and the characteristics that are catalogue values (IG-17). */
function demand(
  c: CheckInValues,
  catalogue: Catalogue,
  timeline: string | undefined,
  x: Explainer,
): void {
  x.value({ input: 'justSupport' }, 'entry.support_only', c.justSupport);
  if (!c.demand || c.justSupport) {
    if (c.demand) x.unmapped.push({ from: { input: 'demand' }, why: 'support_only' });
    x.value({ input: c.demand ? 'justSupport' : 'demand' }, 'demand.present', false);
    return;
  }
  x.value({ input: 'demand' }, 'demand.present', true);
  if (timeline) x.value({ input: 'demand.timeline', code: timeline }, 'demand.timeline', timeline);
  const known = new Set(valuesOf(catalogue, 'demand_characteristic').map((v) => v.code));
  for (const code of c.demand.traits ?? []) {
    const from = { input: 'demand.traits', code };
    if (known.has(code)) x.member(from, 'demand.characteristics', code);
    else x.unmapped.push({ from, why: 'not_a_value' });
  }
  if (!c.demand.puttingOff) return;
  const from = { input: 'demand.puttingOff' };
  if (known.has('long_avoided_task')) x.member(from, 'demand.characteristics', 'long_avoided_task');
  else x.unmapped.push({ from, why: 'not_a_value' });
}

/**
 * The engine input a check-in gives, answer by answer (E-40, E-61): each answer through its
 * option's "Maps to", and the answers that give nothing with the reason. `factsFromCheckIn` folds
 * this list, so what staff see explained is exactly what the engine gets. Answers the engine has
 * no fact for at all (who's around, time, body regions, task kind: IG-06, IG-08, IG-09, IG-14)
 * aren't in `CheckInValues`, so the caller lists those.
 */
export function explainCheckIn(
  c: CheckInValues,
  options: InputOptions,
  catalogue: Catalogue,
  timeline?: string,
): CheckInExplained {
  const x = new Explainer();
  state(c, x);
  feelings(c, options, x);
  context(c, options, x);
  needs(c, options, x);
  demand(c, catalogue, timeline, x);
  return { contributions: x.contributions, unmapped: x.unmapped };
}

/** Keeps the strongest rating per key; unrated (null) only when nothing is rated. */
function strongest(into: Record<string, number | null>, key: string, rating: number | null): void {
  const had = into[key];
  if (had === undefined || had === null) into[key] = rating;
  else if (rating !== null) into[key] = Math.max(had, rating);
}

/** The input facts a list of contributions makes: ratings by their strongest, sets without repeats. */
export function foldContributions(list: readonly Contribution[]): EngineInput {
  const out: Record<string, unknown> = {};
  for (const c of list) {
    if (c.kind === 'value') out[c.fact] = c.value;
    else if (c.kind === 'rating') {
      const into = (out[c.fact] ??= {}) as Record<string, number | null>;
      strongest(into, c.key, c.value);
    } else {
      const into = (out[c.fact] ??= []) as string[];
      if (!into.includes(c.value)) into.push(c.value);
    }
  }
  return out;
}

/**
 * The engine's input facts from a check-in (E-39, E-40): each answer through its option's "Maps
 * to", then what the server knows. The check-in must already be checked against the options.
 */
export function factsFromCheckIn(
  c: CheckInValues,
  options: InputOptions,
  catalogue: Catalogue,
  server: ServerFacts = {},
): EngineInput {
  const { contributions } = explainCheckIn(c, options, catalogue, server.timeline);
  return { ...foldContributions(contributions), ...server.facts };
}
