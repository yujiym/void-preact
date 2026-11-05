import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { rowFor } from "./compatibility-row.ts";
import manifest from "../../packages/preact/package.json" with { type: "json" };
import upstream from "../../upstream.json" with { type: "json" };

const [evidence, output] = process.argv.slice(2);
assert.ok(
  evidence && output,
  "usage: prepare-release.ts <comparison-artifact> <release-directory>",
);
assert.match(
  manifest.version,
  /^\d+\.\d+\.\d+$/,
  "Release workflow currently supports stable versions only",
);
assert.ok(readFileSync('README.md', 'utf8').includes(rowFor(manifest)), 'Update the README Compatibility row before releasing');
const notes = process.env.RELEASE_NOTES?.trim();
assert.ok(notes, "Describe the changes and migration steps in RELEASE_NOTES");
const report: unknown = JSON.parse(readFileSync(join(evidence, "report.json"), "utf8"));
assert.ok(
  typeof report === "object" && report !== null && "passed" in report && report.passed === true,
  "Comparison must pass",
);
assert.ok("metadata" in report && typeof report.metadata === "object" && report.metadata !== null);
const metadata = report.metadata;
assert.ok(
  "revision" in metadata && metadata.revision === process.env.GITHUB_SHA,
  "Comparison must test the release commit",
);
assert.ok("dirty" in metadata && metadata.dirty === false, "Comparison must test a clean checkout");
const tarballs = readdirSync(evidence, { recursive: true, encoding: "utf8" }).filter((file) =>
  file.endsWith(".tgz"),
);
assert.equal(tarballs.length, 1, "Expected exactly one tested package");
const name = `void-preact-${manifest.version}.tgz`;
assert.ok(
  tarballs[0] === name || tarballs[0].endsWith(`/${name}`),
  "Tarball version must match package.json",
);
const tarball = readFileSync(join(evidence, tarballs[0]));
const sha256 = createHash("sha256").update(tarball).digest("hex");
assert.ok(
  "tarballSha256" in metadata && metadata.tarballSha256 === sha256,
  "Package must match the tested tarball hash",
);
mkdirSync(output, { recursive: true });
writeFileSync(join(output, name), tarball);
for (const file of ["report.md", "report.json"]) cpSync(join(evidence, file), join(output, file));
writeFileSync(join(output, "SHA256SUMS"), `${sha256}  ${name}\n`);
writeFileSync(
  join(output, "release-notes.md"),
  `${notes}

| void-preact | Void | Preact | preact-render-to-string | Vite | Node used for verification |
| --- | --- | --- | --- | --- | --- |
| ${manifest.version} | ${manifest.peerDependencies.void} | ${manifest.peerDependencies.preact} | ${manifest.peerDependencies["preact-render-to-string"]} | ${manifest.peerDependencies.vite} | ${readFileSync(".node-version", "utf8").trim()} |

Verified commit: ${process.env.GITHUB_SHA}. Upstream: ${upstream.tag} (${upstream.sha}).

The attached report.md and report.json record sampled React/Preact behavior, known differences and unverified scope. They do not establish full React equivalence. SHA256SUMS identifies the exact tested and published tarball.
`,
);
if (process.env.GITHUB_OUTPUT)
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `tag=v${manifest.version}\ntarball=${resolve(output, name)}\n`,
  );
