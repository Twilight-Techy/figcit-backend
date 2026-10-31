// `pnpm dev`: the API on PORT from .env if it's free, otherwise the first free port from 4000 up,
// so several worktrees can run side by side.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { freePort } from './free-port.mjs';

const envPath = resolve(import.meta.dirname, '../.env');
const fromEnv = existsSync(envPath)
  ? /^PORT=(\d+)\s*$/m.exec(readFileSync(envPath, 'utf8'))?.[1]
  : undefined;
const wanted = Number(process.env.PORT ?? fromEnv ?? 0) || undefined;
const port = await freePort(wanted);
if (wanted && port !== wanted)
  process.stdout.write(`Port ${String(wanted)} is busy; using ${String(port)}.\n`);
process.stdout.write(`API: http://localhost:${String(port)}/v1/health\n`);
const child = spawn('pnpm', ['--filter', '@figcit/api', 'dev'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: String(port) },
});
child.on('exit', (code) => process.exit(code ?? 0));
