import type { Adapter, ComparisonCase, ComparisonExpectation, JsonValue, Mode } from '../../e2e/types.ts';
import type upstream from '../../upstream.json';

export type CaseMetadata = Pick<ComparisonCase, 'id' | 'title' | 'sourceContracts' | 'covers'> & ComparisonExpectation;
export type PackageProof = {
  name: string;
  version: string;
  entry: string;
  private: boolean;
  preactDependency: boolean;
};
export type DependencyProof = { packages: PackageProof[]; api: Record<string, boolean> };
export type Consumer = { adapter: Adapter; app: string; runId: string; proof: DependencyProof };
export type Server = { base: string; stop: () => Promise<void>; log: string };
type Cell = { id: string; adapter: Adapter; mode: Mode };
export type PassedCell = Cell & {
  status: 'passed';
  observation: JsonValue;
  expectedErrors?: string[];
  recoveryReason?: string;
};
export type ResultCell = PassedCell
  | (Cell & { status: 'failed'; error: string; errors?: string[]; screenshot?: string })
  | (Cell & { status: 'blocked'; error: string });
export type Prepared = {
  directory: string;
  consumers: Consumer[];
  sources: { path: string; sha256: string }[];
  upstream: typeof upstream;
  tarballSha256: string;
};
export type Metadata = Partial<Prepared> & {
  node: string;
  revision: string;
  platform?: string;
  dirty?: boolean;
  artifactDirectory?: string;
  assertionFiles?: { path: string; sha256: string }[];
  sourceContracts?: { path: string; sha256: string }[];
};
export type RowStatus = 'equivalent' | 'different' | 'failed' | 'unverified';
