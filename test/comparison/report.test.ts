import type { JsonValue } from './types.ts';
import type { CaseMetadata, PassedCell, ResultCell } from './types.ts';
import { adapters, modes } from './report.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createReport } from './report.ts';

const cases: CaseMetadata[] = [{ id: 'behavior', title: 'Shared behavior', expectation: 'equivalent', sourceContracts: [], covers: [] }];
const metadata = { node: process.version, revision: 'fixture' };
const passed = (observation: JsonValue = { value: 1 }): PassedCell[] => modes.flatMap((mode) => adapters.map((adapter): PassedCell => ({ id: 'behavior', adapter, mode, status: 'passed', observation })));

test('equivalence needs all four successful observed cells', () => {
  const report = createReport({ cases, results: passed(), metadata });
  assert.equal(report.passed, true);
  assert.equal(report.rows[0].status, 'equivalent');
});
test('missing cells remain unverified and fail the gate', () => {
  const report = createReport({ cases, results: passed().slice(1), metadata });
  assert.equal(report.passed, false);
  assert.equal(report.rows[0].status, 'unverified');
});
test('matching failures are not equivalence', () => {
  const results: ResultCell[] = passed().map((cell) => ({ ...cell, status: 'failed', error: 'same crash' }));
  const report = createReport({ cases, results, metadata });
  assert.equal(report.passed, false);
  assert.equal(report.summary.failed, 1);
});
test('unexpectedly different successful observations fail', () => {
  const results = passed();
  results[1].observation = { value: 2 };
  assert.equal(createReport({ cases, results, metadata }).passed, false);
});
test('declared differences require actual different successful observations', () => {
  const different: CaseMetadata[] = [{ ...cases[0], expectation: 'different', reason: 'documented behavior difference' }];
  assert.equal(createReport({ cases: different, results: passed(), metadata }).passed, false);
  const results = passed().map((cell) => ({ ...cell, observation: { value: cell.adapter } }));
  const report = createReport({ cases: different, results, metadata });
  assert.equal(report.passed, true);
  assert.equal(report.summary.equivalent, 0);
  assert.equal(report.summary.different, 1);
});
test('unknown and duplicate cells cannot inflate evidence', () => {
  assert.throws(() => createReport({ cases, results: [...passed(), passed()[0]], metadata }), /Duplicate result/);
  assert.throws(() => createReport({ cases, results: [{ ...passed()[0], id: 'unregistered' }], metadata }), /Unknown result/);
});
test('setup failure cannot produce a passing comparison', () => {
  const report = createReport({ cases, results: [], metadata, setupError: 'install failed' });
  assert.equal(report.passed, false);
  assert.equal(report.rows[0].status, 'unverified');
});

test('support cannot promise untested ranges or mismatched development versions', async () => {
  const { supportedVersions } = await import('../../tools/ci/suspense-support.ts');
  const manifest = { peerDependencies: { preact: '11.1.1', 'preact-render-to-string': '6.8.2' }, devDependencies: { preact: '11.1.1', 'preact-render-to-string': '6.8.2' }, exports: {} };
  assert.deepEqual(supportedVersions(manifest), manifest.peerDependencies);
  assert.throws(() => supportedVersions({ ...manifest, peerDependencies: { ...manifest.peerDependencies, preact: '^11.1.1' } }), /exact tested version/);
  assert.throws(() => supportedVersions({ ...manifest, devDependencies: { ...manifest.devDependencies, preact: '11.2.0' } }), /exact tested version/);
  assert.throws(() => supportedVersions({ ...manifest, exports: { './settled-suspense': {} } }), /must not be a package export/);
});

test('an empty registry cannot claim a passing comparison', () => {
  assert.throws(() => createReport({ cases: [], results: [], metadata }), /must not be empty/);
});

test('private-Suspense maintenance coverage cannot silently disappear', async () => {
  const { assertSuspenseCoverage } = await import('./support.ts');
  const { cases: suspense } = await import('./suspense.ts');
  assert.doesNotThrow(() => assertSuspenseCoverage(suspense));
  for (const scenario of suspense.filter((item) => item.id !== 'suspense-root-cancellation-layout-state')) {
    assert.throws(() => assertSuspenseCoverage(suspense.filter((item) => item !== scenario)), /Required private-Suspense behavior/);
  }
});
