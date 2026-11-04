#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const app = mkdtempSync(join(tmpdir(), 'void-preact-consumer-'));
const manifest = JSON.parse(readFileSync(join(ROOT, 'packages/preact/package.json'), 'utf8'));
const run = (command, args, cwd = app) => execFileSync(command, args, { cwd, stdio: 'inherit' });

run('pnpm', ['--filter', 'void-preact', 'pack', '--pack-destination', app], ROOT);
const tarball = `file:./void-preact-${manifest.version}.tgz`;

writeFileSync(
  join(app, 'package.json'),
  JSON.stringify({
    name: 'consumer',
    private: true,
    type: 'module',
    dependencies: {
      preact: manifest.peerDependencies.preact,
      'preact-render-to-string': manifest.peerDependencies['preact-render-to-string'],
    },
    devDependencies: {
      '@babel/core': manifest.devDependencies['@babel/core'],
      void: manifest.peerDependencies.void,
      vite: manifest.peerDependencies.vite,
      'void-preact': tarball,
    },
  }),
);
writeFileSync(join(app, 'pnpm-workspace.yaml'), "allowBuilds:\n  esbuild: true\n  workerd: true\n  better-sqlite3: false\n");
writeFileSync(
  join(app, 'vite.config.ts'),
  `import { voidPreact } from 'void-preact/plugin';
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';
export default defineConfig({ plugins: [voidPlugin(), voidPreact()] });
`,
);
mkdirSync(join(app, 'pages'));
writeFileSync(
  join(app, 'pages/index.tsx'),
  `import { Link } from 'void-preact';
export default function Home({ greeting }: { greeting: string }) {
  return <main class="home"><h1>{greeting}</h1><Link href="/">home</Link></main>;
}
`,
);
writeFileSync(
  join(app, 'pages/index.server.ts'),
  `import { defineHandler } from 'void';
export const loader = defineHandler(() => ({ greeting: 'hello from loader' }));
`,
);

run('pnpm', ['install']);
run('pnpm', ['exec', 'vite', 'build']);

const port = 4780;
const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(port), '--strictPort'], {
  cwd: app,
  stdio: 'inherit',
  detached: true,
});
try {
  let html = '';
  for (let attempt = 0; attempt < 60 && !html; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    html = await fetch(`http://localhost:${port}/`).then(
      (response) => (response.ok ? response.text() : ''),
      () => '',
    );
  }
  assert.match(html, /<main class="home"><h1>hello from loader<\/h1>/, 'loader data is server rendered');
  assert.match(html, /__VOID_PAGE_DATA__/, 'page data is embedded for hydration');
  console.log('packed consumer ok');
} finally {
  process.kill(-server.pid);
}
