import { createCliExitError, createErrorResult } from '../errors/cli.js';
import { formatJson, tryParseJson } from '../utils/format.js';
import { run } from '../utils/childProcess.js';
import { applyConvenienceOptions } from './options.js';
import type { HandlerContext, ToolResult } from './types.js';
import { ensureJobSh } from './utils.js';

export async function handleStart(
  params: Record<string, unknown>,
  ctx: HandlerContext
): Promise<ToolResult> {
  const jobMissing = ensureJobSh(ctx, 'codex.start', {
    args: ['--task', 'Run something'],
    tag: 'demo',
  });
  if (jobMissing) {
    return jobMissing;
  }
  if (!(ctx.jobShExists && ctx.startShExists) && ctx.fallback?.supportsJobs) {
    return ctx.fallback.start(params);
  }
  if (!ctx.startShExists) {
    return createErrorResult({
      code: 'START_SH_NOT_FOUND',
      message: `未找到 start.sh，可执行路径：${ctx.startSh}`,
      hint: '请设置 CODEX_MCP_PROJECT_ROOT 或 CODEX_START_SH 指向仓库根目录。',
      example: { name: 'codex.start', arguments: { args: ['--task', 'npm run lint'] } },
      details: { attemptedPath: ctx.startSh, projectRoot: ctx.projectRoot },
    });
  }
  const args: string[] = Array.isArray(params.args) ? params.args.map(String) : [];
  applyConvenienceOptions(args, params);
  const isStub = !!process.env.CODEX_START_SH;

  if (isStub) {
    let outPath = '';
    for (let i = 0; i < args.length - 1; i++) {
      if (args[i] === '--log-file') {
        outPath = String(args[i + 1]);
        break;
      }
    }
    const directArgs = outPath ? [outPath, ...args] : args;
    const result = await run(ctx.startSh, directArgs);
    if (result.code !== 0) {
      return createCliExitError(`${ctx.startSh} ${directArgs.join(' ')}`, result);
    }
    return { content: [{ type: 'text', text: (result.stdout || '').trim() }] };
  }

  const pass: string[] = ['start', '--json'];
  if (params.tag) {
    pass.push('--tag', String(params.tag));
  }
  if (params.cwd) {
    pass.push('--cwd', String(params.cwd));
  }
  pass.push(...args);

  const result = await run(ctx.jobSh, pass);
  if (result.code !== 0) {
    return createCliExitError(`${ctx.jobSh} ${pass.join(' ')}`, result);
  }
  const trimmed = result.stdout.trim();
  const parsed = tryParseJson(trimmed);
  if (parsed && typeof parsed === 'object' && parsed !== null) {
    const parsedRecord = parsed as Record<string, unknown>;
    const jobId = typeof parsedRecord.jobId === 'string' ? (parsedRecord.jobId as string) : '';
    const baseExample = jobId || '<jobId>';
    const resolvedCwd =
      typeof parsedRecord.cwd === 'string'
        ? (parsedRecord.cwd as string)
        : typeof params.cwd === 'string'
          ? params.cwd
          : process.cwd();
    const resolvedTag =
      typeof params.tag === 'string'
        ? params.tag
        : typeof parsedRecord.tag === 'string'
          ? (parsedRecord.tag as string)
          : '';
    const resolvedLogFile =
      typeof parsedRecord.logFile === 'string' ? (parsedRecord.logFile as string) : null;
    const resolvedMetaGlob =
      typeof parsedRecord.metaGlob === 'string' ? (parsedRecord.metaGlob as string) : null;
    const resolvedLastMessageGlob =
      typeof parsedRecord.lastMessageGlob === 'string'
        ? (parsedRecord.lastMessageGlob as string)
        : null;
    const payload: Record<string, unknown> = {
      jobId,
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
      hint: '请保存 jobId，后续可调用 codex.status / codex.logs / codex.stop 追踪或终止任务。',
      raw: parsedRecord,
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
