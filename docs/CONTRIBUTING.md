# Contributing

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

The [comparison app](../test/comparison/app) runs one shared app against real installed React and packed Preact, in dev and preview. Both apps are installed outside the workspace so React cannot resolve to the test stubs. `artifacts/comparison/report.md` records equivalent sampled behavior, observed differences, unsupported exports, and unverified scope. Passing the sampled matrix does not establish complete React equivalence. CI retains reports, diagnostics and the tested tarball for 90 days, keyed by commit SHA, and shows test totals in its summaries. Releases retain the reports, tarball and checksum as GitHub release assets.

## Repository layout

The layout mirrors [Void's monorepo](https://github.com/voidzero-dev/void), so upstream tests keep their relative imports and each file can be compared with its counterpart.

| Path | Void counterpart | Maintained by |
| --- | --- | --- |
| `packages/preact/src` | `packages/react/src` | The port tool or by hand, per file in `tools/port/config.ts` |
| `packages/preact/test/{unit,integration,fixtures}` | `packages/react/test` | The port tool |
| `packages/preact/test/preact` | None | Hand |
| `playground/preact-pages` | `playground/react-pages` | The port tool, with overlays in `tools/port/overlay` |
| `test/*.ts` | `test/*.ts` | The port tool |
| `test/comparison`, `test/fixtures` | None | Hand |
| `upstream` | Pinned snapshot of the paths above | `pnpm port sync` only |
| `tools`, `docs` | None | Hand |

This repo follows `packages/react` in Void. Change `tools/port/config.ts` or its overlays, then run `pnpm port generate`; generated files and `upstream/` are maintained by that tool. Run `pnpm port sync <tag>` for an upstream release. See [DESIGN.md](DESIGN.md) for the design, support conditions, update gates, and release procedure.
