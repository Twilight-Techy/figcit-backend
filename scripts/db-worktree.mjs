// `pnpm db:worktree`: gives this git worktree its own database (figcit_<branch>) in the shared
// Postgres, writes it to this worktree's .env with a free port, then migrates and seeds it.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { freePort } from './free-port.mjs';

const root = resolve(import.meta.dirname, '..');
execFileSync('node', [resolve(root, 'scripts/dev-env.mjs')], { stdio: 'inherit' });
const envPath = resolve(root, '.env');
let text = readFileSync(envPath, 'utf8');

const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root })
  .toString()
  .trim();
const name = `figcit_${branch.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`.slice(0, 63);
const base = new URL(
  /^DATABASE_URL=(.+)$/m.exec(text)?.[1] ?? 'postgresql://figcit:figcit@localhost:5432/figcit',
);
const admin = new URL(base);
admin.pathname = '/postgres';
try {
  execFileSync('psql', [admin.toString(), '-tAc', `CREATE DATABASE "${name}"`], { stdio: 'pipe' });
  process.stdout.write(`Created database ${name}.\n`);
} catch (e) {
  if (!String(e.stderr ?? '').includes('already exists')) throw e;
  process.stdout.write(`Database ${name} already exists.\n`);
}
const url = new URL(base);
url.pathname = `/${name}`;
const port = await freePort();
const set = (key, value) => {
  const line = new RegExp(`^${key}=.*$`, 'm');
  text = line.test(text)
    ? text.replace(line, `${key}=${value}`)
    : `${text.trimEnd()}\n${key}=${value}\n`;
};
set('DATABASE_URL', url.toString());
set('PORT', String(port));
set('API_URL', `http://localhost:${String(port)}`);
writeFileSync(envPath, text);
process.stdout.write(`.env: DATABASE_URL → ${name}, PORT → ${String(port)}\n`);

const api = resolve(root, 'apps/api');
const env = { ...process.env, DATABASE_URL: url.toString() };
execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], { cwd: api, env, stdio: 'inherit' });
execFileSync('pnpm', ['exec', 'prisma', 'db', 'seed'], { cwd: api, env, stdio: 'inherit' });
