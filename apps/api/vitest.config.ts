import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC keeps decorator metadata, which NestJS dependency injection needs.
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      thresholds: { lines: 85, branches: 80 },
    },
  },
});
