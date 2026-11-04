import { act as preactAct } from 'preact/test-utils';

export * from 'preact/compat';
export { default } from 'preact/compat';

// React's async act waits for pending actions. Preact's returns after one flush, so wait a task.
export async function act(callback) {
  let result;
  await preactAct(async () => {
    result = await callback();
    await new Promise((resolve) => setTimeout(resolve));
  });
  return result;
}
