/**
 * PRD CLI Handlers 单元测试
 *
 * 测试范围：
 * - 草稿管理命令处理器
 * - 审查管理命令处理器
 * - 版本管理命令处理器
 * - 模板和工具命令处理器
 * - 交互式用户输入处理
 * - 权限验证和错误处理
 * - 文件操作和外部编辑器集成
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import inquirer from 'inquirer';
import {
  createDraftCommand,
  listDraftsCommand,
  showDraftCommand,
  editDraftCommand,
  deleteDraftCommand,
  submitReviewCommand,
  reviewStatusCommand,
  reviewRespondCommand,
  listVersionsCommand,
  showVersionCommand,
  restoreVersionCommand,
  diffVersionsCommand,
  listTemplatesCommand,
  showTemplateCommand,
  exportDraftCommand,
  searchCommand
} from '../../../src/cli/prd-handlers.js';
import type {
  PRDCommandContext,
  PRDCommandResult
} from '../../../src/cli/prd-commands.js';
import type { PRDDraft } from '../../../src/models/prd-draft.js';
import type { Version } from '../../../src/models/version.js';
import type { Template } from '../../../src/models/template.js';

// Mock 所有依赖项
vi.mock('fs');
vi.mock('child_process');
vi.mock('inquirer');
vi.mock('../../../src/services/document-service.js');
vi.mock('../../../src/services/template-service.js');
vi.mock('../../../src/services/permission-service.js');
vi.mock('../../../src/services/version-service.js');
vi.mock('../../../src/services/diagram-service.js');

const mockReadFileSync = readFileSync as MockedFunction<typeof readFileSync>;
const mockWriteFileSync = writeFileSync as MockedFunction<typeof writeFileSync>;
const mockExistsSync = existsSync as MockedFunction<typeof existsSync>;
const mockSpawn = spawn as MockedFunction<typeof spawn>;
const mockInquirer = inquirer as any;

describe('PRD CLI Handlers', () => {
  let mockContext: PRDCommandContext;
  let mockSpinner: any;
  let mockServices: any;

  beforeEach(() => {
    // 清理所有模拟
    vi.clearAllMocks();

    // 设置 spinner mock
    mockSpinner = {
      text: '',
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis()
    };

    // 设置测试上下文
    mockContext = {
      args: [],
      options: {},
      workingDirectory: '/test/workspace',
      userConfig: {
        outputFormat: 'table' as const,
        editor: 'vim',
        defaultTemplate: 'basic',
        defaultAuthor: 'test-user',
        permissions: {
          role: 'developer',
          defaultPermissions: ['read', 'write']
        },
        preferences: {
          autoSave: true,
          confirmDelete: true,
          showProgress: true,
          colorOutput: true
        },
        templates: {}
      },
      spinner: mockSpinner
    };

    // Mock 服务
    mockServices = {
      documentService: {
        createDraft: vi.fn(),
        listDrafts: vi.fn(),
        getDraft: vi.fn(),
        updateDraft: vi.fn(),
        deleteDraft: vi.fn(),
        searchDrafts: vi.fn()
      },
      templateService: {
        listTemplates: vi.fn(),
        getTemplate: vi.fn()
      },
      permissionService: {
        canCreateDraft: vi.fn().mockResolvedValue(true),
        canReadDraft: vi.fn().mockResolvedValue(true),
        canEditDraft: vi.fn().mockResolvedValue(true),
        canDeleteDraft: vi.fn().mockResolvedValue(true),
        canSubmitForReview: vi.fn().mockResolvedValue(true),
        canViewReview: vi.fn().mockResolvedValue(true),
        canReview: vi.fn().mockResolvedValue(true)
      },
      versionService: {
        listVersions: vi.fn(),
        getVersion: vi.fn(),
        createVersion: vi.fn(),
        restoreVersion: vi.fn(),
        compareVersions: vi.fn()
      },
      diagramService: {}
    };

    // Mock inquirer
    mockInquirer.prompt = vi.fn();
  });

  describe('Draft Management Commands', () => {
    describe('createDraftCommand', () => {
      it('should create draft with command line arguments', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          description: 'Test description',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.createDraft.mockResolvedValue(mockDraft);
        mockContext.args = ['Test Draft'];
        mockContext.options = {
          template: 'basic',
          description: 'Test description',
          author: 'test-user'
        };

        const result = await createDraftCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('成功创建 PRD 草稿');
        expect(mockServices.documentService.createDraft).toHaveBeenCalledWith({
          title: 'Test Draft',
          template: 'basic',
          description: 'Test description',
          author: 'test-user'
        });
      });

      it('should create draft with interactive mode', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-2',
          title: 'Interactive Draft',
          description: 'Interactive description',
          author: 'test-user',
          status: 'draft',
          template: 'feature',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockInquirer.prompt.mockResolvedValue({
          title: 'Interactive Draft',
          template: 'feature',
          description: 'Interactive description'
        });

        mockServices.documentService.createDraft.mockResolvedValue(mockDraft);
        mockContext.options = { interactive: true };

        const result = await createDraftCommand(mockContext);

        expect(result.success).toBe(true);
        expect(mockInquirer.prompt).toHaveBeenCalled();
        expect(mockServices.documentService.createDraft).toHaveBeenCalledWith({
          title: 'Interactive Draft',
          template: 'feature',
          description: 'Interactive description',
          author: 'test-user'
        });
      });

      it('should handle permission denied', async () => {
        mockServices.permissionService.canCreateDraft.mockResolvedValue(false);

        const result = await createDraftCommand(mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('没有创建草稿的权限');
        expect(result.exitCode).toBe(1);
      });

      it('should handle creation errors', async () => {
        mockServices.documentService.createDraft.mockRejectedValue(
          new Error('Creation failed')
        );

        mockContext.args = ['Test Draft'];

        const result = await createDraftCommand(mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('创建草稿失败');
        expect(result.error?.message).toBe('Creation failed');
      });
    });

    describe('listDraftsCommand', () => {
      it('should list drafts with default options', async () => {
        const mockDrafts: PRDDraft[] = [
          {
            id: 'draft-1',
            title: 'Draft 1',
            author: 'user1',
            status: 'draft',
            template: 'basic',
            content: {},
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            version: '1.0.0'
          },
          {
            id: 'draft-2',
            title: 'Draft 2',
            author: 'user2',
            status: 'in_review',
            template: 'feature',
            content: {},
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            version: '1.1.0'
          }
        ];

        mockServices.documentService.listDrafts.mockResolvedValue(mockDrafts);

        const result = await listDraftsCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('找到 2 个 PRD 草稿');
        expect(result.data).toHaveLength(2);
      });

      it('should list drafts with filters', async () => {
        mockContext.options = {
          status: 'draft',
          author: 'test-user',
          sort: 'title',
          order: 'asc',
          limit: 10
        };

        mockServices.documentService.listDrafts.mockResolvedValue([]);

        const result = await listDraftsCommand(mockContext);

        expect(mockServices.documentService.listDrafts).toHaveBeenCalledWith({
          status: 'draft',
          author: 'test-user',
          template: undefined,
          search: undefined,
          sort: 'title',
          order: 'asc',
          limit: 10
        });
      });
    });

    describe('showDraftCommand', () => {
      it('should show draft details', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {
            introduction: 'Test introduction',
            requirements: 'Test requirements'
          },
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockContext.args = ['draft-1'];

        const result = await showDraftCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('草稿详情: Test Draft');
        expect(result.data).toBeDefined();
      });

      it('should handle missing draft ID', async () => {
        mockContext.args = [];

        const result = await showDraftCommand(mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('请指定草稿 ID');
      });

      it('should handle draft not found', async () => {
        mockServices.documentService.getDraft.mockResolvedValue(null);
        mockContext.args = ['nonexistent'];

        const result = await showDraftCommand(mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('未找到草稿');
      });

      it('should handle permission denied', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'other-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockServices.permissionService.canReadDraft.mockResolvedValue(false);
        mockContext.args = ['draft-1'];

        const result = await showDraftCommand(mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('没有阅读此草稿的权限');
      });

      it('should filter by section', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {
            introduction: 'Test introduction',
            requirements: 'Test requirements'
          },
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockContext.args = ['draft-1'];
        mockContext.options = { section: 'introduction' };

        const result = await showDraftCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.data.section).toBe('introduction');
        expect(result.data.content).toBe('Test introduction');
      });
    });

    describe('editDraftCommand', () => {
      it('should edit draft with external editor', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {
            introduction: 'Original content'
          },
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        const updatedDraft = {
          ...mockDraft,
          content: {
            introduction: 'Updated content'
          }
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockServices.documentService.updateDraft.mockResolvedValue(updatedDraft);
        mockExistsSync.mockReturnValue(true);
        mockReadFileSync.mockReturnValue('Updated content');

        // Mock spawn 进程
        const mockProcess = {
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'close') {
              setTimeout(() => callback(0), 10);
            }
          })
        };
        mockSpawn.mockReturnValue(mockProcess as any);

        mockContext.args = ['draft-1'];
        mockContext.options = { section: 'introduction' };

        const result = await editDraftCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('成功更新草稿');
        expect(mockSpawn).toHaveBeenCalledWith('vim', [expect.stringContaining('.prd-edit-draft-1.md')], {
          stdio: 'inherit'
        });
      });

      it('should handle editor errors', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);

        // Mock spawn 进程错误
        const mockProcess = {
          on: vi.fn().mockImplementation((event, callback) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('Editor failed')), 10);
            }
          })
        };
        mockSpawn.mockReturnValue(mockProcess as any);

        mockContext.args = ['draft-1'];

        const result = await editDraftCommand(mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('编辑草稿失败');
      });
    });

    describe('deleteDraftCommand', () => {
      it('should delete draft with confirmation', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockInquirer.prompt.mockResolvedValue({ delete: true });

        mockContext.args = ['draft-1'];

        const result = await deleteDraftCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('成功删除草稿');
        expect(mockServices.documentService.deleteDraft).toHaveBeenCalledWith('draft-1');
      });

      it('should archive instead of delete', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        const archivedDraft = { ...mockDraft, status: 'archived' as const };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockServices.documentService.updateDraft.mockResolvedValue(archivedDraft);

        mockContext.args = ['draft-1'];
        mockContext.options = { archive: true };

        const result = await deleteDraftCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('成功归档草稿');
        expect(mockServices.documentService.updateDraft).toHaveBeenCalledWith(
          'draft-1',
          { status: 'archived' },
          'user'
        );
      });

      it('should skip confirmation with force flag', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);

        mockContext.args = ['draft-1'];
        mockContext.options = { force: true };

        const result = await deleteDraftCommand(mockContext);

        expect(result.success).toBe(true);
        expect(mockInquirer.prompt).not.toHaveBeenCalled();
      });
    });
  });

  describe('Review Management Commands', () => {
    describe('submitReviewCommand', () => {
      it('should submit review request', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        const updatedDraft = {
          ...mockDraft,
          status: 'in_review' as const,
          reviewers: ['reviewer1', 'reviewer2']
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockServices.documentService.updateDraft.mockResolvedValue(updatedDraft);

        mockContext.args = ['draft-1'];
        mockContext.options = {
          reviewers: ['reviewer1', 'reviewer2'],
          priority: 'high',
          message: 'Please review ASAP'
        };

        const result = await submitReviewCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('成功提交审查请求');
        expect(result.data.reviewers).toEqual(['reviewer1', 'reviewer2']);
      });

      it('should handle interactive review submission', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockServices.documentService.updateDraft.mockResolvedValue({
          ...mockDraft,
          status: 'in_review' as const
        });

        mockInquirer.prompt.mockResolvedValue({
          reviewers: 'reviewer1, reviewer2',
          priority: 'medium',
          dueDate: '2024-12-31',
          message: 'Please review'
        });

        mockContext.args = ['draft-1'];
        mockContext.options = { interactive: true };

        const result = await submitReviewCommand(mockContext);

        expect(result.success).toBe(true);
        expect(mockInquirer.prompt).toHaveBeenCalled();
      });
    });

    describe('reviewStatusCommand', () => {
      it('should show review status', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'in_review',
          template: 'basic',
          content: {},
          reviewers: ['reviewer1', 'reviewer2'],
          reviewMetadata: {
            submittedBy: 'test-user',
            submittedAt: new Date(),
            priority: 'medium',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          },
          reviewHistory: [
            {
              reviewer: 'reviewer1',
              decision: 'approve',
              reviewedAt: new Date(),
              reviewId: 'review-1'
            }
          ],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);

        mockContext.args = ['draft-1'];

        const result = await reviewStatusCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('审查状态');
        expect(result.data.status).toBe('in_review');
        expect(result.data.reviewers).toEqual(['reviewer1', 'reviewer2']);
      });

      it('should format timeline view', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'in_review',
          template: 'basic',
          content: {},
          reviewers: ['reviewer1'],
          reviewHistory: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);

        mockContext.args = ['draft-1'];
        mockContext.options = { format: 'timeline' };

        const result = await reviewStatusCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('timeline');
      });
    });

    describe('reviewRespondCommand', () => {
      it('should respond to review request', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'in_review',
          template: 'basic',
          content: {},
          reviewers: ['user'],
          reviewHistory: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        const updatedDraft = {
          ...mockDraft,
          reviewHistory: [
            {
              reviewer: 'user',
              decision: 'approve',
              comment: 'Looks good',
              reviewedAt: new Date(),
              reviewId: 'review-1'
            }
          ]
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockServices.documentService.updateDraft.mockResolvedValue(updatedDraft);

        mockContext.args = ['draft-1'];
        mockContext.options = {
          decision: 'approve',
          comment: 'Looks good'
        };

        const result = await reviewRespondCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('成功提交审查意见');
        expect(result.data.decision).toBe('approve');
      });

      it('should handle non-reviewer access', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'in_review',
          template: 'basic',
          content: {},
          reviewers: ['other-user'], // 当前用户不在审查员列表中
          reviewHistory: [],
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);

        mockContext.args = ['draft-1'];
        mockContext.options = { decision: 'approve' };

        const result = await reviewRespondCommand(mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('您不是此草稿的指定审查员');
      });
    });
  });

  describe('Version Management Commands', () => {
    describe('listVersionsCommand', () => {
      it('should list versions', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        const mockVersions: Version[] = [
          {
            id: 'version-1',
            draftId: 'draft-1',
            version: '1.0.0',
            description: 'Initial version',
            author: 'test-user',
            created: new Date().toISOString(),
            changes: [],
            snapshot: {}
          },
          {
            id: 'version-2',
            draftId: 'draft-1',
            version: '1.1.0',
            description: 'Updated version',
            author: 'test-user',
            created: new Date().toISOString(),
            changes: [],
            snapshot: {}
          }
        ];

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockServices.versionService.listVersions.mockResolvedValue(mockVersions);

        mockContext.args = ['draft-1'];

        const result = await listVersionsCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('找到 2 个版本');
        expect(result.data).toHaveLength(2);
      });

      it('should format detailed version list', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        const mockVersions: Version[] = [
          {
            id: 'version-1',
            draftId: 'draft-1',
            version: '1.0.0',
            description: 'Initial version',
            author: 'test-user',
            created: new Date().toISOString(),
            changes: [
              {
                type: 'content_update',
                section: 'introduction',
                oldValue: '',
                newValue: 'New content',
                description: 'Added introduction',
                author: 'test-user'
              }
            ],
            snapshot: {}
          }
        ];

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockServices.versionService.listVersions.mockResolvedValue(mockVersions);

        mockContext.args = ['draft-1'];
        mockContext.options = { format: 'detailed' };

        const result = await listVersionsCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.data[0]).toHaveProperty('changesSummary');
      });
    });

    describe('restoreVersionCommand', () => {
      it('should restore version with confirmation', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.1.0'
        };

        const mockVersion: Version = {
          id: 'version-1',
          draftId: 'draft-1',
          version: '1.0.0',
          description: 'Initial version',
          author: 'test-user',
          created: new Date().toISOString(),
          changes: [],
          snapshot: {}
        };

        const restoredDraft = { ...mockDraft, version: '1.0.0' };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockServices.versionService.getVersion.mockResolvedValue(mockVersion);
        mockServices.versionService.restoreVersion.mockResolvedValue(restoredDraft);
        mockInquirer.prompt.mockResolvedValue({ restore: true });

        mockContext.args = ['draft-1', 'version-1'];

        const result = await restoreVersionCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('成功恢复到版本 1.0.0');
        expect(mockInquirer.prompt).toHaveBeenCalled();
      });

      it('should skip confirmation with force flag', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.1.0'
        };

        const mockVersion: Version = {
          id: 'version-1',
          draftId: 'draft-1',
          version: '1.0.0',
          description: 'Initial version',
          author: 'test-user',
          created: new Date().toISOString(),
          changes: [],
          snapshot: {}
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);
        mockServices.versionService.getVersion.mockResolvedValue(mockVersion);
        mockServices.versionService.restoreVersion.mockResolvedValue(mockDraft);

        mockContext.args = ['draft-1', 'version-1'];
        mockContext.options = { force: true };

        const result = await restoreVersionCommand(mockContext);

        expect(result.success).toBe(true);
        expect(mockInquirer.prompt).not.toHaveBeenCalled();
      });
    });

    describe('diffVersionsCommand', () => {
      it('should compare versions', async () => {
        const mockComparison = {
          version1: '1.0.0',
          version2: '1.1.0',
          changes: [
            {
              type: 'modification',
              section: 'introduction',
              oldValue: 'Old content',
              newValue: 'New content',
              description: 'Updated introduction'
            }
          ]
        };

        mockServices.versionService.compareVersions.mockResolvedValue(mockComparison);

        mockContext.args = ['draft-1', 'version-1', 'version-2'];

        const result = await diffVersionsCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('版本比较');
        expect(result.data.changes).toHaveLength(1);
      });

      it('should show summary format', async () => {
        const mockComparison = {
          version1: '1.0.0',
          version2: '1.1.0',
          changes: [
            { type: 'addition', section: 'new-section' },
            { type: 'modification', section: 'intro' },
            { type: 'deletion', section: 'old-section' }
          ]
        };

        mockServices.versionService.compareVersions.mockResolvedValue(mockComparison);

        mockContext.args = ['draft-1', 'version-1', 'version-2'];
        mockContext.options = { format: 'summary' };

        const result = await diffVersionsCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.data.addedSections).toBe(1);
        expect(result.data.modifiedSections).toBe(1);
        expect(result.data.deletedSections).toBe(1);
      });
    });
  });

  describe('Template and Utility Commands', () => {
    describe('listTemplatesCommand', () => {
      it('should list templates', async () => {
        const mockTemplates: Template[] = [
          {
            id: 'template-1',
            name: 'Basic Template',
            description: 'Basic PRD template',
            category: 'basic',
            content: '',
            variables: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            author: 'system'
          },
          {
            id: 'template-2',
            name: 'Feature Template',
            description: 'Feature PRD template',
            category: 'feature',
            content: '',
            variables: [],
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            author: 'system'
          }
        ];

        mockServices.templateService.listTemplates.mockResolvedValue(mockTemplates);

        const result = await listTemplatesCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('找到 2 个模板');
        expect(result.data).toHaveLength(2);
      });

      it('should filter templates by category', async () => {
        mockServices.templateService.listTemplates.mockResolvedValue([]);

        mockContext.options = { category: 'feature' };

        const result = await listTemplatesCommand(mockContext);

        expect(mockServices.templateService.listTemplates).toHaveBeenCalledWith({
          category: 'feature'
        });
      });
    });

    describe('exportDraftCommand', () => {
      it('should export draft as markdown', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          description: 'Test description',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {
            introduction: 'Test introduction',
            requirements: 'Test requirements'
          },
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);

        mockContext.args = ['draft-1'];
        mockContext.options = { format: 'markdown', output: 'test-export.md' };

        const result = await exportDraftCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('成功导出到');
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          expect.stringContaining('test-export.md'),
          expect.stringContaining('# Test Draft'),
          'utf-8'
        );
      });

      it('should export draft as HTML', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          description: 'Test description',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {
            introduction: 'Test introduction'
          },
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);

        mockContext.args = ['draft-1'];
        mockContext.options = { format: 'html' };

        const result = await exportDraftCommand(mockContext);

        expect(result.success).toBe(true);
        expect(mockWriteFileSync).toHaveBeenCalledWith(
          expect.anything(),
          expect.stringContaining('<html'),
          'utf-8'
        );
      });

      it('should handle unsupported formats', async () => {
        const mockDraft: PRDDraft = {
          id: 'draft-1',
          title: 'Test Draft',
          author: 'test-user',
          status: 'draft',
          template: 'basic',
          content: {},
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          version: '1.0.0'
        };

        mockServices.documentService.getDraft.mockResolvedValue(mockDraft);

        mockContext.args = ['draft-1'];
        mockContext.options = { format: 'unsupported' };

        const result = await exportDraftCommand(mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('不支持的导出格式');
      });
    });

    describe('searchCommand', () => {
      it('should search drafts', async () => {
        const mockResults: any[] = [
          {
            id: 'draft-1',
            title: 'Matching Draft',
            author: 'test-user',
            status: 'draft',
            updated: new Date().toISOString(),
            relevanceScore: 0.9,
            matchHighlight: 'test <mark>keyword</mark>'
          }
        ];

        mockServices.documentService.searchDrafts.mockResolvedValue(mockResults);

        mockContext.args = ['keyword'];
        mockContext.options = {
          scope: 'all',
          limit: 10
        };

        const result = await searchCommand(mockContext);

        expect(result.success).toBe(true);
        expect(result.message).toContain('找到 1 个匹配结果');
        expect(result.data).toHaveLength(1);
        expect(mockServices.documentService.searchDrafts).toHaveBeenCalledWith({
          query: 'keyword',
          scope: 'all',
          author: undefined,
          status: undefined,
          limit: 10
        });
      });

      it('should handle missing search query', async () => {
        mockContext.args = [];

        const result = await searchCommand(mockContext);

        expect(result.success).toBe(false);
        expect(result.message).toContain('请指定搜索关键词');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle service initialization errors', async () => {
      // 模拟服务初始化失败
      mockServices.documentService.createDraft.mockRejectedValue(
        new Error('Service unavailable')
      );

      mockContext.args = ['Test Draft'];

      const result = await createDraftCommand(mockContext);

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Service unavailable');
    });

    it('should handle network timeout errors', async () => {
      // 模拟网络超时
      mockServices.documentService.listDrafts.mockRejectedValue(
        new Error('Request timeout')
      );

      const result = await listDraftsCommand(mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('获取草稿列表失败');
    });

    it('should handle invalid user input', async () => {
      mockInquirer.prompt.mockRejectedValue(new Error('Invalid input'));

      mockContext.options = { interactive: true };

      const result = await createDraftCommand(mockContext);

      expect(result.success).toBe(false);
    });

    it('should handle file system errors', async () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Disk full');
      });

      const mockDraft: PRDDraft = {
        id: 'draft-1',
        title: 'Test Draft',
        author: 'test-user',
        status: 'draft',
        template: 'basic',
        content: {},
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: '1.0.0'
      };

      mockServices.documentService.getDraft.mockResolvedValue(mockDraft);

      mockContext.args = ['draft-1'];

      const result = await exportDraftCommand(mockContext);

      expect(result.success).toBe(false);
      expect(result.message).toContain('导出失败');
    });
  });

  describe('Performance Tests', () => {
    it('should handle large draft lists efficiently', async () => {
      const largeDraftList = Array.from({ length: 1000 }, (_, i) => ({
        id: `draft-${i}`,
        title: `Draft ${i}`,
        author: 'test-user',
        status: 'draft' as const,
        template: 'basic',
        content: {},
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: '1.0.0'
      }));

      mockServices.documentService.listDrafts.mockResolvedValue(largeDraftList);

      const startTime = Date.now();
      const result = await listDraftsCommand(mockContext);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // 应该在 1 秒内完成
    });

    it('should handle concurrent command executions', async () => {
      mockServices.documentService.getDraft.mockResolvedValue({
        id: 'draft-1',
        title: 'Test Draft',
        author: 'test-user',
        status: 'draft',
        template: 'basic',
        content: {},
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: '1.0.0'
      });

      // 并发执行多个命令
      const promises = Array.from({ length: 10 }, () =>
        showDraftCommand({ ...mockContext, args: ['draft-1'] })
      );

      const results = await Promise.all(promises);

      expect(results.every(result => result.success)).toBe(true);
      expect(mockServices.documentService.getDraft).toHaveBeenCalledTimes(10);
    });
  });
});