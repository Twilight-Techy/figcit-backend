// The engine's own rules (M4, E-51), on small hand-built rule sets: input checks, the band and the
// light, run order, requirements against proposals, ranking, tools, the safety stop, the trace.
import { describe, expect, it } from 'vitest';
import { EFFECTS } from '../src/format/effects.js';
import { applyEffect, Material } from '../src/engine/apply.js';
import { RunState } from '../src/engine/state.js';
import { compile, run, type EngineInput, type EngineRow, type RunResult } from '../src/index.js';
import { withExtras as catalogue } from './fixtures.js';

let order = 0;
/** A rule row; `tab` decides run order within a stage. */
function row(engine: unknown, tab = 'patterns', mapping = 'exact'): EngineRow {
  order += 1;
  return {
    id: `r${String(order)}`,
    tab,
    sourceRef: String(order),
    order,
    status: 'active',
    mapping,
    engine,
  };
}
const propose = (slot: string, target: object, copy?: string) => ({
  kind: 'propose',
  slot,
  target,
  ...(copy ? { copy } : {}),
});
const ok = (r: RunResult) => {
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r;
};
const go = (rows: EngineRow[], input: EngineInput = {}, trace: 'light' | 'full' = 'light') =>
  ok(run(compile(rows, catalogue), input, { trace }));
const setBand = (to: string) =>
  row({ stage: 'state', rules: [{ when: null, then: [{ kind: 'band.set', to }] }] }, 'bands');

describe('input', () => {
  it('refuses anything that is not a standard value, saying where', () => {
    const result = run(compile([], catalogue), {
      'no.such': 1,
      light: 'red',
      families: ['grief_loss'],
      'state.energy': 5,
      'context.setting': 'moon',
      'family.intensity': { grief_loss: 11, nope: 2 },
      'sensitivity.flags': ['noise', 'noise'],
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.issues.map((i) => i.path).sort()).toEqual([
      '/context.setting',
      '/families',
      '/family.intensity/grief_loss',
      '/family.intensity/nope',
      '/light',
      '/no.such',
      '/sensitivity.flags',
      '/state.energy',
    ]);
  });
});

describe('the band and the light', () => {
  it('settles the band from the baseline, the drops, the drop limit and the floor', () => {
    const lower = (steps: number) =>
      row({
        stage: 'capacity_fit',
        rules: [{ when: null, then: [{ kind: 'band.lower', steps }] }],
      });
    const limit = row({
      stage: 'capacity_fit',
      rules: [{ when: null, then: [{ kind: 'band.limit_drop', steps: 2 }] }],
    });
    expect(go([setBand('available'), lower(3)]).card.band).toBe('very_constrained');
    expect(go([setBand('available'), lower(3), limit]).card.band).toBe('constrained');
    const cap = row({
      stage: 'state',
      rules: [{ when: null, then: [{ kind: 'band.cap', to: 'conditional' }] }],
    });
    expect(go([setBand('available'), lower(3), cap]).card.band).toBe('conditional');
  });

  it('rises at most the limit above the previous band on a re-check', () => {
    const rise = row({
      stage: 'capacity_fit',
      rules: [{ when: null, then: [{ kind: 'band.limit_rise', steps: 1 }] }],
    });
    const card = go([setBand('available'), rise], {
      'recheck.previous_band': 'very_constrained',
    }).card;
    expect(card.band).toBe('constrained');
  });

  it('reads the band after every rule of the stage that changes it, whatever the row order', () => {
    // The light rule's tab runs first, yet it sees the band after the drop (two waves).
    const light = row(
      {
        stage: 'capacity_fit',
        rules: [
          {
            when: { fact: 'band.final', op: 'eq', value: 'conditional' },
            then: [{ kind: 'light.set', light: 'yellow' }],
          },
          {
            when: { fact: 'band.final', op: 'eq', value: 'available' },
            then: [{ kind: 'light.set', light: 'green' }],
          },
        ],
      },
      'state_grid',
    );
    const lower = row(
      { stage: 'capacity_fit', rules: [{ when: null, then: [{ kind: 'band.lower', steps: 1 }] }] },
      'band_rules',
    );
    expect(go([light, setBand('available'), lower]).card.light).toBe('yellow');
  });

  it("shows an overlay light over the band's, unless it is never to be shown", () => {
    const base = row({
      stage: 'capacity_fit',
      rules: [{ when: null, then: [{ kind: 'light.set', light: 'yellow' }] }],
    });
    const blue = row({
      stage: 'capacity_fit',
      rules: [{ when: null, then: [{ kind: 'light.overlay', light: 'blue' }] }],
    });
    const never = row({
      stage: 'capacity_fit',
      rules: [{ when: null, then: [{ kind: 'light.never', light: 'blue' }] }],
    });
    expect(go([blue, base]).card.light).toBe('blue');
    expect(go([blue, base, never]).card.light).toBe('yellow');
  });
});

describe('the card', () => {
  it('lets a requirement beat any proposal', () => {
    const p = row({
      stage: 'orchestration',
      layer: 'safety',
      rules: [{ when: null, then: [propose('primary', { pathway: 'execute' })] }],
    });
    const f = row({
      stage: 'orchestration',
      rules: [
        { when: null, then: [{ kind: 'forbid', slot: 'primary', target: { pathway: 'execute' } }] },
      ],
    });
    const r = go([p, f], {}, 'full');
    expect(r.card.primary).toBeNull();
    expect(r.trace.proposals).toContainEqual(
      expect.objectContaining({ fate: 'blocked', by: 'r' + String(order) + '#0' }),
    );
  });

  it('settles a clash of requirements by layer; a row with no layer ranks last', () => {
    const must = row({
      stage: 'orchestration',
      layer: 'trigger',
      rules: [
        {
          when: null,
          then: [{ kind: 'require', slot: 'primary', target: { pathway: 'regulate' } }],
        },
      ],
    });
    const plainForbid = row({
      stage: 'orchestration',
      rules: [{ when: null, then: [{ kind: 'forbid', target: { pathway: 'regulate' } }] }],
    });
    expect(go([must, plainForbid]).card.primary?.pathway).toBe('regulate');
    const guardForbid = row({
      stage: 'orchestration',
      layer: 'guard',
      rules: [
        {
          when: null,
          then: [
            { kind: 'forbid', target: { pathway: 'regulate' } },
            propose('primary', { pathway: 'dump' }),
          ],
        },
      ],
    });
    const r = go([must, guardForbid]);
    expect(r.card.primary?.pathway).toBe('dump');
    expect(r.trace.notes.join()).toMatch(/forbids it from a higher layer/);
  });

  it('ranks by layer, then by how strongly the feeling is felt; a primary that lost becomes an alternative', () => {
    const feel = (family: string, pathway: string) =>
      row(
        {
          stage: 'intervention',
          layer: 'trigger',
          rules: [
            {
              when: { fact: 'families', op: 'contains', value: family },
              then: [propose('primary', { pathway })],
            },
          ],
        },
        'experience_triggers',
      );
    const rows = [feel('grief_loss', 'connect'), feel('anxious_fearful', 'regulate')];
    const card = go(rows, { 'family.intensity': { grief_loss: 4, anxious_fearful: 8 } }).card;
    expect(card.primary?.pathway).toBe('regulate');
    expect(card.alternatives.map((i) => i.pathway)).toEqual(['connect']);
    const offer = row({
      stage: 'orchestration',
      layer: 'offer',
      rules: [{ when: null, then: [propose('primary', { pathway: 'meditate' })] }],
    });
    expect(
      go([offer, ...rows], { 'family.intensity': { grief_loss: 4 } }).card.primary?.pathway,
    ).toBe('connect');
  });

  it('merges equal proposals and keeps the first wording in rank order', () => {
    const a = row({
      stage: 'intervention',
      layer: 'trigger',
      rules: [{ when: null, then: [propose('primary', { pathway: 'dump' })] }],
    });
    const b = row({
      stage: 'orchestration',
      layer: 'trigger',
      rules: [{ when: null, then: [propose('primary', { pathway: 'dump' }, 'card.x.cta')] }],
    });
    const card = go([a, b]).card;
    expect(card.primary?.from).toBe(`${a.id}#0`);
    expect(card.primary?.copy).toBe('card.x.cta');
  });

  it('resolves a pathway to its best allowed tool: preferred, not excluded, the tier the slot needs', () => {
    const want = row({
      stage: 'orchestration',
      layer: 'trigger',
      rules: [{ when: null, then: [propose('primary', { pathway: 'regulate' })] }],
    });
    expect(go([want]).card.primary?.tool).toBe('breathe');
    const prefer = row({
      stage: 'context',
      layer: 'trigger',
      rules: [{ when: null, then: [{ kind: 'tools.prefer', tools: ['create', 'move'] }] }],
    });
    expect(go([want, prefer]).card.primary?.tool).toBe('create');
    const exclude = row({
      stage: 'context',
      rules: [{ when: null, then: [{ kind: 'tools.exclude', tools: ['create'] }] }],
    });
    expect(go([want, prefer, exclude]).card.primary?.tool).toBe('move');
    const tiers = row({
      stage: 'entitlements',
      rules: [
        {
          when: null,
          then: [
            { kind: 'tools.tier', tier: 'advanced', tools: ['create'] },
            { kind: 'tools.tier', tier: 'floor', tools: ['breathe'] },
            { kind: 'tier.require', tier: 'floor', slot: 'primary' },
          ],
        },
      ],
    });
    expect(go([want, prefer, tiers]).card.primary?.tool).toBe('breathe');
  });

  it('allows at most the tier limit of Advanced tools, and marks them', () => {
    const offer = row({
      stage: 'orchestration',
      layer: 'trigger',
      rules: [
        {
          when: null,
          then: [
            propose('alternative', { tool: 'create' }),
            propose('alternative', { tool: 'sounds_plus' }),
          ],
        },
      ],
    });
    const limit = row({
      stage: 'entitlements',
      rules: [
        {
          when: null,
          then: [
            { kind: 'tools.tier', tier: 'advanced', tools: ['create', 'sounds_plus'] },
            { kind: 'tier.limit', tier: 'advanced', max: 1 },
          ],
        },
      ],
    });
    const card = go([offer, limit]).card;
    expect(card.alternatives.map((i) => [i.tool, i.advanced])).toEqual([['create', true]]);
  });

  it('keeps at most two alternatives (Tab 7 non-negotiables)', () => {
    const many = row({
      stage: 'orchestration',
      layer: 'trigger',
      rules: [
        {
          when: null,
          then: ['dump', 'connect', 'adapt', 'express'].map((p) =>
            propose('alternative', { pathway: p }),
          ),
        },
      ],
    });
    expect(go([many]).card.alternatives).toHaveLength(2);
  });
});

describe('a run', () => {
  const stop = row({
    stage: 'safety',
    layer: 'safety',
    rules: [
      {
        when: { fact: 'safety.risk', op: 'is', value: true },
        then: [{ kind: 'stop' }, { kind: 'support.show' }],
      },
    ],
  });
  const later = row({
    stage: 'orchestration',
    layer: 'trigger',
    rules: [{ when: null, then: [propose('primary', { pathway: 'execute' })] }],
  });

  it('pauses every later stage after the safety override and shows only the support screen', () => {
    const r = go([stop, later], { 'safety.risk': true });
    expect(r.card.kind).toBe('support_screen');
    expect(r.trace.fired).toEqual([`${stop.id}#0`]);
    expect(go([stop, later]).card.primary?.pathway).toBe('execute');
  });

  it('is pure: the same input gives the same card and trace, byte for byte', () => {
    const input = { 'family.intensity': { grief_loss: 5 }, 'state.energy': 2, 'state.mood': 3 };
    const a = JSON.stringify(go([stop, later], input, 'full'));
    expect(JSON.stringify(go([stop, later], input, 'full'))).toBe(a);
  });

  it('traces each stage: every rule checked, where its condition failed, and the facts', () => {
    const r = go([stop, later], { 'state.energy': 2, 'state.mood': 3 }, 'full');
    expect(r.trace.stages?.map((s) => s.stage)).toHaveLength(14);
    const safety = r.trace.stages?.[0];
    expect(safety?.checks).toEqual([
      { rule: `${stop.id}#0`, ref: `patterns · ${stop.sourceRef}`, matched: false, failedAt: '/' },
    ]);
    expect(safety?.facts['state.cell']).toBe('E2M3');
  });

  it('skips rows that are not exact or interpreted, and reports rows that fail the format', () => {
    const bad = row({ stage: 'orchestration', rules: [] });
    const exempt = row(null, 'patterns', 'unresolved');
    const compiled = compile([bad, exempt, later], catalogue);
    expect(compiled.exempt).toBe(1);
    expect(compiled.issues.map((i) => i.message)).toEqual(['expected 1-16 rules']);
    expect(compiled.rules.map((r) => r.rowId)).toEqual([later.id]);
  });
});

it('has a behaviour for every effect in the registry', () => {
  const state = new RunState({}, catalogue);
  const rule = compile([], catalogue).rules[0];
  const origin = {
    rule:
      rule ??
      ({
        id: 'x',
        rowId: 'x',
        ref: 'x',
        stage: 'safety',
        layer: null,
        wave: 0,
        when: null,
        then: [],
        seq: 0,
      } as const),
    salience: 0,
  };
  for (const spec of EFFECTS) {
    const params = Object.fromEntries(
      Object.keys(spec.params).map((k) => [
        k,
        k === 'steps' || k === 'max' || k === 'minutes'
          ? 1
          : k === 'target'
            ? { pathway: 'regulate' }
            : k.endsWith('s')
              ? ['x']
              : 'x',
      ]),
    );
    expect(() => {
      applyEffect({ kind: spec.kind, ...params }, origin, state, new Material());
    }, spec.kind).not.toThrow();
  }
});
