import manifest from '../../packages/preact/package.json' with { type: 'json' };

const { void: voidVersion, preact, 'preact-render-to-string': renderToString, vite } = manifest.peerDependencies;

export const compatibilityRow = `| ${manifest.version} | ${voidVersion} | ${preact} | ${renderToString} | ${vite} |`;
