import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { expect, it } from 'vite-plus/test';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');

it('checks and removes stale generated files while preserving hand tests and ignored artifacts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'void-port-'));
  const write = (path: string, content = 'fixture\n') => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  const git = (...args: string[]) => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  };
  const run = (command: string) => spawnSync(process.execPath, ['tools/port/run.ts', command], {
    cwd: dir,
    encoding: 'utf8',
  });

  try {
    write('tools/port/config.ts', `export default ${JSON.stringify({
      generate: [
        ['test/', 'test/'],
        ['packages/react/test/', 'packages/preact/test/'],
        ['playground/react-pages/', 'playground/preact-pages/'],
      ],
      preserved: ['test/preact/', 'packages/preact/test/preact/'],
      rewrites: [], dropped: [], testRewrites: [], divergences: [], mechanical: [], ported: [],
    })};\n`);
    copyFileSync(join(ROOT, 'tools/port/run.ts'), join(dir, 'tools/port/run.ts'));
    write('upstream.json', JSON.stringify({ tag: 'fixture' }));
    write('.gitignore', 'node_modules\ndist\n.void\n');
    write('upstream/test/deleted helper.ts');
    write('upstream/test/preact/hand.test.ts', 'upstream\n');
    write('upstream/packages/react/test/renamed.test.ts');
    write('upstream/playground/react-pages/deleted.tsx');
    write('tools/port/overlay/playground/preact-pages/overlay.tsx');
    write('tools/port/overlay/packages/preact/test/preact/hand.test.ts', 'overlay\n');
    write('test/preact/hand.test.ts');
    write('packages/preact/test/preact/hand.test.ts');
    git('init', '--quiet');

    expect(run('generate').status).toBe(0);
    git('add', '--all');
    expect(run('check').status).toBe(0);

    rmSync(join(dir, 'upstream/test/deleted helper.ts'));
    rmSync(join(dir, 'upstream/playground/react-pages/deleted.tsx'));
    rmSync(join(dir, 'tools/port/overlay/playground/preact-pages/overlay.tsx'));
    write('test/untracked-stale.ts');
    write('playground/preact-pages/node_modules/cached.js');
    write('packages/preact/test/.void/cache.json');
    write('test/dist/build.js');

    const stale = [
      'test/deleted helper.ts',
      'test/untracked-stale.ts',
      'playground/preact-pages/deleted.tsx',
      'playground/preact-pages/overlay.tsx',
    ];
    const check = run('check');
    expect(check.status, check.stdout + check.stderr).toBe(1);
    for (const path of stale) {
      expect(check.stderr).toContain(`stale generated file: ${path}`);
    }

    renameSync(join(dir, 'upstream/packages/react/test/renamed.test.ts'), join(dir, 'upstream/packages/react/test/new.test.ts'));
    const renamed = run('check');
    expect(renamed.status).toBe(1);
    expect(renamed.stderr).toContain('stale generated file: packages/preact/test/renamed.test.ts');
    expect(renamed.stderr).toContain('missing generated file: packages/preact/test/new.test.ts');
    stale.push('packages/preact/test/renamed.test.ts');

    expect(run('generate').status).toBe(0);
    for (const path of stale) expect(existsSync(join(dir, path)), path).toBe(false);
    expect(readFileSync(join(dir, 'packages/preact/test/new.test.ts'), 'utf8')).toBe('fixture\n');
    for (const path of [
      'test/preact/hand.test.ts',
      'packages/preact/test/preact/hand.test.ts',
      'playground/preact-pages/node_modules/cached.js',
      'packages/preact/test/.void/cache.json',
      'test/dist/build.js',
    ]) {
      expect(readFileSync(join(dir, path), 'utf8')).toBe('fixture\n');
    }
    expect(run('check').status).toBe(0);
    expect(run('generate').status).toBe(0);
    expect(run('check').status).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
