import type { Deferred } from '@void/react';
import { defineHandler, defer } from 'void';

export type Props = { payload: Deferred<{ message: string }> };
export const loader = defineHandler<Props>(() => ({
  payload: defer(async () => {
    await new Promise((resolve) => setTimeout(resolve, 25));
    return { message: 'Deferred ready' };
  }),
}));
