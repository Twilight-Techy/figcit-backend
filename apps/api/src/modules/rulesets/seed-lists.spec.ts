// Lists the v5.0 workbook asks for on screen but doesn't publish come from the engine's seed.
import { describe, expect, it } from 'vitest';
import type { CheckInOptionsView } from '@figcit/engine-v2';
import { withSeedLists } from './checkin-options.service.js';

const empty = {
  inputs: { not_sure_body: [], not_sure_energy: [], not_sure_comfort: [], body_region: [] },
} as unknown as CheckInOptionsView;

describe('seeded check-in lists', () => {
  it("fills Not sure's taps, with the State Grid level, and the body map's regions", () => {
    const v = withSeedLists(empty);
    expect(v.inputs.not_sure_energy.map((o) => o.level)).toEqual([1, 2, 3, 4]);
    expect(v.inputs.not_sure_comfort[3]).toMatchObject({ code: 'good', level: 4 });
    expect(v.inputs.not_sure_body[0]).not.toHaveProperty('level');
    expect(v.inputs.body_region.map((o) => o.code)).toContain('shoulders');
  });

  it('keeps what a version publishes itself', () => {
    const own = [{ code: 'x', label: 'X', group: null }];
    const v = withSeedLists({
      inputs: { ...empty.inputs, body_region: own },
    } as unknown as CheckInOptionsView);
    expect(v.inputs.body_region).toEqual(own);
  });
});
