/**
 * T036: Permission System Integration Test
 *
 * Tests PermissionService integration with all API and CLI endpoints,
 * role-based section editing, review workflows, and audit logging.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { FileManager } from '../../src/lib/file-manager';
import { DocumentService } from '../../src/services/document-service';
import { TemplateService } from '../../src/services/template-service';
import { VersionService } from '../../src/services/version-service';
import { PermissionService } from '../../src/services/permission-service';
import { PRDDraft } from '../../src/models/prd-draft';
import { Template } from '../../src/models/template';
import { UserRole } from '../../src/models/user-role';
import { ReviewStatus } from '../../src/models/review-status';
import { MarkdownParser } from '../../src/lib/markdown-parser';

describe('T036: Permission System Integration', () => {
  let testDir: string;
  let fileManager: FileManager;
  let documentService: DocumentService;
  let templateService: TemplateService;
  let versionService: VersionService;
  let permissionService: PermissionService;
  let markdownParser: MarkdownParser;

  // Test users with different roles
  const testUsers = {
    architect: { id: 'user-architect', role: 'architect' as const, name: '架构师用户' },
    productManager: { id: 'user-pm', role: 'product_manager' as const, name: '产品经理用户' },
    developer: { id: 'user-dev', role: 'developer' as const, name: '开发者用户' },
    tester: { id: 'user-test', role: 'tester' as const, name: '测试用户' },
    viewer: { id: 'user-viewer', role: 'viewer' as const, name: '查看者用户' }
  };

  beforeAll(async () => {
    testDir = path.join(__dirname, '..', 'temp', 'permission-system-integration');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    fileManager = new FileManager(testDir);
    markdownParser = new MarkdownParser();

    documentService = new DocumentService(fileManager, markdownParser);
    templateService = new TemplateService(fileManager);
    versionService = new VersionService(fileManager);
    permissionService = new PermissionService(fileManager);

    await fileManager.initialize();

    // Initialize permission system with test users
    for (const user of Object.values(testUsers)) {
      await permissionService.initializeUserPermissions(user.id, user.role);
    }
  });

  afterEach(async () => {
    const files = await fs.readdir(testDir);
    for (const file of files) {
      await fs.rm(path.join(testDir, file), { recursive: true, force: true });
    }
  });

  describe('Role-Based Access Control', () => {
    let testTemplate: Template;
    let testDraft: PRDDraft;

    beforeEach(async () => {
      // Create test template
      testTemplate = {
        id: 'permission-template',
        name: '权限测试模板',
        description: '用于权限测试的模板',
        category: 'test',
        sections: [
          {
            id: 'business-requirements',
            title: '业务需求',
            type: 'text',
            required: true,
            content: '业务需求内容',
            permissions: {
              read: ['architect', 'product_manager', 'developer', 'tester', 'viewer'],
              write: ['architect', 'product_manager']
            }
          },
          {
            id: 'technical-design',
            title: '技术设计',
            type: 'text',
            required: true,
            content: '技术设计内容',
            permissions: {
              read: ['architect', 'product_manager', 'developer', 'tester'],
              write: ['architect', 'developer']
            }
          },
          {
            id: 'test-plan',
            title: '测试计划',
            type: 'text',
            required: false,
            content: '测试计划内容',
            permissions: {
              read: ['architect', 'product_manager', 'developer', 'tester'],
              write: ['tester']
            }
          }
        ],
        metadata: {
          version: '1.0.0',
          author: 'system',
          tags: ['permission-test']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await templateService.createTemplate(testTemplate);

      // Create test draft
      testDraft = {
        id: 'permission-draft',
        title: '权限测试文档',
        description: '用于测试权限控制的 PRD 文档',
        content: {
          'business-requirements': '初始业务需求',
          'technical-design': '初始技术设计',
          'test-plan': '初始测试计划'
        },
        templateId: 'permission-template',
        author: testUsers.architect.id,
        status: 'draft',
        version: '1.0.0',
        tags: ['permission-test'],
        permissions: {
          read: ['architect', 'product_manager', 'developer', 'tester', 'viewer'],
          write: ['architect', 'product_manager', 'developer'],
          review: ['architect', 'product_manager']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(testDraft);
    });

    it('应该根据用户角色控制文档读取权限', async () => {
      // Test read permissions for different roles
      const testCases = [
        { user: testUsers.architect, shouldHaveAccess: true },
        { user: testUsers.productManager, shouldHaveAccess: true },
        { user: testUsers.developer, shouldHaveAccess: true },
        { user: testUsers.tester, shouldHaveAccess: true },
        { user: testUsers.viewer, shouldHaveAccess: true }
      ];

      for (const testCase of testCases) {
        const hasPermission = await permissionService.checkPermission(
          testCase.user.id,
          'read',
          'document',
          'permission-draft'
        );

        expect(hasPermission).toBe(testCase.shouldHaveAccess);

        if (testCase.shouldHaveAccess) {
          const draft = await documentService.getDraft('permission-draft', testCase.user.id);
          expect(draft).toBeDefined();
          expect(draft!.title).toBe(testDraft.title);
        }
      }
    });

    it('应该根据用户角色控制文档写入权限', async () => {
      const testCases = [
        { user: testUsers.architect, shouldHaveAccess: true },
        { user: testUsers.productManager, shouldHaveAccess: true },
        { user: testUsers.developer, shouldHaveAccess: true },
        { user: testUsers.tester, shouldHaveAccess: false },
        { user: testUsers.viewer, shouldHaveAccess: false }
      ];

      for (const testCase of testCases) {
        const hasPermission = await permissionService.checkPermission(
          testCase.user.id,
          'write',
          'document',
          'permission-draft'
        );

        expect(hasPermission).toBe(testCase.shouldHaveAccess);

        if (testCase.shouldHaveAccess) {
          // Should be able to update draft
          const updatedContent = {
            ...testDraft.content,
            'business-requirements': `更新后的业务需求 - ${testCase.user.name}`
          };

          const result = await documentService.updateDraft(
            'permission-draft',
            { ...testDraft, content: updatedContent },
            testCase.user.id
          );

          expect(result.success).toBe(true);
        } else {
          // Should not be able to update draft
          try {
            await documentService.updateDraft(
              'permission-draft',
              { ...testDraft, content: { ...testDraft.content } },
              testCase.user.id
            );
            expect.fail(`${testCase.user.name} should not have write permission`);
          } catch (error) {
            expect(error).toBeDefined();
          }
        }
      }
    });

    it('应该根据章节权限控制部分内容编辑', async () => {
      // Test section-level permissions
      const sectionPermissionTests = [
        {
          section: 'business-requirements',
          user: testUsers.productManager,
          shouldWrite: true,
          content: '产品经理更新的业务需求'
        },
        {
          section: 'technical-design',
          user: testUsers.developer,
          shouldWrite: true,
          content: '开发者更新的技术设计'
        },
        {
          section: 'test-plan',
          user: testUsers.tester,
          shouldWrite: true,
          content: '测试人员更新的测试计划'
        },
        {
          section: 'technical-design',
          user: testUsers.tester,
          shouldWrite: false,
          content: '测试人员尝试更新技术设计'
        },
        {
          section: 'business-requirements',
          user: testUsers.viewer,
          shouldWrite: false,
          content: '查看者尝试更新业务需求'
        }
      ];

      for (const test of sectionPermissionTests) {
        const hasPermission = await permissionService.checkSectionPermission(
          test.user.id,
          'write',
          'permission-draft',
          test.section
        );

        expect(hasPermission).toBe(test.shouldWrite);

        if (test.shouldWrite) {
          // Should be able to update specific section
          const result = await documentService.updateDraftSection(
            'permission-draft',
            test.section,
            test.content,
            test.user.id
          );

          expect(result.success).toBe(true);

          // Verify section was updated
          const updatedDraft = await documentService.getDraft('permission-draft');
          expect(updatedDraft!.content[test.section]).toBe(test.content);
        } else {
          // Should not be able to update section
          try {
            await documentService.updateDraftSection(
              'permission-draft',
              test.section,
              test.content,
              test.user.id
            );
            expect.fail(`${test.user.name} should not have write permission for ${test.section}`);
          } catch (error) {
            expect(error).toBeDefined();
          }
        }
      }
    });
  });

  describe('Review Workflow Integration', () => {
    let reviewDraft: PRDDraft;

    beforeEach(async () => {
      reviewDraft = {
        id: 'review-draft',
        title: '评审测试文档',
        description: '用于测试评审工作流的文档',
        content: {
          overview: '概述内容',
          requirements: '需求内容'
        },
        templateId: 'basic',
        author: testUsers.productManager.id,
        status: 'draft',
        version: '1.0.0',
        tags: ['review-test'],
        permissions: {
          read: ['architect', 'product_manager', 'developer', 'tester'],
          write: ['product_manager'],
          review: ['architect', 'developer']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(reviewDraft);
    });

    it('应该控制评审提交权限', async () => {
      const testCases = [
        { user: testUsers.productManager, shouldSubmit: true }, // Author can submit
        { user: testUsers.architect, shouldSubmit: false }, // Reviewer cannot submit
        { user: testUsers.developer, shouldSubmit: false }, // Reviewer cannot submit
        { user: testUsers.tester, shouldSubmit: false }, // No review permission
        { user: testUsers.viewer, shouldSubmit: false } // No review permission
      ];

      for (const testCase of testCases) {
        const hasPermission = await permissionService.checkPermission(
          testCase.user.id,
          'submit_review',
          'document',
          'review-draft'
        );

        expect(hasPermission).toBe(testCase.shouldSubmit);

        if (testCase.shouldSubmit) {
          // Should be able to submit for review
          const result = await documentService.submitForReview(
            'review-draft',
            {
              reviewers: [testUsers.architect.id, testUsers.developer.id],
              message: '请审核此文档',
              priority: 'normal'
            },
            testCase.user.id
          );

          expect(result.success).toBe(true);
        }
      }
    });

    it('应该控制评审决策权限', async () => {
      // First submit for review
      await documentService.submitForReview(
        'review-draft',
        {
          reviewers: [testUsers.architect.id, testUsers.developer.id],
          message: '请审核此文档',
          priority: 'normal'
        },
        testUsers.productManager.id
      );

      const testCases = [
        { user: testUsers.architect, shouldReview: true, decision: 'approve' },
        { user: testUsers.developer, shouldReview: true, decision: 'request_changes' },
        { user: testUsers.productManager, shouldReview: false, decision: 'approve' }, // Author cannot review
        { user: testUsers.tester, shouldReview: false, decision: 'approve' }, // Not a reviewer
        { user: testUsers.viewer, shouldReview: false, decision: 'approve' } // No review permission
      ];

      for (const testCase of testCases) {
        const hasPermission = await permissionService.checkPermission(
          testCase.user.id,
          'review',
          'document',
          'review-draft'
        );

        expect(hasPermission).toBe(testCase.shouldReview);

        if (testCase.shouldReview) {
          // Should be able to submit review decision
          const result = await documentService.submitReviewDecision(
            'review-draft',
            {
              decision: testCase.decision as 'approve' | 'reject' | 'request_changes',
              comments: `评审意见来自 ${testCase.user.name}`,
              reviewer: testCase.user.id
            }
          );

          expect(result.success).toBe(true);
        } else {
          // Should not be able to submit review decision
          try {
            await documentService.submitReviewDecision(
              'review-draft',
              {
                decision: testCase.decision as 'approve' | 'reject' | 'request_changes',
                comments: `无效评审意见`,
                reviewer: testCase.user.id
              }
            );
            expect.fail(`${testCase.user.name} should not have review permission`);
          } catch (error) {
            expect(error).toBeDefined();
          }
        }
      }
    });

    it('应该在评审过程中动态调整权限', async () => {
      // Submit for review
      await documentService.submitForReview(
        'review-draft',
        {
          reviewers: [testUsers.architect.id],
          message: '请审核',
          priority: 'normal'
        },
        testUsers.productManager.id
      );

      // During review, author should not be able to edit
      const hasWritePermissionDuringReview = await permissionService.checkPermission(
        testUsers.productManager.id,
        'write',
        'document',
        'review-draft'
      );
      expect(hasWritePermissionDuringReview).toBe(false);

      // Approve the review
      await documentService.submitReviewDecision(
        'review-draft',
        {
          decision: 'approve',
          comments: '文档通过审核',
          reviewer: testUsers.architect.id
        }
      );

      // After approval, certain permissions should be restored/modified
      const hasWritePermissionAfterApproval = await permissionService.checkPermission(
        testUsers.productManager.id,
        'write',
        'document',
        'review-draft'
      );

      // Behavior may vary based on business rules
      // For this test, we assume author regains write permission after approval
      expect(hasWritePermissionAfterApproval).toBe(true);
    });
  });

  describe('Audit Logging', () => {
    it('应该记录所有权限控制操作', async () => {
      const operations = [
        {
          user: testUsers.architect,
          action: 'create_draft',
          resource: 'audit-test-draft'
        },
        {
          user: testUsers.productManager,
          action: 'read_draft',
          resource: 'audit-test-draft'
        },
        {
          user: testUsers.developer,
          action: 'update_draft',
          resource: 'audit-test-draft'
        }
      ];

      // Perform operations that should be audited
      for (const op of operations) {
        await permissionService.logAuditEvent(
          op.user.id,
          op.action,
          op.resource,
          { success: true, timestamp: new Date() }
        );
      }

      // Retrieve audit log
      const auditLog = await permissionService.getAuditLog({
        resource: 'audit-test-draft',
        startDate: new Date(Date.now() - 60000), // Last minute
        endDate: new Date()
      });

      expect(auditLog).toHaveLength(operations.length);

      // Verify each operation was logged
      for (let i = 0; i < operations.length; i++) {
        const logEntry = auditLog[i];
        const operation = operations[i];

        expect(logEntry.userId).toBe(operation.user.id);
        expect(logEntry.action).toBe(operation.action);
        expect(logEntry.resource).toBe(operation.resource);
        expect(logEntry.success).toBe(true);
      }
    });

    it('应该记录权限拒绝事件', async () => {
      // Create draft with restricted permissions
      const restrictedDraft: PRDDraft = {
        id: 'restricted-draft',
        title: '受限文档',
        description: '仅限架构师访问',
        content: { overview: '受限内容' },
        templateId: 'basic',
        author: testUsers.architect.id,
        status: 'draft',
        version: '1.0.0',
        tags: [],
        permissions: {
          read: ['architect'],
          write: ['architect'],
          review: ['architect']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(restrictedDraft);

      // Attempt unauthorized access
      try {
        await documentService.getDraft('restricted-draft', testUsers.viewer.id);
        expect.fail('Viewer should not have access to restricted draft');
      } catch (error) {
        // Permission denied should be logged
        const auditLog = await permissionService.getAuditLog({
          resource: 'restricted-draft',
          userId: testUsers.viewer.id,
          success: false
        });

        expect(auditLog.length).toBeGreaterThan(0);
        const deniedEntry = auditLog[0];
        expect(deniedEntry.success).toBe(false);
        expect(deniedEntry.action).toBe('read_draft');
      }
    });

    it('应该生成权限使用统计报告', async () => {
      // Perform various operations
      const testOperations = [
        { user: testUsers.architect, action: 'create_draft', count: 3 },
        { user: testUsers.productManager, action: 'read_draft', count: 5 },
        { user: testUsers.developer, action: 'update_draft', count: 2 },
        { user: testUsers.tester, action: 'read_draft', count: 1 },
        { user: testUsers.viewer, action: 'read_draft', count: 4 }
      ];

      for (const op of testOperations) {
        for (let i = 0; i < op.count; i++) {
          await permissionService.logAuditEvent(
            op.user.id,
            op.action,
            `test-resource-${i}`,
            { success: true, timestamp: new Date() }
          );
        }
      }

      // Generate permission usage statistics
      const stats = await permissionService.getPermissionStatistics({
        startDate: new Date(Date.now() - 60000),
        endDate: new Date()
      });

      expect(stats.totalOperations).toBe(15); // Sum of all operations

      // Check user activity
      for (const op of testOperations) {
        const userStats = stats.userActivity.find(u => u.userId === op.user.id);
        expect(userStats).toBeDefined();
        expect(userStats!.operationCount).toBe(op.count);
      }

      // Check action distribution
      expect(stats.actionDistribution['read_draft']).toBe(10); // 5 + 1 + 4
      expect(stats.actionDistribution['create_draft']).toBe(3);
      expect(stats.actionDistribution['update_draft']).toBe(2);
    });
  });

  describe('API and CLI Integration', () => {
    it('应该在 API 端点中正确应用权限检查', async () => {
      // Create test draft
      const apiTestDraft: PRDDraft = {
        id: 'api-permission-test',
        title: 'API 权限测试',
        description: 'API 权限控制测试文档',
        content: { overview: 'API 测试内容' },
        templateId: 'basic',
        author: testUsers.architect.id,
        status: 'draft',
        version: '1.0.0',
        tags: [],
        permissions: {
          read: ['architect', 'product_manager'],
          write: ['architect'],
          review: ['product_manager']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(apiTestDraft);

      // Test API permissions for different users
      const apiTests = [
        {
          user: testUsers.architect,
          operations: {
            read: true,
            write: true,
            delete: true
          }
        },
        {
          user: testUsers.productManager,
          operations: {
            read: true,
            write: false,
            delete: false
          }
        },
        {
          user: testUsers.developer,
          operations: {
            read: false,
            write: false,
            delete: false
          }
        }
      ];

      for (const test of apiTests) {
        // Test read permission
        const canRead = await permissionService.checkPermission(
          test.user.id,
          'read',
          'document',
          'api-permission-test'
        );
        expect(canRead).toBe(test.operations.read);

        // Test write permission
        const canWrite = await permissionService.checkPermission(
          test.user.id,
          'write',
          'document',
          'api-permission-test'
        );
        expect(canWrite).toBe(test.operations.write);

        // Test delete permission
        const canDelete = await permissionService.checkPermission(
          test.user.id,
          'delete',
          'document',
          'api-permission-test'
        );
        expect(canDelete).toBe(test.operations.delete);
      }
    });

    it('应该在 CLI 命令中正确应用权限检查', async () => {
      // Test CLI permissions
      const cliTests = [
        {
          user: testUsers.architect,
          commands: {
            'prd create': true,
            'prd list': true,
            'prd edit': true,
            'prd delete': true,
            'prd review submit': true
          }
        },
        {
          user: testUsers.viewer,
          commands: {
            'prd create': false,
            'prd list': true,
            'prd edit': false,
            'prd delete': false,
            'prd review submit': false
          }
        }
      ];

      for (const test of cliTests) {
        for (const [command, expectedPermission] of Object.entries(test.commands)) {
          const hasPermission = await permissionService.checkCommandPermission(
            test.user.id,
            command
          );
          expect(hasPermission).toBe(expectedPermission);
        }
      }
    });

    it('应该提供权限中间件集成', async () => {
      // Test permission middleware functionality
      const middleware = permissionService.createPermissionMiddleware();

      // Mock request context
      const mockRequest = {
        user: { id: testUsers.productManager.id, role: 'product_manager' },
        params: { id: 'permission-draft' },
        method: 'GET'
      };

      const mockResponse = {
        status: (code: number) => ({
          json: (data: any) => ({ statusCode: code, data })
        })
      };

      let nextCalled = false;
      const mockNext = () => { nextCalled = true; };

      // Test authorized request
      await middleware(mockRequest as any, mockResponse as any, mockNext);
      expect(nextCalled).toBe(true);

      // Test unauthorized request
      nextCalled = false;
      mockRequest.user = { id: testUsers.viewer.id, role: 'viewer' };
      mockRequest.method = 'PUT'; // Write operation

      await middleware(mockRequest as any, mockResponse as any, mockNext);
      expect(nextCalled).toBe(false); // Should be blocked
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('应该处理无效用户和角色', async () => {
      // Test with non-existent user
      const hasPermission = await permissionService.checkPermission(
        'non-existent-user',
        'read',
        'document',
        'permission-draft'
      );
      expect(hasPermission).toBe(false);

      // Test with invalid role
      try {
        await permissionService.initializeUserPermissions('invalid-user', 'invalid-role' as any);
        expect.fail('Should reject invalid role');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('应该处理权限配置冲突', async () => {
      // Create draft with conflicting permissions
      const conflictDraft: PRDDraft = {
        id: 'conflict-draft',
        title: '冲突权限测试',
        description: '测试权限配置冲突处理',
        content: { overview: '冲突测试' },
        templateId: 'basic',
        author: testUsers.architect.id,
        status: 'draft',
        version: '1.0.0',
        tags: [],
        permissions: {
          read: [], // Empty read permissions
          write: ['architect'], // But write permissions exist
          review: ['product_manager']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(conflictDraft);

      // System should handle conflict gracefully
      const canRead = await permissionService.checkPermission(
        testUsers.architect.id,
        'read',
        'document',
        'conflict-draft'
      );

      const canWrite = await permissionService.checkPermission(
        testUsers.architect.id,
        'write',
        'document',
        'conflict-draft'
      );

      // Write permission should imply read permission
      if (canWrite) {
        expect(canRead).toBe(true);
      }
    });

    it('应该正确处理继承权限', async () => {
      // Test template permission inheritance
      const inheritanceTemplate: Template = {
        id: 'inheritance-template',
        name: '继承权限模板',
        description: '测试权限继承',
        category: 'test',
        sections: [{
          id: 'section1',
          title: '章节1',
          type: 'text',
          required: true,
          content: '内容',
          permissions: {
            read: ['architect', 'product_manager'],
            write: ['architect']
          }
        }],
        metadata: {
          version: '1.0.0',
          author: 'test',
          tags: []
        },
        permissions: {
          read: ['architect', 'product_manager', 'developer'],
          write: ['architect', 'product_manager']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await templateService.createTemplate(inheritanceTemplate);

      const inheritanceDraft: PRDDraft = {
        id: 'inheritance-draft',
        title: '继承权限文档',
        description: '测试权限继承',
        content: { section1: '内容' },
        templateId: 'inheritance-template',
        author: testUsers.architect.id,
        status: 'draft',
        version: '1.0.0',
        tags: [],
        // No explicit permissions - should inherit from template
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(inheritanceDraft);

      // Test inherited permissions
      const developerCanReadDraft = await permissionService.checkPermission(
        testUsers.developer.id,
        'read',
        'document',
        'inheritance-draft'
      );
      expect(developerCanReadDraft).toBe(true); // Should inherit from template

      const developerCanReadSection = await permissionService.checkSectionPermission(
        testUsers.developer.id,
        'read',
        'inheritance-draft',
        'section1'
      );
      expect(developerCanReadSection).toBe(false); // Section has more restrictive permissions
    });
  });
});