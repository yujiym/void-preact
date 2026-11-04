import { Fragment, h, type ComponentType, type VNode } from 'preact';
import { Suspense } from 'preact/compat';
import { renderToReadableStream } from 'preact-render-to-string/stream';
import { createSsrRouter, idleNavigationState } from 'void/pages-client';
import { renderBodyAttrs, renderHeadToString, renderHtmlAttrs } from 'void/pages-head';
import type { PageObject } from 'void/pages-protocol';
import { serializePageData } from 'void/pages-server';
import {
  ErrorsContext,
  NavigationContext,
  ParamsContext,
  RouterContext,
  SharedContext,
} from './context.ts';
import { DEFERRED_SHELL_END_ID } from './deferred-shell.ts';
import { concatStreams, readDeferredShell } from './page-streams.ts';

// oxlint-disable-next-line no-explicit-any -- component props are narrowed by generated route types
type ComponentModule = { default: ComponentType<any> };

export type PreactPagesServerConfig = Readonly<{
  pageObj: PageObject;
  assetTags: { css: string; preloads: string; body: string };
  components: Record<string, () => Promise<ComponentModule>>;
  layoutTree: Record<string, Array<string>>;
  requestUrl?: string;
  preambleScript?: string;
}>;

function createPendingDeferred(): Promise<never> {
  return new Promise(() => {});
}

function propsForRender(pageObj: PageObject): Record<string, unknown> {
  if (!pageObj.deferredKeys) {
    return pageObj.props;
  }
  const props = { ...pageObj.props };
  for (const key of Object.keys(pageObj.deferredKeys)) {
    props[key] = createPendingDeferred();
  }
  return props;
}

function textStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

/**
 * The renderer writes the whole shell as its first chunk, or errors the stream. Await it so a
 * render error rejects here and the caller can serve its error page.
 */
async function readShell(stream: ReadableStream<Uint8Array>): Promise<ReadableStream<Uint8Array>> {
  const reader = stream.getReader();
  const first = await reader.read();
  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        if (first.done) {
          controller.close();
        } else {
          controller.enqueue(first.value);
        }
      },
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    },
    { highWaterMark: 0 },
  );
}

export async function renderPreactPage({
  pageObj,
  assetTags,
  components,
  layoutTree,
  requestUrl,
  preambleScript = '',
}: PreactPagesServerConfig): Promise<ReadableStream<Uint8Array>> {
  const PageComponent = (await components[pageObj.component]()).default;
  const layoutIds = layoutTree[pageObj.component] || [];
  const layoutComponents = await Promise.all(
    layoutIds.map(async (id) => (await components[id]()).default),
  );
  const renderProps = propsForRender(pageObj);

  let element: VNode<any> = h(PageComponent, renderProps);
  for (let i = layoutComponents.length - 1; i >= 0; i--) {
    element = h(layoutComponents[i], null, element);
  }

  element = h(
    RouterContext.Provider,
    { value: createSsrRouter(pageObj.url || '/', pageObj.params ?? {}, requestUrl) },
    h(
      NavigationContext.Provider,
      { value: idleNavigationState() },
      h(
        Suspense,
        { fallback: null },
        h(
          SharedContext.Provider,
          { value: pageObj.shared || {} },
          h(
            ParamsContext.Provider,
            { value: pageObj.params ?? {} },
            h(ErrorsContext.Provider, { value: pageObj.errors || {} }, element),
          ),
        ),
      ),
    ),
  );

  const renderElement = pageObj.deferredKeys
    ? h(Fragment, null, element, h('template', { id: DEFERRED_SHELL_END_ID }))
    : element;

  const renderStream = renderToReadableStream(renderElement);
  // The first read reports a render error. allReady rejects with the same error.
  renderStream.allReady.catch(() => {});
  const appStream = await readShell(renderStream);
  const renderedAppStream = pageObj.deferredKeys ? readDeferredShell(appStream) : appStream;
  const pageData = serializePageData(pageObj);
  const headHtml = pageObj.head ? renderHeadToString(pageObj.head) : '';
  const htmlAttrs = pageObj.head ? renderHtmlAttrs(pageObj.head) : '';
  const bodyAttrs = pageObj.head ? renderBodyAttrs(pageObj.head) : '';

  return concatStreams([
    textStream(`<!doctype html>
<html${htmlAttrs}>
<head>${headHtml}${preambleScript}${assetTags.css}${assetTags.preloads}</head>
<body${bodyAttrs}>
  <script id="__VOID_PAGE_DATA__" type="application/json">${pageData}</script>
  <div id="app">`),
    renderedAppStream,
    textStream(`</div>
  ${assetTags.body}
</body>
</html>`),
  ]);
}
