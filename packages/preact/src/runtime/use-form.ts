import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'preact/hooks';
import {
  VoidActionError,
  cloneFormValue,
  getValidationErrors,
  interpolateRouteParams,
  isAbortError,
  isEqualFormValue,
  parseFormResetArgs,
  submitAction,
  type FormResetOptions,
  type FormState,
} from 'void/pages-client';
import type { ActionUrl, ResolveActionBody, ActionFormOptions } from 'void/routes';
import { RouterContext } from './context.ts';

type SubmitPayload = FormData | { method: string };
// Submit methods are native form actions that take FormData.
type FormReturn<TData> = FormState<TData, 'setters'> &
  Readonly<{
    setData: <K extends keyof TData & string>(field: K, value: TData[K]) => void;
    post(formData: FormData): void;
    put(formData: FormData): void;
    patch(formData: FormData): void;
    delete(formData: FormData): void;
  }>;

type FormOptions = {
  params?: Record<string, string>;
  resetOnSuccess?: boolean;
  preserveScroll?: boolean;
  onSuccess?: () => void | Promise<void>;
  onError?: (error: Record<string, string> | VoidActionError) => void | Promise<void>;
};

// Typed overload — full inference from PageActionMap (requires codegen)
export function useForm<U extends ActionUrl & string>(
  url: U,
  defaults: ResolveActionBody<U>,
  options?: ActionFormOptions<U> & Pick<FormOptions, 'onSuccess' | 'onError' | 'preserveScroll'>,
): FormReturn<ResolveActionBody<U>>;

export function useForm(
  url: string,
  defaults: Record<string, unknown>,
  options?: FormOptions,
): FormReturn<Record<string, unknown>> {
  const router = useContext(RouterContext);
  const [data, setDataState] = useState<Record<string, unknown>>(() => cloneFormValue(defaults));
  const [defaultsState, setDefaultsState] = useState<Record<string, unknown>>(() =>
    cloneFormValue(defaults),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setActionError] = useState<VoidActionError | null>(null);
  const [wasSuccessful, setWasSuccessful] = useState(false);
  const [recentlySuccessful, setRecentlySuccessful] = useState(false);

  const defaultsRef = useRef(defaultsState);
  const initialRef = useRef(defaultsState);
  const dataRef = useRef(data);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasChanges = useMemo(() => {
    return Object.keys(defaultsState).some(
      (key) => !isEqualFormValue(data[key], defaultsState[key]),
    );
  }, [data, defaultsState]);

  const setData = useCallback((field: string, value: unknown) => {
    dataRef.current = { ...dataRef.current, [field]: value };
    setDataState(dataRef.current);
    setErrors((prev) => {
      if (!(field in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const reset = useCallback((...args: ReadonlyArray<string | FormResetOptions>) => {
    const { initial, fields } = parseFormResetArgs(args);
    const source = initial ? initialRef.current : defaultsRef.current;
    if (fields.length === 0) {
      dataRef.current = cloneFormValue(source);
    } else {
      const next = { ...dataRef.current };
      for (const field of fields) {
        next[field] = cloneFormValue(source[field]);
      }
      dataRef.current = next;
    }
    setDataState(dataRef.current);
  }, []);

  const clearErrors = useCallback((...fields: ReadonlyArray<string>) => {
    if (fields.length === 0) {
      setErrors({});
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        for (const field of fields) {
          delete next[field];
        }
        return next;
      });
    }
  }, []);

  const setError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearError = useCallback(() => {
    setActionError(null);
  }, []);

  const [pendingCount, setPendingCount] = useState(0);
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  if (failure) {
    throw failure.error;
  }

  const submit = async (payload: SubmitPayload) => {
      if (!router) {
        throw new Error('useForm(): requires the Void Router.');
      }

      const method = payload instanceof FormData ? 'POST' : payload.method;

      setWasSuccessful(false);
      setRecentlySuccessful(false);
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
      setErrors({});
      setActionError(null);

      let result;
      try {
        // Params are filled in on submit, so a param that would change the
        // request path (such as "..") fails this submit, not the page render.
        result = await submitAction(router, interpolateRouteParams(url, options?.params), {
          method,
          data: { ...dataRef.current },
          preserveScroll: options?.preserveScroll,
          _resolveOnShell: true,
        });
      } catch (submitError) {
        if (isAbortError(submitError)) {
          return;
        }
        throw submitError;
      }

      if (!result.ok) {
        const validationErrors = getValidationErrors(result.error.body);
        if (validationErrors) {
          setErrors(validationErrors);
          await options?.onError?.(validationErrors);
        } else {
          setActionError(result.error);
          await options?.onError?.(result.error);
        }
        return;
      }

      if (options?.resetOnSuccess) {
        dataRef.current = cloneFormValue(initialRef.current);
        setDataState(dataRef.current);
      }
      const nextDefaults = cloneFormValue(dataRef.current);
      defaultsRef.current = nextDefaults;
      setDefaultsState(nextDefaults);
      setWasSuccessful(true);
      setRecentlySuccessful(true);
      successTimeoutRef.current = setTimeout(() => {
        setRecentlySuccessful(false);
        successTimeoutRef.current = null;
      }, 2000);
      await options?.onSuccess?.();
  };

  // Submits run one at a time, in order. A failed submit reaches the nearest error boundary.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const dispatchAction = useCallback((payload: SubmitPayload) => {
    setPendingCount((count) => count + 1);
    queueRef.current = queueRef.current
      .then(() => submitRef.current(payload))
      .catch((error: unknown) => setFailure({ error }))
      .finally(() => setPendingCount((count) => count - 1));
    return queueRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = null;
      }
    };
  }, []);

  const dispatchMethodAction = useCallback(
    (method: string) => (_formData: FormData) => dispatchAction({ method }),
    [dispatchAction],
  );

  const put = useMemo(() => dispatchMethodAction('PUT'), [dispatchMethodAction]);
  const patch = useMemo(() => dispatchMethodAction('PATCH'), [dispatchMethodAction]);
  const deleteAction = useMemo(() => dispatchMethodAction('DELETE'), [dispatchMethodAction]);

  return {
    data,
    setData,
    errors,
    error,
    pending: pendingCount > 0,
    hasChanges,
    wasSuccessful,
    recentlySuccessful,
    post: dispatchAction,
    put,
    patch,
    delete: deleteAction,
    reset,
    setError,
    clearErrors,
    clearError,
  };
}
