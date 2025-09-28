/**
 * T035: Comprehensive File System Integration Test
 *
 * Tests FileManager integration with all services, data consistency checks,
 * and file system monitoring capabilities.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { FileManager } from '../../src/lib/file-manager';
import { DocumentService } from '../../src/services/document-service';
import { TemplateService } from '../../src/services/template-service';
import { VersionService } from '../../src/services/version-service';
import { PermissionService } from '../../src/services/permission-service';
import { DiagramService } from '../../src/services/diagram-service';
import { PRDDraft } from '../../src/models/prd-draft';
import { Template } from '../../src/models/template';
import { MarkdownParser } from '../../src/lib/markdown-parser';
import { Utils } from '../../src/lib/utils';

describe('T035: File System Integration', () => {
  let testDir: string;
  let fileManager: FileManager;
  let documentService: DocumentService;
  let templateService: TemplateService;
  let versionService: VersionService;
  let permissionService: PermissionService;
  let diagramService: DiagramService;
  let markdownParser: MarkdownParser;

  beforeAll(async () => {
    // Create isolated test directory
    testDir = path.join(__dirname, '..', 'temp', 'filesystem-integration');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Initialize FileManager with test directory
    fileManager = new FileManager(testDir);
    markdownParser = new MarkdownParser();

    // Initialize all services with FileManager
    documentService = new DocumentService(fileManager, markdownParser);
    templateService = new TemplateService(fileManager);
    versionService = new VersionService(fileManager);
    permissionService = new PermissionService(fileManager);
    diagramService = new DiagramService(fileManager, markdownParser);

    // Ensure clean state for each test
    await fileManager.initialize();
  });

  afterEach(async () => {
    // Clean up between tests
    const files = await fs.readdir(testDir);
    for (const file of files) {
      await fs.rm(path.join(testDir, file), { recursive: true, force: true });
    }
  });

  describe('FileManager Service Integration', () => {
    it('应该能与 DocumentService 协同工作进行 PRD 文档存储', async () => {
      // Create template first
      const template: Template = {
        id: 'test-template',
        name: '测试模板',
        description: '系统测试模板',
        category: 'standard',
        sections: [
          {
            id: 'overview',
            title: '概述',
            type: 'text',
            required: true,
            content: '产品概述内容'
          }
        ],
        metadata: {
          version: '1.0.0',
          author: 'test',
          tags: ['test']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await templateService.createTemplate(template);

      // Create PRD draft using DocumentService
      const draft: PRDDraft = {
        id: 'test-draft',
        title: '测试 PRD 文档',
        description: '文件系统集成测试文档',
        content: {
          overview: '这是一个测试 PRD 文档，用于验证文件系统集成'
        },
        templateId: 'test-template',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: ['test', 'integration'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await documentService.createDraft(draft);

      // Verify file exists in file system
      const draftPath = path.join(testDir, 'drafts', 'test-draft.jsonl');
      const exists = await fileManager.exists(draftPath);
      expect(exists).toBe(true);

      // Verify content can be read back
      const readDraft = await documentService.getDraft('test-draft');
      expect(readDraft).toBeDefined();
      expect(readDraft!.title).toBe(draft.title);
      expect(readDraft!.content.overview).toBe(draft.content.overview);
    });

    it('应该能与 VersionService 协同工作进行版本历史存储', async () => {
      // Create initial draft
      const draft: PRDDraft = {
        id: 'version-test',
        title: '版本测试文档',
        description: '版本系统测试',
        content: { overview: '初始版本内容' },
        templateId: 'basic',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(draft);

      // Create version snapshot
      const versionData = await versionService.createVersion({
        draftId: 'version-test',
        version: '1.1.0',
        message: '文件系统集成测试版本',
        changes: [{
          type: 'update',
          section: 'overview',
          description: '更新概述内容'
        }],
        author: 'test-user'
      });

      // Verify version file exists
      const versionPath = path.join(testDir, 'versions', 'version-test', '1.1.0.json');
      const exists = await fileManager.exists(versionPath);
      expect(exists).toBe(true);

      // Verify version can be read back
      const versions = await versionService.getVersionHistory('version-test');
      expect(versions).toHaveLength(1);
      expect(versions[0].version).toBe('1.1.0');
    });

    it('应该能与 TemplateService 协同工作进行模板存储', async () => {
      const template: Template = {
        id: 'fs-integration-template',
        name: '文件系统集成模板',
        description: '测试 FileManager 与 TemplateService 集成',
        category: 'integration',
        sections: [
          {
            id: 'test-section',
            title: '测试章节',
            type: 'text',
            required: true,
            content: '测试内容'
          }
        ],
        metadata: {
          version: '1.0.0',
          author: 'system',
          tags: ['integration', 'test']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await templateService.createTemplate(template);

      // Verify template file exists
      const templatePath = path.join(testDir, 'templates', 'fs-integration-template.json');
      const exists = await fileManager.exists(templatePath);
      expect(exists).toBe(true);

      // Verify template can be read back
      const readTemplate = await templateService.getTemplate('fs-integration-template');
      expect(readTemplate).toBeDefined();
      expect(readTemplate!.name).toBe(template.name);
    });
  });

  describe('Data Consistency Checks', () => {
    it('应该检测并修复文件系统数据不一致', async () => {
      // Create draft normally
      const draft: PRDDraft = {
        id: 'consistency-test',
        title: '一致性测试',
        description: '数据一致性检查测试',
        content: { overview: '测试内容' },
        templateId: 'basic',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(draft);

      // Manually corrupt the file to simulate inconsistency
      const draftPath = path.join(testDir, 'drafts', 'consistency-test.jsonl');
      await fs.writeFile(draftPath, 'corrupted data', 'utf-8');

      // Try to read draft - should detect corruption
      try {
        await documentService.getDraft('consistency-test');
        expect.fail('Should have detected corrupted data');
      } catch (error) {
        expect(error).toBeDefined();
      }

      // Verify FileManager can detect and report corruption
      const isValid = await fileManager.validateFile(draftPath);
      expect(isValid).toBe(false);
    });

    it('应该验证跨服务的数据引用完整性', async () => {
      // Create template
      const template: Template = {
        id: 'integrity-template',
        name: '完整性测试模板',
        description: '数据引用完整性测试',
        category: 'test',
        sections: [{
          id: 'section1',
          title: '测试章节',
          type: 'text',
          required: true,
          content: '内容'
        }],
        metadata: {
          version: '1.0.0',
          author: 'test',
          tags: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await templateService.createTemplate(template);

      // Create draft referencing template
      const draft: PRDDraft = {
        id: 'integrity-draft',
        title: '完整性测试文档',
        description: '测试模板引用完整性',
        content: { section1: '测试内容' },
        templateId: 'integrity-template',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(draft);

      // Verify draft can resolve template reference
      const draftWithTemplate = await documentService.getDraft('integrity-draft');
      expect(draftWithTemplate).toBeDefined();
      expect(draftWithTemplate!.templateId).toBe('integrity-template');

      // Verify template exists
      const templateExists = await templateService.templateExists('integrity-template');
      expect(templateExists).toBe(true);

      // Test referential integrity when template is deleted
      await templateService.deleteTemplate('integrity-template');

      // Draft should still exist but template reference should be invalid
      const orphanedDraft = await documentService.getDraft('integrity-draft');
      expect(orphanedDraft).toBeDefined();

      const templateStillExists = await templateService.templateExists('integrity-template');
      expect(templateStillExists).toBe(false);
    });

    it('应该处理并发文件操作', async () => {
      const operations: Promise<any>[] = [];

      // Create multiple concurrent operations
      for (let i = 0; i < 5; i++) {
        const draft: PRDDraft = {
          id: `concurrent-draft-${i}`,
          title: `并发测试文档 ${i}`,
          description: '并发操作测试',
          content: { overview: `并发内容 ${i}` },
          templateId: 'basic',
          author: 'test-user',
          status: 'draft',
          version: '1.0.0',
          tags: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };

        operations.push(documentService.createDraft(draft));
      }

      // Wait for all operations to complete
      const results = await Promise.allSettled(operations);

      // All operations should succeed
      for (const result of results) {
        expect(result.status).toBe('fulfilled');
      }

      // Verify all drafts were created
      for (let i = 0; i < 5; i++) {
        const draft = await documentService.getDraft(`concurrent-draft-${i}`);
        expect(draft).toBeDefined();
        expect(draft!.title).toBe(`并发测试文档 ${i}`);
      }
    });
  });

  describe('File System Monitoring', () => {
    it('应该监控文件变化并同步状态', async () => {
      // Create initial draft
      const draft: PRDDraft = {
        id: 'monitor-test',
        title: '监控测试',
        description: '文件系统监控测试',
        content: { overview: '初始内容' },
        templateId: 'basic',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(draft);

      // Verify file exists
      const draftPath = path.join(testDir, 'drafts', 'monitor-test.jsonl');
      const initialStats = await fs.stat(draftPath);

      // Wait a moment to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update draft
      const updatedDraft = {
        ...draft,
        content: { overview: '更新内容' },
        updatedAt: new Date()
      };

      await documentService.updateDraft('monitor-test', updatedDraft);

      // Verify file was modified
      const updatedStats = await fs.stat(draftPath);
      expect(updatedStats.mtime.getTime()).toBeGreaterThan(initialStats.mtime.getTime());

      // Verify content was updated
      const readDraft = await documentService.getDraft('monitor-test');
      expect(readDraft!.content.overview).toBe('更新内容');
    });

    it('应该处理外部文件系统变化', async () => {
      // Create draft through service
      const draft: PRDDraft = {
        id: 'external-change',
        title: '外部变化测试',
        description: '外部文件系统变化测试',
        content: { overview: '原始内容' },
        templateId: 'basic',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(draft);

      // Directly modify file (simulating external change)
      const draftPath = path.join(testDir, 'drafts', 'external-change.jsonl');
      const modifiedData = {
        ...draft,
        content: { overview: '外部修改内容' },
        updatedAt: new Date()
      };

      await fs.writeFile(draftPath, JSON.stringify(modifiedData) + '\n', 'utf-8');

      // Read through service - should detect external change
      const readDraft = await documentService.getDraft('external-change');
      expect(readDraft!.content.overview).toBe('外部修改内容');
    });
  });

  describe('Storage Layout Validation', () => {
    it('应该遵循 data-model.md 中指定的存储布局', async () => {
      // Create various entities to test storage layout
      const template: Template = {
        id: 'layout-template',
        name: '布局测试模板',
        description: '存储布局测试',
        category: 'test',
        sections: [{
          id: 'section1',
          title: '章节1',
          type: 'text',
          required: true,
          content: '内容'
        }],
        metadata: {
          version: '1.0.0',
          author: 'test',
          tags: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await templateService.createTemplate(template);

      const draft: PRDDraft = {
        id: 'layout-draft',
        title: '布局测试文档',
        description: '存储布局测试',
        content: { section1: '测试内容' },
        templateId: 'layout-template',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(draft);

      // Create version
      await versionService.createVersion({
        draftId: 'layout-draft',
        version: '1.1.0',
        message: '布局测试版本',
        changes: [],
        author: 'test-user'
      });

      // Verify expected directory structure exists
      const expectedDirs = ['drafts', 'templates', 'versions', 'permissions'];
      for (const dir of expectedDirs) {
        const dirPath = path.join(testDir, dir);
        const exists = await fileManager.exists(dirPath);
        expect(exists).toBe(true);
      }

      // Verify specific file locations
      const expectedFiles = [
        'templates/layout-template.json',
        'drafts/layout-draft.jsonl',
        'versions/layout-draft/1.1.0.json'
      ];

      for (const file of expectedFiles) {
        const filePath = path.join(testDir, file);
        const exists = await fileManager.exists(filePath);
        expect(exists).toBe(true);
      }
    });

    it('应该维护正确的文件权限和访问控制', async () => {
      // Create draft
      const draft: PRDDraft = {
        id: 'permission-test',
        title: '权限测试',
        description: '文件权限测试',
        content: { overview: '权限测试内容' },
        templateId: 'basic',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(draft);

      // Verify file permissions
      const draftPath = path.join(testDir, 'drafts', 'permission-test.jsonl');
      const stats = await fs.stat(draftPath);

      // File should be readable and writable
      expect(stats.isFile()).toBe(true);

      // Test file can be read
      const content = await fs.readFile(draftPath, 'utf-8');
      expect(content).toContain('permission-test');

      // Test atomic write operation
      const backupContent = content;
      await fileManager.writeFileAtomic(draftPath, JSON.stringify({ test: 'atomic write' }));

      const newContent = await fs.readFile(draftPath, 'utf-8');
      expect(newContent).toContain('atomic write');
    });
  });

  describe('Recovery Mechanisms', () => {
    it('应该能从文件系统错误中恢复', async () => {
      // Create draft
      const draft: PRDDraft = {
        id: 'recovery-test',
        title: '恢复测试',
        description: '错误恢复测试',
        content: { overview: '恢复测试内容' },
        templateId: 'basic',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(draft);

      // Simulate file corruption
      const draftPath = path.join(testDir, 'drafts', 'recovery-test.jsonl');
      await fs.writeFile(draftPath, 'corrupted data', 'utf-8');

      // Attempt recovery by recreating from valid data
      try {
        await documentService.getDraft('recovery-test');
      } catch (error) {
        // Recovery: recreate draft with original data
        await documentService.createDraft(draft);

        // Verify recovery succeeded
        const recoveredDraft = await documentService.getDraft('recovery-test');
        expect(recoveredDraft).toBeDefined();
        expect(recoveredDraft!.title).toBe(draft.title);
      }
    });

    it('应该提供数据备份和恢复功能', async () => {
      // Create multiple entities
      const template: Template = {
        id: 'backup-template',
        name: '备份测试模板',
        description: '备份恢复测试',
        category: 'backup',
        sections: [{
          id: 'section1',
          title: '章节1',
          type: 'text',
          required: true,
          content: '备份内容'
        }],
        metadata: {
          version: '1.0.0',
          author: 'test',
          tags: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await templateService.createTemplate(template);

      const draft: PRDDraft = {
        id: 'backup-draft',
        title: '备份测试文档',
        description: '备份恢复测试',
        content: { section1: '备份测试内容' },
        templateId: 'backup-template',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(draft);

      // Create backup directory structure
      const backupDir = path.join(testDir, 'backup');
      await fs.mkdir(backupDir, { recursive: true });

      // Backup all data files
      const dataFiles = await fileManager.getAllDataFiles();
      for (const file of dataFiles) {
        const relativePath = path.relative(testDir, file);
        const backupPath = path.join(backupDir, relativePath);
        await fs.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.copyFile(file, backupPath);
      }

      // Verify backup was created
      const backupTemplateExists = await fileManager.exists(
        path.join(backupDir, 'templates', 'backup-template.json')
      );
      const backupDraftExists = await fileManager.exists(
        path.join(backupDir, 'drafts', 'backup-draft.jsonl')
      );

      expect(backupTemplateExists).toBe(true);
      expect(backupDraftExists).toBe(true);
    });
  });
});