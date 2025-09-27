/**
 * 现有 Shell 脚本的 TypeScript 包装器和引用
 * 提供渐进式迁移路径，保持向后兼容性
 */

import { resolve } from 'path';
import { spawn } from 'child_process';
import type { SpawnOptions } from 'child_process';

// 项目根目录路径
const PROJECT_ROOT = resolve(__dirname, '../..');

/**
 * 现有脚本路径映射
 */
export const LEGACY_SCRIPTS = {
  // 主要脚本
  start: resolve(PROJECT_ROOT, 'start.sh'),
  job: resolve(PROJECT_ROOT, 'job.sh'),
  runTests: resolve(PROJECT_ROOT, 'run_tests.sh'),

  // 库脚本
  common: resolve(PROJECT_ROOT, 'lib/common.sh'),
  presets: resolve(PROJECT_ROOT, 'lib/presets.sh'),

  // 规范管理脚本
  updateAgentContext: resolve(PROJECT_ROOT, '.specify/scripts/bash/update-agent-context.sh'),
  checkPrerequisites: resolve(PROJECT_ROOT, '.specify/scripts/bash/check-prerequisites.sh'),
  createNewFeature: resolve(PROJECT_ROOT, '.specify/scripts/bash/create-new-feature.sh'),
} as const;

/**
 * 脚本执行结果接口
 */
export interface ScriptResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

/**
 * 脚本执行选项
 */
export interface ScriptOptions extends Omit<SpawnOptions, 'stdio'> {
  timeout?: number;
  captureOutput?: boolean;
  workingDirectory?: string;
}

/**
 * 执行现有 Shell 脚本的通用函数
 */
export async function executeScript(
  scriptPath: string,
  args: string[] = [],
  options: ScriptOptions = {}
): Promise<ScriptResult> {
  const startTime = Date.now();
  const {
    timeout = 300000, // 5分钟默认超时
    captureOutput = true,
    workingDirectory = PROJECT_ROOT,
    ...spawnOptions
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn('bash', [scriptPath, ...args], {
      ...spawnOptions,
      cwd: workingDirectory,
      stdio: captureOutput ? 'pipe' : 'inherit',
    });

    let stdout = '';
    let stderr = '';

    if (captureOutput) {
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
    }

    // 超时处理
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Script execution timed out after ${timeout}ms`));
    }, timeout);

    child.on('close', (code) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      resolve({
        success: code === 0,
        exitCode: code || 0,
        stdout,
        stderr,
        duration,
      });
    });

    child.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

/**
 * 便捷的脚本执行函数
 */
export class LegacyScriptRunner {
  /**
   * 执行 start.sh 脚本
   */
  static async start(args: string[] = [], options?: ScriptOptions): Promise<ScriptResult> {
    return executeScript(LEGACY_SCRIPTS.start, args, options);
  }

  /**
   * 执行 job.sh 脚本
   */
  static async job(args: string[] = [], options?: ScriptOptions): Promise<ScriptResult> {
    return executeScript(LEGACY_SCRIPTS.job, args, options);
  }

  /**
   * 执行测试脚本
   */
  static async runTests(args: string[] = [], options?: ScriptOptions): Promise<ScriptResult> {
    return executeScript(LEGACY_SCRIPTS.runTests, args, options);
  }

  /**
   * 更新 Agent 上下文
   */
  static async updateAgentContext(agent: string = 'claude', options?: ScriptOptions): Promise<ScriptResult> {
    return executeScript(LEGACY_SCRIPTS.updateAgentContext, [agent], options);
  }

  /**
   * 检查前提条件
   */
  static async checkPrerequisites(
    flags: string[] = ['--json'],
    options?: ScriptOptions
  ): Promise<ScriptResult> {
    return executeScript(LEGACY_SCRIPTS.checkPrerequisites, flags, options);
  }

  /**
   * 创建新功能
   */
  static async createNewFeature(
    featureName: string,
    options?: ScriptOptions
  ): Promise<ScriptResult> {
    return executeScript(LEGACY_SCRIPTS.createNewFeature, [featureName], options);
  }
}

/**
 * 脚本迁移状态跟踪
 */
export const MIGRATION_STATUS = {
  // 已迁移到 TypeScript
  migrated: new Set<string>([
    // 暂时没有已迁移的脚本
  ]),

  // 计划迁移的脚本
  planned: new Set<string>([
    'start.sh',
    'job.sh',
    'lib/common.sh',
    'lib/presets.sh',
  ]),

  // 保持为 Shell 脚本的文件
  keepAsShell: new Set<string>([
    'run_tests.sh',
    '.specify/scripts/bash/update-agent-context.sh',
    '.specify/scripts/bash/check-prerequisites.sh',
    '.specify/scripts/bash/create-new-feature.sh',
  ]),
} as const;

/**
 * 检查脚本是否存在且可执行
 */
export async function validateScript(scriptPath: string): Promise<boolean> {
  try {
    const { access, constants } = await import('fs/promises');
    await access(scriptPath, constants.F_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 获取所有脚本的状态信息
 */
export async function getScriptStatus(): Promise<Record<string, {
  path: string;
  exists: boolean;
  executable: boolean;
  migrationStatus: 'migrated' | 'planned' | 'keepAsShell' | 'unknown';
}>> {
  const status: Record<string, any> = {};

  for (const [name, path] of Object.entries(LEGACY_SCRIPTS)) {
    const exists = await validateScript(path);

    let migrationStatus: 'migrated' | 'planned' | 'keepAsShell' | 'unknown' = 'unknown';
    if (MIGRATION_STATUS.migrated.has(path)) migrationStatus = 'migrated';
    else if (MIGRATION_STATUS.planned.has(path)) migrationStatus = 'planned';
    else if (MIGRATION_STATUS.keepAsShell.has(path)) migrationStatus = 'keepAsShell';

    status[name] = {
      path,
      exists,
      executable: exists, // 如果存在则假定可执行
      migrationStatus,
    };
  }

  return status;
}