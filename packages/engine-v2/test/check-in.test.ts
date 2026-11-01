// The app's check-in to the engine's input (M5, E-52): every answer through its option's "Maps to".
import { describe, expect, it } from 'vitest';
import {
  checkInOptionsOf,
  checkInput,
  factsFromCheckIn,
  type CheckInValues,
} from '../src/index.js';
import { imported } from './fixtures.js';
import { cardFor } from './support/engine.js';

const { options, catalogue } = checkInOptionsOf(imported.records);
const base: CheckInValues = {
  state: { kind: 'grid', energy: 2, mood: 3 },
  emotions: [],
  sensations: [],
  context: {},
  needs: [],
  justSupport: false,
};

describe('check-in to engine input', () => {
  it('maps each answer to its catalogue value, and gives a valid input', () => {
    const facts = factsFromCheckIn(
      {
        ...base,
        emotions: [
          { code: 'overwhelmed', intensity: 8 },
          { code: 'anxious', intensity: null },
        ],
        sensations: [{ code: 'racing_thoughts' }, { code: 'looping', intensity: 6 }],
        context: { environment: 'work', supports: ['headphones'], sensitivity: ['noise'] },
        needs: ['clear_head'],
        demand: { traits: ['complex_multi_step_effortful', 'not_a_value'], puttingOff: true },
      },
      options,
      catalogue,
      { timeline: 'T1', facts: { 'signals.plan': 'free' } },
    );
    expect(facts).toEqual({
      'state.energy': 2,
      'state.mood': 3,
      'family.intensity': { distress_overwhelm: 8, anxious_fearful: null },
      'sensation.intensity': { racing: 6 },
      'context.setting': 'work',
      'context.supports': ['headphones'],
      'sensitivity.flags': ['noise'],
      needs: ['clear_my_head'],
      'entry.support_only': false,
      'demand.present': true,
      'demand.timeline': 'T1',
      'demand.characteristics': ['complex_multi_step_effortful', 'long_avoided_task'],
      'signals.plan': 'free',
    });
    expect(checkInput(facts, catalogue)).toEqual([]);
  });

  it('takes the confirmed cell on the Not-sure path, and nothing when the state is skipped', () => {
    expect(
      factsFromCheckIn(
        { ...base, state: { kind: 'not_sure', confirmedCell: 'E1M4' } },
        options,
        catalogue,
      ),
    ).toMatchObject({
      'state.not_sure': true,
      'state.energy': 1,
      'state.mood': 4,
    });
    const skipped = factsFromCheckIn({ ...base, state: { kind: 'not_given' } }, options, catalogue);
    expect(skipped['state.energy']).toBeUndefined();
    expect(skipped['state.not_sure']).toBeUndefined();
  });

  it('leaves out the task when the user only wants support', () => {
    const facts = factsFromCheckIn(
      { ...base, justSupport: true, demand: { puttingOff: true } },
      options,
      catalogue,
    );
    expect(facts).toMatchObject({ 'entry.support_only': true, 'demand.present': false });
  });

  it('runs: the Hopeless chip gives the support screen', () => {
    const facts = factsFromCheckIn(
      { ...base, emotions: [{ code: 'hopeless', intensity: null }] },
      options,
      catalogue,
    );
    expect(cardFor(facts).card.kind).toBe('support_screen');
  });
});

describe('re-check facts the engine works out', () => {
  it('shows Blue when the harder feelings dropped by 2+, without a better band (RC-1)', () => {
    const { card } = cardFor({
      'state.energy': 2,
      'state.mood': 3,
      'family.intensity': { anxious_fearful: 3 },
      'recheck.present': true,
      'recheck.previous_light': 'yellow',
      'recheck.previous_band': 'conditional',
      'recheck.previous_peak': 8,
      'recheck.support_completed': true,
    });
    expect(card.light).toBe('blue');
  });
});
