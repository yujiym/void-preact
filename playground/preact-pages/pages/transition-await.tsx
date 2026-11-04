import { action, useForm, useFormStatus, useRouter } from 'void-preact';
import { useState } from 'preact/hooks';
import type { Props } from './transition-await.server.ts';

function FormButton({ testId }: { testId: string }) {
  const { pending } = useFormStatus();
  return <button data-testid={testId}>{pending ? 'pending' : 'run'}</button>;
}

export default function TransitionAwaitPage({ revision }: Props) {
  const router = useRouter();
  const [operation, setOperation] = useState('action');
  const [plainPending, setPlainPending] = useState(false);
  const [completed, setCompleted] = useState(false);

  async function run() {
    if (operation === 'action') {
      const result = await action('/transition-await?ping');
      if (!result.ok) {
        throw result.error;
      }
    } else {
      await fetch('/transition-await?ping', { method: 'POST' });
      if (operation === 'visit') {
        await router.visit('/transition-await?visited=1', {
          preserveState: true,
          resolveOn: 'data',
        });
      } else {
        await router.refresh({ resolveOn: 'data' });
      }
    }
    setCompleted(true);
  }

  const form = useForm('/transition-await?ping', {}, { onSuccess: () => setCompleted(true) });

  return (
    <section>
      <h1>Transition Await</h1>
      <select
        data-testid="operation"
        value={operation}
        onChange={(event) => setOperation(event.currentTarget.value)}
      >
        <option value="action">Action</option>
        <option value="visit">Visit</option>
        <option value="refresh">Refresh</option>
      </select>
      <output data-testid="revision">{revision}</output>
      <output data-testid="completed">{completed ? 'complete' : 'waiting'}</output>
      <form action={async () => run()}>
        <FormButton testId="form-action" />
      </form>
      <button
        data-testid="plain"
        onClick={async () => {
          setPlainPending(true);
          try {
            await run();
          } finally {
            setPlainPending(false);
          }
        }}
      >
        {plainPending ? 'pending' : 'run'}
      </button>
      <form action={form.post}>
        <FormButton testId="use-form" />
      </form>
    </section>
  );
}
