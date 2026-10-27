import { readFileSync } from 'node:fs';
import type { Snapshot } from '@figcit/engine';
import { describe, expect, it } from 'vitest';
import { breakDownByRules } from './fallbacks/break-down.js';
import { suggestDriversByRules } from './fallbacks/drivers.js';
import { parseNeedByRules } from './fallbacks/parse-need.js';
import { bucketFor } from './fallbacks/sort-dump.js';
import { breakDownTask, simplify, sortDump } from './ai.tasks.js';
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
});
