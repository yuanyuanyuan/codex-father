/**
 * E2E 测试环境设置
 * 配置测试前的环境准备和清理工作
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { TestUtils } from '../helpers/test-utils.js';

// 全局测试配置
const TEST_CONFIG = {
  timeout: 120000, // 2分钟
  retryAttempts: 3,
  cleanupDelay: 1000,
  tempDir: '/tmp/codex-father-e2e',
};

// 全局状态管理
interface GlobalTestState {
  tempDir: string;
  processes: Array<{ pid: number; name: string }>;
  servers: Array<{ port: number; name: string; close: () => Promise<void> }>;
  testStartTime: Date;
}

const globalState: GlobalTestState = {
  tempDir: TEST_CONFIG.tempDir,
  processes: [],
  servers: [],
  testStartTime: new Date(),
};

/**
 * 设置测试环境变量
 */
function setupTestEnvironment(): void {
  process.env.NODE_ENV = 'test';
  process.env.CI = 'true';
  process.env.TESTING = 'true';
  process.env.CODEX_FATHER_TEST_MODE = 'e2e';

  // 设置测试数据目录
  process.env.CODEX_FATHER_DATA_DIR = globalState.tempDir;
  process.env.CODEX_FATHER_LOG_LEVEL = 'debug';

  // 禁用某些可能影响测试的功能
  process.env.CODEX_FATHER_DISABLE_TELEMETRY = 'true';
  process.env.CODEX_FATHER_DISABLE_UPDATES = 'true';
}

/**
 * 清理测试环境
 */
function cleanupTestEnvironment(): void {
  // 恢复环境变量
  delete process.env.NODE_ENV;
  delete process.env.CI;
  delete process.env.TESTING;
  delete process.env.CODEX_FATHER_TEST_MODE;
  delete process.env.CODEX_FATHER_DATA_DIR;
  delete process.env.CODEX_FATHER_LOG_LEVEL;
  delete process.env.CODEX_FATHER_DISABLE_TELEMETRY;
  delete process.env.CODEX_FATHER_DISABLE_UPDATES;
}

/**
 * 创建临时目录
 */
async function createTempDirectory(): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    await fs.mkdir(globalState.tempDir, { recursive: true });
    console.log(`📁 Created temp directory: ${globalState.tempDir}`);
  } catch (error) {
    console.error(`❌ Failed to create temp directory:`, error);
    throw error;
  }
}

/**
 * 清理临时目录
 */
async function cleanupTempDirectory(): Promise<void> {
  const fs = await import('fs/promises');

  try {
    await fs.rm(globalState.tempDir, { recursive: true, force: true });
    console.log(`🗑️ Cleaned up temp directory: ${globalState.tempDir}`);
  } catch (error) {
    console.error(`⚠️ Failed to cleanup temp directory:`, error);
  }
}

/**
 * 检查端口是否可用
 */
async function isPortAvailable(port: number): Promise<boolean> {
  const net = await import('net');

  return new Promise((resolve) => {
    const server = net.createServer();

    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });

    server.on('error', () => resolve(false));
  });
}

/**
 * 获取可用端口
 */
async function getAvailablePort(startPort: number = 3000): Promise<number> {
  let port = startPort;

  while (!(await isPortAvailable(port))) {
    port++;
  }

  return port;
}

/**
 * 清理进程
 */
async function cleanupProcesses(): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  for (const proc of globalState.processes) {
    try {
      // 尝试优雅终止
      process.kill(proc.pid, 'SIGTERM');

      // 等待一段时间
      await TestUtils.sleep(2000);

      // 如果还在运行，强制终止
      try {
        process.kill(proc.pid, 0); // 检查进程是否还存在
        process.kill(proc.pid, 'SIGKILL');
      } catch {
        // 进程已经不存在
      }

      console.log(`🔄 Cleaned up process: ${proc.name} (PID: ${proc.pid})`);
    } catch (error) {
      console.error(`⚠️ Failed to cleanup process ${proc.name}:`, error);
    }
  }

  globalState.processes = [];
}

/**
 * 清理服务器
 */
async function cleanupServers(): Promise<void> {
  for (const server of globalState.servers) {
    try {
      await server.close();
      console.log(`🔄 Cleaned up server: ${server.name} (Port: ${server.port})`);
    } catch (error) {
      console.error(`⚠️ Failed to cleanup server ${server.name}:`, error);
    }
  }

  globalState.servers = [];
}

/**
 * 等待服务启动
 */
async function waitForService(url: string, timeout: number = 30000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // 服务还未启动，继续等待
    }

    await TestUtils.sleep(1000);
  }

  throw new Error(`Service at ${url} did not start within ${timeout}ms`);
}

/**
 * 注册进程到全局状态
 */
function registerProcess(pid: number, name: string): void {
  globalState.processes.push({ pid, name });
  console.log(`📝 Registered process: ${name} (PID: ${pid})`);
}

/**
 * 注册服务器到全局状态
 */
function registerServer(port: number, name: string, closeFn: () => Promise<void>): void {
  globalState.servers.push({ port, name, close: closeFn });
  console.log(`📝 Registered server: ${name} (Port: ${port})`);
}

// 全局设置
beforeAll(async () => {
  console.log('🚀 Setting up E2E test environment...');

  // 设置环境变量
  setupTestEnvironment();

  // 创建临时目录
  await createTempDirectory();

  // 初始化测试开始时间
  globalState.testStartTime = new Date();

  console.log('✅ E2E test environment ready');
}, TEST_CONFIG.timeout);

// 全局清理
afterAll(async () => {
  console.log('🧹 Cleaning up E2E test environment...');

  // 清理进程和服务器
  await cleanupProcesses();
  await cleanupServers();

  // 等待一段时间让资源释放
  await TestUtils.sleep(TEST_CONFIG.cleanupDelay);

  // 清理临时目录
  await cleanupTempDirectory();

  // 恢复环境变量
  cleanupTestEnvironment();

  const duration = Date.now() - globalState.testStartTime.getTime();
  console.log(`✅ E2E test cleanup completed (Duration: ${duration}ms)`);
}, TEST_CONFIG.timeout);

// 每个测试前的设置
beforeEach(async () => {
  // 确保每个测试都有干净的环境
  console.log(`🔄 Setting up test case...`);

  // 可以在这里添加测试特定的设置
  await TestUtils.sleep(100); // 短暂等待确保资源释放
});

// 每个测试后的清理
afterEach(async () => {
  console.log(`🧹 Cleaning up test case...`);

  // 等待一段时间让异步操作完成
  await TestUtils.sleep(200);
});

// 导出工具函数供测试使用
export const E2ETestUtils = {
  getAvailablePort,
  waitForService,
  registerProcess,
  registerServer,
  createTempDirectory,
  cleanupTempDirectory,
  TEST_CONFIG,
  globalState,
};

// 扩展 Vitest 全局上下文
declare global {
  namespace Vi {
    interface TestContext {
      e2e: typeof E2ETestUtils;
    }
  }
}

// 在测试上下文中注册工具
beforeEach(() => {
  // @ts-ignore
  globalThis.e2e = E2ETestUtils;
});
