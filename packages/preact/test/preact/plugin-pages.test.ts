import { mkdirSync, rmSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vite-plus/test';
import { pagesPlugin } from '../../src/plugin-pages.ts';

const roots: Array<string> = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

async function devConfig() {
  const root = mkdtempSync(join(tmpdir(), 'void-preact-'));
  roots.push(root);
  mkdirSync(join(root, 'pages'));
  writeFileSync(join(root, 'pages/index.tsx'), 'export default () => null;');
  const plugin = pagesPlugin(join(root, 'pages'), { root });
  const hook = plugin.config as (config: object, env: object) => Promise<any>;
  return hook.call({}, {}, { command: 'serve', mode: 'development' });
}

it('optimizes the Preact entries in the client and the renderer only in the worker', async () => {
  const config = await devConfig();
  expect(config.optimizeDeps.include).toContain('preact/compat');
  expect(config.optimizeDeps.include).not.toContain('preact-render-to-string/stream');
  expect(config.environments.void_worker.optimizeDeps.include).toContain(
    'preact-render-to-string/stream',
  );
  expect(config.optimizeDeps.exclude).toContain('void-preact');
});
