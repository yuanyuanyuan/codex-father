#!/usr/bin/env tsx

/**
 * 拆分后的单元测试执行器
 * 解决内存溢出问题的细粒度测试批次
 */

import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

interface TestBatch {
  name: string;
  files: string[];
  memoryLimit: string;
  timeout: string;
  description: string;
}

// 细粒度测试批次划分 - 基于内存使用和功能复杂度
const testBatches: TestBatch[] = [
  // 批次1: 轻量级映射测试 (内存需求最低)
  {
    name: 'mapping-basics',
    files: [
      'tests/unit/parameterMapping.test.ts',
      'tests/unit/modelWireApiMapping.test.ts'
    ],
    memoryLimit: '256',
    timeout: '120',
    description: '参数映射和模型映射基础测试'
  },

  // 批次2: 配置管理测试 (轻量级)
  {
    name: 'config-management',
    files: [
      'tests/unit/profileManager.test.ts',
      'tests/unit/configValidator.test.ts'
    ],
    memoryLimit: '384',
    timeout: '180',
    description: '配置文件管理和验证器测试'
  },

  // 批次3: SDK和版本命令 (轻量级)
  {
    name: 'sdk-integration',
    files: [
      'tests/unit/bulk-sdk.test.ts',
      'tests/unit/version-command.test.ts',
      'tests/unit/mcp-tools-spec-version.test.ts'
    ],
    memoryLimit: '384',
    timeout: '180',
    description: 'SDK集成和版本命令测试'
  },

  // 批次4: 版本检测器 (中等复杂度，需要mock)
  {
    name: 'version-detector',
    files: [
      'tests/unit/versionDetector.test.ts'
    ],
    memoryLimit: '512',
    timeout: '240',
    description: '版本检测器功能测试'
  },

  // 批次5: 错误格式化器 (中等复杂度)
  {
    name: 'error-formatter',
    files: [
      'tests/unit/errorFormatter.test.ts'
    ],
    memoryLimit: '512',
    timeout: '180',
    description: '错误处理和格式化测试'
  },

  // 批次6: 降级策略 (复杂逻辑)
  {
    name: 'degradation-strategy',
    files: [
      'tests/unit/degradationStrategy.test.ts'
    ],
    memoryLimit: '512',
    timeout: '240',
    description: '三层降级策略测试'
  },

  // 批次7: Schema验证 (文件I/O密集)
  {
    name: 'schema-validation',
    files: [
      'tests/unit/configSchema.test.ts'
    ],
    memoryLimit: '640',
    timeout: '300',
    description: '配置Schema验证测试'
  }
];

function ensureTestResultsDir() {
  const resultsDir = path.join(process.cwd(), 'test-results');
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true });
  }
  return resultsDir;
}

function executeTestBatch(batch: TestBatch): { success: boolean; duration: number; output: string } {
  console.log(`\n🚀 开始执行批次: ${batch.name}`);
  console.log(`📝 描述: ${batch.description}`);
  console.log(`📁 测试文件: ${batch.files.length}个`);
  console.log(`💾 内存限制: ${batch.memoryLimit}MB`);
  console.log(`⏱️  超时时间: ${batch.timeout}秒`);

  const startTime = Date.now();

  try {
    const nodeOptions = `--max-old-space-size=${batch.memoryLimit}`;
    const testFiles = batch.files.map(f => `"${f}"`).join(' ');
    const command = `NODE_OPTIONS="${nodeOptions}" npx vitest run ${testFiles} --reporter=json --reporter=verbose --no-coverage`;

    console.log(`🔧 执行命令: ${command}`);

    const output = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: parseInt(batch.timeout) * 1000
    });

    const duration = Date.now() - startTime;
    console.log(`✅ 批次 ${batch.name} 完成`);
    console.log(`📊 结果: 耗时 ${Math.round(duration / 1000)}秒`);

    return {
      success: true,
      duration,
      output
    };

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.log(`❌ 批次 ${batch.name} 失败`);
    console.log(`⚠️  错误: ${error.message}`);

    return {
      success: false,
      duration,
      output: error.stdout || error.stderr || error.message
    };
  }
}

function generateReport(results: Array<{ batch: TestBatch; result: any }>) {
  const resultsDir = ensureTestResultsDir();
  const reportPath = path.join(resultsDir, 'split-unit-test-report.json');

  const summary = {
    executionTime: new Date().toISOString(),
    totalBatches: testBatches.length,
    successfulBatches: results.filter(r => r.result.success).length,
    failedBatches: results.filter(r => !r.result.success).length,
    totalDuration: results.reduce((sum, r) => sum + r.result.duration, 0),
    averageMemoryUsage: testBatches.reduce((sum, b) => sum + parseInt(b.memoryLimit), 0) / testBatches.length,
    results: results.map(r => ({
      batchName: r.batch.name,
      description: r.batch.description,
      files: r.batch.files,
      memoryLimit: r.batch.memoryLimit,
      success: r.result.success,
      duration: r.result.duration,
      output: r.result.output
    }))
  };

  const reportContent = JSON.stringify(summary, null, 2);
  writeFileSync(reportPath, reportContent);

  console.log(`\n📊 测试报告已生成: ${reportPath}`);
  console.log(`\n📈 执行总结:`);
  console.log(`   总批次: ${summary.totalBatches}`);
  console.log(`   成功: ${summary.successfulBatches} ✅`);
  console.log(`   失败: ${summary.failedBatches} ❌`);
  console.log(`   总耗时: ${Math.round(summary.totalDuration / 1000)}秒`);
  console.log(`   平均内存: ${Math.round(summary.averageMemoryUsage)}MB`);

  return summary;
}

function main() {
  console.log('🎯 启动拆分单元测试执行器');
  console.log(`💾 系统内存: ${Math.round(os.totalmem() / 1024 / 1024)}MB`);
  console.log(`📋 测试计划: ${testBatches.length}个细粒度批次`);
  console.log(`⏰ 预计总耗时: ${testBatches.reduce((sum, b) => sum + parseInt(b.timeout), 0)}秒`);

  const results: Array<{ batch: TestBatch; result: any }> = [];

  for (let i = 0; i < testBatches.length; i++) {
    const batch = testBatches[i];
    console.log(`\n📍 进度: ${i + 1}/${testBatches.length}`);

    const result = executeTestBatch(batch);
    results.push({ batch, result });

    // 如果批次失败，继续执行其他批次
    if (!result.success) {
      console.log(`⚠️  批次失败，继续执行下一个批次...`);
    }

    // 短暂暂停，让系统回收内存
    if (i < testBatches.length - 1) {
      console.log(`💤 内存回收中...`);
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
    }
  }

  const summary = generateReport(results);

  // 根据结果设置退出码
  const exitCode = summary.failedBatches > 0 ? 1 : 0;
  process.exit(exitCode);
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 启动执行
main();