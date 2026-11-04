import { useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';

function NativeStatus() {
  const { pending } = useFormStatus();
  return <output data-testid="native-pending">{String(pending)}</output>;
}

export default function Differences() {
  const [completed, setCompleted] = useState(0);
  const [transitionCompleted, setTransitionCompleted] = useState(0);
  const [pending, startTransition] = useTransition();
  return <section>
    <h1>Expected differences</h1>
    <p>React resets uncontrolled inputs after a successful form action. The Preact adapter retains the submitted input.</p>
    <form action={async () => {
      await fetch('/api/wait');
      setCompleted((value) => value + 1);
    }}>
      <label htmlFor="uncontrolled">Uncontrolled value</label>
      <input id="uncontrolled" name="uncontrolled" defaultValue="" />
      <NativeStatus />
      <button data-testid="native-submit" type="submit">Submit native action</button>
    </form>
    <output data-testid="native-completed">{completed}</output>
    <p>React tracks async transition pending state. Preact compatibility transitions report false.</p>
    <button data-testid="transition-start" onClick={() => startTransition(async () => {
      await fetch('/api/wait');
      setTransitionCompleted((value) => value + 1);
    })}>Start transition</button>
    <output data-testid="transition-pending">{String(pending)}</output>
    <output data-testid="transition-completed">{transitionCompleted}</output>
  </section>;
}
