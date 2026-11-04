import { defineConfig } from 'vite-plus';

export default defineConfig({
  pack: {
    entry: ['src/index.ts', 'src/plugin.ts', 'src/runtime/pages-client.ts', 'src/runtime/pages-server.ts', 'src/runtime/settled-suspense.ts'],
    format: 'esm',
    dts: true,
    clean: true,
    deps: {
      resolveDepSubpath: true,
      neverBundle: [
        'preact',
        'preact/compat',
        'preact/hooks',
        'preact/jsx-runtime',
        'preact-render-to-string',
        'preact-render-to-string/stream',
        'vite',
        'void',
        'void/*',
        '@preact/preset-vite',
      ],
    },
  },
});
