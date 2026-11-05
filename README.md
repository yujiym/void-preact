# void-preact

[![CI](https://github.com/yujiym/void-preact/actions/workflows/ci.yml/badge.svg)](https://github.com/yujiym/void-preact/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/void-preact)](https://www.npmjs.com/package/void-preact)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Preact](https://preactjs.com) adapter for [Void](https://void.cloud), ported from `@void/react`. Build server-rendered pages with typed loaders, forms, layouts, and interactive islands. Use `class` in your JSX.

> 🚧 **Early days.** This adapter is still rough around the edges, and Void itself is evolving quickly, so for now we'd suggest using it only for dogfooding. Please avoid using it in production.

## Why Preact

Preact keeps React's component model at about a tenth of its runtime size. Choose `@void/react` for production or full React 19 behavior, and `@void/solid` if you don't need React's model or libraries.

| | void-preact | `@void/react` | `@void/solid` |
| --- | --- | --- | --- |
| Runtime size (gzip) | ~7 KB | ~69 KB | ~5 KB |
| JSX attribute | `class` | `className` | `class` |
| Component model | Hooks | Hooks | Signals |
| React libraries | Through `preact/compat` | Native | Not usable |
| Moving from `@void/react` | Change plugin and imports | N/A | Rewrite components |
| React 19 actions and transitions | [Partial](docs/API.md) | Full | N/A |
| Void support | Unofficial | Official | Official |

Sizes are for hydrating one counter, without Void's runtime, bundled and minified with esbuild: Preact 11.1.1 with `preact/compat`, React 19.3.1, Solid 1.9.18.

## Setup

In a Void app using Vite 8, install the supported dependencies:

```sh
pnpm add --save-exact preact@11.1.1 preact-render-to-string@6.8.2
pnpm add -D --save-exact void-preact@0.1.2 void@1.6.2
pnpm add -D vite@8
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

See the [Void Pages documentation](https://void.cloud/guide/pages-routing/overview) for loaders, routing, forms, and islands.

## API

Import Void components and hooks from `void-preact`. They keep the names used by `@void/react`, and `voidPreact` replaces `voidReact`.

Main limitations: `useActionState` and `useOptimistic` are unavailable, `useTransition` doesn't schedule, and `useFormStatus` provides only `pending`. See [API.md](docs/API.md) for every difference.

## Compatibility

| void-preact | Void (exact) | Preact (exact) | preact-render-to-string (exact) | Vite |
| --- | --- | --- | --- | --- |
| 0.1.2 | 1.6.2 | 11.1.1 | 6.8.2 | ^8.0.0 |

Versions are exact because the adapter uses Void's adapter-facing entries and [private Preact Suspense behavior](docs/DESIGN.md#private-suspense-support-contract). For older versions, see [GitHub releases](https://github.com/yujiym/void-preact/releases).

## Contributing

The repository layout mirrors Void's monorepo and follows each Void release. See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for development commands and the layout, and [DESIGN.md](docs/DESIGN.md) for the upstream sync flow and release procedure.

## License

[MIT](LICENSE)
