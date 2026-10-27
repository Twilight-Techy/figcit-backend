// Stage 4: band safety modifiers EX-1, CX-1, CAP-1, UP-0, DEM-0 and the E4M1 rule (Tab 10).
import type { CompiledSnapshot } from '../snapshot.js';
import { BANDS, type Band, type Modifier } from '../types.js';
import type { ContextResult } from './context.js';
import type { ExperienceResult } from './experience.js';
import type { StateResult } from './state.js';

export interface BandResult {
  readonly baseline: Band;
  readonly final: Band;
  readonly modifiers: readonly Modifier[];
}

export function bandStep(band: Band): number {
  return BANDS.indexOf(band);
}

export function bandAt(step: number): Band {
  return BANDS[Math.max(0, Math.min(BANDS.length - 1, step))] ?? 'very_constrained';
}

function ex1Reason(cs: CompiledSnapshot, exp: ExperienceResult): string | undefined {
  const { high } = cs.source.thresholds;
  for (const [code, intensity] of exp.families) {
    const family = cs.familyByCode.get(code);
    if (family?.ex1 === 'any') return `${code} at any intensity`;
    if (family?.ex1 === 'high' && intensity >= high) return `${code} at ${String(intensity)}`;
  }
  if (exp.painIntensity >= high) return `pain sensation at ${String(exp.painIntensity)}`;
  if (exp.flags.has('shutdown')) return 'shutdown sensation';
  return undefined;
}

function cx1Applies(cs: CompiledSnapshot, exp: ExperienceResult, ctx: ContextResult): boolean {
  if (!ctx.cx1Setting || ctx.sensitivityCount < cs.source.thresholds.cx1Flags) return false;
  for (const code of exp.families.keys()) if (cs.familyByCode.get(code)?.cx1) return true;
  return exp.overloadIntensity > 0;
}

export function applyModifiers(
  cs: CompiledSnapshot,
  state: StateResult,
  exp: ExperienceResult,
  ctx: ContextResult,
): BandResult {
  const modifiers: Modifier[] = [];
  // E4M1 and NS-1 baselines are both Conditional (Tab 10).
  if (state.cellId === 'E4M1')
    modifiers.push({ rule: 'E4M1', steps: 0, reason: 'baseline treated as Conditional' });
  if (!state.confirmed)
    modifiers.push({ rule: 'NS-1', steps: 0, reason: 'Conditional until a state is confirmed' });

  let drop = 0;
  const ex1 = ex1Reason(cs, exp);
  if (ex1) {
    drop += 1;
    modifiers.push({ rule: 'EX-1', steps: -1, reason: ex1 });
  }
  if (cx1Applies(cs, exp, ctx)) {
    drop += 1;
    modifiers.push({
      rule: 'CX-1',
      steps: -1,
      reason: `${String(ctx.sensitivityCount)} sensitivity flags in a ${ctx.settingClass} setting`,
    });
  }
  const cap = cs.source.thresholds.maxBandDrop;
  if (drop > cap) {
    modifiers.push({ rule: 'CAP-1', steps: drop - cap, reason: `limited to -${String(cap)}` });
    drop = cap;
  }
  // UP-0: nothing raises the band within a check-in; DEM-0: demand never changes it.
  const final = bandAt(bandStep(state.baseline) - drop);
  return { baseline: state.baseline, final, modifiers };
}
