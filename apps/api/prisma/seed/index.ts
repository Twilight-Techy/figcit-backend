// Seed data for local and external test databases (`pnpm db:seed`). Idempotent: safe to re-run.
import { PrismaClient } from '@prisma/client';
import { loadDotEnvAsync } from '../../src/common/config/dotenv.js';
import { seedCatalogue } from './catalogue.js';
import { seedSnapshot } from './snapshot.js';

await loadDotEnvAsync();
const prisma = new PrismaClient();
try {
  await seedCatalogue(prisma);
  const version = await seedSnapshot(prisma, null);
  console.log(`snapshot ${version} published`);
} finally {
  await prisma.$disconnect();
}
