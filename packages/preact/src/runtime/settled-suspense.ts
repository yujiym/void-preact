import { Suspense } from 'preact/compat';

function discardRange(start: Node | null | undefined): void {
  if (start?.nodeType !== Node.COMMENT_NODE || !(start as Comment).data.startsWith('$s')) {
    return;
  }
  for (let depth = 1, node = start.nextSibling; node; node = start.nextSibling) {
    if (node.nodeType === Node.COMMENT_NODE) {
      const { data } = node as Comment;
      depth += data.startsWith('$s') ? 1 : data.startsWith('/$s') ? -1 : 0;
      if (depth === 0) {
        return;
      }
    }
    node.parentNode!.removeChild(node);
  }
}

type SuspendingVNode = { __e?: Node | null };
type SuspenseHook = {
  __c(this: unknown, promise: Promise<unknown>, vnode: SuspendingVNode): void;
};

// Page code uses plain Suspense, so the fallback has to be discarded for every boundary.
const suspensePrototype = Suspense.prototype as unknown as SuspenseHook;
const childDidSuspend = suspensePrototype.__c;
suspensePrototype.__c = function (promise, vnode) {
  if (SettledSuspense.discardsServerFallback) {
    const start = vnode.__e;
    const discard = () => discardRange(start);
    promise.then(discard, discard);
  }
  childDidSuspend.call(this, promise, vnode);
};

/**
 * React commits a boundary only when its content is ready. Preact runs effects above a suspended
 * child at once, and sets no state while hydrating, so the boundary's own state cannot say either.
 * `__c` is the hook Suspense receives a suspension on. preact-render-to-string relies on it too.
 */
export class SettledSuspense extends Suspense {
  private static pending = 0;
  private static waiters: Array<() => void> = [];

  /**
   * A deferred page's HTML is cut after the shell, so its `$s` ranges hold the fallback. Preact
   * expects streamed content there and would hydrate the real content onto the fallback's element.
   */
  static discardsServerFallback = false;

  /** Runs `run` once no SettledSuspense has a suspended child. */
  static whenSettled(run: () => void): void {
    // Suspense reports a suspension during the same diff that queued this callback's effect.
    queueMicrotask(() => {
      if (SettledSuspense.pending > 0) {
        SettledSuspense.waiters.push(run);
      } else {
        run();
      }
    });
  }

  __c(promise: Promise<unknown>, vnode: SuspendingVNode): void {
    SettledSuspense.pending++;
    suspensePrototype.__c.call(this, promise, vnode);
    const settle = () => {
      SettledSuspense.pending--;
      // Let the resumed child render first. It may suspend again.
      setTimeout(() => {
        if (SettledSuspense.pending === 0) {
          SettledSuspense.waiters.splice(0).forEach((run) => run());
        }
      });
    };
    promise.then(settle, settle);
  }
}
