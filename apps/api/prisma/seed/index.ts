// Seed data for local and external test databases (`pnpm db:seed`). Idempotent: safe to re-run.
import { PrismaClient } from '@prisma/client';
import { loadDotEnvAsync } from '../../src/common/config/dotenv.js';
import { seedCatalogue } from './catalogue.js';
import { seedRuleset } from './ruleset.js';
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
// The engine v2 rule set, with the check-in options the app reads (DECISION_LOG E-40).
console.log(`rule set ${await seedRuleset()} published`);
// Demo personas (every design state). Skip with SEED_PERSONAS=false, e.g. for the e2e database.
if (process.env['SEED_PERSONAS'] !== 'false') await import('./run-personas.js');
