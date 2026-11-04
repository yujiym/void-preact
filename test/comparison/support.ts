import type { CaseMetadata } from './types.ts';

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
