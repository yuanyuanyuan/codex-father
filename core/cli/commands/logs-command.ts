import type { CLIParser } from '../parser.js';
import type { CommandResult } from '../../lib/types.js';

type LogsFormat = 'text' | 'json';

type LogsCommandOptions = {
  follow?: boolean | string;
  format?: LogsFormat | string;
  limit?: number | string;
  output?: string;
};

function toLogsCommandOptions(rawOptions: Record<string, unknown> | undefined): LogsCommandOptions {
  const options: LogsCommandOptions = {};
  if (!rawOptions) {
    return options;
  }

  if (Object.prototype.hasOwnProperty.call(rawOptions, 'follow')) {
    const followValue = rawOptions['follow'];
    if (typeof followValue === 'boolean' || typeof followValue === 'string') {
      options.follow = followValue;
    }
  }

  if (Object.prototype.hasOwnProperty.call(rawOptions, 'format')) {
    const formatValue = rawOptions['format'];
    if (formatValue === 'text' || formatValue === 'json' || typeof formatValue === 'string') {
      options.format = formatValue;
    }
  }

  if (Object.prototype.hasOwnProperty.call(rawOptions, 'limit')) {
    const limitValue = rawOptions['limit'];
    if (typeof limitValue === 'number' || typeof limitValue === 'string') {
      options.limit = limitValue;
    }
  }

  if (Object.prototype.hasOwnProperty.call(rawOptions, 'output')) {
    const outputValue = rawOptions['output'];
    if (typeof outputValue === 'string') {
      options.output = outputValue;
    }
  }

  return options;
}

const DEFAULT_LOG_LIMIT = 200;
const DEFAULT_FORMAT: LogsFormat = 'text';

const EXCLUDED_EVENT_FIELDS: ReadonlySet<string> = new Set([
  'timestamp',
  'time',
  'ts',
  'level',
  'severity',
  'message',
  'event',
  'name',
]);

function normalizeRunId(rawRunId: string | undefined): string | undefined {
  if (typeof rawRunId !== 'string') {
    return undefined;
  }
  const trimmed = rawRunId.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function coerceLimit(rawLimit: unknown, fallback: number = DEFAULT_LOG_LIMIT): number {
  if (typeof rawLimit === 'number' && Number.isInteger(rawLimit) && rawLimit > 0) {
    return rawLimit;
  }
  if (typeof rawLimit === 'string') {
    const parsed = Number.parseInt(rawLimit, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

function coerceFormat(rawFormat: unknown, fallback: LogsFormat = DEFAULT_FORMAT): LogsFormat {
  return rawFormat === 'json' ? 'json' : fallback;
}

function coerceFollow(rawFollow: unknown): boolean {
  if (typeof rawFollow === 'string') {
    return rawFollow === 'true';
  }
  return Boolean(rawFollow);
}

function resolveEventsPath(pathModule: typeof import('node:path'), runId: string): string {
  return pathModule.join('.codex-father', 'sessions', runId, 'events.jsonl');
}

async function validateEventsPath(
  fsPromises: typeof import('node:fs/promises'),
  fs: typeof import('node:fs'),
  eventsPath: string
): Promise<void> {
  await fsPromises.access(eventsPath, fs.constants.F_OK | fs.constants.R_OK);
}

async function readLastLines(
  fs: typeof import('node:fs'),
  readline: typeof import('node:readline'),
  filePath: string,
  maxLines: number
): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    const buffer: string[] = [];
    stream.on('error', reject);
    rl.on('line', (line) => {
      buffer.push(line);
      if (buffer.length > maxLines) {
        buffer.shift();
      }
    });
    rl.on('close', () => resolve(buffer));
  });
}

function emitLine(line: string, format: LogsFormat): void {
  if (!line) {
    return;
  }
  process.stdout.write(`${formatEventLine(line, format)}\n`);
}

function emitLines(lines: string[], format: LogsFormat): void {
  for (const line of lines) {
    emitLine(line, format);
  }
}

function formatEventLine(line: string, format: LogsFormat): string {
  if (format === 'json') {
    return line;
  }
  try {
    const event = JSON.parse(line) as Record<string, unknown>;
    const timestamp = extractTimestamp(event);
    const level = extractLevel(event);
    const message = extractMessage(event);
    const extras = formatExtras(event);
    const head = `[${timestamp}]${level ? ` ${level}` : ''}${message ? ` ${message}` : ''}`;
    return extras ? `${head} ${extras}` : head;
  } catch {
    return line;
  }
}

function extractTimestamp(event: Record<string, unknown>): string {
  const candidate = event.timestamp ?? event.time ?? event.ts;
  if (typeof candidate === 'number' || typeof candidate === 'string') {
    return String(candidate);
  }
  return '-';
}

function extractLevel(event: Record<string, unknown>): string {
  const candidate = event.level ?? event.severity;
  return typeof candidate === 'string' ? candidate.toUpperCase() : '';
}

function extractMessage(event: Record<string, unknown>): string {
  const candidate = event.message ?? event.event ?? event.name;
  return typeof candidate === 'string' ? candidate : '';
}

function formatExtras(event: Record<string, unknown>): string {
  const extras: Record<string, unknown> = {};
  for (const key of Object.keys(event)) {
    if (!EXCLUDED_EVENT_FIELDS.has(key)) {
      extras[key] = event[key];
    }
  }
  return Object.keys(extras).length > 0 ? JSON.stringify(extras) : '';
}

async function streamFollow(
  fs: typeof import('node:fs'),
  fsPromises: typeof import('node:fs/promises'),
  eventsPath: string,
  format: LogsFormat
): Promise<void> {
  const initial = await fsPromises.stat(eventsPath);
  await new Promise<void>((resolve) => {
    let position = initial.size;
    let remainder = '';
    let running = false;
    let rerun = false;

    const tick = async (): Promise<void> => {
      const stats = await fsPromises.stat(eventsPath);
      if (stats.size < position) {
        position = stats.size;
        remainder = '';
      }
      if (stats.size === position) {
        return;
      }
      await new Promise<void>((res, rej) => {
        const stream = fs.createReadStream(eventsPath, { encoding: 'utf8', start: position });
        stream.on('error', rej);
        stream.on('data', (chunk: unknown) => {
          remainder += String(chunk);
          const parts = remainder.split(/\r?\n/);
          remainder = parts.pop() ?? '';
          for (const part of parts) {
            if (part) {
              emitLine(part, format);
            }
          }
        });
        stream.on('close', () => {
          position = stats.size;
          res();
        });
      });
    };

    const run = (): void => {
      if (running) {
        rerun = true;
        return;
      }
      running = true;
      rerun = false;
      tick()
        .catch(() => {
          // swallow errors to keep tailing
        })
        .finally(() => {
          running = false;
          if (rerun) {
            run();
          }
        });
    };

    const timer = setInterval(run, 500);
    const stop = (): void => {
      clearInterval(timer);
      resolve();
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    run();
  });
}

export function registerLogsCommand(parser: CLIParser): void {
  parser.registerCommand(
    'logs',
    '导出或跟随 Codex 会话日志',
    async (context) => {
      const startTime = Date.now();
      const [rawSessionId] = context.args;
      const sessionId = normalizeRunId(rawSessionId);
      if (!sessionId) {
        const result: CommandResult = {
          success: false,
          message: '缺少必需的 sessionId 参数',
          errors: ['请提供有效的会话 ID，例如 codex-father logs 1234-5678'],
          executionTime: Date.now() - startTime,
          exitCode: 1,
        };
        return result;
      }

      const options = toLogsCommandOptions(context.options);
      const follow = coerceFollow(options.follow);
      const format = coerceFormat(options.format);
      const limit = coerceLimit(options.limit);

      const pathModule = await import('node:path');
      const fsPromises = await import('node:fs/promises');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      const eventsPath = resolveEventsPath(pathModule, sessionId);
      try {
        await validateEventsPath(fsPromises, fs, eventsPath);
      } catch {
        const result: CommandResult = {
          success: false,
          message: `无法读取日志: 未找到 session "${sessionId}" 的 events.jsonl`,
          errors: [eventsPath],
          executionTime: Date.now() - startTime,
          exitCode: 1,
        };
        return result;
      }

      try {
        const lines = await readLastLines(fs, readline, eventsPath, limit);
        emitLines(lines, format);
      } catch (error) {
        const result: CommandResult = {
          success: false,
          message: `读取日志失败: ${(error as Error).message}`,
          executionTime: Date.now() - startTime,
          exitCode: 1,
        };
        return result;
      }

      if (!follow) {
        const result: CommandResult = {
          success: true,
          message: '导出完成',
          data: { sessionId, format, limit, follow: false },
          executionTime: Date.now() - startTime,
        };
        return result;
      }

      await streamFollow(fs, fsPromises, eventsPath, format);

      const result: CommandResult = {
        success: true,
        message: '跟随结束',
        data: { sessionId, format, limit, follow: true },
        executionTime: Date.now() - startTime,
      };
      return result;
    },
    {
      usage: '<sessionId> [options]',
      arguments: [
        {
          name: 'sessionId',
          description: '需要导出或跟随的会话 ID',
          required: true,
        },
      ],
      options: [
        {
          flags: '--follow',
          description: '持续跟随日志输出（tail -f）',
          defaultValue: false,
        },
        {
          flags: '--format <text|json>',
          description: '输出格式 (text|json)',
          defaultValue: DEFAULT_FORMAT,
        },
        {
          flags: '--output <path>',
          description: '指定输出文件路径（默认写入 .codex-father/logs/）',
        },
        {
          flags: '--limit <lines>',
          description: '限制导出的日志行数',
          defaultValue: DEFAULT_LOG_LIMIT,
        },
      ],
    }
  );
}
