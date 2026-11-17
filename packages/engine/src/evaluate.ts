// The engine: evaluate(input, snapshot, signals) runs stages 0–12 (SYSTEM_DESIGN §5.2).
import { applyGates } from './gates/index.js';
import { matchPattern, type Facts, type Plan } from './patterns/index.js';
import { assessRecheck, differentRoute, recoveryPlan, type Recheck } from './recheck.js';
import { compileSnapshot } from './snapshot.js';
import { applyModifiers } from './stages/band.js';
import { buildCard, rationale, type Card } from './stages/card.js';
import { titleFor } from './stages/title.js';
import { analyseContext } from './stages/context.js';
import { analyseDemand, resolveNeeds } from './stages/demand.js';
import { analyseExperience } from './stages/experience.js';
import { resolveState } from './stages/state.js';
import type {
  Band,
  EngineInput,
  EngineResult,
  GateResult,
  Light,
  Snapshot,
  TraceStep,
  UserSignals,
} from './types.js';

export const ENGINE_VERSION = '1.1.2';

const LIGHT_BY_BAND: Readonly<Record<Band, Light>> = {
  available: 'green',
  conditional: 'yellow',
  constrained: 'amber',
  very_constrained: 'red',
};

function lightFor(
  band: Band,
  recheck: Recheck | undefined,
  signals: UserSignals,
  safety: boolean,
): Light {
  if (safety) return 'red';
  if (recheck?.blue === true) return 'blue';
  if (!recheck && signals.recoveryActive === true && band !== 'very_constrained') return 'blue';
  return LIGHT_BY_BAND[band];
}

const listed = (items: readonly string[]): string => (items.length > 0 ? items.join(', ') : 'none');

/** Stages 0–6: everything the pattern rules read. */
function analyse(
  input: EngineInput,
  snapshot: Snapshot,
  signals: UserSignals,
  trace: TraceStep[],
): { f: Facts; recheck: Recheck | undefined } {
  const cs = compileSnapshot(snapshot);
  const safety = cs.safety.check(input.freeText ?? []);
  trace.push({
    stage: 0,
    name: 'safety',
    notes: [safety ? `matched ${safety.ruleId}` : 'no risk language'],
  });
  const state = resolveState(cs, input);
  trace.push({ stage: 1, name: 'state', notes: [`${state.cellId} baseline ${state.baseline}`] });
  const exp = analyseExperience(cs, input);
  trace.push({
    stage: 2,
    name: 'experience',
    notes: [
      `families ${listed([...exp.families].map(([k, v]) => `${k}:${String(v)}`))}`,
      ...exp.notes,
    ],
  });
  const ctx = analyseContext(cs, input);
  trace.push({
    stage: 3,
    name: 'context',
    notes: [
      `${ctx.settingClass}, ${String(ctx.sensitivityCount)} flags, excluded ${listed([...ctx.excluded])}`,
    ],
  });

  const base = { cs, input, signals, state, exp, ctx, safety, needs: resolveNeeds(cs, input) };
  let band = applyModifiers(cs, state, exp, ctx);
  const recheck = assessRecheck(
    { ...base, demand: analyseDemand(cs, input, band.final, { needs: base.needs }) },
    band,
  );
  if (recheck) band = recheck.band;
  // Mirrors lightFor: a Blue re-check, or a recovery window still open from an earlier one.
  const recovery =
    !safety &&
    (recheck?.blue === true ||
      (!recheck && signals.recoveryActive === true && band.final !== 'very_constrained'));
  trace.push({
    stage: 4,
    name: 'band',
    notes: [
      `${band.baseline} → ${band.final}`,
      ...band.modifiers.map((m) => `${m.rule}: ${m.reason}`),
    ],
  });
  const demand = analyseDemand(cs, input, band.final, { needs: base.needs, gentle: recovery });
  trace.push({
    stage: 6,
    name: 'demand',
    notes: [
      demand.present
        ? `${demand.timeline?.code ?? '?'}; drivers ${listed(demand.usedDrivers)}${recovery ? ' (RC-2 gentle)' : ''}`
        : 'no demand',
    ],
  });
  const trend = recheck?.outcome;
  return { f: { ...base, band, demand, recovery, ...(trend ? { trend } : {}) }, recheck };
}

const gateNotes = (gates: readonly GateResult[]): string[] =>
  gates.map((g) => `${g.rule} ${g.effect}: ${g.detail}`);

/** Full-demand task patterns that RC-2 replaces with the gentle recovery plan (pattern 31). */
const GENTLE_SWAP = new Set([2, 14]);

/** Stages 7–12: pattern, gates, tools, entitlement, card. */
function decide(
  f: Facts,
  recheck: Recheck | undefined,
  light: Light,
  trace: TraceStep[],
): { plan: Plan; card: Card; gates: readonly GateResult[] } {
  const triggered = f.safety !== null || f.exp.riskOption !== undefined;
  let plan = recheck?.blue === true && !triggered ? recoveryPlan(f) : matchPattern(f);
  if (recheck?.rule === 'RC-4') plan = differentRoute(plan, f);
  // RC-2: in the recovery window an open-band task is not started at full demand.
  if (f.recovery && !triggered && GENTLE_SWAP.has(plan.patterns[0] ?? 0)) plan = recoveryPlan(f);
  trace.push({ stage: 7, name: 'patterns', notes: [`pattern ${plan.patterns.join(' + ')}`] });
  const applied = applyGates(f, plan, light);
  // G-ST3 / RC-4: a worse re-check is a safety signal, so the Support pathway is visible.
  const gated =
    f.trend === 'worse' ? { ...applied, plan: { ...applied.plan, supportVisible: true } } : applied;
  trace.push({ stage: 8, name: 'gates', notes: gateNotes(gated.gates) });
  const notes: string[] = [];
  const card = buildCard(f, gated.plan, light, notes);
  trace.push({ stage: 9, name: 'tools', notes: notes.length > 0 ? notes : ['plan tools usable'] });
  trace.push({ stage: 10, name: 'entitlement', notes: gateNotes(card.gates) });
  trace.push({
    stage: 12,
    name: 'card',
    notes: [`primary ${card.primary.toolId ?? card.primary.kind}`],
  });
  return { plan: gated.plan, card, gates: [...gated.gates, ...card.gates] };
}

function stateOf(f: Facts): EngineResult['state'] {
  const cell = f.state.cell;
  const shown = cell
    ? { name: cell.name, icon: cell.icon, meaning: cell.meaning }
    : { name: 'Not sure yet', icon: '❔', meaning: "That's okay. Let's start with your body." };
  return { cellId: f.state.cellId, ...shown, confirmed: f.state.confirmed };
}

function safetyOf(f: Facts): EngineResult['safety'] {
  if (f.safety)
    return {
      triggered: true,
      ruleId: f.safety.ruleId,
      category: f.safety.category,
      source: 'phrase',
    };
  if (f.exp.riskOption !== undefined)
    return { triggered: true, ruleId: 'SF-1.option', category: 'option', source: 'option' };
  return { triggered: false };
}

export function evaluate(
  input: EngineInput,
  snapshot: Snapshot,
  signals: UserSignals,
): EngineResult {
  const trace: TraceStep[] = [];
  const { f, recheck } = analyse(input, snapshot, signals, trace);
  const safety = safetyOf(f);
  const light = lightFor(f.band.final, recheck, signals, safety.triggered);
  const { plan, card, gates } = decide(f, recheck, light, trace);
  const pattern = f.cs.patternById.get(plan.patterns[0] ?? 0);
  const timeline = f.demand.timeline;
  return {
    engineVersion: ENGINE_VERSION,
    snapshotVersion: snapshot.version,
    safety,
    state: stateOf(f),
    band: f.band,
    light,
    patterns: plan.patterns,
    primary: card.primary,
    alternatives: card.alternatives,
    ...(card.queued ? { queuedStep: card.queued } : {}),
    supportVisible: plan.supportVisible === true || light === 'red',
    notNow: !safety.triggered,
    title: titleFor(f, plan, card, light),
    rationale: {
      templateId: `P${String(plan.patterns[0] ?? 0)}`,
      text: rationale(
        f,
        plan,
        plan.suggestion ?? pattern?.suggestion ?? 'one small step',
        card.queued,
      ),
    },
    // Demand is deferred under a safety override, as in Red.
    drivers: safety.triggered ? [] : f.demand.usedDrivers,
    ...(timeline ? { timeline: { code: timeline.code, stepCap: timeline.stepCap } } : {}),
    gates,
    setting: {
      settingClass: f.ctx.settingClass,
      sensitivityCount: f.ctx.sensitivityCount,
      excludedTools: [...f.ctx.excluded].sort(),
    },
    ...(recheck ? { recheck: { outcome: recheck.outcome, rule: recheck.rule } } : {}),
    trace,
  };
}

/** Re-check after a support session: the same engine with the previous outcome attached. */
export function evaluateRecheck(
  previous: NonNullable<EngineInput['recheckOf']>,
  recheck: Omit<EngineInput, 'recheckOf'>,
  snapshot: Snapshot,
  signals: UserSignals,
): EngineResult {
  return evaluate({ ...recheck, recheckOf: previous }, snapshot, signals);
}
