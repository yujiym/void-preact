import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const clientContract = 'test/pages-client-contract.ts';
const islandContract = 'test/pages-island-contract.ts';
const clientIntegration = 'packages/preact/test/integration/preact-pages-client.test.ts';

async function open(page, base, path) {
  const response = await page.goto(new URL(path, base).href);
  assert.equal(response.status(), 200);
  await page.locator('#app[data-hydrated="true"]').waitFor();
}

async function hasText(page, id, value) {
  await page.waitForFunction(({ id, value }) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    return element?.textContent?.trim() === value;
  }, { id, value });
  assert.equal((await page.getByTestId(id).textContent()).trim(), value);
}

async function whileRequestHeld(page, trigger, observe) {
  let release;
  let intercepted;
  const held = new Promise((resolve) => { release = resolve; });
  const started = new Promise((resolve) => { intercepted = resolve; });
  const handlers = [];
  const handler = (route) => {
    const completed = (async () => {
      intercepted();
      await held;
      await route.continue();
    })();
    handlers.push(completed);
    return completed;
  };
  await page.route('**/api/wait', handler);
  const requested = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/wait');
  try {
    await trigger();
    await requested;
    await started;
    return await observe();
  } finally {
    release();
    await Promise.all(handlers);
    await page.unroute('**/api/wait', handler);
  }
}

export const cases = [
  {
    id: 'ssr-without-javascript',
    title: 'Server HTML exposes loader data without executing JavaScript',
    expectation: 'equivalent',
    sourceContracts: [clientContract],
    covers: ['SSR', 'loader'],
    async run({ request, base }) {
      const response = await request.get(new URL('/', base).href);
      assert.equal(response.status(), 200);
      const html = await response.text();
      assert.match(html, /data-testid="ssr-title"[^>]*>Comparison home</);
      assert.match(html, /data-testid="counter"[^>]*>0</);
      assert.match(html, /__VOID_PAGE_DATA__/);
      return { status: response.status(), heading: 'Comparison home', counter: 0, pageData: true };
    },
  },
  {
    id: 'hydrate-interact',
    title: 'Hydrated page handles counter updates',
    expectation: 'equivalent',
    sourceContracts: [clientIntegration],
    covers: ['hydration'],
    async run({ page, base }) {
      await open(page, base, '/');
      await hasText(page, 'ssr-title', 'Comparison home');
      await hasText(page, 'counter', '0');
      await page.getByTestId('increment').click();
      await hasText(page, 'counter', '1');
      return { heading: 'Comparison home', counter: 1 };
    },
  },
  {
    id: 'navigation-history-layout',
    title: 'Client navigation and history preserve the document and layout state',
    expectation: 'equivalent',
    sourceContracts: [clientContract, clientIntegration],
    covers: ['Link', 'useParams', 'useRouter', 'useShared', 'useNavigation'],
    async run({ page, base }) {
      await open(page, base, '/');
      await page.evaluate(() => { window.__comparisonDocument = 'same document'; });
      await page.getByTestId('layout-increment').click();
      await hasText(page, 'layout-count', '1');
      await page.getByTestId('nav-detail').click();
      await hasText(page, 'item-id', 'one');
      await hasText(page, 'shared-app', 'Comparison');
      await hasText(page, 'navigation-state', 'idle');
      const refreshed = page.waitForResponse((response) => new URL(response.url()).pathname === '/items/one');
      await page.getByTestId('router-refresh').click();
      assert.equal((await refreshed).status(), 200);
      await hasText(page, 'navigation-state', 'idle');
      await hasText(page, 'item-id', 'one');
      await hasText(page, 'layout-count', '1');
      await page.getByTestId('nav-home').click();
      await hasText(page, 'ssr-title', 'Comparison home');
      await page.goBack();
      await hasText(page, 'item-id', 'one');
      await page.goForward();
      await hasText(page, 'ssr-title', 'Comparison home');
      await hasText(page, 'layout-count', '1');
      assert.equal(await page.evaluate(() => window.__comparisonDocument), 'same document');
      await open(page, base, '/items/one?view=details');
      await hasText(page, 'item-query', 'details');
      return { item: 'one', query: 'details', shared: 'Comparison', history: true, layoutPreserved: true, documentPreserved: true };
    },
  },
  {
    id: 'form-validation-success-reset',
    title: 'Void form validates, persists a successful action, and resets initial values',
    expectation: 'equivalent',
    sourceContracts: [clientContract, 'packages/preact/test/unit/use-form.test.ts'],
    covers: ['useForm', 'Form'],
    async run({ page, base }) {
      await open(page, base, '/forms');
      await hasText(page, 'saved-count', '0');
      await page.getByTestId('form-submit').click();
      await hasText(page, 'form-error', 'Name required');
      await hasText(page, 'form-success', 'false');
      await page.locator('#name').fill('Saved name');
      await page.getByTestId('form-submit').click();
      await hasText(page, 'form-success', 'true');
      await hasText(page, 'form-pending', 'false');
      await hasText(page, 'saved-count', '1');
      await page.getByTestId('form-reset').click();
      await page.waitForFunction(() => document.querySelector('#name').value === '');
      await hasText(page, 'form-error', '');
      await page.reload();
      await page.locator('#app[data-hydrated="true"]').waitFor();
      await hasText(page, 'saved-count', '1');
      await hasText(page, 'form-value', 'Saved name');
      return { validation: 'Name required', successful: true, resetValue: '', savedCount: 1, persistedName: 'Saved name' };
    },
  },
  {
    id: 'two-independent-islands',
    title: 'Two server rendered islands hydrate and update independently',
    expectation: 'equivalent',
    sourceContracts: [islandContract],
    covers: ['islands'],
    async run({ page, request, base }) {
      const response = await request.get(new URL('/islands', base).href);
      assert.equal(response.status(), 200);
      const html = await response.text();
      assert.match(html, /Comparison islands/);
      assert.match(html, /data-testid="island-left"/);
      assert.match(html, /data-testid="island-right"/);
      assert.equal((await page.goto(new URL('/islands', base).href)).status(), 200);
      await page.waitForFunction(() => document.querySelectorAll('[data-island][data-hydrated="true"]').length === 2);
      await hasText(page, 'island-left', '0');
      await hasText(page, 'island-right', '0');
      await page.getByTestId('increment-left').click();
      await hasText(page, 'island-left', '1');
      await hasText(page, 'island-right', '0');
      await page.getByTestId('increment-right').click();
      await page.getByTestId('increment-right').click();
      await hasText(page, 'island-right', '2');
      await hasText(page, 'island-left', '1');
      return { serverRendered: true, hydratedIslands: 2, left: 1, right: 2 };
    },
  },
  {
    id: 'deferred-suspense-id',
    title: 'Explicit Suspense resolves deferred content with matching server and client IDs',
    expectation: 'equivalent',
    expectedRecoverableErrors: {
      react: ['The server could not finish this Suspense boundary, likely due to an error during server rendering. Switched to client rendering.', 'Minified React error #419; visit https://react.dev/errors/419 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.'],
    },
    recoveryReason: 'Upstream Void sends the deferred Suspense shell without completing the server boundary; React reports recovery when it resolves the boundary on the client.',
    sourceContracts: [clientContract, clientIntegration],
    covers: ['Suspense', 'use', 'useId', 'defer'],
    async run({ page, base }) {
      await open(page, base, '/deferred');
      await hasText(page, 'deferred-value', 'Deferred ready');
      await page.waitForFunction(() => {
        const title = document.querySelector('[data-testid="deferred-title"]');
        return title?.id && title.dataset.clientId === title.id;
      });
      assert.equal(await page.getByTestId('deferred-loading').count(), 0);
      return { value: 'Deferred ready', matchingId: true, staleFallback: false };
    },
  },
  {
    id: 'client-error-boundary-recovery',
    title: 'A client render error reaches the boundary and can recover',
    expectation: 'equivalent',
    allowedErrors: ['comparison boundary failure'],
    sourceContracts: [],
    covers: ['ErrorBoundary'],
    async run({ page, base }) {
      await open(page, base, '/errors');
      await page.getByTestId('throw-error').click();
      await hasText(page, 'boundary-error', 'comparison boundary failure');
      await page.getByTestId('reset-error').click();
      await page.getByTestId('throw-error').waitFor();
      assert.equal(await page.getByTestId('boundary-error').count(), 0);
      return { caught: 'comparison boundary failure', recovered: true };
    },
  },
  {
    id: 'server-loader-error',
    title: 'A failed server loader returns an error response',
    expectation: 'equivalent',
    sourceContracts: [],
    covers: ['loader', 'SSR errors'],
    async run({ request, base }) {
      const response = await request.get(new URL('/loader-error', base).href);
      assert.equal(response.status(), 503);
      assert.match(await response.text(), /Comparison loader failure/);
      return { status: 503, message: 'Comparison loader failure' };
    },
  },
  {
    id: 'real-auth-session',
    title: 'Signup, protected access, reload, signout and signin use a real session',
    expectation: 'equivalent',
    sourceContracts: [],
    covers: ['auth integration'],
    async run({ page, context, request, base }) {
      const profile = new URL('/api/profile', base).href;
      assert.equal((await request.get(profile)).status(), 401);
      await open(page, base, '/auth');
      await hasText(page, 'auth-user', 'signed out');
      const email = `comparison-${randomUUID()}@example.com`;
      const password = `Local-${randomUUID()}!`;
      await page.locator('#auth-name').fill('Comparison User');
      await page.locator('#auth-email').fill(email);
      await page.locator('#auth-password').fill(password);
      await page.getByTestId('sign-up').click();
      await hasText(page, 'auth-user', 'Comparison User');
      assert.ok((await context.cookies()).some((cookie) => cookie.httpOnly), 'signup must establish an HttpOnly session cookie');
      const signedIn = await request.get(profile);
      assert.equal(signedIn.status(), 200);
      const user = await signedIn.json();
      assert.equal(user.name, 'Comparison User');
      assert.ok(user.email === email, 'protected endpoint must identify the created account');
      await page.reload();
      await page.locator('#app[data-hydrated="true"]').waitFor();
      await hasText(page, 'server-user', 'Comparison User');
      await hasText(page, 'auth-user', 'Comparison User');
      await page.getByTestId('sign-out').click();
      await hasText(page, 'auth-user', 'signed out');
      assert.equal((await request.get(profile)).status(), 401);
      await page.locator('#auth-email').fill(email);
      await page.locator('#auth-password').fill(password);
      await page.getByTestId('sign-in').click();
      await hasText(page, 'auth-user', 'Comparison User');
      assert.equal((await request.get(profile)).status(), 200);
      return { signup: true, httpOnlySession: true, protectedAccess: true, serverReload: 'Comparison User', signedOutStatus: 401, signin: true };
    },
  },
  {
    id: 'native-action-uncontrolled-reset',
    title: 'Successful native form actions differ in uncontrolled input reset',
    expectation: 'different',
    reason: 'React resets an uncontrolled input after a successful form action; the Preact adapter retains its submitted value.',
    sourceContracts: [],
    covers: ['native form action', 'useFormStatus'],
    async run({ page, base, adapter }) {
      await open(page, base, '/differences');
      await page.locator('#uncontrolled').fill('Submitted value');
      const pending = await whileRequestHeld(page,
        () => page.getByTestId('native-submit').click(),
        async () => {
          await hasText(page, 'native-pending', 'true');
          return true;
        });
      await hasText(page, 'native-completed', '1');
      await hasText(page, 'native-pending', 'false');
      const expected = adapter === 'react' ? '' : 'Submitted value';
      await page.waitForFunction((expected) => document.querySelector('#uncontrolled').value === expected, expected);
      const value = await page.locator('#uncontrolled').inputValue();
      assert.equal(value, expected);
      return { inFlightPending: pending, completed: 1, value };
    },
  },
  {
    id: 'async-transition-pending',
    title: 'Async transitions differ in pending state while a request is held',
    expectation: 'different',
    reason: 'React keeps an async transition pending until its awaited request completes; Preact compatibility transitions do not track the async lifetime.',
    sourceContracts: [],
    covers: ['useTransition'],
    async run({ page, base, adapter }) {
      await open(page, base, '/differences');
      const expected = adapter === 'react';
      const pending = await whileRequestHeld(page,
        () => page.getByTestId('transition-start').click(),
        async () => {
          await hasText(page, 'transition-pending', String(expected));
          return (await page.getByTestId('transition-pending').textContent()).trim() === 'true';
        });
      await hasText(page, 'transition-completed', '1');
      await hasText(page, 'transition-pending', 'false');
      return { pendingWhileRequestHeld: pending, completed: 1, finalPending: false };
    },
  },
];
