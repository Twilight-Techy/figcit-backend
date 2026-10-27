import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';

// Prices are PLACEHOLDERS until the financial plan sets them (D-13, ENT-8); held as configuration.
export const PLANS = [
  {
    code: 'free',
    name: 'Free',
    priceMinor: null,
    interval: null,
    position: 0,
    features: ['all_free_tools', 'engine', 'help', 'support_plan', 'progress_30_days'],
  },
  {
    code: 'plus_monthly',
    name: 'NUCCESS Plus (monthly)',
    priceMinor: 699,
    interval: 'month',
    position: 1,
    features: ['advanced_tools', 'full_progress', 'reports'],
  },
  {
    code: 'plus_yearly',
    name: 'NUCCESS Plus (yearly)',
    priceMinor: 5999,
    interval: 'year',
    position: 2,
    features: ['advanced_tools', 'full_progress', 'reports'],
  },
  {
    code: 'plus_concession',
    name: 'NUCCESS Plus concession (monthly)',
    priceMinor: 349,
    interval: 'month',
    position: 3,
    features: ['advanced_tools', 'full_progress', 'reports'],
  },
  {
    code: 'institution',
    name: 'Institution licence',
    priceMinor: null,
    interval: null,
    position: 4,
    features: ['advanced_tools', 'full_progress', 'reports', 'caam_dashboard'],
  },
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
