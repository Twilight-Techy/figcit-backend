import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// End-to-end: the real app against a real Postgres (its own figcit_test database).
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    include: ['test/**/*.e2e.ts'],
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
