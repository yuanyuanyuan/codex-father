import path from 'node:path';

import { createCliExitError, createErrorResult } from '../errors/cli.js';
import { formatJson, tryParseJson } from '../utils/format.js';
import { run } from '../utils/childProcess.js';
import type { HandlerContext, ToolResult } from './types.js';
import { applyConvenienceOptions } from './options.js';
import { ensureJobSh, ensureStartSh } from './utils.js';

export async function handleResume(
  params: Record<string, unknown>,
  ctx: HandlerContext
): Promise<ToolResult> {
  const jobMissing = ensureJobSh(ctx, 'codex.resume', { jobId: 'cdx-20250101_000000-demo' });
  if (jobMissing) {
    return jobMissing;
  }
  const startMissing = ensureStartSh(ctx, 'codex.resume', {
    jobId: 'cdx-20250101_000000-demo',
  });
  if (startMissing) {
    return startMissing;
  }

  const sourceJobId = String(params.jobId || '').trim();
  if (!sourceJobId) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: '缺少 jobId 参数',
      hint: '请提供要复用参数的任务编号，可通过 codex.list 或 codex.status 查询。',
      example: { name: 'codex.resume', arguments: { jobId: 'cdx-20250101_000000-demo' } },
    });
  }

  const pass: string[] = ['resume', sourceJobId, '--json'];
  if (params.tag) {
    pass.push('--tag', String(params.tag));
  }
  const base = params.cwd ? String(params.cwd) : path.dirname(ctx.jobSh);
  if (base) {
    pass.push('--cwd', base);
  }

  const appended: string[] = Array.isArray(params.args)
    ? (params.args as unknown[]).map((value) => String(value))
    : [];
  applyConvenienceOptions(appended, params);
  if (appended.length) {
    pass.push('--', ...appended);
  }

  const result = await run(ctx.jobSh, pass);
  if (result.code !== 0) {
    return createCliExitError(`${ctx.jobSh} ${pass.join(' ')}`, result);
  }

  const trimmed = result.stdout.trim();
  const parsed = tryParseJson(trimmed);
  if (parsed && typeof parsed === 'object' && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    const newJobId = typeof record.jobId === 'string' ? (record.jobId as string) : '';
    const baseExample = newJobId || '<jobId>';
    const resolvedCwd =
      typeof record.cwd === 'string'
        ? (record.cwd as string)
        : typeof params.cwd === 'string'
          ? params.cwd
          : process.cwd();
    const resolvedTag =
      typeof params.tag === 'string'
        ? params.tag
        : typeof record.tag === 'string'
          ? (record.tag as string)
          : '';
    const resolvedLogFile = typeof record.logFile === 'string' ? (record.logFile as string) : null;
    const resolvedMetaGlob =
      typeof record.metaGlob === 'string' ? (record.metaGlob as string) : null;
    const resolvedLastMessageGlob =
      typeof record.lastMessageGlob === 'string' ? (record.lastMessageGlob as string) : null;
    const resumedFrom =
      typeof record.resumedFrom === 'string' && record.resumedFrom
        ? (record.resumedFrom as string)
        : sourceJobId;

    const payload: Record<string, unknown> = {
      jobId: newJobId,
      resumedFrom,
      cwd: resolvedCwd,
      tag: resolvedTag,
      logFile: resolvedLogFile,
      metaGlob: resolvedMetaGlob,
      lastMessageGlob: resolvedLastMessageGlob,
      next: {
        status: { name: 'codex.status', arguments: { jobId: baseExample } },
        logsTail: {
          name: 'codex.logs',
          arguments: { jobId: baseExample, mode: 'lines', tailLines: 80, view: 'result-only' },
        },
        logsStream: {
          name: 'codex.logs',
          arguments: { jobId: baseExample, mode: 'bytes', offset: 0, limit: 4096 },
        },
        stop: { name: 'codex.stop', arguments: { jobId: baseExample, force: false } },
        stopForce: { name: 'codex.stop', arguments: { jobId: baseExample, force: true } },
      },
      hint: '已基于历史任务参数启动新作业，请保存新的 jobId 并使用 codex.status / codex.logs 继续追踪。',
      raw: record,
    };

    return {
      content: [{ type: 'text', text: formatJson(payload) }],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: parsed ? formatJson(parsed) : trimmed,
      },
    ],
  };
}
