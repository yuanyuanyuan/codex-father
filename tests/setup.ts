/**
 * Vitest 全局测试设置
 * 在所有测试运行前执行的初始化逻辑
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { resolve, dirname } from 'path';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

// 测试环境配置
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_DIR = resolve(__dirname, '../.test-temp');
const ORIGINAL_ENV = process.env;

beforeAll(() => {
  // 创建测试临时目录
  mkdirSync(TEST_DIR, { recursive: true });

  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.CI = 'true';
  process.env.CODEX_TEST_MODE = 'true';

  console.log('🧪 Test environment initialized');
});

afterAll(() => {
  // 清理测试目录
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to cleanup test directory:', error);
  }

  // 恢复原始环境变量
  process.env = ORIGINAL_ENV;

  console.log('🧹 Test environment cleaned up');
});

beforeEach(() => {
  // 每个测试前的设置
  // 如需要可以在这里添加通用的测试前置逻辑
});

afterEach(() => {
  // 每个测试后的清理
  // 如需要可以在这里添加通用的测试清理逻辑
});

// 全局测试工具函数
declare global {
  var testUtils: {
    tempDir: string;
    createTempFile: (name: string, content: string) => string;
    cleanup: () => void;
  };
}

global.testUtils = {
  tempDir: TEST_DIR,
  createTempFile: (name: string, content: string) => {
    const filePath = resolve(TEST_DIR, name);
    writeFileSync(filePath, content, 'utf8');
    return filePath;
  },
  cleanup: () => {
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
      mkdirSync(TEST_DIR, { recursive: true });
    } catch (error) {
      console.warn('Failed to cleanup during test:', error);
    }
  },
};
