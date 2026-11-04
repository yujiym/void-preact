type SuspensionHook = (this: object, promise: PromiseLike<unknown>, vnode: object) => void;
type UnmountHook = (this: object) => void;

function incompatible(detail: string): never {
  throw new Error(`void-preact: incompatible Preact Suspense internals (${detail}). Use the exact supported preact and preact-render-to-string peer versions.`);
}

function discardRange(start: Node | null | undefined): void {
  if (start?.nodeType !== 8 || !('data' in start) || typeof start.data !== 'string' || !start.data.startsWith('$s')) {
    return;
  }
  const fallback: Array<Node> = [];
  for (let depth = 1, node = start.nextSibling; node; node = node.nextSibling) {
    if (node.nodeType === 8 && 'data' in node && typeof node.data === 'string') {
      depth += node.data.startsWith('$s') ? 1 : node.data.startsWith('/$s') ? -1 : 0;
      if (depth === 0) {
        fallback.forEach((child) => child.parentNode?.removeChild(child));
        return;
      }
    }
    fallback.push(node);
  }
  incompatible('server Suspense range has no matching /$s marker');
}

function suspensionStart(vnode: object): Node | null | undefined {
  if (!('__e' in vnode)) {
    return incompatible('suspending VNode has no DOM pointer');
  }
  const start = vnode.__e;
  if (start == null || (typeof Node !== 'undefined' && start instanceof Node)) {
    return start;
  }
  return incompatible('suspending VNode DOM pointer is not a Node');
}

/** Owns the private Preact contract. This module is never a package entry point. */
interface SuspenseAdapter {
  trackBoundary(prototype: object): void;
  isPending(boundary: object): boolean;
  discardsServerFallback: boolean;
  whenSettled(run: () => void): () => void;
}

export function installSuspenseAdapter(prototype: unknown): SuspenseAdapter {
  if (typeof prototype !== 'object' || prototype === null || !('__c' in prototype) || typeof prototype.__c !== 'function') {
    return incompatible('Suspense.prototype.__c must be a function');
  }
  if (!('componentWillUnmount' in prototype) || typeof prototype.componentWillUnmount !== 'function') {
    return incompatible('Suspense.prototype.componentWillUnmount must be a function');
  }
  const descriptor = Object.getOwnPropertyDescriptor(prototype, '__c');
  const unmountDescriptor = Object.getOwnPropertyDescriptor(prototype, 'componentWillUnmount');
  if (!descriptor?.writable || !unmountDescriptor?.writable) {
    return incompatible('Suspense hooks must be writable own methods');
  }
  const childDidSuspend = prototype.__c as SuspensionHook;
  const unmount = prototype.componentWillUnmount as UnmountHook;
  const pendingByBoundary = new WeakMap<object, Set<() => void>>();
  const waiters = new Set<() => void>();
  let settledBoundaryPrototype: object | undefined;
  let pending = 0;
  let discardsServerFallback = false;

  function flush(): void {
    if (pending === 0) {
      const ready = [...waiters];
      waiters.clear();
      ready.forEach((run) => run());
    }
  }

  prototype.__c = function (this: object, promise: PromiseLike<unknown>, vnode: object): void {
    if (!promise || typeof promise.then !== 'function' || typeof vnode !== 'object' || vnode === null) {
      return incompatible('suspension hook requires (thenable, VNode)');
    }
    const start = suspensionStart(vnode);
    const tracked = settledBoundaryPrototype !== undefined && Object.prototype.isPrototypeOf.call(settledBoundaryPrototype, this);
    let active = true;
    let releases = pendingByBoundary.get(this);
    if (!releases) {
      releases = new Set();
      pendingByBoundary.set(this, releases);
    }
    const boundaryReleases = releases;
    const release = () => {
      if (!active) return;
      active = false;
      boundaryReleases.delete(release);
      if (tracked) pending--;
      // Preact queues its resumed diff from its own promise handler first.
      setTimeout(flush);
    };
    boundaryReleases.add(release);
    if (tracked) pending++;
    try {
      if (discardsServerFallback) {
        const discard = () => { if (active) discardRange(start); };
        promise.then(discard, discard);
      }
      childDidSuspend.call(this, promise, vnode);
      promise.then(release, release);
    } catch (error) {
      release();
      throw error;
    }
  };
  prototype.componentWillUnmount = function (this: object): void {
    try {
      unmount.call(this);
    } finally {
      pendingByBoundary.get(this)?.forEach((release) => release());
      pendingByBoundary.delete(this);
    }
  };

  return {
    trackBoundary(prototype: object): void { settledBoundaryPrototype = prototype; },
    isPending(boundary: object): boolean { return (pendingByBoundary.get(boundary)?.size ?? 0) > 0; },
    get discardsServerFallback() { return discardsServerFallback; },
    set discardsServerFallback(value: boolean) { discardsServerFallback = value; },
    whenSettled(run: () => void): () => void {
      let active = true;
      const waiter = () => { if (active) run(); };
      queueMicrotask(() => {
        if (!active) return;
        if (pending > 0) waiters.add(waiter);
        else waiter();
      });
      return () => {
        active = false;
        waiters.delete(waiter);
      };
    },
  };
}
