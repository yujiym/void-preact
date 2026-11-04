import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

test('publishing accepts only successful main CI for the selected commit', () => {
  const directory = mkdtempSync(join(tmpdir(), 'void-release-ci-'));
  const file = join(directory, 'run.json');
  const verified = {
    path: '.github/workflows/ci.yml', event: 'push', head_branch: 'main',
    head_sha: 'publish-commit', status: 'completed', conclusion: 'success',
  };
  const run = (value: unknown) => {
    writeFileSync(file, JSON.stringify(value));
    return spawnSync(process.execPath, [fileURLToPath(new URL('./verify-release-ci.ts', import.meta.url)), file], {
      encoding: 'utf8', env: { ...process.env, GITHUB_SHA: 'publish-commit' },
    });
  };
  try {
    const success = run(verified);
    assert.equal(success.status, 0, success.stderr);
    for (const invalid of [
      null,
      { ...verified, path: '.github/workflows/another.yml' },
      { ...verified, event: 'pull_request' },
      { ...verified, event: 'workflow_dispatch' },
      { ...verified, head_branch: 'another-branch' },
      { ...verified, head_sha: 'older-commit' },
      { ...verified, status: 'in_progress' },
      { ...verified, conclusion: 'failure' },
      { ...verified, conclusion: 'cancelled' },
    ]) assert.notEqual(run(invalid).status, 0, JSON.stringify(invalid));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
