import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Snapshot } from '@figcit/engine';
import { describe, expect, it } from 'vitest';
import { diffSnapshots } from './snapshots.service.js';

const base = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname, '../../../../../packages/engine/fixtures/snapshot.json'),
    'utf8',
  ),
) as Snapshot;

const retier = (id: string): Snapshot => ({
  ...base,
  tools: base.tools.map((t) =>
    t.id === id ? { ...t, tier: t.tier === 'free' ? 'advanced' : 'free' } : t,
  ),
});

describe('ENT-9: tier changes that need the safety reviewer', () => {
  it('flags a Regulate, Connect or communication-card tier move', () => {
    for (const id of ['breathe', 'quick_message', 'comm_cards'])
      expect(diffSnapshots(base, retier(id)).touchesSafety).toBe(true);
  });
  it('does not flag an Execute tool that is not on the safety floor', () => {
    const tool = base.tools.find((t) => t.pathway === 'execute' && !t.safetyFloor);
    expect(tool).toBeDefined();
    const diff = diffSnapshots(base, retier(tool?.id ?? ''));
    expect(diff.changed).toEqual(['tools']);
    expect(diff.touchesSafety).toBe(false);
  });
});
