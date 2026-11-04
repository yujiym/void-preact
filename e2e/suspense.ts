import assert from 'node:assert/strict';
import type { Page, Route } from 'playwright';
import type { ComparisonCase, ComparisonContext } from './types.ts';

const sourceContracts = [
  'test/pages-client-contract.ts',
  'packages/preact/test/integration/preact-pages-client.test.ts',
];

async function open(page: Page, base: string, path = '/suspense') {
  const response = await page.goto(new URL(path, base).href);
  assert.ok(response);
  assert.equal(response.status(), 200);
  await page.locator('#app[data-hydrated="true"]').waitFor();
}

async function text(page: Page, id: string, expected: string) {
  await page.waitForFunction(({ id, expected }) =>
    document.querySelector(`[data-testid="${id}"]`)?.textContent?.trim() === expected,
  { id, expected });
  assert.equal((await page.getByTestId(id).textContent())?.trim(), expected);
}

async function gates(page: Page, labels: string[]) {
  const active = new Set<Promise<void>>();
  const pending = new Map(labels.map((label) => {
    const { promise: held, resolve: release } = Promise.withResolvers<void>();
    const { promise: requested, resolve: started } = Promise.withResolvers<void>();
    return [label, { release, started, held, requested }];
  }));
  const handler = async (route: Route) => {
    const resource = new URL(route.request().url()).searchParams.get('resource');
    assert.ok(resource);
    const gate = pending.get(resource);
    assert.ok(gate, 'every resource request must have a gate');
    const completion = (async () => {
      gate.started();
      await gate.held;
      await route.continue();
    })();
    active.add(completion);
    try {
      await completion;
    } finally {
      active.delete(completion);
    }
  };
  await page.route('**/api/wait?resource=*', handler);
  return {
    async requested(...labels: string[]) {
      await Promise.all(labels.map((label) => {
        const gate = pending.get(label);
        assert.ok(gate, `resource ${label} must have a gate`);
        return gate.requested;
      }));
    },
    async release(label: string) {
      const finished = page.waitForEvent('requestfinished', {
        predicate: (request) => new URL(request.url()).searchParams.get('resource') === label,
      });
      const gate = pending.get(label);
      assert.ok(gate, `resource ${label} must have a gate`);
      gate.release();
      await finished;
    },
    async close() {
      for (const gate of pending.values()) gate.release();
      await Promise.all(active);
      await page.unroute('**/api/wait?resource=*', handler);
    },
  };
}

async function rootRecovery({ page, base, adapter }: ComparisonContext, observeLayout = false) {
  await open(page, base, '/');
  await page.evaluate(() => { window.__suspenseDocument = 'preserved'; });
  if (observeLayout) {
    await page.getByTestId('layout-increment').click();
    await text(page, 'layout-count', '1');
  }
  await page.getByTestId('nav-root-suspend').click();
  await text(page, 'root-idle', 'Ready to suspend the root');
  const held = await gates(page, ['root-pending']);
  try {
    await page.getByTestId('suspend-root').click();
    await held.requested('root-pending');
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await page.goBack();
    await text(page, 'ssr-title', 'Comparison home');
    assert.equal(new URL(page.url()).pathname, '/');
    assert.equal(await page.evaluate(() => window.__suspenseDocument), 'preserved');
    await held.release('root-pending');
    await page.getByTestId('increment').click();
    await text(page, 'counter', '1');
    await text(page, 'ssr-title', 'Comparison home');
    assert.equal(await page.getByTestId('root-suspend-page').count(), 0);
    assert.equal(await page.getByTestId('root-value').count(), 0);
    const result = { navigation: '/', recoveredWhilePending: true, documentPreserved: true, counter: 1, staleContent: false };
    if (observeLayout) {
      const expected = adapter === 'react' ? '1' : '0';
      await text(page, 'layout-count', expected);
      return { ...result, layoutCount: Number(expected) };
    }
    return result;
  } finally {
    await held.close();
  }
}

export const cases: ComparisonCase[] = [
  {
    id: 'suspense-root-history-cancellation',
    title: 'History navigation recovers while the adapter root boundary is suspended',
    expectation: 'equivalent',
    sourceContracts: [...sourceContracts, 'packages/preact/src/runtime/settled-suspense.ts'],
    covers: ['adapter root Suspense', 'root pending navigation', 'root stale completion', 'history document preservation'],
    run: (context) => rootRecovery(context),
  },
  {
    id: 'suspense-root-cancellation-layout-state',
    title: 'Cancelling root suspension differs in shared layout state retention',
    expectation: 'different',
    reason: 'Preact replaces only a parked root boundary to recover navigation, resetting its layout state; React retains the layout state. Normal navigation preserves layout state in both.',
    sourceContracts: [...sourceContracts, 'packages/preact/src/runtime/settled-suspense.ts'],
    covers: ['root cancellation layout state'],
    run: (context) => rootRecovery(context, true),
  },
  {
    id: 'suspense-first-and-repeat',
    title: 'A boundary shows fallback and recovers across successive resources',
    expectation: 'equivalent',
    sourceContracts,
    covers: ['Suspense first suspension', 'Suspense repeated suspension', 'use promise resolution'],
    async run({ page, base }) {
      await open(page, base);
      const held = await gates(page, ['single-1', 'single-2']);
      try {
        for (const label of ['single-1', 'single-2']) {
          await page.getByTestId('suspend-single').click();
          await held.requested(label);
          await text(page, 'single-loading', 'Loading resource');
          assert.equal(await page.getByTestId('single-value').filter({ visible: true }).count(), 0);
          await held.release(label);
          await text(page, 'single-value', label);
          assert.equal(await page.getByTestId('single-value').getAttribute('data-resource'), label);
          assert.equal(await page.getByTestId('single-loading').count(), 0);
        }
        return { firstFallback: true, firstValue: 'single-1', repeatFallback: true, finalValue: 'single-2', staleFallback: false };
      } finally {
        await held.close();
      }
    },
  },
  {
    id: 'suspense-nested-independent-progress',
    title: 'Nested boundaries reveal resolved children while a sibling stays pending',
    expectation: 'equivalent',
    sourceContracts,
    covers: ['Suspense nested boundaries', 'Suspense independent progress'],
    async run({ page, base }) {
      await open(page, base);
      const held = await gates(page, ['outer', 'left', 'right']);
      try {
        await page.getByTestId('suspend-nested').click();
        await held.requested('outer', 'left', 'right');
        await text(page, 'outer-loading', 'Loading outer');
        await held.release('outer');
        await text(page, 'left-loading', 'Loading left');
        await text(page, 'right-loading', 'Loading right');
        assert.equal(await page.getByTestId('outer-loading').count(), 0);
        await held.release('left');
        await text(page, 'left-value', 'left');
        await text(page, 'right-loading', 'Loading right');
        assert.equal(await page.getByTestId('left-loading').count(), 0);
        await held.release('right');
        await text(page, 'right-value', 'right');
        await text(page, 'left-value', 'left');
        assert.equal(await page.getByTestId('right-loading').count(), 0);
        return { outerResolved: true, leftProgressWhileRightPending: true, finalValues: ['left', 'right'], staleFallback: false };
      } finally {
        await held.close();
      }
    },
  },
  {
    id: 'suspense-unmount-pending',
    title: 'Navigating away from a pending boundary ignores its eventual completion',
    expectation: 'equivalent',
    sourceContracts,
    covers: ['Suspense pending unmount', 'Suspense stale completion', 'client navigation'],
    async run({ page, base }) {
      await open(page, base);
      await page.evaluate(() => { window.__suspenseDocument = 'preserved'; });
      const held = await gates(page, ['single-1']);
      try {
        await page.getByTestId('suspend-single').click();
        await held.requested('single-1');
        await text(page, 'single-loading', 'Loading resource');
        await page.getByTestId('nav-home').click();
        await text(page, 'ssr-title', 'Comparison home');
        await held.release('single-1');
        await page.getByTestId('increment').click();
        await text(page, 'counter', '1');
        await text(page, 'ssr-title', 'Comparison home');
        assert.equal(new URL(page.url()).pathname, '/');
        assert.equal(await page.getByTestId('suspense-page').count(), 0);
        assert.equal(await page.getByTestId('single-value').count(), 0);
        assert.equal(await page.evaluate(() => window.__suspenseDocument), 'preserved');
        return { navigation: '/', documentPreserved: true, counter: 1, staleContent: false };
      } finally {
        await held.close();
      }
    },
  },
  {
    id: 'suspense-server-hydration-dom',
    expectedRecoverableErrors: { react: ['The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering.', 'Minified React error #419; visit https://react.dev/errors/419 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.'] },
    recoveryReason: 'Void sends the deferred shell without the remainder of the React Suspense stream; React reports recovery while the deferred UI resolves.',
    title: 'Server rendered boundaries hydrate with stable IDs and DOM attributes',
    expectation: 'equivalent',
    sourceContracts,
    covers: ['Suspense SSR', 'Suspense hydration', 'useId hydration', 'DOM attributes'],
    async run({ page, base }) {
      const response = await page.goto(new URL('/suspense', base).href);
      assert.ok(response);
      assert.equal(response.status(), 200);
      const html = await response.text();
      const server = await page.evaluate((html) => {
        const document = new DOMParser().parseFromString(html, 'text/html');
        const title = document.querySelector<HTMLElement>('[data-testid="suspense-title"]');
        const section = document.querySelector('[data-testid="suspense-page"]');
        return {
          id: title?.id,
          labelledBy: section?.getAttribute('aria-labelledby'),
          state: section?.getAttribute('data-state'),
          idle: document.querySelector('[data-testid="single-idle"]')?.textContent,
        };
      }, html);
      assert.ok(server.id);
      assert.equal(server.labelledBy, server.id);
      assert.equal(server.state, 'ready');
      assert.equal(server.idle, 'Ready to load');
      const serverId = server.id;
      await page.locator('#app[data-hydrated="true"]').waitFor();
      await page.waitForFunction(() => {
        const title = document.querySelector<HTMLElement>('[data-testid="suspense-title"]');
        return title?.id && title.dataset.clientId === title.id;
      });
      assert.equal(await page.getByTestId('suspense-title').getAttribute('id'), serverId);
      assert.equal(await page.getByTestId('suspense-page').getAttribute('aria-labelledby'), serverId);
      assert.equal(await page.getByTestId('suspense-page').getAttribute('data-state'), 'ready');
      await text(page, 'single-idle', 'Ready to load');
      await open(page, base, '/deferred');
      await text(page, 'deferred-value', 'Deferred ready');
      await page.waitForFunction(() => {
        const title = document.querySelector<HTMLElement>('[data-testid="deferred-title"]');
        return title?.id && title.dataset.clientId === title.id;
      });
      assert.equal(await page.getByTestId('deferred-loading').count(), 0);
      return { serverDOM: true, hydratedDOM: true, matchingId: true, attributesPreserved: true, deferredValue: 'Deferred ready', staleFallback: false };
    },
  },
];
