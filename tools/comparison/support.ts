import type { CaseMetadata } from './types.ts';

type SupportedPackage = 'preact' | 'preact-render-to-string';
type SupportManifest = { peerDependencies?: Partial<Record<SupportedPackage, string>>; devDependencies?: Partial<Record<SupportedPackage, string>>; exports?: Record<string, unknown> };

export function supportedVersions(manifest: SupportManifest) {
  const versions: Partial<Record<SupportedPackage, string>> = {};
  const names: SupportedPackage[] = ['preact', 'preact-render-to-string'];
  for (const name of names) {
    const version = manifest.peerDependencies?.[name];
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version) || manifest.devDependencies?.[name] !== version) {
      throw new Error(`${name} peer and dev versions must be the same exact tested version; run the comparison E2E before expanding support`);
    }
    versions[name] = version;
  }
  if (manifest.exports?.['./settled-suspense'] || Object.keys(manifest.exports ?? {}).some((name) => name.includes('suspense-adapter'))) {
    throw new Error('Private Suspense internals must not be a package export');
  }
  return versions;
}

export function assertSuspenseCoverage(cases: CaseMetadata[]) {
  const covered = new Set(cases.flatMap((scenario) => scenario.covers));
  for (const required of [
    'Suspense first suspension', 'use promise resolution', 'Suspense repeated suspension',
    'Suspense nested boundaries', 'root pending navigation', 'Suspense pending unmount',
    'Suspense SSR', 'Suspense hydration',
  ]) {
    if (!covered.has(required)) throw new Error(`Required private-Suspense behavior has no comparison case: ${required}`);
  }
}
