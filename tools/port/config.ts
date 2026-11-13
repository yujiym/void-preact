export interface PortConfig {
  repo: string;
  snapshot: string[];
  rewrites: [string | RegExp, string][];
  generate: [string, string][];
  preserved: string[];
  sourceRewrites: [string | RegExp, string][];
  mechanical: string[];
  ported: string[];
  dropped: string[];
  testRewrites: { file: string; from: string; to: string; reason: string }[];
  divergences: { file: string; title: string; reason: string }[];
}

// Everything that says how this repo differs from packages/react lives here.
const config: PortConfig = {
  repo: 'https://github.com/voidzero-dev/void.git',

  // Copied verbatim into upstream/ at the pinned tag.
  snapshot: [
    'LICENSE',
    '.node-version',
    'packages/react',
    'playground/react-pages',
    'test/browser-helpers.ts',
    'test/integration-helpers.ts',
    'test/island-css-build.ts',
    'test/island-page-browser.ts',
    'test/pages-browser.ts',
    'test/pages-client-contract.ts',
    'test/pages-island-contract.ts',
    'test/private-pages-build.ts',
  ],

  // Applied in order to every generated file.
  rewrites: [
    ['@void/react', 'void-preact'],
    ['voidReact', 'voidPreact'],
    ['renderReactPage', 'renderPreactPage'],
    ['startReactPages', 'startPreactPages'],
    ['void-react:', 'void-preact:'],
    ['react-pages', 'preact-pages'],
    ['packages/react', 'packages/preact'],
  ],

  // upstream path prefix -> generated path prefix. Generated output is never edited by hand.
  generate: [
    ['test/', 'test/'],
    ['packages/react/test/', 'packages/preact/test/'],
    ['playground/react-pages/', 'playground/preact-pages/'],
  ],

  // Hand-owned paths inside generated roots. Ignored files are also preserved.
  preserved: ['test/preact/', 'test/comparison/', 'test/fixtures/', 'packages/preact/test/preact/'],

  // Upstream source files, by how this repo tracks them.
  // mechanical: must equal the upstream file after `sourceRewrites`. CI enforces it.
  // ported: hand-written. A change upstream is flagged for review on sync.
  sourceRewrites: [
    [/from 'react'/g, "from 'preact/hooks'"],
  ],
  mechanical: [
    'runtime/action.ts',
    'runtime/deferred-shell.ts',
    'runtime/page-streams.ts',
    'runtime/use-island-form.ts',
    'runtime/use-navigation.ts',
    'runtime/use-params.ts',
    'runtime/use-router.ts',
    'runtime/use-shared.ts',
  ],
  ported: [
    'index.ts',
    'plugin.ts',
    'plugin-islands.ts',
    'plugin-pages.ts',
    'runtime/context.ts',
    'runtime/form.tsx',
    'runtime/index.ts',
    'runtime/link.tsx',
    'runtime/PageErrorBoundary.tsx',
    'runtime/pages-client.ts',
    'runtime/pages-server.ts',
    'runtime/use-form.ts',
  ],

  // Paths under generate targets that this repo replaces from tools/port/overlay or drops.
  dropped: [],

  // Edits that keep an upstream assertion meaningful under Preact.
  // { file: generated path, from, to, reason }
  testRewrites: [
    {
      file: "packages/preact/test/unit/use-form.test.ts",
      from: "createElement(IslandApp)",
      to: "createElement(IslandApp, null)",
      reason: "Preact types require an explicit props argument for createElement.",
    },
    {
      file: "packages/preact/test/integration/md-layout-frontmatter.test.ts",
      from: "'../../../void/src/pages/serialize.ts'",
      to: "'void/pages-server'",
      reason: "This repo uses the published void package; upstream's monorepo source is outside it.",
    },
    {
      file: "packages/preact/test/integration/preact-pages-client.test.ts",
      from: "'../../../void/src/pages/serialize.ts'",
      to: "'void/pages-server'",
      reason: "This repo uses the published void package; upstream's monorepo source is outside it.",
    },
    {
      file: "packages/preact/test/integration/preact-pages-client.test.ts",
      from: "import { PAGES_PROTOCOL_VERSION } from '../../../edge/src/pages-protocol.ts';",
      to: "const PAGES_PROTOCOL_VERSION = '2';",
      reason: "PAGES_PROTOCOL_VERSION is only exported by the transitive @void/edge. A protocol bump fails these tests, which is the signal to update this value.",
    },
    {
      file: "packages/preact/test/integration/preact-pages-navigation-fallback.test.ts",
      from: "import { PAGES_PROTOCOL_VERSION } from '../../../edge/src/pages-protocol.ts';",
      to: "const PAGES_PROTOCOL_VERSION = '2';",
      reason: "PAGES_PROTOCOL_VERSION is only exported by the transitive @void/edge. A protocol bump fails these tests, which is the signal to update this value.",
    },
    {
      file: "test/pages-client-contract.ts",
      from: "'../packages/void/src/pages/serialize.ts'",
      to: "'../packages/preact/node_modules/void/dist/pages/serialize.mjs'",
      reason: "This repo uses the published void package; upstream's monorepo source is outside it.",
    },
    {
      file: "test/pages-client-contract.ts",
      from: "import { PAGES_PROTOCOL_VERSION } from '../packages/edge/src/pages-protocol.ts';",
      to: "const PAGES_PROTOCOL_VERSION = '2';",
      reason: "PAGES_PROTOCOL_VERSION is only exported by the transitive @void/edge. A protocol bump fails these tests, which is the signal to update this value.",
    },
    {
      file: "packages/preact/test/unit/plugin-pages.test.ts",
      from: "it('serves the workspace-linked void as source instead of pre-bundling it', async () => {\n    // This repository links void from packages/void, so a pre-bundled copy would\n    // outlive the next void build.\n",
      to: "it('pre-bundles void when it is installed from node_modules', async () => {\n",
      reason: "This repo installs void from npm, so the installed branch is the one it can exercise.",
    },
    {
      file: "packages/preact/test/unit/plugin-pages.test.ts",
      from: "expect(config.optimizeDeps.include).not.toContain('void/pages-client');\n    expect(config.optimizeDeps.include).not.toContain('void/pages-prefetch');\n    expect(config.environments.void_worker.optimizeDeps.include).not.toContain('void/live/client');",
      to: "expect(config.optimizeDeps.include).toContain('void/pages-client');\n    expect(config.optimizeDeps.include).toContain('void/pages-prefetch');\n    expect(config.environments.void_worker.optimizeDeps.include).toContain('void/live/client');",
      reason: "This repo installs void from npm, so the installed branch is the one it can exercise.",
    },
    {
      file: "packages/preact/test/unit/use-form.test.ts",
      from: "createElement(App)",
      to: "createElement(App, null)",
      reason: "Preact types require an explicit props argument for createElement.",
    },
    {
      file: "test/island-page-browser.ts",
      from: "alias?: Record<string, string>",
      to: "alias?: import('vite').AliasOptions",
      reason: "The Preact Markdown fixture resolves both the public runtime and island bootstrap with regex aliases.",
    },
    {
      file: "packages/preact/test/integration/md-layout-frontmatter.test.ts",
      from: "/// <reference path=\"../../../md/src/env.d.ts\" />",
      to: "",
      reason: "The published Markdown plugin provides its declarations; its source is outside this repository.",
    },
    {
      file: "packages/preact/test/unit/use-form.test.ts",
      from: "        { onCaughtError },\n",
      to: "",
      reason: "Preact has no onCaughtError root callback.",
    },
    {
      file: "packages/preact/test/unit/use-form.test.ts",
      from: "      const onCaughtError = vi.fn();\n",
      to: "",
      reason: "Preact has no onCaughtError root callback.",
    },
    {
      file: "packages/preact/test/unit/use-form.test.ts",
      from: "createRoot(container, options)",
      to: "createRoot(container)",
      reason: "Preact createRoot accepts only the container.",
    },
    {
      file: "packages/preact/test/unit/use-form.test.ts",
      from: ", options?: RootOptions",
      to: "",
      reason: "Preact has no React root options.",
    },
    {
      file: "packages/preact/test/unit/use-form.test.ts",
      from: "import { createRoot, type Root, type RootOptions } from 'react-dom/client';",
      to: "import { createRoot, type Root } from 'react-dom/client';",
      reason: "Preact has no React root options; the boundary behavior remains tested.",
    },
    {
      file: 'packages/preact/test/integration/preact-pages-client.test.ts',
      from: "it.for(['transition', 'form-action', 'action-state', 'plain'] as const)",
      to: "it.for(['form-action', 'plain'] as const)",
      reason: 'Preact transitions have no pending state, and useActionState is unavailable. The overlay covers the remaining cases.',
    },
    {
      file: 'packages/preact/test/integration/preact-pages-client.test.ts',
      from: "const cases = ['transition', 'form-action', 'action-state', 'plain', 'use-form'] as const;",
      to: "const cases = ['form-action', 'plain', 'use-form'] as const;",
      reason: 'Preact transitions have no pending state, and useActionState is unavailable. The overlay covers the remaining cases.',
    },
    {
      file: 'packages/preact/test/integration/preact-pages-client.test.ts',
      from: "it.for(['action', 'visit', 'refresh'] as const)(\n      '%s preserves optimistic",
      to: "it.skip.for(['action', 'visit', 'refresh'] as const)(\n      '%s preserves optimistic",
      reason: 'Asserts useOptimistic and a held old page during a transition. Preact has neither.',
    },
    {
      file: 'packages/preact/test/integration/md-layout-frontmatter.test.ts',
      from: "{ name: 'void-preact:pages' }",
      to: "{ name: 'void-react:pages' }",
      reason: 'The test stands in for the adapter plugin. @void/md only recognizes the React name.',
    },
    {
      file: 'packages/preact/test/integration/md-layout-frontmatter.test.ts',
      from: "{ 'void-preact': join(import.meta.dirname, '../../src/runtime/index.ts') }",
      to: "[{ find: /^void-preact\\/islands-client$/, replacement: join(import.meta.dirname, '../../src/runtime/islands-client.ts') }, { find: /^(void-preact|@void\\/react)$/, replacement: join(import.meta.dirname, '../../src/runtime/index.ts') }]",
      reason: 'This test imports adapter source. The island bootstrap must also resolve to source so Markdown and islands share their frontmatter context.',
    },
    {
      file: 'test/island-css-build.ts',
      from: "'../packages/md/dist/plugin.mjs'",
      to: "'./fixtures/md-host/node_modules/@void/md/dist/plugin.mjs'",
      reason: 'This repo uses the published @void/md.',
    },
    {
      file: 'packages/preact/test/integration/md-layout-frontmatter.test.ts',
      from: "'../../../md/src/plugin.ts'",
      to: "'../../../../test/fixtures/md-host/node_modules/@void/md/dist/plugin.mjs'",
      reason: 'This repo uses the published @void/md.',
    },
    {
      file: 'packages/preact/test/unit/use-form.test.ts',
      from: 'expect(onCaughtError).toHaveBeenCalledWith(failure, expect.anything());',
      to: '',
      reason: 'onCaughtError is a React root option. The test still asserts the boundary renders.',
    },
    {
      file: 'packages/preact/test/unit/use-form.test.ts',
      from: '      expect(onCaughtError).not.toHaveBeenCalled();\n',
      to: '',
      reason: 'onCaughtError is a React root option. The test still asserts the form, not the boundary, renders.',
    },
    {
      file: 'packages/preact/test/integration/preact-pages-navigation-fallback.test.ts',
      from: "it.each([\n  { method: 'POST', fallback: true },",
      to: "it.skip.each([\n  { method: 'POST', fallback: true },",
      reason: 'Skips the it.each table that divergences cannot name. It holds navigation loading inside an async React.startTransition; preact/compat runs startTransition synchronously, so Preact has no pending action to wait for.',
    },
    {
      file: 'playground/preact-pages/pages/users/index.tsx',
      from: "from 'react-dom'",
      to: "from 'void-preact'",
      reason: 'preact/compat has no useFormStatus. void-preact provides it.',
    },
    {
      file: 'playground/preact-pages/pages/action-error.tsx',
      from: "from 'react-dom'",
      to: "from 'void-preact'",
      reason: 'preact/compat has no useFormStatus. void-preact provides it.',
    },
    {
      file: 'packages/preact/test/unit/link.test.ts',
      from: 'data-void-active=""',
      to: 'data-void-active',
      reason: 'preact-render-to-string writes an empty attribute as a bare name. The DOM is the same.',
    },
    {
      file: 'packages/preact/test/unit/link.test.ts',
      from: 'data-void-pending=""',
      to: 'data-void-pending',
      reason: 'preact-render-to-string writes an empty attribute as a bare name. The DOM is the same.',
    },
  ],

  // Upstream tests this adapter skips, each with its reason. A title that disappears upstream
  // fails generation, so this list cannot go stale.
  // { file: generated path, title: exact test title, reason }
  divergences: [
    {
      file: 'packages/preact/test/integration/preact-pages-client.test.ts',
      title: 'dev: client-only shells retain the React preamble and mount loader props',
      reason: 'Asserts the React Refresh preamble. Prefresh needs none.',
    },
    {
      file: 'packages/preact/test/unit/plugin-pages.test.ts',
      title: 'pre-optimizes page dependencies in the client and Cloudflare worker environments',
      reason: 'Asserts the React dependency list. test/preact/plugin-pages.test.ts covers the Preact list.',
    },
    {
      file: 'packages/preact/test/unit/plugin-pages.test.ts',
      title: 'includes only the React entry points needed by each environment',
      reason: 'Preact has no client-only renderer entry. test/preact/plugin-pages.test.ts covers the Preact list.',
    },
    {
      file: 'packages/preact/test/unit/plugin-pages.test.ts',
      title: 'scans for dev when pages/ is created after the serve config',
      reason: 'Asserts the React Refresh preamble. Prefresh needs none. test/preact/plugin-pages.test.ts covers the scan.',
    },
  ],
};

export default config;
