import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import upstream from '../../upstream.json' with { type: 'json' };

type PullRequest = { title: string; body: string | null; head: { ref: string }; labels: { name: string }[] };

function section(body: string | null): string {
  const text = (body ?? '').replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const match = /^## Release notes[ \t]*\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text);
  return match?.[1].trim() ?? '';
}

/** The maintainer-facing part of the release body, taken from the merged PR. */
export function releaseNotes(pr: PullRequest, tag: string): string {
  const written = section(pr.body);
  if (!written && pr.labels.some(({ name }) => name === 'breaking')) {
    throw new Error('This PR is labeled breaking: run npm publish manually with the change and its migration steps.');
  }
  const lead = pr.head.ref.startsWith('upstream/')
    ? `Update Void to [${tag}](https://github.com/voidzero-dev/void/releases/tag/${tag}).`
    : pr.title;
  return written ? `${lead}\n\n${written}` : lead;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { GITHUB_REPOSITORY: repository, GITHUB_SHA: sha } = process.env;
  const pulls = JSON.parse(execFileSync('gh', ['api', `repos/${repository}/commits/${sha}/pulls`], { encoding: 'utf8' })) as PullRequest[];
  if (pulls.length === 0) throw new Error(`No pull request found for ${sha}: run npm publish manually with release notes.`);
  console.log(releaseNotes(pulls[0], upstream.tag));
}
