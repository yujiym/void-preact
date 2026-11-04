# void-preact

[![CI](https://github.com/yujiym/void-preact/actions/workflows/ci.yml/badge.svg)](https://github.com/yujiym/void-preact/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/void-preact)](https://www.npmjs.com/package/void-preact)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Preact adapter for [Void](https://void.cloud), ported from `@void/react`. Build server-rendered pages with typed server loaders, forms, layouts, and interactive islands, and write `class` instead of `className`.

## Setup

```sh
pnpm add preact preact-render-to-string
pnpm add -D void-preact void @babel/core
```

```ts
import { voidPreact } from 'void-preact/plugin';
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';

export default defineConfig({
  plugins: [voidPlugin(), voidPreact()],
});
```

```json
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "preact" } }
```

## API

The API is the one in the [Void Pages documentation](https://void.cloud/guide/pages-routing/overview), imported from `void-preact`. `react` and `react-dom` imports resolve to `preact/compat`, so third-party React components work to the extent `preact/compat` supports them.

| API | Status | Notes |
| --- | --- | --- |
| `@void/react` runtime export names | Same | A test compares exported names with upstream. `voidReact` becomes `voidPreact`, and its `react` option becomes `preact`. |
| `use`, `Suspense` | Available | Also exported from `void-preact`. |
| `useFormStatus` | Available | Import it from `void-preact`, not `react-dom`. |
| `<form action={fn}>` | Available | Uncontrolled fields do not reset after the action. |
| `useTransition`, `startTransition` | Differs | Never pending. The callback runs at once. |
| `useActionState`, `useOptimistic` | Missing | The build fails on the import. |
| A page that suspends with no `<Suspense>` of its own | Differs | Renders nothing while it waits. React holds the previous page. |
| Cancelling a suspended root by navigation | Differs | Preact recovers by replacing the parked boundary, resetting its layout state. Ordinary navigation preserves layout state. |
| `onCaughtError` root option | Missing | Error boundaries still work. |

## Compatibility

`void-preact` peers on one exact `void` version, because it imports adapter-facing Void entries that change between releases. Preact support is limited to the verified pair **preact 11.1.1 / preact-render-to-string 6.8.2**. Deferred hydration and navigation rely on a maintained internal Suspense adapter. See the [support contract and update procedure](docs/design.md#private-suspense-support-contract).

## Versioning

The npm package is named `void-preact`. Its version is independent of Void's version. The supported Void version is declared in `peerDependencies` and documented in this README.

During 0.x development:

- Patch releases contain backward-compatible fixes, including Preact-specific bugs and missed upstream behavior.
- Minor releases add features, introduce breaking changes, or change the supported Void version. Release notes describe any required migration.

From 1.0.0 onward, releases follow [Semantic Versioning](https://semver.org/): patch for backward-compatible fixes, minor for backward-compatible features, and major for breaking changes. Replacing a supported exact Void peer version requires a major release because consumers must update that dependency.

Upstream updates are versioned according to their impact on consumers; their version numbers are not copied. Each release records its changes and supported Void version in `CHANGELOG.md`.

## Development

This repo follows `packages/react` in the Void monorepo. See [docs/design.md](docs/design.md) for the design, upstream updates, and release steps. CI summaries show the test totals for each run.

```sh
pnpm install
pnpm check:port        # generated files match the pinned upstream snapshot
pnpm build
pnpm typecheck
pnpm test
pnpm test:integration
node tools/ci/packed-consumer.mjs
pnpm test:comparison    # genuine installed React vs packed Preact, dev and preview
```

Never edit `upstream/` or generated files. Change `tools/port/config.mjs`, then run `pnpm port generate`. To move to a new Void release, run `pnpm port sync <tag>`.

## License

MIT. Derived from Void, copyright Cloudflare, Inc.

The comparison example lives in [examples/comparison](examples/comparison). Its generated report at `artifacts/comparison/report.md` distinguishes equivalent sampled behavior, observed differences, unsupported exports, failures, and unverified scope. Both applications are installed outside this workspace so the React baseline cannot use the test stubs.
