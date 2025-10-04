import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';

import gitDiffToRemoteSchema from '../../specs/008-ultrathink-codex-0/contracts/gitDiffToRemote.schema.json';
import execOneOffCommandSchema from '../../specs/008-ultrathink-codex-0/contracts/execOneOffCommand.schema.json';

import { handleGitDiffToRemote, handleExecOneOffCommand } from '../../src/mcp/utilHandlers';

const ajv = new Ajv({ strict: false });

describe('utilHandlers.gitDiffToRemote', () => {
  const requestSchema = (gitDiffToRemoteSchema as any).definitions
    ? {
        ...(gitDiffToRemoteSchema as any).request,
        definitions: (gitDiffToRemoteSchema as any).definitions,
      }
    : (gitDiffToRemoteSchema as any).request;
  const responseSchema = (gitDiffToRemoteSchema as any).definitions
    ? {
        ...(gitDiffToRemoteSchema as any).response,
        definitions: (gitDiffToRemoteSchema as any).definitions,
      }
    : (gitDiffToRemoteSchema as any).response;

  it('应返回 diff/sha 并通过契约校验', async () => {
    const validateRes = ajv.compile(responseSchema);
    const req = {
      jsonrpc: '2.0' as const,
      id: 'req-git-1',
      method: 'gitDiffToRemote',
      params: { cwd: '/repo' },
    } as const;

    const res = await handleGitDiffToRemote(req, async (params) => {
      expect(params).toEqual({ cwd: '/repo' });
      return {
        sha: '0000000000000000000000000000000000000000',
        diff: 'diff --git a/x b/x\n...',
      };
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-git-1');
    expect(validateRes(res.result)).toBe(true);
  });

  it('method 不匹配应报错', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 2, method: 'unknown', params: { cwd: '/r' } } as any;
    await expect(
      handleGitDiffToRemote(bad, () => ({ sha: '0'.repeat(40), diff: '' }))
    ).rejects.toThrow(/invalid method/i);
  });

  it('缺少必要参数 cwd 应报错', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 3, method: 'gitDiffToRemote' } as any;
    await expect(
      handleGitDiffToRemote(bad, () => ({ sha: '0'.repeat(40), diff: '' }))
    ).rejects.toThrow(/invalid gitdifftoremote request parameters/i);
  });

  it('传入额外参数应被拒绝', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 4,
      method: 'gitDiffToRemote',
      params: { cwd: '/repo', extra: true },
    } as any;
    await expect(
      handleGitDiffToRemote(bad, () => ({ sha: '0'.repeat(40), diff: '' }))
    ).rejects.toThrow(/invalid gitdifftoremote request parameters/i);
  });

  it('契约：cwd 为必填且不允许额外字段', () => {
    const validateReq = ajv.compile(requestSchema);
    expect(validateReq({ cwd: '/repo' })).toBe(true);
    expect(validateReq({})).toBe(false);
    expect(validateReq({ cwd: '/repo', extra: 1 })).toBe(false);
  });
});

describe('utilHandlers.execOneOffCommand', () => {
  const requestSchema = (execOneOffCommandSchema as any).definitions
    ? {
        ...(execOneOffCommandSchema as any).request,
        definitions: (execOneOffCommandSchema as any).definitions,
      }
    : (execOneOffCommandSchema as any).request;
  const responseSchema = (execOneOffCommandSchema as any).definitions
    ? {
        ...(execOneOffCommandSchema as any).response,
        definitions: (execOneOffCommandSchema as any).definitions,
      }
    : (execOneOffCommandSchema as any).response;

  it('应执行命令并通过契约校验（含可选参数）', async () => {
    const validateRes = ajv.compile(responseSchema);
    const req = {
      jsonrpc: '2.0' as const,
      id: 'req-exec-1',
      method: 'execOneOffCommand',
      params: {
        command: ['echo', 'hi'],
        timeoutMs: 5000,
        cwd: '/tmp',
        sandboxPolicy: 'workspace-write' as const,
      },
    } as const;

    const res = await handleExecOneOffCommand(req, async (params) => {
      expect(params.command).toEqual(['echo', 'hi']);
      expect(params.timeoutMs).toBe(5000);
      expect(params.cwd).toBe('/tmp');
      expect(params.sandboxPolicy).toBe('workspace-write');
      return { exitCode: 0, stdout: 'hi\n', stderr: '', output: 'hi\n' };
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-exec-1');
    expect(validateRes(res.result)).toBe(true);
  });

  it('最小参数（仅 command）应通过', async () => {
    const validateRes = ajv.compile(responseSchema);
    const req = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'execOneOffCommand',
      params: { command: ['true'] },
    } as const;

    const res = await handleExecOneOffCommand(req, async (params) => {
      expect(params).toEqual({ command: ['true'] });
      return { exitCode: 0, stdout: '', stderr: '' };
    });
    expect(validateRes(res.result)).toBe(true);
  });

  it('method 不匹配应报错', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 3,
      method: 'unknown',
      params: { command: ['x'] },
    } as any;
    await expect(
      handleExecOneOffCommand(bad, () => ({ exitCode: 127, stdout: '', stderr: 'not found' }))
    ).rejects.toThrow(/invalid method/i);
  });

  it('缺少必要参数 command 应报错', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 4, method: 'execOneOffCommand', params: {} } as any;
    await expect(
      handleExecOneOffCommand(bad, () => ({ exitCode: 1, stdout: '', stderr: 'err' }))
    ).rejects.toThrow(/invalid execoneoffcommand request parameters/i);
  });

  it('传入额外参数应被拒绝', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 5,
      method: 'execOneOffCommand',
      params: { command: ['x'], foo: 'bar' },
    } as any;
    await expect(
      handleExecOneOffCommand(bad, () => ({ exitCode: 0, stdout: '', stderr: '' }))
    ).rejects.toThrow(/invalid execoneoffcommand request parameters/i);
  });

  it('契约：command 为非空字符串数组，timeoutMs>=1，sandboxPolicy 枚举；不允许额外字段', () => {
    const validateReq = ajv.compile(requestSchema);
    expect(validateReq({ command: ['echo', 'x'] })).toBe(true);
    expect(validateReq({ command: [] })).toBe(false);
    expect(validateReq({ command: ['x'], timeoutMs: 0 })).toBe(false);
    expect(validateReq({ command: ['x'], sandboxPolicy: 'workspace-write' })).toBe(true);
    expect(validateReq({ command: ['x'], sandboxPolicy: 'nope' })).toBe(false);
    expect(validateReq({ command: ['x'], extra: 1 })).toBe(false);
  });
});
