import { defineHandler } from 'void';

export const loader = defineHandler(() => new Response('Comparison loader failure', { status: 503 }));
