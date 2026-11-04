import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import manifest from '../../packages/preact/package.json' with { type: 'json' };
import upstreamManifest from '../../upstream.json' with { type: 'json' };
import type { Adapter, Mode } from '../../e2e/types.ts';
import type { Consumer, DependencyProof, PackageProof, Prepared, Server } from './types.ts';
import { supportedVersions } from './support.ts';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const template = join(root, 'examples/comparison/shared');
supportedVersions(manifest);
export const upstream = upstreamManifest;
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

function run(command: string, args: string[], cwd: string, log: string) {
  const fd = openSync(log, 'a');
  try {
    execFileSync(command, args, { cwd, stdio: ['ignore', fd, fd], timeout: 300_000 });
  } catch {
    throw new Error(`${command} ${args.join(' ')} failed; see ${log}`);
  } finally {
    closeSync(fd);
  }
}

export function prepareConsumers(artifacts: string): Prepared {
  const directory = mkdtempSync(join(tmpdir(), 'void-comparison-'));
  const packLog = join(artifacts, 'pack.log');
  run('pnpm', ['--filter', 'void-preact', 'pack', '--pack-destination', directory], root, packLog);
  const tarball = join(directory, `void-preact-${manifest.version}.tgz`);
  const sources = files(template).map((path) => ({ path: relative(template, path), sha256: hash(readFileSync(path)) }));
  const consumers: Consumer[] = [];
  const adapters: Adapter[] = ['react', 'preact'];
  for (const adapter of adapters) {
    const app = join(directory, adapter);
    cpSync(template, app, { recursive: true });
    if (adapter === 'preact') {
      for (const path of files(app)) {
        let text = readFileSync(path, 'utf8');
        text = text.replaceAll("from 'react-dom'", "from 'void-preact'")
          .replaceAll('@void/react', 'void-preact').replaceAll('voidReact', 'voidPreact');
        writeFileSync(path, text);
      }
    }
    const dependencies = {
      void: manifest.peerDependencies.void,
      vite: '8.3.5',
      '@babel/core': '7.28.0',
      '@void/md': manifest.peerDependencies.void,
      valibot: '1.5.0',
      ...(adapter === 'react'
        ? { '@void/react': manifest.peerDependencies.void, react: '19.3.0', 'react-dom': '19.3.0' }
        : { 'void-preact': `file:${tarball}`, preact: manifest.peerDependencies.preact, 'preact-render-to-string': manifest.peerDependencies['preact-render-to-string'] }),
    };
    writeFileSync(join(app, 'package.json'), `${JSON.stringify({ name: `comparison-${adapter}`, private: true, type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies }, null, 2)}\n`);
    writeFileSync(join(app, 'pnpm-workspace.yaml'), 'allowBuilds:\n  esbuild: true\n  workerd: true\n  better-sqlite3: false\n');
    writeFileSync(join(app, 'tsconfig.json'), JSON.stringify({ compilerOptions: { jsx: 'react-jsx', jsxImportSource: adapter, target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', allowImportingTsExtensions: true, noEmit: true } }));
    writeFileSync(join(app, '.env'), `BETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\n`);
    const runId = randomBytes(12).toString('hex');
    mkdirSync(join(app, 'routes/api'), { recursive: true });
    writeFileSync(join(app, 'routes/api/comparison-run.ts'), `import { defineHandler } from 'void';\nexport const GET = defineHandler(() => ({runId: ${JSON.stringify(runId)}}));\n`);
    const installLog = join(artifacts, `${adapter}-install.log`);
    run('pnpm', ['install'], app, installLog);
    const proof = dependencyProof(app, adapter);
    writeFileSync(join(artifacts, `${adapter}-dependencies.json`), `${JSON.stringify(proof, null, 2)}\n`);
    consumers.push({ adapter, app, runId, proof });
  }
  return { directory, consumers, sources, upstream, tarballSha256: hash(readFileSync(tarball)) };
}

function dependencyProof(app: string, adapter: Adapter): DependencyProof {
  const specs = adapter === 'react'
    ? ['void', 'vite', '@void/react', 'react', 'react-dom']
    : ['void', 'vite', 'void-preact', 'preact', 'preact-render-to-string'];
  const script = `import {readFileSync,realpathSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const packages = [];
for(const name of ${JSON.stringify(specs)}) {
 const entry = realpathSync(fileURLToPath(import.meta.resolve(name)));
 let dir = dirname(entry);
 while(!existsSync(join(dir,'package.json'))) dir = dirname(dir);
 const manifest = JSON.parse(readFileSync(join(dir,'package.json'),'utf8'));
 packages.push({name,version:manifest.version,entry,private:manifest.private===true,preactDependency:Boolean(manifest.dependencies?.preact)});
}
const framework = await import(${JSON.stringify(adapter === 'react' ? 'react' : 'preact/compat')});
const api = Object.fromEntries(['useActionState','useOptimistic','useTransition','Suspense','use'].map(name=>[name, typeof framework[name] !== 'undefined']));
${adapter === 'react' ? "const dom = await import('react-dom/client'); if(typeof dom.createRoot!=='function'||!framework.version.startsWith('19.')) throw new Error('Not React 19');" : ''}
console.log(JSON.stringify({packages,api}));`;
  const proof: unknown = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: app, encoding: 'utf8', timeout: 30_000 }));
  assertDependencyProof(proof);
  assert.deepEqual(proof.packages.map((pkg) => pkg.name), specs, 'Dependency proof must contain every requested package');
  for (const pkg of proof.packages) {
    assert.ok(!pkg.entry.startsWith(realpathSync(root)) && pkg.entry.startsWith(realpathSync(app)), `Dependency escaped isolated app: ${pkg.name}`);
    if (adapter === 'react') assert.ok(!pkg.private && !pkg.preactDependency, `React baseline uses a stub: ${pkg.name}`);
  }
  if (adapter === 'preact') {
    const peers: ('preact' | 'preact-render-to-string')[] = ['preact', 'preact-render-to-string'];
    for (const name of peers) {
      assert.equal(proof.packages.find((pkg) => pkg.name === name)?.version, manifest.peerDependencies[name], `Installed ${name} must match the exact supported peer`);
    }
  }
  return proof;
}

export function buildConsumer(consumer: Consumer, artifacts: string) {
  run('pnpm', ['exec', 'vite', 'build'], consumer.app, join(artifacts, `${consumer.adapter}-build.log`));
}

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  assert.ok(address && typeof address !== 'string', 'Port allocation must return an IP address');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

export async function startConsumer(consumer: Pick<Consumer, 'adapter' | 'app' | 'runId'>, mode: Mode, artifacts: string): Promise<Server> {
  const port = await freePort();
  const base = `http://localhost:${port}`;
  const log = join(artifacts, `${consumer.adapter}-${mode}.log`);
  const fd = openSync(log, 'a');
  const child = spawn('pnpm', ['exec', 'vite', mode === 'dev' ? 'dev' : 'preview', '--port', String(port), '--strictPort'], { cwd: consumer.app, stdio: ['ignore', fd, fd], detached: true });
  closeSync(fd);
  let spawnError: Error | undefined;
  child.on('error', (error) => { spawnError = error; });
  const stop = async () => {
    const pid = child.pid;
    if (!pid) return;
    const signalGroup = (signal: NodeJS.Signals | 0) => {
      try { process.kill(-pid, signal); return true; }
      catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ESRCH') return false; throw error; }
    };
    if (!signalGroup('SIGTERM')) return;
    for (let attempt = 0; attempt < 120; attempt++) {
      if (!signalGroup(0)) return;
      await delay(25);
    }
    signalGroup('SIGKILL');
    await delay(25);
  };
  try {
    for (let attempt = 0; attempt < 120; attempt++) {
      if (spawnError || child.exitCode !== null) throw new Error(`Server exited: ${spawnError?.message ?? child.exitCode}; see ${log}`);
      const identity: unknown = await fetch(`${base}/api/comparison-run`, { signal: AbortSignal.timeout(2000) }).then(async (response) => response.ok ? response.json() : null, () => null).catch(() => null);
      if (identity !== null && typeof identity === 'object' && 'runId' in identity && identity.runId === consumer.runId) return { base, stop, log };
      await delay(500);
    }
    throw new Error(`Server readiness failed for ${consumer.adapter}/${mode}; see ${log}`);
  } catch (error) {
    await stop();
    throw error;
  }
}

function isPackageProof(value: unknown): value is PackageProof {
  return value !== null && typeof value === 'object'
    && 'name' in value && typeof value.name === 'string'
    && 'version' in value && typeof value.version === 'string'
    && 'entry' in value && typeof value.entry === 'string'
    && 'private' in value && typeof value.private === 'boolean'
    && 'preactDependency' in value && typeof value.preactDependency === 'boolean';
}

function assertDependencyProof(value: unknown): asserts value is DependencyProof {
  assert.ok(value !== null && typeof value === 'object', 'Dependency proof must be an object');
  assert.ok('packages' in value && Array.isArray(value.packages) && value.packages.every(isPackageProof), 'Dependency proof must contain package versions and resolved paths');
  assert.ok('api' in value && value.api !== null && typeof value.api === 'object' && Object.values(value.api).every((available: unknown) => typeof available === 'boolean'), 'Dependency proof must contain API availability booleans');
  for (const name of ['useActionState', 'useOptimistic', 'useTransition', 'Suspense', 'use']) {
    assert.ok(name in value.api && typeof Reflect.get(value.api, name) === 'boolean', `Dependency proof is missing API ${name}`);
  }
}
