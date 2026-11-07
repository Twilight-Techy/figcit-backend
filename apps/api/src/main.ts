import { createApp } from './app.factory.js';
import { loadDotEnv } from './common/config/dotenv.js';
import { loadEnv } from './common/config/env.js';
import { startKeepAlive } from './common/http/keep-alive.js';
import { WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  loadDotEnv();
  const env = loadEnv();
  // On demand, jobs run in this process: a job sent here is picked up with no polling (ADR 0010).
  const app = await createApp(env, env.JOBS_ON_DEMAND ? { module: WorkerModule } : {});
  await app.listen(env.PORT, '0.0.0.0');
  if (env.KEEP_ALIVE_URL) startKeepAlive(env.KEEP_ALIVE_URL);
}

void bootstrap();
