import { Component, type ComponentChildren, type ComponentType } from 'preact';
import { Suspense, lazy } from 'preact/compat';
import { clientPageError, type ClientPageBoundary, type ErrorPageProps } from 'void/pages-client';

type Props = {
  boundary: ClientPageBoundary;
  generation: number;
  dev?: boolean;
  children?: ComponentChildren;
  onFailure(): void;
};

type State = { generation: number; error: unknown; failed: boolean };

const fallbacks = new Map<string, ComponentType<ErrorPageProps>>();
function fallbackFor(boundary: ClientPageBoundary) {
  let fallback = fallbacks.get(boundary.id);
  if (!fallback) {
    fallback = lazy(boundary.load as () => Promise<{ default: ComponentType<ErrorPageProps> }>);
    fallbacks.set(boundary.id, fallback);
  }
  return fallback;
}

/** Native boundaries recover only descendants, so fallback failures reach the parent. */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = {
    generation: this.props.generation,
    error: null,
    failed: false,
  };
  static getDerivedStateFromProps(props: Props, state: State): State | null {
    return props.generation !== state.generation
      ? { generation: props.generation, error: null, failed: false }
      : null;
  }
  // Preact would catch the fallback's own failure here too. Rethrowing passes it to the parent,
  // as React does.
  componentDidCatch(error: unknown): void {
    if (this.state.failed) {
      throw error;
    }
    this.setState({ error, failed: true });
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
