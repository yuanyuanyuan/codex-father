/**
 * 文档操作性能基准测试
 *
 * 测试范围：
 * - 文档加载性能 (< 100ms)
 * - 文档编辑性能 (< 50ms)
 * - 大文档处理性能
 * - 并发操作性能
 * - 内存使用监控
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { FileSystemDocumentService } from '../../src/services/document-service.js';
import type { PRDDraft, CreateDraftRequest } from '../../src/models/prd-draft.js';

describe('Document Operations Performance', () => {
  let documentService: FileSystemDocumentService;
  let testWorkspace: string;
  let memoryBaseline: number;

  beforeEach(() => {
    testWorkspace = '/tmp/perf-test';
    documentService = new FileSystemDocumentService(testWorkspace);
    memoryBaseline = process.memoryUsage().heapUsed;
  });

  afterEach(() => {
    // 检查内存增长
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryDelta = memoryAfter - memoryBaseline;

    // 内存增长不应超过 10MB
    expect(memoryDelta).toBeLessThan(10 * 1024 * 1024);
  });

  describe('Document Loading Performance', () => {
    it('should load small documents under 100ms', async () => {
      // 创建小文档
      const createRequest: CreateDraftRequest = {
        title: 'Small Test Document',
        template: 'basic',
        description: 'A small test document',
        author: 'test-user'
      };

      const draft = await documentService.createDraft(createRequest);

      // 测试加载性能
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const loadedDraft = await documentService.getDraft(draft.id);
        const end = performance.now();

        expect(loadedDraft).toBeDefined();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // 平均加载时间应该小于 100ms
      expect(averageTime).toBeLessThan(100);

      // 最大加载时间应该小于 200ms（允许偶尔的性能波动）
      expect(maxTime).toBeLessThan(200);

      console.log(`Small document loading - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });

    it('should load medium documents under 150ms', async () => {
      // 创建中等大小文档（约 50KB）
      const largeContent = 'A'.repeat(10000); // 10KB content
      const createRequest: CreateDraftRequest = {
        title: 'Medium Test Document',
        template: 'basic',
        description: 'A medium-sized test document',
        author: 'test-user'
      };

      const draft = await documentService.createDraft(createRequest);

      // 添加大量内容
      await documentService.updateDraft(draft.id, {
        content: {
          introduction: largeContent,
          requirements: largeContent,
          architecture: largeContent,
          implementation: largeContent,
          testing: largeContent
        }
      }, 'test-user');

      // 测试加载性能
      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const loadedDraft = await documentService.getDraft(draft.id);
        const end = performance.now();

        expect(loadedDraft).toBeDefined();
        expect(loadedDraft?.content).toBeDefined();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // 中等文档平均加载时间应该小于 150ms
      expect(averageTime).toBeLessThan(150);
      expect(maxTime).toBeLessThan(300);

      console.log(`Medium document loading - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });

    it('should handle large document lists efficiently', async () => {
      // 创建大量文档
      const drafts: PRDDraft[] = [];
      const createPromises: Promise<PRDDraft>[] = [];

      for (let i = 0; i < 100; i++) {
        const createRequest: CreateDraftRequest = {
          title: `Batch Document ${i}`,
          template: 'basic',
          description: `Test document ${i}`,
          author: 'test-user'
        };
        createPromises.push(documentService.createDraft(createRequest));
      }

      const createdDrafts = await Promise.all(createPromises);
      drafts.push(...createdDrafts);

      // 测试列表加载性能
      const start = performance.now();
      const draftList = await documentService.listDrafts({
        limit: 100,
        sort: 'updated',
        order: 'desc'
      });
      const end = performance.now();

      const loadTime = end - start;

      expect(draftList).toHaveLength(100);
      expect(loadTime).toBeLessThan(200); // 列表加载应该在 200ms 内

      console.log(`Large document list loading - Time: ${loadTime.toFixed(2)}ms`);
    });
  });

  describe('Document Editing Performance', () => {
    let testDraft: PRDDraft;

    beforeEach(async () => {
      const createRequest: CreateDraftRequest = {
        title: 'Edit Performance Test',
        template: 'basic',
        description: 'Document for edit performance testing',
        author: 'test-user'
      };
      testDraft = await documentService.createDraft(createRequest);
    });

    it('should edit small content under 50ms', async () => {
      const times: number[] = [];

      for (let i = 0; i < 20; i++) {
        const updateData = {
          content: {
            introduction: `Updated content iteration ${i}`,
            requirements: `Requirements updated at ${Date.now()}`
          }
        };

        const start = performance.now();
        const updatedDraft = await documentService.updateDraft(
          testDraft.id,
          updateData,
          'test-user'
        );
        const end = performance.now();

        expect(updatedDraft).toBeDefined();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // 小内容编辑平均时间应该小于 50ms
      expect(averageTime).toBeLessThan(50);
      expect(maxTime).toBeLessThan(100);

      console.log(`Small content editing - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });

    it('should edit large content under 100ms', async () => {
      const largeContent = 'B'.repeat(5000); // 5KB content
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const updateData = {
          content: {
            introduction: `${largeContent} - iteration ${i}`,
            requirements: `${largeContent} - requirements ${i}`,
            architecture: `${largeContent} - architecture ${i}`
          }
        };

        const start = performance.now();
        const updatedDraft = await documentService.updateDraft(
          testDraft.id,
          updateData,
          'test-user'
        );
        const end = performance.now();

        expect(updatedDraft).toBeDefined();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // 大内容编辑平均时间应该小于 100ms
      expect(averageTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(200);

      console.log(`Large content editing - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });

    it('should handle concurrent edits efficiently', async () => {
      const concurrentEdits = 10;
      const promises: Promise<any>[] = [];

      const start = performance.now();

      for (let i = 0; i < concurrentEdits; i++) {
        const updateData = {
          content: {
            [`section_${i}`]: `Concurrent edit ${i} at ${Date.now()}`
          }
        };

        promises.push(documentService.updateDraft(
          testDraft.id,
          updateData,
          `user_${i}`
        ));
      }

      const results = await Promise.all(promises);
      const end = performance.now();

      const totalTime = end - start;
      const averageTime = totalTime / concurrentEdits;

      expect(results).toHaveLength(concurrentEdits);
      expect(averageTime).toBeLessThan(75); // 并发编辑平均时间应该小于 75ms

      console.log(`Concurrent editing - Total: ${totalTime.toFixed(2)}ms, Average: ${averageTime.toFixed(2)}ms`);
    });
  });

  describe('Search Performance', () => {
    beforeEach(async () => {
      // 创建用于搜索的测试数据
      const searchData = [
        { title: 'Authentication System Design', content: 'JWT tokens and OAuth2 implementation' },
        { title: 'Database Architecture', content: 'PostgreSQL with Redis caching layer' },
        { title: 'API Gateway Configuration', content: 'Rate limiting and request routing' },
        { title: 'Frontend Performance', content: 'React optimization and lazy loading' },
        { title: 'Security Guidelines', content: 'XSS protection and input validation' }
      ];

      const createPromises = searchData.map(data =>
        documentService.createDraft({
          title: data.title,
          template: 'basic',
          description: data.content,
          author: 'test-user'
        })
      );

      await Promise.all(createPromises);
    });

    it('should perform text search under 100ms', async () => {
      const searchQueries = ['authentication', 'database', 'performance', 'security'];
      const times: number[] = [];

      for (const query of searchQueries) {
        const start = performance.now();
        const results = await documentService.searchDrafts({
          query,
          scope: 'all',
          limit: 10
        });
        const end = performance.now();

        expect(results).toBeDefined();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // 搜索平均时间应该小于 100ms
      expect(averageTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(200);

      console.log(`Text search - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });

    it('should perform filtered search efficiently', async () => {
      const start = performance.now();

      const results = await documentService.searchDrafts({
        query: 'system',
        scope: 'title',
        author: 'test-user',
        status: 'draft',
        limit: 20
      });

      const end = performance.now();
      const searchTime = end - start;

      expect(results).toBeDefined();
      expect(searchTime).toBeLessThan(150); // 过滤搜索应该在 150ms 内

      console.log(`Filtered search - Time: ${searchTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should maintain memory usage under 100MB during operations', async () => {
      const initialMemory = process.memoryUsage();

      // 执行一系列内存密集操作
      const operations = [];

      for (let i = 0; i < 50; i++) {
        operations.push(documentService.createDraft({
          title: `Memory Test ${i}`,
          template: 'basic',
          description: 'A'.repeat(1000), // 1KB per document
          author: 'test-user'
        }));
      }

      const drafts = await Promise.all(operations);

      // 执行编辑操作
      const editOperations = drafts.map((draft, i) =>
        documentService.updateDraft(draft.id, {
          content: {
            section1: 'B'.repeat(2000), // 2KB per section
            section2: 'C'.repeat(2000),
            section3: 'D'.repeat(2000)
          }
        }, 'test-user')
      );

      await Promise.all(editOperations);

      // 执行搜索操作
      await documentService.searchDrafts({ query: 'Memory', limit: 50 });

      const finalMemory = process.memoryUsage();
      const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryMB = memoryDelta / (1024 * 1024);

      // 内存增长不应超过 100MB
      expect(memoryMB).toBeLessThan(100);

      console.log(`Memory usage increase: ${memoryMB.toFixed(2)}MB`);
    });

    it('should garbage collect efficiently after operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 创建大量临时对象
      for (let i = 0; i < 1000; i++) {
        const tempData = {
          id: `temp_${i}`,
          content: 'X'.repeat(1000),
          metadata: { created: Date.now(), index: i }
        };

        // 模拟一些处理
        JSON.stringify(tempData);
      }

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      // 等待一段时间让垃圾回收完成
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemory - initialMemory;
      const memoryMB = memoryDelta / (1024 * 1024);

      // 垃圾回收后内存增长应该很小
      expect(memoryMB).toBeLessThan(5);

      console.log(`Memory after GC: ${memoryMB.toFixed(2)}MB increase`);
    });
  });

  describe('Stress Testing', () => {
    it('should handle high load gracefully', async () => {
      const concurrentOperations = 20;
      const operationsPerConcurrent = 5;

      const start = performance.now();

      const concurrentPromises = Array.from({ length: concurrentOperations }, async (_, i) => {
        const operations = [];

        for (let j = 0; j < operationsPerConcurrent; j++) {
          // 创建文档
          const createPromise = documentService.createDraft({
            title: `Stress Test ${i}-${j}`,
            template: 'basic',
            description: `Stress test document ${i}-${j}`,
            author: `user_${i}`
          });

          operations.push(createPromise);
        }

        const drafts = await Promise.all(operations);

        // 编辑文档
        const editPromises = drafts.map(draft =>
          documentService.updateDraft(draft.id, {
            content: { section: `Updated by user ${i}` }
          }, `user_${i}`)
        );

        return Promise.all(editPromises);
      });

      const results = await Promise.all(concurrentPromises);
      const end = performance.now();

      const totalTime = end - start;
      const totalOperations = concurrentOperations * operationsPerConcurrent * 2; // create + edit
      const averageTime = totalTime / totalOperations;

      expect(results).toHaveLength(concurrentOperations);
      expect(averageTime).toBeLessThan(100); // 平均操作时间应该小于 100ms

      console.log(`Stress test - Total time: ${totalTime.toFixed(2)}ms, Average per operation: ${averageTime.toFixed(2)}ms`);
    });

    it('should maintain performance under sustained load', async () => {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const batchStart = performance.now();

        // 每批次执行多个操作
        const batchOperations = [];

        for (let j = 0; j < 10; j++) {
          batchOperations.push(
            documentService.createDraft({
              title: `Sustained Load ${i}-${j}`,
              template: 'basic',
              description: `Batch ${i}, Document ${j}`,
              author: 'load-tester'
            })
          );
        }

        await Promise.all(batchOperations);

        const batchEnd = performance.now();
        times.push(batchEnd - batchStart);

        // 短暂暂停避免过度压力
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = Math.max(...times) - Math.min(...times);

      // 性能应该保持稳定
      expect(averageTime).toBeLessThan(200);
      expect(variance).toBeLessThan(500); // 性能差异不应太大

      console.log(`Sustained load - Average: ${averageTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms, Variance: ${variance.toFixed(2)}ms`);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', async () => {
      // 这个测试可以用来检测性能回归
      // 在 CI 中可以与之前的基准进行比较

      const benchmarks = {
        smallDocumentLoad: 100,
        smallDocumentEdit: 50,
        mediumDocumentLoad: 150,
        largeDocumentEdit: 100,
        search: 100
      };

      // 执行基准测试
      const results: Record<string, number> = {};

      // 小文档加载
      const start1 = performance.now();
      const testDraft = await documentService.createDraft({
        title: 'Benchmark Test',
        template: 'basic',
        description: 'Performance benchmark',
        author: 'benchmark'
      });
      await documentService.getDraft(testDraft.id);
      results.smallDocumentLoad = performance.now() - start1;

      // 小文档编辑
      const start2 = performance.now();
      await documentService.updateDraft(testDraft.id, {
        content: { section: 'benchmark content' }
      }, 'benchmark');
      results.smallDocumentEdit = performance.now() - start2;

      // 搜索
      const start3 = performance.now();
      await documentService.searchDrafts({ query: 'benchmark', limit: 10 });
      results.search = performance.now() - start3;

      // 检查是否符合基准
      for (const [operation, threshold] of Object.entries(benchmarks)) {
        if (results[operation] !== undefined) {
          expect(results[operation]).toBeLessThan(threshold);
          console.log(`${operation}: ${results[operation].toFixed(2)}ms (threshold: ${threshold}ms)`);
        }
      }
    });
  });
});