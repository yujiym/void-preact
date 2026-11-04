import { describe, expect, it, vi } from 'vite-plus/test';
import { Window } from 'happy-dom';
import { installSuspenseAdapter } from '../../src/runtime/preact-suspense-adapter.ts';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function fixture() {
  const calls: Array<unknown> = [];
  const prototype = {
    __c(this: object, promise: PromiseLike<unknown>, vnode: object) { calls.push(this, promise, vnode); },
    componentWillUnmount(this: object) { calls.push(this); },
  };
  const adapter = installSuspenseAdapter(prototype);
  const trackedPrototype = Object.create(prototype);
  adapter.trackBoundary(trackedPrototype);
  const boundary = Object.create(trackedPrototype);
  const vnode = { __e: null };
  return { adapter, prototype, boundary, vnode, calls };
}

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

describe('private Suspense adapter', () => {
  it('rejects incompatible prototypes without changing real Preact hooks', () => {
    for (const prototype of [null, {}, { __c: 1 }, { __c() {} }]) {
      expect(() => installSuspenseAdapter(prototype)).toThrow('incompatible Preact Suspense internals');
    }
    expect(() => installSuspenseAdapter(Object.freeze({ __c() {}, componentWillUnmount() {} })))
      .toThrow('hooks must be writable own methods');
  });

  it('fails clearly when the suspending VNode shape changes', () => {
    const { prototype, boundary } = fixture();
    expect(() => prototype.__c.call(boundary, Promise.resolve(), {}))
      .toThrow('suspending VNode has no DOM pointer');
    expect(() => prototype.__c.call(boundary, Promise.resolve(), { __e: 42 }))
      .toThrow('suspending VNode DOM pointer is not a Node');
  });

  it('validates the entire server range before removing any fallback siblings', () => {
    const window = new Window();
    vi.stubGlobal('Node', window.Node);
    try {
      const { adapter, prototype, boundary } = fixture();
      adapter.discardsServerFallback = true;
      const parent = window.document.createElement('div');
      parent.innerHTML = '<!--$s--><b>fallback</b><i>unrelated</i>';
      const before = parent.innerHTML;
      const handlers: Array<() => void> = [];
      const promise = Promise.resolve();
      promise.then = function (fulfilled) {
        if (fulfilled) handlers.push(() => { fulfilled(undefined); });
        return new Promise(() => {});
      };
      prototype.__c.call(boundary, promise, { __e: parent.firstChild });
      expect(() => handlers[0]()).toThrow('server Suspense range has no matching /$s marker');
      expect(parent.innerHTML).toBe(before);
      parent.innerHTML = '<!--$s--><b>fallback</b><!--$s--><i>nested</i><!--/$s--><!--/$s--><p>after</p>';
      handlers.length = 0;
      prototype.__c.call(boundary, promise, { __e: parent.firstChild });
      handlers[0]();
      expect(parent.innerHTML).toBe('<!--$s--><!--/$s--><p>after</p>');
      prototype.componentWillUnmount.call(boundary);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('forwards this and arguments and waits for both resolve and reject paths', async () => {
    const { adapter, prototype, boundary, vnode, calls } = fixture();
    const first = deferred();
    const second = deferred();
    prototype.__c.call(boundary, first.promise, vnode);
    prototype.__c.call(boundary, second.promise, vnode);
    expect(calls).toEqual([boundary, first.promise, vnode, boundary, second.promise, vnode]);
    let commits = 0;
    adapter.whenSettled(() => commits++);
    await Promise.resolve();
    first.resolve();
    await flush();
    expect(commits).toBe(0);
    second.reject(new Error('expected suspension rejection'));
    await flush();
    expect(commits).toBe(1);
  });

  it('releases an unmounted boundary once even when its promise resolves later', async () => {
    const { adapter, prototype, boundary, vnode } = fixture();
    const suspended = deferred();
    prototype.__c.call(boundary, suspended.promise, vnode);
    let commits = 0;
    adapter.whenSettled(() => commits++);
    await Promise.resolve();
    prototype.componentWillUnmount.call(boundary);
    await flush();
    expect(commits).toBe(1);
    suspended.resolve();
    await flush();
    adapter.whenSettled(() => commits++);
    await Promise.resolve();
    expect(commits).toBe(2);
  });

  it('cancels a queued commit when its owner unmounts', async () => {
    const { adapter, prototype, boundary, vnode } = fixture();
    const suspended = deferred();
    prototype.__c.call(boundary, suspended.promise, vnode);
    let commits = 0;
    const cancel = adapter.whenSettled(() => commits++);
    await Promise.resolve();
    cancel();
    suspended.resolve();
    await flush();
    expect(commits).toBe(0);
  });

  it('allows a plain nested Suspense fallback to commit independently', async () => {
    const { adapter, prototype, vnode } = fixture();
    const suspended = deferred();
    prototype.__c.call(Object.create(prototype), suspended.promise, vnode);
    let commits = 0;
    adapter.whenSettled(() => commits++);
    await Promise.resolve();
    expect(commits).toBe(1);
    suspended.resolve();
    await flush();
  });
});
