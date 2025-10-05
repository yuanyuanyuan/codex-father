import type { HandlerContext, ToolResult } from './types.js';
import { createErrorResult } from '../errors/cli.js';

export function ensureJobSh(
  ctx: HandlerContext,
  toolName: string,
  exampleArgs: Record<string, unknown> = {}
): ToolResult | null {
  if (ctx.jobShExists) {
    return null;
  }
  return createErrorResult({
    code: 'JOB_SH_NOT_FOUND',
    message: `未找到 job.sh，可执行路径：${ctx.jobSh}`,
    hint: '请设置 CODEX_MCP_PROJECT_ROOT 或 CODEX_JOB_SH 指向仓库根目录，或在调用参数中传入 cwd 指向包含 job.sh 的路径。',
    example: Object.keys(exampleArgs).length
      ? { name: toolName, arguments: exampleArgs }
      : undefined,
    details: { attemptedPath: ctx.jobSh, projectRoot: ctx.projectRoot },
  });
}

export function ensureStartSh(
  ctx: HandlerContext,
  toolName: string,
  exampleArgs: Record<string, unknown> = {}
): ToolResult | null {
  if (ctx.startShExists) {
    return null;
  }
  return createErrorResult({
    code: 'START_SH_NOT_FOUND',
    message: `未找到 start.sh，可执行路径：${ctx.startSh}`,
    hint: '请设置 CODEX_MCP_PROJECT_ROOT 或 CODEX_START_SH 指向仓库根目录，或在调用参数中传入 cwd 指向包含 start.sh 的路径。',
    example: Object.keys(exampleArgs).length
      ? { name: toolName, arguments: exampleArgs }
      : undefined,
    details: { attemptedPath: ctx.startSh, projectRoot: ctx.projectRoot },
  });
}
