<<<<<<< void-preact
import { Component, type ComponentChildren, type ComponentType } from 'preact';
import { Suspense, lazy } from 'preact/compat';
import { clientPageError, type ClientPageBoundary, type ErrorPageProps } from 'void/pages-client';
=======
import React, { Component, Suspense, lazy } from 'preact/hooks';
import type { ReactNode } from 'preact/hooks';
import { clientPageError } from 'void/pages-client';
import type { ClientPageBoundary, ErrorPageProps } from 'void/pages-client';

type ReactPageBoundary = ClientPageBoundary<React.ComponentType<ErrorPageProps>>;
>>>>>>> new upstream

type Props = {
  boundary: ReactPageBoundary;
  generation: number;
  dev?: boolean;
  children?: ComponentChildren;
  onFailure(): void;
};

<<<<<<< void-preact
type State = { generation: number; error: unknown; failed: boolean };

const fallbacks = new Map<string, ComponentType<ErrorPageProps>>();
function fallbackFor(boundary: ClientPageBoundary) {
  let fallback = fallbacks.get(boundary.id);
  if (!fallback) {
    fallback = lazy(boundary.load as () => Promise<{ default: ComponentType<ErrorPageProps> }>);
=======
type RecoveryState = {
  error: unknown;
  failed: boolean;
};

type BoundaryState = RecoveryState & {
  generation: number;
};

const fallbacks = new Map<string, React.LazyExoticComponent<React.ComponentType<ErrorPageProps>>>();
function fallbackFor(boundary: ReactPageBoundary) {
  let fallback = fallbacks.get(boundary.id);
  if (!fallback) {
    fallback = lazy(boundary.load);
>>>>>>> new upstream
    fallbacks.set(boundary.id, fallback);
  }
  return fallback;
}

/** Native boundaries recover only descendants, so fallback failures reach the parent. */
<<<<<<< void-preact
export class PageErrorBoundary extends Component<Props, State> {
  state: State = {
=======
export class PageErrorBoundary extends Component<Props, BoundaryState> {
  state: BoundaryState = {
>>>>>>> new upstream
    generation: this.props.generation,
    error: null,
    failed: false,
  };
<<<<<<< void-preact
  static getDerivedStateFromProps(props: Props, state: State): State | null {
=======
  static getDerivedStateFromProps(
    props: Props,
    state: { generation: number },
  ): BoundaryState | null {
>>>>>>> new upstream
    return props.generation !== state.generation
      ? { generation: props.generation, error: null, failed: false }
      : null;
  }
<<<<<<< void-preact
  // Preact would catch the fallback's own failure here too. Rethrowing passes it to the parent,
  // as React does.
  componentDidCatch(error: unknown): void {
    if (this.state.failed) {
      throw error;
    }
    this.setState({ error, failed: true });
=======
  static getDerivedStateFromError(error: unknown): RecoveryState {
    return { error, failed: true };
  }
  componentDidCatch(): void {
>>>>>>> new upstream
    this.props.onFailure();
  }
  render(): ComponentChildren {
    if (this.state.failed) {
      const Fallback = fallbackFor(this.props.boundary);
      return (
        <Suspense fallback={null}>
          <Fallback error={clientPageError(this.state.error, this.props.dev)} />
        </Suspense>
      );
    }
    return this.props.children;
  }
}
