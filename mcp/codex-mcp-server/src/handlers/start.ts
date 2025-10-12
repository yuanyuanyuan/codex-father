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
  // 不再启用 fallback，缺失时由 ensure* 返回明确错误
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

  // 严格模式：在 MCP 边界提前拦截高频错参（不做同义词映射，仅给出改写建议）
  const lowerFlags = args.map((a) => a.trim());
  const badFlags = new Set([
    '--context',
    '-context',
    '--goal',
    '-goal',
    '--notes',
    '-notes',
    '--config',
  ]);
  for (let i = 0; i < lowerFlags.length; i++) {
    const a = lowerFlags[i];
    if (badFlags.has(a)) {
      const flag = a;
      let message = `检测到不受支持的参数：${flag}`;
      let hint = '';
      let examples: Array<string> = [];
      if (flag.includes('context')) {
        message += '。本 CLI 不支持 --context 总控。';
        hint = '请根据目的改用 --context-head 或 --context-grep。';
        examples = [
          'args: ["--task","修复问题","--context-head","200"]',
          'args: ["--task","修复问题","--context-grep","(README|CHANGELOG)"]',
        ];
      } else if (flag.includes('goal')) {
        hint = '请改用 --task <文本> 传递任务说明。';
        examples = ['args: ["--task","修复 T003：补齐迁移脚本并通过测试"]'];
      } else if (flag.includes('notes')) {
        hint = '请改用 --append <文本> 追加备注（建议加前缀 Notes:）。';
        examples = ['args: ["--task","修复 T003","--append","Notes: 需关注回滚脚本"]'];
      } else if (flag.includes('config')) {
        message += '。start.sh 层不接受 --config。';
        hint = '请改用 --codex-config key=value，或在 MCP 参数 codexConfig 中传对象。';
        examples = [
          'args: ["--task","示例","--codex-config","model=gpt-5-codex-medium"]',
          'codexConfig: {"model":"gpt-5-codex-medium"}',
        ];
      }
      const exampleArgs = flag.includes('context')
        ? ['--task', '修复问题', '--context-head', '200']
        : flag.includes('goal')
          ? ['--task', '修复 T003：补齐迁移脚本并通过测试']
          : flag.includes('notes')
            ? ['--task', '修复 T003', '--append', 'Notes: 需关注回滚脚本']
            : ['--task', '示例', '--codex-config', 'model=gpt-5-codex-medium'];
      return createErrorResult({
        code: 'INVALID_ARGUMENTS',
        message,
        hint,
        example: {
          name: 'codex.start',
          arguments: flag.includes('config')
            ? { args: exampleArgs, codexConfig: { model: 'gpt-5-codex-medium' } }
            : { args: exampleArgs },
        },
        details: { flag, suggestions: examples },
      });
    }
  }

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
