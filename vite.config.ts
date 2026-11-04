import { defineConfig } from 'vite-plus';

const testTimeout = 120_000;

export default defineConfig({
  test: {
    projects: [
      {
        oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
        test: {
          name: 'unit',
          include: [
            'packages/preact/test/unit/**/*.test.ts',
            'packages/preact/test/preact/**/*.test.ts',
          ],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['packages/preact/test/integration/**/*.test.ts'],
          testTimeout,
          hookTimeout: testTimeout,
          fileParallelism: false,
        },
      },
    ],
  },
});
