import { defineHandler } from 'void';

export type Props = { title: string };
export const loader = defineHandler<Props>(() => ({ title: 'Comparison home' }));
