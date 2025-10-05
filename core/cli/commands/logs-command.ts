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
      const follow = Boolean(options.follow);
      const formatValue = (options.format as LogsFormat | undefined) ?? DEFAULT_FORMAT;
      const format: LogsFormat = formatValue === 'json' ? 'json' : 'text';
      const limitOption = options.limit;
      const limit =
        typeof limitOption === 'number'
          ? limitOption
          : typeof limitOption === 'string'
            ? Number(limitOption)
            : DEFAULT_LOG_LIMIT;
      const outputPath =
        typeof options.output === 'string' && options.output.length > 0
          ? options.output
          : `.codex-father/logs/${sessionId}.${format === 'json' ? 'jsonl' : 'log'}`;

      const summary = [
        `会话: ${sessionId}`,
        `跟随模式: ${follow ? '启用' : '禁用'}`,
        `输出格式: ${format}`,
        `输出路径: ${outputPath}`,
        `行数限制: ${Number.isFinite(limit) ? limit : '无'}`,
      ].join('\n');

      const result: CommandResult = {
        success: true,
        message: summary,
        data: {
          sessionId,
          follow,
          format,
          outputPath,
          limit,
        },
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
