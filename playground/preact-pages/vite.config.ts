import { voidPreact } from 'void-preact/plugin';
import { defineConfig } from 'vite-plus';
import { voidPlugin } from 'void';

export default defineConfig({
  plugins: [voidPlugin(), voidPreact()],
  optimizeDeps: { include: ['valibot'] },
});
