import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import type { CliLogger } from '../logger.js';
import type { TransportKind } from '../config/env.js';
import { NdjsonServerTransport } from './ndjson.js';
import { ContentLengthServerTransport } from './contentLength.js';

export function describeTransport(kind: TransportKind): string {
  switch (kind) {
    case 'content-length':
      return 'stdio (Content-Length JSON-RPC)';
    case 'ndjson':
    default:
      return 'NDJSON (逐行 JSON-RPC)';
  }
}

export function createTransport(
  kind: TransportKind,
  logger: CliLogger
): StdioServerTransport | NdjsonServerTransport | ContentLengthServerTransport {
  if (kind === 'content-length') {
    return new ContentLengthServerTransport(logger);
  }
  // 默认使用 NDJSON，更贴近当前 SDK 的 stdio 实现
  return new NdjsonServerTransport(logger);
}
