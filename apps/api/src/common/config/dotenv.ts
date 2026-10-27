import { resolve } from 'node:path';

/** Loads the repo-root `.env` in development if it exists. Production sets real environment variables. */
export function loadDotEnv(path = resolve(import.meta.dirname, '../../../../../.env')): void {
  if (process.env['NODE_ENV'] === 'production') return;
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  }
}
