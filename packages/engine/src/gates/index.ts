// Stage 8: Reflect and Meditate gates (Tab 6c RF-1–RF-5, MD-1–MD-6) with their Tab 7 fallbacks.
import {
  meditateGuard,
  ruminationPlan,
  type Facts,
  type Plan,
  type StepSpec,
} from '../patterns/index.js';
import type { GateResult, Light } from '../types.js';

export interface GateOutcome {
  readonly plan: Plan;
  readonly gates: readonly GateResult[];
}

const isReflect = (s: StepSpec | undefined): boolean =>
  s?.type === 'tool' && s.pathway === 'reflect';
const isMeditate = (s: StepSpec | undefined): boolean =>
  (s?.type === 'tool' && s.pathway === 'meditate') ||
  (s?.type === 'action' && s.kind === 'own_practice');

/** RF-1 / RF-2: may Reflect be offered at all right now? */
export function reflectBlocked(f: Facts, light: Light): string | undefined {
  const { high } = f.cs.source.thresholds;
  if (light === 'red') return 'RF-1: Red';
  if (light === 'amber') return 'RF-1: Amber (save for later)';
  if (f.exp.peakNegative >= high) return 'RF-1: negative intensity High+';
  if (f.exp.families.has('rumination')) return 'RF-2: rumination';
  if ((f.signals.ruminationTopics?.length ?? 0) > 0) return 'RF-2: same topic 3+ times in 7 days';
  if (f.trend === 'worse' && f.input.recheckOf?.pathway === 'reflect')
    return 'RF-2: re-check after Reflect is worse';
  return undefined;
}

/** MD-1: may Meditate be the primary action? */
function meditatePrimaryAllowed(f: Facts, light: Light): boolean {
  if (light === 'green' || light === 'yellow' || light === 'blue') return true;
  if (light === 'amber') return f.exp.peakNegative < f.cs.source.thresholds.moderate;
  return false;
}

const userInitiated = (f: Facts): boolean =>
  f.input.intent === 'meditate' || f.signals.savedPractices?.some((p) => p.dueNow) === true;

function applyReflectGate(f: Facts, plan: Plan, light: Light, gates: GateResult[]): Plan {
  const blocked = reflectBlocked(f, light);
  if (!blocked) {
    if (isReflect(plan.primary) || plan.alternatives.some(isReflect))
      gates.push({ rule: 'RF-1', effect: 'allowed', detail: 'Reflect allowed' });
    return plan;
  }
  if (isReflect(plan.primary)) {
    gates.push({ rule: blocked.slice(0, 4), effect: 'blocked', detail: blocked });
    const fallback = ruminationPlan(f);
    const later: StepSpec = { type: 'action', kind: 'save_for_later', label: 'Save it for later' };
    return {
      ...fallback,
      alternatives: light === 'amber' ? [later, ...fallback.alternatives] : fallback.alternatives,
    };
  }
  const alternatives = plan.alternatives.filter((a) => !isReflect(a));
  if (alternatives.length !== plan.alternatives.length)
    gates.push({
      rule: blocked.slice(0, 4),
      effect: 'limited',
      detail: `${blocked}; Reflect alternative removed`,
    });
  return { ...plan, alternatives };
}

const REGULATE_STEP: StepSpec = {
  type: 'tool',
  pathway: 'regulate',
  tools: ['breathe', 'ground'],
  label: 'Breathe',
};

/** MD-2: contraindications remove Meditate; the user's own saved practice stays only if they started it. */
function guardMeditate(f: Facts, plan: Plan, gates: GateResult[]): Plan {
  gates.push({
    rule: 'MD-2',
    effect: 'blocked',
    detail: 'contraindication: no eyes-closed or body-scan practice; Regulate first',
  });
  const keepOwn = userInitiated(f)
    ? plan.alternatives.filter((a) => a.type === 'action' && a.kind === 'own_practice')
    : [];
  const primaryWasMeditate = isMeditate(plan.primary);
  return {
    ...plan,
    patterns:
      primaryWasMeditate && !plan.patterns.includes(41) ? [41, ...plan.patterns] : plan.patterns,
    primary: primaryWasMeditate
      ? { type: 'tool', pathway: 'regulate', tools: ['breathe', 'ground'] }
      : plan.primary,
    alternatives: [...plan.alternatives.filter((a) => !isMeditate(a)), ...keepOwn],
    ...(isMeditate(plan.queued) ? { queued: undefined } : {}),
  };
}

/** MD-1: outside Green/Yellow/Blue (or calm Amber), Regulate leads and the practice is an alternative. */
function demoteMeditate(f: Facts, plan: Plan, light: Light, gates: GateResult[]): Plan {
  gates.push({
    rule: 'MD-1',
    effect: 'limited',
    detail: `${light}: Regulate primary, practice as an alternative`,
  });
  const asAlternative = light === 'red' && !userInitiated(f) ? [] : [plan.primary];
  return {
    ...plan,
    primary: REGULATE_STEP,
    alternatives: [...asAlternative, ...plan.alternatives],
    supportVisible: light === 'red' || plan.supportVisible === true,
  };
}

function applyMeditateGate(f: Facts, plan: Plan, light: Light, gates: GateResult[]): Plan {
  const involved =
    isMeditate(plan.primary) || plan.alternatives.some(isMeditate) || isMeditate(plan.queued);
  if (!involved) return plan;
  if (meditateGuard(f)) return guardMeditate(f, plan, gates);
  if (isMeditate(plan.primary) && !meditatePrimaryAllowed(f, light))
    return demoteMeditate(f, plan, light, gates);
  gates.push({ rule: 'MD-1', effect: 'allowed', detail: `${light}: Meditate allowed` });
  if (!f.ctx.privateSetting)
    gates.push({
      rule: 'MD-4',
      effect: 'limited',
      detail: 'public or observed: silent, eyes-open, 3 minutes or less',
    });
  return plan;
}

export function applyGates(f: Facts, plan: Plan, light: Light): GateOutcome {
  const gates: GateResult[] = [];
  let gated = applyReflectGate(f, plan, light, gates);
  gated = applyMeditateGate(f, gated, light, gates);
  // MD-6: neither pathway may hide "Get support now".
  if (light === 'red' || f.safety) gated = { ...gated, supportVisible: true };
  return { plan: gated, gates };
}
