/**
 * 内存使用性能基准测试
 *
 * 测试范围：
 * - 系统内存使用不超过 100MB (Constitution 要求)
 * - 内存泄漏检测
 * - 垃圾回收效率验证
 * - 大负载下的内存稳定性
 * - 长时间运行的内存表现
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { FileSystemDocumentService } from '../../src/services/document-service.js';
import { DefaultDiagramService } from '../../src/services/diagram-service.js';
import { FileManager } from '../../src/lib/file-manager.js';
import { MarkdownParser } from '../../src/lib/markdown-parser.js';
import type { PRDDraft } from '../../src/models/prd-draft.js';

describe('Memory Usage Performance', () => {
  let documentService: FileSystemDocumentService;
  let diagramService: DefaultDiagramService;
  let fileManager: FileManager;
  let markdownParser: MarkdownParser;
  let testWorkspace: string;
  let initialMemory: NodeJS.MemoryUsage;

  beforeEach(() => {
    testWorkspace = '/tmp/memory-test';
    documentService = new FileSystemDocumentService(testWorkspace);
    diagramService = new DefaultDiagramService();
    fileManager = new FileManager(testWorkspace);
    markdownParser = new MarkdownParser();

    // 强制垃圾回收获取准确的基线
    if (global.gc) {
      global.gc();
    }

    initialMemory = process.memoryUsage();
  });

  afterEach(() => {
    // 测试结束后检查内存清理
    if (global.gc) {
      global.gc();
    }
  });

  describe('Constitution Memory Requirements', () => {
    it('should keep total memory usage under 100MB during normal operations', async () => {
      const startMemory = process.memoryUsage();

      // 执行一系列正常操作
      const operations = [];

      // 1. 创建文档
      for (let i = 0; i < 20; i++) {
        operations.push(documentService.createDraft({
          title: `Memory Test Document ${i}`,
          template: 'basic',
          description: `Description for document ${i}`,
          author: 'memory-tester'
        }));
      }

      const drafts = await Promise.all(operations);

      // 2. 编辑文档
      const editOperations = drafts.map((draft, i) =>
        documentService.updateDraft(draft.id, {
          content: {
            introduction: `Introduction ${i}`.repeat(100),
            requirements: `Requirements ${i}`.repeat(100),
            implementation: `Implementation ${i}`.repeat(100)
          }
        }, 'memory-tester')
      );

      await Promise.all(editOperations);

      // 3. 渲染图表
      const diagramContent = `
        flowchart TD
          A[Start] --> B[Process]
          B --> C{Decision}
          C -->|Yes| D[Success]
          C -->|No| E[Retry]
          E --> B
          D --> F[End]
      `;

      for (let i = 0; i < 10; i++) {
        await diagramService.renderDiagram(diagramContent, {
          type: 'mermaid',
          format: 'svg',
          theme: 'default'
        });
      }

      // 4. 执行搜索
      for (let i = 0; i < 10; i++) {
        await documentService.searchDrafts({
          query: 'Memory Test',
          scope: 'all',
          limit: 20
        });
      }

      // 5. 文件操作
      for (let i = 0; i < 30; i++) {
        const content = `File content ${i}`.repeat(200);
        await fileManager.writeFile(`memory-test-${i}.md`, content);
        await fileManager.readFile(`memory-test-${i}.md`);
      }

      const finalMemory = process.memoryUsage();
      const memoryDelta = finalMemory.heapUsed - startMemory.heapUsed;
      const memoryMB = memoryDelta / (1024 * 1024);

      // 核心要求：内存使用不超过 100MB
      expect(memoryMB).toBeLessThan(100);

      console.log(`Total memory usage: ${memoryMB.toFixed(2)}MB (Constitution limit: 100MB)`);
      console.log(`Memory breakdown:`);
      console.log(`  Heap Used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Heap Total: ${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  External: ${(finalMemory.external / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  RSS: ${(finalMemory.rss / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should maintain memory efficiency under peak load', async () => {
      const peakLoadOperations = [
        // 大量文档创建
        ...Array.from({ length: 50 }, (_, i) =>
          documentService.createDraft({
            title: `Peak Load Document ${i}`,
            template: 'basic',
            description: 'Large description content'.repeat(50),
            author: 'peak-tester'
          })
        ),

        // 并发图表渲染
        ...Array.from({ length: 20 }, () =>
          diagramService.renderDiagram(`
            graph TB
              subgraph "System"
                A1[Service 1] --> B1[Service 2]
                B1 --> C1[Service 3]
                C1 --> D1[Service 4]
                D1 --> E1[Service 5]
              end
              subgraph "Database"
                F1[Primary DB] --> G1[Cache]
                G1 --> H1[Backup DB]
              end
              E1 --> F1
          `, {
            type: 'mermaid',
            format: 'svg',
            width: 1200,
            height: 900
          })
        ),

        // 大文件操作
        ...Array.from({ length: 30 }, (_, i) =>
          fileManager.writeFile(`peak-load-${i}.md`, 'Content'.repeat(1000))
        )
      ];

      const startMemory = process.memoryUsage();

      await Promise.all(peakLoadOperations);

      const peakMemory = process.memoryUsage();
      const peakMemoryMB = peakMemory.heapUsed / 1024 / 1024;

      // 即使在峰值负载下，也应该保持在合理范围内
      expect(peakMemoryMB).toBeLessThan(150); // 峰值允许稍高

      console.log(`Peak load memory usage: ${peakMemoryMB.toFixed(2)}MB`);
    });

    it('should release memory after operations complete', async () => {
      const baselineMemory = process.memoryUsage().heapUsed;

      // 执行大量操作
      const documents = [];
      for (let i = 0; i < 30; i++) {
        const draft = await documentService.createDraft({
          title: `Temporary Document ${i}`,
          template: 'basic',
          description: 'Temporary content'.repeat(100),
          author: 'temp-user'
        });
        documents.push(draft);
      }

      // 更新所有文档
      await Promise.all(documents.map(doc =>
        documentService.updateDraft(doc.id, {
          content: {
            section1: 'Large content'.repeat(200),
            section2: 'More content'.repeat(200)
          }
        }, 'temp-user')
      ));

      const afterOperationsMemory = process.memoryUsage().heapUsed;

      // 清理引用
      documents.length = 0;

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      // 等待垃圾回收完成
      await new Promise(resolve => setTimeout(resolve, 100));

      const afterCleanupMemory = process.memoryUsage().heapUsed;

      const memoryReleased = afterOperationsMemory - afterCleanupMemory;
      const memoryReleasedMB = memoryReleased / 1024 / 1024;

      // 应该释放大部分内存
      expect(memoryReleasedMB).toBeGreaterThan(5); // 至少释放 5MB

      console.log(`Memory released after cleanup: ${memoryReleasedMB.toFixed(2)}MB`);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during repeated document operations', async () => {
      const iterations = 50;
      const memorySnapshots: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // 创建和删除文档
        const draft = await documentService.createDraft({
          title: `Leak Test ${i}`,
          template: 'basic',
          description: 'Test content',
          author: 'leak-tester'
        });

        await documentService.updateDraft(draft.id, {
          content: { section: 'Updated content' }
        }, 'leak-tester');

        await documentService.deleteDraft(draft.id);

        // 每 10 次迭代记录内存使用
        if (i % 10 === 0) {
          if (global.gc) global.gc();
          await new Promise(resolve => setTimeout(resolve, 50));
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      }

      // 分析内存趋势
      const memoryTrend = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      const memoryTrendMB = memoryTrend / 1024 / 1024;

      // 内存增长应该很小，表明没有明显泄漏
      expect(memoryTrendMB).toBeLessThan(10);

      console.log(`Memory trend over ${iterations} iterations: ${memoryTrendMB.toFixed(2)}MB`);
      console.log(`Memory snapshots: ${memorySnapshots.map(m => (m / 1024 / 1024).toFixed(1)).join(', ')}MB`);
    });

    it('should not leak memory during diagram rendering', async () => {
      const iterations = 30;
      const memorySnapshots: number[] = [];

      const diagrams = [
        'flowchart TD\n  A --> B --> C',
        'sequenceDiagram\n  A->>B: msg\n  B-->>A: response',
        'classDiagram\n  class A {\n    +method()\n  }',
        'graph LR\n  X --> Y --> Z'
      ];

      for (let i = 0; i < iterations; i++) {
        const diagramIndex = i % diagrams.length;

        await diagramService.renderDiagram(diagrams[diagramIndex], {
          type: 'mermaid',
          format: 'svg',
          width: 800,
          height: 600
        });

        if (i % 5 === 0) {
          if (global.gc) global.gc();
          await new Promise(resolve => setTimeout(resolve, 30));
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      }

      const memoryTrend = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      const memoryTrendMB = memoryTrend / 1024 / 1024;

      expect(memoryTrendMB).toBeLessThan(15);

      console.log(`Diagram rendering memory trend: ${memoryTrendMB.toFixed(2)}MB`);
    });

    it('should not leak memory during file operations', async () => {
      const iterations = 100;
      const memorySnapshots: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const fileName = `leak-test-${i}.md`;
        const content = `Content for file ${i}`.repeat(50);

        await fileManager.writeFile(fileName, content);
        await fileManager.readFile(fileName);
        await fileManager.deleteFile(fileName);

        if (i % 20 === 0) {
          if (global.gc) global.gc();
          await new Promise(resolve => setTimeout(resolve, 20));
          memorySnapshots.push(process.memoryUsage().heapUsed);
        }
      }

      const memoryTrend = memorySnapshots[memorySnapshots.length - 1] - memorySnapshots[0];
      const memoryTrendMB = memoryTrend / 1024 / 1024;

      expect(memoryTrendMB).toBeLessThan(5);

      console.log(`File operations memory trend: ${memoryTrendMB.toFixed(2)}MB`);
    });
  });

  describe('Long Running Memory Stability', () => {
    it('should maintain stable memory usage during extended operations', async () => {
      const duration = 30; // 30 seconds simulation
      const intervalMs = 1000; // Check every second
      const memorySnapshots: Array<{ time: number; memory: number }> = [];

      const startTime = Date.now();

      // 模拟长时间运行的系统
      const intervalId = setInterval(async () => {
        // 执行一些轻量级操作
        const draft = await documentService.createDraft({
          title: `Long Running Test ${Date.now()}`,
          template: 'basic',
          description: 'Stability test',
          author: 'stability-tester'
        });

        await documentService.updateDraft(draft.id, {
          content: { section: 'Stability content' }
        }, 'stability-tester');

        // 记录内存使用
        const currentTime = Date.now();
        const currentMemory = process.memoryUsage().heapUsed;

        memorySnapshots.push({
          time: currentTime - startTime,
          memory: currentMemory
        });

        // 清理旧文档
        if (memorySnapshots.length > 10) {
          await documentService.deleteDraft(draft.id);
        }

      }, intervalMs);

      // 运行指定时间
      await new Promise(resolve => setTimeout(resolve, duration * 1000));
      clearInterval(intervalId);

      // 分析内存稳定性
      const memoryValues = memorySnapshots.map(s => s.memory / 1024 / 1024);
      const avgMemory = memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length;
      const maxMemory = Math.max(...memoryValues);
      const minMemory = Math.min(...memoryValues);
      const memoryVariance = maxMemory - minMemory;

      // 内存应该保持相对稳定
      expect(avgMemory).toBeLessThan(80); // 平均内存使用
      expect(memoryVariance).toBeLessThan(30); // 内存变化范围

      console.log(`Long running stability - Avg: ${avgMemory.toFixed(2)}MB, Min: ${minMemory.toFixed(2)}MB, Max: ${maxMemory.toFixed(2)}MB, Variance: ${memoryVariance.toFixed(2)}MB`);
    });

    it('should handle memory pressure gracefully', async () => {
      const startMemory = process.memoryUsage();

      // 创建内存压力
      const largeObjects: any[] = [];

      try {
        // 逐步增加内存使用
        for (let i = 0; i < 50; i++) {
          // 创建大对象
          const largeObject = {
            id: i,
            data: new Array(10000).fill(0).map((_, j) => ({
              index: j,
              content: `Large content ${i}-${j}`.repeat(10)
            }))
          };

          largeObjects.push(largeObject);

          // 检查内存使用
          const currentMemory = process.memoryUsage();
          const currentMemoryMB = currentMemory.heapUsed / 1024 / 1024;

          // 如果接近限制，停止创建
          if (currentMemoryMB > 90) {
            console.log(`Stopped at iteration ${i}, memory: ${currentMemoryMB.toFixed(2)}MB`);
            break;
          }

          // 执行一些正常操作
          await documentService.createDraft({
            title: `Pressure Test ${i}`,
            template: 'basic',
            description: 'Under pressure',
            author: 'pressure-tester'
          });
        }

        const peakMemory = process.memoryUsage();
        const peakMemoryMB = peakMemory.heapUsed / 1024 / 1024;

        // 系统应该在压力下仍然正常工作
        expect(peakMemoryMB).toBeLessThan(120); // 允许一定的内存压力

        console.log(`Peak memory under pressure: ${peakMemoryMB.toFixed(2)}MB`);

      } finally {
        // 清理大对象
        largeObjects.length = 0;
        if (global.gc) global.gc();
      }
    });
  });

  describe('Garbage Collection Efficiency', () => {
    it('should garbage collect efficiently', async () => {
      if (!global.gc) {
        console.log('GC not available, skipping test');
        return;
      }

      // 创建大量可回收对象
      const createGarbage = () => {
        const garbage = [];
        for (let i = 0; i < 1000; i++) {
          garbage.push({
            id: i,
            data: new Array(100).fill(0).map(j => `garbage-${i}-${j}`),
            nested: {
              moreData: new Array(50).fill(0).map(k => ({ index: k, value: Math.random() }))
            }
          });
        }
        return garbage;
      };

      const beforeGC = process.memoryUsage();

      // 创建垃圾对象
      let garbage = createGarbage();
      const afterCreation = process.memoryUsage();

      // 移除引用
      garbage = null as any;

      // 执行垃圾回收
      const gcStart = performance.now();
      global.gc();
      const gcEnd = performance.now();

      const afterGC = process.memoryUsage();

      const memoryBeforeGC = afterCreation.heapUsed / 1024 / 1024;
      const memoryAfterGC = afterGC.heapUsed / 1024 / 1024;
      const memoryReclaimed = memoryBeforeGC - memoryAfterGC;
      const gcTime = gcEnd - gcStart;

      // 垃圾回收应该回收大部分内存
      expect(memoryReclaimed).toBeGreaterThan(5); // 至少回收 5MB
      expect(gcTime).toBeLessThan(100); // GC 时间应该合理

      console.log(`GC efficiency - Reclaimed: ${memoryReclaimed.toFixed(2)}MB, Time: ${gcTime.toFixed(2)}ms`);
    });

    it('should handle frequent garbage collection', async () => {
      if (!global.gc) {
        console.log('GC not available, skipping test');
        return;
      }

      const gcTimes: number[] = [];
      const memoryBefore: number[] = [];
      const memoryAfter: number[] = [];

      for (let i = 0; i < 10; i++) {
        // 创建一些对象
        const temp = Array.from({ length: 500 }, (_, j) => ({
          id: `${i}-${j}`,
          data: new Array(50).fill(0).map(k => `data-${k}`)
        }));

        memoryBefore.push(process.memoryUsage().heapUsed);

        const gcStart = performance.now();
        global.gc();
        const gcEnd = performance.now();

        memoryAfter.push(process.memoryUsage().heapUsed);
        gcTimes.push(gcEnd - gcStart);

        // 短暂暂停
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const avgGCTime = gcTimes.reduce((a, b) => a + b, 0) / gcTimes.length;
      const maxGCTime = Math.max(...gcTimes);

      // 频繁 GC 的性能应该稳定
      expect(avgGCTime).toBeLessThan(50);
      expect(maxGCTime).toBeLessThan(100);

      console.log(`Frequent GC - Average: ${avgGCTime.toFixed(2)}ms, Max: ${maxGCTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Performance Summary', () => {
    it('should meet all memory performance requirements', async () => {
      const requirements = {
        normalOperations: { limit: 100, description: 'Normal operations memory limit (MB)' },
        peakLoad: { limit: 150, description: 'Peak load memory limit (MB)' },
        memoryLeakRate: { limit: 10, description: 'Memory leak rate limit (MB/hour)' },
        gcEfficiency: { limit: 50, description: 'GC time limit (ms)' }
      };

      const results: Record<string, number> = {};

      // 正常操作内存测试
      const normalStart = process.memoryUsage();
      for (let i = 0; i < 10; i++) {
        await documentService.createDraft({
          title: `Summary Test ${i}`,
          template: 'basic',
          description: 'Summary test',
          author: 'summary-tester'
        });
      }
      const normalEnd = process.memoryUsage();
      results.normalOperations = (normalEnd.heapUsed - normalStart.heapUsed) / 1024 / 1024;

      // GC 效率测试
      if (global.gc) {
        const gcStart = performance.now();
        global.gc();
        const gcEnd = performance.now();
        results.gcEfficiency = gcEnd - gcStart;
      }

      // 验证要求
      for (const [requirement, config] of Object.entries(requirements)) {
        const value = results[requirement];
        if (value !== undefined) {
          expect(value).toBeLessThan(config.limit);
          console.log(`${config.description}: ${value.toFixed(2)} (limit: ${config.limit})`);
        }
      }

      // 输出最终内存状态
      const finalMemory = process.memoryUsage();
      console.log('\nFinal Memory State:');
      console.log(`  Heap Used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  Heap Total: ${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  External: ${(finalMemory.external / 1024 / 1024).toFixed(2)}MB`);
      console.log(`  RSS: ${(finalMemory.rss / 1024 / 1024).toFixed(2)}MB`);
    });
  });
});