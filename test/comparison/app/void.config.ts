import { defineConfig } from 'void/config';

export default defineConfig({
  worker: { compatibility_date: '2026-02-24' },
  head: { htmlAttrs: { lang: 'en' }, title: 'Void adapter comparison' },
});
