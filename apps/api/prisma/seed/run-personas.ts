// `pnpm db:seed:personas`: demo accounts for every design state. Safe on a shared database: it only
// touches accounts on @nuccess.test (wiped and re-created each run).
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { loadDotEnvAsync } from '../../src/common/config/dotenv.js';
import { DOMAIN, seedPersonas } from './personas/personas.js';
import { seedInstitution } from './personas/institution.js';
import { DEMO_PASSWORD, Seeder, STAFF_TOTP_SECRET } from './personas/seeder.js';

await loadDotEnvAsync();
const { AppModule } = await import('../../src/app.module.js');
const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
await app.init();
try {
  const s = new Seeder(app);
  const removed = await s.wipe(DOMAIN);
  if (removed) console.log(`removed ${String(removed)} earlier demo accounts`);
  const started = Date.now();
  const ids = await seedPersonas(s);
  const inst = await seedInstitution(s, DOMAIN);
  // Let background listeners (re-check links, dump suggestions) finish before closing.
  await new Promise((r) => setTimeout(r, 1500));
  const total = await s.prisma.user.count({ where: { email: { endsWith: `@${DOMAIN}` } } });
  console.log(
    `seeded ${String(total)} demo accounts (${Object.keys(ids).join(', ')}, and an institution) in ${String(Math.round((Date.now() - started) / 1000))}s`,
  );
  console.log(`password for every demo account: ${DEMO_PASSWORD} (or a magic link)`);
  console.log(`staff authenticator secret: ${STAFF_TOTP_SECRET}`);
  console.log(`institution invite code: ${inst.code}`);
} finally {
  await app.close();
}
