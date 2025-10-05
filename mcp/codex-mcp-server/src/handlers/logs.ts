import fs from 'node:fs';
import path from 'node:path';

import { createErrorResult } from '../errors/cli.js';
import { formatJson } from '../utils/format.js';
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

export async function handleLogs(
  params: Record<string, unknown>,
  ctx: HandlerContext
): Promise<ToolResult> {
  const jobMissing = ensureJobSh(ctx, 'codex.logs', {
    jobId: '<jobId>',
    mode: 'lines',
    tailLines: 80,
  });
  if (jobMissing) {
    return jobMissing;
  }
  const jobId = String(params.jobId || '');
  if (!jobId) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: '缺少 jobId 参数',
      hint: '请提供要查看日志的 jobId，可通过 codex.start 的返回值或 codex.list 查询。',
      example: {
        name: 'codex.logs',
        arguments: {
          jobId: 'cdx-20240313_090000-demo',
          mode: 'lines',
          tailLines: 80,
          view: 'result-only',
        },
      },
    });
  }
  const baseDir = params.cwd ? String(params.cwd) : path.dirname(ctx.jobSh);
  const sessionsRoot = path.resolve(baseDir, '.codex-father', 'sessions');
  const logFile = path.join(sessionsRoot, jobId, 'job.log');
  if (!fs.existsSync(logFile)) {
    return createErrorResult({
      code: 'LOG_NOT_FOUND',
      message: `未找到日志文件：${logFile}`,
      hint: '确认 jobId 是否正确，任务是否已启动并产生日志；可先调用 codex.status 查看任务状态。',
      example: {
        name: 'codex.status',
        arguments: { jobId },
      },
    });
  }
  const mode = (params.mode || 'bytes') as 'bytes' | 'lines';
  const allowedViews = new Set(['default', 'result-only', 'debug']);
  let view = typeof params.view === 'string' ? String(params.view) : 'default';
  if (!allowedViews.has(view)) {
    view = 'default';
  }

  const exampleBase = { jobId };

  const parsedTailLines = parseOptionalInteger(params.tailLines);
  if (parsedTailLines === null || (parsedTailLines !== undefined && parsedTailLines <= 0)) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: 'tailLines 必须为大于 0 的整数。',
      hint: '例如 tailLines: 80 可仅查看最新 80 行日志。',
      example: { name: 'codex.logs', arguments: { ...exampleBase, mode: 'lines', tailLines: 80 } },
    });
  }

  const parsedOffsetLines = parseOptionalInteger(params.offsetLines);
  if (parsedOffsetLines === null || (parsedOffsetLines !== undefined && parsedOffsetLines < 0)) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: 'offsetLines 必须为不小于 0 的整数。',
      hint: 'offsetLines 用于跳过前若干行，可设置为 0 或更大整数。',
      example: {
        name: 'codex.logs',
        arguments: { ...exampleBase, mode: 'lines', offsetLines: 200, limitLines: 100 },
      },
    });
  }

  const parsedLimitLines = parseOptionalInteger(params.limitLines);
  if (parsedLimitLines === null || (parsedLimitLines !== undefined && parsedLimitLines <= 0)) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: 'limitLines 必须为大于 0 的整数。',
      hint: 'limitLines 控制返回的最大行数，常用 100 或 200。',
      example: {
        name: 'codex.logs',
        arguments: { ...exampleBase, mode: 'lines', limitLines: 120, offsetLines: 0 },
      },
    });
  }

  const parsedOffsetBytes = parseOptionalInteger(params.offset);
  if (parsedOffsetBytes === null || (parsedOffsetBytes !== undefined && parsedOffsetBytes < 0)) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: 'offset 必须为不小于 0 的整数。',
      hint: 'bytes 模式下 offset 表示跳过的字节数，通常结合 limit 使用。',
      example: {
        name: 'codex.logs',
        arguments: { ...exampleBase, mode: 'bytes', offset: 0, limit: 2048 },
      },
    });
  }

  const parsedLimitBytes = parseOptionalInteger(params.limit);
  if (parsedLimitBytes === null || (parsedLimitBytes !== undefined && parsedLimitBytes <= 0)) {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: 'limit 必须为大于 0 的整数。',
      hint: 'bytes 模式默认返回 4096 字节，可依据需要设置更小的 limit。',
      example: { name: 'codex.logs', arguments: { ...exampleBase, mode: 'bytes', limit: 4096 } },
    });
  }

  const tailLines = parsedTailLines;
  const offsetLines = parsedOffsetLines ?? 0;
  const limitLines = parsedLimitLines ?? 200;
  const offsetBytes = parsedOffsetBytes ?? 0;
  const limitBytes = parsedLimitBytes ?? 4096;
  if (mode === 'lines') {
    const grepRe = typeof params.grep === 'string' ? params.grep : '';
    let lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/);
    if (grepRe) {
      let re: RegExp;
      try {
        re = new RegExp(grepRe);
      } catch {
        re = /.*/;
      }
      lines = lines.filter((l: string) => re.test(l));
    }
    if (view === 'result-only') {
      const blocks: string[][] = [];
      let currentBlock: string[] | null = null;
      let inCodexBlock = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^-----\s*End Codex Output/i.test(trimmed)) {
          if (currentBlock && currentBlock.length > 0) {
            blocks.push(currentBlock);
          }
          currentBlock = null;
          inCodexBlock = false;
          continue;
        }
        if (/^\[.*\b(exec|tool|system)\b/i.test(trimmed)) {
          if (currentBlock && currentBlock.length > 0) {
            blocks.push(currentBlock);
          }
          currentBlock = null;
          inCodexBlock = false;
          continue;
        }
        if (/^\[.*\bcodex\b/i.test(trimmed) || /^\[?codex\]?$/i.test(trimmed)) {
          inCodexBlock = true;
          currentBlock = [];
          continue;
        }
        if (/tokens\s+used:/i.test(trimmed)) {
          if (currentBlock && currentBlock.length > 0) {
            blocks.push(currentBlock);
          }
          currentBlock = null;
          inCodexBlock = false;
          continue;
        }
        if (!inCodexBlock) {
          continue;
        }
        if (!currentBlock) {
          currentBlock = [];
        }
        currentBlock.push(line);
      }
      if (currentBlock && currentBlock.length > 0) {
        blocks.push(currentBlock);
      }
      lines = blocks.length > 0 ? blocks[blocks.length - 1] : [];
    }
    const total = lines.length;
    const window =
      tailLines !== undefined
        ? lines.slice(-tailLines)
        : lines.slice(offsetLines, offsetLines + limitLines);
    const hasMore = tailLines !== undefined ? total > tailLines : offsetLines + limitLines < total;

    const payload: Record<string, unknown> = {
      lines: window,
      totalLines: total,
      view,
      window:
        tailLines !== undefined
          ? { mode: 'tail', tailLines }
          : { mode: 'slice', offsetLines, limitLines },
    };

    if (hasMore) {
      const suggestedArgs =
        tailLines !== undefined
          ? { ...exampleBase, mode: 'lines', tailLines: Math.max(200, tailLines * 2) }
          : { ...exampleBase, mode: 'lines', offsetLines: offsetLines + limitLines, limitLines };
      payload.hint =
        tailLines !== undefined
          ? '日志仍有更多历史内容，可增大 tailLines 或改用 offsetLines/limitLines 分页。'
          : '日志仍有剩余内容，可继续增加 offsetLines 或改成 tailLines 只看末尾输出。';
      payload.nextSuggestion = { name: 'codex.logs', arguments: suggestedArgs };
    }

    return { content: [{ type: 'text', text: formatJson(payload) }] };
  }

  const stat = fs.statSync(logFile);
  const size = stat.size;
  const offset = offsetBytes;
  const limit = limitBytes;
  if (offset >= size) {
    return {
      content: [
        {
          type: 'text',
          text: formatJson({ chunk: '', nextOffset: offset, eof: true, size }),
        },
      ],
    };
  }
  const remain = size - offset;
  const count = Math.min(limit, remain);
  const fd = fs.openSync(logFile, 'r');
  const buf = Buffer.allocUnsafe(count);
  fs.readSync(fd, buf, 0, count, offset);
  fs.closeSync(fd);
  const chunk = buf.toString('utf8');
  const nextOffset = offset + count;
  const eof = nextOffset >= size;
  const payload: Record<string, unknown> = {
    chunk,
    offset,
    limit,
    nextOffset,
    eof,
    size,
    view,
  };
  if (!eof) {
    payload.hint = '日志尚未结束，可继续调用并把 offset 设置为 nextOffset。';
    payload.nextSuggestion = {
      name: 'codex.logs',
      arguments: { ...exampleBase, mode: 'bytes', offset: nextOffset, limit },
    };
  }
  return { content: [{ type: 'text', text: formatJson(payload) }] };
}
