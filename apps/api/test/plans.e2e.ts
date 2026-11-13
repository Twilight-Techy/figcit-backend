// The plans in the business plan (Developer Brief, Plans and pricing; ENT-10).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApi, type Api } from './helpers.js';

let api: Api;
beforeAll(async () => {
  api = await bootApi();
});
afterAll(() => api.close());

describe('plans', () => {
  it('lists Free, Prime and Premium before VAT, with the total, and annual as 10 months', async () => {
    type PlanRow = {
      code: string;
      tier: string;
      priceMinor: number | null;
      vatMinor: number | null;
      totalMinor: number | null;
      buyable: boolean;
      lengthDays: number | null;
    };
    const plans = await api.req<{ vatPercent: number; items: PlanRow[] }>('GET', '/plans');
    expect(plans.body.vatPercent).toBe(20);
    const byCode = new Map(plans.body.items.map((p) => [p.code, p]));
    expect(byCode.get('prime_monthly')).toMatchObject({
      tier: 'prime',
      priceMinor: 700,
      vatMinor: 140,
      totalMinor: 840,
      buyable: true,
    });
    expect(byCode.get('prime_yearly')?.priceMinor).toBe(7000);
    expect(byCode.get('premium_monthly')?.priceMinor).toBe(1300);
    expect(byCode.get('premium_yearly')?.priceMinor).toBe(13000);
    expect(byCode.get('org_seat')).toMatchObject({
      tier: 'premium',
      priceMinor: 1000,
      buyable: false,
    });
    expect(byCode.get('pilot')).toMatchObject({ tier: 'premium', lengthDays: 42, buyable: false });
    expect(byCode.has('plus_monthly')).toBe(false);
  });
});
