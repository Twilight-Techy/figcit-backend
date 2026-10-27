import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service.js';

export type PlanTier = 'free' | 'plus';

/** Answers "what does this user's plan include?" (Tab 6d, ENT-6/ENT-7). */
@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async tierFor(userId: string, now = new Date()): Promise<PlanTier> {
    const active = await this.prisma.entitlement.findFirst({
      where: {
        userId,
        status: { in: ['active', 'grace'] },
        planCode: { not: 'free' },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      select: { id: true },
    });
    return active ? 'plus' : 'free';
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
