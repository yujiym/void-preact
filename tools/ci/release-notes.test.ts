import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseNotes } from './release-notes.ts';

const sync = (body: string, labels: string[] = []) => ({
  title: 'chore: sync upstream void to v1.7.0',
  body,
  head: { ref: 'upstream/v1.7.0' },
  labels: labels.map((name) => ({ name })),
});
const lead = 'Update Void to [v1.7.0](https://github.com/voidzero-dev/void/releases/tag/v1.7.0).';
const empty = 'Intro\n\n## Release notes\n\n<!-- Describe the change. -->\n\n## Sync report\n\nDetails';

test('a sync PR without written notes links the upstream release', () => {
  assert.equal(releaseNotes(sync(empty), 'v1.7.0'), lead);
});

test('written notes follow the link and stop at the next section', () => {
  const body = 'Intro\r\n\r\n## Release notes\r\n\r\n<!-- Hint -->\r\nAdds a thing.\r\n\r\n## Sync report\r\n\r\nDetails';
  assert.equal(releaseNotes(sync(body), 'v1.7.0'), `${lead}\n\nAdds a thing.`);
});

test('notes may be the last section', () => {
  assert.equal(releaseNotes(sync('## Release notes\n\nAdds a thing.\n'), 'v1.7.0'), `${lead}\n\nAdds a thing.`);
});

test('a breaking PR needs written notes', () => {
  assert.throws(() => releaseNotes(sync(empty, ['breaking']), 'v1.7.0'), /labeled breaking/);
  const body = '## Release notes\n\nRename `a` to `b`.\n';
  assert.equal(releaseNotes(sync(body, ['breaking']), 'v1.7.0'), `${lead}\n\nRename \`a\` to \`b\`.`);
});

test('other PRs lead with their title', () => {
  const pr = { title: 'fix: handle a thing', body: null, head: { ref: 'fix/thing' }, labels: [] };
  assert.equal(releaseNotes(pr, 'v1.7.0'), 'fix: handle a thing');
});
