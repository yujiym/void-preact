import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const [file] = process.argv.slice(2);
assert.ok(file, 'usage: verify-release-ci.ts <workflow-run.json>');
assert.ok(process.env.GITHUB_SHA, 'GITHUB_SHA must identify the publish commit');
const run: unknown = JSON.parse(readFileSync(file, 'utf8'));
assert.ok(typeof run === 'object' && run !== null, 'Expected a GitHub workflow run');
assert.ok('path' in run && run.path === '.github/workflows/ci.yml', 'Select the CI workflow');
assert.ok('event' in run && run.event === 'push', 'Select a main-push CI run, including Windows');
assert.ok('head_branch' in run && run.head_branch === 'main', 'CI must run on main');
assert.ok('head_sha' in run && run.head_sha === process.env.GITHUB_SHA, 'CI must verify the selected publish commit');
assert.ok('status' in run && run.status === 'completed', 'CI must be complete');
assert.ok('conclusion' in run && run.conclusion === 'success', 'Every CI check must pass');
