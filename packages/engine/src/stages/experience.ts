// Stage 2: experience → families, peak intensity and flags (Tab 2, sensation-led rows).
import type { CompiledSnapshot } from '../snapshot.js';
import type { EngineInput, IntensityBand, SensationFlag, SnapshotFamily } from '../types.js';

export interface ExperienceResult {
  /** family code → highest intensity among the chosen emotions in that family. */
  readonly families: ReadonlyMap<string, number>;
  readonly peak: number;
  readonly peakNegative: number;
  readonly flags: ReadonlySet<SensationFlag>;
  readonly painIntensity: number;
  readonly overloadIntensity: number;
  readonly riskOption: string | undefined;
  readonly notes: readonly string[];
}

export function intensityBand(
  n: number,
  high: number,
  veryHigh: number,
  moderate: number,
): IntensityBand {
  if (n >= veryHigh) return 'very_high';
  if (n >= high) return 'high';
  if (n >= moderate) return 'moderate';
  return 'mild';
}

export function isNegative(family: SnapshotFamily | undefined): boolean {
  return family?.valence === 'negative';
}

const DEFAULT_SENSATION_INTENSITY = 5;

// Sensation-led families (Tab 2): a flag implies the family when no emotion named it.
const IMPLIED: readonly (readonly [SensationFlag, string])[] = [
  ['shutdown', 'shutdown'],
  ['overload', 'sensory_overload'],
  ['racing', 'racing'],
  ['hyperfocus', 'hyperfocus'],
  ['word_finding', 'word_finding'],
  ['restless', 'restlessness'],
];

interface EmotionScan {
  readonly families: Map<string, number>;
  readonly riskOption: string | undefined;
}

/** O(e) for e ≤ 3 emotions; extras beyond the cap are ignored (Tab 2: up to 3). */
function scanEmotions(cs: CompiledSnapshot, input: EngineInput, notes: string[]): EmotionScan {
  const families = new Map<string, number>();
  let riskOption: string | undefined;
  for (const emotion of (input.emotions ?? []).slice(0, cs.source.thresholds.maxEmotions)) {
    const def = cs.emotionByCode.get(emotion.code);
    if (!def) {
      notes.push(`unknown emotion ${emotion.code} ignored`);
      continue;
    }
    const intensity = Math.max(0, Math.min(10, emotion.intensity));
    if (def.riskAtIntensity !== undefined && intensity >= def.riskAtIntensity)
      riskOption = def.code;
    families.set(def.family, Math.max(families.get(def.family) ?? 0, intensity));
  }
  return { families, riskOption };
}

interface SensationScan {
  readonly flags: Set<SensationFlag>;
  readonly pain: number;
  readonly overload: number;
}

function scanSensations(cs: CompiledSnapshot, input: EngineInput): SensationScan {
  const flags = new Set<SensationFlag>();
  let pain = 0;
  let overload = 0;
  for (const sensation of input.sensations ?? []) {
    const def = cs.sensationByCode.get(sensation.code);
    if (!def) continue;
    const intensity = sensation.intensity ?? DEFAULT_SENSATION_INTENSITY;
    for (const flag of def.flags) flags.add(flag);
    if (def.flags.includes('pain')) pain = Math.max(pain, intensity);
    if (def.flags.includes('overload')) overload = Math.max(overload, intensity);
  }
  return { flags, pain, overload };
}

function addImplied(families: Map<string, number>, scan: SensationScan, notes: string[]): void {
  for (const [flag, family] of IMPLIED) {
    if (!scan.flags.has(flag) || families.has(family)) continue;
    families.set(family, flag === 'overload' ? scan.overload : DEFAULT_SENSATION_INTENSITY);
    notes.push(`${family} implied by sensation`);
  }
}

function peaks(
  cs: CompiledSnapshot,
  families: ReadonlyMap<string, number>,
): { peak: number; peakNegative: number } {
  let peak = 0;
  let peakNegative = 0;
  for (const [code, intensity] of families) {
    peak = Math.max(peak, intensity);
    if (isNegative(cs.familyByCode.get(code))) peakNegative = Math.max(peakNegative, intensity);
  }
  return { peak, peakNegative };
}

export function analyseExperience(cs: CompiledSnapshot, input: EngineInput): ExperienceResult {
  const notes: string[] = [];
  const { families, riskOption } = scanEmotions(cs, input, notes);
  const sensations = scanSensations(cs, input);
  addImplied(families, sensations, notes);
  const overload = Math.max(sensations.overload, families.get('sensory_overload') ?? 0);
  return {
    families,
    ...peaks(cs, families),
    flags: sensations.flags,
    painIntensity: sensations.pain,
    overloadIntensity: overload,
    riskOption,
    notes,
  };
}
