import type { FactSpec } from './registry.js';

/**
 * The facts Rules Engine v5.0 adds (format 4, docs/engine-v2/V5.md): the deciding emotion (FE-3),
 * the body signs and their groups (BS-1), and the urgent signs with their answer (SF-4).
 */
export const V5_FACTS: readonly FactSpec[] = [
  {
    name: 'feeling.deciding',
    type: 'enum',
    domain: 'family',
    stage: 'experience',
    computed: true,
    description:
      'v5.0 FE-3: the emotion that decides, the one with the higher slider; a tie goes to the lower group Order',
  },
  {
    name: 'feeling.deciding_group',
    type: 'enum',
    domain: 'feeling_group',
    stage: 'experience',
    computed: true,
    description: "v5.0: the deciding emotion's group (Charged, Low, Shutdown, Settled, Unsorted)",
  },
  {
    name: 'feeling.deciding_level',
    type: 'intensity',
    stage: 'experience',
    computed: true,
    description: "v5.0: the deciding emotion's slider (1-10)",
  },
  {
    name: 'body.signs',
    type: 'set',
    domain: 'body_sign',
    stage: 'experience',
    description: 'v5.0: body signs picked (Tab 3, Body tab)',
  },
  {
    name: 'body.groups',
    type: 'set',
    domain: 'body_group',
    stage: 'experience',
    computed: true,
    description: 'v5.0: the groups of the body signs picked',
  },
  {
    name: 'body.count',
    type: 'number',
    min: 0,
    max: 20,
    stage: 'experience',
    computed: true,
    description: 'v5.0: how many body signs were picked',
  },
  {
    name: 'urgent.signs',
    type: 'set',
    domain: 'urgent_sign',
    stage: 'safety',
    description: "v5.0: urgent body signs picked ('Something feels wrong', SF-4)",
  },
  {
    name: 'urgent.answer',
    type: 'enum',
    domain: 'urgent_answer',
    stage: 'safety',
    description: "v5.0: the answer to 'Is this sudden or new for you?' (SF-4)",
  },
];
