// Stages 5–6: need routes (Tab 6b) and demand → timeline cap and NUCRIPCE drivers (Tabs 4–6).
import type { CompiledSnapshot } from '../snapshot.js';
import type {
  Band,
  DemandInput,
  Driver,
  EngineInput,
  SnapshotNeed,
  SnapshotTimeline,
} from '../types.js';

export interface DemandResult {
  readonly present: boolean;
  readonly timeline: SnapshotTimeline | undefined;
  readonly traits: ReadonlySet<string>;
  /** All drivers that apply to the demand. */
  readonly drivers: readonly Driver[];
  /** Drivers actually used after the band rules: Routine only in Amber, none (deferred) in Red. */
  readonly usedDrivers: readonly Driver[];
  readonly deferred: boolean;
  readonly count: number;
  readonly puttingOff: boolean;
  readonly title: string | undefined;
}

export interface NeedResult {
  readonly needs: readonly SnapshotNeed[];
  readonly codes: ReadonlySet<string>;
  readonly justSupport: boolean;
}

export function resolveNeeds(cs: CompiledSnapshot, input: EngineInput): NeedResult {
  const needs = (input.needs ?? [])
    .map((code) => cs.needByCode.get(code))
    .filter((n): n is SnapshotNeed => n !== undefined);
  return {
    needs,
    codes: new Set(needs.map((n) => n.code)),
    justSupport: input.justSupport ?? false,
  };
}

const NO_DEMAND: DemandResult = {
  present: false,
  timeline: undefined,
  traits: new Set(),
  drivers: [],
  usedDrivers: [],
  deferred: false,
  count: 0,
  puttingOff: false,
  title: undefined,
};

const URGENT_CODES = new Set(['T0', 'T1', 'TX']);

/** Tab 6 characteristics plus the timeline-derived drivers. O(traits). */
function driversFor(
  cs: CompiledSnapshot,
  demand: DemandInput,
  traits: ReadonlySet<string>,
): Driver[] {
  const drivers = new Set<Driver>(demand.confirmedDrivers ?? []);
  for (const trait of traits)
    for (const d of cs.traitDrivers.get(trait) ?? []) drivers.add(d as Driver);
  // Urgency is derived from the timeline, never labelled by the user (Tab 5).
  const urgent =
    URGENT_CODES.has(demand.timeline) || (demand.timeline === 'T2' && traits.has('consequence'));
  if (urgent && !traits.has('stopping')) drivers.add('urgency');
  if (demand.timeline === 'TR' || demand.puttingOff === true) drivers.add('routine');
  return [...drivers].sort();
}

function usedDriversFor(band: Band, drivers: readonly Driver[]): readonly Driver[] {
  if (band === 'very_constrained') return [];
  return band === 'constrained' ? ['routine'] : drivers;
}

export function analyseDemand(
  cs: CompiledSnapshot,
  input: EngineInput,
  band: Band,
  needs: NeedResult,
): DemandResult {
  const demand = input.demand;
  if (!demand || needs.justSupport) return NO_DEMAND;
  const traits = new Set(demand.traits ?? []);
  const drivers = driversFor(cs, demand, traits);
  return {
    present: true,
    timeline: cs.timelineByCode.get(demand.timeline),
    traits,
    drivers,
    usedDrivers: usedDriversFor(band, drivers),
    deferred: band === 'very_constrained',
    count: Math.max(1, demand.count ?? 1),
    puttingOff: demand.puttingOff ?? false,
    title: demand.title,
  };
}
