// Stage 1: state lookup (Tab 1) and the Not sure path (NS-1, pattern 27).
import type { CompiledSnapshot } from '../snapshot.js';
import type { Band, EngineInput, SnapshotCell } from '../types.js';

export interface StateResult {
  readonly cellId: string;
  readonly cell: SnapshotCell | undefined;
  readonly confirmed: boolean;
  readonly notSure: boolean;
  readonly baseline: Band;
  /** Suggested cell from the three picture taps, for "Does this sound like you?". */
  readonly suggestedCell: string | undefined;
}

export const NOT_SURE_CELL = 'NS-1';

/** Suggests a cell from the body / energy / comfort answers (first matching rule). */
export function suggestCell(
  cs: CompiledSnapshot,
  answers: readonly string[] | undefined,
): string | undefined {
  if (!answers || answers.length < 3) return undefined;
  for (const rule of cs.source.notSure.rules) {
    if (rule.when.every((w, i) => w === '*' || w === answers[i])) return rule.cell;
  }
  return undefined;
}

export function resolveState(cs: CompiledSnapshot, input: EngineInput): StateResult {
  const state = input.state;
  if (state.kind === 'grid') {
    const cell = cs.cellGrid[state.energy - 1]?.[state.mood - 1];
    if (!cell) throw new RangeError('energy and mood must be 1–4');
    return {
      cellId: cell.id,
      cell,
      confirmed: true,
      notSure: false,
      baseline: cell.band,
      suggestedCell: undefined,
    };
  }
  const suggested = suggestCell(cs, state.answers);
  const confirmed = state.confirmedCell ? cs.cellById.get(state.confirmedCell) : undefined;
  if (confirmed) {
    return {
      cellId: confirmed.id,
      cell: confirmed,
      confirmed: true,
      notSure: true,
      baseline: confirmed.band,
      suggestedCell: suggested,
    };
  }
  // NS-1: default Conditional until a state is confirmed; never assume better or worse.
  return {
    cellId: NOT_SURE_CELL,
    cell: undefined,
    confirmed: false,
    notSure: true,
    baseline: 'conditional',
    suggestedCell: suggested,
  };
}
