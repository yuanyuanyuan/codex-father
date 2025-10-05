import type { FallbackRuntime } from '../fallback/runtime.js';

export type ToolTextContent = {
  type: 'text';
  text: string;
};

export type ToolStructuredContent = Record<string, unknown>;

export type ToolResult = {
  content: ToolTextContent[];
  structuredContent?: ToolStructuredContent;
  isError?: boolean;
};

export type HandlerContext = {
  jobSh: string;
  startSh: string;
  projectRoot: string;
  jobShExists: boolean;
  startShExists: boolean;
  fallback: FallbackRuntime | null;
};
