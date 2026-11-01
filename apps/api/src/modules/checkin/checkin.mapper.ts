// Pure mapping between the check-in request, the engine input and the stored rows.
import type { EngineInput, Snapshot, TimelineCode } from '@figcit/engine';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { UserCipher } from '../../common/crypto/crypto.service.js';
import type { InputKind, InputOption } from '@figcit/engine-v2';
import { BadInput } from '../../common/errors/errors.js';
import { timelineFor } from '../../common/time/timeline.js';
import type { CheckInOptionsDto } from '../rulesets/checkin-options.service.js';
import type { CheckInSummaryRow } from './checkin.repository.js';
import type { CheckInInput, checkInSummarySchema } from './checkin.schemas.js';

export type Summary = z.infer<typeof checkInSummarySchema>;
type Demand = NonNullable<CheckInInput['demand']>;

/** Copies only the keys whose value is defined (exactOptionalPropertyTypes). */
function defined<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as never;
}

export function toSummary(row: CheckInSummaryRow, snapshot: Snapshot): Summary {
  const cell = snapshot.cells.find((c) => c.id === row.cellId);
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    cellId: row.cellId,
    energy: row.energy,
    mood: row.mood,
    entry: row.entry,
    light: row.recommendations[0]?.light ?? null,
    stateName: cell?.name ?? null,
    emotions: row.emotions.map((e) => ({ code: e.emotionCode, intensity: e.intensity })),
  };
}

function unknownCodes(kind: string, codes: readonly string[], known: ReadonlySet<string>): void {
  const bad = codes.filter((c) => !known.has(c));
  if (bad.length) throw new BadInput(`Unknown ${kind}: ${bad.join(', ')}`);
}

/** Checks every code against the published catalogue, so stored rows always mean something. */
export function validateCodes(input: CheckInInput, snapshot: Snapshot): void {
  unknownCodes(
    'emotion',
    input.emotions.map((e) => e.code),
    new Set(snapshot.emotions.map((e) => e.code)),
  );
  unknownCodes(
    'sensation',
    input.sensations.map((s) => s.code),
    new Set(snapshot.sensations.map((s) => s.code)),
  );
  unknownCodes('need', input.needs, new Set(snapshot.needs.map((n) => n.code)));
  const env = input.context.environment;
  if (env) unknownCodes('environment', [env], new Set(snapshot.environments.map((e) => e.code)));
}

/** The published check-in options (E-40): the lists, and the app-facing flags derived from them. */
export interface OptionLists {
  readonly options: Readonly<Record<InputKind, readonly InputOption[]>>;
  readonly dto: Pick<CheckInOptionsDto, 'inputs'>;
}

function offered(kind: string, codes: readonly string[], list: readonly InputOption[]): void {
  unknownCodes(kind, codes, new Set(list.map((o) => o.code)));
}

/** Every value against the published options; the Not-sure answers by their question. */
function checkOffered(input: CheckInInput, o: OptionLists['options']): void {
  const c = input.context;
  const one = (v: string | undefined): string[] => (v ? [v] : []);
  offered(
    'feeling',
    input.emotions.map((e) => e.code),
    o.feeling,
  );
  offered(
    'sensation',
    input.sensations.map((s) => s.code),
    o.sensation,
  );
  offered(
    'body region',
    input.sensations.flatMap((s) => s.bodyRegions ?? []),
    o.body_region,
  );
  offered('place', one(c.environment), o.place);
  offered('who is around', one(c.social), o.social);
  offered('time', one(c.time), o.time);
  offered('support', supportsOf(input), o.support);
  offered('sense', c.sensitivity ?? [], o.sense);
  offered('need', [...input.needs, ...(input.parsedNeedCodes ?? [])], o.need);
  offered('task kind', one(input.demand?.kind), o.task_kind);
  offered('timeline', one(input.demand?.timeline), o.timeline);
  if (input.state.kind === 'not_sure') {
    const [body, energy, comfort] = input.state.answers ?? [];
    offered('Not sure body answer', one(body), o.not_sure_body);
    offered('Not sure energy answer', one(energy), o.not_sure_energy);
    offered('Not sure comfort answer', one(comfort), o.not_sure_comfort);
  }
}

/** Supports picked: the list, or the single value older clients send. */
export function supportsOf(input: CheckInInput): string[] {
  const c = input.context;
  return c.supports ?? (c.support ? [c.support] : []);
}

/**
 * Checks the check-in against the published options (E-40) and the rules between answers (E-45):
 * "Just me" and "Someone with me" exclude each other; a need that needs a task brings one.
 */
export function validateOptions(input: CheckInInput, lists: OptionLists): void {
  checkOffered(input, lists.options);
  const supports = supportsOf(input);
  if (supports.includes('just_me') && supports.includes('someone_with_me'))
    throw new BadInput('"Just me" and "Someone with me" can\'t both be picked.');
  const taskNeeds = new Set(lists.dto.inputs.need.filter((n) => n.needsTask).map((n) => n.code));
  if (input.needs.some((n) => taskNeeds.has(n)) && (input.justSupport || !input.demand))
    throw new BadInput("This need is about a task, so the task step can't be skipped.");
}

export function demandTimeline(
  d: Demand | undefined,
  now: Date,
  timeZone: string,
): TimelineCode | undefined {
  if (!d) return undefined;
  return d.timeline ?? timelineFor(d.dueAt ? new Date(d.dueAt) : null, now, timeZone);
}

function engineState(state: CheckInInput['state']): EngineInput['state'] {
  if (state.kind === 'grid') return state;
  // A skipped state (quick entry, E-45) goes in as Not sure with no answers: NS-1 keeps it Conditional.
  if (state.kind === 'not_given') return { kind: 'not_sure' };
  return {
    kind: 'not_sure',
    ...defined({ answers: state.answers, confirmedCell: state.confirmedCell }),
  };
}

function engineDemand(d: Demand, timeline: TimelineCode): NonNullable<EngineInput['demand']> {
  return {
    timeline,
    ...defined({
      kind: d.kind,
      traits: d.traits,
      puttingOff: d.puttingOff,
      confirmedDrivers: d.confirmedDrivers,
      count: d.count,
      title: d.title,
    }),
  };
}

// TEMPORARY v2 -> v1 adapter (DECISION_LOG E-39, TODO T-17): the check-in now carries v2 standard
// input; until the v2 engine runs, these choices feed the v1 engine as E-42 and ADR 0004 §7 say.
const UNRATED_HARDER = 7;
const UNRATED_LIGHTER = 2;
const RISK = 10;

/** v1 needs a number: an unrated feeling counts as High (harder) or Mild (lighter); risk is 10. */
function engineEmotions(
  input: CheckInInput,
  lists: OptionLists | null,
): NonNullable<EngineInput['emotions']> {
  const feelings = lists?.dto.inputs.feeling ?? [];
  return input.emotions.map((e) => {
    const opt = feelings.find((f) => f.code === e.code);
    if (opt?.risk) return { code: e.code, intensity: RISK };
    if (e.intensity !== null) return { code: e.code, intensity: e.intensity };
    return { code: e.code, intensity: opt?.group === 'lighter' ? UNRATED_LIGHTER : UNRATED_HARDER };
  });
}

/** v1 reads one support value; headphones is the one its rules use (Tabs 3a, 3b, 6c). */
function engineSupport(input: CheckInInput): string | undefined {
  const supports = supportsOf(input);
  return supports.includes('headphones') ? 'headphones' : supports[0];
}

export function toEngineInput(
  input: CheckInInput,
  timeline: TimelineCode | undefined,
  recheckOf: EngineInput['recheckOf'],
  lists: OptionLists | null = null,
): EngineInput {
  const d = input.demand;
  const freeText = [
    input.ownWords,
    input.ownFeeling,
    input.context.environmentOther,
    d?.title,
  ].filter((t): t is string => !!t);
  const { environment, social, time, sensitivity } = input.context;
  const support = engineSupport(input);
  return {
    entry: input.entry === 'quick' ? 'quick' : 'full',
    state: engineState(input.state),
    emotions: engineEmotions(input, lists),
    sensations: input.sensations.map((s) => ({
      code: s.code,
      ...defined({ intensity: s.intensity, bodyRegions: s.bodyRegions }),
    })),
    context: defined({ environment, social, time, support, sensitivity }),
    needs: input.needs.length ? input.needs : (input.parsedNeedCodes ?? []),
    justSupport: input.justSupport,
    ...(d && timeline ? { demand: engineDemand(d, timeline) } : {}),
    ...(freeText.length ? { freeText } : {}),
    ...defined({ intent: input.intent, recheckOf }),
  };
}

export function taskData(
  userId: string,
  d: Demand & { title: string },
  timeline: TimelineCode | undefined,
  cipher: UserCipher,
): Prisma.TaskUncheckedCreateInput {
  return {
    userId,
    titleEnc: cipher.enc(d.title),
    type: d.kind ?? null,
    timelineCode: timeline ?? null,
    dueAt: d.dueAt ? new Date(d.dueAt) : null,
    recurrenceRule: d.recurrenceRule ?? null,
    puttingOff: d.puttingOff ?? false,
    nucripceTags: d.confirmedDrivers ?? [],
    source: 'demand',
  };
}

export interface RowContext {
  readonly userId: string;
  readonly snapshot: Snapshot;
  readonly cipher: UserCipher;
  readonly taskId: string | null;
  readonly timeline: TimelineCode | undefined;
  readonly now: Date;
}

function needData(
  input: CheckInInput,
  ctx: RowContext,
): Prisma.NeedSelectionCreateWithoutCheckInInput {
  const d = input.demand;
  return {
    needCode: input.needs[0] ?? null,
    ownWordsEnc: ctx.cipher.encOpt(input.ownWords),
    parsedNeedCodes: input.parsedNeedCodes ?? input.needs.slice(1),
    justSupport: input.justSupport,
    hasDemand: d !== undefined,
    demandType: d?.kind ?? null,
    ...(ctx.taskId ? { task: { connect: { id: ctx.taskId } } } : {}),
    dueAt: d?.dueAt ? new Date(d.dueAt) : null,
    timelineCode: ctx.timeline ?? null,
    drivers: d?.confirmedDrivers ?? [],
  };
}

function contextData(input: CheckInInput): Prisma.CheckInContextCreateWithoutCheckInInput {
  const c = input.context;
  return {
    environment: c.environment ?? null,
    people: c.social ?? null,
    timeAvailable: c.time ?? null,
    support: engineSupport(input) ?? null,
    supports: supportsOf(input),
    sensitivityFlags: c.sensitivity ?? [],
    customTagIds: c.customTagIds ?? [],
  };
}

/** The check-in row with its emotions, sensations, context and need, created in one write. */
export function checkInData(
  input: CheckInInput,
  ctx: RowContext,
): Prisma.CheckInUncheckedCreateInput {
  const family = new Map(ctx.snapshot.emotions.map((e) => [e.code, e.family]));
  const category = new Map(ctx.snapshot.sensations.map((s) => [s.code, s.category]));
  const state = input.state;
  const grid = state.kind === 'grid';
  return {
    ...(input.id ? { id: input.id } : {}),
    userId: ctx.userId,
    energy: grid ? state.energy : null,
    mood: grid ? state.mood : null,
    source: state.kind,
    entry: input.entry,
    notSureAnswers: state.kind === 'not_sure' ? (state.answers ?? []) : [],
    confirmed: grid || (state.kind === 'not_sure' && state.confirmedCell !== undefined),
    recheckOfId: input.recheckOfId ?? null,
    snapshotVersion: ctx.snapshot.version,
    createdOnDeviceAt: input.createdOnDeviceAt ? new Date(input.createdOnDeviceAt) : ctx.now,
    origin: input.origin,
    emotions: {
      create: input.emotions.map((e) => ({
        emotionCode: e.code,
        familyCode: family.get(e.code) ?? 'unknown',
        intensity: e.intensity,
      })),
    },
    sensations: {
      create: input.sensations.map((s) => ({
        tagCode: s.code,
        category: category.get(s.code) ?? 'body',
        intensity: s.intensity ?? null,
        bodyRegions: s.bodyRegions ?? [],
      })),
    },
    context: { create: contextData(input) },
    need: { create: needData(input, ctx) },
  };
}

export function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`).toString('base64url');
}

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [at, id] = Buffer.from(cursor, 'base64url').toString().split('|');
  const createdAt = new Date(at ?? '');
  if (!id || Number.isNaN(createdAt.getTime()))
    throw new BadInput('That page link is out of date.');
  return { createdAt, id };
}
