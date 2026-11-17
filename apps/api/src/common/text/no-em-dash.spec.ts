import { describe, expect, it } from 'vitest';
import { noEmDash, noEmDashes } from './no-em-dash.js';

describe('no em dashes in what FigCit says', () => {
  it('splits a clause into two sentences', () => {
    expect(noEmDash('Warming up slowly — low-pressure tasks fit best.')).toBe(
      'Warming up slowly. Low-pressure tasks fit best.',
    );
    expect(noEmDash("It's too loud — we'll start with that.")).toBe(
      "It's too loud. We'll start with that.",
    );
    expect(noEmDash('Rough day — could you text me later? 💜')).toBe(
      'Rough day. Could you text me later? 💜',
    );
  });

  it('drops a dash at either end and leaves text without one alone', () => {
    expect(noEmDash('— FigCit')).toBe('FigCit');
    expect(noEmDash('A plain sentence – with an en dash.')).toBe(
      'A plain sentence – with an en dash.',
    );
  });

  it('cleans every string in a structure, keeping its shape', () => {
    const copy = new Map([['k', 'A — b']]);
    expect(noEmDashes(copy).get('k')).toBe('A. B');
    expect(noEmDashes({ cells: [{ code: 'x', meaning: 'Calm — but tired.' }] })).toEqual({
      cells: [{ code: 'x', meaning: 'Calm. But tired.' }],
    });
  });
});
