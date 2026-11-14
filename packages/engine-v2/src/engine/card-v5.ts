import type { Material, Origin } from './apply.js';
import type { RunState } from './state.js';
import type { Card, CardItem } from './types.js';

// Rules Engine v5.0's parts of the card, which only v5.0 rule sets fill (so older cards replay
// unchanged): the pattern, the suggestion, the task order, the deciding emotion, whether the
// colour went down, and the plan a paid tool needs.

type Best = <T extends Origin>(list: readonly T[]) => T | undefined;

/** v5.0 FE-3: the deciding emotion, for the card's reason (RT-4). */
function deciding(state: RunState): Pick<Card, 'feeling'> {
  const code = state.fact('feeling.deciding');
  if (typeof code !== 'string') return {};
  const level = state.fact('feeling.deciding_level');
  const group = state.fact('feeling.deciding_group');
  return {
    feeling: {
      code,
      level: typeof level === 'number' ? level : null,
      group: typeof group === 'string' ? group : null,
    },
  };
}

/** v5.0's pattern, suggestion and task order (each from its best-ranked rule), when set. */
export function v5Frame(
  m: Material,
  state: RunState,
  best: Best,
): Pick<Card, 'pattern' | 'suggestion' | 'taskOrder' | 'lowered' | 'feeling'> {
  const pattern = best(m.patterns)?.pattern;
  const suggestion = best(m.suggestions)?.copy;
  const order = best(m.taskOrders);
  // Only v5.0 rule sets set a pattern.
  const lowered =
    pattern !== undefined &&
    state.bandOrder(state.fact('band.final')) < state.bandOrder(state.fact('band.baseline'));
  return {
    ...(pattern === undefined ? {} : { pattern }),
    ...(lowered ? { lowered: true as const } : {}),
    ...(pattern === undefined ? {} : deciding(state)),
    ...(suggestion === undefined ? {} : { suggestion }),
    ...(order ? { taskOrder: { first: order.first, later: order.later } } : {}),
  };
}

/** v5.0 ENT-11, ENT-12: the plan a paid tool needs (only v5.0 rule sets have these tiers). */
export function planOf(m: Material, tool: string): Pick<CardItem, 'plan'> {
  if (m.tiers.get('premium')?.has(tool)) return { plan: 'premium' };
  return m.tiers.get('prime')?.has(tool) ? { plan: 'prime' } : {};
}
