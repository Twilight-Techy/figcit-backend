// Pattern 34's recurring-struggle signal (Tab 7): the same hard feeling leading a strained
// check-in (Amber or Red) 3+ times in 14 days. The user confirms it before the engine uses it.
import type { Snapshot } from '@figcit/engine';
import type { PrismaService } from '../../common/db/prisma.service.js';

const WINDOW_MS = 14 * 86_400_000;
export const STRUGGLE_MIN = 3;

export interface Struggle {
  readonly family: string;
  readonly label: string;
  readonly count: number;
}

/** The most frequent negative family leading Amber/Red check-ins in the last 14 days, if 3+. */
export async function recurringStruggle(
  prisma: PrismaService,
  snapshot: Snapshot,
  userId: string,
  now = new Date(),
): Promise<Struggle | null> {
  const negative = new Map(
    snapshot.families.filter((f) => f.valence === 'negative').map((f) => [f.code, f.label]),
  );
  const strained = await prisma.checkIn.findMany({
    where: {
      userId,
      deletedAt: null,
      createdAt: { gt: new Date(now.getTime() - WINDOW_MS) },
      recommendations: { some: { light: { in: ['amber', 'red'] } } },
    },
    select: { emotions: { select: { familyCode: true, intensity: true } } },
    take: 60,
  });
  const counts = new Map<string, number>();
  for (const c of strained) {
    const lead = c.emotions
      .filter((e) => negative.has(e.familyCode))
      // An unrated harder feeling counts as High (DECISION_LOG E-42).
      .sort((a, b) => (b.intensity ?? 7) - (a.intensity ?? 7))[0];
    if (lead) counts.set(lead.familyCode, (counts.get(lead.familyCode) ?? 0) + 1);
  }
  const [family, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
  return count >= STRUGGLE_MIN ? { family, label: negative.get(family) ?? family, count } : null;
}

/**
 * The user's answer for this family: "never" is kept for good; "confirmed" and "not now" last for
 * the 14-day window, so a struggle that keeps going is asked about again later.
 */
export async function struggleAnswer(
  prisma: PrismaService,
  userId: string,
  family: string,
  now = new Date(),
): Promise<'confirmed' | 'not_now' | 'never' | null> {
  const rows = await prisma.struggleConfirmation.findMany({
    where: {
      userId,
      family,
      OR: [{ answer: 'never' }, { at: { gt: new Date(now.getTime() - WINDOW_MS) } }],
    },
    orderBy: { at: 'desc' },
    take: 5,
    select: { answer: true },
  });
  if (rows.some((r) => r.answer === 'never')) return 'never';
  return rows[0]?.answer ?? null;
}
