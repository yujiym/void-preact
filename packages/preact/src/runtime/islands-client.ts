import { h, hydrate, type ComponentChildren, type ComponentType } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { FrontmatterContext } from './context.ts';
import { SettledSuspense } from './settled-suspense.ts';

export function hydratePreactIsland(
  el: Element,
  mod: { default: ComponentType<Record<string, unknown>> } | ComponentType<Record<string, unknown>>,
  props: Record<string, unknown>,
  frontmatter: Record<string, unknown>,
): void {
  const Component = typeof mod === 'function' ? mod : mod.default;
  let island: ComponentChildren = h(Component, props);
  if (Object.keys(frontmatter).length > 0) {
    island = h(FrontmatterContext.Provider, { value: frontmatter }, island);
  }
  function HydratedIsland() {
    useLayoutEffect(() => SettledSuspense.whenSettled(() => el.setAttribute('data-hydrated', 'true')), []);
    return h(SettledSuspense, { fallback: null }, island);
  }
  hydrate(h(HydratedIsland, null), el);
}
