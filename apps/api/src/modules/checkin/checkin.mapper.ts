// Pure mapping between the check-in request, the engine input and the stored rows.
import type { EngineInput, Snapshot, TimelineCode } from '@figcit/engine';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { UserCipher } from '../../common/crypto/crypto.service.js';
import { BadInput } from '../../common/errors/errors.js';
import { timelineFor } from '../../common/time/timeline.js';
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

export function toEngineInput(
  input: CheckInInput,
  timeline: TimelineCode | undefined,
  recheckOf: EngineInput['recheckOf'],
): EngineInput {
  const d = input.demand;
  const freeText = [
    input.ownWords,
    input.ownFeeling,
    input.context.environmentOther,
    d?.title,
  ].filter((t): t is string => !!t);
  const { environment, social, time, support, sensitivity } = input.context;
  return {
    entry: input.entry === 'quick' ? 'quick' : 'full',
    state: engineState(input.state),
    emotions: input.emotions,
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
    notSureAnswers: grid ? [] : (state.answers ?? []),
    confirmed: grid || state.confirmedCell !== undefined,
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
    context: {
      create: {
        environment: input.context.environment ?? null,
        people: input.context.social ?? null,
        timeAvailable: input.context.time ?? null,
        support: input.context.support ?? null,
        sensitivityFlags: input.context.sensitivity ?? [],
        customTagIds: input.context.customTagIds ?? [],
      },
    },
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
