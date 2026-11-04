# void-preact implementation plan

Ship a Preact adapter for Void that follows `@void/react` at every Void release. Design and tradeoffs are in [docs/design.md](../../design.md). A box is checked only when its evidence exists.

## Scaffold and parity tooling

- [x] Pin upstream v1.6.1 in `upstream/` and `upstream.json`.
- [x] Mirror the upstream tree with `packages/preact`, `test/`, and `playground/preact-pages`.
- [x] Generate tests and the playground with `tools/port/run.mjs`. `pnpm check:port` passes.
- [x] Compare the exported API with upstream. `test/preact/api-surface.test.ts` passes.

## Runtime port

- [x] Port navigation without transitions.
- [x] Provide function form actions and `useFormStatus` in `runtime/form-action.tsx`.
- [x] Replace `useActionState` in `useForm`.
- [x] Port server rendering and the deferred shell to the `preact-render-to-string` stream.
- [x] Port islands.
- [x] Support `@void/md` and the auth client path through the plugin-name marker. The published tarball renders Markdown and `useFrontmatter` in `vite dev` and `vite preview`.

## CI

- [x] Add `ci.yml` and `upstream-sync.yml`.
- [ ] See `ci.yml` pass on GitHub. The local runs of the same scripts pass.
- [ ] Run `upstream-sync.yml` once by dispatch. Requires "Allow GitHub Actions to create pull requests" in the repo settings.

## Remaining before a first release

- [ ] Add a Preact page for the `plain` and `use-form` cases of the skipped `React action completion` tests. They do not depend on React Actions, but `transition-await` cannot build without `useActionState`.
- [ ] Verify HMR with Prefresh by hand in a real app. The upstream island HMR contract passes, and the React Refresh preamble test is skipped.
- [ ] Verify the auth client path through the marker with a real auth setup.
- [ ] Measure client bundle size against `@void/react` on the same app.
- [ ] Report the Preact hydration behavior behind `discardRange` upstream, and propose an adapter registry to Void. Both are drafts for the operator to post.
- [ ] Decide the repo's visibility and publish to npm. Both are the operator's call.
