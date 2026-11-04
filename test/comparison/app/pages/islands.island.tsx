import Counter from './_Counter.tsx' with { island: 'load' };

export default function Islands() {
  return <section>
    <h1 data-testid="island-title">Comparison islands</h1>
    <Counter side="left" />
    <Counter side="right" />
    <a href="/">Home</a>
  </section>;
}
