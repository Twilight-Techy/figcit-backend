import type { RowMapping, TabMapping } from './types.js';
import { is, set } from './v5-terms.js';

// Rules Engine v5.0: Tab 8 (the eight pathways and the v5.0 tool rows) and Tab 13 (the decision
// sequence). The pathway rows say what each pathway is for; Tab 2's routes and Tab 17's tools are
// what the engine runs. The tool rows describe the tool screens. MV-2 is the one the card needs.

const ref = (reason: string): RowMapping => ({ mapping: 'reference', reason });

export const PATHWAYS: TabMapping = {
  rows: {
    'MV-2': {
      mapping: 'interpreted',
      reason:
        "Dance is never offered in no-words (Shutdown) mode, nor eyes-closed practice (T-41); 'only where the place allows' is the place rows (Tab 4).",
      engine: {
        stage: 'orchestration',
        layer: 'guard',
        rules: [
          {
            when: is('mode.no_words', true),
            then: [
              set('tools.exclude', {
                tools: ['reg_dance', 'reg_dance_private', 'reg_dance_s', 'med_bodyscan'],
              }),
            ],
          },
        ],
      },
    },
    'DR-5': ref(
      "Sorting a worry in Dump: Amber or Red to Regulate, else Reflect, with the rumination guard (RF-1): the Dump screen's routing.",
    ),
    'DR-6': ref('Risk words in a dump pass the safety check (SF-1) before sorting: the API.'),
  },
  all: ref(
    "What the pathway is for, or how a tool screen works (Move, Create, Write, Dump): the app's tool screens. Tab 2's routes and Tab 17's tools are what the card runs.",
  ),
};

export const SEQUENCE: TabMapping = {
  all: ref(
    "The order the app asks things in and the engine's stages follow (safety first, entitlement last); Quick runs steps 0-3 then 6 on. It describes the run, it adds no rule.",
  ),
};
