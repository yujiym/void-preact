# API differences from `@void/react`

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
