// @vitest-environment happy-dom
import { Component, h, render, type ComponentChildren } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, expect, it, vi } from 'vite-plus/test';
import type { ClientPageBoundary, ErrorPageProps } from 'void/pages-client';
import { PageErrorBoundary } from '../../src/runtime/PageErrorBoundary.tsx';

let nextId = 0;
function boundaryWith(fallback: (props: ErrorPageProps) => ComponentChildren): ClientPageBoundary {
  const id = `error-${++nextId}`;
  return { id, key: id, depth: 0, load: async () => ({ default: fallback }) };
}

function Throws(): never {
  throw new Error('page failed');
}

class Parent extends Component<{ children?: ComponentChildren }, { failed: boolean }> {
  state = { failed: false };
  componentDidCatch(): void {
    this.setState({ failed: true });
  }
  render(): ComponentChildren {
    return this.state.failed ? 'parent caught' : this.props.children;
  }
}

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));

const container = document.createElement('div');
afterEach(() => render(null, container));

it('shows the boundary fallback, reports the failure, and resets on a new generation', async () => {
  const onFailure = vi.fn();
  const boundary = boundaryWith(({ error }) => h('p', null, `fallback: ${error.message}`));
  const mount = (generation: number, child: ComponentChildren) =>
    act(() => render(h(PageErrorBoundary, { boundary, generation, onFailure, dev: true }, child), container));

  await mount(1, h(Throws, null));
  await settle();
  expect(container.textContent).toBe('fallback: page failed');
  expect(onFailure).toHaveBeenCalledOnce();

  await mount(2, 'recovered');
  expect(container.textContent).toBe('recovered');
});

it('passes a failing fallback to the parent boundary', async () => {
  const onFailure = vi.fn();
  const boundary = boundaryWith(() => {
    throw new Error('fallback failed');
  });
  await act(() =>
    render(
      h(Parent, null, h(PageErrorBoundary, { boundary, generation: 1, onFailure }, h(Throws, null))),
      container,
    ),
  );
  await settle();
  expect(container.textContent).toBe('parent caught');
  expect(onFailure).toHaveBeenCalledOnce();
});
