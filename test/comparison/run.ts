import type { Browser } from 'playwright';
import type { JsonValue } from './types.ts';
import type { Metadata, ResultCell, Server } from './types.ts';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { cases as commonCases } from './comparison.ts';
import { cases as suspenseCases } from './suspense.ts';
import { root, upstream, prepareConsumers, buildConsumer, startConsumer } from './consumer.ts';
import { modes, validateCases, createReport, markdown } from './report.ts';
import { assertSuspenseCoverage } from './support.ts';

const output = join(root, 'artifacts/comparison');
const artifacts = join(output, new Date().toISOString().replaceAll(':', '-'));
mkdirSync(artifacts, { recursive: true });
const cases = [...commonCases, ...suspenseCases];
validateCases(cases);
assertSuspenseCoverage(cases);
const assertionFiles = ['test/comparison/comparison.ts', 'test/comparison/suspense.ts'];
const metadata: Metadata = {
  node: process.version,
  platform: process.platform,
  dirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  upstream,
  artifactDirectory: artifacts,
  assertionFiles: assertionFiles.map((path) => ({ path, sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex') })),
  sourceContracts: [...new Set(cases.flatMap((scenario) => scenario.sourceContracts))].map((path) => ({ path, sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex') })),
};
const results: ResultCell[] = [];
let setupError: string | undefined;
let browser: Browser | undefined;
try {
  const prepared = prepareConsumers(artifacts);
  Object.assign(metadata, prepared);
  console.log(`Isolated comparison apps: ${prepared.directory}`);
  browser = await chromium.launch();
  for (const consumer of prepared.consumers) {
    try {
      buildConsumer(consumer, artifacts);
      for (const mode of modes) {
        let server: Server | undefined;
        try {
          server = await startConsumer(consumer, mode, artifacts);
          for (const scenario of cases) {
            const context = await browser.newContext();
            context.setDefaultTimeout(15_000);
            const page = await context.newPage();
            const errors: string[] = [];
            const expectedErrors: string[] = [];
            const collect = (message: string) => {
              if ((scenario.allowedErrors ?? []).some((allowed) => message.includes(allowed)) || (scenario.expectedRecoverableErrors?.[consumer.adapter] ?? []).includes(message)) expectedErrors.push(message);
              else errors.push(message);
            };
            page.on('pageerror', (error) => collect(errorMessage(error)));
            page.on('console', (message) => { if (message.type() === 'error') collect(message.text()); });
            let timeout: ReturnType<typeof setTimeout> | undefined;
            try {
              const observation = await Promise.race([
                scenario.run({ page, context, request: context.request, base: server.base, adapter: consumer.adapter, mode, app: consumer.app }),
                new Promise<JsonValue>((_, reject) => { timeout = setTimeout(() => reject(new Error(`Case timeout: ${scenario.id}`)), 30_000); }),
              ]);
              assert.deepEqual(errors, [], 'Unexpected browser errors');
              results.push({ id: scenario.id, adapter: consumer.adapter, mode, status: 'passed', observation, expectedErrors, recoveryReason: scenario.recoveryReason });
              console.log(`PASS ${consumer.adapter}/${mode} ${scenario.id}`);
            } catch (error) {
              const screenshot = `${consumer.adapter}-${mode}-${scenario.id}.png`;
              await page.screenshot({ path: join(artifacts, screenshot) }).catch(() => {});
              results.push({ id: scenario.id, adapter: consumer.adapter, mode, status: 'failed', error: errorMessage(error), errors, screenshot });
              console.log(`FAIL ${consumer.adapter}/${mode} ${scenario.id}: ${errorMessage(error)}`);
            } finally {
              clearTimeout(timeout);
              await context.close();
            }
          }
        } catch (error) {
          for (const scenario of cases) {
            if (!results.some((result) => result.id === scenario.id && result.adapter === consumer.adapter && result.mode === mode)) results.push({ id: scenario.id, adapter: consumer.adapter, mode, status: 'blocked', error: errorMessage(error) });
          }
        } finally {
          await server?.stop();
        }
      }
    } catch (error) {
      for (const mode of modes) for (const scenario of cases) results.push({ id: scenario.id, adapter: consumer.adapter, mode, status: 'blocked', error: errorMessage(error) });
    }
  }
} catch (error) {
  setupError = errorMessage(error);
} finally {
  await browser?.close();
  const report = createReport({ cases, results, metadata, setupError });
  writeFileSync(join(artifacts, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(artifacts, 'report.md'), markdown(report));
  writeFileSync(join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(output, 'report.md'), markdown(report));
  console.log(JSON.stringify(report.summary));
  console.log(`Report: ${join(artifacts, 'report.md')}`);
  process.exitCode = report.passed ? 0 : 1;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
