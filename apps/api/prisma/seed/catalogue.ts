import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';

// The business plan's plans (Developer Brief, Plans and pricing): pence before VAT, held as
// configuration (ENT-10). Annual is 12 months for the price of 10. The migration
// 20261113115947_plans_prime_premium writes the same rows; FigCit Plus is retired (kept as Prime).
const PRIME = ['full_history', 'more_choices', 'sorting', 'unlimited_rewrite'];
const PREMIUM = ['full_history', 'reports', 'patterns', 'full_toolkit'];
interface PlanRow {
  readonly code: string;
  readonly name: string;
  readonly tier: 'free' | 'prime' | 'premium';
  readonly priceMinor: number | null;
  readonly interval: 'month' | 'year' | null;
  readonly position: number;
  readonly features: readonly string[];
  readonly active?: boolean;
  readonly buyable?: boolean;
  readonly lengthDays?: number | null;
}
const plan = (p: PlanRow) => ({
  ...p,
  active: p.active ?? true,
  buyable: p.buyable ?? false,
  lengthDays: p.lengthDays ?? null,
});

export const PLANS = [
  plan({
    code: 'free',
    name: 'Free',
    tier: 'free',
    priceMinor: null,
    interval: null,
    position: 0,
    features: ['all_free_tools', 'engine', 'help', 'support_plan', 'progress_30_days'],
  }),
  plan({
    code: 'prime_monthly',
    name: 'Prime',
    tier: 'prime',
    priceMinor: 700,
    interval: 'month',
    position: 1,
    features: PRIME,
    buyable: true,
  }),
  plan({
    code: 'prime_yearly',
    name: 'Prime',
    tier: 'prime',
    priceMinor: 7000,
    interval: 'year',
    position: 2,
    features: PRIME,
    buyable: true,
  }),
  plan({
    code: 'premium_monthly',
    name: 'Premium',
    tier: 'premium',
    priceMinor: 1300,
    interval: 'month',
    position: 3,
    features: PREMIUM,
    buyable: true,
  }),
  plan({
    code: 'premium_yearly',
    name: 'Premium',
    tier: 'premium',
    priceMinor: 13000,
    interval: 'year',
    position: 4,
    features: PREMIUM,
    buyable: true,
  }),
  plan({
    code: 'org_seat',
    name: 'Organisation seat',
    tier: 'premium',
    priceMinor: 1000,
    interval: 'month',
    position: 5,
    features: PREMIUM,
  }),
  plan({
    code: 'institution',
    name: 'Organisation seat',
    tier: 'premium',
    priceMinor: null,
    interval: null,
    position: 6,
    features: PREMIUM,
  }),
  plan({
    code: 'pilot',
    name: 'Launch pilot',
    tier: 'premium',
    priceMinor: null,
    interval: null,
    position: 7,
    features: PREMIUM,
    lengthDays: 42,
  }),
  // Retired: existing subscriptions keep working, as Prime.
  plan({
    code: 'plus_monthly',
    name: 'FigCit Plus (monthly)',
    tier: 'prime',
    priceMinor: 699,
    interval: 'month',
    position: 8,
    features: PRIME,
    active: false,
  }),
  plan({
    code: 'plus_yearly',
    name: 'FigCit Plus (yearly)',
    tier: 'prime',
    priceMinor: 5999,
    interval: 'year',
    position: 9,
    features: PRIME,
    active: false,
  }),
  plan({
    code: 'plus_concession',
    name: 'FigCit Plus concession',
    tier: 'prime',
    priceMinor: 349,
    interval: 'month',
    position: 10,
    features: PRIME,
    active: false,
  }),
] as const;

interface ToolRow {
  readonly id: string;
  readonly pathway:
    'regulate' | 'dump' | 'express' | 'execute' | 'adapt' | 'reflect' | 'connect' | 'meditate';
  readonly name: string;
  readonly tier: 'free' | 'advanced';
  readonly safetyFloor: boolean;
  readonly discreet: boolean;
  readonly eyesOpen: boolean;
  readonly minutes: number;
}

export async function seedCatalogue(prisma: PrismaClient): Promise<void> {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: { ...plan, features: [...plan.features] },
      create: { ...plan, features: [...plan.features] },
    });
  }
  const snapshot = JSON.parse(
    await readFile(
      resolve(import.meta.dirname, '../../../../packages/engine/fixtures/snapshot.json'),
      'utf8',
    ),
  ) as { tools: ToolRow[] };
  for (const t of snapshot.tools) {
    const data = {
      pathway: t.pathway,
      name: t.name,
      tier: t.tier,
      safetyFloor: t.safetyFloor,
      publicSafe: t.discreet,
      eyesOpen: t.eyesOpen,
      minutes: t.minutes,
      active: true,
    };
    await prisma.tool.upsert({
      where: { toolId: t.id },
      update: data,
      create: { toolId: t.id, ...data },
    });
  }
}
