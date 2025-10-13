import type { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';

import { createErrorResult, errorFromException } from '../errors/cli.js';
import {
  detectCodexVersion,
  listIncompatibleCliParams,
  listIncompatibleConfigKeys,
  buildIncompatErrorResult,
} from '../utils/version.js';
import { normalizeToolName } from '../utils/toolNames.js';
import type { HandlerContext, ToolResult } from './types.js';
import { handleHelp } from './help.js';
import { handleExec } from './exec.js';
import { handleStart } from './start.js';
import { handleResume } from './resume.js';
import { handleReply } from './reply.js';
import { handleStatus } from './status.js';
import { handleStop } from './stop.js';
import { handleList } from './list.js';
import { handleLogs } from './logs.js';
import { handleClean } from './clean.js';
import { handleMetrics } from './metrics.js';
import { handleMessage } from './message.js';

export async function handleCall(req: CallToolRequest, ctx: HandlerContext): Promise<ToolResult> {
  const name = req.params.name;
  const params = (req.params.arguments ?? {}) as Record<string, unknown>;
  try {
    const normalized = normalizeToolName(name);
    if (normalized === 'codex.help') {
      return handleHelp(params);
    }

    const version = await detectCodexVersion();
    const rawArgs = Array.isArray(params.args) ? (params.args as unknown[]).map(String) : [];
    const cliViolations = listIncompatibleCliParams(params, version, rawArgs);
    const cfgViolations = listIncompatibleConfigKeys(
      (params.codexConfig as Record<string, unknown> | undefined) ?? undefined,
      version
    );
    if (cliViolations.length || cfgViolations.length) {
      return buildIncompatErrorResult(version, cliViolations, cfgViolations);
    }

    switch (normalized) {
      case 'codex.exec':
        return handleExec(params, ctx);
      case 'codex.start':
        return handleStart(params, ctx);
      case 'codex.resume':
        return handleResume(params, ctx);
      case 'codex.reply':
        return handleReply(params, ctx);
      case 'codex.status':
        return handleStatus(params, ctx);
      case 'codex.stop':
        return handleStop(params, ctx);
      case 'codex.list':
        return handleList(params, ctx);
      case 'codex.logs':
        return handleLogs(params, ctx);
      case 'codex.clean':
        return handleClean(params, ctx);
      case 'codex.metrics':
        return handleMetrics(params, ctx);
      case 'codex.message':
        return handleMessage(params, ctx);
      default:
        return createErrorResult({
          code: 'UNKNOWN_TOOL',
          message: `未知工具：${name}`,
          hint: '运行 codex.help 可查看可用工具列表。',
          example: { name: 'codex.help', arguments: {} },
        });
    }
  } catch (error) {
    return errorFromException(error, '请检查执行环境与日志。');
  }
}
