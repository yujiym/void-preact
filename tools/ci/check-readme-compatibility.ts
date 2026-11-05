import { readFileSync } from 'node:fs';
import { compatibilityRow } from './compatibility-row.ts';

const readme = readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
if (!readme.includes(compatibilityRow)) {
  console.log(`::warning file=README.md,title=README Compatibility row is out of date::Publishing requires this row: ${compatibilityRow}`);
}
