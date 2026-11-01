import { Injectable, Logger } from '@nestjs/common';
import {
  canonicalJson,
  ENGINE_VERSION,
  explore,
  factsFromCheckIn,
  run,
  type Card,
  type Catalogue,
  type EngineInput,
  type JsonValue,
  type RunResult,
} from '@figcit/engine-v2';
import { Prisma, type DecisionRecord } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service.js';
import {
  AppError,
  BadInput,
  Forbidden,
  NotConfigured,
  NotFound,
} from '../../common/errors/errors.js';
import { demandTimeline, validateOptions } from '../checkin/checkin.mapper.js';
import { SignalsService } from '../recommendation/signals.service.js';
import { CheckInOptionsService } from '../rulesets/checkin-options.service.js';
import { daysInRed, lastFact, recheckFacts, signalFacts } from './decision-facts.js';
import type {
  DecideBody,
  DecisionDto,
  DecisionRecordDto,
  ExploreResult,
  ReplayResult,
} from './decisions.schemas.js';
import { EngineRuntimeService } from './engine-runtime.service.js';

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
  ) {}

  async decide(
    body: DecideBody,
    userId: string | undefined,
    now = new Date(),
  ): Promise<DecisionDto> {
    const offered = await this.options.current();
    if (!offered)
      throw new NotConfigured('No engine v2 rule set with check-in options is published yet.');
    validateOptions(body, offered);
    const engine = await this.runtime.current();
    const server = userId
      ? await this.serverFacts(userId, body, engine.ruleset.catalogue, now)
      : { zone: BROWSE_ZONE, facts: { 'signals.plan': 'free' } };
    const input = factsFromCheckIn(body, offered.options, engine.ruleset.catalogue, {
      timeline: demandTimeline(body.demand, now, server.zone),
      facts: server.facts,
    });
    const result = run(engine.ruleset, input, { trace: 'full' });
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
    const record = await this.prisma.decisionRecord.create({
      data: {
        mode: userId ? 'signed_in' : 'browse',
        userId: userId ?? null,
        versionId: engine.id,
        rulesetHash: engine.hash ?? '',
        engineVersion: ENGINE_VERSION,
        input: input as Prisma.InputJsonValue,
        card: result.card as unknown as Prisma.InputJsonValue,
        trace: result.trace as unknown as Prisma.InputJsonValue,
        band: result.card.band,
        light: result.card.light,
        supportScreen: result.card.kind === 'support_screen',
        recheckOfId: userId ? (body.recheckOfId ?? null) : null,
        createdAt: now,
      },
    });
    return this.dto(record, engine.label);
  }

  /** The account's signals, SF-2's run of Red days, and the re-check of an earlier decision. */
  private async serverFacts(
    userId: string,
    body: DecideBody,
    catalogue: Catalogue,
    now: Date,
  ): Promise<{ zone: string; facts: EngineInput }> {
    const [user, signals, reds, previous] = await Promise.all([
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
      body.recheckOfId
        ? this.prisma.decisionRecord.findFirst({ where: { id: body.recheckOfId, userId } })
        : Promise.resolve(null),
    ]);
    if (body.recheckOfId && !previous) throw new NotFound('decision to re-check');
    return {
      zone: user.timezone,
      facts: {
        ...signalFacts(signals, catalogue),
        'signals.days_very_constrained': daysInRed(
          reds.map((r) => r.createdAt),
          now,
          user.timezone,
        ),
        ...(previous
          ? recheckFacts({
              band: previous.band,
              light: previous.light,
              card: previous.card as unknown as Card,
              peak: lastFact(previous.trace, 'peak.negative') as number | null | undefined,
            })
          : {}),
      },
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

  /** A version's engine on given input facts, nothing stored (the staff Simulator, E-18). */
  async simulate(label: string, input: EngineInput, trace: 'light' | 'full'): Promise<RunResult> {
    const engine = await this.runtime.byLabel(label);
    return run(engine.ruleset, input, { trace });
  }

  /** A version's engine over many inputs, or the publish sweep (the staff explorer, DESIGN §8). */
  async explore(label: string, inputs: readonly EngineInput[] | undefined): Promise<ExploreResult> {
    const engine = await this.runtime.byLabel(label);
    if (inputs?.length === 0) throw new BadInput('Give at least one input, or none for the sweep.');
    const r = explore(engine.ruleset, inputs);
    return {
      ran: r.ran,
      refused: r.refused,
      byLight: r.byLight,
      byPrimary: r.byPrimary,
      checks: {
        counts: r.counts,
        violations: r.violations.map((v) => ({ ...v, rows: [...v.rows] })),
      },
    };
  }

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
