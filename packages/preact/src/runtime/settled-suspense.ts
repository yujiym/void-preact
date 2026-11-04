import { Suspense } from 'preact/compat';
import { installSuspenseAdapter } from './preact-suspense-adapter.ts';

const adapter = installSuspenseAdapter(Suspense.prototype);

export class SettledSuspense extends Suspense {
  get isPending(): boolean {
    return adapter.isPending(this);
  }

  static get discardsServerFallback(): boolean {
    return adapter.discardsServerFallback;
  }

  static set discardsServerFallback(value: boolean) {
    adapter.discardsServerFallback = value;
  }

  static whenSettled(run: () => void): () => void {
    return adapter.whenSettled(run);
  }
}

adapter.trackBoundary(SettledSuspense.prototype);
