import type { Adapter, Mode } from './types.ts';
import type { CaseMetadata, Metadata, ResultCell, RowStatus } from './types.ts';
import { isDeepStrictEqual } from 'node:util';

export const modes: Mode[] = ['dev', 'preview'];
export const adapters: Adapter[] = ['react', 'preact'];
export const unverified = [
  'All React APIs and third-party React libraries',
  'Native preact/hooks imports in this shared React-source example (covered separately by packed-consumer)',
  'Social OAuth providers and deployed Cloudflare authentication',
  'Cloudflare production deployment and browser engines other than Chromium',
  'Full upstream prefetch/cache/scroll matrix, nested reset/dirty state, and quota errors',
  'Complete TypeScript API/overload equivalence, accessibility, and performance',
];

export function validateCases(cases: CaseMetadata[]) {
  if (!cases.length) throw new Error('Comparison registry must not be empty');
  const ids = new Set<string>();
  for (const scenario of cases) {
    if (!scenario.id || ids.has(scenario.id)) throw new Error(`Duplicate or missing case id: ${scenario.id}`);
    ids.add(scenario.id);
    if (!['equivalent', 'different'].includes(scenario.expectation)) throw new Error(`Invalid expectation: ${scenario.id}`);
    if (scenario.expectation === 'different' && !scenario.reason) throw new Error(`Difference needs a reason: ${scenario.id}`);
    if (!Array.isArray(scenario.sourceContracts) || !Array.isArray(scenario.covers)) throw new Error(`Missing coverage metadata: ${scenario.id}`);
  }
}

export function createReport({ cases, results, metadata, setupError }: { cases: CaseMetadata[]; results: ResultCell[]; metadata: Metadata; setupError?: string }) {
  validateCases(cases);
  const knownIds = new Set(cases.map(({ id }) => id));
  const cells = new Map<string, ResultCell>();
  for (const cell of results) {
    if (!knownIds.has(cell.id) || !adapters.includes(cell.adapter) || !modes.includes(cell.mode)) throw new Error(`Unknown result cell: ${JSON.stringify(cell)}`);
    if (!['passed', 'failed', 'blocked'].includes(cell.status)) throw new Error(`Invalid result status: ${cell.status}`);
    const key = `${cell.id}/${cell.adapter}/${cell.mode}`;
    if (cells.has(key)) throw new Error(`Duplicate result cell: ${key}`);
    cells.set(key, cell);
  }
  const rows = cases.map((scenario) => {
    const observations: ResultCell[] = [];
    let status: RowStatus = scenario.expectation;
    let detail = scenario.reason ?? '';
    for (const mode of modes) {
      const cellFor = (adapter: Adapter): ResultCell => cells.get(`${scenario.id}/${adapter}/${mode}`) ?? { id: scenario.id, adapter, mode, status: 'blocked', error: setupError ?? 'Required cell was not executed' };
      const pair: [ResultCell, ResultCell] = [cellFor('react'), cellFor('preact')];
      observations.push(...pair);
      if (pair.some((cell) => cell.status === 'failed')) status = 'failed';
      else if (pair.some((cell) => cell.status !== 'passed') && status !== 'failed') status = 'unverified';
      else if (pair[0].status === 'passed' && pair[1].status === 'passed') {
        const equal = isDeepStrictEqual(pair[0].observation, pair[1].observation);
        if (equal !== (scenario.expectation === 'equivalent')) {
          status = 'failed';
          detail = `${mode}: ${equal ? 'Expected difference was not observed' : 'Shared assertions returned different observations'}`;
        }
      }
    }
    return { id: scenario.id, title: scenario.title, expectation: scenario.expectation, status, detail, sourceContracts: scenario.sourceContracts, covers: scenario.covers, observations };
  });
  const reactProof = metadata.consumers?.find((consumer) => consumer.adapter === 'react')?.proof;
  const preactProof = metadata.consumers?.find((consumer) => consumer.adapter === 'preact')?.proof;
  const apiAvailability = ['useActionState', 'useOptimistic'].map((name) => ({
    name,
    react: reactProof?.api[name] ?? null,
    preact: preactProof?.api[name] ?? null,
    status: reactProof?.api[name] === true && preactProof?.api[name] === false ? 'unsupported-in-preact' : 'availability-only',
  }));
  return {
    schemaVersion: 1,
    title: 'Void adapter behavior comparison',
    generatedAt: new Date().toISOString(),
    scope: { adapters, modes, browser: 'Chromium', source: 'One shared React-source example with Preact compatibility aliases', unverified },
    metadata,
    apiAvailability,
    ...(setupError ? { setupError } : {}),
    passed: !setupError && rows.every((row) => ['equivalent', 'different'].includes(row.status)),
    summary: {
      equivalent: rows.filter((row) => row.status === 'equivalent').length,
      different: rows.filter((row) => row.status === 'different').length,
      failed: rows.filter((row) => row.status === 'failed').length,
      unverified: rows.filter((row) => row.status === 'unverified').length,
    },
    rows,
  };
}

const escape = (value: unknown) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
export function markdown(report: ReturnType<typeof createReport>) {
  const lines = [
    '# Void adapter behavior comparison', '',
    `Gate: **${report.passed ? 'PASSED' : 'FAILED'}**. Chromium, dev and production preview.`, '',
    'Results apply only to the named scenarios and recorded installed versions. They do not establish complete React compatibility.', '',
    '| Scenario | Result | React dev | Preact dev | React preview | Preact preview |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of report.rows) {
    const statuses = modes.flatMap((mode) => adapters.map((adapter) => row.observations.find((cell) => cell.adapter === adapter && cell.mode === mode)?.status ?? 'blocked'));
    lines.push(`| ${escape(row.title)} | ${row.status} | ${statuses.join(' | ')} |`);
  }
  lines.push('', '## Observed differences', '');
  for (const row of report.rows.filter((row) => row.expectation === 'different')) lines.push(`- ${row.id}: ${escape(row.detail)} (${row.status}).`);
  lines.push('', '## React compatibility API availability', '', '| API | React | Preact compatibility | Evidence |', '| --- | --- | --- | --- |');
  for (const api of report.apiAvailability) lines.push(`| ${api.name} | ${api.react ?? 'unverified'} | ${api.preact ?? 'unverified'} | ${api.status} |`);
  lines.push('', 'Availability probes check exports, not full behavior. They are not included in equivalent scenario totals.', '', '## Expected renderer diagnostics', '');
  for (const row of report.rows) for (const cell of row.observations) {
    if (cell.status === 'passed' && cell.expectedErrors?.length) lines.push(`- ${row.id}, ${cell.adapter}/${cell.mode}: ${escape(cell.recoveryReason ?? 'Intentional error-boundary exercise')} (${cell.expectedErrors.length} diagnostic(s)).`);
  }
  lines.push('', '## Failures and missing evidence', '');
  if (report.setupError) lines.push(`- Setup: ${escape(report.setupError)}`);
  for (const row of report.rows.filter((row) => ['failed', 'unverified'].includes(row.status))) {
    lines.push(`- ${row.id}: ${escape(row.detail)}`);
    for (const cell of row.observations.filter((cell) => cell.status !== 'passed')) lines.push(`  - ${cell.adapter}/${cell.mode}: ${escape(cell.error)}`);
  }
  lines.push('', '## Unverified scope', '', ...report.scope.unverified.map((item) => `- ${item}`), '', '## Provenance', '', `- Node: ${escape(report.metadata.node)}`, `- Source revision: ${escape(report.metadata.revision)}`, `- Upstream: ${escape(report.metadata.upstream?.tag)} (${escape(report.metadata.upstream?.sha)})`, `- Preact tarball SHA-256: ${escape(report.metadata.tarballSha256 ?? 'not prepared')}`, '', 'See report.json for resolved package versions/paths, source hashes, assertion files and observations.', '');
  return lines.join('\n');
}
