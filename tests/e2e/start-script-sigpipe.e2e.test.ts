import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync, spawn } from 'child_process';
import { join } from 'path';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { waitPort } from '../helpers/test-utils';

describe('Start Script E2E - SIGPIPE Error Prevention', () => {
  const projectRoot = process.cwd();
  const originalStartSh = join(projectRoot, 'start.sh');
  const testOutputDir = '/tmp/codex-father-e2e-sigpipe';

  beforeAll(async () => {
    // 确保项目已构建
    if (!existsSync(join(projectRoot, 'dist'))) {
      execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
    }

    // 创建测试输出目录
    mkdirSync(testOutputDir, { recursive: true });
  });

  afterAll(() => {
    // 清理测试输出
    if (existsSync(testOutputDir)) {
      rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  it('should run start.sh without SIGPIPE errors', async () => {
    const testTag = 'sigpipe-test-' + Date.now();

    // 使用简单的任务运行脚本
    const result = execSync(
      `./start.sh --tag ${testTag} --task "简单测试任务：创建一个测试文件" --sandbox workspace-write`,
      {
        cwd: projectRoot,
        encoding: 'utf8',
        timeout: 30000,
        env: {
          ...process.env,
          CODEX_LOG_DIR: testOutputDir
        }
      }
    );

    // 验证脚本成功执行（退出码 0）
    expect(result).toContain('Codex 运行完成');
    expect(result).toContain('退出码: 0');

    // 验证日志文件被创建
    const logFiles = execSync(`find ${testOutputDir} -name "*.log"`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(f => f);

    expect(logFiles.length).toBeGreaterThan(0);

    // 检查日志文件内容，确保没有 SIGPIPE 错误
    const latestLogFile = logFiles[logFiles.length - 1];
    const logContent = readFileSync(latestLogFile, 'utf8');

    // 不应该包含 SIGPIPE 相关的错误
    expect(logContent).not.toContain('Exit Code: 141');
    expect(logContent).not.toContain('SIGPIPE');
  });

  it('should handle multiple pipeline operations correctly', () => {
    const testTag = 'pipeline-test-' + Date.now();

    // 创建包含复杂内容的任务
    const complexTask = `
请执行以下操作：
1. 创建一个名为 pipeline-test.txt 的文件
2. 在文件中写入测试内容
3. 列出当前目录的文件
4. 输出操作完成
    `.trim();

    const result = execSync(
      `./start.sh --tag ${testTag} --task "${complexTask}" --sandbox workspace-write`,
      {
        cwd: projectRoot,
        encoding: 'utf8',
        timeout: 45000,
        env: {
          ...process.env,
          CODEX_LOG_DIR: testOutputDir
        }
      }
    );

    // 验证脚本成功执行
    expect(result).toContain('Codex 运行完成');
    expect(result).toContain('退出码: 0');
  });

  it('should handle large instruction content without SIGPIPE', () => {
    const testTag = 'large-content-test-' + Date.now();

    // 创建大量内容的任务（可能导致管道问题）
    const largeContent = Array(100).fill('这是一个很长的指令内容行，用于测试管道处理能力。').join('\n');

    const result = execSync(
      `./start.sh --tag ${testTag} --task "${largeContent.substring(0, 1000)}..." --sandbox workspace-write`,
      {
        cwd: projectRoot,
        encoding: 'utf8',
        timeout: 60000,
        env: {
          ...process.env,
          CODEX_LOG_DIR: testOutputDir
        }
      }
    );

    // 验证脚本成功执行
    expect(result).toContain('Codex 运行完成');
    expect(result).toContain('退出码: 0');
  });

  it('should preserve proper title extraction without SIGPIPE', () => {
    const testTag = 'title-extraction-test-' + Date.now();

    // 创建带有标题的任务
    const taskWithTitle = `
任务：验证标题提取功能
====================
这是一个专门用于测试标题提取功能的任务。
标题应该被正确提取并显示在进度中。
====================
    `.trim();

    const result = execSync(
      `./start.sh --tag ${testTag} --task "${taskWithTitle}" --sandbox workspace-write`,
      {
        cwd: projectRoot,
        encoding: 'utf8',
        timeout: 45000,
        env: {
          ...process.env,
          CODEX_LOG_DIR: testOutputDir
        }
      }
    );

    // 验证脚本成功执行
    expect(result).toContain('Codex 运行完成');
    expect(result).toContain('退出码: 0');

    // 检查进度文件是否存在（如果有的话）
    const progressFiles = execSync(`find ${testOutputDir} -name "progress.json"`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(f => f);

    if (progressFiles.length > 0) {
      const progressContent = readFileSync(progressFiles[0], 'utf8');
      // 验证进度文件包含预期的任务标题
      expect(progressContent).toContain('标题提取功能');
    }
  });

  it('should handle node heredoc operations without SIGPIPE', () => {
    const testTag = 'node-heredoc-test-' + Date.now();

    // 测试包含 JavaScript 相关操作的任务
    const nodeTask = `
请创建一个简单的 Node.js 脚本，该脚本：
1. 创建一个名为 test-script.js 的文件
2. 脚本应该输出 "Hello from Node.js"
3. 验证脚本可以正常运行
    `.trim();

    const result = execSync(
      `./start.sh --tag ${testTag} --task "${nodeTask}" --sandbox workspace-write`,
      {
        cwd: projectRoot,
        encoding: 'utf8',
        timeout: 60000,
        env: {
          ...process.env,
          CODEX_LOG_DIR: testOutputDir
        }
      }
    );

    // 验证脚本成功执行
    expect(result).toContain('Codex 运行完成');
    expect(result).toContain('退出码: 0');
  });
});