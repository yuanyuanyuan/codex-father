import path from 'node:path';

import { createCliExitError, createErrorResult } from '../errors/cli.js';
import { formatJson, tryParseJson } from '../utils/format.js';
import { run } from '../utils/childProcess.js';
import type { HandlerContext, ToolResult } from './types.js';
import { ensureJobSh } from './utils.js';

export async function handleMetrics(
  params: Record<string, unknown>,
  ctx: HandlerContext
): Promise<ToolResult> {
  const jobMissing = ensureJobSh(ctx, 'codex.metrics', {});
  if (jobMissing) {
    return jobMissing;
  }
  const pass = ['metrics', '--json'];
  const base = params.cwd ? String(params.cwd) : path.dirname(ctx.jobSh);
  if (base) {
    pass.push('--cwd', base);
  }
  const states = Array.isArray(params.states)
    ? (params.states as unknown[])
    : typeof params.states === 'string'
      ? [params.states]
      : [];
  if (states.some((st) => typeof st !== 'string' || !String(st).trim())) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: 'states 参数必须为字符串数组。',
      hint: '例如 states: ["running","failed"]。',
      example: { name: 'codex.metrics', arguments: { states: ['running', 'failed'] } },
    });
  }
  for (const st of states) {
    pass.push('--state', String(st));
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
