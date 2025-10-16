#!/usr/bin/env node

/**
 * 分批测试执行脚本
 * 解决内存溢出问题，智能分批执行测试
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

type TestResult = {
  batch: string;
  success: boolean;
  duration: number;
  passed: number;
  failed: number;
  total: number;
  coverage?: any;
  error?: string;
};

type TestBatch = {
  name: string;
  files: string[];
  memoryLimit: string;
  timeout: number;
  priority: number;
};

class BatchTestRunner {
  private results: TestResult[] = [];
  private outputDir = './test-results';
  private reportFile = join(this.outputDir, 'batch-test-report.json');

  constructor() {
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
    }
  }

  // 测试批次定义 - 按内存压力和复杂度分组
  private getTestBatches(): TestBatch[] {
    return [
      // 第一批：核心单元测试（低压力）
      {
        name: 'core-units',
        files: [
          'tests/unit/versionDetector.test.ts',
          'tests/unit/configValidator.test.ts',
          'tests/unit/configSchema.test.ts',
          'tests/unit/errorFormatter.test.ts',
          'tests/unit/degradationStrategy.test.ts',
          'tests/unit/profileManager.test.ts',
          'tests/unit/parameterMapping.test.ts',
          'tests/unit/modelWireApiMapping.test.ts',
          'tests/unit/bulk-sdk.test.ts',
        ],
        memoryLimit: '2048',
        timeout: 300000,
        priority: 1,
      },

      // 第二批：小型单元测试（低压力）
      {
        name: 'small-units',
        files: [
          'tests/unit/schemas/status-example.test.ts',
          'tests/unit/schemas/events-enum.test.ts',
          'tests/unit/http-version.test.ts',
          'tests/unit/version-command.test.ts',
          'tests/unit/mcp-tools-spec-version.test.ts',
        ],
        memoryLimit: '1536',
        timeout: 120000,
        priority: 2,
      },

      // 第三批：HTTP服务器单元测试（中压力）
      {
        name: 'http-server',
        files: ['tests/unit/http/HTTPServer.unit.test.ts'],
        memoryLimit: '3072',
        timeout: 600000,
        priority: 3,
      },

      // 第四批：契约测试（中压力）
      {
        name: 'contracts',
        files: [
          'tests/contract/codex-jsonrpc.test.ts',
          'tests/contract/mcp-tools-list.test.ts',
          'tests/contract/mcp-tools-call.test.ts',
          'tests/contract/mcp-initialize.test.ts',
        ],
        memoryLimit: '2560',
        timeout: 300000,
        priority: 4,
      },

      // 第五批：小型契约测试（低压力）
      {
        name: 'small-contracts',
        files: [
          'tests/contract/sendUserTurn.contract.test.ts',
          'tests/contract/sendUserMessage.contract.test.ts',
          'tests/contract/applyPatchApproval.contract.test.ts',
          'tests/contract/execOneOffCommand.contract.test.ts',
          'tests/contract/codex-event.contract.test.ts',
          'tests/contract/listConversations.contract.test.ts',
          'tests/contract/getUserSavedConfig.contract.test.ts',
        ],
        memoryLimit: '2048',
        timeout: 240000,
        priority: 5,
      },

      // 第六批：认证相关契约测试（低压力）
      {
        name: 'auth-contracts',
        files: [
          'tests/contract/getAuthStatus.contract.test.ts',
          'tests/contract/loginChatGpt.test.ts',
          'tests/contract/loginApiKey.test.ts',
          'tests/contract/loginChatGptComplete.test.ts',
          'tests/contract/cancelLoginChatGpt.contract.test.ts',
          'tests/contract/logoutChatGpt.test.ts',
          'tests/contract/authStatusChange.contract.test.ts',
          'tests/contract/userInfo.contract.test.ts',
        ],
        memoryLimit: '2048',
        timeout: 240000,
        priority: 6,
      },

      // 第七批：中型集成测试（中压力）
      {
        name: 'medium-integration',
        files: [
          'tests/integration/configHandlers.test.ts',
          'tests/integration/utilHandlers.test.ts',
          'tests/integration/bridge-happy-path.test.ts',
          'tests/integration/eventHandler.test.ts',
          'tests/integration/approvalHandlers.test.ts',
        ],
        memoryLimit: '3072',
        timeout: 400000,
        priority: 7,
      },

      // 第八批：TaskRunner相关测试（高压力）
      {
        name: 'taskrunner-tests',
        files: ['tests/unit/core/TaskRunner.unit.test.ts', 'tests/unit/TaskRunner.test.ts'],
        memoryLimit: '4096',
        timeout: 500000,
        priority: 8,
      },

      // 第九批：MCP服务器单元测试（高压力）
      {
        name: 'mcp-server',
        files: ['tests/unit/mcp/MCPServer.unit.test.ts'],
        memoryLimit: '4096',
        timeout: 600000,
        priority: 9,
      },

      // 第十批：E2E测试（高压力）- 单独运行
      {
        name: 'e2e-http-api',
        files: ['tests/e2e/http-api.e2e.test.ts'],
        memoryLimit: '6144',
        timeout: 900000,
        priority: 10,
      },

      // 第十一批：并发引擎E2E测试（高压力）
      {
        name: 'e2e-concurrency',
        files: ['tests/e2e/concurrency-engine.e2e.test.ts'],
        memoryLimit: '6144',
        timeout: 900000,
        priority: 11,
      },

      // 第十二批：MCP工具包E2E测试（高压力）
      {
        name: 'e2e-mcp-toolkit',
        files: ['tests/e2e/mcp-toolkit.e2e.test.ts'],
        memoryLimit: '6144',
        timeout: 900000,
        priority: 12,
      },

      // 第十三批：验收测试（中压力）
      {
        name: 'acceptance',
        files: [
          'tests/acceptance/quickstart-acceptance.test.ts',
          'tests/acceptance/orchestrate-manual-path.contract.test.ts',
        ],
        memoryLimit: '3072',
        timeout: 600000,
        priority: 13,
      },

      // 第十四批：剩余集成测试（中压力）
      {
        name: 'remaining-integration',
        files: [
          'tests/integration/basic-features.test.ts',
          'tests/integration/new-features.test.ts',
          'tests/integration/conversationHandlers.test.ts',
          'tests/integration/error-handling.test.ts',
          'tests/integration/version-detection.test.ts',
          'tests/integration/mcp-compatibility.test.ts',
          'tests/integration/authHandlers.test.ts',
        ],
        memoryLimit: '4096',
        timeout: 600000,
        priority: 14,
      },

      // 第十五批：复杂集成测试（高压力）
      {
        name: 'complex-integration',
        files: [
          'tests/integration/mvp1-single-process.test.ts',
          'tests/integration/approval-flow.test.ts',
          'tests/integration/config-validation.test.ts',
        ],
        memoryLimit: '5120',
        timeout: 700000,
        priority: 15,
      },

      // 第十六批：剩余契约测试（低压力）
      {
        name: 'remaining-contracts',
        files: [
          'tests/contract/execCommandApproval.contract.test.ts',
          'tests/contract/resumeConversation.contract.test.ts',
          'tests/contract/gitDiffToRemote.contract.test.ts',
          'tests/contract/setDefaultModel.contract.test.ts',
          'tests/contract/interruptConversation.contract.test.ts',
          'tests/contract/archiveConversation.contract.test.ts',
          'tests/contract/getUserAgent.contract.test.ts',
        ],
        memoryLimit: '2048',
        timeout: 300000,
        priority: 16,
      },
    ];
  }

  private async runBatch(batch: TestBatch): Promise<TestResult> {
    const startTime = Date.now();
    console.log(`\n🚀 开始执行批次: ${batch.name}`);
    console.log(`📁 测试文件: ${batch.files.length}个`);
    console.log(`💾 内存限制: ${batch.memoryLimit}MB`);
    console.log(`⏱️  超时时间: ${batch.timeout / 1000}秒`);

    try {
      // 构建测试命令
      const testFiles = batch.files.map((f) => `"${f}"`).join(' ');
      const nodeOptions = `--max-old-space-size=${batch.memoryLimit}`;

      const command = `NODE_OPTIONS="${nodeOptions}" npx vitest run ${testFiles} --reporter=json --reporter=verbose --no-coverage`;

      console.log(`🔧 执行命令: ${command}`);

      // 执行测试
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: ['inherit', 'pipe', 'pipe'],
        timeout: batch.timeout,
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      });

      const duration = Date.now() - startTime;

      // 解析结果
      const result = this.parseVitestOutput(output, batch, duration);

      console.log(`✅ 批次 ${batch.name} 完成`);
      console.log(
        `📊 结果: ${result.passed}/${result.total} 通过，耗时 ${Math.round(duration / 1000)}秒`
      );

      return result;
    } catch (error: any) {
      const duration = Date.now() - startTime;

      console.log(`❌ 批次 ${batch.name} 失败`);
      console.log(`⚠️  错误: ${error.message}`);

      return {
        batch: batch.name,
        success: false,
        duration,
        passed: 0,
        failed: 1,
        total: 1,
        error: error.message,
      };
    }
  }

  private parseVitestOutput(output: string, batch: TestBatch, duration: number): TestResult {
    try {
      // 尝试解析JSON输出
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonData = JSON.parse(jsonMatch[0]);

        const testResults = jsonData.testResults || [];
        let passed = 0;
        let failed = 0;
        let total = 0;

        testResults.forEach((result: any) => {
          if (result.status === 'passed') passed++;
          else if (result.status === 'failed') failed++;
          total++;
        });

        return {
          batch: batch.name,
          success: failed === 0,
          duration,
          passed,
          failed,
          total,
        };
      }
    } catch (e) {
      // JSON解析失败，使用正则表达式解析
      const passes = (output.match(/✓/g) || []).length;
      const fails = (output.match(/×/g) || []).length;

      return {
        batch: batch.name,
        success: fails === 0,
        duration,
        passed: passes,
        failed: fails,
        total: passes + fails,
      };
    }

    // 默认返回
    return {
      batch: batch.name,
      success: false,
      duration,
      passed: 0,
      failed: 1,
      total: 1,
      error: 'Unable to parse test output',
    };
  }

  private async runBatchesInPriority(): Promise<void> {
    const batches = this.getTestBatches();
    const totalBatches = batches.length;

    console.log(`📋 测试计划: ${totalBatches}个批次`);
    console.log(
      `⏰ 预计总耗时: ${Math.round(batches.reduce((sum, b) => sum + b.timeout, 0) / 60000)}分钟`
    );

    // 按优先级顺序执行
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      console.log(`\n📍 进度: ${i + 1}/${totalBatches}`);

      const result = await this.runBatch(batch);
      this.results.push(result);

      // 保存中间结果
      this.saveResults();

      // 内存清理
      if (global.gc) {
        global.gc();
      }
    }
  }

  private saveResults(): void {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: this.generateSummary(),
      results: this.results,
    };

    writeFileSync(this.reportFile, JSON.stringify(reportData, null, 2));
  }

  private generateSummary() {
    const totalPassed = this.results.reduce((sum, r) => sum + (r.passed || 0), 0);
    const totalFailed = this.results.reduce((sum, r) => sum + (r.failed || 0), 0);
    const totalTests = totalPassed + totalFailed;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0';

    return {
      totalTests,
      totalPassed,
      totalFailed,
      successRate: `${successRate}%`,
      totalDuration: `${Math.round(totalDuration / 1000)}s`,
      batchesRun: this.results.length,
      batchesPassed: this.results.filter((r) => r.success).length,
      batchesFailed: this.results.filter((r) => !r.success).length,
    };
  }

  private printFinalReport(): void {
    const summary = this.generateSummary();

    console.log('\n' + '='.repeat(80));
    console.log('📊 测试执行完成 - 分批测试报告');
    console.log('='.repeat(80));

    console.log(`\n📈 总体统计:`);
    console.log(`   测试总数: ${summary.totalTests}`);
    console.log(`   通过数量: ${summary.totalPassed}`);
    console.log(`   失败数量: ${summary.totalFailed}`);
    console.log(`   成功率: ${summary.successRate}`);
    console.log(`   总耗时: ${summary.totalDuration}`);
    console.log(`   批次数: ${summary.batchesRun}`);
    console.log(`   成功批次: ${summary.batchesPassed}`);
    console.log(`   失败批次: ${summary.batchesFailed}`);

    console.log(`\n📋 批次详情:`);
    this.results.forEach((result) => {
      const status = result.success ? '✅' : '❌';
      const successRate =
        result.total > 0 ? `${Math.round((result.passed / result.total) * 100)}%` : '0%';
      console.log(
        `   ${status} ${result.batch}: ${result.passed}/${result.total} (${successRate}) - ${Math.round(result.duration / 1000)}s`
      );
      if (result.error) {
        console.log(`      错误: ${result.error.substring(0, 100)}...`);
      }
    });

    console.log(`\n📄 详细报告已保存至: ${this.reportFile}`);
  }

  public async run(): Promise<void> {
    console.log('🎯 启动分批测试执行器');
    console.log(`💾 系统内存: ${Math.round(require('os').totalmem() / 1024 / 1024)}MB`);

    try {
      await this.runBatchesInPriority();
      this.printFinalReport();
    } catch (error) {
      console.error('💥 分批测试执行失败:', error);
      process.exit(1);
    }
  }
}

// 主执行入口
// ES module 检查
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new BatchTestRunner();
  runner.run().catch(console.error);
}
