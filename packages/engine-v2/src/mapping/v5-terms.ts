import type { Comparison, Condition, Effect, Target } from '../format/types.js';

// The words the v5.0 card rules are written in (mapping/v5-*.ts): conditions on the check-in and
// the effects that build the card.

export const eq = (fact: string, value: string): Comparison => ({ fact, op: 'eq', value });
export const among = (fact: string, value: readonly string[]): Comparison => ({
  fact,
  op: 'in',
  value,
});
export const is = (fact: string, value: boolean): Comparison => ({ fact, op: 'is', value });
export const atLeast = (fact: string, band: string): Comparison => ({
  fact,
  op: 'gte',
  value: { band },
});
export const all = (...c: Condition[]): Condition => ({ all: c });
export const not = (c: Condition): Condition => ({ not: c });
export const set = (kind: string, params: Record<string, unknown> = {}): Effect => ({
  kind,
  ...params,
});

export type Step = string; // a tool code, `@action` or `~pathway`
export const target = (step: Step): Target =>
  step.startsWith('@')
    ? ({ action: step.slice(1) } as Target)
    : step.startsWith('~')
      ? { pathway: step.slice(1) }
      : { tool: step };
export const propose = (slot: 'primary' | 'alternative', step: Step): Effect =>
  set('propose', { slot, target: target(step) });
export const need = (slot: 'primary' | 'alternative', step: Step): Effect =>
  set('require', { slot, target: target(step) });

export const CALM_LIGHTS = ['green', 'yellow', 'blue'];
export const light = (...l: string[]): Comparison => among('light', l);
export const any = (...c: Condition[]): Condition => ({ any: c });
export const noTask: Condition = any(
  { fact: 'tasks.count', op: 'absent' },
  { fact: 'tasks.count', op: 'eq', value: 0 },
);
export const hasTask: Comparison = { fact: 'tasks.count', op: 'gte', value: 1 };
export const EXAM = 'exam_interview_or_assessment';
/** No suggestion in an exam, interview or assessment: nothing until it ends (Tab 20). */
export const notExam: Condition = { not: { fact: 'context.setting', op: 'eq', value: EXAM } };
/** Senses that put Adapt first (BS-2, pattern 59): the Overload group of Tab 3. */
export const OVERLOAD = [
  'too_loud',
  'too_bright',
  'too_busy_or_crowded',
  'clothes_or_touch_bothering_me',
  'smells',
];
export const sensesFirst: Condition = all(
  { fact: 'sensitivity.flags', op: 'contains_any', value: OVERLOAD },
  not(among('light', ['red'])),
);
export const familiarUrgent: Condition = all(
  { fact: 'urgent.signs', op: 'not_empty' },
  eq('urgent.answer', 'familiar'),
);
/** No guard leads the card: not no-words (16), not a familiar urgent sign (51). */
export const unguarded: Condition = all(is('mode.no_words', false), not(familiarUrgent));

export const noFeeling: Comparison = { fact: 'feeling.deciding', op: 'absent' };

export const oneTask: Comparison = { fact: 'tasks.count', op: 'eq', value: 1 };
export const manyTasks: Comparison = { fact: 'tasks.count', op: 'gte', value: 2 };
/** Clear-headed or Empowered in Yellow keep pattern 55 even with a task (Tab 20). */
export const yellowAsk: Condition = all(
  eq('light', 'yellow'),
  among('feeling.deciding', ['clear_headed', 'empowered']),
);

/** A difficult feeling (Tab 11): any group but Settled; Bored counts (Tab 20). */
export const difficult: Comparison = among('feeling.deciding_group', [
  'charged',
  'low',
  'shutdown',
  'unsorted',
]);

export const unpleasant: Comparison = among('feeling.deciding_group', [
  'charged',
  'low',
  'shutdown',
]);
export const strong = atLeast('feeling.deciding_level', 'strong');
export const decides = (...codes: string[]): Comparison => among('feeling.deciding', codes);
export const movingHard = all(decides('angry', 'frustrated'), strong);
