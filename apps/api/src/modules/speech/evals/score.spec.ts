import { describe, expect, it } from 'vitest';
import { align, scoreClip, summarise, wer, wordsOf } from './score.js';
import { loadSpeechSet } from './set.js';

const speech = (id: string, text: string, room: 'quiet' | 'noisy' = 'quiet') => ({
  id,
  kind: 'speech' as const,
  room,
  text,
  accent: 'Scottish',
});

describe('speech eval set', () => {
  it('has about 50 clips across rooms, accents, pauses and no-speech clips', () => {
    const { clips } = loadSpeechSet();
    expect(clips.length).toBe(50);
    expect(new Set(clips.map((c) => c.accent).filter(Boolean)).size).toBeGreaterThanOrEqual(5);
    expect(clips.filter((c) => c.room === 'noisy').length).toBeGreaterThanOrEqual(20);
    expect(clips.filter((c) => c.silenceSeconds).length).toBeGreaterThanOrEqual(5);
    expect(clips.filter((c) => c.kind === 'silence').length).toBe(10);
  });
});

describe('speech scoring', () => {
  it('compares words only', () => {
    expect(wordsOf('I’m late, sorry!')).toEqual(["i'm", 'late', 'sorry']);
  });

  it('counts substitutions, deletions and insertions', () => {
    expect(align(wordsOf('buy milk and bread'), wordsOf('buy silk and bread'))).toMatchObject({
      substitutions: 1,
      deletions: 0,
      insertions: 0,
    });
    expect(align(wordsOf('buy milk and bread'), wordsOf('buy bread'))).toMatchObject({
      deletions: 2,
      insertions: 0,
    });
    expect(align(wordsOf('buy bread'), wordsOf('buy bread thank you for watching'))).toMatchObject({
      insertions: 4,
      longestInsertion: 4,
    });
  });

  it('flags invented text: a run of unsaid words, or any words on silence', () => {
    expect(
      scoreClip(speech('sp-001', 'buy bread'), 'buy bread thanks for watching', 1, false).invented,
    ).toBe(true);
    expect(scoreClip(speech('sp-001', 'buy the bread'), 'buy a bread', 1, false).invented).toBe(
      false,
    );
    const silence = { id: 'sp-041', kind: 'silence' as const, room: 'quiet' as const, text: '' };
    expect(scoreClip(silence, '', 1, false).invented).toBe(false);
    expect(scoreClip(silence, 'Thank you.', 1, false)).toMatchObject({
      invented: true,
      inventedWords: 2,
    });
  });

  it('works out corpus WER and splits it by room and accent', () => {
    const results = [
      scoreClip(speech('sp-001', 'one two three four'), 'one two three four', 100, false),
      scoreClip(speech('sp-002', 'five six', 'noisy'), 'five', 300, false),
    ];
    expect(wer(results)).toBeCloseTo(1 / 6);
    const s = summarise(results);
    expect(s.werQuiet).toBe(0);
    expect(s.werNoisy).toBe(0.5);
    expect(s.werByAccent['Scottish']).toBeCloseTo(1 / 6);
    expect(s.latencyP50).toBe(100);
  });
});
