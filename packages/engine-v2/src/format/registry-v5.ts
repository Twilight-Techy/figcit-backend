import type { FactSpec } from './registry.js';

/**
 * The facts Rules Engine v5.0 adds (format 4, docs/engine-v2/V5.md): the deciding emotion (FE-3),
 * the body signs and their groups (BS-1), and the urgent signs with their answer (SF-4).
 */
export const V5_FACTS: readonly FactSpec[] = [
  {
    name: 'tasks.count',
    type: 'number',
    min: 0,
    max: 100,
    stage: 'demand',
    description: 'v5.0: how many open tasks the check-in brings (TK-5)',
  },
  {
    name: 'tasks.chips',
    type: 'set',
    domain: 'task_chip',
    stage: 'demand',
    description: 'v5.0: the chips on those tasks (a task with no chip counts as Usual, TK-1)',
  },
  {
    name: 'context.can_step_away',
    type: 'boolean',
    stage: 'context',
    description:
      "v5.0: the answer to 'Can you step away?' (Tab 4); asked fresh every Full check-in",
  },
  {
    name: 'mode.no_words',
    type: 'boolean',
    stage: 'capacity_fit',
    derived: true,
    description: 'v5.0: no-words mode is on (FE-2, BS-3), so tap-only tools lead (pattern 16)',
  },
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
  {
    name: 'help.card',
    type: 'enum',
    domain: 'support_card',
    stage: 'orchestration',
    description:
      'v5.0: the support card picked in the Help menu (Tab 7); it sets the pathway unless a gate blocks it (SEQ-2)',
  },
  {
    name: 'life.now',
    type: 'set',
    domain: 'life_event',
    stage: 'entry',
    description:
      'v5.0: Life right now from Me (ME-3); orders the support cards (ME-4), never the colour (LE-0)',
  },
  {
    name: 'checkin.mode',
    type: 'enum',
    domain: 'checkin_mode',
    stage: 'entry',
    description: 'v5.0: a Quick or Full check-in (Tab 13); Quick asks no place (CTX-U, pattern 42)',
  },
  {
    name: 'feeling.something_else_group',
    type: 'enum',
    domain: 'feeling_group',
    stage: 'experience',
    description:
      "v5.0 SE-1: the one tap after 'Something else' (wound up: charged, low, switched off: shutdown, okay: settled); skipped, it stays Unsorted",
  },
];
