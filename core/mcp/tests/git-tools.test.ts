import { beforeEach, describe, expect, it } from 'vitest';

import type {
  GitOperationTools,
  MCPToolDefinition,
  MCPToolContext,
  MCPToolResult,
  MCPLogger,
} from '../../../specs/__archive/001-docs-readme-phases/contracts/mcp-service.js';

class NoopLogger implements MCPLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe('GitOperationTools (T025)', () => {
  let ctx: MCPToolContext;
  let repo: {
    branch: string;
    branches: Set<string>;
    staged: string[];
    commits: string[];
    remoteAhead: number;
    remoteBehind: number;
  };
  let tools: GitOperationTools;

  beforeEach(() => {
    ctx = {
      requestId: 'req-git',
      clientInfo: { name: 'test', version: '1.0.0', capabilities: {} },
      serverInfo: { name: 'fake', version: '0.1.0', capabilities: {} },
      logger: new NoopLogger(),
      workingDirectory: process.cwd(),
      permissions: {
        readFileSystem: true,
        writeFileSystem: true,
        executeCommands: false,
        networkAccess: false,
        containerAccess: false,
        gitAccess: true,
      },
    };

    repo = {
      branch: 'main',
      branches: new Set(['main']),
      staged: [],
      commits: [],
      remoteAhead: 0,
      remoteBehind: 0,
    };

    const gitStatus: MCPToolDefinition = {
      name: 'git.status',
      description: 'Get repo status',
      inputSchema: { type: 'object' },
      handler: async () => {
        return {
          content: [
            { type: 'text', text: JSON.stringify({ branch: repo.branch, staged: repo.staged }) },
          ],
        };
      },
      category: 'git',
      version: '1.0.0',
    };

    const gitCommit: MCPToolDefinition = {
      name: 'git.commit',
      description: 'Create a commit',
      inputSchema: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
      handler: async (args) => {
        const hash = Math.random().toString(16).slice(2, 9);
        repo.commits.push(`${hash} ${args.message}`);
        repo.staged = [];
        repo.remoteAhead += 1;
        return { content: [{ type: 'text', text: hash }] };
      },
      category: 'git',
      version: '1.0.0',
    };

    const gitBranch: MCPToolDefinition = {
      name: 'git.branch',
      description: 'Create/list/switch branches',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' }, action: { type: 'string' } },
        required: ['action'],
      },
      handler: async (args) => {
        if (args.action === 'list') {
          return { content: [{ type: 'text', text: JSON.stringify(Array.from(repo.branches)) }] };
        }
        if (args.action === 'create' && args.name) {
          repo.branches.add(args.name);
          return { content: [{ type: 'text', text: 'OK' }] };
        }
        if (args.action === 'switch' && args.name && repo.branches.has(args.name)) {
          repo.branch = args.name;
          return { content: [{ type: 'text', text: 'OK' }] };
        }
        return { content: [{ type: 'text', text: 'INVALID' }], isError: true };
      },
      category: 'git',
      version: '1.0.0',
    };

    const gitMerge: MCPToolDefinition = {
      name: 'git.merge',
      description: 'Merge branch',
      inputSchema: { type: 'object', properties: { from: { type: 'string' } }, required: ['from'] },
      handler: async (args) => {
        // For stub, just record a merge commit
        const hash = Math.random().toString(16).slice(2, 9);
        repo.commits.push(`${hash} Merge from ${args.from}`);
        repo.remoteAhead += 1;
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'git',
      version: '1.0.0',
    };

    const gitPush: MCPToolDefinition = {
      name: 'git.push',
      description: 'Push to remote',
      inputSchema: { type: 'object' },
      handler: async () => {
        repo.remoteAhead = 0;
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'git',
      version: '1.0.0',
    };

    const gitPull: MCPToolDefinition = {
      name: 'git.pull',
      description: 'Pull from remote',
      inputSchema: { type: 'object' },
      handler: async () => {
        repo.remoteBehind = 0;
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'git',
      version: '1.0.0',
    };

    const createPR: MCPToolDefinition = {
      name: 'git.pr.create',
      description: 'Create pull request',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          base: { type: 'string' },
          head: { type: 'string' },
        },
        required: ['title', 'base', 'head'],
      },
      handler: async (args) => {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ number: 1, url: `https://example/pr/1`, title: args.title }),
            },
          ],
        };
      },
      category: 'git',
      version: '1.0.0',
    };

    tools = { gitStatus, gitCommit, gitBranch, gitMerge, gitPush, gitPull, createPR };
  });

  it('performs basic git flows via tools', async () => {
    const status1 = await tools.gitStatus.handler({}, ctx);
    expect(JSON.parse(status1.content[0].text ?? '{}').branch).toBe('main');

    const commit = await tools.gitCommit.handler({ message: 'init' }, ctx);
    expect((commit.content[0].text ?? '').length).toBeGreaterThan(0);

    const branchList = await tools.gitBranch.handler({ action: 'list' }, ctx);
    expect(JSON.parse(branchList.content[0].text ?? '[]')).toContain('main');

    await tools.gitBranch.handler({ action: 'create', name: 'feat/x' }, ctx);
    await tools.gitBranch.handler({ action: 'switch', name: 'feat/x' }, ctx);
    const status2 = await tools.gitStatus.handler({}, ctx);
    expect(JSON.parse(status2.content[0].text ?? '{}').branch).toBe('feat/x');

    const merge = await tools.gitMerge.handler({ from: 'main' }, ctx);
    expect(merge.isError).toBeFalsy();

    const pr = await tools.createPR.handler({ title: 'PR', base: 'main', head: 'feat/x' }, ctx);
    const prObj = JSON.parse(pr.content[0].text ?? '{}');
    expect(prObj.url).toContain('/pr/1');

    const push = await tools.gitPush.handler({}, ctx);
    expect(push.isError).toBeFalsy();

    const pull = await tools.gitPull.handler({}, ctx);
    expect(pull.isError).toBeFalsy();
  });
});
