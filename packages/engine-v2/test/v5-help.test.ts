// Rules Engine v5.0: the Help menu (Tab 7), the gates (Tab 12) and the card rules SEQ-1, SEQ-2
// and P42 (Tab 11), with Tab 21's T-02, T-08, T-18 and T-25.
import { describe, expect, it } from 'vitest';
import { cardWordsV5, copyOf, run, type Card, type EngineInput } from '../src/index.js';
import { catalogue, FULL, imported, report, ruleset } from './support/v5.js';

const cardOf = (input: EngineInput): Card => {
  const r = run(ruleset, { ...FULL, ...input });
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.card;
};
const opens = (c: Card, i = 0): string | null => {
  const item = i === 0 ? c.primary : c.alternatives[i - 1];
  if (!item) return null;
  return item.tool ?? ('action' in item.target ? `@${item.target.action}` : null);
};

/** A check-in in each light: its cell, and a feeling where the light needs one. */
const IN: Readonly<Record<string, EngineInput>> = {
  green: { 'state.energy': 3, 'state.mood': 3, 'family.intensity': { calm: 5 } },
  yellow: { 'state.energy': 2, 'state.mood': 2, 'family.intensity': { calm: 5 } },
  amber: { 'state.energy': 1, 'state.mood': 3, 'family.intensity': { calm: 5 } },
  red: { 'state.energy': 1, 'state.mood': 1, 'family.intensity': { calm: 5 } },
  blue: {
    'state.energy': 2,
    'state.mood': 3,
    'family.intensity': { calm: 3 },
    'recheck.present': true,
    'recheck.previous_light': 'amber',
    'recheck.support_completed': true,
    'recheck.previous_baseline': 'constrained',
    'recheck.previous_band': 'constrained',
    'recheck.previous_peak': 9,
  },
};
const ALL = ['hc_1', 'hc_2', 'hc_3', 'hc_4', 'hc_5', 'hc_6', 'hc_7', 'hc_8'];

describe('Rules Engine v5.0: the Help menu (Tab 7)', () => {
  it('reads the lights of the check-ins below', () => {
    for (const [light, input] of Object.entries(IN)) expect(cardOf(input).light).toBe(light);
  });

  it('T-25: shows the cards Tab 7 shows in each light', () => {
    const shown = (input: EngineInput) => cardOf(input).menu?.cards;
    expect(shown(IN['green'] ?? {})).toEqual(ALL);
    expect(shown(IN['yellow'] ?? {})).toEqual(ALL);
    expect(shown(IN['blue'] ?? {})).toEqual(ALL);
    // Amber: no Reflect (RF-1); Meditate only if calm.
    expect(shown(IN['amber'] ?? {})).toEqual(ALL.filter((c) => c !== 'hc_6'));
    expect(shown({ ...IN['amber'], 'family.intensity': { anxious: 5 } })).toEqual(
      ALL.filter((c) => c !== 'hc_6' && c !== 'hc_7'),
    );
    // Red: Help me calm down, Too much in my head, I want to talk to someone.
    expect(shown(IN['red'] ?? {})).toEqual(['hc_1', 'hc_2', 'hc_8']);
    // Yellow at Strong: no Reflect (Mild/Moderate only).
    expect(
      shown({ 'state.energy': 3, 'state.mood': 3, 'family.intensity': { not_good_enough: 7 } }),
    ).not.toContain('hc_6');
  });

  it("shows the 'More needs' of the cards shown; your own practice in any light", () => {
    const more = cardOf(IN['red'] ?? {}).menu?.more ?? [];
    expect(more).toContain('pray_or_do_my_practice');
    expect(more).toContain('rest_without_guilt');
    expect(more).not.toContain('find_stillness');
    expect(more).not.toContain('learn_what_works_for_me');
    expect(cardOf(IN['green'] ?? {}).menu?.more).toHaveLength(15);
  });

  it('T-18: Losing someone puts Reflect, Connect and Meditate first; the colour is unchanged', () => {
    const card = cardOf({ ...IN['green'], 'life.now': ['losing_someone'] });
    expect(card.menu?.cards.slice(0, 3)).toEqual(['hc_6', 'hc_8', 'hc_7']);
    expect(card.light).toBe('green');
  });

  it('SEQ-2: a card picked sets the pathway, with its headline', () => {
    const card = cardOf({ ...IN['green'], 'help.card': 'hc_8' });
    expect(card.primary?.pathway).toBe('connect');
    expect(card.pattern).toBe('11');
    expect(card.helpSwap).toBeUndefined();
  });

  it('SEQ-2: a blocked card swaps safely and says why (RF-1, pattern 40)', () => {
    const card = cardOf({ ...IN['red'], 'help.card': 'hc_6' });
    expect(card.helpSwap).toEqual({ card: 'hc_6', reason: 'help.swap.hc_6' });
    expect(card.pattern).toBe('40');
    expect(opens(card)).toBe('dmp_capture');
    expect([card.primary, ...card.alternatives].some((i) => i?.pathway === 'reflect')).toBe(false);
  });

  it('MD-2: meditation in no-words mode swaps to the tap-only breathe', () => {
    const card = cardOf({ ...IN['green'], 'family.intensity': { frozen: 6 }, 'help.card': 'hc_7' });
    expect(card.noWords).toBe(true);
    expect(card.helpSwap?.card).toBe('hc_7');
    expect(card.primary?.pathway).not.toBe('meditate');
  });

  it('the user may start their own practice in any light (Tab 7, ENT-4)', () => {
    const card = cardOf({ ...IN['red'], 'help.card': 'pray_or_do_my_practice' });
    expect(opens(card)).toBe('med_own');
  });

  it('I need help now is the safety override (pattern 28)', () => {
    const input = { ...IN['green'], 'help.card': 'i_need_help_now' };
    const card = cardOf(input);
    expect(card.kind).toBe('support_screen');
    // Pattern 28 and its Help/SOS headline, not the generic support screen (53).
    expect(card.pattern).toBe('28');
    const words = cardWordsV5(
      { ...card },
      { ...FULL, ...input },
      { copy: copyOf(imported.records), catalogue, tasks: [] },
    );
    expect(words.headline).toBe("You don't have to go through this alone.");
  });

  it("T-02: a support card and a task in Green ask 'Which first?'; the task is never a practice", () => {
    const card = cardOf({
      ...IN['green'],
      'help.card': 'hc_7',
      'tasks.count': 1,
      'tasks.chips': ['usual'],
    });
    expect(card.pattern).toBe('43');
    expect(card.primary?.pathway).toBe('meditate');
    expect(card.alternatives.map((a) => ('action' in a.target ? a.target.action : a.tool))).toEqual(
      ['start_task'],
    );
  });

  it('SEQ-1: in Amber the support comes first, then one small step of the task (pattern 5)', () => {
    const card = cardOf({
      ...IN['amber'],
      'help.card': 'hc_2',
      'tasks.count': 1,
      'tasks.chips': ['usual'],
    });
    expect(card.pattern).toBe('5');
    expect(card.primary?.pathway).toBe('dump');
    expect(opens(card, 1)).toBe('@start_small');
  });
});

describe('Rules Engine v5.0: Quick check-in (P42, CTX-U)', () => {
  it('T-08: discreet tools first and the link to say where you are', () => {
    // Amber with no feeling picked: Breathe, then Rest (pattern 6), both in their quiet versions.
    const card = cardOf({ 'state.energy': 1, 'state.mood': 3, 'checkin.mode': 'quick' });
    expect(card.light).toBe('amber');
    expect(opens(card)).toBe('reg_breathe_discreet');
    expect(opens(card, 1)).toBe('reg_rest_pause');
    expect(card.prompts).toContain('card.p42.link');
  });
});

describe('Rules Engine v5.0: every rule row is read', () => {
  it('leaves no v5.0 rule row pending or invalid', () => {
    const pending = Object.entries(report.byTab)
      .filter(([, c]) => c.pending > 0)
      .map(([tab, c]) => `${tab}: ${String(c.pending)}`);
    expect(pending).toEqual([]);
    expect(report.invalid).toEqual([]);
    expect(report.unmatched).toEqual([]);
  });
});

describe('Rules Engine v5.0: safety and feelings rows', () => {
  it('SF-1: risk language is Help/SOS, nothing else (pattern 28)', () => {
    const card = cardOf({ ...IN['green'], 'safety.risk': true });
    expect(card.kind).toBe('support_screen');
  });

  it("SE-1 (T-36): 'Something else' takes the group its one tap gave", () => {
    const base = { 'state.energy': 3, 'state.mood': 3, 'family.intensity': { something_else: 6 } };
    expect(cardOf(base).feeling?.group).toBe('unsorted');
    const off = cardOf({ ...base, 'feeling.something_else_group': 'shutdown' });
    expect(off.feeling?.group).toBe('shutdown');
    // Shutdown at Moderate: one step lower and no-words mode (FE-2).
    expect(off.noWords).toBe(true);
    expect(off.light).toBe('yellow');
  });

  it('T-41 (MV-2): no Dance or body scan in no-words mode', () => {
    const card = cardOf({
      'state.energy': 3,
      'state.mood': 3,
      'family.intensity': { shut_down: 5 },
    });
    expect(card.noWords).toBe(true);
    const tools = [card.primary, ...card.alternatives].map((i) => i?.tool);
    expect(tools.some((t) => t?.startsWith('reg_dance') || t === 'med_bodyscan')).toBe(false);
  });
});

describe('Rules Engine v5.0: back to work, study or training (RW-2, pattern 60)', () => {
  it("a Quick check-in with tasks is the day's load check, in the chips' plain words", () => {
    const input = {
      'state.energy': 1,
      'state.mood': 3,
      'checkin.mode': 'quick',
      'prefs.return_to_work': true,
      'tasks.count': 2,
      'tasks.chips': ['usual', 'can_t_wait'],
    };
    const card = cardOf(input);
    expect(card.light).toBe('amber');
    expect(card.pattern).toBe('60');
    expect(card.primary?.tool).toBe('rtw_load');
    const words = cardWordsV5(
      { ...card },
      { ...FULL, ...input },
      {
        copy: copyOf(imported.records),
        catalogue,
        tasks: [
          { title: 'Shift 10-2', chip: 'can_t_wait' },
          { title: 'Handover', chip: 'usual' },
        ],
      },
    );
    expect(words.headline).toBe("Today fits the thing that can't wait and the usual things.");
  });

  it('not without it, and not in Red', () => {
    const base = { 'checkin.mode': 'quick', 'tasks.count': 1, 'tasks.chips': ['usual'] };
    expect(cardOf({ ...IN['green'], ...base }).pattern).not.toBe('60');
    expect(cardOf({ ...IN['red'], ...base, 'prefs.return_to_work': true }).pattern).not.toBe('60');
  });
});
