import type { PrismaService } from '../../common/db/prisma.service.js';

const WEEK_MS = 7 * 86_400_000;

/**
 * RF-2 "with no improvement": the topics, of those given, where a reflection in the last 7 days
 * improved things (its session's feedback said it helped, or its re-check turned Blue, RC-1).
 */
export async function improvedTopics(
  prisma: PrismaService,
  userId: string,
  topics: readonly string[],
  now = new Date(),
): Promise<Set<string>> {
  if (topics.length === 0) return new Set();
  const rows = await prisma.reflection.findMany({
    where: {
      userId,
      deletedAt: null,
      topicTag: { in: [...topics] },
      createdAt: { gt: new Date(now.getTime() - WEEK_MS) },
      session: { feedback: { OR: [{ outcome: 'helped' }, { recheckRule: 'RC-1' }] } },
    },
    select: { topicTag: true },
    distinct: ['topicTag'],
  });
  return new Set(rows.map((r) => r.topicTag ?? ''));
}
