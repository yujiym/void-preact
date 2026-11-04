import type { Deferred } from 'void-preact';
import { defineHandler, defer } from 'void';

export type Props = Readonly<{
  title: string;
  stats: Deferred<{ count: number }>;
}>;

export const loader = defineHandler<Props>(() => {
  return {
    title: 'Deferred Page',
    stats: defer(async () => ({ count: 42 })),
  };
});
