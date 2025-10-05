import path from 'node:path';

import { createCliExitError, createErrorResult } from '../errors/cli.js';
import { formatJson, tryParseJson } from '../utils/format.js';
import { run } from '../utils/childProcess.js';
import type { HandlerContext, ToolResult } from './types.js';
import { ensureJobSh } from './utils.js';

export async function handleStatus(
  params: Record<string, unknown>,
  ctx: HandlerContext
): Promise<ToolResult> {
  const jobMissing = ensureJobSh(ctx, 'codex.status', { jobId: 'cdx-20240313_090000-demo' });
  if (jobMissing) {
    return jobMissing;
  }
  const jobId = String(params.jobId || '');
  if (!jobId) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: '缺少 jobId 参数',
      hint: '请在调用参数中提供 jobId，可先调用 codex.list 获取最近的任务编号。',
      example: { name: 'codex.status', arguments: { jobId: 'cdx-20240313_090000-demo' } },
    });
  }
  // 不再启用 fallback，缺失时由 ensureJobSh 返回明确错误
  const pass = ['status', jobId, '--json'] as string[];
  const base = params.cwd ? String(params.cwd) : path.dirname(ctx.jobSh);
  if (base) {
    pass.push('--cwd', base);
  }
  const result = await run(ctx.jobSh, pass);
  if (result.code !== 0) {
    return createCliExitError(`${ctx.jobSh} ${pass.join(' ')}`, result);
  }
  const parsed = tryParseJson(result.stdout.trim());
  return {
    content: [
      {
        type: 'text',
        text: parsed ? formatJson(parsed) : result.stdout.trim(),
      },
    ],
  };
}
