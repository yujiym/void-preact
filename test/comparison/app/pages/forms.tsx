import { Form, useForm } from '@void/react';
import type { Props } from './forms.server.ts';

export default function Forms({ savedCount, savedName }: Props) {
  const form = useForm('/forms', { name: savedName });
  return <section>
    <h1>Forms</h1>
    <output data-testid="saved-count">{savedCount}</output>
    <Form form={form}>
      <label htmlFor="name">Name</label>
      <input id="name" name="name" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} />
      <output data-testid="form-error">{form.errors.name ?? ''}</output>
      <output data-testid="form-pending">{String(form.pending)}</output>
      <output data-testid="form-success">{String(form.wasSuccessful)}</output>
      <output data-testid="form-value">{form.data.name}</output>
      <button data-testid="form-submit" type="submit">Save</button>
      <button data-testid="form-reset" type="button" onClick={() => { form.reset({ initial: true }); form.clearErrors(); }}>Reset</button>
    </Form>
  </section>;
}
