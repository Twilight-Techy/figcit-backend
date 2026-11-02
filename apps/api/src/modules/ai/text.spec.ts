import { readFileSync } from 'node:fs';
import type { Snapshot } from '@figcit/engine';
import { describe, expect, it } from 'vitest';
import { breakDownByRules } from './fallbacks/break-down.js';
import { suggestDriversByRules } from './fallbacks/drivers.js';
import { draftByTemplate, scriptByTemplate, structureByTemplate } from './fallbacks/express.js';
import { mapFeelingByRules } from './fallbacks/map-feeling.js';
import { parseNeedByRules } from './fallbacks/parse-need.js';
import { splitTasksByRules } from './fallbacks/split-tasks.js';
import { bucketFor } from './fallbacks/sort-dump.js';
import { breakDownTask, parseNeed, simplify, sortDump, suggestDrivers } from './ai.tasks.js';
import { changes, introducesFacts, scrub, simplifyByRules, words } from './text.js';

const snapshot = JSON.parse(
  readFileSync(
    new URL('../../../../../packages/engine/fixtures/snapshot.json', import.meta.url),
    'utf8',
  ),
) as Snapshot;

describe('text rules', () => {
  it('scrubs contact details and caps length', () => {
    expect(scrub('mail me at a.b@example.com or +44 7700 900123 https://x.y/z', 200)).toBe(
      'mail me at [email] or [number] [link]',
    );
    expect(scrub('a'.repeat(50), 10)).toHaveLength(10);
  });

  it('does not take a capitalised first word for a new name', () => {
    expect(introducesFacts('swap saturday shift', 'Sorry, no, I can’t do it. Okay, thanks.')).toBe(
      false,
    );
    expect(introducesFacts('swap saturday shift', 'Ask Priya to cover it.')).toBe(true);
  });

  it('removes hedges and reports what changed', () => {
    const before =
      "I'm so sorry to bother you, I was just wondering if I could get an extension on the essay?";
    const after = simplifyByRules(before, 'gentle');
    expect(after.toLowerCase()).not.toContain('sorry');
    expect(after).toContain('extension on the essay');
    const c = changes(before, after);
    expect(c.removedPhrases).toBeGreaterThanOrEqual(2);
    expect(c.wordsAfter).toBeLessThan(c.wordsBefore);
    expect(c.summary).toMatch(/→/);
  });

  it('keeps the ask at the shortest level and is never longer', () => {
    const text =
      'Hope you are well. Sorry this is late. Could I have until Friday for the report? Thanks so much.';
    const out = simplifyByRules(text, 'shortest');
    expect(out).toContain('Friday');
    expect(words(out)).toBeLessThanOrEqual(words(text));
  });

  it('flags new facts', () => {
    expect(introducesFacts('Can we meet tomorrow?', 'Can we meet on 12 March?')).toBe(true);
    expect(introducesFacts('Can Sam meet at 3?', 'Can Sam meet at 3?')).toBe(false);
  });

  it('simplify check rejects longer output', () => {
    expect(
      simplify.check('one two three four five six', { text: 'one two three', level: 'clear' }),
    ).toBe(false);
  });
});

describe('fallbacks', () => {
  it('parses needs, a task and chips from plain words', () => {
    const r = parseNeedByRules(
      "I'm overwhelmed and I need to finish my essay for tomorrow",
      snapshot,
    );
    expect(r.needs).toContain('feel_calmer');
    expect(r.task?.title).toMatch(/^Finish my essay/);
    expect(r.task?.type).toBe('study');
    expect(r.heard.some((h) => h.kind === 'task')).toBe(true);
  });

  it('hears everyday words, settings and events', () => {
    const r = parseNeedByRules("I can't focus and my head is buzzing, exam tomorrow", snapshot);
    expect(r.needs).toContain('clear_head');
    expect(r.task?.title).toBe('Exam tomorrow');
    expect(r.heard.map((h) => h.label)).toContain('Restless');
    const loud = parseNeedByRules('too loud in here', snapshot);
    expect(loud.heard).toContainEqual({ label: 'Noisy here', kind: 'setting' });
  });

  it('shortens chip labels on a word boundary', () => {
    for (const h of parseNeedByRules('I feel so alone tonight', snapshot).heard) {
      expect(h.label.length).toBeLessThanOrEqual(24);
      expect(h.label).not.toMatch(/\b\w{1,2}$/);
    }
  });

  it('turns notes into sentences for drafts, structure and scripts', () => {
    const notes = 'need extension on essay\nmum in hospital';
    expect(draftByTemplate(notes, 'my tutor')).toBe(
      'Hi tutor,\n\nNeed extension on essay.\n\nMum in hospital.\n\nWould that be possible? Let me know if you need anything else from me.\n\nThanks,',
    );
    expect(structureByTemplate(notes).sections[1]).toEqual({
      role: 'why',
      text: 'Mum in hospital.',
    });
    expect(scriptByTemplate(notes).lines[0]?.text).toBe('Need extension on essay.');
  });

  it('maps feelings with a confidence, and is less sure when the words are hedged or mixed', () => {
    expect(mapFeelingByRules('I feel anxious', snapshot).matches[0]).toEqual({
      code: 'anxious',
      confidence: 0.9,
    });
    const hedged = mapFeelingByRules('kind of worried I guess', snapshot).matches[0];
    expect(hedged?.code).toBe('anxious');
    expect(hedged?.confidence).toBeLessThan(0.7);
    expect(mapFeelingByRules('the weather is nice', snapshot).matches).toEqual([]);
  });

  it('splits only where each part is its own task', () => {
    expect(splitTasksByRules('I need to email Sam and finish the report').tasks).toEqual([
      'Email Sam',
      'Finish the report',
    ]);
    expect(splitTasksByRules('Email Sam and Jo about the trip').tasks).toEqual([
      'Email Sam and Jo about the trip',
    ]);
    expect(splitTasksByRules('call the GP; book the dentist, then pay rent').tasks).toHaveLength(3);
  });

  it('spots support-only', () => {
    expect(parseNeedByRules('I just want to talk to someone', snapshot).supportOnly).toBe(true);
  });

  it('never suggests urgency', () => {
    const r = suggestDriversByRules('Urgent: revise for the exam with my study group');
    expect(r.drivers).toContain('challenge');
    expect(r.drivers).toContain('collaboration');
    expect(r.drivers as string[]).not.toContain('urgency');
  });

  it('breaks down within the step cap and gently under strain', () => {
    const normal = breakDownByRules('Write the essay', 8, false);
    expect(normal.steps.length).toBeLessThanOrEqual(8);
    const strained = breakDownByRules('Write the essay', 8, true);
    expect(strained.steps.length).toBeLessThanOrEqual(3);
    expect(strained.steps.every((s) => s.minutes <= 5)).toBe(true);
    expect(
      breakDownTask
        .schema({ title: 'x', stepCap: 3, strained: false })
        .safeParse(breakDownByRules('Email my tutor', 3, false)).success,
    ).toBe(true);
  });

  it('keeps steps to five minutes for someone who is strained', () => {
    const strained = { title: 'Clean the kitchen', stepCap: 5, strained: true };
    const step = (minutes: number) => ({ text: 'Clear the worktop', minutes });
    expect(
      breakDownTask.schema(strained).safeParse({ steps: [step(10)], estimatedDemand: 'low' })
        .success,
    ).toBe(false);
    expect(breakDownTask.check({ steps: [step(5)], estimatedDemand: 'low' }, strained)).toBe(true);
    expect(breakDownTask.check({ steps: [step(6)], estimatedDemand: 'low' }, strained)).toBe(false);
    expect(
      breakDownTask.check(
        { steps: [step(20)], estimatedDemand: 'low' },
        { ...strained, strained: false },
      ),
    ).toBe(true);
  });

  it('buckets dump items and never makes worries into todos', () => {
    expect(bucketFor('What if I fail the exam')).toBe('worries');
    expect(bucketFor('Call the dentist')).toBe('todo');
    expect(bucketFor('Maybe paint the hallway green')).toBe('ideas');
    expect(bucketFor('The meeting moved rooms')).toBe('notes');
    expect(
      sortDump.check(
        { items: [{ id: 'a', bucket: 'todo' }] },
        {
          items: [
            { id: 'a', text: '' },
            { id: 'b', text: '' },
          ],
        },
      ),
    ).toBe(false);
  });

  it('decodes drivers and drops need codes shown as heard chips', () => {
    // Decision scoring: drivers at or above 0.20, best first, at most three; never "none".
    const p = { A: 0.05, B: 0.5, C: 0.25, D: 0.0, E: 0.0, F: 0.0, G: 0.0, H: 0.2 };
    expect(suggestDrivers.decode(p, { title: 'Weekly team meeting' }).drivers).toEqual([
      'challenge',
      'routine',
    ]);
    const heard = parseNeed.clean?.(
      {
        needs: ['feel_calmer'],
        heard: [
          { label: 'racing heart', kind: 'feeling' },
          { label: 'stop_switch', kind: 'need' },
        ],
        task: null,
        supportOnly: false,
      },
      { text: 'x', snapshot },
    ).heard;
    expect(heard).toEqual([{ label: 'racing heart', kind: 'feeling' }]);
  });
});
