import { Injectable } from '@nestjs/common';
import {
  compare,
  explore,
  flowInputs,
  run,
  safetyInputs,
  sweepInputs,
  withoutRows,
  type CompareReport,
  type EngineInput,
  type ExploreReport,
  type Query,
  type RunResult,
} from '@figcit/engine-v2';
import type { z } from 'zod';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import type {
  compareBodySchema,
  CompareResult,
  exploreBodySchema,
  ExploreResult,
  impactBodySchema,
  ImpactResult,
} from './decisions.schemas.js';
import { EngineRuntimeService, type Runnable } from './engine-runtime.service.js';

type SetChoice = Pick<z.infer<typeof exploreBodySchema>, 'inputs' | 'set' | 'sample' | 'seed'>;
type SetReport = ExploreResult['set'];
type RuleRef = { tab: string; ref: string };

/**
 * The staff engine tools (E-18, DESIGN §8; M7, E-56, E-57): the Simulator, and the explorer over
 * the sweep, the all-flows set or the safety set, the query, and the impact of a version or of one
 * rule. The Simulator runs in the request (one run); the explorer runs in the worker
 * (`ExplorationsService`), since its largest set takes about 15 s of CPU.
 */
@Injectable()
export class EngineToolsService {
  constructor(private readonly runtime: EngineRuntimeService) {}

  async simulate(label: string, input: EngineInput, trace: 'light' | 'full'): Promise<RunResult> {
    const engine = await this.runtime.byLabel(label);
    return run(engine.ruleset, input, { trace });
  }

  async explore(label: string, body: z.infer<typeof exploreBodySchema>): Promise<ExploreResult> {
    const engine = await this.runtime.byLabel(label);
    const { inputs, set } = this.inputsFor(engine, body);
    const where = body.where;
    const query: Query | undefined = where
      ? {
          ...(where.light ? { light: where.light } : {}),
          ...(where.primary ? { primary: where.primary } : {}),
          ...(where.rule ? { rows: new Set([this.rowOf(engine, where.rule)]) } : {}),
        }
      : undefined;
    return this.exploreDto(engine, set, explore(engine.ruleset, inputs, query));
  }

  async compare(label: string, body: z.infer<typeof compareBodySchema>): Promise<CompareResult> {
    const [after, before] = await Promise.all([
      this.runtime.byLabel(label),
      this.runtime.byLabel(body.against),
    ]);
    const { inputs, set } = this.inputsFor(after, body);
    return compareDto(set, compare(before.ruleset, after.ruleset, inputs));
  }

  /** What one rule affects: the same inputs with and without its row (DESIGN §8 query). */
  async impact(label: string, body: z.infer<typeof impactBodySchema>): Promise<ImpactResult> {
    const engine = await this.runtime.byLabel(label);
    const row = this.rowOf(engine, body.rule);
    const { inputs, set } = this.inputsFor(engine, body);
    const rows = new Set([row]);
    const fired = explore(engine.ruleset, inputs, { rows }).matches?.count ?? 0;
    return {
      ...compareDto(set, compare(engine.ruleset, withoutRows(engine.ruleset, rows), inputs)),
      rule: `${body.rule.tab} · ${body.rule.ref}`,
      fired,
    };
  }

  /**
   * The checks that need no run, so a bad request is refused at once instead of failing in the
   * worker: the versions and the rule exist, and the input set can be made.
   */
  async check(
    kind: 'explore' | 'compare' | 'impact',
    label: string,
    body: Partial<z.infer<typeof impactBodySchema>> & {
      against?: string;
      where?: z.infer<typeof exploreBodySchema>['where'];
    },
  ): Promise<void> {
    const engine = await this.runtime.byLabel(label);
    if (body.inputs?.length === 0)
      throw new BadInput('Give at least one input, or none for a set.');
    if (body.set === 'safety' && !body.inputs && engine.safetyRows.size === 0)
      throw new BadInput('This version has no rows marked safety.');
    if (kind === 'compare' && body.against) await this.runtime.byLabel(body.against);
    const rule = kind === 'impact' ? body.rule : body.where?.rule;
    if (rule) this.rowOf(engine, rule);
  }

  /** The inputs to run: the caller's own, or one of the named sets. */
  private inputsFor(
    engine: Runnable,
    body: SetChoice,
  ): { inputs: readonly EngineInput[]; set: SetReport } {
    if (body.inputs) {
      if (body.inputs.length === 0)
        throw new BadInput('Give at least one input, or none for a set.');
      return { inputs: body.inputs, set: { name: 'inputs' } };
    }
    switch (body.set) {
      case 'sweep':
        return { inputs: sweepInputs(engine.ruleset.catalogue), set: { name: 'sweep' } };
      case 'flows': {
        const f = flowInputs(engine.ruleset, {
          ...(body.sample !== undefined ? { sample: body.sample } : {}),
          ...(body.seed !== undefined ? { seed: body.seed } : {}),
        });
        return { inputs: f.inputs, set: { name: 'flows', parts: { ...f.parts } } };
      }
      case 'safety': {
        if (engine.safetyRows.size === 0)
          throw new BadInput('This version has no rows marked safety.');
        const s = safetyInputs(engine.ruleset, engine.safetyRows);
        return {
          inputs: s.inputs,
          set: {
            name: 'safety',
            facts: [...s.facts],
            exhaustive: s.exhaustive,
            combinations: s.combinations,
          },
        };
      }
    }
  }

  private rowOf(engine: Runnable, rule: RuleRef): string {
    const row = engine.rowByRef.get(`${rule.tab}|${rule.ref}`);
    if (!row) throw new NotFound(`rule ${rule.tab} · ${rule.ref}`);
    return row;
  }

  private exploreDto(engine: Runnable, set: SetReport, r: ExploreReport): ExploreResult {
    const neverFired = engine.ruleset.rules
      .filter((rule) => (r.fired[rule.id] ?? 0) === 0)
      .map((rule) => `${rule.ref} #${rule.id.split('#')[1] ?? '0'}`);
    return {
      set,
      ran: r.ran,
      refused: r.refused,
      rules: { total: engine.ruleset.rules.length, neverFired },
      byLight: r.byLight,
      byPrimary: r.byPrimary,
      checks: {
        counts: r.counts,
        violations: r.violations.map((v) => ({ ...v, input: { ...v.input }, rows: [...v.rows] })),
      },
      map: r.map.map((c) => ({ ...c })),
      noOutcome: {
        count: r.noOutcome.count,
        examples: r.noOutcome.examples.map((i) => ({ ...i })),
      },
      ...(r.matches
        ? {
            matches: {
              count: r.matches.count,
              examples: r.matches.examples.map((m) => ({ ...m, input: { ...m.input } })),
            },
          }
        : {}),
    };
  }
}

const compareDto = (set: SetReport, r: CompareReport): CompareResult => ({
  set,
  ran: r.ran,
  changed: r.changed,
  examples: r.examples.map((e) => ({ ...e, input: { ...e.input } })),
});
