import { act as preactAct } from 'preact/test-utils';

export * from 'preact/compat';
export { default } from 'preact/compat';

// Captured at load so act still finishes while a test has fake timers on.
const realSetTimeout = globalThis.setTimeout;

// React's async act waits for pending actions. Preact's returns after one flush, so wait a task.
export async function act(callback) {
  let result;
  await preactAct(async () => {
    result = await callback();
    await new Promise((resolve) => realSetTimeout(resolve));
  });
  return result;
}
