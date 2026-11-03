import { Injectable } from '@nestjs/common';
import type { Prisma, SimScenario, SimScenarioRun } from '@prisma/client';
import { PrismaService } from '../../common/db/prisma.service.js';
import { NotFound } from '../../common/errors/errors.js';
import { RulesetAuditService, type Actor } from '../rulesets/ruleset-audit.service.js';
import { CheckInSimulatorService } from './checkin-simulator.service.js';
import { EngineRuntimeService } from './engine-runtime.service.js';
import type {
  ScenarioBody,
  ScenarioDto,
  ScenarioOutcome,
  SimulateCheckInBody,
  SimulateCheckInResult,
  scenarioRunSchema,
  scenarioSummarySchema,
} from './simulator.schemas.js';
import { simulateCheckInBodySchema } from './simulator.schemas.js';
import type { z } from 'zod';

type RunDto = z.infer<typeof scenarioRunSchema>;
type SummaryDto = z.infer<typeof scenarioSummarySchema>;

const RUNS_KEPT = 100;

/** Scenarios are saved and run by a signed-in staff member, never the system. */
export type StaffActor = Actor & { readonly id: string };

/** The card a run gave, in codes and labels (no trace, no input: the scenario has those). */
export function outcomeOf(r: SimulateCheckInResult): ScenarioOutcome {
  const o = r.outcome;
  if (!o.ok)
    return {
      ok: false,
      light: null,
      band: null,
      kind: null,
      primary: null,
      alternatives: [],
      handEdited: r.handEdited,
    };
  return {
    ok: true,
    light: o.card.light,
    band: o.card.band,
    kind: o.card.kind,
    primary: { label: o.shown.primary.label, tool: o.shown.primary.toolId ?? null },
    alternatives: o.shown.alternatives.map((a) => a.label),
    handEdited: r.handEdited,
  };
}

const runDto = (r: SimScenarioRun): RunDto => ({
  id: r.id,
  label: r.label,
  ranAt: r.ranAt.toISOString(),
  ranBy: r.ranBy,
  outcome: r.outcome as unknown as ScenarioOutcome,
});

const summaryDto = (s: SimScenario, last: SimScenarioRun | undefined): SummaryDto => ({
  id: s.id,
  name: s.name,
  createdAt: s.createdAt.toISOString(),
  createdBy: s.createdBy,
  lastRun: last ? runDto(last) : null,
});

/**
 * The Simulator's saved scenarios (E-61): shared by the staff who use the Simulator. Saving and
 * deleting one goes on the rules audit chain; each run is kept with the version it ran on and
 * the card it gave, so a rule change shows as a different card on the next run.
 */
@Injectable()
export class ScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: RulesetAuditService,
    private readonly simulator: CheckInSimulatorService,
    private readonly runtime: EngineRuntimeService,
  ) {}

  async list(): Promise<SummaryDto[]> {
    const rows = await this.prisma.simScenario.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { runs: { orderBy: { ranAt: 'desc' }, take: 1 } },
    });
    return rows.map((s) => summaryDto(s, s.runs[0]));
  }

  async get(id: string): Promise<ScenarioDto> {
    const s = await this.prisma.simScenario.findUnique({
      where: { id },
      include: { runs: { orderBy: { ranAt: 'desc' }, take: RUNS_KEPT } },
    });
    if (!s) throw new NotFound('scenario');
    return {
      ...summaryDto(s, s.runs[0]),
      answers: s.answers as Record<string, unknown>,
      request: s.request as Record<string, unknown>,
      runs: s.runs.map(runDto),
    };
  }

  async create(actor: StaffActor, body: ScenarioBody): Promise<ScenarioDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const s = await tx.simScenario.create({
        data: {
          name: body.name,
          answers: body.answers as Prisma.InputJsonValue,
          request: body.request as unknown as Prisma.InputJsonValue,
          createdBy: actor.id,
        },
      });
      await this.audit.append(tx, actor, {
        action: 'scenario.create',
        detail: { scenarioId: s.id, name: s.name },
      });
      return s.id;
    });
    return this.get(id);
  }

  async remove(actor: StaffActor, id: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const s = await tx.simScenario.findUnique({
        where: { id },
        include: { _count: { select: { runs: true } } },
      });
      if (!s) throw new NotFound('scenario');
      await tx.simScenario.delete({ where: { id } });
      await this.audit.append(tx, actor, {
        action: 'scenario.delete',
        detail: { scenarioId: s.id, name: s.name, runs: s._count.runs, reason },
      });
    });
  }

  /** Runs a scenario on a version and keeps the run. */
  async run(
    actor: StaffActor,
    id: string,
    label: string,
  ): Promise<{ run: RunDto; result: SimulateCheckInResult }> {
    const s = await this.prisma.simScenario.findUnique({ where: { id } });
    if (!s) throw new NotFound('scenario');
    // Stored requests were checked when saved; parsing again fills defaults added since.
    const request: SimulateCheckInBody = simulateCheckInBodySchema.parse(s.request);
    const engine = await this.runtime.byLabel(label);
    const result = await this.simulator.simulate(label, request);
    const run = await this.prisma.simScenarioRun.create({
      data: {
        scenarioId: s.id,
        versionId: engine.id,
        label: engine.label,
        ranBy: actor.id,
        outcome: outcomeOf(result),
      },
    });
    return { run: runDto(run), result };
  }
}
