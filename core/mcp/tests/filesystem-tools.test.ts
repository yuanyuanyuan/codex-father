import { beforeEach, describe, expect, it } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
  cpSync,
  renameSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type {
  FileSystemTools,
  MCPToolDefinition,
  MCPToolContext,
  MCPToolResult,
  MCPLogger,
} from '../../../specs/001-docs-readme-phases/contracts/mcp-service.ts';

class NoopLogger implements MCPLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe('FileSystemTools (T024)', () => {
  let cwd: string;
  let ctx: MCPToolContext;
  let tools: FileSystemTools;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'mcp-fs-'));
    ctx = {
      requestId: 'req-fs',
      clientInfo: { name: 'test', version: '1.0.0', capabilities: {} },
      serverInfo: { name: 'fake', version: '0.1.0', capabilities: {} },
      logger: new NoopLogger(),
      workingDirectory: cwd,
      permissions: {
        readFileSystem: true,
        writeFileSystem: true,
        executeCommands: false,
        networkAccess: false,
        containerAccess: false,
        gitAccess: false,
      },
    };

    const readFile: MCPToolDefinition = {
      name: 'fs.read',
      description: 'Read a file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      handler: async (args) => {
        if (!ctx.permissions.readFileSystem)
          return { content: [{ type: 'text', text: 'PERMISSION_DENIED' }], isError: true };
        const p = join(ctx.workingDirectory, args.path);
        const text = readFileSync(p, 'utf8');
        return { content: [{ type: 'text', text }] };
      },
      category: 'fs',
      version: '1.0.0',
    };

    const writeFile: MCPToolDefinition = {
      name: 'fs.write',
      description: 'Write a file',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string' }, content: { type: 'string' } },
        required: ['path', 'content'],
      },
      handler: async (args) => {
        if (!ctx.permissions.writeFileSystem)
          return { content: [{ type: 'text', text: 'PERMISSION_DENIED' }], isError: true };
        const p = join(ctx.workingDirectory, args.path);
        writeFileSync(p, args.content);
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'fs',
      version: '1.0.0',
    };

    const listDirectory: MCPToolDefinition = {
      name: 'fs.ls',
      description: 'List directory',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      handler: async (args) => {
        const p = join(ctx.workingDirectory, args.path);
        const entries = readdirSync(p);
        return { content: [{ type: 'text', text: JSON.stringify(entries) }] };
      },
      category: 'fs',
      version: '1.0.0',
    };

    const createDirectory: MCPToolDefinition = {
      name: 'fs.mkdir',
      description: 'Create directory',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      handler: async (args) => {
        const p = join(ctx.workingDirectory, args.path);
        mkdirSync(p, { recursive: true });
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'fs',
      version: '1.0.0',
    };

    const deleteFile: MCPToolDefinition = {
      name: 'fs.rm',
      description: 'Delete file',
      inputSchema: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
      handler: async (args) => {
        const p = join(ctx.workingDirectory, args.path);
        rmSync(p, { force: true, recursive: false });
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'fs',
      version: '1.0.0',
    };

    const copyFile: MCPToolDefinition = {
      name: 'fs.cp',
      description: 'Copy file',
      inputSchema: {
        type: 'object',
        properties: { src: { type: 'string' }, dest: { type: 'string' } },
        required: ['src', 'dest'],
      },
      handler: async (args) => {
        const src = join(ctx.workingDirectory, args.src);
        const dest = join(ctx.workingDirectory, args.dest);
        cpSync(src, dest);
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'fs',
      version: '1.0.0',
    };

    const moveFile: MCPToolDefinition = {
      name: 'fs.mv',
      description: 'Move/Rename file',
      inputSchema: {
        type: 'object',
        properties: { src: { type: 'string' }, dest: { type: 'string' } },
        required: ['src', 'dest'],
      },
      handler: async (args) => {
        const src = join(ctx.workingDirectory, args.src);
        const dest = join(ctx.workingDirectory, args.dest);
        renameSync(src, dest);
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'fs',
      version: '1.0.0',
    };

    tools = { readFile, writeFile, listDirectory, createDirectory, deleteFile, copyFile, moveFile };
  });

  it('performs file operations with permission checks', async () => {
    // create dir and file
    await tools.createDirectory.handler({ path: 'data' }, ctx);
    await tools.writeFile.handler({ path: 'data/a.txt', content: 'hello' }, ctx);

    const ls = await tools.listDirectory.handler({ path: 'data' }, ctx);
    expect(JSON.parse(ls.content[0].text ?? '[]')).toEqual(['a.txt']);

    const read = await tools.readFile.handler({ path: 'data/a.txt' }, ctx);
    expect(read.content[0].text).toBe('hello');

    await tools.copyFile.handler({ src: 'data/a.txt', dest: 'data/b.txt' }, ctx);
    const readB = await tools.readFile.handler({ path: 'data/b.txt' }, ctx);
    expect(readB.content[0].text).toBe('hello');

    await tools.moveFile.handler({ src: 'data/b.txt', dest: 'data/c.txt' }, ctx);
    const ls2 = await tools.listDirectory.handler({ path: 'data' }, ctx);
    expect(JSON.parse(ls2.content[0].text ?? '[]').sort()).toEqual(['a.txt', 'c.txt']);

    await tools.deleteFile.handler({ path: 'data/c.txt' }, ctx);
    const ls3 = await tools.listDirectory.handler({ path: 'data' }, ctx);
    expect(JSON.parse(ls3.content[0].text ?? '[]')).toEqual(['a.txt']);

    // permission check
    ctx.permissions.readFileSystem = false;
    const denied = await tools.readFile.handler({ path: 'data/a.txt' }, ctx);
    expect(denied.isError).toBe(true);
  });
});
