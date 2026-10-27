import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

const ROOT_ENV = resolve(import.meta.dirname, '../../../../../.env');

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
  Object.assign(process.env, parseEnv(text));
}

/** Async variant for scripts. */
export async function loadDotEnvAsync(path = ROOT_ENV): Promise<void> {
  if (process.env['NODE_ENV'] === 'production') return;
  try {
    Object.assign(process.env, parseEnv(await readFile(path, 'utf8')));
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
}
