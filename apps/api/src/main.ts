import { createApp } from './app.factory.js';
import { loadDotEnv } from './common/config/dotenv.js';
import { loadEnv } from './common/config/env.js';

async function bootstrap(): Promise<void> {
  loadDotEnv();
  const env = loadEnv();
  const app = await createApp(env);
  await app.listen(env.PORT, '0.0.0.0');
}

void bootstrap();
