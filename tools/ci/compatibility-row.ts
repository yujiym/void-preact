import manifest from '../../packages/preact/package.json' with { type: 'json' };

type CompatibilityManifest = {
  version: string;
  peerDependencies: { void: string; preact: string; 'preact-render-to-string': string; vite: string };
};

export function rowFor({ version, peerDependencies: peers }: CompatibilityManifest): string {
  return `| ${version} | ${peers.void} | ${peers.preact} | ${peers['preact-render-to-string']} | ${peers.vite} |`;
}

export const compatibilityRow = rowFor(manifest);
