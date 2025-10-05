import path from 'node:path';

import { createCliExitError, createErrorResult } from '../errors/cli.js';
import { formatJson, tryParseJson } from '../utils/format.js';
import { run } from '../utils/childProcess.js';
import type { HandlerContext, ToolResult } from './types.js';
import { ensureJobSh } from './utils.js';

const INTEGER_PATTERN = /^-?\d+$/;

function parseOptionalInteger(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && INTEGER_PATTERN.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

export async function handleList(
  params: Record<string, unknown>,
  ctx: HandlerContext
): Promise<ToolResult> {
  const jobMissing = ensureJobSh(ctx, 'codex.list', { limit: 20 });
  if (jobMissing) {
    return jobMissing;
  }
  const pass = ['list', '--json'] as string[];
  const base = params.cwd ? String(params.cwd) : path.dirname(ctx.jobSh);
  if (base) {
    pass.push('--cwd', base);
  }
  const states = Array.isArray(params.state)
    ? (params.state as unknown[])
    : typeof params.state === 'string'
      ? [params.state]
      : [];
  if (states.some((st) => typeof st !== 'string' || !String(st).trim())) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: 'state 参数必须为字符串或字符串数组。',
      hint: '例如 state: ["running","failed"]。',
      example: { name: 'codex.list', arguments: { state: ['running', 'completed'], limit: 10 } },
    });
  }
  const normalizedStates = states.map((st) => String(st).trim());
  for (const st of normalizedStates) {
    pass.push('--state', st);
  }
  if (params.tagContains !== undefined) {
    if (typeof params.tagContains !== 'string' || !params.tagContains.trim()) {
      return createErrorResult({
        code: 'INVALID_ARGUMENT',
        message: 'tagContains 应为非空字符串。',
        hint: '传入的值会用于模糊匹配任务 tag，例如 "deploy"。',
        example: { name: 'codex.list', arguments: { tagContains: 'deploy', limit: 5 } },
      });
    }
    pass.push('--tag-contains', params.tagContains.trim());
  }
  const tagContains =
    typeof params.tagContains === 'string' && params.tagContains.trim()
      ? params.tagContains.trim()
      : undefined;
  const parsedLimit = parseOptionalInteger(params.limit);
  if (parsedLimit === null || (parsedLimit !== undefined && parsedLimit < 0)) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: 'limit 必须为不小于 0 的整数。',
      hint: '将 limit 设为 0 表示返回全部任务，常用 20 或 50 以分页查看。',
      example: { name: 'codex.list', arguments: { limit: 20 } },
    });
  }
  if (parsedLimit !== undefined) {
    pass.push('--limit', String(parsedLimit));
  }
  const parsedOffset = parseOptionalInteger(params.offset);
  if (parsedOffset === null || (parsedOffset !== undefined && parsedOffset < 0)) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: 'offset 必须为不小于 0 的整数。',
      hint: 'offset 用于跳过前 N 条记录，例如分页时可设置为 20。',
      example: { name: 'codex.list', arguments: { limit: 20, offset: 20 } },
    });
  }
  if (parsedOffset !== undefined) {
    pass.push('--offset', String(parsedOffset));
  }
  // 不再启用 fallback，缺失时由 ensureJobSh 返回明确错误
  const result = await run(ctx.jobSh, pass);
  if (result.code !== 0) {
    return createCliExitError(`${ctx.jobSh} ${pass.join(' ')}`, result);
  }
  const trimmed = result.stdout.trim();
  const parsed = tryParseJson(trimmed);
  return {
    content: [
      {
        type: 'text',
        text: parsed ? formatJson(parsed) : trimmed,
      },
    ],
  };
}
