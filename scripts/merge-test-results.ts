#!/usr/bin/env node

/**
 * 测试结果合并器
 * 合并分批执行的测试结果和覆盖率报告
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

type MergedResult = {
  timestamp: string;
  summary: {
    totalBatches: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    successRate: string;
    totalDuration: number;
  };
  batchResults: any[];
  coverage?: any;
};

class TestResultMerger {
  private resultsDir = './test-results';
  private coverageDir = './coverage';
  private mergedReportFile = './test-results/merged-test-report.json';

  constructor() {
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [this.resultsDir, this.coverageDir].forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  private loadBatchResults(): any[] {
    try {
      const reportFile = join(this.resultsDir, 'batch-test-report.json');
      if (existsSync(reportFile)) {
        const data = readFileSync(reportFile, 'utf8');
        const report = JSON.parse(data);
        return report.results || [];
      }
    } catch (error: any) {
      console.warn('⚠️  无法加载批次测试结果:', error.message);
    }
    return [];
  }

  private mergeCoverageReports(): any {
    try {
      console.log('🔗 合并覆盖率报告...');

      // 检查是否有覆盖率数据
      const coverageFiles = this.findCoverageFiles();
      if (coverageFiles.length === 0) {
        console.log('ℹ️  没有找到覆盖率数据');
        return null;
      }

      // 合并覆盖率报告
      const mergeCommand = 'npx nyc merge coverage coverage/merged.json';
      execSync(mergeCommand, { stdio: 'inherit' });

      // 生成HTML报告
      const reportCommand = 'npx nyc report --reporter=html --reporter=text-summary';
      execSync(reportCommand, { stdio: 'inherit' });

      console.log('✅ 覆盖率报告合并完成');

      // 读取合并后的覆盖率摘要
      try {
        const summaryFile = join(this.coverageDir, 'coverage-summary.json');
        if (existsSync(summaryFile)) {
          return JSON.parse(readFileSync(summaryFile, 'utf8'));
        }
      } catch (e) {
        console.warn('⚠️  无法读取覆盖率摘要');
      }
    } catch (error: any) {
      console.warn('⚠️  覆盖率合并失败:', error.message);
    }

    return null;
  }

  private findCoverageFiles(): string[] {
    const coverageDir = this.coverageDir;
    if (!existsSync(coverageDir)) {
      return [];
    }

    const files = readdirSync(coverageDir, { withFileTypes: true })
      .filter((dirent) => dirent.isFile())
      .filter((dirent) => dirent.name.endsWith('.json'))
      .map((dirent) => join(coverageDir, dirent.name));

    return files;
  }

  private generateMergedReport(): MergedResult {
    const batchResults = this.loadBatchResults();

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalDuration = 0;

    batchResults.forEach((result) => {
      totalTests += result.total || 0;
      totalPassed += result.passed || 0;
      totalFailed += result.failed || 0;
      totalDuration += result.duration || 0;
    });

    const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0';

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalBatches: batchResults.length,
        totalTests,
        totalPassed,
        totalFailed,
        successRate: `${successRate}%`,
        totalDuration,
      },
      batchResults,
      coverage: this.mergeCoverageReports(),
    };
  }

  private printMergedReport(): void {
    const report = this.generateMergedReport();

    console.log('\n' + '='.repeat(80));
    console.log('📊 合并测试报告');
    console.log('='.repeat(80));

    console.log(`\n📈 总体统计:`);
    console.log(`   执行批次: ${report.summary.totalBatches}`);
    console.log(`   测试总数: ${report.summary.totalTests}`);
    console.log(`   通过数量: ${report.summary.totalPassed}`);
    console.log(`   失败数量: ${report.summary.totalFailed}`);
    console.log(`   成功率: ${report.summary.successRate}`);
    console.log(`   总耗时: ${Math.round(report.summary.totalDuration / 1000)}秒`);

    if (report.coverage) {
      console.log(`\n📋 覆盖率统计:`);
      const { lines, functions, branches, statements } = report.coverage.total;
      console.log(`   行覆盖率: ${lines.pct}%`);
      console.log(`   函数覆盖率: ${functions.pct}%`);
      console.log(`   分支覆盖率: ${branches.pct}%`);
      console.log(`   语句覆盖率: ${statements.pct}%`);
    }

    console.log(`\n📊 批次详情:`);
    const sortedResults = report.batchResults.sort((a, b) => a.batch.localeCompare(b.batch));

    sortedResults.forEach((result) => {
      const status = result.success ? '✅' : '❌';
      const successRate =
        result.total > 0 ? `${Math.round((result.passed / result.total) * 100)}%` : '0%';
      const duration = Math.round(result.duration / 1000);
      console.log(
        `   ${status} ${result.batch.padEnd(20)} ${result.passed.toString().padStart(3)}/${result.total.toString().padEnd(3)} ${successRate.padStart(5)} ${duration}s`
      );
      if (result.error && !result.success) {
        console.log(`      └─ 错误: ${result.error.substring(0, 80)}...`);
      }
    });

    // 失败批次详情
    const failedBatches = report.batchResults.filter((r) => !r.success);
    if (failedBatches.length > 0) {
      console.log(`\n❌ 失败批次详情:`);
      failedBatches.forEach((result) => {
        console.log(`   ${result.batch}:`);
        console.log(`      失败原因: ${result.error || '未知错误'}`);
        console.log(`      失败测试数: ${result.failed}/${result.total}`);
      });
    }

    console.log(`\n📄 报告文件:`);
    console.log(`   合并报告: ${this.mergedReportFile}`);
    console.log(`   覆盖率报告: ${this.coverageDir}/lcov-report/index.html`);
  }

  private saveMergedReport(): void {
    const report = this.generateMergedReport();
    writeFileSync(this.mergedReportFile, JSON.stringify(report, null, 2));
    console.log(`\n💾 合并报告已保存至: ${this.mergedReportFile}`);
  }

  public run(): void {
    console.log('🔗 测试结果合并器启动');

    try {
      this.printMergedReport();
      this.saveMergedReport();

      console.log('\n✅ 测试结果合并完成！');
    } catch (error) {
      console.error('💥 合并过程中出现错误:', error);
      process.exit(1);
    }
  }
}

// 主执行入口
if (require.main === module) {
  const merger = new TestResultMerger();
  merger.run();
}
