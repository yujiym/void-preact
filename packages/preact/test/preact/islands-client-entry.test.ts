import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vite-plus/test';
import { islandsPlugin } from '../../src/plugin-islands.ts';

it('generates an island bootstrap that exposes only the hydration function', async () => {
  const root = mkdtempSync(join(tmpdir(), 'void-preact-island-entry-'));
  const pages = join(root, 'pages');
  try {
    mkdirSync(pages);
    writeFileSync(join(pages, 'index.island.tsx'), 'import Counter from "./Counter" with { island: "load" }; export default () => <Counter />;');
    writeFileSync(join(pages, 'Counter.tsx'), 'export default () => <button>0</button>;');
    const plugin = islandsPlugin(pages)[0];
    if (typeof plugin.buildStart !== 'function' || typeof plugin.load !== 'object' || !plugin.load) {
      throw new Error('Expected island generation hooks');
    }
    await Reflect.apply(plugin.buildStart, {}, []);
    const entry = await Reflect.apply(plugin.load.handler, {}, ['\0virtual:void-islands-client']);
    expect(entry).toContain('void-preact/islands-client');
    expect(entry).toContain('hydratePreactIsland(el, mod, props, frontmatter)');
    expect(entry).not.toContain('SettledSuspense');
    expect(entry).not.toContain('settled-suspense');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
