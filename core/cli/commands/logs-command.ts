import type { CLIParser } from '../parser.js';
import type { CommandResult } from '../../lib/types.js';

type LogsFormat = 'text' | 'json';

const DEFAULT_LOG_LIMIT = 200;
const DEFAULT_FORMAT: LogsFormat = 'text';

export function registerLogsCommand(parser: CLIParser): void {
  parser.registerCommand(
    'logs',
    '导出或跟随 Codex 会话日志',
    async (context) => {
      const startTime = Date.now();
      const [sessionId] = context.args;
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

      const options = context.options ?? {};
      const follow = (() => {
        const raw = (options as any).follow;
        return typeof raw === 'string' ? raw === 'true' : Boolean(raw);
      })();
      const format: LogsFormat =
        (((options as any).format as LogsFormat | undefined) ?? DEFAULT_FORMAT) === 'json'
          ? 'json'
          : 'text';
      const limit = (() => {
        const raw = (options as any).limit;
        const val =
          typeof raw === 'number'
            ? raw
            : typeof raw === 'string'
              ? Number.parseInt(raw, 10)
              : DEFAULT_LOG_LIMIT;
        return Number.isInteger(val) && val > 0 ? val : DEFAULT_LOG_LIMIT;
      })();

      const pathModule = await import('node:path');
      const fsPromises = await import('node:fs/promises');
      const fs = await import('node:fs');
      const readline = await import('node:readline');

      const eventsPath = pathModule.join('.codex-father', 'sessions', sessionId, 'events.jsonl');
      try {
        await fsPromises.access(eventsPath, fs.constants.F_OK | fs.constants.R_OK);
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

      const formatLine = (line: string): string => {
        try {
          const obj = JSON.parse(line) as Record<string, unknown>;
          const t = (obj.timestamp ?? obj.time ?? obj.ts) as unknown;
          const lvl = (obj.level ?? obj.severity) as unknown;
          const msg = (obj.message ?? obj.event ?? obj.name) as unknown;
          const ts = typeof t === 'number' || typeof t === 'string' ? String(t) : '-';
          const lv = typeof lvl === 'string' ? lvl.toUpperCase() : '';
          const ms = typeof msg === 'string' ? msg : '';
          const exclude = new Set([
            'timestamp',
            'time',
            'ts',
            'level',
            'severity',
            'message',
            'event',
            'name',
          ]);
          const rest: Record<string, unknown> = {};
          for (const k of Object.keys(obj)) {
            if (!exclude.has(k)) {
              rest[k] = obj[k];
            }
          }
          const head = `[${ts}]${lv ? ` ${lv}` : ''}${ms ? ` ${ms}` : ''}`;
          return Object.keys(rest).length ? `${head} ${JSON.stringify(rest)}` : head;
        } catch {
          return line;
        }
      };

      const emitLine = (line: string) => {
        if (!line) {
          return;
        }
        process.stdout.write(`${format === 'json' ? line : formatLine(line)}\n`);
      };

      const readLastLines = async (filePath: string, maxLines: number): Promise<string[]> =>
        new Promise((resolve, reject) => {
          const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
          const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
          const buf: string[] = [];
          stream.on('error', reject);
          rl.on('line', (line) => {
            buf.push(line);
            if (buf.length > maxLines) {
              buf.shift();
            }
          });
          rl.on('close', () => resolve(buf));
        });

      try {
        const lines = await readLastLines(eventsPath, limit);
        lines.forEach(emitLine);
      } catch (e) {
        const result: CommandResult = {
          success: false,
          message: `读取日志失败: ${(e as Error).message}`,
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

      const initial = await fsPromises.stat(eventsPath);
      await new Promise<void>((resolve) => {
        let position = initial.size;
        let remainder = '';
        let running = false;
        let rerun = false;
        const tick = async () => {
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
              for (const p of parts) {
                if (p) {
                  emitLine(p);
                }
              }
            });
            stream.on('close', () => {
              position = stats.size;
              res();
            });
          });
        };
        const run = () => {
          if (running) {
            rerun = true;
            return;
          }
          running = true;
          rerun = false;
          tick()
            .catch(() => {
              /* swallow */
            })
            .finally(() => {
              running = false;
              if (rerun) {
                run();
              }
            });
        };
        const timer = setInterval(run, 500);
        const stop = () => {
          clearInterval(timer);
          resolve();
        };
        process.once('SIGINT', stop);
        process.once('SIGTERM', stop);
        run();
      });

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
