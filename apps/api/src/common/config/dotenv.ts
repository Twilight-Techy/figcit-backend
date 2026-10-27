import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const ROOT_ENV = resolve(import.meta.dirname, '../../../../../.env');

/** Harmless settings a shell may still override for one run (e.g. a second server on another port). */
const SHELL_WINS = new Set(['PORT', 'LOG_LEVEL', 'NODE_ENV', 'RATE_LIMIT_ENABLED', 'DEV_MAILBOX']);

function apply(values: NodeJS.Dict<string>): void {
  for (const [key, value] of Object.entries(values)) {
    if (SHELL_WINS.has(key) && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

/**
 * Loads the repo-root `.env` outside production. Its values win over inherited variables, so a
 * stray `DATABASE_URL` in a developer's shell can never point local work at a shared database.
 * Production sets real environment variables and skips this.
 */
export function loadDotEnv(path = ROOT_ENV): void {
  if (process.env['NODE_ENV'] === 'production') return;
  let text: string;
  try {
    // Startup only, before the server listens (rules 6 allow sync I/O here).
    text = readFileSync(path, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error;
  }
  apply(parseEnv(text));
}

/** Async variant for scripts. */
export async function loadDotEnvAsync(path = ROOT_ENV): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') return;
  try {
    apply(parseEnv(await readFile(path, 'utf8')));
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
}
