// Stage 0 safety screen: phrase variants all route to Help; ordinary language doesn't.
import { describe, expect, it } from 'vitest';
import { buildSafetyScreen, evaluate, normalise } from '../src/index.js';
import { free, grid, snapshot } from './helpers.js';

const screen = buildSafetyScreen(snapshot.safety.phrases, snapshot.safety.exclusions);

describe('normalise', () => {
  it('folds case, accents, apostrophes and spacing', () => {
    expect(normalise("  I DON'T   want to be HERE!! ")).toBe('i dont want to be here');
    expect(normalise('Café — naïve')).toBe('cafe naive');
  });
  it('undoes character swaps inside words but leaves numbers alone', () => {
    expect(normalise('k1ll mys3lf')).toBe('kill myself');
    expect(normalise('call 116 123')).toBe('call 116 123');
  });
});

describe('safety screen', () => {
  const risky = [
    'I want to kill myself',
    'i dont want to be here anymore',
    "I don't want to be here",
    'thinking about ENDING MY LIFE',
    'k1ll myself',
    'I keep wanting to hurt myself',
    'self-harm again',
    'everyone would be better off without me',
    "what's the point, I feel like a burden to everyone",
    'I am not safe at home',
    'suicidal 😞',
  ];
  for (const text of risky) {
    it(`flags "${text}"`, () => {
      expect(screen.check([text])).not.toBeNull();
    });
  }

  const ordinary = [
    'I killed it in the presentation',
    'kill time before the train',
    'I am dying to see the results',
    'the deadline is killing me softly with paperwork',
    'my self harmony project',
    'skill myself up on React',
    'I want to be here, it is lovely',
    '',
  ];
  for (const text of ordinary) {
    it(`does not flag "${text}"`, () => {
      expect(screen.check([text])).toBeNull();
    });
  }

  it('reports the rule and category, never the text', () => {
    expect(screen.check(['I might cut myself'])).toEqual({
      ruleId: 'SF-1.self_harm',
      category: 'self_harm',
    });
  });

  it('overrides every layer and opens Help (pattern 28)', () => {
    const result = evaluate(
      {
        state: grid(4, 4),
        emotions: [{ code: 'calm', intensity: 1 }],
        freeText: ['I want to end it all'],
      },
      snapshot,
      free,
    );
    expect(result.safety).toMatchObject({ triggered: true, source: 'phrase', category: 'suicide' });
    expect(result.patterns).toEqual([28]);
    expect(result.primary.kind).toBe('support');
    expect(result.supportVisible).toBe(true);
    expect(result.light).toBe('red');
    expect(result.notNow).toBe(false);
  });

  it('treats Hopeless at High+ as a risk option (D-07, B-10)', () => {
    expect(
      evaluate(
        { state: grid(2, 1), emotions: [{ code: 'hopeless', intensity: 8 }] },
        snapshot,
        free,
      ).safety,
    ).toMatchObject({ triggered: true, source: 'option' });
    expect(
      evaluate(
        { state: grid(2, 1), emotions: [{ code: 'hopeless', intensity: 4 }] },
        snapshot,
        free,
      ).safety.triggered,
    ).toBe(false);
  });

  it('screens in linear time (no backtracking)', () => {
    const long = 'a '.repeat(50_000) + 'kill myself';
    expect(screen.check([long])).not.toBeNull();
  });
});
