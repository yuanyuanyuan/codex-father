/**
 * 文件系统操作和搜索功能性能基准测试
 *
 * 测试范围：
 * - 文件读写操作性能
 * - 文件锁定和原子操作性能
 * - 文件监控性能
 * - 搜索索引构建和查询性能
 * - 大量文件处理性能
 * - 内存使用优化验证
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { FileManager } from '../../src/lib/file-manager.js';
import { MarkdownParser } from '../../src/lib/markdown-parser.js';
import { DefaultDocumentService } from '../../src/services/document-service.js';
import type { FileOperationOptions, BackupOptions } from '../../src/lib/file-manager.js';

describe('Filesystem and Search Performance', () => {
  let fileManager: FileManager;
  let markdownParser: MarkdownParser;
  let documentService: DefaultDocumentService;
  let testWorkspace: string;
  let memoryBaseline: number;

  beforeEach(() => {
    testWorkspace = '/tmp/fs-perf-test';
    fileManager = new FileManager(testWorkspace);
    markdownParser = new MarkdownParser();
    documentService = new DefaultDocumentService(testWorkspace);
    memoryBaseline = process.memoryUsage().heapUsed;
  });

  afterEach(() => {
    // 检查内存增长
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryDelta = memoryAfter - memoryBaseline;

    // 内存增长不应超过 20MB
    expect(memoryDelta).toBeLessThan(20 * 1024 * 1024);
  });

  describe('File Operations Performance', () => {
    it('should perform file read operations efficiently', async () => {
      // 创建测试文件
      const testContent = 'A'.repeat(10000); // 10KB content
      const filePath = 'test-read.md';

      await fileManager.writeFile(filePath, testContent);

      const times: number[] = [];

      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        const content = await fileManager.readFile(filePath);
        const end = performance.now();

        expect(content).toBe(testContent);
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // 文件读取平均时间应该小于 10ms
      expect(averageTime).toBeLessThan(10);
      expect(maxTime).toBeLessThan(20);

      console.log(`File read performance - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });

    it('should perform file write operations efficiently', async () => {
      const testContent = 'B'.repeat(5000); // 5KB content
      const times: number[] = [];

      for (let i = 0; i < 15; i++) {
        const filePath = `test-write-${i}.md`;
        const content = `${testContent} - ${i}`;

        const start = performance.now();
        await fileManager.writeFile(filePath, content);
        const end = performance.now();

        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // 文件写入平均时间应该小于 20ms
      expect(averageTime).toBeLessThan(20);
      expect(maxTime).toBeLessThan(50);

      console.log(`File write performance - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });

    it('should handle atomic write operations efficiently', async () => {
      const testContent = 'C'.repeat(8000); // 8KB content
      const filePath = 'test-atomic.md';
      const times: number[] = [];

      const options: FileOperationOptions = {
        atomic: true,
        backup: true,
        encoding: 'utf8'
      };

      for (let i = 0; i < 10; i++) {
        const content = `${testContent} - atomic write ${i}`;

        const start = performance.now();
        await fileManager.writeFile(filePath, content, options);
        const end = performance.now();

        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      // 原子写入操作应该在 30ms 内完成
      expect(averageTime).toBeLessThan(30);

      console.log(`Atomic write performance - Average: ${averageTime.toFixed(2)}ms`);
    });

    it('should handle file locking efficiently', async () => {
      const filePath = 'test-lock.md';
      const testContent = 'Lock test content';

      await fileManager.writeFile(filePath, testContent);

      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();

        const success = await fileManager.acquireLock(filePath);
        expect(success).toBe(true);

        // 模拟一些文件操作
        await new Promise(resolve => setTimeout(resolve, 5));

        await fileManager.releaseLock(filePath);

        const end = performance.now();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      // 文件锁定操作应该很快
      expect(averageTime).toBeLessThan(15);

      console.log(`File locking performance - Average: ${averageTime.toFixed(2)}ms`);
    });

    it('should handle batch file operations efficiently', async () => {
      const fileCount = 50;
      const contentSize = 2000; // 2KB per file

      const start = performance.now();

      // 批量创建文件
      const writePromises = Array.from({ length: fileCount }, (_, i) => {
        const filePath = `batch-${i}.md`;
        const content = `# Document ${i}\n${'Content '.repeat(contentSize / 8)}`;
        return fileManager.writeFile(filePath, content);
      });

      await Promise.all(writePromises);

      // 批量读取文件
      const readPromises = Array.from({ length: fileCount }, (_, i) => {
        const filePath = `batch-${i}.md`;
        return fileManager.readFile(filePath);
      });

      const contents = await Promise.all(readPromises);

      const end = performance.now();
      const totalTime = end - start;
      const averagePerFile = totalTime / (fileCount * 2); // read + write

      expect(contents).toHaveLength(fileCount);
      expect(averagePerFile).toBeLessThan(5); // 每个文件操作应该小于 5ms

      console.log(`Batch operations - Total: ${totalTime.toFixed(2)}ms, Average per file: ${averagePerFile.toFixed(2)}ms`);
    });

    it('should handle concurrent file operations safely', async () => {
      const concurrentCount = 10;
      const filePath = 'concurrent-test.md';

      const start = performance.now();

      const promises = Array.from({ length: concurrentCount }, async (_, i) => {
        const content = `Concurrent write ${i} at ${Date.now()}`;
        await fileManager.writeFile(`${filePath}-${i}`, content);
        return fileManager.readFile(`${filePath}-${i}`);
      });

      const results = await Promise.all(promises);

      const end = performance.now();
      const totalTime = end - start;
      const averageTime = totalTime / concurrentCount;

      expect(results).toHaveLength(concurrentCount);
      expect(averageTime).toBeLessThan(25);

      console.log(`Concurrent operations - Total: ${totalTime.toFixed(2)}ms, Average: ${averageTime.toFixed(2)}ms`);
    });
  });

  describe('File Monitoring Performance', () => {
    it('should handle file watching efficiently', async () => {
      const watchPath = 'watch-test';
      const eventCounts = { created: 0, modified: 0, deleted: 0 };

      // 设置文件监控
      const watcher = await fileManager.watchDirectory(watchPath, {
        onCreate: () => { eventCounts.created++; },
        onModify: () => { eventCounts.modified++; },
        onDelete: () => { eventCounts.deleted++; }
      });

      const start = performance.now();

      // 创建多个文件
      for (let i = 0; i < 20; i++) {
        await fileManager.writeFile(`${watchPath}/file-${i}.md`, `Content ${i}`);
      }

      // 修改文件
      for (let i = 0; i < 10; i++) {
        await fileManager.writeFile(`${watchPath}/file-${i}.md`, `Modified content ${i}`);
      }

      // 等待事件处理
      await new Promise(resolve => setTimeout(resolve, 100));

      const end = performance.now();
      const totalTime = end - start;

      // 停止监控
      await watcher.close();

      expect(eventCounts.created).toBeGreaterThan(0);
      expect(totalTime).toBeLessThan(500); // 文件监控应该快速响应

      console.log(`File watching - Total time: ${totalTime.toFixed(2)}ms, Events: ${JSON.stringify(eventCounts)}`);
    });

    it('should handle large directory scanning efficiently', async () => {
      const dirPath = 'large-scan-test';
      const fileCount = 100;

      // 创建大量文件
      const createPromises = Array.from({ length: fileCount }, (_, i) => {
        const filePath = `${dirPath}/document-${i}.md`;
        const content = `# Document ${i}\n\nContent for document ${i}`;
        return fileManager.writeFile(filePath, content);
      });

      await Promise.all(createPromises);

      const start = performance.now();
      const files = await fileManager.listFiles(dirPath, { recursive: true });
      const end = performance.now();

      const scanTime = end - start;

      expect(files).toHaveLength(fileCount);
      expect(scanTime).toBeLessThan(100); // 目录扫描应该在 100ms 内

      console.log(`Directory scanning - Time: ${scanTime.toFixed(2)}ms, Files: ${files.length}`);
    });
  });

  describe('Backup and Maintenance Performance', () => {
    it('should perform backup operations efficiently', async () => {
      const sourceFile = 'backup-source.md';
      const content = 'D'.repeat(15000); // 15KB content

      await fileManager.writeFile(sourceFile, content);

      const backupOptions: BackupOptions = {
        maxBackups: 5,
        compression: false,
        timestamp: true
      };

      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        await fileManager.createBackup(sourceFile, backupOptions);
        const end = performance.now();

        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      // 备份操作应该在 50ms 内完成
      expect(averageTime).toBeLessThan(50);

      console.log(`Backup performance - Average: ${averageTime.toFixed(2)}ms`);
    });

    it('should handle file cleanup efficiently', async () => {
      const cleanupDir = 'cleanup-test';
      const fileCount = 30;

      // 创建临时文件
      for (let i = 0; i < fileCount; i++) {
        await fileManager.writeFile(`${cleanupDir}/temp-${i}.tmp`, `Temp content ${i}`);
      }

      const start = performance.now();

      // 执行清理操作
      const cleanedFiles = await fileManager.cleanupDirectory(cleanupDir, {
        pattern: '*.tmp',
        olderThan: 0 // 立即清理
      });

      const end = performance.now();
      const cleanupTime = end - start;

      expect(cleanedFiles).toBe(fileCount);
      expect(cleanupTime).toBeLessThan(100);

      console.log(`Cleanup performance - Time: ${cleanupTime.toFixed(2)}ms, Files cleaned: ${cleanedFiles}`);
    });
  });

  describe('Markdown Parsing Performance', () => {
    it('should parse simple markdown efficiently', async () => {
      const simpleMarkdown = `
# Test Document

This is a **simple** markdown document with:

- List item 1
- List item 2
- List item 3

## Section 2

Some \`code\` and [link](http://example.com).

> Quote block here
      `;

      const times: number[] = [];

      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        const result = await markdownParser.parse(simpleMarkdown);
        const end = performance.now();

        expect(result.html).toBeDefined();
        expect(result.toc).toBeDefined();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      // Markdown 解析应该很快
      expect(averageTime).toBeLessThan(5);

      console.log(`Simple markdown parsing - Average: ${averageTime.toFixed(2)}ms`);
    });

    it('should parse complex markdown efficiently', async () => {
      const complexMarkdown = `
# Complex Document

## Table of Contents

${Array.from({ length: 20 }, (_, i) => `- [Section ${i + 1}](#section-${i + 1})`).join('\n')}

${Array.from({ length: 20 }, (_, i) => `
## Section ${i + 1}

This is section ${i + 1} with **bold text**, *italic text*, and \`inline code\`.

### Subsection ${i + 1}.1

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Data 1   | Data 2   | Data 3   |
| Data 4   | Data 5   | Data 6   |

\`\`\`javascript
function example${i}() {
  console.log('Example ${i}');
  return ${i};
}
\`\`\`

> Quote for section ${i + 1}

1. Numbered item 1
2. Numbered item 2
3. Numbered item 3
`).join('\n')}
      `;

      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const result = await markdownParser.parse(complexMarkdown);
        const end = performance.now();

        expect(result.html).toBeDefined();
        expect(result.toc).toHaveLength(20);
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      // 复杂 Markdown 解析应该在合理时间内
      expect(averageTime).toBeLessThan(30);

      console.log(`Complex markdown parsing - Average: ${averageTime.toFixed(2)}ms`);
    });

    it('should handle markdown with diagrams efficiently', async () => {
      const diagramMarkdown = `
# Document with Diagrams

## Flowchart

\`\`\`mermaid
flowchart TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action 1]
  B -->|No| D[Action 2]
  C --> E[End]
  D --> E
\`\`\`

## Sequence Diagram

\`\`\`mermaid
sequenceDiagram
  participant A as User
  participant B as System
  A->>B: Request
  B-->>A: Response
\`\`\`

## Class Diagram

\`\`\`mermaid
classDiagram
  class User {
    +String name
    +login()
  }
\`\`\`
      `;

      const start = performance.now();
      const result = await markdownParser.parse(diagramMarkdown, {
        renderDiagrams: true
      });
      const end = performance.now();

      const parseTime = end - start;

      expect(result.html).toBeDefined();
      expect(result.diagrams).toHaveLength(3);
      expect(parseTime).toBeLessThan(100); // 图表解析应该在 100ms 内

      console.log(`Diagram markdown parsing - Time: ${parseTime.toFixed(2)}ms`);
    });
  });

  describe('Search Performance', () => {
    beforeEach(async () => {
      // 创建搜索测试数据
      const searchData = [
        { title: 'React Performance Optimization', content: 'React hooks, memoization, and virtual DOM optimization techniques for better performance.' },
        { title: 'Node.js API Development', content: 'Building RESTful APIs with Express.js, middleware, authentication, and database integration.' },
        { title: 'Database Design Patterns', content: 'SQL and NoSQL database design, indexing strategies, query optimization, and data modeling.' },
        { title: 'Frontend Architecture', content: 'Component-based architecture, state management, routing, and build optimization for modern web apps.' },
        { title: 'Security Best Practices', content: 'Authentication, authorization, input validation, XSS protection, and secure coding guidelines.' },
        { title: 'DevOps and CI/CD', content: 'Docker containerization, Kubernetes orchestration, automated testing, and deployment pipelines.' },
        { title: 'Performance Monitoring', content: 'Application performance monitoring, logging, metrics collection, and alerting systems.' },
        { title: 'Microservices Architecture', content: 'Service decomposition, inter-service communication, data consistency, and distributed systems.' },
        { title: 'Cloud Infrastructure', content: 'AWS services, serverless computing, infrastructure as code, and cloud security.' },
        { title: 'Testing Strategies', content: 'Unit testing, integration testing, end-to-end testing, and test automation frameworks.' }
      ];

      // 批量创建文档
      const createPromises = searchData.map((data, i) =>
        documentService.createDraft({
          title: data.title,
          template: 'basic',
          description: data.content,
          author: 'test-user'
        })
      );

      await Promise.all(createPromises);
    });

    it('should perform simple text search efficiently', async () => {
      const searchQueries = ['React', 'API', 'database', 'security', 'performance'];
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

      // 搜索应该在 50ms 内完成
      expect(averageTime).toBeLessThan(50);

      console.log(`Simple search performance - Average: ${averageTime.toFixed(2)}ms`);
    });

    it('should handle complex search queries efficiently', async () => {
      const complexQueries = [
        'React AND performance',
        'API OR database',
        'security NOT authentication',
        'cloud AND (AWS OR serverless)',
        'testing AND (unit OR integration)'
      ];

      const times: number[] = [];

      for (const query of complexQueries) {
        const start = performance.now();
        const results = await documentService.searchDrafts({
          query,
          scope: 'all',
          limit: 20
        });
        const end = performance.now();

        expect(results).toBeDefined();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      // 复杂搜索应该在 100ms 内完成
      expect(averageTime).toBeLessThan(100);

      console.log(`Complex search performance - Average: ${averageTime.toFixed(2)}ms`);
    });

    it('should handle filtered search efficiently', async () => {
      const start = performance.now();

      const results = await documentService.searchDrafts({
        query: 'architecture',
        scope: 'title',
        author: 'test-user',
        status: 'draft',
        limit: 50
      });

      const end = performance.now();
      const searchTime = end - start;

      expect(results).toBeDefined();
      expect(searchTime).toBeLessThan(75);

      console.log(`Filtered search performance - Time: ${searchTime.toFixed(2)}ms`);
    });

    it('should handle concurrent search requests efficiently', async () => {
      const concurrentQueries = [
        'React', 'Node.js', 'database', 'frontend', 'security',
        'DevOps', 'monitoring', 'microservices', 'cloud', 'testing'
      ];

      const start = performance.now();

      const searchPromises = concurrentQueries.map(query =>
        documentService.searchDrafts({
          query,
          scope: 'all',
          limit: 10
        })
      );

      const results = await Promise.all(searchPromises);

      const end = performance.now();
      const totalTime = end - start;
      const averageTime = totalTime / concurrentQueries.length;

      expect(results).toHaveLength(concurrentQueries.length);
      expect(averageTime).toBeLessThan(30);

      console.log(`Concurrent search - Total: ${totalTime.toFixed(2)}ms, Average: ${averageTime.toFixed(2)}ms`);
    });
  });

  describe('Large Scale Operations', () => {
    it('should handle large file processing efficiently', async () => {
      const largeContent = 'Large content section. '.repeat(5000); // ~100KB
      const fileCount = 20;

      const start = performance.now();

      // 创建大文件
      const createPromises = Array.from({ length: fileCount }, (_, i) => {
        const filePath = `large-file-${i}.md`;
        const content = `# Large Document ${i}\n\n${largeContent}`;
        return fileManager.writeFile(filePath, content);
      });

      await Promise.all(createPromises);

      // 读取大文件
      const readPromises = Array.from({ length: fileCount }, (_, i) => {
        const filePath = `large-file-${i}.md`;
        return fileManager.readFile(filePath);
      });

      const contents = await Promise.all(readPromises);

      const end = performance.now();
      const totalTime = end - start;
      const averagePerFile = totalTime / fileCount;

      expect(contents).toHaveLength(fileCount);
      expect(averagePerFile).toBeLessThan(50); // 每个大文件操作应该小于 50ms

      console.log(`Large file processing - Total: ${totalTime.toFixed(2)}ms, Average: ${averagePerFile.toFixed(2)}ms`);
    });

    it('should maintain performance under sustained load', async () => {
      const iterations = 20;
      const operationsPerIteration = 5;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const iterationStart = performance.now();

        const operations = Array.from({ length: operationsPerIteration }, (_, j) => {
          const filePath = `sustained-load-${i}-${j}.md`;
          const content = `Iteration ${i}, Operation ${j}`;
          return fileManager.writeFile(filePath, content)
            .then(() => fileManager.readFile(filePath));
        });

        await Promise.all(operations);

        const iterationEnd = performance.now();
        times.push(iterationEnd - iterationStart);

        // 短暂暂停
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variance = maxTime - minTime;

      // 性能应该保持稳定
      expect(averageTime).toBeLessThan(100);
      expect(variance).toBeLessThan(200); // 性能变化不应太大

      console.log(`Sustained load - Average: ${averageTime.toFixed(2)}ms, Min: ${minTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Management', () => {
    it('should manage memory efficiently during file operations', async () => {
      const initialMemory = process.memoryUsage();

      // 执行大量文件操作
      for (let i = 0; i < 100; i++) {
        const content = `File ${i} with content`.repeat(100);
        await fileManager.writeFile(`memory-test-${i}.md`, content);
        await fileManager.readFile(`memory-test-${i}.md`);
      }

      const finalMemory = process.memoryUsage();
      const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryMB = memoryDelta / (1024 * 1024);

      // 内存增长应该控制在 50MB 以内
      expect(memoryMB).toBeLessThan(50);

      console.log(`Memory usage during file operations: ${memoryMB.toFixed(2)}MB`);
    });

    it('should garbage collect effectively', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 创建大量临时对象
      for (let i = 0; i < 1000; i++) {
        const tempData = {
          id: i,
          content: 'Temporary data'.repeat(100),
          metadata: { created: Date.now() }
        };

        // 模拟处理
        JSON.stringify(tempData);
      }

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemory - initialMemory;
      const memoryMB = memoryDelta / (1024 * 1024);

      // 垃圾回收后内存增长应该很小
      expect(memoryMB).toBeLessThan(10);

      console.log(`Memory after GC: ${memoryMB.toFixed(2)}MB increase`);
    });
  });

  describe('Performance Benchmarks Summary', () => {
    it('should meet all filesystem performance requirements', async () => {
      const benchmarks = {
        fileRead: { limit: 10, operation: 'File read' },
        fileWrite: { limit: 20, operation: 'File write' },
        atomicWrite: { limit: 30, operation: 'Atomic write' },
        fileLocking: { limit: 15, operation: 'File locking' },
        directoryScanning: { limit: 100, operation: 'Directory scanning' },
        markdownParsing: { limit: 5, operation: 'Markdown parsing' },
        search: { limit: 50, operation: 'Search query' }
      };

      const results: Record<string, number> = {};

      // 文件读取基准
      const readStart = performance.now();
      await fileManager.readFile('benchmark-read.md') ||
        await fileManager.writeFile('benchmark-read.md', 'test').then(() => fileManager.readFile('benchmark-read.md'));
      results.fileRead = performance.now() - readStart;

      // 文件写入基准
      const writeStart = performance.now();
      await fileManager.writeFile('benchmark-write.md', 'benchmark content');
      results.fileWrite = performance.now() - writeStart;

      // Markdown 解析基准
      const parseStart = performance.now();
      await markdownParser.parse('# Benchmark\n\nTest content');
      results.markdownParsing = performance.now() - parseStart;

      // 搜索基准
      const searchStart = performance.now();
      await documentService.searchDrafts({ query: 'benchmark', limit: 10 });
      results.search = performance.now() - searchStart;

      // 验证所有基准
      for (const [benchmark, config] of Object.entries(benchmarks)) {
        const time = results[benchmark];
        if (time !== undefined) {
          expect(time).toBeLessThan(config.limit);
          console.log(`${config.operation}: ${time.toFixed(2)}ms (limit: ${config.limit}ms)`);
        }
      }
    });
  });
});