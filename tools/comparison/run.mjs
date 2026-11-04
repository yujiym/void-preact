import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { cases as commonCases } from '../../e2e/comparison.mjs';
import { cases as suspenseCases } from '../../e2e/suspense.mjs';
import { root, upstream, prepareConsumers, buildConsumer, startConsumer } from './consumer.mjs';
import { modes, validateCases, createReport, markdown } from './report.mjs';
import { assertSuspenseCoverage } from './support.mjs';

const output = join(root, 'artifacts/comparison');
const artifacts = join(output, new Date().toISOString().replaceAll(':', '-'));
mkdirSync(artifacts, { recursive: true });
const cases = [...commonCases, ...suspenseCases];
validateCases(cases);
assertSuspenseCoverage(cases);
const assertionFiles = ['e2e/comparison.mjs', 'e2e/suspense.mjs'];
const metadata = {
  node: process.version,
  platform: process.platform,
  dirty: execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim().length > 0,
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  upstream,
  artifactDirectory: artifacts,
  assertionFiles: assertionFiles.map((path) => ({ path, sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex') })),
  sourceContracts: [...new Set(cases.flatMap((scenario) => scenario.sourceContracts))].map((path) => ({ path, sha256: createHash('sha256').update(readFileSync(join(root, path))).digest('hex') })),
};
const results = [];
let setupError;
let browser;
try {
  const prepared = prepareConsumers(artifacts);
  Object.assign(metadata, prepared);
  console.log(`Isolated comparison apps: ${prepared.directory}`);
  browser = await chromium.launch();
  for (const consumer of prepared.consumers) {
    try {
      buildConsumer(consumer, artifacts);
      for (const mode of modes) {
        let server;
        try {
          server = await startConsumer(consumer, mode, artifacts);
          for (const scenario of cases) {
            const context = await browser.newContext();
            context.setDefaultTimeout(15_000);
            const page = await context.newPage();
            const errors = [];
            const expectedErrors = [];
            const collect = (message) => {
              if ((scenario.allowedErrors ?? []).some((allowed) => message.includes(allowed)) || (scenario.expectedRecoverableErrors?.[consumer.adapter] ?? []).includes(message)) expectedErrors.push(message);
              else errors.push(message);
            };
            page.on('pageerror', (error) => collect(error.message));
            page.on('console', (message) => { if (message.type() === 'error') collect(message.text()); });
            let timeout;
            try {
              const observation = await Promise.race([
                scenario.run({ page, context, request: context.request, base: server.base, adapter: consumer.adapter, mode, app: consumer.app }),
                new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`Case timeout: ${scenario.id}`)), 30_000); }),
              ]);
              assert.deepEqual(errors, [], 'Unexpected browser errors');
              results.push({ id: scenario.id, adapter: consumer.adapter, mode, status: 'passed', observation, expectedErrors, recoveryReason: scenario.recoveryReason });
              console.log(`PASS ${consumer.adapter}/${mode} ${scenario.id}`);
            } catch (error) {
              const screenshot = `${consumer.adapter}-${mode}-${scenario.id}.png`;
              await page.screenshot({ path: join(artifacts, screenshot) }).catch(() => {});
              results.push({ id: scenario.id, adapter: consumer.adapter, mode, status: 'failed', error: error.message, errors, screenshot });
              console.log(`FAIL ${consumer.adapter}/${mode} ${scenario.id}: ${error.message}`);
            } finally {
              clearTimeout(timeout);
              await context.close();
            }
          }
        } catch (error) {
          for (const scenario of cases) {
            if (!results.some((result) => result.id === scenario.id && result.adapter === consumer.adapter && result.mode === mode)) results.push({ id: scenario.id, adapter: consumer.adapter, mode, status: 'blocked', error: error.message });
          }
        } finally {
          await server?.stop();
        }
      }
    } catch (error) {
      for (const mode of modes) for (const scenario of cases) results.push({ id: scenario.id, adapter: consumer.adapter, mode, status: 'blocked', error: error.message });
    }
  }
} catch (error) {
  setupError = error.message;
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
