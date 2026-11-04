# void-preact

[![CI](https://github.com/yujiym/void-preact/actions/workflows/ci.yml/badge.svg)](https://github.com/yujiym/void-preact/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/void-preact)](https://www.npmjs.com/package/void-preact)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Preact](https://preactjs.com) adapter for [Void](https://void.cloud), ported from `@void/react`. Build server-rendered pages with typed loaders, forms, layouts, and interactive islands. Use `class` in your JSX.

## Setup

In a Void app using Vite 8, install the supported dependencies:

```sh
pnpm add --save-exact preact@11.1.1 preact-render-to-string@6.8.2
pnpm add -D --save-exact void-preact void@1.6.1 @babel/core@7.28.0
```

```ts
// vite.config.ts
import { voidPreact } from 'void-preact/plugin';
import { defineConfig } from 'vite';
import { voidPlugin } from 'void';

export default defineConfig({
  plugins: [voidPlugin(), voidPreact()],
});
```

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact"
  }
}
```

Import Void components and hooks from `void-preact`. See the [Void Pages documentation](https://void.cloud/guide/pages-routing/overview) for loaders, routing, forms, and islands.

## API

`react` and `react-dom` imports resolve through `preact/compat`. Third-party React components depend on that compatibility layer's supported features. The table describes what this adapter provides and where app behavior differs.

| API or behavior | Support | Result in void-preact |
| --- | --- | --- |
| Void components and hooks, including `Link`, `Form`, `useForm`, and router hooks | Supported | Import them from `void-preact`. The upstream runtime export names are retained; the comparison exercises navigation, validation, server actions, and islands. |
| `voidReact` plugin | Supported with rename | Use `voidPreact` from `void-preact/plugin`. Its preset option is named `preact` instead of `react`. |
| `use`, `Suspense` | Supported | Also exported from `void-preact`. Deferred SSR and hydration are verified for the exact supported dependency pair. |
| `useFormStatus` | Partial | Import the adapter's implementation from `void-preact`. It provides `pending`; React's other status fields are not implemented. |
| `<form action={fn}>` | Partial | The function runs with `FormData`, and pending state is tracked. Uncontrolled inputs retain their values after success instead of resetting as in React. |
| `useTransition`, `startTransition` | Different | The callback runs immediately and pending stays false. React's transition scheduling and async pending lifetime are not reproduced. |
| `useActionState`, `useOptimistic` | Unsupported | No compatibility implementation is provided. Imports from aliased `react` fail at build time. |
| Root suspension without a local `<Suspense>` | Different | The default root fallback is blank while waiting. React can retain the previous page. Use an explicit boundary to choose a local fallback. |
| Navigating away from a suspended root | Different | Navigation recovers by replacing the parked boundary, resetting its layout state. React retains that state. Ordinary navigation preserves layout state in both. |
| `onCaughtError` root option | Unsupported | This root callback is not provided. Component error boundaries still catch render errors. |

## Compatibility

The current version in this repository supports the following dependencies:

| void-preact | Void (exact) | Preact (exact) | preact-render-to-string (exact) | Vite |
| --- | --- | --- | --- | --- |
| 0.1.0 | 1.6.1 | 11.1.1 | 6.8.2 | ^8.0.0 |

This table describes the current version only. For older versions, see the compatibility table and comparison evidence attached to each [GitHub release](https://github.com/yujiym/void-preact/releases). Deferred hydration and navigation use a maintained private Suspense adapter; see the [support contract and update procedure](DESIGN.md#private-suspense-support-contract).

## Development

Use the Node version in `.node-version`, generated from the pinned upstream version. Handwritten tooling and E2E use TypeScript, run directly in Node, and are included in strict typechecking. The React test stubs remain JavaScript dependency packages.

```sh
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm test:integration
node tools/ci/packed-consumer.ts
pnpm test:comparison:unit
pnpm test:comparison
pnpm check:port
```

The [comparison app](test/comparison/app) runs one shared app against real installed React and packed Preact, in dev and preview. Both apps are installed outside the workspace so React cannot resolve to the test stubs. `artifacts/comparison/report.md` records equivalent sampled behavior, observed differences, unsupported exports, and unverified scope. Passing the sampled matrix does not establish complete React equivalence. CI retains reports, diagnostics and the tested tarball for 90 days, keyed by commit SHA, and shows test totals in its summaries. Releases retain the reports, tarball and checksum as GitHub release assets.

This repo follows `packages/react` in Void. Change `tools/port/config.ts` or its overlays, then run `pnpm port generate`; generated files and `upstream/` are maintained by that tool. Run `pnpm port sync <tag>` for an upstream release. See [DESIGN.md](DESIGN.md) for the design, support conditions, update gates, and release procedure.

## Automation

Upstream sync runs weekly on Tuesday at 06:00 JST (Monday 21:00 UTC), or manually. It opens an update PR and dispatches the full CI, including the React/Preact comparison. Review and merge remain maintainer actions. GitHub must allow Actions to create pull requests.

Build, typecheck, unit and upstream integration tests always run on Linux. Windows runs on main pushes and PRs labeled `test: windows`; manual CI runs can also enable Windows. Packed-consumer and comparison tests run on Linux with Chromium.

The manually dispatched npm publish workflow calls the shared CI with Windows enabled, then publishes the exact tested tarball from that same workflow run. It creates a version tag and GitHub release with compatibility details and evidence. npm trusted publishing and the GitHub `npm` environment must be configured first; see [release setup and procedure](DESIGN.md#releasing). Updating the package version and reviewing compatibility changes remain maintainer actions.

## License

MIT. Derived from Void, copyright Cloudflare, Inc.
