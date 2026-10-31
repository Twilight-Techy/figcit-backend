// Tab 9: the founder's own scenario, traced through every stage.
import { describe, expect, it } from 'vitest';
import { evaluate } from '../src/index.js';
import { free, grid, snapshot } from './helpers.js';

describe('Tab 9 worked example', () => {
  const result = evaluate(
    {
      state: grid(3, 2),
      emotions: [
        { code: 'anxious', intensity: 7 },
        { code: 'restless', intensity: 8 },
      ],
      sensations: [
        { code: 'heaviness', bodyRegions: ['head'] },
        { code: 'aches', intensity: 3 },
      ],
      context: { environment: 'work', sensitivity: ['sound', 'noise', 'lights', 'crowd'] },
      needs: ['feel_calmer', 'break_down'],
      demand: {
        timeline: 'T1',
        traits: ['with_others', 'multi_step'],
        title: 'Prepare a presentation at a meeting',
      },
    },
    snapshot,
    free,
  );

  it('names the state Flow Entering with a Conditional baseline', () => {
    expect(result.state).toMatchObject({ cellId: 'E3M2', name: 'Flow Entering', confirmed: true });
    expect(result.band.baseline).toBe('conditional');
  });

  it('lowers the band one step for High anxiety (EX-1) but not for Work (no CX-1)', () => {
    expect(result.band.final).toBe('constrained');
    expect(result.band.modifiers.map((m) => m.rule)).toEqual(['EX-1']);
    expect(result.light).toBe('amber');
  });

  it('tags Urgency, Collaboration and Challenge but uses Routine only in Amber', () => {
    expect(result.timeline).toEqual({ code: 'T1', stepCap: 5 });
    expect(result.drivers).toEqual(['routine']);
  });

  it('recommends a seated, discreet reset first with the breakdown queued (pattern 5)', () => {
    expect(result.patterns[0]).toBe(5);
    expect(result.title).toBe("Let's reduce the load first");
    expect(result.primary.pathway).toBe('regulate');
    expect(['breathe', 'ground']).toContain(result.primary.toolId);
    expect(result.queuedStep?.pathway).toBe('execute');
    expect(result.alternatives.map((a) => a.kind)).toContain('try_anyway');
    expect(result.rationale.text).toMatch(
      /^Because you're .+ anxiety, FigCit suggests a quick reset before the task\./,
    );
  });

  it('never shows an Advanced tile in Amber', () => {
    expect(result.alternatives.some((a) => a.advanced)).toBe(false);
  });

  it('after a calmer re-check shows Blue and resurfaces the task in small steps', () => {
    const recheck = evaluate(
      {
        state: grid(3, 3),
        emotions: [{ code: 'anxious', intensity: 3 }],
        context: { environment: 'work' },
        demand: { timeline: 'T1', traits: ['with_others', 'multi_step'] },
        recheckOf: {
          cellId: 'E3M2',
          finalBand: 'constrained',
          light: 'amber',
          peakIntensity: 8,
          supportCompleted: true,
          safetyTriggered: false,
          pathway: 'regulate',
          toolId: 'breathe',
        },
      },
      snapshot,
      free,
    );
    expect(recheck.light).toBe('blue');
    expect(recheck.recheck?.rule).toBe('RC-1');
    expect(recheck.band.final).toBe('conditional'); // RC-3: one step up only
    expect(recheck.primary).toMatchObject({ pathway: 'execute', toolId: 'smallest_step' });
  });
});
