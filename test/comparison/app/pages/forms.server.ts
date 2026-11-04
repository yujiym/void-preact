import * as v from 'valibot';
import { defineHandler } from 'void';

export type Props = { savedCount: number; savedName: string };

function readSaved(cookie: string): Props {
  const values = new Map(cookie.split(';').map((part) => {
    const [name, ...value] = part.trim().split('=');
    return [name, value.join('=')];
  }));
  const count = Number(values.get('comparison-saved') ?? '0');
  return {
    savedCount: Number.isSafeInteger(count) && count >= 0 ? count : 0,
    savedName: decodeURIComponent(values.get('comparison-name') ?? ''),
  };
}

export const loader = defineHandler<Props>((c) => readSaved(c.req.header('cookie') ?? ''));

export const actions = {
  default: defineHandler.withValidator({
    body: v.object({ name: v.pipe(v.string(), v.minLength(1, 'Name required')) }),
  })((c, { body }) => {
    const { savedCount } = readSaved(c.req.header('cookie') ?? '');
    c.header('Set-Cookie', `comparison-saved=${savedCount + 1}; Path=/; HttpOnly; SameSite=Lax`, { append: true });
    c.header('Set-Cookie', `comparison-name=${encodeURIComponent(body.name)}; Path=/; HttpOnly; SameSite=Lax`, { append: true });
    return c.redirect('/forms', 303);
  }),
};
