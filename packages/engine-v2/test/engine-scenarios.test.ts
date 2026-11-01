// The engine on the real v3.3 rule set (M4): the cases ADR 0004 settles and the guards, checked
// against the rules, never against the workbook's example tables (ADR 0004 §1).
import { describe, expect, it } from 'vitest';
import type { CardItem } from '../src/index.js';
import { cardFor, ruleset } from './support/engine.js';

const show = (i: CardItem | null | undefined) =>
  i ? (i.tool ?? ('action' in i.target ? i.target.action : null)) : null;
const green = { 'state.energy': 3, 'state.mood': 4 } as const;
const task = (timeline: string) => ({ 'demand.present': true, 'demand.timeline': timeline });

describe('the engine on the v3.3 rule set', () => {
  it('compiles every mapped row, with the 2 unresolved rows exempt', () => {
    expect(ruleset.issues).toEqual([]);
    expect(ruleset.exempt).toBe(2);
    expect(ruleset.rules.length).toBeGreaterThan(250);
  });

  it('shows the support screen for the Hopeless chip at any rating (ADR 0004 §7)', () => {
    for (const rating of [null, 0, 9]) {
      const { card } = cardFor({
        ...green,
        'family.intensity': { immediate_risk_language: rating },
      });
      expect(card.kind).toBe('support_screen');
      expect(card.visible.map(show)).toEqual(['get_support_now']);
    }
  });

  it('shows "Get support now" with distress at High+ in any band (ADR 0004 §7)', () => {
    const { card } = cardFor({ ...green, 'family.intensity': { distress_overwhelm: 8 } });
    expect(card.band).toBe('conditional');
    expect(card.supportVisible).toBe(true);
    expect(card.primary?.pathway).toBe('regulate');
  });

  it('Red with a task due now: a 1-minute reset, the smallest step queued, support (ADR 0004 §3)', () => {
    const { card } = cardFor({ 'state.energy': 1, 'state.mood': 1, ...task('T0') });
    expect(card.light).toBe('red');
    expect(card.primary?.pathway).toBe('regulate');
    expect(card.minutesCap).toBe(1);
    expect(card.queued.map(show)).toEqual(['smallest_step']);
    expect(card.supportVisible).toBe(true);
    expect(card.visible.map(show)).not.toContain('try_anyway');
  });

  it('Red with a task not due now: the task is off the card', () => {
    const { card } = cardFor({ 'state.energy': 1, 'state.mood': 1, ...task('T3') });
    const all = [card.primary, ...card.alternatives, ...card.queued];
    expect(all.some((i) => i?.pathway === 'execute')).toBe(false);
  });

  it('Amber with a task and no feeling: a reset, "Start small" and "try anyway" (ADR 0004 §4)', () => {
    const { card } = cardFor({ 'state.energy': 1, 'state.mood': 3, ...task('T3') });
    expect(card.light).toBe('amber');
    expect(card.primary?.pathway).toBe('regulate');
    expect(card.alternatives.map(show)).toContain('start_small');
    expect(card.visible.map(show)).toContain('try_anyway');
    expect(card.drivers.map((d) => d.code)).not.toContain('urgency');
  });

  it('Amber keeps Urgency at T1 (ADR 0004 §9)', () => {
    const { card } = cardFor({ 'state.energy': 1, 'state.mood': 3, ...task('T1') });
    expect(card.drivers.map((d) => d.code)).toContain('urgency');
  });

  it('lets the feeling pick within what Amber allows: racing thoughts get Dump', () => {
    const { card } = cardFor({
      'state.energy': 1,
      'state.mood': 3,
      'family.intensity': { racing_disorganised_thoughts: 5 },
      ...task('T3'),
    });
    expect(card.primary?.pathway).toBe('dump');
    expect(card.primary?.tool).toBe('dump_text');
  });

  it('Yellow, no feeling, a non-routine task: an optional 2-minute reset and "Skip to task" (ADR 0004 §5)', () => {
    const { card } = cardFor({ 'state.energy': 2, 'state.mood': 3, ...task('T3') });
    expect(card.primary?.copy).toBe('card.p4.cta');
    expect(card.minutesCap).toBe(2);
    expect(card.visible.map(show)).toContain('skip_to_task');
  });

  it('keeps mild anxiety in Green an alternative, with the task first (ADR 0004)', () => {
    const { card } = cardFor({
      ...green,
      'family.intensity': { anxious_fearful: 2 },
      ...task('T3'),
    });
    expect(card.primary?.pathway).toBe('execute');
    expect(card.alternatives.map((i) => i.pathway)).toContain('regulate');
  });

  it('lets the most intense feeling lead (Tab 2 "use the highest")', () => {
    const { card } = cardFor({
      'state.energy': 3,
      'state.mood': 3,
      'family.intensity': { anxious_fearful: 9, racing_disorganised_thoughts: 5 },
    });
    expect(card.primary?.pathway).toBe('regulate');
    expect(card.alternatives.map((i) => i.pathway)).toContain('dump');
  });

  it('runs the shutdown guard from a sensation: tap-only Breathe, no words (pattern 16)', () => {
    const { card } = cardFor({
      'state.energy': 2,
      'state.mood': 2,
      'sensation.intensity': { shutdown: null },
    });
    expect(card.band).toBe('constrained');
    expect(card.primary?.tool).toBe('breathe');
    expect(card.primary?.copy).toBe('card.p16.cta');
    const all = [card.primary, ...card.alternatives, ...card.queued];
    expect(all.some((i) => i?.pathway === 'express' || i?.pathway === 'dump')).toBe(false);
  });

  it('defers the task at sensory overload unless due now (Tab 2, pattern 19)', () => {
    const input = {
      'state.energy': 3,
      'state.mood': 3,
      'family.intensity': { sensory_overload_building_meltdown_risk: 8 },
      'sensitivity.flags': ['noise', 'lights'],
      'context.setting': 'cinema_restaurant_mall_market',
    };
    const later = cardFor({ ...input, ...task('T3') }).card;
    expect(later.primary?.pathway).toBe('adapt');
    expect([...later.queued, ...later.alternatives].some((i) => i.pathway === 'execute')).toBe(
      false,
    );
    const now = cardFor({ ...input, ...task('T0') }).card;
    expect(now.queued.map(show)).toContain('smallest_step');
  });

  it('puts a safety-floor tool first in Amber and Red, on every plan (Tab 6d D)', () => {
    for (const plan of ['free', 'plus']) {
      const { card } = cardFor({ 'state.energy': 1, 'state.mood': 3, 'signals.plan': plan });
      expect(card.primary?.advanced).toBe(false);
      expect([...card.alternatives, ...card.queued].some((i) => i.advanced)).toBe(false);
    }
  });

  it('offers Meditate stillness for the need in Green, limited in an observed setting (MD-4)', () => {
    const home = cardFor({ ...green, needs: ['find_stillness'] }).card;
    expect(home.primary?.tool).toBe('stillness');
    const work = cardFor({ ...green, needs: ['find_stillness'], 'context.setting': 'work' }).card;
    expect(work.practice).toContainEqual(expect.objectContaining({ maxMinutes: 3 }));
    expect(work.alternatives.map((i) => i.pathway)).toContain('adapt');
  });

  it('shows Blue on a re-check that improved, one band up at most (RC-1, RC-3)', () => {
    const { card } = cardFor({
      'state.energy': 3,
      'state.mood': 3,
      'recheck.present': true,
      'recheck.previous_light': 'amber',
      'recheck.previous_band': 'constrained',
      'recheck.support_completed': true,
    });
    expect(card.light).toBe('blue');
    expect(card.band).toBe('conditional');
  });

  it('never shows Blue after a recent safety event (RC-5)', () => {
    const { card } = cardFor({
      'state.energy': 3,
      'state.mood': 3,
      'recheck.present': true,
      'recheck.previous_light': 'amber',
      'recheck.previous_band': 'constrained',
      'recheck.support_completed': true,
      'signals.safety_event_recently': true,
    });
    expect(card.light).toBe('yellow');
    expect(card.supportVisible).toBe(true);
  });

  it('queues the repair after the reset for shame with an overdue task (Tab 2, pattern 18)', () => {
    const { card } = cardFor({
      'state.energy': 2,
      'state.mood': 2,
      'family.intensity': { shame_guilt: 8 },
      ...task('TX'),
    });
    expect(card.primary?.pathway).toBe('regulate');
    expect(card.primary?.tone).toContain('card.regulate.self_compassion');
    expect(card.queued.map((i) => i.pathway).slice(0, 2)).toEqual(['express', 'execute']);
  });

  it("says why: the primary's rule and the input it matched", () => {
    const { card } = cardFor({ ...green, 'family.intensity': { loneliness_isolation: 6 } });
    expect(card.primary?.pathway).toBe('connect');
    expect(card.because).toContainEqual({
      fact: 'family.intensity',
      key: 'loneliness_isolation',
      value: 6,
    });
  });
});
