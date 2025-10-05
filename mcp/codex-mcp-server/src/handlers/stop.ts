import path from 'node:path';

import { createCliExitError, createErrorResult } from '../errors/cli.js';
import { formatJson, tryParseJson } from '../utils/format.js';
import { run } from '../utils/childProcess.js';
import type { HandlerContext, ToolResult } from './types.js';
import { ensureJobSh } from './utils.js';

export async function handleStop(
  params: Record<string, unknown>,
  ctx: HandlerContext
): Promise<ToolResult> {
  const jobMissing = ensureJobSh(ctx, 'codex.stop', {
    jobId: 'cdx-20240313_090000-demo',
    force: false,
  });
  if (jobMissing) {
    return jobMissing;
  }
  const jobId = String(params.jobId || '');
  if (!jobId) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: '缺少 jobId 参数',
      hint: '请在调用参数中提供 jobId，可结合 codex.list 或 codex.start 的返回值获取。',
      example: {
        name: 'codex.stop',
        arguments: { jobId: 'cdx-20240313_090000-demo', force: false },
      },
    });
  }
  const pass = ['stop', jobId, '--json'];
  if (params.force) {
    pass.push('--force');
  }
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
