import { useState } from 'react';
import type { Props } from './index.server.ts';

export default function Home({ title }: Props) {
  const [count, setCount] = useState(0);
  return <section>
    <h1 data-testid="ssr-title">{title}</h1>
    <output data-testid="counter">{count}</output>
    <button data-testid="increment" onClick={() => setCount((value) => value + 1)}>Increment</button>
  </section>;
}
