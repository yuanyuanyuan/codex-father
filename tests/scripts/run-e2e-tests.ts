#!/usr/bin/env tsx

/**
 * E2E 测试运行脚本
 * 提供便捷的 E2E 测试执行和管理功能
 */

import { spawn } from 'child_process';
import { program } from 'commander';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestOptions {
  parallel: boolean;
  coverage: boolean;
  verbose: boolean;
  watch: boolean;
  pattern?: string;
  timeout?: number;
  retries?: number;
  reporter?: string;
}

/**
 * 运行 E2E 测试
 */
async function runE2ETests(options: TestOptions): Promise<void> {
  const vitestPath = join(__dirname, '../../node_modules/.bin/vitest');
  const configPath = join(__dirname, '../config/vitest.e2e.config.ts');

  const args = ['run', '--config', configPath, '--reporter', options.verbose ? 'verbose' : 'dot'];

  if (options.coverage) {
    args.push('--coverage.enabled', 'true');
  }

  if (options.watch) {
    args[args.indexOf('run')] = 'watch';
  }

  if (options.pattern) {
    args.push('--include', options.pattern);
  }

  if (options.timeout) {
    args.push('--test-timeout', options.timeout.toString());
  }

  if (options.retries) {
    args.push('--retry', options.retries.toString());
  }

  if (options.reporter) {
    args.push('--reporter', options.reporter);
  }

  console.log('🚀 Starting E2E tests...');
  console.log('Command:', `vitest ${args.join(' ')}`);

  const child = spawn(vitestPath, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CODEX_FATHER_TEST_MODE: 'e2e',
    },
  });

  return new Promise((resolve, reject) => {
    child.on('exit', (code) => {
      if (code === 0) {
        console.log('✅ E2E tests completed successfully');
        resolve();
      } else {
        console.error(`❌ E2E tests failed with exit code: ${code}`);
        reject(new Error(`E2E tests failed with exit code: ${code}`));
      }
    });

    child.on('error', (error) => {
      console.error('❌ Failed to start E2E tests:', error);
      reject(error);
    });
  });
}

/**
 * 检查测试环境
 */
async function checkTestEnvironment(): Promise<boolean> {
  console.log('🔍 Checking test environment...');

  const checks = [
    {
      name: 'Node.js version',
      check: () => {
        const version = process.version;
        const majorVersion = parseInt(version.slice(1).split('.')[0]);
        return majorVersion >= 18;
      },
    },
    {
      name: 'Available memory',
      check: async () => {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        try {
          const { stdout } = await execAsync('free -m');
          const lines = stdout.split('\n');
          const memLine = lines.find((line) => line.startsWith('Mem:'));
          if (memLine) {
            const totalMem = parseInt(memLine.split(/\s+/)[1]);
            return totalMem > 1000; // 至少 1GB 内存
          }
          return true;
        } catch {
          return true; // 无法检查时假设通过
        }
      },
    },
    {
      name: 'Disk space',
      check: async () => {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        try {
          const { stdout } = await execAsync('df -h /tmp');
          const lines = stdout.split('\n');
          const tmpLine = lines.find((line) => line.includes('/tmp'));
          if (tmpLine) {
            const parts = tmpLine.split(/\s+/);
            const available = parts[3];
            return available && available !== '0';
          }
          return true;
        } catch {
          return true;
        }
      },
    },
  ];

  let allPassed = true;

  for (const check of checks) {
    try {
      const passed = await check.check();
      if (passed) {
        console.log(`✅ ${check.name}: OK`);
      } else {
        console.log(`❌ ${check.name}: FAILED`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`⚠️ ${check.name}: UNKNOWN (${error})`);
    }
  }

  return allPassed;
}

/**
 * 准备测试环境
 */
async function prepareTestEnvironment(): Promise<void> {
  console.log('🔧 Preparing test environment...');

  const fs = await import('fs/promises');
  const path = await import('path');

  // 创建测试目录
  const testDirs = ['/tmp/codex-father-e2e', '/tmp/codex-father-logs', '/tmp/codex-father-data'];

  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    } catch (error) {
      console.error(`❌ Failed to create directory ${dir}:`, error);
    }
  }

  // 清理旧的测试数据
  try {
    const oldDirs = await fs.readdir('/tmp', { withFileTypes: true });
    const codexDirs = oldDirs
      .filter((dirent) => dirent.isDirectory() && dirent.name.startsWith('codex-father-test-'))
      .map((dirent) => path.join('/tmp', dirent.name));

    for (const dir of codexDirs) {
      await fs.rm(dir, { recursive: true, force: true });
      console.log(`🗑️ Cleaned old test directory: ${dir}`);
    }
  } catch (error) {
    console.log('⚠️ Could not cleanup old test directories:', error);
  }
}

/**
 * 生成测试报告
 */
async function generateTestReport(): Promise<void> {
  console.log('📊 Generating test report...');

  const fs = await import('fs/promises');
  const path = await import('path');

  const reportDir = path.join(__dirname, '../../test-results');
  const coverageDir = path.join(__dirname, '../../coverage');

  try {
    await fs.mkdir(reportDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `e2e-report-${timestamp}.md`);

    // 检查是否有测试结果文件
    const resultFiles = await fs.readdir(reportDir).catch(() => []);
    const coverageFiles = await fs.readdir(coverageDir).catch(() => []);

    const report = `# E2E Test Report

## Test Information
- **Timestamp**: ${new Date().toISOString()}
- **Node Version**: ${process.version}
- **Platform**: ${process.platform}
- **Architecture**: ${process.arch}

## Results Summary
${resultFiles.length > 0 ? `- Result files found: ${resultFiles.length}` : '- No result files found'}
${coverageFiles.length > 0 ? `- Coverage files found: ${coverageFiles.length}` : '- No coverage files found'}

## Environment Variables
- NODE_ENV: ${process.env.NODE_ENV}
- CODEX_FATHER_TEST_MODE: ${process.env.CODEX_FATHER_TEST_MODE}

## Next Steps
1. Review test results in the ${reportDir} directory
2. Check coverage reports in ${coverageDir} directory
3. Analyze any failures and fix issues
4. Re-run tests to verify fixes

---
*Generated by E2E test runner at ${new Date().toISOString()}*
`;

    await fs.writeFile(reportFile, report);
    console.log(`📝 Test report generated: ${reportFile}`);
  } catch (error) {
    console.error('❌ Failed to generate test report:', error);
  }
}

// CLI 程序配置
program.name('run-e2e-tests').description('E2E test runner for Codex Father').version('1.0.0');

program
  .command('run')
  .description('Run E2E tests')
  .option('-p, --parallel', 'Run tests in parallel', false)
  .option('-c, --coverage', 'Generate coverage report', false)
  .option('-v, --verbose', 'Verbose output', false)
  .option('-w, --watch', 'Watch mode', false)
  .option('--pattern <pattern>', 'Test file pattern')
  .option('--timeout <ms>', 'Test timeout in milliseconds', '120000')
  .option('--retries <count>', 'Number of retries', '2')
  .option('--reporter <type>', 'Test reporter type', 'dot')
  .option('--skip-checks', 'Skip environment checks', false)
  .option('--skip-prep', 'Skip environment preparation', false)
  .option('--no-report', 'Skip report generation', false)
  .action(async (options) => {
    try {
      if (!options.skipChecks) {
        console.log('🔍 Running environment checks...');
        const envOk = await checkTestEnvironment();
        if (!envOk) {
          console.error('❌ Environment checks failed. Use --skip-checks to bypass.');
          process.exit(1);
        }
      }

      if (!options.skipPrep) {
        console.log('🔧 Preparing test environment...');
        await prepareTestEnvironment();
      }

      await runE2ETests({
        parallel: options.parallel,
        coverage: options.coverage,
        verbose: options.verbose,
        watch: options.watch,
        pattern: options.pattern,
        timeout: parseInt(options.timeout),
        retries: parseInt(options.retries),
        reporter: options.reporter,
      });

      if (!options.noReport) {
        await generateTestReport();
      }

      console.log('🎉 All E2E tests completed successfully!');
    } catch (error) {
      console.error('❌ E2E tests failed:', error);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check test environment')
  .action(async () => {
    const envOk = await checkTestEnvironment();
    if (envOk) {
      console.log('✅ Environment is ready for E2E tests');
    } else {
      console.log('❌ Environment is not ready for E2E tests');
      process.exit(1);
    }
  });

program
  .command('prepare')
  .description('Prepare test environment')
  .action(async () => {
    await prepareTestEnvironment();
    console.log('✅ Test environment prepared');
  });

program
  .command('report')
  .description('Generate test report')
  .action(async () => {
    await generateTestReport();
    console.log('✅ Test report generated');
  });

// 如果直接运行此脚本，显示帮助
if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse();
}

export { runE2ETests, checkTestEnvironment, prepareTestEnvironment, generateTestReport };
