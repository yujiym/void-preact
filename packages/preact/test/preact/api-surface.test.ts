import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vite-plus/test';

const ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const ADDITIONS = ['Suspense', 'use', 'useFormStatus'];

function exportedNames(file: string): Array<string> {
  const source = readFileSync(join(ROOT, file), 'utf8');
  return [...source.matchAll(/export (?:type )?\{([^}]*)\}/g)]
    .flatMap((match) => match[1].split(','))
    .concat([...source.matchAll(/export type (\w+)/g)].map((match) => match[1]))
    .map((name) => name.trim())
    .filter(Boolean)
    .sort();
}

it('exports the @void/react API, plus only the listed additions', () => {
  const upstream = exportedNames('upstream/packages/react/src/runtime/index.ts');
  const ours = exportedNames('packages/preact/src/runtime/index.ts');
  expect(ours).toEqual([...upstream, ...ADDITIONS].sort());
});
