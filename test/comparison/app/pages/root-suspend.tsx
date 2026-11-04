import { use, useState } from 'react';

export default function RootSuspendPage() {
  const [pending, setPending] = useState<Promise<string> | null>(null);
  const value = pending ? use(pending) : null;
  return <section data-testid="root-suspend-page">
    <h1>Root suspense</h1>
    <button data-testid="suspend-root" onClick={() => setPending(
      fetch('/api/wait?resource=root-pending').then(async (response) => {
        if (!response.ok) throw new Error('Root resource failed');
        await response.text();
        return 'root-pending';
      }),
    )}>Suspend the root</button>
    {value === null
      ? <p data-testid="root-idle">Ready to suspend the root</p>
      : <output data-testid="root-value">{value}</output>}
  </section>;
}
