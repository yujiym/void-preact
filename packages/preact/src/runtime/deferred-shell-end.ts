import { DEFERRED_SHELL_CANCEL_REASON } from './deferred-shell.ts';

// preact-render-to-string cannot abort a render, so the server ends the deferred shell at a marker instead.
export const DEFERRED_SHELL_END_ID: string = '__VOID_DEFERRED_SHELL_END__';
export const DEFERRED_SHELL_END_MARKER: string = `<template id="${DEFERRED_SHELL_END_ID}"></template>`;

export function readDeferredShell(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const keepLength = DEFERRED_SHELL_END_MARKER.length - 1;
  let buffer = '';
  let cancelled = false;

  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (cancelled) {
              return;
            }
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });

            const markerIndex = buffer.indexOf(DEFERRED_SHELL_END_MARKER);
            if (markerIndex !== -1) {
              const shell = buffer.slice(0, markerIndex + DEFERRED_SHELL_END_MARKER.length);
              await reader.cancel(DEFERRED_SHELL_CANCEL_REASON);
              if (!cancelled) {
                controller.enqueue(encoder.encode(shell));
                controller.close();
              }
              return;
            }

            if (done) {
              if (buffer) {
                controller.enqueue(encoder.encode(buffer));
              }
              controller.close();
              return;
            }

            if (buffer.length > keepLength) {
              controller.enqueue(encoder.encode(buffer.slice(0, -keepLength)));
              buffer = buffer.slice(-keepLength);
              return;
            }
          }
        } catch (error) {
          if (!cancelled) {
            controller.error(error);
            await reader.cancel(error).catch(() => {});
          }
        }
      },
      async cancel(reason) {
        cancelled = true;
        await reader.cancel(reason);
      },
    },
    { highWaterMark: 0 },
  );
}
