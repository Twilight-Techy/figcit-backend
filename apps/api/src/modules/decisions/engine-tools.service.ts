import { Injectable } from '@nestjs/common';
import {
  checkInCases,
  compare,
  explore,
  flowInputs,
  producible,
  ruleReads,
  run,
  safetyInputs,
  sweepInputs,
  unreachable,
  withoutRows,
  type CaseContext,
  type CheckInCase,
  type CompareReport,
  type CompiledRule,
  type EngineInput,
  type ExploreReport,
  type Query,
  type RunResult,
} from '@figcit/engine-v2';
import type { z } from 'zod';
import { BadInput, NotFound } from '../../common/errors/errors.js';
import { CaseContextService, caseDto } from './case-context.service.js';
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
type NeverFired = ExploreResult['rules']['neverFired'][number];

/** The inputs to run, and for the check-ins set, the check-in each input came from. */
interface InputSet {
  readonly inputs: readonly EngineInput[];
  readonly set: SetReport;
  readonly cases?: ReadonlyMap<EngineInput, CheckInCase>;
  readonly ctx?: CaseContext;
}

/** The check-in an input came from, when the set has one (the engine keeps inputs by reference). */
const fromOf = (s: InputSet, input: EngineInput): { from?: ReturnType<typeof caseDto> } => {
  const c = s.cases?.get(input);
  return c ? { from: caseDto(c) } : {};
};

/**
 * Why a rule no check-in fired didn't fire (E-61): it needs a re-check, which the set doesn't
 * make; a value it needs comes from no option, so the app can never reach it; or it is possible,
 * but no check-in tried the answers it needs together.
 */
function whyNever(rule: CompiledRule, s: InputSet, engine: Runnable): NeverFired {
  const name = `${rule.ref} #${rule.id.split('#')[1] ?? '0'}`;
  if (!s.ctx) return { rule: name, reason: null, values: [] };
  if ([...ruleReads(rule)].some((f) => f.startsWith('recheck.')))
    return { rule: name, reason: 'needs_recheck', values: [] };
  const why = unreachable(rule.when, producible(s.ctx.options, engine.ruleset.catalogue));
  return why
    ? { rule: name, reason: 'no_option', values: why }
    : { rule: name, reason: 'not_tried', values: [] };
}

/**
 * The staff engine tools (E-18, DESIGN §8; M7, E-56, E-57; E-61): the fact Simulator, and the
 * explorer over check-ins the app could send (the default), the sweep, the fact-level set or the
 * safety set; the query; and the impact of a version or of one rule. The explorer runs in the
 * worker (`ExplorationsService`), since its largest set takes about 15 s of CPU.
 */
@Injectable()
export class EngineToolsService {
  constructor(
    private readonly runtime: EngineRuntimeService,
    private readonly contexts: CaseContextService,
  ) {}

  async simulate(label: string, input: EngineInput, trace: 'light' | 'full'): Promise<RunResult> {
    const engine = await this.runtime.byLabel(label);
    return run(engine.ruleset, input, { trace });
  }

  async explore(label: string, body: z.infer<typeof exploreBodySchema>): Promise<ExploreResult> {
    const engine = await this.runtime.byLabel(label);
    const s = await this.inputsFor(engine, body);
    const where = body.where;
    const query: Query | undefined = where
      ? {
          ...(where.light ? { light: where.light } : {}),
          ...(where.primary ? { primary: where.primary } : {}),
          ...(where.rule ? { rows: new Set([this.rowOf(engine, where.rule)]) } : {}),
        }
      : undefined;
    return this.exploreDto(engine, s, explore(engine.ruleset, s.inputs, query));
  }

  async compare(label: string, body: z.infer<typeof compareBodySchema>): Promise<CompareResult> {
    const [after, before] = await Promise.all([
      this.runtime.byLabel(label),
      this.runtime.byLabel(body.against),
    ]);
    const s = await this.inputsFor(after, body);
    return compareDto(s, compare(before.ruleset, after.ruleset, s.inputs));
  }

  /** What one rule affects: the same inputs with and without its row (DESIGN §8 query). */
  async impact(label: string, body: z.infer<typeof impactBodySchema>): Promise<ImpactResult> {
    const engine = await this.runtime.byLabel(label);
    const row = this.rowOf(engine, body.rule);
    const s = await this.inputsFor(engine, body);
    const rows = new Set([row]);
    const fired = explore(engine.ruleset, s.inputs, { rows }).matches?.count ?? 0;
    return {
      ...compareDto(s, compare(engine.ruleset, withoutRows(engine.ruleset, rows), s.inputs)),
      rule: `${body.rule.tab} · ${body.rule.ref}`,
      fired,
    };
  }

  /**
   * The checks that need no run, so a bad request is refused at once instead of failing in the
   * worker: the versions and the rule exist, and the input set can be made.
   */
  async check(
    kind: 'explore' | 'compare' | 'impact' | 'grid',
    label: string,
    body: Partial<z.infer<typeof impactBodySchema>> & {
      against?: string | undefined;
      where?: z.infer<typeof exploreBodySchema>['where'];
      feeling?: string | null | undefined;
    },
  ): Promise<void> {
    const engine = await this.runtime.byLabel(label);
    checkSet(engine, body);
    const checkIns = kind === 'grid' || ((body.set ?? 'checkins') === 'checkins' && !body.inputs);
    if (checkIns) await this.checkCheckIns(engine, body.feeling ?? null);
    const against = kind === 'compare' || kind === 'grid' ? body.against : undefined;
    if (against) await this.runtime.byLabel(against);
    const rule = kind === 'impact' ? body.rule : body.where?.rule;
    if (rule) this.rowOf(engine, rule);
  }

  /** The version can make check-ins (it has options), and offers the feeling picked. */
  private async checkCheckIns(engine: Runnable, feeling: string | null): Promise<void> {
    const ctx = await this.contexts.of(engine);
    if (feeling && !ctx.options.feeling.some((o) => o.code === feeling))
      throw new BadInput(`${engine.label} offers no feeling "${feeling}".`);
  }

  /** The inputs to run: the caller's own, or one of the named sets. */
  private async inputsFor(engine: Runnable, body: SetChoice): Promise<InputSet> {
    if (body.inputs) {
      if (body.inputs.length === 0)
        throw new BadInput('Give at least one input, or none for a set.');
      return { inputs: body.inputs, set: { name: 'inputs' } };
    }
    const sampling = {
      ...(body.sample !== undefined ? { sample: body.sample } : {}),
      ...(body.seed !== undefined ? { seed: body.seed } : {}),
    };
    switch (body.set) {
      case 'checkins': {
        const ctx = await this.contexts.of(engine);
        const c = checkInCases(engine.ruleset, ctx, sampling);
        return {
          inputs: c.cases.map((x) => x.input),
          set: { name: 'checkins', parts: { ...c.parts } },
          cases: new Map(c.cases.map((x) => [x.input, x])),
          ctx,
        };
      }
      case 'sweep':
        return { inputs: sweepInputs(engine.ruleset.catalogue), set: { name: 'sweep' } };
      case 'flows': {
        const f = flowInputs(engine.ruleset, sampling);
        return { inputs: f.inputs, set: { name: 'flows', parts: { ...f.parts } } };
      }
      case 'safety':
        return this.safetySet(engine);
    }
  }

  private safetySet(engine: Runnable): InputSet {
    if (engine.safetyRows.size === 0) throw new BadInput('This version has no rows marked safety.');
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

  private rowOf(engine: Runnable, rule: RuleRef): string {
    const row = engine.rowByRef.get(`${rule.tab}|${rule.ref}`);
    if (!row) throw new NotFound(`rule ${rule.tab} · ${rule.ref}`);
    return row;
  }

  private exploreDto(engine: Runnable, s: InputSet, r: ExploreReport): ExploreResult {
    return {
      set: s.set,
      ran: r.ran,
      refused: r.refused,
      rules: {
        total: engine.ruleset.rules.length,
        neverFired: engine.ruleset.rules
          .filter((rule) => (r.fired[rule.id] ?? 0) === 0)
          .map((rule) => whyNever(rule, s, engine)),
      },
      byLight: r.byLight,
      byPrimary: r.byPrimary,
      checks: {
        counts: r.counts,
        violations: r.violations.map((v) => ({
          ...v,
          input: { ...v.input },
          rows: [...v.rows],
          ...fromOf(s, v.input),
        })),
      },
      map: r.map.map((c) => ({ ...c })),
      noOutcome: {
        count: r.noOutcome.count,
        examples: r.noOutcome.examples.map((i) => ({ input: { ...i }, ...fromOf(s, i) })),
      },
      ...(r.matches
        ? {
            matches: {
              count: r.matches.count,
              examples: r.matches.examples.map((m) => ({
                ...m,
                input: { ...m.input },
                ...fromOf(s, m.input),
              })),
            },
          }
        : {}),
    };
  }
}

/** The input set asked for can be made: own inputs aren't empty; a safety set has safety rows. */
function checkSet(engine: Runnable, body: Partial<SetChoice>): void {
  if (body.inputs?.length === 0) throw new BadInput('Give at least one input, or none for a set.');
  if (body.set === 'safety' && !body.inputs && engine.safetyRows.size === 0)
    throw new BadInput('This version has no rows marked safety.');
}

const compareDto = (s: InputSet, r: CompareReport): CompareResult => ({
  set: s.set,
  ran: r.ran,
  changed: r.changed,
  examples: r.examples.map((e) => ({ ...e, input: { ...e.input }, ...fromOf(s, e.input) })),
});
