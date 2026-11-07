import { createApp } from './app.factory.js';
import { loadDotEnv } from './common/config/dotenv.js';
import { loadEnv } from './common/config/env.js';
import { startKeepAlive } from './common/http/keep-alive.js';

async function bootstrap(): Promise<void> {
  loadDotEnv();
  const env = loadEnv();
  const app = await createApp(env);
  await app.listen(env.PORT, '0.0.0.0');
  if (env.KEEP_ALIVE_URL) startKeepAlive(env.KEEP_ALIVE_URL);
}

void bootstrap();
