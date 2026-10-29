// Band modifiers (Tab 10), gates (Tab 6c), entitlement rules (Tab 6d) and card invariants.
import { describe, expect, it } from 'vitest';
import { evaluate, suggestCell, compileSnapshot, type EngineInput } from '../src/index.js';
import { free, grid, plus, snapshot } from './helpers.js';

const run = (input: EngineInput, signals = free) => evaluate(input, snapshot, signals);

describe('band modifiers', () => {
  it('CAP-1 limits the drop to two steps', () => {
    const r = run({
      state: grid(4, 4),
      emotions: [{ code: 'overloaded', intensity: 9 }],
      context: { environment: 'social_event', sensitivity: ['noise', 'lights', 'crowd'] },
    });
    expect(r.band.final).toBe('constrained');
    expect(r.band.modifiers.map((m) => m.rule)).toEqual(['EX-1', 'CX-1']);
  });
  it('UP-0: positive feelings never raise the band', () => {
    expect(
      run({ state: grid(1, 1), emotions: [{ code: 'excited', intensity: 9 }] }).band.final,
    ).toBe('very_constrained');
  });
  it('DEM-0: a T0 demand never changes the band', () => {
    const a = run({ state: grid(3, 3), emotions: [{ code: 'calm', intensity: 1 }] });
    const b = run({
      state: grid(3, 3),
      emotions: [{ code: 'calm', intensity: 1 }],
      demand: { timeline: 'T0' },
    });
    expect(b.band.final).toBe(a.band.final);
  });
  it('E4M1 is Conditional, and Constrained with any modifier', () => {
    expect(run({ state: grid(4, 1) }).band.final).toBe('conditional');
    expect(
      run({ state: grid(4, 1), emotions: [{ code: 'anxious', intensity: 7 }] }).band.final,
    ).toBe('constrained');
  });
  it('NS-1: Not sure defaults to Conditional; EX-1 still applies', () => {
    expect(run({ state: { kind: 'not_sure' } }).band.final).toBe('conditional');
    expect(
      run({ state: { kind: 'not_sure' }, emotions: [{ code: 'overwhelmed', intensity: 8 }] }).band
        .final,
    ).toBe('constrained');
  });
  it('shutdown lowers the band at any intensity; pain only at High+', () => {
    expect(run({ state: grid(3, 3), emotions: [{ code: 'numb', intensity: 2 }] }).band.final).toBe(
      'conditional',
    );
    expect(
      run({ state: grid(3, 3), sensations: [{ code: 'sharp_pain', intensity: 5 }] }).band.final,
    ).toBe('available');
    expect(
      run({ state: grid(3, 3), sensations: [{ code: 'sharp_pain', intensity: 8 }] }).band.final,
    ).toBe('conditional');
  });
});

describe('Not sure', () => {
  it('suggests a cell from the three picture taps', () => {
    const cs = compileSnapshot(snapshot);
    expect(suggestCell(cs, ['settled', 'full', 'good'])).toBe('E4M4');
    expect(suggestCell(cs, ['heavy', 'low', 'okay'])).toBe('E2M2');
    expect(suggestCell(cs, ['floaty', 'empty', 'hard'])).toBe('E1M1');
    expect(suggestCell(cs, ['floaty'])).toBeUndefined();
  });
  it('asks for a body check before anything else (pattern 27)', () => {
    const r = run({ state: { kind: 'not_sure', answers: ['heavy', 'low', 'okay'] } });
    expect(r.patterns[0]).toBe(27);
    expect(r.state.cellId).toBe('NS-1');
  });
  it('uses the confirmed cell once the user confirms', () => {
    const r = run({ state: { kind: 'not_sure', confirmedCell: 'E2M2' } });
    expect(r.state).toMatchObject({ cellId: 'E2M2', confirmed: true });
  });
});

describe('Reflect gates', () => {
  it('RF-1 blocks Reflect in Red and routes to pattern 40', () => {
    const r = run({
      state: grid(1, 2),
      emotions: [{ code: 'overwhelmed', intensity: 8 }],
      needs: ['make_sense'],
    });
    expect(r.patterns[0]).toBe(40);
    expect(r.primary.pathway).toBe('dump');
    expect(r.gates.some((g) => g.rule === 'RF-1' && g.effect === 'blocked')).toBe(true);
  });
  it('RF-1 in Amber offers "save for later"', () => {
    const r = run({ state: grid(1, 3), needs: ['make_sense'] });
    expect(r.light).toBe('amber');
    expect(r.alternatives.some((a) => a.kind === 'save_for_later')).toBe(true);
  });
  it('RF-2 blocks Reflect after repeated replay on a topic', () => {
    const r = run(
      { state: grid(3, 3), needs: ['make_sense'] },
      { plan: 'free', ruminationTopics: ['work-feedback'] },
    );
    expect(r.patterns[0]).toBe(40);
  });
  it('allows Reflect in Green', () => {
    const r = run({ state: grid(3, 3), needs: ['make_sense'] });
    expect(r.primary).toMatchObject({ pathway: 'reflect', toolId: 'reflect_checkout' });
  });
});

describe('Meditate gates', () => {
  it('MD-2: shutdown never gets Meditate as primary', () => {
    const r = run({
      state: grid(3, 3),
      emotions: [{ code: 'numb', intensity: 5 }],
      intent: 'meditate',
    });
    expect(r.patterns).toContain(41);
    expect(r.primary.pathway).toBe('regulate');
  });
  it('MD-2: "meditation makes me worse" is respected', () => {
    const r = run(
      { state: grid(3, 3), needs: ['find_stillness'] },
      { plan: 'free', meditationMakesWorse: true },
    );
    expect(r.primary.pathway).toBe('regulate');
  });
  it('MD-1: Amber with distress puts Regulate first and the practice second', () => {
    const r = run(
      {
        state: grid(2, 1),
        emotions: [{ code: 'anxious', intensity: 5 }],
        needs: ['pray_practice'],
      },
      {
        plan: 'free',
        savedPractices: [
          {
            id: 'p1',
            name: 'evening prayer',
            type: 'prayer',
            helpsWhenStruggling: true,
            isTransition: false,
            dueNow: true,
          },
        ],
      },
    );
    expect(r.primary.pathway).toBe('regulate');
    expect(r.alternatives.some((a) => a.kind === 'own_practice' && a.practiceId === 'p1')).toBe(
      true,
    );
  });
  it('MD-4: public settings only get a short, eyes-open practice', () => {
    const r = run({
      state: grid(3, 3),
      needs: ['find_stillness'],
      context: { environment: 'transit' },
    });
    expect(r.primary.toolId).toBe('settle_3');
  });
  it('MD-3: stillness comes from the neutral library, never from profile data', () => {
    const r = run({ state: grid(3, 3), emotions: [{ code: 'need_quiet', intensity: 2 }] });
    expect(['stillness', 'settle_3']).toContain(r.primary.toolId);
  });
});

describe('entitlements', () => {
  it('ENT-1: the primary is always a tool the plan includes', () => {
    const r = run({
      state: grid(3, 3),
      emotions: [{ code: 'lost_for_words', intensity: 5 }],
      demand: { timeline: 'T2', traits: ['communication'] },
    });
    expect(r.primary.toolId).toBe('rewrite');
    expect(r.alternatives.filter((a) => a.advanced)).toHaveLength(1);
  });
  it('Plus users get the Advanced tool as primary', () => {
    const r = run(
      {
        state: grid(3, 3),
        emotions: [{ code: 'lost_for_words', intensity: 5 }],
        demand: { timeline: 'T2', traits: ['communication'] },
      },
      plus,
    );
    expect(r.primary.toolId).toBe('draft');
  });
  it('ENT-3: no Advanced tile in Amber or Red, even for a perfect fit', () => {
    const r = run({
      state: grid(2, 1),
      emotions: [{ code: 'lost_for_words', intensity: 5 }],
      demand: { timeline: 'T2', traits: ['communication'] },
    });
    expect(r.alternatives.some((a) => a.advanced)).toBe(false);
  });
  it('ENT-3: no Advanced tile after a safety event or once dismissed', () => {
    const input: EngineInput = {
      state: grid(3, 3),
      emotions: [{ code: 'lost_for_words', intensity: 5 }],
      demand: { timeline: 'T2', traits: ['communication'] },
    };
    expect(
      run(input, { plan: 'free', safetyEventRecently: true }).alternatives.some((a) => a.advanced),
    ).toBe(false);
    expect(
      run(input, { plan: 'free', dismissedAdvanced: true }).alternatives.some((a) => a.advanced),
    ).toBe(false);
  });
  it('Amber/Red primaries come from the safety floor for every plan', () => {
    const r = run({ state: grid(1, 1), emotions: [{ code: 'overwhelmed', intensity: 9 }] }, plus);
    expect(snapshot.tools.find((t) => t.id === r.primary.toolId)?.safetyFloor).toBe(true);
  });
});

describe('card invariants', () => {
  it('Red always shows Get support now', () => {
    const r = run({ state: grid(1, 1), emotions: [{ code: 'overwhelmed', intensity: 8 }] });
    expect(r.light).toBe('red');
    expect(r.supportVisible).toBe(true);
  });
  it('pattern 30: three declines → stay out of the way', () => {
    const r = run({ state: grid(3, 3) }, { plan: 'free', declinesThisSession: 3 });
    expect(r.primary.kind).toBe('open_home');
  });
  it('does not repeat a rejected tool when another fits', () => {
    const r = run(
      { state: grid(2, 1), emotions: [{ code: 'anxious', intensity: 8 }] },
      { plan: 'free', rejectedToolIds: ['breathe'] },
    );
    expect(r.primary.toolId).not.toBe('breathe');
  });
  it('shutdown removes tools that need words', () => {
    const r = run({ state: grid(2, 2), emotions: [{ code: 'numb', intensity: 6 }] });
    expect(r.primary.toolId).toBe('breathe');
    expect(r.alternatives.some((a) => a.kind === 'quiet_message')).toBe(true);
  });
  it('the exam hall rules out movement, sound and leaving', () => {
    const r = run({
      state: grid(2, 1),
      emotions: [{ code: 'restless', intensity: 8 }],
      context: { environment: 'exam_hall' },
      demand: { timeline: 'T0' },
    });
    expect(['move', 'sounds', 'step_out']).not.toContain(r.primary.toolId);
  });
  it('personalisation re-orders alternatives only', () => {
    const input: EngineInput = { state: grid(1, 1), emotions: [{ code: 'sad', intensity: 7 }] };
    const base = run(input);
    const ranked = run(input, { plan: 'free', toolScores: { quick_message: 5 } });
    expect(ranked.primary).toEqual(base.primary);
  });
  it('fills [task] in the title from the demand', () => {
    const r = run({ state: grid(3, 3), demand: { timeline: 'T2', title: 'Debug the module' } });
    expect(r.title).toBe('Start “Debug the module” now');
  });
  it('is deterministic', () => {
    const input: EngineInput = {
      state: grid(2, 3),
      emotions: [{ code: 'bored', intensity: 5 }],
      demand: { timeline: 'T2' },
    };
    expect(run(input)).toEqual(run(input));
  });
  it('rejects an out-of-range state', () => {
    expect(() => run({ state: grid(5, 1) })).toThrow(RangeError);
  });
});

describe('audit fixes (docs/build/ENGINE_AUDIT.md)', () => {
  it('Red keeps "start small" only for a purely familiar task (Tab 0 E1M2.6)', () => {
    const familiar = run({
      state: grid(1, 2),
      emotions: [{ code: 'anxious', intensity: 2 }],
      demand: { timeline: 'T3', traits: ['done_before'] },
    });
    expect(familiar.patterns).toEqual([3]);
    const imposed = run({
      state: grid(1, 1),
      needs: ['rest'],
      demand: { timeline: 'T4', traits: ['multi_step', 'transition', 'imposed'] },
    });
    expect(imposed.light).toBe('red');
    expect(imposed.primary.pathway).not.toBe('execute');
  });
  it('RC-2: the recovery window keeps demand to Routine and never starts at full demand', () => {
    const input: EngineInput = {
      state: grid(4, 4),
      demand: { timeline: 'T2', traits: ['first_time'] },
    };
    expect(run(input).patterns).toEqual([2]);
    const r = run(input, { plan: 'free', recoveryActive: true });
    expect(r.light).toBe('blue');
    expect(r.drivers).toEqual(['routine']);
    expect(r.patterns).toEqual([31]);
  });
  const worse = {
    cellId: 'E3M3',
    finalBand: 'conditional' as const,
    light: 'yellow' as const,
    peakIntensity: 2,
    supportCompleted: true,
    safetyTriggered: false,
    pathway: 'reflect' as const,
  };
  it('G-ST3: a worse re-check makes the Support pathway visible', () => {
    const r = run({
      state: grid(2, 2),
      emotions: [{ code: 'sad', intensity: 6 }],
      recheckOf: worse,
    });
    expect(r.recheck?.outcome).toBe('worse');
    expect(r.supportVisible).toBe(true);
  });
  it('RF-2: Reflect is blocked when the re-check after Reflect is worse', () => {
    const r = run({ state: grid(3, 2), needs: ['make_sense'], recheckOf: worse });
    expect(r.gates.some((g) => g.detail.includes('re-check after Reflect is worse'))).toBe(true);
    expect([r.primary, ...r.alternatives].some((a) => a.pathway === 'reflect')).toBe(false);
  });
  it('pattern 34 is offered only in Green, Yellow or Blue', () => {
    const signals = { plan: 'free' as const, recurringStruggleConfirmed: true };
    expect(run({ state: grid(3, 3) }, signals).patterns).toContain(34);
    expect(run({ state: grid(1, 1) }, signals).patterns).not.toContain(34);
  });
  it('stage 11 re-ranks only with the personalisation consent', () => {
    const input: EngineInput = { state: grid(1, 1), emotions: [{ code: 'sad', intensity: 7 }] };
    const scores = { quick_message: 5 };
    expect(run(input, { plan: 'free', toolScores: scores }).alternatives).toEqual(
      run(input).alternatives,
    );
  });
});
