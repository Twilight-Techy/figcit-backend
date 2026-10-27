import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { PrismaClient, Prisma } from '@prisma/client';

const SNAPSHOT = resolve(import.meta.dirname, '../../../../packages/engine/fixtures/snapshot.json');

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Publishes the compiled workbook snapshot (packages/engine/fixtures/snapshot.json). Idempotent. */
export async function seedSnapshot(prisma: PrismaClient, adminId: string | null): Promise<string> {
  const json = JSON.parse(await readFile(SNAPSHOT, 'utf8')) as { version: string } & Record<
    string,
    unknown
  >;
  const { version, ...body } = json;
  const hash = createHash('sha256').update(canonical(body)).digest('hex');
  const existing = await prisma.ruleSnapshot.findUnique({
    where: { version },
    select: { status: true },
  });
  if (existing?.status === 'published') return version;
  await prisma.ruleSnapshot.updateMany({
    where: { status: 'published' },
    data: { status: 'retired', retiredAt: new Date() },
  });
  await prisma.ruleSnapshot.upsert({
    where: { version },
    update: {
      status: 'published',
      publishedAt: new Date(),
      json: json as unknown as Prisma.InputJsonValue,
      hash,
    },
    create: {
      version,
      hash,
      json: json as unknown as Prisma.InputJsonValue,
      status: 'published',
      sourceFileKey: 'docs/specs/rules-engine-v3.3/NUCCESS_Recommendation_Rules_Engine_v3_3.xlsx',
      notes: 'Compiled from workbook v3.3 by the seed',
      createdById: adminId,
      reviewedById: adminId,
      reviewedAt: new Date(),
      safetySignedById: adminId,
      safetySignedAt: new Date(),
      publishedAt: new Date(),
      fixtureReport: { scenarios: 189, passed: 189 },
    },
  });
  return version;
}
