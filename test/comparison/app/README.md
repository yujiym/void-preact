# Comparing Void adapters

Run `pnpm test:comparison` from the repository root. It creates two independent applications outside the workspace, runs the same browser scenarios against real React and packed Preact in dev and preview, and writes `artifacts/comparison/report.md` plus JSON evidence.

The printed temporary directory contains `react` and `preact`. Open either directory and run `pnpm dev` to explore its pages. These apps have separate dependencies and local auth databases. Install/build them through the comparison command so repository React stubs cannot affect the baseline.

`test/comparison/app/` is the canonical source. Pages cover SSR, navigation/history, forms, islands, deferred data, error recovery, local email authentication and Suspense lifecycle behavior. The differences page demonstrates uncontrolled form reset and async transition pending state.

Equivalent results apply only to the named assertions and recorded versions. Known differences remain visible. Missing evidence and unexpected errors fail the gate. Read `docs/DESIGN.md` for the support contract and update procedure.
