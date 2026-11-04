# void-preact design

`void-preact` is a Preact adapter for [Void](https://void.cloud), ported from `@void/react`. A Void app switches to it by changing one plugin and its imports. The rule that shapes this repo is that it follows `@void/react`, in API and in tests, at every Void release.

## Repo layout mirrors the upstream monorepo

```
upstream.json              pinned tag and SHA
upstream/                  verbatim snapshot at that tag, never edited
tools/port/config.mjs      every recorded difference from packages/react
tools/port/run.mjs         sync, generate, check, report
tools/port/overlay/        hand-owned files that replace generated ones
tools/react-stub/          react and react-dom names for upstream tests
packages/preact/src/       the adapter, same file names as packages/react/src
packages/preact/test/unit, integration, fixtures   generated from upstream
packages/preact/test/preact/                       hand-written tests
test/                      generated shared contract and helpers
playground/preact-pages/   generated from playground/react-pages
```

The tree has the shape of the upstream one, so upstream test files keep their relative imports and need few edits. Moving `packages/preact` into a Void fork later is a directory copy.

## How a difference from upstream is recorded

`tools/port/config.mjs` is the single place that says how this repo differs.

| Field | Meaning | What enforces it |
| --- | --- | --- |
| `rewrites` | Renames applied to every generated file | `check` compares generated files byte for byte |
| `mechanical` | Source files equal to upstream after `sourceRewrites` | `check` fails on any drift |
| `ported` | Hand-written source files | `report` lists them when upstream changes them |
| `testRewrites` | An edit that keeps an upstream assertion meaningful, with a reason | Generation fails if the text is gone upstream |
| `divergences` | An upstream test this adapter skips, with a reason | Generation fails if the title is gone upstream |
| `dropped` | Generated paths this repo removes | Listed for review |
| `preserved` | Hand-owned directories inside generated roots | Neither generation nor stale-file cleanup writes there |

Generation removes stale nonignored files within its owned output directories, and `check` rejects them before regeneration. Git-ignored caches and build artifacts are excluded from cleanup.

Upstream source that is in neither `mechanical` nor `ported` fails `check`, so a new upstream file cannot be missed.

## How tests stay close to upstream

Upstream tests import `react` directly. `tools/react-stub` holds workspace packages named `react` and `react-dom` that re-export `preact/compat`, so the tests run as written, including those that start their own Vite server. The stub's `act` waits for pending work the way React's does. The stubs are dev-only and are never published. Playground pages reach Preact through the alias that `@preact/preset-vite` installs.

`packages/preact/test/preact/api-surface.test.ts` compares the exports of `runtime/index.ts` with the upstream file. Its allowed additions are `Suspense`, `use`, and `useFormStatus`, to expose Suspense and use from preact/compat and the adapter’s own useFormStatus.

## Runtime differences from React

These are the choices forced by what Preact 11 does not have.

**Navigation has no transitions.** `useTransition` in `preact/compat` returns `[false, startTransition]`, and `startTransition` runs its callback synchronously. So a resource gains a `result` field, set when its shell settles, and only a resource with a result renders. The reducer in `pages-client.ts` is otherwise upstream's. `NavigationFallback` renders when the current resource has no result and a visit is pending.

**A page that suspends with no boundary of its own shows nothing.** React holds the old page during a transition. Preact's root `Suspense` shows its `null` fallback. Deferred props under the documented `<Suspense>` pattern are unaffected.

**Form actions are provided by the adapter.** React 19 accepts a function as `<form action>`, and `@void/react` is built on it. `runtime/form-action.tsx` installs an `options.vnode` hook that swaps such a `form` for a component that calls the function with `FormData` and provides `useFormStatus`. `form.tsx` stays the upstream shape. React's automatic reset of uncontrolled fields after an action is not reproduced, because `form.reset()` would blank controlled inputs that Preact does not re-diff.

**`useForm` has its own pending state.** `useActionState` does not exist in Preact. A queue keeps submits sequential, as React does, and a thrown error is rethrown in render to reach the nearest error boundary.

**Server rendering uses the `preact-render-to-string` stream.** It writes the shell as one first chunk, then emits `<div hidden>` for suspended trees. The first chunk arrives before that div, so upstream's `readDeferredShell` cuts at the marker unchanged. A render error rejects the first read, which `readShell` awaits so the caller can serve its error page.

**The engine starts before hydration.** Preact renders synchronously, so `engine.start()` moves ahead of `hydrate()`. React scheduled its render for later, which gave the same order.

**HMR needs no preamble.** Prefresh injects its setup in a module transform, so the React Refresh preamble is gone. The Worker optimizer pre-includes `preact/devtools`, which the preset injects after scanning. Discovering it during SSR would reload the Worker and mix hooks and renderer instances.

## Void core selects adapters by plugin name

`@void/md` (`packages/md/src/plugin.ts`) and the auth client path (`packages/void/src/plugin-routing.ts`) read a fixed list of plugin names. `plugin.ts` adds a marker plugin named `void-react:pages` and aliases `@void/react` to `void-preact`, so the React code they select runs on Preact. Both package names are excluded from dependency optimization to preserve shared contexts. The browser optimizer pre-includes `void > better-auth/react` because Void selects that auth adapter after scanning. The marker depends on upstream internals, and the upstream `md-layout-frontmatter` and `island-css-build` tests are what catch it breaking. `void init` still does not offer Preact.

## Preact behavior this adapter works around

`runtime/settled-suspense.ts` uses `Suspense.prototype.__c`, a mangled internal that `preact-render-to-string` also depends on.

- Preact runs effects above a suspended child at once, and sets no boundary state during hydration. `SettledSuspense` tracks the root boundary so navigation commits and `data-hydrated` wait for its content, as React's commit does.
- On resume, Preact hydrates a `$s` range as if it held streamed content. A deferred shell is cut before any streamed content, so the range holds the fallback, and the real content would keep the fallback element's attributes. The adapter empties the range first on deferred pages.

## CI

| Workflow | Job | What it proves |
| --- | --- | --- |
| `ci.yml` | `port` | Generated files, mechanical source, and classification match the pinned snapshot |
| `ci.yml` | `checks` | Build, typecheck, upstream and own unit tests |
| `ci.yml` | `integration` | The upstream shared contract against the playground, in Chromium, in dev and preview |
| `ci.yml` | `packed-consumer` | The packed tarball builds and server-renders in a fresh app outside the workspace |
| `upstream-sync.yml` | `sync` | Weekly, opens a PR for a new Void release with the upstream diff, the ported files to review, and the test status |

## Versioning

`void-preact` has its own semver and peers on one exact `void` version, as `@void/react` does, because it imports `void/pages-client` and other adapter-facing entries that change between releases.

## Alternatives rejected

**Alias `react` to `preact/compat` over the published `@void/react`.** Measured, the build fails because `useActionState` and `renderToReadableStream` are not exported.

**Fork the void repo.** A merge would not carry `packages/react` changes into `packages/preact`, so the sync tool is needed anyway, and the fork carries the platform code and its CI.

**Git submodule for upstream.** A sync PR would show a SHA bump instead of the upstream diff, which is the thing a reviewer needs.

**Hand-copied tests.** They drift silently, and nothing records why a test differs.

## Updating Void

Use Node from `.node-version` and the package manager in `package.json`. Install with `pnpm install --frozen-lockfile`.

The weekly sync workflow opens one branch per upstream tag. GitHub must allow Actions to create pull requests in the repository's Actions settings. Its bot-created pull request does not trigger the normal PR workflow, so it explicitly dispatches CI on that branch. A failed sync step needs manual attention in the workflow log. It does not indicate that the current release has stopped working.

To update locally on a clean branch:

```sh
pnpm port sync vX.Y.Z
pnpm install --no-frozen-lockfile
pnpm port report
pnpm check:port
pnpm build
pnpm typecheck
pnpm test
pnpm test:integration
node tools/ci/packed-consumer.mjs
```

Review each changed handwritten source listed by `report` against its upstream counterpart. Classify new upstream source in `tools/port/config.mjs`. Fix stale test rewrites there and keep their reasons specific. Change replacement pages in `tools/port/overlay`, then regenerate. Update the README API table when an observable difference changes. Review the upstream snapshot diff as well as generated output before merging.

The packed consumer checks SSR and Markdown frontmatter, hydrates native Preact hooks, and observes session changes through `auth.useSession()` imported from `void/client` in dev and preview. Its session endpoint is intercepted by Playwright. This proves the React auth client integration with Preact; it does not test an identity provider or a production login backend. In dev, it also edits a page and checks that HMR preserves hook state without reloading the document.

## Releasing

Keep the package's version independent of Void's exact peer version. Increment `packages/preact/package.json` using semver, update the lockfile with `pnpm install --no-frozen-lockfile`, and describe the change in the GitHub release notes. Before publishing, run the update checks above on the final commit and require CI to pass.

```sh
pnpm --filter void-preact pack --pack-destination /tmp
```

Packing rebuilds the package, checks that each public export has its runtime and declaration files, and includes the root README and license. Inspect the resulting archive with `tar -tzf /tmp/void-preact-VERSION.tgz`. It must contain `package/dist`, `package/package.json`, `package/README.md`, and `package/LICENSE`, without workspace tests or React stubs.

An npm account with publishing rights to `void-preact` must publish the verified archive. Check name ownership before the first release. Publishing is a separate operator action:

```sh
npm publish /tmp/void-preact-VERSION.tgz --access public
```

Create a matching `vVERSION` Git tag and GitHub release from the verified commit after publication. Record the supported Void version and compatibility changes in its notes. If a published version is faulty, deprecate it and publish a corrected patch; do not reuse its version number.
