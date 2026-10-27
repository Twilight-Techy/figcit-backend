import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/db/prisma.service.js';
import {
  CONSENT_PURPOSES,
  NOTICE_VERSION,
  type ConsentPurposeCode,
  type ConsentState,
} from './consent.schemas.js';

/** Append-only consent ledger; the latest row per purpose wins. Optional consents default off (D-05). */
@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async state(userId: string): Promise<ConsentState> {
    // One indexed scan of the user's ledger (≤ a few rows per purpose).
    const rows = await this.prisma.consent.findMany({
      where: { userId },
      orderBy: { at: 'desc' },
      take: 200,
      select: { purpose: true, granted: true, at: true },
    });
    const latest = new Map<string, { granted: boolean; at: Date }>();
    for (const row of rows)
      if (!latest.has(row.purpose)) latest.set(row.purpose, { granted: row.granted, at: row.at });
    return {
      noticeVersion: NOTICE_VERSION,
      purposes: CONSENT_PURPOSES.map((purpose) => {
        const entry = latest.get(purpose);
        return { purpose, granted: entry?.granted ?? false, at: entry?.at.toISOString() ?? null };
      }),
    };
  }

  async record(
    userId: string,
    choices: readonly { purpose: ConsentPurposeCode; granted: boolean }[],
    source: string,
  ): Promise<ConsentState> {
    await this.prisma.consent.createMany({
      data: choices.map((c) => ({
        userId,
        purpose: c.purpose,
        granted: c.granted,
        noticeVersion: NOTICE_VERSION,
        source,
      })),
    });
    return this.state(userId);
  }

  async has(userId: string, purpose: ConsentPurposeCode): Promise<boolean> {
    const row = await this.prisma.consent.findFirst({
      where: { userId, purpose },
      orderBy: { at: 'desc' },
      select: { granted: true },
    });
    return row?.granted ?? false;
  }
}
