// The app's check-in to the engine's input (M5, E-52): every answer through its option's "Maps to".
import { describe, expect, it } from 'vitest';
import {
  checkInOptionsOf,
  checkInput,
  explainCheckIn,
  factsFromCheckIn,
  foldContributions,
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

describe('the check-in explained answer by answer (E-61)', () => {
  const checkIn: CheckInValues = {
    ...base,
    emotions: [
      { code: 'overwhelmed', intensity: 8 },
      { code: 'tired', intensity: 4 },
    ],
    sensations: [{ code: 'looping', intensity: 6 }, { code: 'bright_lights' }],
    context: { environment: 'work', supports: ['headphones'] },
    needs: ['clear_head'],
    justSupport: false,
    demand: { traits: ['not_a_value'], puttingOff: true },
  };

  it('says which answer gave each piece of input', () => {
    const { contributions } = explainCheckIn(checkIn, options, catalogue, 'T2');
    expect(contributions).toContainEqual({
      kind: 'rating',
      from: { input: 'emotions', code: 'overwhelmed' },
      fact: 'family.intensity',
      key: 'distress_overwhelm',
      value: 8,
    });
    expect(contributions).toContainEqual({
      kind: 'rating',
      from: { input: 'sensations', code: 'looping' },
      fact: 'sensation.intensity',
      key: 'racing',
      value: 6,
    });
    expect(contributions).toContainEqual({
      kind: 'value',
      from: { input: 'context.environment', code: 'work' },
      fact: 'context.setting',
      value: 'work',
    });
    expect(contributions).toContainEqual({
      kind: 'member',
      from: { input: 'demand.puttingOff' },
      fact: 'demand.characteristics',
      value: 'long_avoided_task',
    });
    expect(contributions).toContainEqual({
      kind: 'value',
      from: { input: 'demand.timeline', code: 'T2' },
      fact: 'demand.timeline',
      value: 'T2',
    });
  });

  it('lists the answers that give nothing, and why', () => {
    expect(explainCheckIn(checkIn, options, catalogue).unmapped).toEqual([
      { from: { input: 'emotions', code: 'tired' }, why: 'maps_to_nothing' },
      { from: { input: 'sensations', code: 'bright_lights' }, why: 'maps_to_nothing' },
      { from: { input: 'demand.traits', code: 'not_a_value' }, why: 'not_a_value' },
    ]);
    const supportOnly = explainCheckIn(
      { ...base, justSupport: true, demand: {} },
      options,
      catalogue,
    );
    expect(supportOnly.unmapped).toEqual([{ from: { input: 'demand' }, why: 'support_only' }]);
    const unknown = explainCheckIn({ ...base, needs: ['nope'] }, options, catalogue);
    expect(unknown.unmapped).toEqual([
      { from: { input: 'needs', code: 'nope' }, why: 'not_offered' },
    ]);
  });

  it('is exactly what the engine gets: folded, it gives the input facts', () => {
    const server = { timeline: 'T2', facts: { 'signals.plan': 'plus' } };
    const { contributions } = explainCheckIn(checkIn, options, catalogue, server.timeline);
    expect({ ...foldContributions(contributions), ...server.facts }).toEqual(
      factsFromCheckIn(checkIn, options, catalogue, server),
    );
  });

  it('keeps the strongest rating of a key, and a set without repeats', () => {
    const from = { input: 'emotions' };
    expect(
      foldContributions([
        { kind: 'rating', from, fact: 'family.intensity', key: 'a', value: null },
        { kind: 'rating', from, fact: 'family.intensity', key: 'a', value: 4 },
        { kind: 'rating', from, fact: 'family.intensity', key: 'a', value: 2 },
        { kind: 'member', from, fact: 'needs', value: 'x' },
        { kind: 'member', from, fact: 'needs', value: 'x' },
      ]),
    ).toEqual({ 'family.intensity': { a: 4 }, needs: ['x'] });
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
