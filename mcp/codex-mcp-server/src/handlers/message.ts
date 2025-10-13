import path from 'node:path';

import { createCliExitError, createErrorResult } from '../errors/cli.js';
import { formatJson, tryParseJson } from '../utils/format.js';
import { run } from '../utils/childProcess.js';
import type { HandlerContext, ToolResult } from './types.js';
import { ensureJobSh } from './utils.js';

/**
 * Append a message into target job's mailbox.jsonl for lightweight cross-job comms.
 */
export async function handleMessage(
  params: Record<string, unknown>,
  ctx: HandlerContext
): Promise<ToolResult> {
  const jobMissing = ensureJobSh(ctx, 'codex.message', { jobId: 'cdx-20250101_000000-demo' });
  if (jobMissing) {
    return jobMissing;
  }
  const to = String(params.to || '').trim();
  const message = String(params.message || '').trim();
  const from = typeof params.from === 'string' ? String(params.from) : '';
  const channel = typeof params.channel === 'string' ? String(params.channel) : 'default';
  const cwd = typeof params.cwd === 'string' ? String(params.cwd) : path.dirname(ctx.jobSh);
  if (!to) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: '缺少 to 参数（目标 jobId）',
      hint: '例如：{ to: "cdx-20250101_000000-demo", message: "..." }',
    });
  }
  if (!message) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: '缺少 message 文本',
      hint: '请传入 message: string',
    });
  }

  // Use job.sh status to resolve the target run directory via log_file dirname
  const pass = ['status', to, '--json', '--cwd', cwd];
  const result = await run(ctx.jobSh, pass);
  if (result.code !== 0) {
    return createCliExitError(`${ctx.jobSh} ${pass.join(' ')}`, result);
  }
  const parsed = tryParseJson(result.stdout.trim());
  if (!parsed || typeof parsed !== 'object') {
    return createErrorResult({ code: 'INTERNAL', message: '解析状态响应失败' });
  }
  const record = parsed as Record<string, unknown>;
  const logFile = typeof record.log_file === 'string' ? (record.log_file as string) : '';
  if (!logFile) {
    return createErrorResult({ code: 'NOT_FOUND', message: '目标任务未找到日志，可能已被清理。' });
  }
  // mailbox.jsonl path
  const runDir = path.dirname(logFile);
  const mailbox = path.join(runDir, 'mailbox.jsonl');
  const entry = {
    timestamp: new Date().toISOString(),
    from: from || '<anonymous>',
    to,
    channel,
    message,
  } as const;
  const fs = await import('node:fs/promises');
  const line = JSON.stringify(entry);
  await fs.mkdir(runDir, { recursive: true, mode: 0o700 }).catch(() => void 0);
  await fs.appendFile(mailbox, line + '\n', { encoding: 'utf-8', mode: 0o600 });
  await fs.chmod(mailbox, 0o600).catch(() => void 0);

  const payload = {
    delivered: true,
    to,
    runDir,
    mailbox,
    preview: message.slice(0, 80),
    next: {
      status: { name: 'codex.status', arguments: { jobId: to, cwd } },
      logs: { name: 'codex.logs', arguments: { jobId: to, mode: 'lines', tailLines: 50, cwd } },
    },
  };
  return { content: [{ type: 'text', text: formatJson(payload) }] };
}
