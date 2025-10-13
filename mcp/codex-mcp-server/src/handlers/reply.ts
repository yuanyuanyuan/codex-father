import path from 'node:path';

import { createCliExitError, createErrorResult } from '../errors/cli.js';
import { formatJson, tryParseJson } from '../utils/format.js';
import { run } from '../utils/childProcess.js';
import type { HandlerContext, ToolResult } from './types.js';
import { applyConvenienceOptions } from './options.js';
import { ensureJobSh, ensureStartSh } from './utils.js';

export async function handleReply(
  params: Record<string, unknown>,
  ctx: HandlerContext
): Promise<ToolResult> {
  const jobMissing = ensureJobSh(ctx, 'codex.reply', { jobId: 'cdx-20250101_000000-demo' });
  if (jobMissing) {
    return jobMissing;
  }
  const startMissing = ensureStartSh(ctx, 'codex.reply', {
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
      hint: '请提供要回复的任务编号，可通过 codex.list 或 codex.status 查询。',
      example: {
        name: 'codex.reply',
        arguments: { jobId: 'cdx-20250101_000000-demo', message: '继续：请把步骤 3 自动化。' },
      },
    });
  }

  const message = typeof params.message === 'string' ? (params.message as string) : '';
  const messageFile = typeof params.messageFile === 'string' ? (params.messageFile as string) : '';
  if (!message && !messageFile) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: '需要提供 message 或 messageFile（至少其一）',
      hint: 'message 直接传文本；大体量文本建议使用 messageFile 传入路径。',
      example: {
        name: 'codex.reply',
        arguments: { jobId: 'cdx-20250101_000000-demo', message: '继续执行安全加固。' },
      },
    });
  }

  const roleRaw = typeof params.role === 'string' ? String(params.role).toLowerCase() : '';
  const role: 'user' | 'system' = roleRaw === 'system' ? 'system' : 'user';
  // 默认 position=append；若 role=system 且未显式传入，则隐式置为 prepend
  const positionParam =
    typeof params.position === 'string' ? String(params.position).toLowerCase() : '';
  const position =
    (positionParam || (role === 'system' ? 'prepend' : 'append')) === 'prepend'
      ? 'prepend'
      : 'append';

  const env: NodeJS.ProcessEnv = { ...process.env };
  if (messageFile) {
    if (position === 'prepend') env.PREPEND_FILE = messageFile;
    else env.APPEND_FILE = messageFile;
  }
  if (message) {
    const ts = new Date().toISOString();
    const wrapped = `<instructions-reply at="${ts}" role="${role}">\n${message}\n</instructions-reply>`;
    if (position === 'prepend') env.PREPEND_CONTENT = wrapped;
    else env.APPEND_CONTENT = wrapped;
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
  applyConvenienceOptions(appended, params as Record<string, unknown> as any);
  if (appended.length) {
    pass.push('--', ...appended);
  }

  const result = await run(ctx.jobSh, pass, undefined, { env });
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

    const payload: Record<string, unknown> = {
      jobId: newJobId,
      repliedTo: sourceJobId,
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
      hint: '已基于历史任务参数追加回复并启动新作业，请保存新的 jobId 并使用 codex.status / codex.logs 继续追踪。',
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
