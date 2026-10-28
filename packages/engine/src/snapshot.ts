// Builds O(1) lookups once per snapshot (rules §4). Compiled snapshots are cached by version with a
// small bound, so a long-running process never grows without limit.
import { buildSafetyScreen, type SafetyScreen } from './safety/screen.js';
import type {
  Pathway,
  Snapshot,
  SnapshotCell,
  SnapshotEmotion,
  SnapshotEnvironment,
  SnapshotFamily,
  SnapshotNeed,
  SnapshotPattern,
  SnapshotSensation,
  SnapshotTimeline,
  SnapshotTool,
  TimelineCode,
} from './types.js';

export interface CompiledSnapshot {
  readonly source: Snapshot;
  readonly cellById: ReadonlyMap<string, SnapshotCell>;
  /** cellGrid[energy - 1][mood - 1] */
  readonly cellGrid: readonly (readonly SnapshotCell[])[];
  readonly familyByCode: ReadonlyMap<string, SnapshotFamily>;
  readonly emotionByCode: ReadonlyMap<string, SnapshotEmotion>;
  readonly sensationByCode: ReadonlyMap<string, SnapshotSensation>;
  readonly environmentByCode: ReadonlyMap<string, SnapshotEnvironment>;
  readonly socialObserved: ReadonlyMap<string, boolean>;
  readonly needByCode: ReadonlyMap<string, SnapshotNeed>;
  readonly timelineByCode: ReadonlyMap<TimelineCode, SnapshotTimeline>;
  readonly toolById: ReadonlyMap<string, SnapshotTool>;
  readonly toolsByPathway: ReadonlyMap<Pathway, readonly SnapshotTool[]>;
  readonly patternById: ReadonlyMap<number, SnapshotPattern>;
  readonly traitDrivers: ReadonlyMap<string, readonly string[]>;
  readonly safety: SafetyScreen;
}

const CACHE_LIMIT = 8;
const cache = new Map<string, CompiledSnapshot>();

function byKey<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T> {
  const map = new Map<K, T>();
  for (const item of items) map.set(key(item), item);
  return map;
}

export function compileSnapshot(snapshot: Snapshot): CompiledSnapshot {
  const cached = cache.get(snapshot.version);
  if (cached?.source === snapshot) return cached;

  const grid: SnapshotCell[][] = [[], [], [], []];
  for (const cell of snapshot.cells) {
    const row = grid[cell.energy - 1];
    if (row) row[cell.mood - 1] = cell;
  }
  const toolsByPathway = new Map<Pathway, SnapshotTool[]>();
  for (const tool of snapshot.tools) {
    const list = toolsByPathway.get(tool.pathway) ?? [];
    list.push(tool);
    toolsByPathway.set(tool.pathway, list);
  }

  const compiled: CompiledSnapshot = {
    source: snapshot,
    cellById: byKey(snapshot.cells, (c) => c.id),
    cellGrid: grid,
    familyByCode: byKey(snapshot.families, (f) => f.code),
    emotionByCode: byKey(snapshot.emotions, (e) => e.code),
    sensationByCode: byKey(snapshot.sensations, (s) => s.code),
    environmentByCode: byKey(snapshot.environments, (e) => e.code),
    socialObserved: new Map(snapshot.socials.map((s) => [s.code, s.observed])),
    needByCode: byKey(snapshot.needs, (n) => n.code),
    timelineByCode: byKey(snapshot.timelines, (t) => t.code),
    toolById: byKey(snapshot.tools, (t) => t.id),
    toolsByPathway,
    patternById: byKey(snapshot.patterns, (p) => p.id),
    traitDrivers: new Map(snapshot.demandTraits.map((t) => [t.code, t.drivers])),
    safety: buildSafetyScreen(snapshot.safety.phrases, snapshot.safety.exclusions),
  };

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(snapshot.version, compiled);
  return compiled;
}
