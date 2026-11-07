import { Logger } from '@nestjs/common';

/** Render's free plan sleeps after 15 idle minutes; a request through its public URL resets that. */
export const KEEP_ALIVE_MS = 14 * 60 * 1000;
const TIMEOUT_MS = 30_000;

/** Pings `url` on a timer until the process ends. A failed ping is logged and the next one still runs. */
export function startKeepAlive(url: string, ping: typeof fetch = fetch): NodeJS.Timeout {
  const logger = new Logger('KeepAlive');
  const timer = setInterval(() => {
    ping(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      .then((res) => {
        if (!res.ok) logger.warn(`Ping answered ${String(res.status)}`);
      })
      .catch((err: unknown) => {
        logger.warn(`Ping failed: ${String(err)}`);
      });
  }, KEEP_ALIVE_MS);
  // Never holds the process open at shutdown.
  timer.unref();
  return timer;
}
