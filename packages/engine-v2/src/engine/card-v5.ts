import { valuesOf, type Catalogue } from '../format/catalogue.js';
import type { Material, Origin } from './apply.js';
import type { RunState } from './state.js';
import type { Card, CardItem } from './types.js';

// Rules Engine v5.0's parts of the card, which only v5.0 rule sets fill (so older cards replay
// unchanged): the pattern, the suggestion, the task order, the deciding emotion, whether the
// colour went down, and the plan a paid tool needs.

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

/** The eight cards are Order 1-8 in the catalogue; the 'More needs' list comes after. */
const CARDS = 8;

/**
 * v5.0 Tab 7: the support cards shown here, those a rule puts first leading (best-ranked rule
 * first: Red's, then Life right now's), the rest in catalogue order.
 */
function menu(
  m: Material,
  catalogue: Catalogue,
  rank: (o: Origin) => number,
): NonNullable<Card['menu']> {
  const values = (catalogue.get('support_card') ?? []).filter((v) => !m.menuHidden.has(v.code));
  const first = [...m.menuFirst]
    .sort((a, b) => rank(a) - rank(b) || a.rule.seq - b.rule.seq)
    .flatMap((f) => f.cards)
    .filter((c) => values.some((v) => v.code === c));
  const cards = values.filter((v) => (v.order ?? 0) <= CARDS).map((v) => v.code);
  return {
    cards: [...new Set([...first.filter((c) => cards.includes(c)), ...cards])],
    more: values.filter((v) => (v.order ?? 0) > CARDS).map((v) => v.code),
  };
}

/** v5.0's pattern, suggestion and task order (each from its best-ranked rule), when set. */
export function v5Frame(
  m: Material,
  state: RunState,
  catalogue: Catalogue,
  rank: (o: Origin) => number,
): Pick<
  Card,
  'pattern' | 'suggestion' | 'taskOrder' | 'lowered' | 'feeling' | 'menu' | 'helpSwap'
> {
  // The best-ranked rule's value: layer first, then run order.
  const best = <T extends Origin>(list: readonly T[]): T | undefined =>
    [...list].sort((a, b) => rank(a) - rank(b) || a.rule.seq - b.rule.seq)[0];
  const pattern = best(m.patterns)?.pattern;
  const suggestion = best(m.suggestions)?.copy;
  const order = best(m.taskOrders);
  const swap = best(m.helpSwaps);
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
    ...(valuesOf(catalogue, 'support_card').length > 0 ? { menu: menu(m, catalogue, rank) } : {}),
    ...(swap ? { helpSwap: { card: swap.card, reason: swap.copy } } : {}),
  };
}

/** v5.0 ENT-11, ENT-12: the plan a paid tool needs (only v5.0 rule sets have these tiers). */
export function planOf(m: Material, tool: string): Pick<CardItem, 'plan'> {
  if (m.tiers.get('premium')?.has(tool)) return { plan: 'premium' };
  return m.tiers.get('prime')?.has(tool) ? { plan: 'prime' } : {};
}
