import type { TabMapping } from './types.js';

// Tabs whose rows describe the system rather than state rules the engine runs. Each says why.

export const JOURNEY_LAYERS: TabMapping = {
  all: {
    mapping: 'reference',
    reason:
      'Tab 11 lists the inputs and outputs of each layer. The engine stages implement it (registry STAGES); the rules themselves are in Tabs 1-10.',
  },
};

export const DECISION_SEQUENCE: TabMapping = {
  all: {
    mapping: 'reference',
    reason:
      'Tab 8 is the order the engine runs in. That order is engine mechanics (registry STAGES, each tied to its Tab 8 step), not a rule to evaluate.',
  },
};

export const COVERAGE_GAPS: TabMapping = {
  all: {
    mapping: 'reference',
    reason:
      "Tab 12 is the workbook's own list of gaps and additions. Where an addition is a rule, it lives in the tab it changes; open gaps go to the gap register.",
  },
};

export const DRIVERS: TabMapping = {
  all: {
    mapping: 'reference',
    reason:
      'Tab 5 defines the NUCRIPCE drivers. The drivers are catalogue values (domain driver); the rules that tag them are in Tabs 4, 6 and 7.',
  },
};
