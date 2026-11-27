import preact from '@preact/preset-vite';
import type { Plugin, PluginOption } from 'vite';
import { resolvePagesDir } from 'void/pages';
import { islandsPlugin } from './plugin-islands.ts';
import { pagesPlugin } from './plugin-pages.ts';
import type { PrefetchConfig } from './plugin-pages.ts';

export type VoidPreactOptions = Readonly<{
  preact?: Parameters<typeof preact>[0];
  viewTransitions?: boolean;
  prefetch?: PrefetchConfig;
  deployRecovery?: boolean;
}>;

/**
 * Void core and @void/md pick their adapter code from a fixed list of plugin names, and neither
 * lists Preact. Answering to the React name selects code that imports react and @void/react, and
 * both of those resolve to Preact here.
 */
function reactAdapterMarker(): Plugin {
  return {
    name: 'void-react:pages',
    config() {
      return { resolve: { alias: [{ find: /^@void\/react$/, replacement: 'void-preact' }] } };
    },
  };
}

export function voidPreact(options?: VoidPreactOptions): Array<PluginOption | Plugin> {
  const root = process.cwd();
  const pagesDir = resolvePagesDir(root);
  return [
<<<<<<< void-preact
    preact(options?.preact),
    pagesPlugin(pagesDir, {
      root,
      viewTransitions: options?.viewTransitions,
      prefetch: options?.prefetch,
    }),
=======
    ...react(options?.react),
    // Spread so adapter options the pages plugin owns reach it without per-option glue.
    pagesPlugin(pagesDir, { ...options, root }),
>>>>>>> new upstream
    ...islandsPlugin(pagesDir, { root }),
    reactAdapterMarker(),
  ];
}
