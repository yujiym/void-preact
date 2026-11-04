import type { APIRequestContext, BrowserContext, Page } from 'playwright';

export type Adapter = 'react' | 'preact';
export type Mode = 'dev' | 'preview';
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type Observation = { [key: string]: JsonValue };

export interface ComparisonContext {
  page: Page;
  context: BrowserContext;
  request: APIRequestContext;
  base: string;
  adapter: Adapter;
  mode: Mode;
  app: string;
}

interface CaseDetails {
  id: string;
  title: string;
  sourceContracts: string[];
  covers: string[];
  allowedErrors?: string[];
  expectedRecoverableErrors?: Partial<Record<Adapter, string[]>>;
  recoveryReason?: string;
  run(context: ComparisonContext): Promise<Observation>;
}

export type ComparisonExpectation = (
  | { expectation: 'equivalent'; reason?: never }
  | { expectation: 'different'; reason: string }
);

export type ComparisonCase = CaseDetails & ComparisonExpectation;

declare global {
  interface Window {
    __comparisonDocument?: string;
    __suspenseDocument?: string;
  }
}
