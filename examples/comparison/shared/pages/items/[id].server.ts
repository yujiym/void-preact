import { defineHandler } from 'void';

export type Props = { id: string; query: string };
export const loader = defineHandler<Props>((c) => ({ id: c.req.param('id') ?? '', query: c.req.query('view') ?? '' }));
