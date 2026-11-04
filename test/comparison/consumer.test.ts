import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, delimiter } from 'node:path';
import { startConsumer } from './consumer.ts';

test('stop terminates an HTTP descendant even after its launch process exits', { timeout: 15_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'void-comparison-cleanup-'));
  const bin = join(directory, 'bin');
  mkdirSync(bin);
  writeFileSync(join(directory, 'server.cjs'), `const http = require('node:http');
process.on('SIGTERM', () => {});
http.createServer((req,res) => { res.setHeader('Content-Type','application/json');res.end(JSON.stringify({runId:'cleanup-fixture'})); }).listen(Number(process.argv[2]));
`);
  const launcher = join(bin, 'pnpm');
  writeFileSync(launcher, `#!${process.execPath}
const {spawn} = require('node:child_process');
spawn(process.execPath, [${JSON.stringify(join(directory, 'server.cjs'))}, process.argv[process.argv.indexOf('--port')+1]], {stdio:'inherit'});
process.on('SIGTERM', () => process.exit(0));
setInterval(() => {}, 1000);
`);
  chmodSync(launcher, 0o755);
  const originalPath = process.env.PATH;
  process.env.PATH = `${bin}${delimiter}${originalPath}`;
  let server: Awaited<ReturnType<typeof startConsumer>> | undefined;
  try {
    server = await startConsumer({ adapter: 'preact', app: directory, runId: 'cleanup-fixture' }, 'dev', directory);
    assert.equal((await fetch(`${server.base}/api/comparison-run`)).status, 200);
    await server.stop();
    await assert.rejects(fetch(`${server.base}/api/comparison-run`, { signal: AbortSignal.timeout(500) }));
  } finally {
    process.env.PATH = originalPath;
    await server?.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});
