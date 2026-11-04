import preact from '@preact/preset-vite';
import type { Plugin, PluginOption } from 'vite';
import { resolvePagesDir } from 'void/pages';
import { islandsPlugin } from './plugin-islands.ts';
import { pagesPlugin, type PrefetchConfig } from './plugin-pages.ts';

export type VoidPreactOptions = Readonly<{
  preact?: Parameters<typeof preact>[0];
  viewTransitions?: boolean;
  prefetch?: PrefetchConfig;
}>;

export function voidPreact(options?: VoidPreactOptions): Array<PluginOption | Plugin> {
  const root = process.cwd();
  const pagesDir = resolvePagesDir(root);
  return [
    preact(options?.preact),
    pagesPlugin(pagesDir, {
      root,
      viewTransitions: options?.viewTransitions,
      prefetch: options?.prefetch,
    }),
    ...islandsPlugin(pagesDir, { root }),
  ];
}
