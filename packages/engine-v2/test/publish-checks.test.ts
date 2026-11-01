// Checks before publish (M4, DESIGN §5): the workbook's fixed rules hold on every card of a sweep.
import { describe, expect, it } from 'vitest';
import { compile, publishChecks, sweepInputs, type EngineRow } from '../src/index.js';
import { withExtras as catalogue } from './fixtures.js';
import { ruleset } from './support/engine.js';

const row = (id: string, engine: unknown): EngineRow => ({
  id,
  tab: 'patterns',
  sourceRef: id,
  order: 0,
  status: 'active',
  mapping: 'exact',
  engine,
});

describe('checks before publish', () => {
  it('sweeps every cell, feeling, task timing and plan, deterministically', () => {
    const inputs = sweepInputs(catalogue);
    expect(inputs).toHaveLength(17 * 34 * 3 * 2);
    expect(JSON.stringify(sweepInputs(catalogue))).toBe(JSON.stringify(inputs));
  });

  it('finds nothing wrong with the v3.3 rule set', () => {
    const report = publishChecks(ruleset);
    expect(report.counts).toEqual({});
    expect(report.ran).toBe(3468);
  }, 60_000);

  it('catches a version that breaks a fixed rule, and names the row responsible', () => {
    const broken = compile(
      [
        row('red', {
          stage: 'capacity_fit',
          rules: [
            { stage: 'state', when: null, then: [{ kind: 'band.set', to: 'very_constrained' }] },
            { when: null, then: [{ kind: 'light.set', light: 'amber' }] },
          ],
        }),
        row('task_first', {
          stage: 'orchestration',
          layer: 'trigger',
          rules: [
            {
              when: null,
              then: [{ kind: 'propose', slot: 'primary', target: { pathway: 'execute' } }],
            },
          ],
        }),
      ],
      catalogue,
    );
    const report = publishChecks(broken, [{ 'demand.present': true }]);
    expect(report.counts).toEqual({ no_task_first_amber_red: 1 });
    expect(report.violations[0]?.rows).toEqual(['task_first']);
    const red = compile(
      [
        row('red', {
          stage: 'capacity_fit',
          rules: [{ when: null, then: [{ kind: 'light.set', light: 'red' }] }],
        }),
      ],
      catalogue,
    );
    expect(publishChecks(red, [{}]).counts).toEqual({ red_support: 1 });
  });
});
