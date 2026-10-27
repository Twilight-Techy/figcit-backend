import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService, type Tx } from '../../common/db/prisma.service.js';

export const SUMMARY_SELECT = {
  id: true,
  createdAt: true,
  cellId: true,
  energy: true,
  mood: true,
  entry: true,
  emotions: { select: { emotionCode: true, intensity: true } },
  recommendations: { orderBy: { createdAt: 'desc' }, take: 1, select: { light: true } },
} satisfies Prisma.CheckInSelect;
export type CheckInSummaryRow = Prisma.CheckInGetPayload<{ select: typeof SUMMARY_SELECT }>;

@Injectable()
export class CheckInRepository {
  constructor(private readonly prisma: PrismaService) {}

  findOwned(
    userId: string,
    id: string,
  ): Promise<{ id: string; cellId: string | null; createdAt: Date } | null> {
    return this.prisma.checkIn.findFirst({
      where: { id, userId, deletedAt: null },
      select: { id: true, cellId: true, createdAt: true },
    });
  }

  create(tx: Tx, data: Prisma.CheckInUncheckedCreateInput): Promise<{ id: string }> {
    return tx.checkIn.create({ data, select: { id: true } });
  }

  summary(userId: string, id: string): Promise<CheckInSummaryRow | null> {
    return this.prisma.checkIn.findFirst({ where: { id, userId }, select: SUMMARY_SELECT });
  }

  /** Cursor pagination by (created_at, id), newest first (rules §5.1). */
  page(
    userId: string,
    after: { createdAt: Date; id: string } | null,
    take: number,
  ): Promise<CheckInSummaryRow[]> {
    return this.prisma.checkIn.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.createdAt } },
                { createdAt: after.createdAt, id: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: SUMMARY_SELECT,
    });
  }
}
