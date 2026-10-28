// Prepares the e2e database: creates figcit_test if needed, applies migrations and seeds it.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { loadDotEnvAsync } from '../src/common/config/dotenv.js';

const API = resolve(import.meta.dirname, '..');

export async function setup(): Promise<void> {
  process.env['NODE_ENV'] = 'test';
  await loadDotEnvAsync();
  const base = new URL(
    process.env['DATABASE_URL'] ?? 'postgresql://figcit:figcit@localhost:5432/figcit',
  );
  const name = process.env['FIGCIT_TEST_DB'] ?? 'figcit_test';
  const test = new URL(base);
  test.pathname = `/${name}`;
  process.env['FIGCIT_TEST_DATABASE_URL'] = test.toString();
  process.env['DATABASE_URL'] = test.toString();
  const admin = new URL(base);
  admin.pathname = '/postgres';
  try {
    execFileSync('psql', [admin.toString(), '-tAc', `CREATE DATABASE ${name}`], {
      stdio: 'ignore',
    });
  } catch {
    // already exists
  }
  const env = { ...process.env };
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { cwd: API, env, stdio: 'ignore' });
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'seed'], {
    cwd: API,
    env: { ...env, SEED_PERSONAS: 'false' },
    stdio: 'ignore',
  });
  // Content published by earlier runs would leak into other tests' expectations.
  execFileSync(
    'psql',
    [
      test.toString(),
      '-qc',
      "DELETE FROM content_items; DELETE FROM content_releases; DELETE FROM rule_snapshots WHERE status <> 'published';",
    ],
    { stdio: 'ignore' },
  );
}
