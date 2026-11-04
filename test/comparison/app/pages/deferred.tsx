import { Suspense, use, useId } from 'react';
import type { Props } from './deferred.server.ts';

function Payload({ payload }: Props) {
  const value = use(payload);
  return <output data-testid="deferred-value">{value.message}</output>;
}

export default function Deferred({ payload }: Props) {
  const id = useId();
  return <section>
    <h1 id={id} data-testid="deferred-title" ref={(element) => { if (element) element.dataset.clientId = id; }}>Deferred</h1>
    <Suspense fallback={<p data-testid="deferred-loading">Loading</p>}>
      <Payload payload={payload} />
    </Suspense>
  </section>;
}
