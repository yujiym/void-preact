import assert from 'node:assert/strict';
import { test } from 'node:test';
import { breakingReleases } from './upstream-breaking.ts';

const release = (tag_name: string, body: string) => ({ tag_name, body });

test('flags upstream migration instructions, ignoring unrelated wording', () => {
  const releases = [
    release('v1.5.0', 'Please run `void migrate` to add the `.cloudflare` build folder.'),
    release('v1.6.0', '* Fixed page middleware breaking loader and action responses.'),
    release('v1.2.0', '* Fixed D1 migration directory matching during deployment.'),
    release('v1.6.2', '# Breaking\n\nRemoved an option.'),
    release('v1.6.3', 'This is a breaking change.'),
  ];
  assert.deepEqual(breakingReleases(releases, 'v1.0.0', 'v2.0.0'), ['v1.5.0', 'v1.6.2', 'v1.6.3']);
});

test('only considers releases after the pin, up to the target', () => {
  const releases = [release('v1.5.0', 'Run void migrate'), release('v1.6.0', 'Run void migrate'), release('v1.7.0', 'Run void migrate')];
  assert.deepEqual(breakingReleases(releases, 'v1.5.0', 'v1.6.0'), ['v1.6.0']);
});

test('treats a major upstream version as breaking', () => {
  assert.deepEqual(breakingReleases([release('v2.0.0', 'New things')], 'v1.6.2', 'v2.0.0'), ['v2.0.0']);
});
