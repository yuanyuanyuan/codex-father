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

function parseOptionalNumber(value: unknown): number | undefined | null {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const num = Number(value.trim());
    if (Number.isFinite(num)) {
      return num;
    }
  }
  return null;
}

export async function handleClean(
  params: Record<string, unknown>,
  ctx: HandlerContext
): Promise<ToolResult> {
  const jobMissing = ensureJobSh(ctx, 'codex.clean', { dryRun: true });
  if (jobMissing) {
    return jobMissing;
  }
  const pass = ['clean', '--json'];
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
      message: 'states 参数必须为字符串数组，每个值表示要清理的状态。',
      hint: '典型取值如 ["completed","failed"]。',
      example: {
        name: 'codex.clean',
        arguments: { states: ['completed', 'failed'], dryRun: true },
      },
    });
  }
  const normalizedStates = states.map((st) => String(st).trim());
  for (const st of normalizedStates) {
    pass.push('--state', st);
  }
  const olderThan = parseOptionalNumber(params.olderThanHours);
  if (olderThan === null || (olderThan !== undefined && olderThan < 0)) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: 'olderThanHours 必须为不小于 0 的数字。',
      hint: '例如 olderThanHours: 24 表示清理一天前的任务。',
      example: { name: 'codex.clean', arguments: { olderThanHours: 48, dryRun: true } },
    });
  }
  if (olderThan !== undefined) {
    pass.push('--older-than-hours', String(olderThan));
  }
  const limit = parseOptionalInteger(params.limit);
  if (limit === null || (limit !== undefined && limit < 0)) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: 'limit 必须为不小于 0 的整数。',
      hint: 'limit 用于限制清理数量，例如限制为 10。',
      example: { name: 'codex.clean', arguments: { limit: 10, dryRun: true } },
    });
  }
  if (limit !== undefined) {
    pass.push('--limit', String(limit));
  }
  if (params.dryRun) {
    pass.push('--dry-run');
  }
  const dryRun = Boolean(params.dryRun);

  if (!ctx.jobShExists && ctx.fallback?.supportsJobs) {
    return ctx.fallback.clean({
      states: normalizedStates,
      olderThanHours: olderThan,
      limit,
      dryRun,
    });
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
