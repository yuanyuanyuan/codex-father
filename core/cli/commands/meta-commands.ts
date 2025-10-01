/**
 * 元命令处理器
 * 实现 --version 和 --help 基础命令
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
// import { fileURLToPath } from 'url';
import type { CommandContext, CommandResult } from '../../lib/types.js';

/**
 * 动态查找项目根目录
 */
function findProjectRoot(): string {
  let currentDir = process.cwd();
  const fs = require('fs');

  while (currentDir !== dirname(currentDir)) {
    if (
      fs.existsSync(resolve(currentDir, 'package.json')) ||
      fs.existsSync(resolve(currentDir, '.git'))
    ) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  return process.cwd();
}

/**
 * 获取包信息
 */
interface PackageInfo {
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  bugs?: {
    url: string;
  };
}

function getPackageInfo(): PackageInfo {
  try {
    const projectRoot = findProjectRoot();
    const packagePath = resolve(projectRoot, 'package.json');
    const packageContent = readFileSync(packagePath, 'utf8');
    return JSON.parse(packageContent);
  } catch (error) {
    // 回退到默认信息
    return {
      name: 'codex-father',
      version: '1.0.0',
      description: 'TypeScript-based CLI tool for project management',
    };
  }
}

/**
 * 可用命令列表
 */
interface CommandInfo {
  name: string;
  description: string;
  aliases?: string[];
  status: 'available' | 'planned' | 'deprecated';
}

const AVAILABLE_COMMANDS: CommandInfo[] = [
  {
    name: 'version',
    description: 'Display version information',
    aliases: ['-v', '--version'],
    status: 'available',
  },
  {
    name: 'help',
    description: 'Display help information',
    aliases: ['-h', '--help'],
    status: 'available',
  },
  {
    name: 'task',
    description: 'Manage tasks (create, list, status, cancel, retry, logs)',
    status: 'planned',
  },
  {
    name: 'config',
    description: 'Manage configuration (get, set, list, validate, init)',
    status: 'planned',
  },
  {
    name: 'mcp',
    description: 'Manage MCP servers (start, stop, status, logs, tools)',
    status: 'planned',
  },
  {
    name: 'git',
    description: 'Git operations and PR automation',
    status: 'planned',
  },
  {
    name: 'container',
    description: 'Container management and deployment',
    status: 'planned',
  },
];

/**
 * 版本命令处理器
 */
export class VersionCommand {
  static async handle(context: CommandContext): Promise<CommandResult> {
    const packageInfo = getPackageInfo();
    const nodeVersion = process.version;
    const platform = `${process.platform} ${process.arch}`;

    if (context.json) {
      return {
        success: true,
        data: {
          name: packageInfo.name,
          version: packageInfo.version,
          node: nodeVersion,
          platform: platform,
          env: process.env.NODE_ENV || 'development',
        },
        executionTime: 0,
      };
    }

    const output = [
      `${packageInfo.name} v${packageInfo.version}`,
      `Node.js ${nodeVersion}`,
      `Platform: ${platform}`,
      `Environment: ${process.env.NODE_ENV || 'development'}`,
    ];

    return {
      success: true,
      message: output.join('\n'),
      executionTime: 0,
    };
  }
}

/**
 * 帮助命令处理器
 */
export class HelpCommand {
  static async handle(context: CommandContext): Promise<CommandResult> {
    const packageInfo = getPackageInfo();

    if (context.json) {
      return {
        success: true,
        data: {
          name: packageInfo.name,
          description: packageInfo.description,
          version: packageInfo.version,
          commands: AVAILABLE_COMMANDS,
          usage: this.getUsageExamples(),
        },
        executionTime: 0,
      };
    }

    const helpText = this.generateHelpText(packageInfo);

    return {
      success: true,
      message: helpText,
      executionTime: 0,
    };
  }

  private static generateHelpText(packageInfo: PackageInfo): string {
    const lines: string[] = [];

    // 头部信息
    lines.push(`${packageInfo.name} v${packageInfo.version}`);
    lines.push(`${packageInfo.description || 'TypeScript-based CLI tool'}`);
    lines.push('');

    // 使用方法
    lines.push('USAGE:');
    lines.push(`  ${packageInfo.name} [COMMAND] [OPTIONS] [ARGS...]`);
    lines.push('');

    // 全局选项
    lines.push('GLOBAL OPTIONS:');
    lines.push('  -h, --help         Display help information');
    lines.push('  -v, --version      Display version information');
    lines.push('  --verbose          Enable verbose output');
    lines.push('  --dry-run          Show what would be done without executing');
    lines.push('  --json             Output in JSON format');
    lines.push('  --config <path>    Specify config file path');
    lines.push('');

    // 可用命令
    lines.push('COMMANDS:');
    const availableCommands = AVAILABLE_COMMANDS.filter((cmd) => cmd.status === 'available');
    const plannedCommands = AVAILABLE_COMMANDS.filter((cmd) => cmd.status === 'planned');

    if (availableCommands.length > 0) {
      lines.push('  Available:');
      for (const cmd of availableCommands) {
        const aliases = cmd.aliases ? ` (${cmd.aliases.join(', ')})` : '';
        lines.push(`    ${cmd.name.padEnd(12)} ${cmd.description}${aliases}`);
      }
      lines.push('');
    }

    if (plannedCommands.length > 0) {
      lines.push('  Planned (Coming Soon):');
      for (const cmd of plannedCommands) {
        lines.push(`    ${cmd.name.padEnd(12)} ${cmd.description}`);
      }
      lines.push('');
    }

    // 使用示例
    lines.push('EXAMPLES:');
    lines.push(`  ${packageInfo.name} --version`);
    lines.push(`  ${packageInfo.name} --help`);
    lines.push(`  ${packageInfo.name} task list --json`);
    lines.push(`  ${packageInfo.name} config get --verbose`);
    lines.push('');

    // 更多信息
    if (packageInfo.homepage) {
      lines.push(`Documentation: ${packageInfo.homepage}`);
    }
    if (packageInfo.bugs?.url) {
      lines.push(`Report issues: ${packageInfo.bugs.url}`);
    }

    return lines.join('\n');
  }

  private static getUsageExamples(): string[] {
    const packageName = getPackageInfo().name;
    return [
      `${packageName} --version`,
      `${packageName} --help`,
      `${packageName} task list --json`,
      `${packageName} config get --verbose`,
      `${packageName} mcp status`,
      `${packageName} git create-pr`,
    ];
  }
}

/**
 * 子命令发现器
 */
export class CommandDiscovery {
  /**
   * 获取所有可用命令
   */
  static getAvailableCommands(): CommandInfo[] {
    return AVAILABLE_COMMANDS.filter((cmd) => cmd.status === 'available');
  }

  /**
   * 获取计划中的命令
   */
  static getPlannedCommands(): CommandInfo[] {
    return AVAILABLE_COMMANDS.filter((cmd) => cmd.status === 'planned');
  }

  /**
   * 查找命令（支持别名）
   */
  static findCommand(name: string): CommandInfo | null {
    return (
      AVAILABLE_COMMANDS.find((cmd) => cmd.name === name || cmd.aliases?.includes(name) === true) ||
      null
    );
  }

  /**
   * 检查命令是否可用
   */
  static isCommandAvailable(name: string): boolean {
    const command = this.findCommand(name);
    return command !== null && command.status === 'available';
  }

  /**
   * 获取命令建议（用于拼写错误提示）
   */
  static getCommandSuggestions(input: string): string[] {
    const allNames = AVAILABLE_COMMANDS.flatMap((cmd) => [cmd.name, ...(cmd.aliases ?? [])]);

    // 简单的相似性匹配
    return allNames
      .filter((name) => {
        const distance = this.levenshteinDistance(input.toLowerCase(), name.toLowerCase());
        return distance <= 2; // 允许最多2个字符差异
      })
      .slice(0, 3); // 最多返回3个建议
  }

  /**
   * 计算编辑距离（用于命令建议）
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    if (str1 === str2) {
      return 0;
    }
    if (str1.length === 0) {
      return str2.length;
    }
    if (str2.length === 0) {
      return str1.length;
    }

    const previous: number[] = Array.from({ length: str1.length + 1 }, (_, i) => i);
    const current: number[] = new Array<number>(str1.length + 1);

    for (let j = 1; j <= str2.length; j++) {
      current[0] = j;
      for (let i = 1; i <= str1.length; i++) {
        const insertion = (previous[i] ?? Number.POSITIVE_INFINITY) + 1;
        const deletion = (current[i - 1] ?? Number.POSITIVE_INFINITY) + 1;
        const substitution =
          (previous[i - 1] ?? Number.POSITIVE_INFINITY) + (str1[i - 1] === str2[j - 1] ? 0 : 1);
        current[i] = Math.min(insertion, deletion, substitution);
      }
      for (let i = 0; i <= str1.length; i++) {
        previous[i] = current[i] ?? Number.POSITIVE_INFINITY;
      }
    }

    return previous[str1.length] ?? str1.length;
  }
}

/**
 * 元命令路由器
 */
export async function handleMetaCommand(
  command: string,
  context: CommandContext
): Promise<CommandResult | null> {
  switch (command) {
    case 'version':
    case '-v':
    case '--version':
      return VersionCommand.handle(context);

    case 'help':
    case '-h':
    case '--help':
      return HelpCommand.handle(context);

    default:
      return null;
  }
}
