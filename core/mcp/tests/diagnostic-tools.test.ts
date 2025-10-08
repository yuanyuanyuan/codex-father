import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ApprovalMode, SandboxPolicy } from '../../lib/types.js';
import {
  BridgeLayer,
  createBridgeLayer,
  type ISessionManager,
  registerDiagnosticTools,
} from '../bridge-layer.js';

describe('BridgeLayer diagnostic tools (T007 skeleton)', () => {
  let bridge: BridgeLayer;
  let tmp: string;

  beforeEach(async () => {
    const mockSessionManager: ISessionManager = {
      createSession: async () => ({
        conversationId: 'conv',
        jobId: 'job',
        rolloutPath: '/tmp/rollout.jsonl',
      }),
      sendUserMessage: async () => undefined,
      handleApprovalRequest: async () => 'allow',
      getJobIdByConversationId: () => 'job',
    } as any;

    bridge = createBridgeLayer({
      sessionManager: mockSessionManager,
      defaultApprovalMode: ApprovalMode.ON_REQUEST,
      defaultSandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
    });
    await registerDiagnosticTools(bridge);
    tmp = await mkdtemp(join(tmpdir(), 'mcp-diag-'));
  });

  afterEach(async () => {
    await rm(tmp, { recursive: true, force: true });
  });

  it('exposes read-report-file and read-events-preview tools', async () => {
    const tools = bridge.getTools();
    const names = tools.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'start-codex-task',
        'read-report-file',
        'read-events-preview',
        'read-session-artifacts',
        'list-tools',
        'ping-bridge',
        'echo',
        'exists',
        'stat-path',
        'list-dir',
        'list-sessions',
        'get-latest-session',
        'read-report-metrics',
        'grep-events',
        'resolve-path',
        'call-with-downgrade',
      ])
    );
    // ≥15 工具
    expect(names.length).toBeGreaterThanOrEqual(15);
  });

  it('supports call-with-downgrade for unknown tool (405-like)', async () => {
    const result = await bridge.callTool('call-with-downgrade', {
      targetTool: 'non-existent-tool',
      fallback: { ok: true },
    });
    expect((result as any).degraded).toBe(true);
    expect((result as any).reason).toBe('method_not_allowed');
    expect((result as any).result).toEqual({ ok: true });
  });

  it('supports call-with-downgrade invalid arguments classification', async () => {
    const result = await bridge.callTool('call-with-downgrade', {
      targetTool: 'read-report-file',
      arguments: {},
      fallback: null,
    });
    expect((result as any).degraded).toBe(true);
    expect((result as any).reason).toBe('invalid_arguments');
    expect((result as any).result).toBeNull();
  });

  it('classifies not_found via call-with-downgrade when report path missing', async () => {
    const missing = join(tmp, 'missing-report.json');
    const result = await bridge.callTool('call-with-downgrade', {
      targetTool: 'read-report-file',
      arguments: { path: missing },
      fallback: null,
    });
    expect((result as any).degraded).toBe(true);
    expect((result as any).reason).toBe('not_found');
  });

  it('classifies invalid_arguments when path is relative (absolute required)', async () => {
    const result = await bridge.callTool('call-with-downgrade', {
      targetTool: 'read-report-file',
      arguments: { path: 'relative.json' },
      fallback: null,
    });
    expect((result as any).degraded).toBe(true);
    expect((result as any).reason).toBe('invalid_arguments');
  });

  it('classifies permission_denied when reading a non-readable file', async () => {
    // 在临时目录中创建子目录并写入文件，随后移除目录可读权限
    const dir = join(tmp, 'no-read');
    const file = join(dir, 'report.json');
    const { mkdir, chmod } = await import('node:fs/promises');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await writeFile(file, JSON.stringify({ ok: true }), 'utf-8');
    // 去除目录执行/读权限，模拟无法遍历/读取
    await chmod(dir, 0o000);
    const result = await bridge.callTool('call-with-downgrade', {
      targetTool: 'read-report-file',
      arguments: { path: file },
      fallback: null,
    });
    // 还原权限以便 afterEach 清理
    await chmod(dir, 0o700);
    expect((result as any).degraded).toBe(true);
    expect((result as any).reason).toBe('permission_denied');
  });

  it('reads report.json via read-report-file', async () => {
    const reportPath = join(tmp, 'report.json');
    await writeFile(
      reportPath,
      JSON.stringify({ status: 'succeeded', metrics: { totalExecutionMs: 1 } }),
      'utf-8'
    );

    const result = await bridge.callTool('read-report-file', { path: reportPath });
    expect((result as any).status).toBe('ok');
    expect((result as any).path).toBe(reportPath);
    expect((result as any).report.status).toBe('succeeded');
    expect(typeof (result as any).report.metrics.totalExecutionMs).toBe('number');
  });

  it('reads last lines of events.jsonl via read-events-preview', async () => {
    const eventsPath = join(tmp, 'events.jsonl');
    const lines = ['{"event":"start"}', '{"event":"orchestration_completed"}'];
    await writeFile(eventsPath, lines.join('\n') + '\n', 'utf-8');

    const result = await bridge.callTool('read-events-preview', { path: eventsPath, limit: 1 });
    expect((result as any).status).toBe('ok');
    expect((result as any).count).toBe(1);
    expect(((result as any).lines as string[])[0]).toContain('orchestration_completed');
  });

  it('read-report-metrics enforces absolute path and maps errors', async () => {
    const rel = 'report.json';
    const absMissing = join(tmp, 'missing-report.json');

    // 相对路径 → invalid_arguments
    const r1 = await bridge.callTool('call-with-downgrade', {
      targetTool: 'read-report-metrics',
      arguments: { path: rel },
      fallback: null,
    });
    expect((r1 as any).degraded).toBe(true);
    expect((r1 as any).reason).toBe('invalid_arguments');

    // 不存在 → not_found
    const r2 = await bridge.callTool('call-with-downgrade', {
      targetTool: 'read-report-metrics',
      arguments: { path: absMissing },
      fallback: null,
    });
    expect((r2 as any).degraded).toBe(true);
    expect((r2 as any).reason).toBe('not_found');
  });

  it('grep-events enforces absolute path and non-empty q', async () => {
    const eventsPath = join(tmp, 'events.jsonl');
    await writeFile(
      eventsPath,
      '{"event":"start"}\n{"event":"orchestration_completed"}\n',
      'utf-8'
    );

    // 空 q → invalid_arguments
    const r1 = await bridge.callTool('call-with-downgrade', {
      targetTool: 'grep-events',
      arguments: { path: eventsPath, q: '' },
      fallback: null,
    });
    expect((r1 as any).degraded).toBe(true);
    expect((r1 as any).reason).toBe('invalid_arguments');

    // 相对路径 → invalid_arguments
    const r2 = await bridge.callTool('call-with-downgrade', {
      targetTool: 'grep-events',
      arguments: { path: 'events.jsonl', q: 'start' },
      fallback: null,
    });
    expect((r2 as any).degraded).toBe(true);
    expect((r2 as any).reason).toBe('invalid_arguments');

    // 不存在 → not_found
    const r3 = await bridge.callTool('call-with-downgrade', {
      targetTool: 'grep-events',
      arguments: { path: join(tmp, 'missing.jsonl'), q: 'start' },
      fallback: null,
    });
    expect((r3 as any).degraded).toBe(true);
    expect((r3 as any).reason).toBe('not_found');
  });

  it('grep-events supports ignoreCase and regex modes', async () => {
    const p = join(tmp, 'ev.case.jsonl');
    await writeFile(
      p,
      ['{"event":"START"}', '{"event":"orchestration_completed"}', '{"event":"start"}'].join('\n') +
        '\n',
      'utf-8'
    );

    // ignoreCase=false （默认），“start”仅匹配小写一行
    const r1 = await bridge.callTool('grep-events', { path: p, q: 'start' });
    expect((r1 as any).status).toBe('ok');
    expect((r1 as any).count).toBe(1);

    // ignoreCase=true → 匹配两行（START 与 start）
    const r2 = await bridge.callTool('grep-events', {
      path: p,
      q: 'start',
      ignoreCase: true,
    });
    expect((r2 as any).count).toBe(2);

    // regex=true，匹配两类事件名
    const r3 = await bridge.callTool('grep-events', {
      path: p,
      q: '"event":"(start|orchestration_completed)"',
      regex: true,
      ignoreCase: true,
    });
    expect((r3 as any).count).toBe(3);

    // 非法正则 → invalid_arguments（经 call-with-downgrade 分类）
    const r4 = await bridge.callTool('call-with-downgrade', {
      targetTool: 'grep-events',
      arguments: { path: p, q: '(**', regex: true },
      fallback: null,
    });
    expect((r4 as any).degraded).toBe(true);
    expect((r4 as any).reason).toBe('invalid_arguments');
  });

  it('resolves session artifacts via read-session-artifacts', async () => {
    const sid = 'orc-test-1';
    const base = tmp;
    const sessionDir = join(base, '.codex-father', 'sessions', sid);
    const eventsPath = join(sessionDir, 'events.jsonl');
    const reportPath = join(sessionDir, 'report.json');
    // Ensure directories exist
    await writeFile(eventsPath, '{"event":"start"}\n', { encoding: 'utf-8', flag: 'w' }).catch(
      async (e) => {
        if ((e as any)?.code === 'ENOENT') {
          // recursively create dirs then retry
          const { mkdir } = await import('node:fs/promises');
          await mkdir(sessionDir, { recursive: true });
          await writeFile(eventsPath, '{"event":"start"}\n', { encoding: 'utf-8', flag: 'w' });
        } else {
          throw e;
        }
      }
    );
    await writeFile(reportPath, JSON.stringify({ status: 'succeeded' }), {
      encoding: 'utf-8',
      flag: 'w',
    });

    const result = await bridge.callTool('read-session-artifacts', {
      sessionId: sid,
      baseDir: base,
    });
    expect((result as any).status).toBe('ok');
    expect((result as any).reportPath).toBe(reportPath);
    expect((result as any).eventsPath).toBe(eventsPath);
  });
});
