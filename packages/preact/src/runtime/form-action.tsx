import { createContext, options, type ComponentChildren, type Ref, type VNode } from 'preact';
import { useContext, useState } from 'preact/hooks';

type FormAction = (formData: FormData) => unknown;
type ActionFormProps = {
  action: FormAction;
  onSubmit?: (event: SubmitEvent & { currentTarget: HTMLFormElement }) => void;
  formRef?: Ref<HTMLFormElement>;
  children?: ComponentChildren;
};
export type FormStatus = Readonly<{ pending: boolean }>;

const FormStatusContext = createContext<FormStatus>({ pending: false });

export function useFormStatus(): FormStatus {
  return useContext(FormStatusContext);
}

function ActionForm({ action, onSubmit, formRef, children, ...props }: ActionFormProps) {
  const [pending, setPending] = useState(false);
  return (
    // method="post" keeps a submit made before hydration out of the URL.
    <form
      {...props}
      ref={formRef}
      method="post"
      onSubmit={async (event) => {
        onSubmit?.(event as SubmitEvent & { currentTarget: HTMLFormElement });
        if (event.defaultPrevented) {
          return;
        }
        event.preventDefault();
        setPending(true);
        try {
          await action(new FormData(event.currentTarget, event.submitter));
        } finally {
          setPending(false);
        }
      }}
    >
      <FormStatusContext.Provider value={{ pending }}>{children}</FormStatusContext.Provider>
    </form>
  );
}

// React 19 accepts a function as a form's action, and the @void/react API is built on that.
const previousVNodeHook = options.vnode;
options.vnode = (vnode: VNode<any>) => {
  if (vnode.type === 'form' && typeof vnode.props.action === 'function') {
    vnode.type = ActionForm as any;
    vnode.props.formRef = vnode.ref;
    vnode.ref = null;
  }
  previousVNodeHook?.(vnode);
};
