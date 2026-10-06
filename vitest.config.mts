import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    env: {
      ADMIN_PASSWORD: 'unit-test-workspace-only',
      DEMO_MODE: 'false',
      STORAGE_MODE: 'demo',
      WEB_ORIGIN: 'http://localhost:3100',
    },
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    testTimeout: 15000,
    hookTimeout: 45000,
    fileParallelism: false,
  },
});
