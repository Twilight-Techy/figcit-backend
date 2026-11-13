import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service.js';

/** What a plan unlocks (business plan): Free, Prime, or Premium (which organisation seats give). */
export const PLAN_TIERS = ['free', 'prime', 'premium'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

const RANK: Readonly<Record<PlanTier, number>> = { free: 0, prime: 1, premium: 2 };
const asTier = (t: string): PlanTier => (t === 'prime' || t === 'premium' ? t : 'free');

/** Answers "what does this user's plan include?" (Tab 6d, ENT-6/ENT-7). */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async tierFor(userId: string, now = new Date()): Promise<PlanTier> {
    const active = await this.prisma.entitlement.findMany({
      where: {
        userId,
        status: { in: ['active', 'grace'] },
        planCode: { not: 'free' },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { plan: { select: { tier: true } } },
      take: 10,
    });
    // The best of what they have: a Prime subscription and an organisation seat give Premium.
    return active
      .map((e) => asTier(e.plan.tier))
      .reduce<PlanTier>((best, t) => (RANK[t] > RANK[best] ? t : best), 'free');
  }

  /** At least Prime: every gate that Plus used to open. */
  async paid(userId: string, now = new Date()): Promise<boolean> {
    return (await this.tierFor(userId, now)) !== 'free';
  }

  async list(userId: string): Promise<
    readonly {
      planCode: string;
      source: string;
      status: string;
      renewsAt: Date | null;
      endsAt: Date | null;
      graceUntil: Date | null;
    }[]
  > {
    return this.prisma.entitlement.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        planCode: true,
        source: true,
        status: true,
        renewsAt: true,
        endsAt: true,
        graceUntil: true,
      },
    });
  }
}
