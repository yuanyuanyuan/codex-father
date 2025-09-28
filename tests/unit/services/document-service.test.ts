/**
 * DocumentService 单元测试
 *
 * 测试范围：
 * - CRUD 操作 (创建、读取、更新、删除)
 * - 模板集成 (应用模板、内容验证)
 * - 搜索和组织功能
 * - 元数据和统计信息管理
 * - 权限验证和错误处理
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import {
  FileSystemDocumentService,
  type DocumentService,
  type CreateDraftRequest,
  type UpdateDraftRequest,
  type DraftFilter,
  type SearchQuery,
  type OrganizationCriteria
} from '../../../src/services/document-service.js';
import { type PRDDraft } from '../../../src/models/prd-draft.js';
import { type Template } from '../../../src/models/template.js';

describe('DocumentService', () => {
  let documentService: DocumentService;
  let mockTemplateService: any;
  let mockPermissionService: any;
  let mockVersionService: any;

  beforeEach(() => {
    // 创建模拟服务
    mockTemplateService = {
      getTemplate: vi.fn()
    };

    mockPermissionService = {
      canRead: vi.fn().mockResolvedValue(true),
      canEdit: vi.fn().mockResolvedValue(true),
      canDelete: vi.fn().mockResolvedValue(true)
    };

    mockVersionService = {
      createVersion: vi.fn().mockResolvedValue({
        id: 'version_123',
        draftId: 'draft_123',
        versionNumber: 2,
        changeType: 'updated',
        changes: [],
        contentSnapshot: 'updated content',
        metadata: {
          author: 'user1',
          timestamp: new Date(),
          message: 'Test version',
          checksum: 'abc123',
          compressed: false,
          size: 100
        }
      })
    };

    // 创建服务实例
    documentService = new FileSystemDocumentService(
      './test-data/drafts',
      mockTemplateService,
      mockPermissionService,
      mockVersionService
    );
  });

  describe('CRUD Operations', () => {
    describe('createDraft', () => {
      it('should create a draft with minimal data', async () => {
        const request: CreateDraftRequest = {
          title: 'Test PRD'
        };

        const draft = await documentService.createDraft(request);

        expect(draft).toBeDefined();
        expect(draft.id).toMatch(/^draft_\d+_\d+$/);
        expect(draft.title).toBe('Test PRD');
        expect(draft.content).toBe('');
        expect(draft.metadata.status).toBe('draft');
        expect(draft.permissions.owner).toBe('system');
        expect(draft.versions).toHaveLength(1);
        expect(draft.versions[0].versionNumber).toBe(1);
        expect(draft.statistics.wordCount).toBe(0);
        expect(draft.statistics.versionCount).toBe(1);
      });

      it('should create a draft with full data', async () => {
        const request: CreateDraftRequest = {
          title: 'Complete Test PRD',
          initialContent: '# Test Content\n\nThis is a test.',
          metadata: {
            description: 'Test description',
            priority: 'high',
            category: 'feature',
            tags: ['test', 'feature']
          },
          permissions: {
            owner: 'user1',
            collaborators: ['user2'],
            viewers: ['user3']
          }
        };

        const draft = await documentService.createDraft(request);

        expect(draft.title).toBe('Complete Test PRD');
        expect(draft.content).toBe('# Test Content\n\nThis is a test.');
        expect(draft.metadata.description).toBe('Test description');
        expect(draft.metadata.priority).toBe('high');
        expect(draft.metadata.category).toBe('feature');
        expect(draft.metadata.tags).toEqual(['test', 'feature']);
        expect(draft.permissions.owner).toBe('user1');
        expect(draft.permissions.collaborators).toEqual(['user2']);
        expect(draft.permissions.viewers).toEqual(['user3']);
        expect(draft.statistics.wordCount).toBe(6); // "Test", "Content", "This", "is", "a", "test"
        expect(draft.statistics.sectionCount).toBe(1); // 一个 h1 标题
      });

      it('should apply template when templateId is provided', async () => {
        const mockTemplate: Template = {
          id: 'template1',
          name: 'Feature Template',
          description: 'Template for features',
          version: '1.0.0',
          category: 'feature',
          structure: {
            sections: [{
              name: 'Overview',
              description: 'Project overview',
              required: true,
              fields: [],
              subsections: []
            }]
          },
          defaultContent: '# Feature Overview\n\n## Requirements\n\n',
          validationRules: [],
          metadata: {
            author: 'system',
            created: new Date(),
            updated: new Date(),
            tags: ['feature'],
            usage: 0
          }
        };

        mockTemplateService.getTemplate.mockResolvedValue(mockTemplate);

        const request: CreateDraftRequest = {
          title: 'Template Test',
          templateId: 'template1'
        };

        const draft = await documentService.createDraft(request);

        expect(mockTemplateService.getTemplate).toHaveBeenCalledWith('template1');
        expect(draft.template).toEqual(mockTemplate);
      });
    });

    describe('getDraft', () => {
      it('should get an existing draft', async () => {
        // 先创建一个草稿
        const createRequest: CreateDraftRequest = {
          title: 'Test Draft',
          permissions: { owner: 'user1' }
        };
        const createdDraft = await documentService.createDraft(createRequest);

        const draft = await documentService.getDraft(createdDraft.id, 'user1');

        expect(draft).toBeDefined();
        expect(draft!.id).toBe(createdDraft.id);
        expect(draft!.title).toBe('Test Draft');
        expect(draft!.statistics.viewCount).toBe(1); // 访问计数应该增加
      });

      it('should return null for non-existent draft', async () => {
        const draft = await documentService.getDraft('non-existent-id');

        expect(draft).toBeNull();
      });

      it('should check read permissions when userId is provided', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Protected Draft',
          permissions: { owner: 'user1' }
        };
        const createdDraft = await documentService.createDraft(createRequest);

        // 模拟权限拒绝
        mockPermissionService.canRead.mockResolvedValue(false);

        await expect(
          documentService.getDraft(createdDraft.id, 'user2')
        ).rejects.toThrow('Permission denied: Cannot read this draft');

        expect(mockPermissionService.canRead).toHaveBeenCalledWith('user2', createdDraft);
      });
    });

    describe('updateDraft', () => {
      it('should update draft title', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Original Title',
          permissions: { owner: 'user1' }
        };
        const createdDraft = await documentService.createDraft(createRequest);

        const updateRequest: UpdateDraftRequest = {
          title: 'Updated Title'
        };

        const updatedDraft = await documentService.updateDraft(
          createdDraft.id,
          updateRequest,
          'user1'
        );

        expect(updatedDraft.title).toBe('Updated Title');
        expect(updatedDraft.statistics.editCount).toBe(2); // 创建时为1，更新后为2
        expect(updatedDraft.collaboration.activityFeed[0].action).toBe('updated');
        expect(mockVersionService.createVersion).toHaveBeenCalled();
      });

      it('should update draft content and calculate statistics', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Test Draft',
          permissions: { owner: 'user1' }
        };
        const createdDraft = await documentService.createDraft(createRequest);

        const updateRequest: UpdateDraftRequest = {
          content: '# New Content\n\nThis is updated content with more words.'
        };

        const updatedDraft = await documentService.updateDraft(
          createdDraft.id,
          updateRequest,
          'user1'
        );

        expect(updatedDraft.content).toBe('# New Content\n\nThis is updated content with more words.');
        expect(updatedDraft.statistics.wordCount).toBe(10); // 重新计算字数
        expect(updatedDraft.statistics.sectionCount).toBe(1); // 重新计算章节数
      });

      it('should update metadata and permissions', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Test Draft',
          permissions: { owner: 'user1' }
        };
        const createdDraft = await documentService.createDraft(createRequest);

        const updateRequest: UpdateDraftRequest = {
          metadata: {
            priority: 'critical',
            category: 'bug-fix'
          },
          permissions: {
            collaborators: ['user2', 'user3']
          }
        };

        const updatedDraft = await documentService.updateDraft(
          createdDraft.id,
          updateRequest,
          'user1'
        );

        expect(updatedDraft.metadata.priority).toBe('critical');
        expect(updatedDraft.metadata.category).toBe('bug-fix');
        expect(updatedDraft.permissions.collaborators).toEqual(['user2', 'user3']);
      });

      it('should check edit permissions', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Protected Draft',
          permissions: { owner: 'user1' }
        };
        const createdDraft = await documentService.createDraft(createRequest);

        mockPermissionService.canEdit.mockResolvedValue(false);

        const updateRequest: UpdateDraftRequest = {
          title: 'Unauthorized Update'
        };

        await expect(
          documentService.updateDraft(createdDraft.id, updateRequest, 'user2')
        ).rejects.toThrow('Permission denied: Cannot edit this draft');
      });

      it('should throw error for non-existent draft', async () => {
        const updateRequest: UpdateDraftRequest = {
          title: 'Non-existent Update'
        };

        await expect(
          documentService.updateDraft('non-existent-id', updateRequest, 'user1')
        ).rejects.toThrow('Draft not found: non-existent-id');
      });
    });

    describe('deleteDraft', () => {
      it('should delete an existing draft', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'To Delete',
          permissions: { owner: 'user1' }
        };
        const createdDraft = await documentService.createDraft(createRequest);

        const result = await documentService.deleteDraft(createdDraft.id, 'user1');

        expect(result).toBe(true);

        // 验证草稿已删除
        const deletedDraft = await documentService.getDraft(createdDraft.id);
        expect(deletedDraft).toBeNull();
      });

      it('should return false for non-existent draft', async () => {
        const result = await documentService.deleteDraft('non-existent-id', 'user1');

        expect(result).toBe(false);
      });

      it('should check delete permissions', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Protected Draft',
          permissions: { owner: 'user1' }
        };
        const createdDraft = await documentService.createDraft(createRequest);

        mockPermissionService.canDelete.mockResolvedValue(false);

        await expect(
          documentService.deleteDraft(createdDraft.id, 'user2')
        ).rejects.toThrow('Permission denied: Cannot delete this draft');

        expect(mockPermissionService.canDelete).toHaveBeenCalledWith('user2', createdDraft);
      });
    });

    describe('listDrafts', () => {
      beforeEach(async () => {
        // 创建测试数据
        await documentService.createDraft({
          title: 'Draft 1',
          metadata: { priority: 'high', category: 'feature', tags: ['tag1'] },
          permissions: { owner: 'user1' }
        });

        await documentService.createDraft({
          title: 'Draft 2',
          metadata: { priority: 'low', category: 'bug', tags: ['tag2'] },
          permissions: { owner: 'user2' }
        });

        await documentService.createDraft({
          title: 'Draft 3',
          metadata: { priority: 'medium', category: 'feature', tags: ['tag1', 'tag3'] },
          permissions: { owner: 'user1' }
        });
      });

      it('should list all drafts without filter', async () => {
        const drafts = await documentService.listDrafts();

        expect(drafts).toHaveLength(3);
        expect(drafts.map(d => d.title)).toEqual(['Draft 1', 'Draft 2', 'Draft 3']);
      });

      it('should filter by owner', async () => {
        const filter: DraftFilter = { owner: 'user1' };
        const drafts = await documentService.listDrafts(filter);

        expect(drafts).toHaveLength(2);
        expect(drafts.every(d => d.permissions.owner === 'user1')).toBe(true);
      });

      it('should filter by priority', async () => {
        const filter: DraftFilter = { priority: ['high', 'medium'] };
        const drafts = await documentService.listDrafts(filter);

        expect(drafts).toHaveLength(2);
        expect(drafts.every(d => ['high', 'medium'].includes(d.metadata.priority))).toBe(true);
      });

      it('should filter by category', async () => {
        const filter: DraftFilter = { category: 'feature' };
        const drafts = await documentService.listDrafts(filter);

        expect(drafts).toHaveLength(2);
        expect(drafts.every(d => d.metadata.category === 'feature')).toBe(true);
      });

      it('should filter by tags', async () => {
        const filter: DraftFilter = { tags: ['tag1'] };
        const drafts = await documentService.listDrafts(filter);

        expect(drafts).toHaveLength(2);
        expect(drafts.every(d => d.metadata.tags.includes('tag1'))).toBe(true);
      });

      it('should sort by title ascending', async () => {
        const filter: DraftFilter = { sortBy: 'title', sortOrder: 'asc' };
        const drafts = await documentService.listDrafts(filter);

        expect(drafts.map(d => d.title)).toEqual(['Draft 1', 'Draft 2', 'Draft 3']);
      });

      it('should sort by priority descending', async () => {
        const filter: DraftFilter = { sortBy: 'priority', sortOrder: 'desc' };
        const drafts = await documentService.listDrafts(filter);

        // 优先级排序：critical(4) > high(3) > medium(2) > low(1)
        expect(drafts[0].metadata.priority).toBe('high');
        expect(drafts[1].metadata.priority).toBe('medium');
        expect(drafts[2].metadata.priority).toBe('low');
      });

      it('should apply pagination', async () => {
        const filter: DraftFilter = { limit: 2, offset: 1 };
        const drafts = await documentService.listDrafts(filter);

        expect(drafts).toHaveLength(2);
        // 应该跳过第一个，返回第二个和第三个
      });
    });
  });

  describe('Template Integration', () => {
    describe('applyTemplate', () => {
      it('should apply template to existing draft', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Test Draft',
          permissions: { owner: 'user1' }
        };
        const createdDraft = await documentService.createDraft(createRequest);

        const template: Template = {
          id: 'template1',
          name: 'Test Template',
          description: 'Test template',
          version: '1.0.0',
          category: 'test',
          structure: { sections: [] },
          defaultContent: '# Template Content',
          validationRules: [],
          metadata: {
            author: 'system',
            created: new Date(),
            updated: new Date(),
            tags: [],
            usage: 0
          }
        };

        const updatedDraft = await documentService.applyTemplate(
          createdDraft.id,
          template,
          'user1'
        );

        expect(updatedDraft.template).toEqual(template);
        expect(updatedDraft.content).toBe('# Template Content'); // 应用默认内容
        expect(updatedDraft.collaboration.activityFeed[0].action).toBe('template_applied');
      });

      it('should not overwrite existing content', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Test Draft',
          initialContent: 'Existing content',
          permissions: { owner: 'user1' }
        };
        const createdDraft = await documentService.createDraft(createRequest);

        const template: Template = {
          id: 'template1',
          name: 'Test Template',
          description: 'Test template',
          version: '1.0.0',
          category: 'test',
          structure: { sections: [] },
          defaultContent: '# Template Content',
          validationRules: [],
          metadata: {
            author: 'system',
            created: new Date(),
            updated: new Date(),
            tags: [],
            usage: 0
          }
        };

        const updatedDraft = await documentService.applyTemplate(
          createdDraft.id,
          template,
          'user1'
        );

        expect(updatedDraft.content).toBe('Existing content'); // 保持现有内容
      });

      it('should check edit permissions', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Protected Draft',
          permissions: { owner: 'user1' }
        };
        const createdDraft = await documentService.createDraft(createRequest);

        mockPermissionService.canEdit.mockResolvedValue(false);

        const template: Template = {
          id: 'template1',
          name: 'Test Template',
          description: 'Test template',
          version: '1.0.0',
          category: 'test',
          structure: { sections: [] },
          defaultContent: '',
          validationRules: [],
          metadata: {
            author: 'system',
            created: new Date(),
            updated: new Date(),
            tags: [],
            usage: 0
          }
        };

        await expect(
          documentService.applyTemplate(createdDraft.id, template, 'user2')
        ).rejects.toThrow('Permission denied: Cannot apply template to this draft');
      });
    });

    describe('validateContent', () => {
      it('should validate content against template requirements', async () => {
        const template: Template = {
          id: 'template1',
          name: 'Test Template',
          description: 'Test template',
          version: '1.0.0',
          category: 'test',
          structure: {
            sections: [
              {
                name: 'Overview',
                description: 'Required overview section',
                required: true,
                fields: [],
                subsections: []
              },
              {
                name: 'Details',
                description: 'Optional details section',
                required: false,
                fields: [],
                subsections: []
              }
            ]
          },
          defaultContent: '',
          validationRules: [],
          metadata: {
            author: 'system',
            created: new Date(),
            updated: new Date(),
            tags: [],
            usage: 0
          }
        };

        const createRequest: CreateDraftRequest = {
          title: 'Test Draft',
          initialContent: '# Overview\n\nThis is the overview section.\n\n# Details\n\nSome details here.',
          permissions: { owner: 'user1' }
        };
        const draft = await documentService.createDraft(createRequest);
        draft.template = template;

        const result = await documentService.validateContent(draft);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect missing required sections', async () => {
        const template: Template = {
          id: 'template1',
          name: 'Test Template',
          description: 'Test template',
          version: '1.0.0',
          category: 'test',
          structure: {
            sections: [
              {
                name: 'Overview',
                description: 'Required overview section',
                required: true,
                fields: [],
                subsections: []
              }
            ]
          },
          defaultContent: '',
          validationRules: [],
          metadata: {
            author: 'system',
            created: new Date(),
            updated: new Date(),
            tags: [],
            usage: 0
          }
        };

        const createRequest: CreateDraftRequest = {
          title: 'Test Draft',
          initialContent: '# Some Other Section\n\nThis does not include Overview.',
          permissions: { owner: 'user1' }
        };
        const draft = await documentService.createDraft(createRequest);
        draft.template = template;

        const result = await documentService.validateContent(draft);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toBe('Required section missing: Overview');
        expect(result.errors[0].field).toBe('content');
        expect(result.errors[0].severity).toBe('error');
      });

      it('should detect empty title', async () => {
        const createRequest: CreateDraftRequest = {
          title: '',
          permissions: { owner: 'user1' }
        };
        const draft = await documentService.createDraft(createRequest);
        draft.title = ''; // 手动设置为空

        const result = await documentService.validateContent(draft);

        expect(result.isValid).toBe(false);
        expect(result.errors.some(e => e.field === 'title' && e.message === 'Title is required')).toBe(true);
      });

      it('should suggest improvements for brief content', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Brief Draft',
          initialContent: 'Very short content.',
          permissions: { owner: 'user1' }
        };
        const draft = await documentService.createDraft(createRequest);

        const result = await documentService.validateContent(draft);

        expect(result.suggestions.some(s =>
          s.type === 'completeness' &&
          s.message === 'Content seems too brief for a PRD'
        )).toBe(true);
      });

      it('should suggest structure improvements', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Unstructured Draft',
          initialContent: 'This is a very long piece of content without any headers or proper structure. It contains many words but lacks organization and proper formatting. This should trigger the structure suggestion because it has no markdown headers.',
          permissions: { owner: 'user1' }
        };
        const draft = await documentService.createDraft(createRequest);

        const result = await documentService.validateContent(draft);

        expect(result.suggestions.some(s =>
          s.type === 'structure' &&
          s.message === 'Consider adding proper headings and sections'
        )).toBe(true);
      });
    });
  });

  describe('Search and Organization', () => {
    beforeEach(async () => {
      // 创建测试数据
      await documentService.createDraft({
        title: 'User Authentication System',
        initialContent: '# Authentication\n\nThis document describes the user authentication system with login and logout features.',
        metadata: { category: 'security', tags: ['auth', 'login'] },
        permissions: { owner: 'user1' }
      });

      await documentService.createDraft({
        title: 'Payment Gateway Integration',
        initialContent: '# Payment Processing\n\nIntegration with external payment providers for secure transactions.',
        metadata: { category: 'payment', tags: ['gateway', 'transaction'] },
        permissions: { owner: 'user2' }
      });

      await documentService.createDraft({
        title: 'User Profile Management',
        initialContent: '# Profile Features\n\nUser profile creation, editing, and management functionality.',
        metadata: { category: 'user', tags: ['profile', 'user'] },
        permissions: { owner: 'user1' }
      });
    });

    describe('searchDrafts', () => {
      it('should search by title', async () => {
        const query: SearchQuery = {
          text: 'User',
          fields: ['title']
        };

        const results = await documentService.searchDrafts(query);

        expect(results).toHaveLength(2);
        expect(results.every(r => r.draft.title.includes('User'))).toBe(true);
        expect(results[0].score).toBeGreaterThan(0);
      });

      it('should search by content', async () => {
        const query: SearchQuery = {
          text: 'authentication',
          fields: ['content']
        };

        const results = await documentService.searchDrafts(query);

        expect(results).toHaveLength(1);
        expect(results[0].draft.title).toBe('User Authentication System');
      });

      it('should search with fuzzy matching', async () => {
        const query: SearchQuery = {
          text: 'auth login',
          fuzzy: true
        };

        const results = await documentService.searchDrafts(query);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.draft.title.includes('Authentication'))).toBe(true);
      });

      it('should return highlights when requested', async () => {
        const query: SearchQuery = {
          text: 'User',
          highlight: true
        };

        const results = await documentService.searchDrafts(query);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.highlights && r.highlights.length > 0)).toBe(true);
      });

      it('should return all drafts when no search text provided', async () => {
        const query: SearchQuery = {};

        const results = await documentService.searchDrafts(query);

        expect(results).toHaveLength(3);
        expect(results.every(r => r.score === 1)).toBe(true);
      });

      it('should prioritize title matches over content matches', async () => {
        const query: SearchQuery = {
          text: 'User'
        };

        const results = await documentService.searchDrafts(query);

        // 标题匹配的应该排在前面（权重为3）
        expect(results[0].score).toBeGreaterThan(results.find(r =>
          r.draft.title === 'Payment Gateway Integration'
        )?.score || 0);
      });
    });

    describe('organizeDrafts', () => {
      it('should organize by category', async () => {
        const criteria: OrganizationCriteria = {
          groupBy: 'category'
        };

        const result = await documentService.organizeDrafts(criteria);

        expect(result.total).toBe(3);
        expect(result.groups).toHaveLength(3); // security, payment, user

        const securityGroup = result.groups.find(g => g.key === 'security');
        expect(securityGroup).toBeDefined();
        expect(securityGroup!.count).toBe(1);
        expect(securityGroup!.drafts[0].title).toBe('User Authentication System');
      });

      it('should organize by owner', async () => {
        const criteria: OrganizationCriteria = {
          groupBy: 'owner'
        };

        const result = await documentService.organizeDrafts(criteria);

        expect(result.groups).toHaveLength(2); // user1, user2

        const user1Group = result.groups.find(g => g.key === 'user1');
        expect(user1Group).toBeDefined();
        expect(user1Group!.count).toBe(2);
      });

      it('should organize by priority', async () => {
        const criteria: OrganizationCriteria = {
          groupBy: 'priority'
        };

        const result = await documentService.organizeDrafts(criteria);

        expect(result.groups).toHaveLength(1); // 默认都是 medium
        expect(result.groups[0].key).toBe('medium');
        expect(result.groups[0].count).toBe(3);
      });

      it('should sort groups by count descending', async () => {
        const criteria: OrganizationCriteria = {
          groupBy: 'owner',
          sortBy: 'count'
        };

        const result = await documentService.organizeDrafts(criteria);

        // user1 有2个草稿，user2 有1个草稿
        expect(result.groups[0].count).toBeGreaterThanOrEqual(result.groups[1].count);
      });

      it('should sort groups alphabetically', async () => {
        const criteria: OrganizationCriteria = {
          groupBy: 'category',
          sortBy: 'alphabetical'
        };

        const result = await documentService.organizeDrafts(criteria);

        for (let i = 0; i < result.groups.length - 1; i++) {
          expect(result.groups[i].name.localeCompare(result.groups[i + 1].name)).toBeLessThanOrEqual(0);
        }
      });
    });
  });

  describe('Metadata and Statistics', () => {
    describe('getDraftStatistics', () => {
      it('should return draft statistics', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Test Draft',
          initialContent: '# Test\n\nThis is a test with multiple words.',
          permissions: { owner: 'user1' }
        };
        const draft = await documentService.createDraft(createRequest);

        const stats = await documentService.getDraftStatistics(draft.id);

        expect(stats).toBeDefined();
        expect(stats.wordCount).toBeGreaterThan(0);
        expect(stats.sectionCount).toBe(1);
        expect(stats.versionCount).toBe(1);
        expect(stats.editCount).toBe(1);
        expect(stats.viewCount).toBe(0);
      });

      it('should throw error for non-existent draft', async () => {
        await expect(
          documentService.getDraftStatistics('non-existent-id')
        ).rejects.toThrow('Draft not found: non-existent-id');
      });
    });

    describe('updateMetadata', () => {
      it('should update draft metadata', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Test Draft',
          permissions: { owner: 'user1' }
        };
        const draft = await documentService.createDraft(createRequest);

        const metadata = {
          priority: 'critical' as const,
          category: 'urgent',
          tags: ['important', 'fix']
        };

        const updatedDraft = await documentService.updateMetadata(
          draft.id,
          metadata,
          'user1'
        );

        expect(updatedDraft.metadata.priority).toBe('critical');
        expect(updatedDraft.metadata.category).toBe('urgent');
        expect(updatedDraft.metadata.tags).toEqual(['important', 'fix']);
        expect(updatedDraft.collaboration.activityFeed[0].action).toBe('metadata_updated');
      });

      it('should check edit permissions', async () => {
        const createRequest: CreateDraftRequest = {
          title: 'Protected Draft',
          permissions: { owner: 'user1' }
        };
        const draft = await documentService.createDraft(createRequest);

        mockPermissionService.canEdit.mockResolvedValue(false);

        const metadata = { priority: 'high' as const };

        await expect(
          documentService.updateMetadata(draft.id, metadata, 'user2')
        ).rejects.toThrow('Permission denied: Cannot update metadata for this draft');
      });

      it('should throw error for non-existent draft', async () => {
        const metadata = { priority: 'high' as const };

        await expect(
          documentService.updateMetadata('non-existent-id', metadata, 'user1')
        ).rejects.toThrow('Draft not found: non-existent-id');
      });
    });
  });

  describe('Private Helper Methods (tested through public interfaces)', () => {
    it('should count words correctly', async () => {
      const createRequest: CreateDraftRequest = {
        title: 'Word Count Test',
        initialContent: 'This is a test with exactly eight words.',
        permissions: { owner: 'user1' }
      };
      const draft = await documentService.createDraft(createRequest);

      expect(draft.statistics.wordCount).toBe(8);
    });

    it('should count sections correctly', async () => {
      const createRequest: CreateDraftRequest = {
        title: 'Section Count Test',
        initialContent: '# Section 1\n\n## Subsection 1.1\n\n### Subsection 1.1.1\n\n# Section 2',
        permissions: { owner: 'user1' }
      };
      const draft = await documentService.createDraft(createRequest);

      expect(draft.statistics.sectionCount).toBe(4); // 4个标题
    });

    it('should calculate checksum for content', async () => {
      const createRequest: CreateDraftRequest = {
        title: 'Checksum Test',
        initialContent: 'Test content for checksum',
        permissions: { owner: 'user1' }
      };
      const draft = await documentService.createDraft(createRequest);

      expect(draft.versions[0].metadata.checksum).toBeDefined();
      expect(typeof draft.versions[0].metadata.checksum).toBe('string');
      expect(draft.versions[0].metadata.checksum.length).toBeGreaterThan(0);
    });

    it('should detect section presence in content', async () => {
      const template: Template = {
        id: 'template1',
        name: 'Test Template',
        description: 'Test template',
        version: '1.0.0',
        category: 'test',
        structure: {
          sections: [
            {
              name: 'Introduction',
              description: 'Introduction section',
              required: true,
              fields: [],
              subsections: []
            }
          ]
        },
        defaultContent: '',
        validationRules: [],
        metadata: {
          author: 'system',
          created: new Date(),
          updated: new Date(),
          tags: [],
          usage: 0
        }
      };

      const createRequest: CreateDraftRequest = {
        title: 'Section Detection Test',
        initialContent: '# Introduction\n\nThis is the introduction section.',
        permissions: { owner: 'user1' }
      };
      const draft = await documentService.createDraft(createRequest);
      draft.template = template;

      const result = await documentService.validateContent(draft);

      expect(result.isValid).toBe(true);
      expect(result.errors.some(e => e.message.includes('Introduction'))).toBe(false);
    });
  });
});