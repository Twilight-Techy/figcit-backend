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

type Meanings = ReadonlyMap<string, InputOption['mapsTo']>;
const meanings = (options: InputOptions, kind: InputKind): Meanings =>
  new Map(options[kind].map((o) => [o.code, o.mapsTo]));

/** The catalogue codes the picked options of one question mean, in one domain. */
function codesIn(m: Meanings, picked: readonly string[], domain: Domain): string[] {
  return picked.flatMap((code) => {
    const to = m.get(code);
    return to && 'domain' in to && to.domain === domain ? [to.code] : [];
  });
}

/** Keeps the strongest rating per key; unrated (null) only when nothing is rated. */
function strongest(into: Record<string, number | null>, key: string, rating: number | null): void {
  const had = into[key];
  if (had === undefined || had === null) into[key] = rating;
  else if (rating !== null) into[key] = Math.max(had, rating);
}

/** Feelings by family: the chips, and the needs that stand for a family ("I'm grateful", E-45). */
function feelings(c: CheckInValues, options: InputOptions): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const chips = meanings(options, 'feeling');
  for (const e of c.emotions)
    for (const f of codesIn(chips, [e.code], 'family')) strongest(out, f, e.intensity);
  const needs = meanings(options, 'need');
  for (const f of codesIn(needs, [...c.needs, ...(c.parsedNeedCodes ?? [])], 'family'))
    strongest(out, f, null);
  return out;
}

function sensations(c: CheckInValues, options: InputOptions): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const m = meanings(options, 'sensation');
  for (const s of c.sensations)
    for (const g of codesIn(m, [s.code], 'sensation_group')) strongest(out, g, s.intensity ?? null);
  return out;
}

/** Energy and mood: the grid, or the cell the user confirmed on the Not-sure path. */
function state(c: CheckInValues): EngineInput {
  if (c.state.kind === 'grid')
    return { 'state.energy': c.state.energy, 'state.mood': c.state.mood };
  if (c.state.kind === 'not_given') return {};
  const cell = /^E([1-4])M([1-4])$/.exec(c.state.confirmedCell ?? '');
  return {
    'state.not_sure': true,
    ...(cell ? { 'state.energy': Number(cell[1]), 'state.mood': Number(cell[2]) } : {}),
  };
}

/** The task: its timeline and the characteristics that are catalogue values (IG-17). */
function demand(c: CheckInValues, catalogue: Catalogue, timeline: string | undefined): EngineInput {
  if (!c.demand || c.justSupport) return { 'demand.present': false };
  const known = new Set(valuesOf(catalogue, 'demand_characteristic').map((v) => v.code));
  const traits = (c.demand.traits ?? []).filter((t) => known.has(t));
  if (c.demand.puttingOff && known.has('long_avoided_task')) traits.push('long_avoided_task');
  const characteristics = [...new Set(traits)];
  return {
    'demand.present': true,
    ...(timeline ? { 'demand.timeline': timeline } : {}),
    ...(characteristics.length > 0 ? { 'demand.characteristics': characteristics } : {}),
  };
}

const nonEmpty = (name: string, list: readonly string[]): EngineInput =>
  list.length > 0 ? { [name]: [...new Set(list)] } : {};

/**
 * The engine's input facts from a check-in (E-39, E-40): each answer through its option's "Maps
 * to"; answers that map to nothing (who's around, time, body regions, task kind) carry no fact
 * yet (IG-06, IG-08, IG-09, IG-14). The check-in must already be checked against the options.
 */
export function factsFromCheckIn(
  c: CheckInValues,
  options: InputOptions,
  catalogue: Catalogue,
  server: ServerFacts = {},
): EngineInput {
  const place = c.context.environment
    ? codesIn(meanings(options, 'place'), [c.context.environment], 'context')
    : [];
  const supports = c.context.supports ?? (c.context.support ? [c.context.support] : []);
  const families = feelings(c, options);
  const groups = sensations(c, options);
  return {
    ...state(c),
    ...(Object.keys(families).length > 0 ? { 'family.intensity': families } : {}),
    ...(Object.keys(groups).length > 0 ? { 'sensation.intensity': groups } : {}),
    ...(place[0] ? { 'context.setting': place[0] } : {}),
    ...nonEmpty('context.supports', codesIn(meanings(options, 'support'), supports, 'support')),
    ...nonEmpty(
      'sensitivity.flags',
      codesIn(meanings(options, 'sense'), c.context.sensitivity ?? [], 'sensitivity_flag'),
    ),
    ...nonEmpty(
      'needs',
      codesIn(meanings(options, 'need'), [...c.needs, ...(c.parsedNeedCodes ?? [])], 'need'),
    ),
    'entry.support_only': c.justSupport,
    ...demand(c, catalogue, server.timeline),
    ...server.facts,
  };
}
