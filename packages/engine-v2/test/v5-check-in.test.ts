// Rules Engine v5.0: the app's check-in as engine input, through the version's check-in options
// (Tabs 2-5, 7, 10; plans per Tab 9).
import { describe, expect, it } from 'vitest';
import { factsFromCheckInV5, inputOptionsOf, run, type CheckInV5 } from '../src/index.js';
import { catalogue, imported, ruleset } from './support/v5.js';

const { options, issues } = inputOptionsOf(imported.records, catalogue);
const FULL_CHECK_IN: CheckInV5 = {
  mode: 'full',
  state: { kind: 'grid', energy: 3, mood: 3 },
  emotions: [{ code: 'angry', level: 6 }],
  body: ['tension'],
  senses: ['too_loud'],
  place: { code: 'work_or_placement', canStepAway: false },
  devices: ['ear_defenders_or_loop_earplugs'],
  tasks: [{ chip: 'can_t_wait' }, {}],
  helpCard: 'hc_1',
};

describe('Rules Engine v5.0: the check-in as engine input', () => {
  it("reads the version's options with no issue", () => {
    expect(issues).toEqual([]);
    expect(options.feeling.filter((o) => o.group !== 'prime')).toHaveLength(11);
    expect(options.feeling.filter((o) => o.group === 'always_free').map((o) => o.code)).toEqual([
      'anxious',
      'overwhelmed',
      'teary_or_sad',
      'not_good_enough',
      'shut_down',
      'something_else',
    ]);
  });

  it('gives the facts the rules read, and the engine runs on them', () => {
    const { input, dropped } = factsFromCheckInV5(FULL_CHECK_IN, options, {
      'signals.plan': 'free',
    });
    expect(dropped).toEqual([]);
    expect(input).toMatchObject({
      'checkin.mode': 'full',
      'state.energy': 3,
      'family.intensity': { angry: 6 },
      'body.signs': ['tension'],
      'sensitivity.flags': ['too_loud'],
      'context.setting': 'work_or_placement',
      'context.can_step_away': false,
      'context.supports': ['ear_defenders_or_loop_earplugs'],
      'tasks.count': 2,
      'tasks.chips': ['can_t_wait', 'usual'],
      'help.card': 'hc_1',
    });
    const r = run(ruleset, input);
    expect(r.ok).toBe(true);
  });

  it('ENT-12: drops an option the plan cannot pick; ENT-13: never an always-free one', () => {
    const c: CheckInV5 = {
      ...FULL_CHECK_IN,
      emotions: [
        { code: 'frustrated', level: 7 },
        { code: 'shut_down', level: 5 },
      ],
      body: ['headache', 'tension'],
    };
    const free = factsFromCheckInV5(c, options);
    expect(free.dropped).toEqual([
      { input: 'feeling', code: 'frustrated', why: 'locked' },
      { input: 'body', code: 'headache', why: 'locked' },
    ]);
    expect(free.input['family.intensity']).toEqual({ shut_down: 5 });
    const prime = factsFromCheckInV5(c, options, { 'signals.plan': 'prime' });
    expect(prime.dropped).toEqual([]);
  });

  it('CTX-U: a Quick check-in reads no body, senses or place; urgent signs always', () => {
    const { input, dropped } = factsFromCheckInV5(
      { ...FULL_CHECK_IN, mode: 'quick', urgent: { signs: ['breathless'], answer: 'familiar' } },
      options,
    );
    expect(input['context.setting']).toBeUndefined();
    expect(input['urgent.signs']).toEqual(['breathless']);
    expect(dropped.map((d) => d.why)).toEqual(['not_asked', 'not_asked', 'not_asked', 'not_asked']);
  });

  it('keeps two emotions, three tasks on Free, and the Something else tap (SE-1)', () => {
    const { input, dropped } = factsFromCheckInV5(
      {
        ...FULL_CHECK_IN,
        emotions: [
          { code: 'something_else', level: 6 },
          { code: 'calm', level: 4 },
          { code: 'happy', level: 3 },
        ],
        somethingElseGroup: 'low',
        tasks: [{}, {}, {}, { chip: 'hard' }],
      },
      options,
    );
    expect(input['family.intensity']).toEqual({ something_else: 6, calm: 4 });
    expect(input['feeling.something_else_group']).toBe('low');
    expect(input['tasks.count']).toBe(3);
    expect(dropped).toEqual([
      { input: 'feeling', code: 'happy', why: 'too_many' },
      { input: 'task_kind', code: 'hard', why: 'too_many' },
    ]);
  });

  it('drops an option that is not offered', () => {
    const { dropped } = factsFromCheckInV5({ ...FULL_CHECK_IN, helpCard: 'hc_9' }, options);
    expect(dropped).toEqual([{ input: 'help', code: 'hc_9', why: 'not_offered' }]);
  });
});
