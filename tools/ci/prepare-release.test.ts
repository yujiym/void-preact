import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import manifest from '../../packages/preact/package.json' with { type: 'json' };

test('release preparation retains the tested package and rejects invalid evidence', () => {
  const directory = mkdtempSync(join(tmpdir(), 'void-release-'));
  const tarball = `void-preact-${manifest.version}.tgz`;
  const content = Buffer.from('tested package fixture');
  const metadata = {
    revision: 'release-commit',
    dirty: false,
    tarballSha256: createHash('sha256').update(content).digest('hex'),
  };
  const run = () => spawnSync(process.execPath, [fileURLToPath(new URL('./prepare-release.ts', import.meta.url)), directory, 'release'], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_SHA: 'release-commit', RELEASE_NOTES: 'Fixture release', GITHUB_OUTPUT: join(directory, 'outputs') },
  });
  try {
    copyFileSync(fileURLToPath(new URL('../../.node-version', import.meta.url)), join(directory, '.node-version'));
    writeFileSync(join(directory, tarball), content);
    writeFileSync(join(directory, 'report.md'), 'Comparison fixture');
    writeFileSync(join(directory, 'report.json'), JSON.stringify({ passed: true, metadata }));
    writeFileSync(join(directory, 'README.md'), '| 0.0.0 | stale |');
    const stale = run();
    assert.notEqual(stale.status, 0);
    assert.match(stale.stderr, /Update the README Compatibility row/);
    const { void: voidVersion, preact, 'preact-render-to-string': renderToString, vite } = manifest.peerDependencies;
    writeFileSync(join(directory, 'README.md'), `| ${manifest.version} | ${voidVersion} | ${preact} | ${renderToString} | ${vite} |`);
    for (const invalid of [
      { passed: false, metadata },
      { passed: true, metadata: { ...metadata, dirty: true } },
      { passed: true, metadata: { ...metadata, revision: 'another-commit' } },
      { passed: true, metadata: { ...metadata, tarballSha256: 'wrong-hash' } },
    ]) {
      writeFileSync(join(directory, 'report.json'), JSON.stringify(invalid));
      assert.notEqual(run().status, 0, JSON.stringify(invalid));
    }
    writeFileSync(join(directory, 'report.json'), JSON.stringify({ passed: true, metadata }));
    const result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(join(directory, 'outputs'), 'utf8').split('\n').find((line) => line.startsWith('tarball=')),
      `tarball=${join(directory, 'release', tarball)}`,
      'npm must receive an absolute file path rather than a GitHub shorthand',
    );
    assert.deepEqual(readFileSync(join(directory, 'release', tarball)), content);
    assert.equal(readFileSync(join(directory, 'release', 'SHA256SUMS'), 'utf8'), `${metadata.tarballSha256}  ${tarball}\n`);
    assert.match(readFileSync(join(directory, 'release', 'release-notes.md'), 'utf8'), /Fixture release/);
    assert.match(readFileSync(join(directory, 'outputs'), 'utf8'), new RegExp(`tag=v${manifest.version}`));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
