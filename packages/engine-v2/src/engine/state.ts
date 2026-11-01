import { valuesOf, type Catalogue } from '../format/catalogue.js';
import { FACTS, STAGES, type StageKey } from '../format/registry.js';
import type { EngineInput } from './types.js';

const FACT_BY_NAME = new Map(FACTS.map((f) => [f.name, f]));
const STAGE_INDEX = new Map<string, number>(STAGES.map((s, i) => [s.key, i]));
const at = (stage: StageKey): number => STAGE_INDEX.get(stage) ?? 0;

type Intensities = Readonly<Record<string, number | null>>;

/**
 * The facts of one run (DESIGN §5): the input, what the engine works out from it, and what the
 * rules set so far. The band and the light are kept as the effects that shape them and settled
 * when read, so the order the band rules fire in doesn't matter (Tab 10 is a set of modifiers).
 */
export class RunState {
  stage: StageKey = 'safety';
  private readonly bands: readonly string[];
  private readonly harder: ReadonlySet<string>;

  private baseline: string | undefined;
  private lowered = 0;
  private held = false;
  private readonly caps: string[] = [];
  private readonly dropLimits: number[] = [];
  private readonly riseLimits: number[] = [];
  private lightSet: string | undefined;
  private overlay: string | undefined;
  private readonly lightNever = new Set<string>();
  readonly classes = new Set<string>();
  /** NUCRIPCE tags and their weight (1 low ... 4 maximum). */
  readonly drivers = new Map<string, number>();
  readonly notes: string[] = [];

  constructor(
    private readonly input: EngineInput,
    catalogue: Catalogue,
  ) {
    this.bands = [...valuesOf(catalogue, 'band')]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((v) => v.code);
    this.harder = new Set(
      valuesOf(catalogue, 'family')
        .filter((v) => v.group === 'harder')
        .map((v) => v.code),
    );
  }

  /** A fact's value now; undefined when it has none (not given, or not settled yet). */
  fact(name: string, key?: string): unknown {
    const spec = FACT_BY_NAME.get(name);
    if (!spec) return undefined;
    if (spec.derived && at(this.stage) < at(spec.stage)) return undefined;
    const own = this.computed(name);
    if (own !== NOT_COMPUTED) return own;
    const value = this.input[name];
    if (spec.keyedBy)
      return key === undefined ? undefined : (value as Intensities | undefined)?.[key];
    if (value !== undefined) return value;
    if (spec.type === 'boolean') return false;
    if (spec.type === 'set') return [];
    return undefined;
  }

  private computed(name: string): unknown {
    switch (name) {
      case 'state.cell': {
        const e = this.input['state.energy'];
        const m = this.input['state.mood'];
        return typeof e === 'number' && typeof m === 'number'
          ? `E${String(e)}M${String(m)}`
          : undefined;
      }
      case 'families':
        return Object.keys(this.feelings());
      case 'peak.negative':
        return this.peakNegative();
      case 'sensitivity.count':
        return ((this.input['sensitivity.flags'] as string[] | undefined) ?? []).length;
      case 'band.baseline':
        return this.baseline;
      case 'band.final':
        return this.band();
      case 'light':
        return this.light();
      case 'context.classes':
        return [...this.classes];
      case 'drivers':
        return [...this.drivers.keys()];
      case 'recheck.band_improved':
        return this.bandImproved();
      case 'recheck.intensity_change':
        return this.intensityChange();
      default:
        return NOT_COMPUTED;
    }
  }

  private feelings(): Intensities {
    return (this.input['family.intensity'] as Intensities | undefined) ?? {};
  }

  /** Highest rating among the harder feelings felt; null when none of them is rated. */
  private peakNegative(): number | null | undefined {
    const felt = Object.entries(this.feelings()).filter(([f]) => this.harder.has(f));
    if (felt.length === 0) return undefined;
    const rated = felt.map(([, v]) => v).filter((v): v is number => v !== null);
    return rated.length > 0 ? Math.max(...rated) : null;
  }

  /** RC-1 "better cell": the new baseline is above the band the re-checked card had. */
  private bandImproved(): boolean | undefined {
    const previous = this.input['recheck.previous_band'];
    if (this.baseline === undefined || typeof previous !== 'string') return undefined;
    return this.bandOrder(this.baseline) > this.bandOrder(previous);
  }

  /** Now minus then, on the harder feelings only (ADR 0004 §8); none felt now counts as 0. */
  private intensityChange(): number | undefined {
    const before = this.input['recheck.previous_peak'];
    const now = this.peakNegative();
    if (typeof before !== 'number' || now === null) return undefined;
    return (now ?? 0) - before;
  }

  // ---- the band (Tab 10) ----

  setBand(to: string): void {
    if (this.baseline !== undefined && this.baseline !== to)
      this.notes.push(`baseline band set twice: ${this.baseline}, then ${to}`);
    this.baseline = to;
  }
  lowerBand(steps: number): void {
    if (!this.held) this.lowered += steps;
  }
  holdBand(): void {
    this.held = true;
  }
  capBand(to: string): void {
    this.caps.push(to);
  }
  limitDrop(steps: number): void {
    this.dropLimits.push(steps);
  }
  limitRise(steps: number): void {
    this.riseLimits.push(steps);
  }

  /** The final band: baseline, lowered, then the floors and limits. */
  private band(): string | undefined {
    if (this.baseline === undefined) return undefined;
    const base = this.bands.indexOf(this.baseline);
    let final = base - this.lowered;
    if (this.dropLimits.length > 0) final = Math.max(final, base - Math.min(...this.dropLimits));
    for (const cap of this.caps) final = Math.max(final, Math.min(this.bands.indexOf(cap), base));
    const previous = this.input['recheck.previous_band'];
    if (this.riseLimits.length > 0 && typeof previous === 'string') {
      const top = this.bands.indexOf(previous) + Math.min(...this.riseLimits);
      final = Math.min(final, top);
    }
    return this.bands[Math.max(0, Math.min(final, this.bands.length - 1))];
  }

  /** Order of a band, for the ordered comparisons; -1 when unknown. */
  bandOrder(code: unknown): number {
    return typeof code === 'string' ? this.bands.indexOf(code) : -1;
  }

  // ---- the light ----

  setLight(light: string): void {
    this.lightSet = light;
  }
  overlayLight(light: string): void {
    this.overlay = light;
  }
  neverLight(light: string): void {
    this.lightNever.add(light);
  }

  /** The band's light, unless an overlay (Blue recovery) is allowed to show over it. */
  private light(): string | undefined {
    if (this.overlay !== undefined && !this.lightNever.has(this.overlay)) return this.overlay;
    return this.lightSet;
  }

  addDrivers(codes: readonly string[], weight: number): void {
    for (const code of codes) this.drivers.set(code, Math.max(weight, this.drivers.get(code) ?? 0));
  }
}

const NOT_COMPUTED = Symbol('not computed');
