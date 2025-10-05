import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type {
  MCPResourceDefinition,
  MCPResourceContext,
  MCPResourceContent,
  MCPAnnotation,
  MCPPermissions,
  CachePolicy,
  MCPLogger,
} from '../../../specs/__archive/001-docs-readme-phases/contracts/mcp-service.js';

class NoopLogger implements MCPLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe('MCP Resources (T027)', () => {
  let cwd: string;
  let cache = new Map<string, { value: MCPResourceContent; ts: number }>();
  let context: MCPResourceContext;
  let permissions: MCPPermissions;
  let cachePolicy: CachePolicy;
  let fileRes: MCPResourceDefinition;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'mcp-res-'));
    writeFileSync(join(cwd, 'a.txt'), 'hello');
    cache = new Map();

    permissions = {
      readFileSystem: true,
      writeFileSystem: false,
      executeCommands: false,
      networkAccess: false,
      containerAccess: false,
      gitAccess: false,
    };
    cachePolicy = { enabled: true, ttl: 5, maxSize: 1024 * 1024, strategy: 'lru' };

    context = {
      requestId: 'req-res',
      clientInfo: { name: 'test', version: '1.0.0', capabilities: {} },
      permissions,
      cachePolicy,
    };

    fileRes = {
      uri: 'file://a.txt',
      name: 'file-reader',
      description: 'Read files from working dir',
      mimeType: 'text/plain',
      annotations: [{ type: 'source', text: 'local' } as MCPAnnotation],
      handler: async (uri: string, ctx: MCPResourceContext): Promise<MCPResourceContent> => {
        if (!ctx.permissions.readFileSystem) {
          throw Object.assign(new Error('denied'), { code: -32003 });
        }

        const now = Date.now() / 1000;
        const key = `${cwd}:${uri}`;
        if (ctx.cachePolicy.enabled) {
          const ent = cache.get(key);
          if (ent && now - ent.ts <= ctx.cachePolicy.ttl) {
            return ent.value;
          }
        }

        const path = uri.replace('file://', '');
        const text = await Promise.resolve().then(() =>
          require('node:fs').readFileSync(join(cwd, path), 'utf8')
        );
        const content: MCPResourceContent = {
          uri,
          mimeType: 'text/plain',
          text,
          annotations: [{ type: 'fresh', text: 'loaded' }],
        };
        cache.set(key, { value: content, ts: now });
        return content;
      },
      category: 'fs',
      cacheable: true,
      permissions: ['read'],
    };
  });

  it('reads resources with permission and caches by TTL', async () => {
    const res1 = await fileRes.handler('file://a.txt', context);
    expect(res1.text).toBe('hello');

    // simulate file change but within TTL, expect cached
    writeFileSync(join(cwd, 'a.txt'), 'changed');
    const res2 = await fileRes.handler('file://a.txt', context);
    expect(res2.text).toBe('hello');

    // advance time beyond ttl
    const nowSpy = vi.spyOn(Date, 'now');
    const future = Date.now() + 7000;
    nowSpy.mockReturnValue(future);
    const res3 = await fileRes.handler('file://a.txt', context);
    expect(res3.text).toBe('changed');
    nowSpy.mockRestore();
  });

  it('denies access without permission', async () => {
    context.permissions.readFileSystem = false;
    await expect(fileRes.handler('file://a.txt', context)).rejects.toBeTruthy();
  });
});
