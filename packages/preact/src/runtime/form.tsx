import type { ComponentChildren, FormHTMLAttributes, VNode } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import {
  formErrorMessage,
  formRetryMessage,
  formSubmissionBlocked,
  scheduleFormRetry,
  type FormModel,
  type FormMethod,
  type VoidActionError,
} from 'void/pages-client';
import './form-action.tsx';

export type FormProps = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  'action' | 'onSubmit' | 'method' | 'onError'
> & {
  form: FormModel<[FormData]>;
  method?: FormMethod;
  renderError?: (error: VoidActionError) => ComponentChildren;
};

export function Form({ form, method = 'post', renderError, children, ...props }: FormProps): VNode {
  const [now, setNow] = useState(Date.now);
  useEffect(() => scheduleFormRetry(form.error, () => setNow(Date.now())), [form.error]);
  const message = formErrorMessage(form);
  const retry = formRetryMessage(form.error);
  const blocked = formSubmissionBlocked(form, now);
  return (
    <form
      {...props}
      // Preact's types only allow a string here. form-action.tsx handles a function.
      action={form[method] as unknown as string}
      aria-busy={form.pending}
      onSubmit={(event) => {
        if (blocked) {
          event.preventDefault();
        }
      }}
    >
      {message && (
        <div role="alert" data-void-form-error>
          {form.error && renderError ? renderError(form.error) : message}
          {retry && <p>{retry}</p>}
        </div>
      )}
      {children}
    </form>
  );
}
