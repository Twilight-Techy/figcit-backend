// Finds a free TCP port: the preferred one if it's free, otherwise the first free one from 4000 up.
import { createServer } from 'node:net';

const isFree = (port) =>
  new Promise((resolve) => {
    const server = createServer()
      .once('error', () => resolve(false))
      .once('listening', () => server.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });

export async function freePort(preferred) {
  if (preferred && (await isFree(preferred))) return preferred;
  for (let port = 4000; port < 4100; port += 1) if (await isFree(port)) return port;
  throw new Error('No free port between 4000 and 4099');
}
