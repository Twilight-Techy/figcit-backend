import { loadDotEnv } from './src/common/config/dotenv.js';
import { defineConfig } from 'prisma/config';

loadDotEnv();

export default defineConfig({
  schema: 'prisma/schema',
  migrations: { path: 'prisma/migrations', seed: 'node --import @swc-node/register/esm-register prisma/seed/index.ts' },
});
