import { readFileSync } from 'node:fs';
import { rowFor } from './compatibility-row.ts';
import manifest from '../../packages/preact/package.json' with { type: 'json' };

const compatibilityRow = rowFor(manifest);
const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
if (!readme.includes(compatibilityRow)) {
  console.log(`::warning file=README.md,title=README Compatibility row is out of date::Publishing requires this row: ${compatibilityRow}`);
}
