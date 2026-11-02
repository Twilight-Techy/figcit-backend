import { Injectable, Logger } from '@nestjs/common';
import {
  canonicalJson,
  ENGINE_VERSION,
  factsFromCheckIn,
  run,
  type Card,
  type Catalogue,
  type CheckInValues,
  type EngineInput,
  type Trace,
  type JsonValue,
} from '@figcit/engine-v2';
import { Prisma, type DecisionRecord } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';
import { AppError, Forbidden, NotConfigured, NotFound } from '../../common/errors/errors.js';
import { demandTimeline, validateOptions } from '../checkin/checkin.mapper.js';
import type { CheckInInput } from '../checkin/checkin.schemas.js';
import { SignalsService } from '../recommendation/signals.service.js';
import { SafetyService, type SafetyMatch } from '../safety/safety.service.js';
import { CheckInOptionsService, type CheckInOptions } from '../rulesets/checkin-options.service.js';
import { daysInRed, lastFact, recheckFacts, signalFacts } from './decision-facts.js';
import type {
  DecideBody,
  DecisionDto,
  DecisionList,
  DecisionRecordDto,
  ReplayResult,
} from './decisions.schemas.js';
import { EngineRuntimeService, type Runnable } from './engine-runtime.service.js';

/** A check-in turned into the published engine's input. */
export interface Prepared {
  readonly engine: Runnable;
  readonly offered: CheckInOptions;
  readonly input: EngineInput;
  /** The free-text safety screen's match, if any (SF-1's flag, E-04). */
  readonly risk: SafetyMatch | null;
}

/** Browse has no profile, so no time zone: the UK, where the service runs (E-46). */
const BROWSE_ZONE = 'Europe/London';
/** Staff who may read any record and its trace (trace and export are staff-only, E-21, O-16). */
export const STAFF = ['clinical_admin', 'admin', 'safety_reviewer', 'content_editor'] as const;
const RED_LOOKBACK_DAYS = 30;
const SAMPLE = 50;

const staffOf = (roles: readonly string[]): boolean => STAFF.some((r) => roles.includes(r));

/**
 * Engine v2 decisions (M5, DESIGN §7, §10): a check-in becomes input facts, the published version
 * runs, and the record keeps everything needed to replay it. Signed-in and Browse alike (E-02,
 * E-05); Browse records carry no account. Records are append-only (database trigger).
 */
@Injectable()
export class DecisionsService {
  private readonly logger = new Logger('Decisions');

  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: EngineRuntimeService,
    private readonly options: CheckInOptionsService,
    private readonly signals: SignalsService,
    private readonly safety: SafetyService,
  ) {}

  async decide(
    body: DecideBody,
    userId: string | undefined,
    now = new Date(),
  ): Promise<DecisionDto> {
    const recheck =
      userId && body.recheckOfId ? await this.previousFacts(userId, body.recheckOfId) : undefined;
    const prepared = await this.prepare(body, userId, now, recheck);
    const { record } = await this.record(this.prisma, prepared, {
      userId,
      recheckOfId: recheck ? (body.recheckOfId ?? null) : null,
      now,
    });
    return this.dto(record, prepared.engine.label);
  }

  /**
   * A check-in as the published engine's input: checked against the published options, then
   * every answer through its "Maps to", with what the server knows about the account.
   */
  async prepare(
    body: CheckInValues & { demand?: CheckInInput['demand'] } & CheckInInput,
    userId: string | undefined,
    now: Date,
    recheck?: EngineInput,
  ): Promise<Prepared> {
    const offered = await this.options.current();
    if (!offered)
      throw new NotConfigured('No engine v2 rule set with check-in options is published yet.');
    validateOptions(body, offered);
    const engine = await this.runtime.current();
    const server = userId
      ? await this.serverFacts(userId, engine.ruleset.catalogue, now)
      : { zone: BROWSE_ZONE, facts: { 'signals.plan': 'free' } };
    // Free text never reaches the engine; the server's safety screen reads it and the engine gets
    // its answer as safety.risk (E-04, SF-1). The same texts as v1 screened.
    const risk = await this.safety.check([
      body.ownWords,
      body.ownFeeling,
      body.context.environmentOther,
      body.demand?.title,
    ]);
    const input = factsFromCheckIn(body, offered.options, engine.ruleset.catalogue, {
      timeline: demandTimeline(body.demand, now, server.zone),
      facts: { ...server.facts, ...recheck, 'safety.risk': risk !== null },
    });
    return { engine, offered, input, risk };
  }

  /** Runs a prepared input and stores the decision, in the caller's transaction when given. */
  async record(
    db: Tx | PrismaService,
    p: Pick<Prepared, 'engine' | 'input'>,
    meta: { userId: string | undefined; recheckOfId: string | null; now: Date },
  ): Promise<{ record: DecisionRecord; card: Card; trace: Trace }> {
    const result = run(p.engine.ruleset, p.input, { trace: 'full' });
    // The check-in was checked against the options, so a refusal here is a mapping fault.
    if (!result.ok)
      throw new AppError(
        500,
        'engine_input_refused',
        'The check-in could not be turned into engine input',
        {
          extra: { issues: result.issues },
        },
      );
    const record = await db.decisionRecord.create({
      data: {
        mode: meta.userId ? 'signed_in' : 'browse',
        userId: meta.userId ?? null,
        versionId: p.engine.id,
        rulesetHash: p.engine.hash ?? '',
        engineVersion: ENGINE_VERSION,
        input: p.input as Prisma.InputJsonValue,
        card: result.card as unknown as Prisma.InputJsonValue,
        trace: result.trace as unknown as Prisma.InputJsonValue,
        band: result.card.band,
        light: result.card.light,
        supportScreen: result.card.kind === 'support_screen',
        recheckOfId: meta.recheckOfId,
        createdAt: meta.now,
      },
    });
    return { record, card: result.card, trace: result.trace };
  }

  /** The account's signals and SF-2's run of Red days. */
  private async serverFacts(
    userId: string,
    catalogue: Catalogue,
    now: Date,
  ): Promise<{ zone: string; facts: EngineInput }> {
    const [user, signals, reds] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { timezone: true } }),
      this.signals.load(userId, now),
      this.prisma.decisionRecord.findMany({
        where: {
          userId,
          band: 'very_constrained',
          createdAt: { gte: new Date(now.getTime() - RED_LOOKBACK_DAYS * 86_400_000) },
        },
        select: { createdAt: true },
      }),
    ]);
    return {
      zone: user.timezone,
      facts: {
        ...signalFacts(signals, catalogue),
        'signals.days_very_constrained': daysInRed(
          reds.map((r) => r.createdAt),
          now,
          user.timezone,
        ),
      },
    };
  }

  /**
   * The re-check facts from an earlier decision of the same user (Tab 8 step 11). `completed` is
   * whether the support offered was finished, from its session (T-23), when the caller knows it.
   */
  async previousFacts(
    userId: string,
    decisionId: string,
    completed?: boolean,
  ): Promise<EngineInput> {
    const previous = await this.prisma.decisionRecord.findFirst({
      where: { id: decisionId, userId },
    });
    if (!previous) throw new NotFound('decision to re-check');
    return {
      ...recheckFacts({
        band: previous.band,
        light: previous.light,
        card: previous.card as unknown as Card,
        peak: lastFact(previous.trace, 'peak.negative') as number | null | undefined,
        baseline: lastFact(previous.trace, 'band.baseline') as string | undefined,
      }),
      ...(completed === undefined ? {} : { 'recheck.support_completed': completed }),
    };
  }

  /** The owner sees the card; staff also see the input and the full trace. */
  async get(
    id: string,
    viewer: { id: string; roles: readonly string[] },
  ): Promise<DecisionDto | DecisionRecordDto> {
    const record = await this.prisma.decisionRecord.findUnique({
      where: { id },
      include: { version: { select: { label: true } } },
    });
    const staff = staffOf(viewer.roles);
    if (!record || (!staff && record.userId !== viewer.id)) throw new NotFound('decision');
    const dto = this.dto(record, record.version.label);
    return staff ? this.recordDto(record, dto) : dto;
  }

  /**
   * Re-runs a record on its own version and compares (DESIGN §7: must give the identical card).
   * Records the outcome on the record. An engine change is reported, not hidden.
   */
  async replay(id: string, now = new Date()): Promise<ReplayResult> {
    const record = await this.prisma.decisionRecord.findUnique({ where: { id } });
    if (!record) throw new NotFound('decision');
    const engine = await this.runtime.byId(record.versionId);
    const result = run(engine.ruleset, record.input as EngineInput, { trace: 'full' });
    // JSONB doesn't keep key order, so both sides are compared as canonical JSON (RFC 8785).
    const same = (a: unknown, b: unknown): boolean =>
      canonicalJson(a as JsonValue) === canonicalJson(b as JsonValue);
    const sameCard = result.ok && same(result.card, record.card);
    const sameTrace = result.ok && same(result.trace, record.trace);
    const matches = sameCard && sameTrace && record.engineVersion === ENGINE_VERSION;
    await this.prisma.decisionRecord.update({
      where: { id },
      data: { replayedAt: now, replayMatches: matches },
    });
    return {
      matches,
      sameCard,
      sameTrace,
      engineVersion: { recorded: record.engineVersion, running: ENGINE_VERSION },
    };
  }

  /**
   * The daily replay (DESIGN §7): the newest records not yet replayed, from the last day. Any
   * difference is logged as an error, which the log pipeline alerts on.
   */
  async replaySample(now = new Date()): Promise<{ replayed: number; mismatched: string[] }> {
    const records = await this.prisma.decisionRecord.findMany({
      where: { replayedAt: null, createdAt: { gte: new Date(now.getTime() - 86_400_000) } },
      orderBy: { createdAt: 'desc' },
      take: SAMPLE,
      select: { id: true },
    });
    const mismatched: string[] = [];
    for (const r of records) if (!(await this.replay(r.id, now)).matches) mismatched.push(r.id);
    if (mismatched.length > 0)
      this.logger.error(
        { mismatched },
        `decision replay: ${String(mismatched.length)} record(s) no longer give the same card`,
      );
    return { replayed: records.length, mismatched };
  }

  /** The impact of a version against another on the same inputs (M7). */
  /** Decision records, newest first, for staff (filters by light, mode, support screen). */
  async list(q: {
    limit: number;
    before?: string | undefined;
    light?: string | undefined;
    mode?: 'signed_in' | 'browse' | undefined;
    supportScreen?: 'true' | 'false' | undefined;
    since?: string | undefined;
    ruleset?: string | undefined;
  }): Promise<DecisionList> {
    const rows = await this.prisma.decisionRecord.findMany({
      where: {
        // "Which decisions in October used version 3.3-r2" (DESIGN §8 query).
        createdAt: {
          ...(q.before ? { lt: new Date(q.before) } : {}),
          ...(q.since ? { gte: new Date(q.since) } : {}),
        },
        ...(q.ruleset ? { version: { label: q.ruleset } } : {}),
        ...(q.light ? { light: q.light } : {}),
        ...(q.mode ? { mode: q.mode } : {}),
        ...(q.supportScreen ? { supportScreen: q.supportScreen === 'true' } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: q.limit + 1,
      select: {
        id: true,
        createdAt: true,
        mode: true,
        light: true,
        band: true,
        supportScreen: true,
        card: true,
        replayMatches: true,
        version: { select: { label: true } },
      },
    });
    const page = rows.slice(0, q.limit);
    return {
      items: page.map((r) => {
        const p = (r.card as unknown as Card).primary;
        return {
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          mode: r.mode,
          light: r.light,
          band: r.band,
          supportScreen: r.supportScreen,
          ruleset: r.version.label,
          primary: p ? (p.tool ?? ('action' in p.target ? p.target.action : p.pathway)) : null,
          replayMatches: r.replayMatches,
        };
      }),
      next: rows.length > q.limit ? (page.at(-1)?.createdAt.toISOString() ?? null) : null,
    };
  }

  /** The compiled version a record was made with. */
  engineFor(versionId: string): Promise<Runnable> {
    return this.runtime.byId(versionId);
  }

  /** A version's engine on given input facts, nothing stored (the staff Simulator, E-18). */
  assertStaff(roles: readonly string[]): void {
    if (!staffOf(roles)) throw new Forbidden('Staff only.');
  }

  private dto(r: DecisionRecord, label: string): DecisionDto {
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      mode: r.mode,
      ruleset: { label, hash: r.rulesetHash },
      engineVersion: r.engineVersion,
      card: r.card as unknown as DecisionDto['card'],
    };
  }

  private recordDto(r: DecisionRecord, dto: DecisionDto): DecisionRecordDto {
    return {
      ...dto,
      userId: r.userId,
      input: r.input as Record<string, unknown>,
      trace: r.trace,
      recheckOfId: r.recheckOfId,
      replay:
        r.replayedAt && r.replayMatches !== null
          ? { at: r.replayedAt.toISOString(), matches: r.replayMatches }
          : null,
    };
  }
}
