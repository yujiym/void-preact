#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import config from './config.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const UPSTREAM = join(ROOT, 'upstream');
const OVERLAY = join(import.meta.dirname, 'overlay');
const PIN = join(ROOT, 'upstream.json');
const SOURCE = 'packages/react/src/';
const SKIPPED_SNAPSHOT = /(^|\/)(node_modules|dist|\.void)(\/|$)/;

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const isText = (path: string) => !/\.(woff2?|png|jpe?g|ico|gif)$/.test(path);
const isPreserved = (path: string) => config.preserved.some((prefix) => path.startsWith(prefix));

function rewrite(text: string): string {
  return config.rewrites.reduce((out, [from, to]) => out.replaceAll(from, to), text);
}

function applyDivergences(path: string, text: string): string {
  for (const { file, from, to } of config.testRewrites) {
    if (file !== path) continue;
    if (!text.includes(from)) throw new Error(`Stale test rewrite in ${path}: ${from}`);
    text = text.replaceAll(from, to);
  }
  for (const { file, title } of config.divergences) {
    if (file !== path) continue;
    const quoted = `it('${title.replaceAll("'", "\\'")}'`;
    if (!text.includes(quoted)) {
      throw new Error(`Stale divergence. ${path} has no test titled: ${title}`);
    }
    text = text.replace(quoted, `it.skip('${title.replaceAll("'", "\\'")}'`);
  }
  return text;
}

/** Every generated file, keyed by repo path. Overlay files replace generated ones. */
function expectedFiles() {
  const files = new Map<string, string | Buffer>();
  for (const [from, to] of config.generate) {
    for (const abs of walk(join(UPSTREAM, from))) {
      const rel = relative(join(UPSTREAM, from), abs);
      const target = to + rewrite(rel).replace(/(^|\/)react-/, '$1preact-');
      if (config.dropped.includes(target) || isPreserved(target)) continue;
      files.set(
        target,
        isText(abs) ? applyDivergences(target, rewrite(readFileSync(abs, 'utf8'))) : readFileSync(abs),
      );
    }
  }
  for (const abs of walk(OVERLAY)) {
    const target = relative(OVERLAY, abs);
    if (!isPreserved(target)) files.set(target, isText(abs) ? readFileSync(abs, 'utf8') : readFileSync(abs));
  }
  return files;
}

function staleFiles(expected: ReadonlyMap<string, string | Buffer>): string[] {
  const candidates = execFileSync('git', [
    '-C', ROOT, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--',
    ...config.generate.map(([, target]) => target),
  ], { encoding: 'utf8' }).split('\0').filter(Boolean);
  return [...new Set(candidates)].filter((target) =>
    !expected.has(target)
    && !isPreserved(target)
    && existsSync(join(ROOT, target)),
  );
}

function generate() {
  const expected = expectedFiles();
  for (const target of staleFiles(expected)) rmSync(join(ROOT, target), { force: true });
  for (const target of config.dropped) rmSync(join(ROOT, target), { force: true });
  for (const [target, content] of expected) {
    const abs = join(ROOT, target);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}

function mechanicalSource(file: string): string {
  const text = readFileSync(join(UPSTREAM, SOURCE, file), 'utf8');
  return config.sourceRewrites.reduce((out, [from, to]) => out.replace(from, to), text);
}

function readPinTag(): string {
  const pin: unknown = JSON.parse(readFileSync(PIN, 'utf8'));
  if (typeof pin !== 'object' || pin === null || !('tag' in pin) || typeof pin.tag !== 'string') {
    throw new Error(`Invalid upstream pin in ${PIN}: expected a tag string`);
  }
  return pin.tag;
}

function check() {
  const problems: string[] = [];
  const expected = expectedFiles();
  for (const target of staleFiles(expected)) problems.push(`stale generated file: ${target}`);
  for (const [target, content] of expected) {
    const abs = join(ROOT, target);
    if (!existsSync(abs)) problems.push(`missing generated file: ${target}`);
    else if (Buffer.compare(readFileSync(abs), Buffer.from(content)) !== 0) {
      problems.push(`generated file differs, run "pnpm port generate": ${target}`);
    }
  }
  for (const target of config.dropped) {
    if (existsSync(join(ROOT, target))) problems.push(`dropped file exists: ${target}`);
  }
  for (const file of config.mechanical) {
    if (readFileSync(join(ROOT, 'packages/preact/src', file), 'utf8') !== mechanicalSource(file)) {
      problems.push(`mechanical source differs from upstream: ${file}`);
    }
  }
  const tracked = new Set([...config.mechanical, ...config.ported]);
  for (const abs of walk(join(UPSTREAM, SOURCE))) {
    const rel = relative(join(UPSTREAM, SOURCE), abs);
    if (!tracked.has(rel)) problems.push(`upstream source is not classified in config: ${rel}`);
  }
  for (const file of tracked) {
    if (!existsSync(join(UPSTREAM, SOURCE, file))) problems.push(`config names a file upstream removed: ${file}`);
  }
  problems.forEach((problem) => console.error(problem));
  if (problems.length > 0) process.exit(1);
  console.log(`port check ok at ${readPinTag()}`);
}

function sync(tag: string): void {
  const dir = mkdtempSync(join(tmpdir(), 'void-upstream-'));
  execFileSync('git', ['clone', '--quiet', '-c', 'advice.detachedHead=false', '--depth', '1', '--branch', tag, config.repo, dir], { stdio: 'inherit' });
  const sha = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  rmSync(UPSTREAM, { recursive: true, force: true });
  for (const path of config.snapshot) {
    cpSync(join(dir, path), join(UPSTREAM, path), {
      recursive: true,
      filter: (src) => !SKIPPED_SNAPSHOT.test(relative(dir, src)),
    });
  }
  rmSync(dir, { recursive: true, force: true });
  writeFileSync(PIN, `${JSON.stringify({ repo: config.repo, tag, sha }, null, 2)}\n`);
  const version = tag.replace(/^v/, '').replace(/\+.*$/, '');
  for (const file of ['tools/md-host/package.json', 'packages/preact/package.json', 'tools/port/overlay/playground/preact-pages/package.json']) {
    const abs = join(ROOT, file);
    writeFileSync(abs, readFileSync(abs, 'utf8').replaceAll(/"(void|@void\/md)": "[^"]+"/g, `"$1": "${version}"`));
  }
  generate();
  report();
}

/** What a reviewer must look at after a sync. */
function report() {
  const changed = execFileSync('git', ['-C', ROOT, 'status', '--porcelain', '--', 'upstream/'], { encoding: 'utf8' })
    .split('\n').filter(Boolean).map((line) => line.slice(3));
  const review = changed.filter((path) => config.ported.some((file) => path === `upstream/${SOURCE}${file}`));
  console.log(`upstream files changed: ${changed.length}`);
  console.log(`ported source to review by hand: ${review.length}`);
  review.forEach((path) => console.log(`  ${path}`));
}

const [command, arg] = process.argv.slice(2);
if (command === 'sync' && arg) sync(arg);
else if (command === 'generate') generate();
else if (command === 'check') check();
else if (command === 'report') report();
else {
  console.error('usage: run.ts sync <tag> | generate | check | report');
  process.exit(2);
}
