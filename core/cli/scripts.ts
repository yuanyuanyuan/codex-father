/**
 * 现有 Shell 脚本的 TypeScript 包装器和引用
 * 提供渐进式迁移路径，保持向后兼容性
 */

import { resolve, dirname, relative, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import type { SpawnOptions } from 'child_process';
import { createError } from './error-boundary.js';

/**
 * 动态查找项目根目录
 * 通过向上查找 package.json 或 .git 目录来确定项目根目录
 */
function findProjectRoot(): string {
  let currentDir = process.cwd();

  while (currentDir !== dirname(currentDir)) {
    if (
      existsSync(resolve(currentDir, 'package.json')) ||
      existsSync(resolve(currentDir, '.git'))
    ) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  // 如果找不到，回退到当前工作目录
  return process.cwd();
}

// 项目根目录路径
const PROJECT_ROOT = findProjectRoot();

/**
 * 查找 CLI 包自身的根目录
 * 基于当前模块位置回溯 package.json
 */
function findCliPackageRoot(): string {
  const moduleDir = dirname(fileURLToPath(import.meta.url));
  let currentDir = moduleDir;

  while (currentDir !== dirname(currentDir)) {
    if (existsSync(resolve(currentDir, 'package.json'))) {
      return currentDir;
    }
    currentDir = dirname(currentDir);
  }

  return moduleDir;
}

// CLI 包的根目录（start.sh、job.sh 等资产应位于此处）
const PACKAGE_ROOT = findCliPackageRoot();

/**
 * 将环境变量提供的路径标准化为绝对路径
 */
function normalizeUserProvidedPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }

  if (isAbsolute(trimmed)) {
    return trimmed;
  }

  return resolve(process.cwd(), trimmed);
}

/**
 * 根据环境变量和包内相对路径确定脚本位置
 */
function resolveScriptPath(options: { env?: string; relative: string }): string {
  if (options.env) {
    const fromEnv = process.env[options.env];
    if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
      return normalizeUserProvidedPath(fromEnv);
    }
  }

  return resolve(PACKAGE_ROOT, options.relative);
}

/**
 * 现有脚本路径映射
 */
export const LEGACY_SCRIPTS = {
  // 主要脚本
  start: resolveScriptPath({ env: 'CODEX_START_SH', relative: 'start.sh' }),
  job: resolveScriptPath({ env: 'CODEX_JOB_SH', relative: 'job.sh' }),
  runTests: resolve(PACKAGE_ROOT, 'run_tests.sh'),

  // 库脚本
  common: resolve(PACKAGE_ROOT, 'lib/common.sh'),
  presets: resolve(PACKAGE_ROOT, 'lib/presets.sh'),

  // 规范管理脚本
  updateAgentContext: resolve(PACKAGE_ROOT, '.specify/scripts/bash/update-agent-context.sh'),
  checkPrerequisites: resolve(PACKAGE_ROOT, '.specify/scripts/bash/check-prerequisites.sh'),
  createNewFeature: resolve(PACKAGE_ROOT, '.specify/scripts/bash/create-new-feature.sh'),
} as const;

const REQUIRED_SCRIPT_ENVS: Partial<Record<keyof typeof LEGACY_SCRIPTS, string>> = {
  start: 'CODEX_START_SH',
  job: 'CODEX_JOB_SH',
};

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
// 默认超时配置
const DEFAULT_TIMEOUTS = {
  start: 600000, // 10分钟 - start.sh 可能需要初始化时间
  job: 1800000, // 30分钟 - job.sh 异步作业可能很长
  runTests: 900000, // 15分钟 - 测试可能需要较长时间
  default: 600000, // 10分钟 - 其他脚本默认超时
} as const;

/**
 * 获取脚本的合适超时时间
 */
function getScriptTimeout(scriptPath: string, customTimeout?: number): number {
  if (customTimeout !== undefined) {
    return customTimeout;
  }

  // 从环境变量获取超时配置
  const envTimeout = process.env.CODEX_SCRIPT_TIMEOUT;
  if (envTimeout && !isNaN(Number(envTimeout))) {
    return Number(envTimeout);
  }

  // 根据脚本类型选择超时时间
  if (scriptPath.includes('start.sh')) {
    return DEFAULT_TIMEOUTS.start;
  }
  if (scriptPath.includes('job.sh')) {
    return DEFAULT_TIMEOUTS.job;
  }
  if (scriptPath.includes('test')) {
    return DEFAULT_TIMEOUTS.runTests;
  }

  return DEFAULT_TIMEOUTS.default;
}

async function ensureScriptAvailable(
  name: keyof typeof LEGACY_SCRIPTS,
  scriptPath: string
): Promise<void> {
  const valid = await validateScript(scriptPath);
  if (valid) {
    return;
  }

  const envVar = REQUIRED_SCRIPT_ENVS[name];
  const suggestions = envVar
    ? [
        `确认环境变量 ${envVar} 指向可执行的脚本路径`,
        '或重新安装 codex-father 以恢复缺失的 Shell 资产',
      ]
    : ['重新安装 codex-father 以恢复缺失的 Shell 资产'];

  throw createError.configuration(
    `Legacy script '${name}' is missing or not executable`,
    scriptPath,
    suggestions
  );
}

export async function executeScript(
  scriptPath: string,
  args: string[] = [],
  options: ScriptOptions = {}
): Promise<ScriptResult> {
  const startTime = Date.now();
  const {
    timeout = getScriptTimeout(scriptPath, options.timeout),
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
    await ensureScriptAvailable('start', LEGACY_SCRIPTS.start);
    return executeScript(LEGACY_SCRIPTS.start, args, options);
  }

  /**
   * 执行 job.sh 脚本
   */
  static async job(args: string[] = [], options?: ScriptOptions): Promise<ScriptResult> {
    await ensureScriptAvailable('job', LEGACY_SCRIPTS.job);
    return executeScript(LEGACY_SCRIPTS.job, args, options);
  }

  /**
   * 执行测试脚本
   */
  static async runTests(args: string[] = [], options?: ScriptOptions): Promise<ScriptResult> {
    await ensureScriptAvailable('runTests', LEGACY_SCRIPTS.runTests);
    return executeScript(LEGACY_SCRIPTS.runTests, args, options);
  }

  /**
   * 更新 Agent 上下文
   */
  static async updateAgentContext(
    agent: string = 'claude',
    options?: ScriptOptions
  ): Promise<ScriptResult> {
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
  planned: new Set<string>(['start.sh', 'job.sh', 'lib/common.sh', 'lib/presets.sh']),

  // 保持为 Shell 脚本的文件
  keepAsShell: new Set<string>([
    'run_tests.sh',
    '.specify/scripts/bash/update-agent-context.sh',
    '.specify/scripts/bash/check-prerequisites.sh',
    '.specify/scripts/bash/create-new-feature.sh',
  ]),
} as const;

/**
 * 检查脚本文件的状态
 */
export async function checkScriptStatus(scriptPath: string): Promise<{
  exists: boolean;
  executable: boolean;
}> {
  try {
    const { access, constants } = await import('fs/promises');

    // 检查文件是否存在
    let exists = true;
    try {
      await access(scriptPath, constants.F_OK);
    } catch {
      exists = false;
    }

    // 检查文件是否可执行（只有在文件存在时才检查）
    let executable = false;
    if (exists) {
      try {
        await access(scriptPath, constants.X_OK);
        executable = true;
      } catch {
        executable = false;
      }
    }

    return { exists, executable };
  } catch {
    return { exists: false, executable: false };
  }
}

/**
 * 检查脚本是否存在且可执行（向后兼容）
 */
export async function validateScript(scriptPath: string): Promise<boolean> {
  const { exists, executable } = await checkScriptStatus(scriptPath);
  return exists && executable;
}

/**
 * 获取所有脚本的状态信息
 */
type ScriptStatus = {
  path: string;
  exists: boolean;
  executable: boolean;
  migrationStatus: 'migrated' | 'planned' | 'keepAsShell' | 'unknown';
  source: 'env' | 'package';
  envVar?: string;
};

export async function getScriptStatus(): Promise<Record<string, ScriptStatus>> {
  const status: Record<string, ScriptStatus> = {};

  for (const [name, path] of Object.entries(LEGACY_SCRIPTS)) {
    const { exists, executable } = await checkScriptStatus(path);

    // 提取相对于项目根目录的相对路径用于状态比较
    const relativePath = relative(PACKAGE_ROOT, path);

    let migrationStatus: 'migrated' | 'planned' | 'keepAsShell' | 'unknown' = 'unknown';
    if (MIGRATION_STATUS.migrated.has(relativePath)) {
      migrationStatus = 'migrated';
    } else if (MIGRATION_STATUS.planned.has(relativePath)) {
      migrationStatus = 'planned';
    } else if (MIGRATION_STATUS.keepAsShell.has(relativePath)) {
      migrationStatus = 'keepAsShell';
    }

    const envVar = REQUIRED_SCRIPT_ENVS[name as keyof typeof LEGACY_SCRIPTS];
    const envValue = envVar ? process.env[envVar] : undefined;

    const scriptStatus: ScriptStatus = {
      path,
      exists,
      executable,
      migrationStatus,
      source: envValue ? 'env' : 'package',
    };

    if (envVar) {
      scriptStatus.envVar = envVar;
    }

    status[name] = scriptStatus;
  }

  return status;
}
