import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

type Release = { tag_name: string; body: string | null };

// Plain "breaking" and "migrat" also match upstream fixes such as "D1 migration directory matching".
const BREAKING = /breaking change|^#+ .*breaking|\bvoid migrate\b|migration (guide|steps)/im;

const parts = (tag: string) => tag.replace(/^v/, '').split(/[.+-]/).slice(0, 3).map(Number);

function compare(a: string, b: string): number {
  const [left, right] = [parts(a), parts(b)];
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

/** Tags after `from`, up to and including `to`, that look breaking. A reviewer can still add the label by hand. */
export function breakingReleases(releases: Release[], from: string, to: string): string[] {
  return releases
    .filter(({ tag_name: tag }) => compare(tag, from) > 0 && compare(tag, to) <= 0)
    .filter(({ tag_name: tag, body }) => parts(tag)[0] > parts(from)[0] || BREAKING.test(body ?? ''))
    .map(({ tag_name: tag }) => tag);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [from, to] = process.argv.slice(2);
  const pages = execFileSync('gh', ['api', '--paginate', '--slurp', 'repos/voidzero-dev/void/releases?per_page=100'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const releases = (JSON.parse(pages) as Release[][]).flat();
  console.log(breakingReleases(releases, from, to).join(' '));
}
