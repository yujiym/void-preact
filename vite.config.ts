import { defineConfig } from 'vite-plus';

const timeoutScale = process.platform === 'win32' ? 3 : 1;
const testTimeout = 120_000 * timeoutScale;

export default defineConfig({
  test: {
    projects: [
      {
        oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
        test: {
          name: 'unit',
          ...(process.platform === 'win32' ? { testTimeout: 20_000 } : {}),
          include: [
            'packages/preact/test/unit/**/*.test.ts',
            'packages/preact/test/preact/**/*.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'integration',
          // Polling includes server actions and page refreshes, beyond the default 1s limit.
          expect: { poll: { timeout: 10_000 * timeoutScale } },
          ...(process.platform === 'win32' ? { maxConcurrency: 2 } : {}),
          include: ['packages/preact/test/integration/**/*.test.ts'],
          testTimeout,
          hookTimeout: testTimeout,
          fileParallelism: false,
        },
      },
    ],
  },
});
