import { defineHandler } from 'void';
import { getUser } from 'void/auth';

export type Props = { serverUser: string };
export const loader = defineHandler<Props>(() => ({ serverUser: getUser()?.name ?? 'signed out' }));
