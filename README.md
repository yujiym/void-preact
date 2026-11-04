# void-preact

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

The API is the one in the [Void Pages documentation](https://void.cloud/guide/pages-routing/overview), imported from `void-preact`. `voidPreact` replaces `voidReact`, and its `react` option is named `preact`. `react` and `react-dom` imports resolve to `preact/compat`, so third-party React components work to the extent `preact/compat` supports them.

`void-preact` also exports `Suspense`, `use`, and `useFormStatus`.

## Differences from React

- A page that suspends with no `<Suspense>` of its own renders nothing while it waits. React holds the previous page. Read deferred props under a `<Suspense>`, as the Void guide shows.
- `useTransition` reports no pending state, and `startTransition` runs at once.
- `useActionState` and `useOptimistic` do not exist.
- A form with a function `action` does not reset its uncontrolled fields after the action.

## Compatibility

`void-preact` peers on one exact `void` version, because it imports adapter-facing Void entries that change between releases.

## Development

This repo follows `packages/react` in the Void monorepo. See [docs/design.md](docs/design.md).

```sh
pnpm install
pnpm check:port        # generated files match the pinned upstream snapshot
pnpm build
pnpm typecheck
pnpm test
pnpm test:integration
node tools/ci/packed-consumer.mjs
```

Never edit `upstream/` or generated files. Change `tools/port/config.mjs`, then run `pnpm port generate`. To move to a new Void release, run `pnpm port sync <tag>`.

## License

MIT. Derived from Void, copyright Cloudflare, Inc.
