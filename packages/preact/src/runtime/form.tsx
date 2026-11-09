import type { ComponentChildren, FormHTMLAttributes, VNode } from 'preact';
import { useCallback } from 'preact/hooks';
import {
  formErrorMessage,
  formRetryMessage,
  formSubmissionBlocked,
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
  const message = formErrorMessage(form);
  const retry = formRetryMessage(form.error);
  const onSubmit = useCallback(
    (event: Event) => {
      if (formSubmissionBlocked(form)) {
        event.preventDefault();
      }
    },
    [form],
  );
  return (
    <form
      {...props}
      // Preact's types only allow a string here. form-action.tsx handles a function.
      action={form[method] as unknown as string}
      aria-busy={form.pending}
      onSubmit={onSubmit}
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
