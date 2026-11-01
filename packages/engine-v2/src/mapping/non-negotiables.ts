import { forbid, mapped, path, rule } from './dsl.js';
import type { RowMapping, TabMapping } from './types.js';

// The non-negotiables under Tab 7 (M3, E-50). Most are properties of the engine or the app, or
// repeat a rule mapped elsewhere; tests check the structural ones (no forced Reflect or Meditate).

const ref = (reason: string): RowMapping => ({ mapping: 'reference', reason });
const PATHWAYS = [
  'regulate',
  'dump',
  'express',
  'connect',
  'execute',
  'adapt',
  'reflect',
  'meditate',
];

export const NON_NEGOTIABLES: TabMapping = {
  rows: {
    'non_negotiables · note 2': ref(
      'The card has one primary and at most two alternatives: built into the card (M4) and a publish check (DESIGN §5).',
    ),
    'non_negotiables · note 3': mapped({
      stage: 'orchestration',
      rules: PATHWAYS.map((p) =>
        rule({ fact: 'signals.rejected', op: 'contains', value: p }, [forbid(path(p), 'primary')]),
      ),
      reason:
        '"Not now" is on every card. A pathway the user just said "Not now" to is not the next primary; "immediately" is IG-21. A step forced by safety, a guard or distress is a higher-ranked requirement and still shows (M4).',
    }),
    'non_negotiables · note 4': ref(
      'Structural: the timeline rows (Tab 4) only cap steps and minutes and tag drivers; none removes a Regulate step or support.',
    ),
    'non_negotiables · note 5': ref(
      'Wording: the card shows plain words, the state\'s name and icon, and "Because you said X…" (M4 copy); no internal labels.',
    ),
    'non_negotiables · note 6': ref('The sustained-state rule is Tab 10 SF-2, mapped there.'),
    'non_negotiables · note 7': ref(
      "Structural: no rule requires Reflect or Meditate (a test checks), and support is a requirement they can't remove (MD-6).",
    ),
    'non_negotiables · note 8': ref('Tab 6c MD-3.'),
    'non_negotiables · note 9': ref('Tab 6d ENT-1, ENT-2 and the section A floors.'),
    'non_negotiables · note 10': ref('Tab 6d ENT-3.'),
  },
};
