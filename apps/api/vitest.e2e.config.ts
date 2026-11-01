import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// End-to-end: the real app against a real Postgres (its own figcit_test database).
export default defineConfig({
  plugins: [swc.vite()],
  // Workspace packages from source, like the dev server (`--conditions=development`).
  resolve: { conditions: ['development'] },
  ssr: { resolve: { conditions: ['development'] } },
  test: {
    include: ['test/**/*.e2e.ts'],
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    // Module coverage comes from the e2e suite. A ratchet at today's level: raise it as tests are
    // added; the target is 85% lines / 80% branches (ENGINEERING_RULES §13).
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // OpenAPI generation and the AI and speech evals are tooling: unit tests, `openapi:check` and the nightly
      // eval run cover them, not the API.
      exclude: [
        'src/openapi.ts',
        'src/common/openapi/**',
        'src/modules/ai/evals/**',
        'src/modules/speech/evals/**',
      ],
      thresholds: { lines: 78, statements: 75, functions: 76, branches: 65 },
    },
  },
});
