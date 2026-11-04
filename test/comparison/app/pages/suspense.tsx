import { Suspense, use, useId, useState } from 'react';

type Resource = { label: string; value: Promise<string> };
type NestedResources = { outer: Resource; left: Resource; right: Resource };

function resource(label: string): Resource {
  return {
    label,
    value: fetch(`/api/wait?resource=${encodeURIComponent(label)}`).then(async (response) => {
      if (!response.ok) throw new Error(`Resource failed: ${label}`);
      await response.text();
      return label;
    }),
  };
}

function Value({ pending, name }: { pending: Resource; name: string }) {
  const value = use(pending.value);
  return <output data-testid={`${name}-value`} data-resource={pending.label}>{value}</output>;
}

function Nested({ pending }: { pending: NestedResources }) {
  const outer = use(pending.outer.value);
  return <div data-testid="nested-shell" data-resource={outer}>
    <Suspense fallback={<p data-testid="left-loading">Loading left</p>}>
      <Value pending={pending.left} name="left" />
    </Suspense>
    <Suspense fallback={<p data-testid="right-loading">Loading right</p>}>
      <Value pending={pending.right} name="right" />
    </Suspense>
  </div>;
}

export default function SuspensePage() {
  const id = useId();
  const [pending, setPending] = useState<Resource | null>(null);
  const [nested, setNested] = useState<NestedResources | null>(null);
  const [generation, setGeneration] = useState(0);
  return <section data-testid="suspense-page" data-state="ready" aria-labelledby={id}>
    <h1 id={id} data-testid="suspense-title" ref={(element) => {
      if (element) element.dataset.clientId = id;
    }}>Suspense resources</h1>
    <button data-testid="suspend-single" onClick={() => {
      const next = generation + 1;
      setGeneration(next);
      setPending(resource(`single-${next}`));
    }}>Load resource</button>
    <Suspense fallback={<p data-testid="single-loading" role="status">Loading resource</p>}>
      {pending ? <Value pending={pending} name="single" /> : <p data-testid="single-idle">Ready to load</p>}
    </Suspense>
    <button data-testid="suspend-nested" onClick={() => setNested({
      outer: resource('outer'),
      left: resource('left'),
      right: resource('right'),
    })}>Load nested resources</button>
    <Suspense fallback={<p data-testid="outer-loading">Loading outer</p>}>
      {nested ? <Nested pending={nested} /> : <p data-testid="nested-idle">Ready for nested resources</p>}
    </Suspense>
  </section>;
}
