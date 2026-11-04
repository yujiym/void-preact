import { Component, useState, type ReactNode } from 'react';

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) return <section>
      <output data-testid="boundary-error">{this.state.error.message}</output>
      <button data-testid="reset-error" onClick={() => this.setState({ error: null })}>Reset</button>
    </section>;
    return this.props.children;
  }
}

function Fallible() {
  const [failed, setFailed] = useState(false);
  if (failed) throw new Error('comparison boundary failure');
  return <button data-testid="throw-error" onClick={() => setFailed(true)}>Throw error</button>;
}

export default function Errors() {
  return <section><h1>Errors</h1><Boundary><Fallible /></Boundary></section>;
}
