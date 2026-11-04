import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { supportedVersions } from '../comparison/support.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'packages/preact/package.json'), 'utf8'));
const versions = supportedVersions(manifest);
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
const boundary = join(root, 'packages/preact/src/runtime/preact-suspense-adapter.ts');
for (const path of walk(join(root, 'packages/preact/src'))) {
  if (path !== boundary && /\b(__c|__e)\b/.test(readFileSync(path, 'utf8'))) throw new Error(`Private Suspense access escaped its adapter: ${path}`);
}
for (const [name, conditions] of Object.entries(manifest.exports)) {
  if (/\b(__c|__e)\b/.test(readFileSync(join(root, 'packages/preact', conditions.types), 'utf8'))) throw new Error(`Private Suspense fields leaked into public declarations: ${name}`);
}
console.log(`Suspense contract is internal; tested peers ${JSON.stringify(versions)}`);
