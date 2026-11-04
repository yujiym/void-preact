import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', '..');
const directory = join(root, 'packages', 'preact');
execFileSync('pnpm', ['run', 'build'], { cwd: directory, stdio: 'inherit' });
execFileSync(process.execPath, [join(root, 'tools/ci/check-suspense-support.mjs')], { cwd: root, stdio: 'inherit' });
const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
for (const [entry, conditions] of Object.entries(manifest.exports)) {
  for (const target of Object.values(conditions)) {
    assert.ok(existsSync(join(directory, target)), `${entry} export is missing ${target}`);
  }
}
for (const name of ['README.md', 'LICENSE']) {
  copyFileSync(join(root, name), join(directory, name));
}
