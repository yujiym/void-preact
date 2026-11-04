import { useState } from 'react';

export default function Counter({ side }: { side: 'left' | 'right' }) {
  const [count, setCount] = useState(0);
  return <section>
    <output data-testid={`island-${side}`}>{count}</output>
    <button data-testid={`increment-${side}`} onClick={() => setCount((value) => value + 1)}>Increment {side}</button>
  </section>;
}
