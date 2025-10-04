import type { CLIParser } from '../parser.js';
import type { CommandResult } from '../../lib/types.js';

interface OrchestrateDefaults {
  mode: 'manual' | 'llm';
  maxConcurrency: number;
  taskTimeout: number;
  successThreshold: number;
  outputFormat: 'json' | 'stream-json';
}

const DEFAULTS: OrchestrateDefaults = {
  mode: 'llm',
  maxConcurrency: 10,
  taskTimeout: 30,
  successThreshold: 0.9,
  outputFormat: 'stream-json',
};

export function registerOrchestrateCommand(parser: CLIParser): void {
  parser.registerCommand(
    'orchestrate',
    '编排多 Agent 并行任务（MVP scaffolding）',
    async () => {
      const result: CommandResult = {
        success: false,
        message: 'orchestrate 命令当前处于搭建阶段，核心逻辑即将上线',
        warnings: ['编排器主流程未实现'],
        executionTime: 0,
      };

      return result;
    },
    {
      arguments: [
        {
          name: 'requirement',
          description: '高层需求描述，用于任务分解或执行',
          required: true,
        },
      ],
      options: [
        {
          flags: '--mode <mode>',
          description: '任务分解模式 (manual|llm)',
          defaultValue: DEFAULTS.mode,
        },
        {
          flags: '--tasks-file <path>',
          description: '手动模式使用的任务定义文件 (JSON)',
        },
        {
          flags: '--max-concurrency <count>',
          description: '最大并发执行数 (1-10)',
          defaultValue: DEFAULTS.maxConcurrency,
        },
        {
          flags: '--task-timeout <minutes>',
          description: '单个任务超时时长（分钟）',
          defaultValue: DEFAULTS.taskTimeout,
        },
        {
          flags: '--success-threshold <ratio>',
          description: '任务成功率阈值 (0-1)',
          defaultValue: DEFAULTS.successThreshold,
        },
        {
          flags: '--output-format <format>',
          description: '输出格式 (json|stream-json)',
          defaultValue: DEFAULTS.outputFormat,
        },
        {
          flags: '--config <path>',
          description: '额外的 YAML 编排配置文件',
        },
      ],
    }
  );
}
