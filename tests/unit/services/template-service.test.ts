/**
 * TemplateService 单元测试
 *
 * 测试范围：
 * - CRUD 操作 (创建、读取、更新、删除)
 * - 模板管理 (验证、结构检查、默认模板加载、自定义)
 * - 模板应用 (应用模板、生成内容、数据提取)
 * - 模板发现 (建议、搜索)
 * - 权限验证和错误处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DefaultTemplateService,
  type TemplateService,
  type CreateTemplateRequest,
  type UpdateTemplateRequest,
  type TemplateFilter,
  type TemplateCustomization,
  type TemplateContext,
  type TemplateSearchQuery,
  type TemplateSuggestionContext
} from '../../../src/services/template-service.js';
import {
  type Template,
  type TemplateStructure,
  type TemplateSectionDef,
  type TemplateFieldDef,
  type ValidationRule,
  BUILTIN_TEMPLATES
} from '../../../src/models/template.js';

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(async () => {
    templateService = new DefaultTemplateService('./test-data/templates');
    // 等待内置模板加载完成
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('CRUD Operations', () => {
    describe('createTemplate', () => {
      it('should create a template with minimal data', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'overview',
            title: 'Overview',
            description: 'Project overview',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Test Template',
          description: 'A test template',
          category: 'test',
          structure
        };

        const template = await templateService.createTemplate(request);

        expect(template).toBeDefined();
        expect(template.id).toMatch(/^template_\d+_\d+$/);
        expect(template.name).toBe('Test Template');
        expect(template.description).toBe('A test template');
        expect(template.category).toBe('test');
        expect(template.version).toBe('1.0.0');
        expect(template.structure).toEqual(structure);
        expect(template.metadata.author).toBe('user');
        expect(template.metadata.usage).toBe(0);
        expect(template.validationRules).toEqual([]);
      });

      it('should create a template with full data', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'requirements',
            title: 'Requirements',
            description: 'System requirements',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: [{
              id: 'priority',
              name: 'Priority',
              type: 'select',
              label: 'Priority Level',
              isRequired: true,
              defaultValue: 'medium',
              options: ['low', 'medium', 'high', 'critical'],
              order: 1
            }]
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const validationRules: ValidationRule[] = [{
          name: 'required_sections',
          description: 'Check required sections',
          type: 'structure',
          severity: 'error',
          condition: 'sections.length > 0',
          message: 'Template must have at least one section'
        }];

        const request: CreateTemplateRequest = {
          name: 'Full Test Template',
          description: 'A complete test template',
          category: 'feature',
          structure,
          defaultContent: '# Requirements\n\nAdd your requirements here...',
          validationRules,
          metadata: {
            tags: ['test', 'feature'],
            author: 'testuser',
            version: '2.0.0',
            license: 'MIT'
          }
        };

        const template = await templateService.createTemplate(request);

        expect(template.name).toBe('Full Test Template');
        expect(template.description).toBe('A complete test template');
        expect(template.category).toBe('feature');
        expect(template.version).toBe('2.0.0');
        expect(template.defaultContent).toBe('# Requirements\n\nAdd your requirements here...');
        expect(template.validationRules).toEqual(validationRules);
        expect(template.metadata.tags).toEqual(['test', 'feature']);
        expect(template.metadata.author).toBe('testuser');
        expect(template.metadata.license).toBe('MIT');
      });

      it('should create template based on existing template', async () => {
        // 先创建基础模板
        const baseStructure: TemplateStructure = {
          sections: [{
            id: 'base_section',
            title: 'Base Section',
            description: 'Base section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const baseRequest: CreateTemplateRequest = {
          name: 'Base Template',
          description: 'Base template',
          category: 'base',
          structure: baseStructure
        };

        const baseTemplate = await templateService.createTemplate(baseRequest);

        // 基于基础模板创建新模板
        const extendedStructure: TemplateStructure = {
          sections: [{
            id: 'extended_section',
            title: 'Extended Section',
            description: 'Extended section',
            order: 2,
            level: 2,
            isRequired: false,
            editableBy: ['developer'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const extendedRequest: CreateTemplateRequest = {
          name: 'Extended Template',
          description: 'Extended template',
          category: 'extended',
          structure: extendedStructure,
          basedOn: baseTemplate.id
        };

        const extendedTemplate = await templateService.createTemplate(extendedRequest);

        expect(extendedTemplate.metadata.basedOn).toBe(baseTemplate.id);
        expect(extendedTemplate.structure.sections).toHaveLength(2); // 合并了基础和扩展结构
      });

      it('should throw error for invalid base template', async () => {
        const structure: TemplateStructure = {
          sections: [],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Invalid Base Template',
          description: 'Template with invalid base',
          category: 'test',
          structure,
          basedOn: 'non-existent-template'
        };

        await expect(templateService.createTemplate(request)).rejects.toThrow('Base template not found: non-existent-template');
      });

      it('should throw error for invalid template structure', async () => {
        const invalidStructure: TemplateStructure = {
          sections: [], // 空章节应该触发验证错误
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: '',  // 空名称应该触发验证错误
          description: '',
          category: 'test',
          structure: invalidStructure
        };

        await expect(templateService.createTemplate(request)).rejects.toThrow('Template validation failed');
      });
    });

    describe('getTemplate', () => {
      it('should get an existing template', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'test_section',
            title: 'Test Section',
            description: 'Test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Get Test Template',
          description: 'Template for get test',
          category: 'test',
          structure
        };

        const createdTemplate = await templateService.createTemplate(request);
        const retrievedTemplate = await templateService.getTemplate(createdTemplate.id);

        expect(retrievedTemplate).toBeDefined();
        expect(retrievedTemplate!.id).toBe(createdTemplate.id);
        expect(retrievedTemplate!.name).toBe('Get Test Template');
        expect(retrievedTemplate!.metadata.usage).toBe(1); // 使用次数应该增加
      });

      it('should return null for non-existent template', async () => {
        const template = await templateService.getTemplate('non-existent-id');
        expect(template).toBeNull();
      });

      it('should update usage statistics on get', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'usage_section',
            title: 'Usage Section',
            description: 'Usage test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Usage Test Template',
          description: 'Template for usage test',
          category: 'test',
          structure
        };

        const template = await templateService.createTemplate(request);
        const initialUsage = template.metadata.usage;

        await templateService.getTemplate(template.id);
        await templateService.getTemplate(template.id);

        const updatedTemplate = await templateService.getTemplate(template.id);
        expect(updatedTemplate!.metadata.usage).toBe(initialUsage + 3);
      });
    });

    describe('updateTemplate', () => {
      it('should update template fields', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'update_section',
            title: 'Update Section',
            description: 'Update test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Update Test Template',
          description: 'Template for update test',
          category: 'test',
          structure
        };

        const template = await templateService.createTemplate(request);
        const originalVersion = template.version;

        const updateRequest: UpdateTemplateRequest = {
          name: 'Updated Template Name',
          description: 'Updated description',
          category: 'updated',
          metadata: {
            tags: ['updated', 'test']
          }
        };

        const updatedTemplate = await templateService.updateTemplate(template.id, updateRequest, 'user');

        expect(updatedTemplate.name).toBe('Updated Template Name');
        expect(updatedTemplate.description).toBe('Updated description');
        expect(updatedTemplate.category).toBe('updated');
        expect(updatedTemplate.metadata.tags).toEqual(['updated', 'test']);
        expect(updatedTemplate.version).not.toBe(originalVersion); // 版本号应该递增
      });

      it('should check permissions for update', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'permission_section',
            title: 'Permission Section',
            description: 'Permission test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Permission Test Template',
          description: 'Template for permission test',
          category: 'test',
          structure,
          metadata: {
            author: 'author1'
          }
        };

        const template = await templateService.createTemplate(request);

        const updateRequest: UpdateTemplateRequest = {
          name: 'Unauthorized Update'
        };

        await expect(
          templateService.updateTemplate(template.id, updateRequest, 'different_user')
        ).rejects.toThrow('Permission denied: Cannot update this template');
      });

      it('should allow admin to update any template', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'admin_section',
            title: 'Admin Section',
            description: 'Admin test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Admin Test Template',
          description: 'Template for admin test',
          category: 'test',
          structure,
          metadata: {
            author: 'author1'
          }
        };

        const template = await templateService.createTemplate(request);

        const updateRequest: UpdateTemplateRequest = {
          name: 'Admin Updated Template'
        };

        const updatedTemplate = await templateService.updateTemplate(template.id, updateRequest, 'admin');
        expect(updatedTemplate.name).toBe('Admin Updated Template');
      });

      it('should throw error for non-existent template', async () => {
        const updateRequest: UpdateTemplateRequest = {
          name: 'Non-existent Update'
        };

        await expect(
          templateService.updateTemplate('non-existent-id', updateRequest, 'user')
        ).rejects.toThrow('Template not found: non-existent-id');
      });

      it('should validate updated template', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'validation_section',
            title: 'Validation Section',
            description: 'Validation test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Validation Test Template',
          description: 'Template for validation test',
          category: 'test',
          structure
        };

        const template = await templateService.createTemplate(request);

        // 尝试更新为无效结构
        const invalidStructure: TemplateStructure = {
          sections: [], // 空章节应该触发验证错误
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const updateRequest: UpdateTemplateRequest = {
          name: '', // 空名称应该触发验证错误
          structure: invalidStructure
        };

        await expect(
          templateService.updateTemplate(template.id, updateRequest, 'user')
        ).rejects.toThrow('Template validation failed');
      });
    });

    describe('deleteTemplate', () => {
      it('should delete an existing template', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'delete_section',
            title: 'Delete Section',
            description: 'Delete test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Delete Test Template',
          description: 'Template for delete test',
          category: 'test',
          structure
        };

        const template = await templateService.createTemplate(request);
        const result = await templateService.deleteTemplate(template.id, 'user');

        expect(result).toBe(true);

        // 验证模板已删除
        const deletedTemplate = await templateService.getTemplate(template.id);
        expect(deletedTemplate).toBeNull();
      });

      it('should return false for non-existent template', async () => {
        const result = await templateService.deleteTemplate('non-existent-id', 'user');
        expect(result).toBe(false);
      });

      it('should check permissions for delete', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'permission_delete_section',
            title: 'Permission Delete Section',
            description: 'Permission delete test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Permission Delete Test Template',
          description: 'Template for permission delete test',
          category: 'test',
          structure,
          metadata: {
            author: 'author1'
          }
        };

        const template = await templateService.createTemplate(request);

        await expect(
          templateService.deleteTemplate(template.id, 'different_user')
        ).rejects.toThrow('Permission denied: Cannot delete this template');
      });

      it('should prevent deletion of builtin templates', async () => {
        // 尝试删除内置模板
        await expect(
          templateService.deleteTemplate('technical', 'admin')
        ).rejects.toThrow('Cannot delete builtin template');
      });
    });

    describe('listTemplates', () => {
      beforeEach(async () => {
        // 创建测试数据
        const structures = Array.from({ length: 3 }, (_, i) => ({
          sections: [{
            id: `section_${i}`,
            title: `Section ${i}`,
            description: `Section ${i} description`,
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'] as any,
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        }));

        await templateService.createTemplate({
          name: 'List Template 1',
          description: 'First list template',
          category: 'feature',
          structure: structures[0],
          metadata: {
            tags: ['tag1', 'common'],
            author: 'user1'
          }
        });

        await templateService.createTemplate({
          name: 'List Template 2',
          description: 'Second list template',
          category: 'bug',
          structure: structures[1],
          metadata: {
            tags: ['tag2', 'common'],
            author: 'user2'
          }
        });

        await templateService.createTemplate({
          name: 'List Template 3',
          description: 'Third list template',
          category: 'feature',
          structure: structures[2],
          metadata: {
            tags: ['tag3'],
            author: 'user1'
          }
        });
      });

      it('should list all templates without filter', async () => {
        const templates = await templateService.listTemplates();

        // 应该包含创建的模板加上内置模板
        expect(templates.length).toBeGreaterThanOrEqual(3);
        const customTemplates = templates.filter(t => t.name.startsWith('List Template'));
        expect(customTemplates).toHaveLength(3);
      });

      it('should filter by category', async () => {
        const filter: TemplateFilter = { category: 'feature' };
        const templates = await templateService.listTemplates(filter);

        expect(templates.every(t => t.category === 'feature')).toBe(true);
        const customTemplates = templates.filter(t => t.name.startsWith('List Template'));
        expect(customTemplates).toHaveLength(2);
      });

      it('should filter by tags', async () => {
        const filter: TemplateFilter = { tags: ['common'] };
        const templates = await templateService.listTemplates(filter);

        expect(templates.every(t => t.metadata.tags.includes('common'))).toBe(true);
        const customTemplates = templates.filter(t => t.name.startsWith('List Template'));
        expect(customTemplates).toHaveLength(2);
      });

      it('should filter by author', async () => {
        const filter: TemplateFilter = { author: 'user1' };
        const templates = await templateService.listTemplates(filter);

        expect(templates.every(t => t.metadata.author === 'user1')).toBe(true);
        const customTemplates = templates.filter(t => t.name.startsWith('List Template'));
        expect(customTemplates).toHaveLength(2);
      });

      it('should filter builtin templates', async () => {
        const filter: TemplateFilter = { builtin: true };
        const templates = await templateService.listTemplates(filter);

        const builtinIds = Object.keys(BUILTIN_TEMPLATES);
        expect(templates.every(t => builtinIds.includes(t.id))).toBe(true);
      });

      it('should filter non-builtin templates', async () => {
        const filter: TemplateFilter = { builtin: false };
        const templates = await templateService.listTemplates(filter);

        const builtinIds = Object.keys(BUILTIN_TEMPLATES);
        expect(templates.every(t => !builtinIds.includes(t.id))).toBe(true);
      });

      it('should sort by name ascending', async () => {
        const filter: TemplateFilter = { sortBy: 'name', sortOrder: 'asc', builtin: false };
        const templates = await templateService.listTemplates(filter);

        for (let i = 0; i < templates.length - 1; i++) {
          expect(templates[i].name.localeCompare(templates[i + 1].name)).toBeLessThanOrEqual(0);
        }
      });

      it('should sort by usage descending', async () => {
        // 先访问一些模板增加使用次数
        const allTemplates = await templateService.listTemplates({ builtin: false });
        if (allTemplates.length > 0) {
          await templateService.getTemplate(allTemplates[0].id);
          await templateService.getTemplate(allTemplates[0].id);
        }

        const filter: TemplateFilter = { sortBy: 'usage', sortOrder: 'desc', builtin: false };
        const templates = await templateService.listTemplates(filter);

        for (let i = 0; i < templates.length - 1; i++) {
          expect(templates[i].metadata.usage).toBeGreaterThanOrEqual(templates[i + 1].metadata.usage);
        }
      });

      it('should apply pagination', async () => {
        const filter: TemplateFilter = { limit: 2, offset: 1, builtin: false };
        const templates = await templateService.listTemplates(filter);

        expect(templates.length).toBeLessThanOrEqual(2);
      });

      it('should filter by usage range', async () => {
        // 先设置一些使用统计
        const allTemplates = await templateService.listTemplates({ builtin: false });
        if (allTemplates.length > 0) {
          await templateService.getTemplate(allTemplates[0].id);
          await templateService.getTemplate(allTemplates[0].id);
        }

        const filter: TemplateFilter = { usage: { min: 2, max: 10 } };
        const templates = await templateService.listTemplates(filter);

        expect(templates.every(t => t.metadata.usage >= 2 && t.metadata.usage <= 10)).toBe(true);
      });
    });
  });

  describe('Template Management', () => {
    describe('validateTemplate', () => {
      it('should validate a valid template', async () => {
        const validStructure: TemplateStructure = {
          sections: [
            {
              id: 'overview',
              title: 'Overview',
              description: 'Project overview',
              order: 1,
              level: 2,
              isRequired: true,
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: []
            },
            {
              id: 'requirements',
              title: 'Requirements',
              description: 'System requirements',
              order: 2,
              level: 2,
              isRequired: true,
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: []
            },
            {
              id: 'implementation',
              title: 'Implementation',
              description: 'Implementation details',
              order: 3,
              level: 2,
              isRequired: false,
              editableBy: ['developer'],
              visibleTo: [],
              fields: []
            }
          ],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const validTemplate: Template = {
          id: 'valid_template',
          name: 'Valid Template',
          displayName: 'Valid Template',
          description: 'A valid template for testing',
          version: '1.0.0',
          category: 'test',
          tags: ['test', 'valid'],
          isDefault: false,
          isPublic: true,
          structure: validStructure,
          validationRules: [],
          metadata: {
            usage: 0,
            rating: 0,
            ratingCount: 0,
            downloadCount: 0,
            estimatedTime: 60,
            difficulty: 'beginner',
            targetAudience: ['product_manager'],
            prerequisites: [],
            relatedTemplates: []
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user'
        };

        const result = await templateService.validateTemplate(validTemplate);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.score).toBeGreaterThan(70); // 应该有较高的质量得分
      });

      it('should detect validation errors', async () => {
        const invalidStructure: TemplateStructure = {
          sections: [], // 空章节应该触发错误
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const invalidTemplate: Template = {
          id: 'invalid_template',
          name: '', // 空名称应该触发错误
          displayName: '',
          description: '',
          version: 'invalid-version', // 无效版本格式
          category: 'test',
          tags: [],
          isDefault: false,
          isPublic: true,
          structure: invalidStructure,
          validationRules: [],
          metadata: {
            usage: 0,
            rating: 0,
            ratingCount: 0,
            downloadCount: 0,
            estimatedTime: 60,
            difficulty: 'beginner',
            targetAudience: [],
            prerequisites: [],
            relatedTemplates: []
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user'
        };

        const result = await templateService.validateTemplate(invalidTemplate);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(e => e.field === 'name')).toBe(true);
        expect(result.errors.some(e => e.field === 'version')).toBe(true);
        expect(result.errors.some(e => e.field === 'structure')).toBe(true);
      });

      it('should generate warnings and suggestions', async () => {
        const minimalStructure: TemplateStructure = {
          sections: [{
            id: 'minimal',
            title: 'Minimal Section',
            description: 'Minimal section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const minimalTemplate: Template = {
          id: 'minimal_template',
          name: 'Minimal Template',
          displayName: 'Minimal Template',
          description: '', // 空描述应该产生警告
          version: '1.0.0',
          category: 'test',
          tags: [], // 空标签应该产生建议
          isDefault: false,
          isPublic: true,
          structure: minimalStructure, // 少于3个章节应该产生建议
          validationRules: [],
          metadata: {
            usage: 0,
            rating: 0,
            ratingCount: 0,
            downloadCount: 0,
            estimatedTime: 60,
            difficulty: 'beginner',
            targetAudience: [],
            prerequisites: [],
            relatedTemplates: []
          },
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user'
        };

        const result = await templateService.validateTemplate(minimalTemplate);

        expect(result.warnings.some(w => w.field === 'description')).toBe(true);
        expect(result.suggestions.some(s => s.type === 'structure')).toBe(true);
        expect(result.suggestions.some(s => s.type === 'content')).toBe(true);
      });
    });

    describe('validateTemplateStructure', () => {
      it('should validate a valid structure', async () => {
        const validStructure: TemplateStructure = {
          sections: [
            {
              id: 'section1',
              title: 'Section 1',
              description: 'First section',
              order: 1,
              level: 2,
              isRequired: true,
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: []
            },
            {
              id: 'section2',
              title: 'Section 2',
              description: 'Second section',
              order: 2,
              level: 2,
              isRequired: false,
              editableBy: ['developer'],
              visibleTo: [],
              fields: []
            }
          ],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const result = await templateService.validateTemplateStructure(validStructure);

        expect(result.isValid).toBe(true);
        expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
      });

      it('should detect empty sections', async () => {
        const emptyStructure: TemplateStructure = {
          sections: [], // 空章节
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const result = await templateService.validateTemplateStructure(emptyStructure);

        expect(result.isValid).toBe(false);
        expect(result.issues.some(i => i.type === 'missing_required' && i.section === 'root')).toBe(true);
      });

      it('should detect duplicate section names', async () => {
        const duplicateStructure: TemplateStructure = {
          sections: [
            {
              id: 'section1',
              title: 'Duplicate Section',
              description: 'First duplicate section',
              order: 1,
              level: 2,
              isRequired: true,
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: []
            },
            {
              id: 'section2',
              title: 'Duplicate Section', // 重复名称
              description: 'Second duplicate section',
              order: 2,
              level: 2,
              isRequired: false,
              editableBy: ['developer'],
              visibleTo: [],
              fields: []
            }
          ],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const result = await templateService.validateTemplateStructure(duplicateStructure);

        expect(result.isValid).toBe(false);
        expect(result.issues.some(i => i.type === 'invalid_reference')).toBe(true);
      });

      it('should generate recommendations for large structures', async () => {
        // 创建超过10个章节的结构
        const sections = Array.from({ length: 12 }, (_, i) => ({
          id: `section_${i}`,
          title: `Section ${i}`,
          description: `Section ${i} description`,
          order: i + 1,
          level: 2,
          isRequired: false,
          editableBy: ['product_manager'] as any,
          visibleTo: [],
          fields: []
        }));

        const largeStructure: TemplateStructure = {
          sections,
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const result = await templateService.validateTemplateStructure(largeStructure);

        expect(result.recommendations.some(r => r.type === 'split_section')).toBe(true);
      });

      it('should recommend required sections', async () => {
        const noRequiredStructure: TemplateStructure = {
          sections: [
            {
              id: 'optional1',
              title: 'Optional Section 1',
              description: 'Optional section',
              order: 1,
              level: 2,
              isRequired: false, // 所有章节都不是必需的
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: []
            },
            {
              id: 'optional2',
              title: 'Optional Section 2',
              description: 'Another optional section',
              order: 2,
              level: 2,
              isRequired: false,
              editableBy: ['developer'],
              visibleTo: [],
              fields: []
            }
          ],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const result = await templateService.validateTemplateStructure(noRequiredStructure);

        expect(result.recommendations.some(r => r.type === 'add_section')).toBe(true);
      });
    });

    describe('loadDefaultTemplates', () => {
      it('should load all builtin templates', async () => {
        const defaultTemplates = await templateService.loadDefaultTemplates();

        expect(defaultTemplates.length).toBe(Object.keys(BUILTIN_TEMPLATES).length);

        for (const template of defaultTemplates) {
          expect(template.id).toBeDefined();
          expect(template.name).toBeDefined();
          expect(template.version).toBeDefined();
          expect(template.structure).toBeDefined();
          expect(template.metadata).toBeDefined();
        }
      });

      it('should make builtin templates accessible via getTemplate', async () => {
        await templateService.loadDefaultTemplates();

        const technicalTemplate = await templateService.getTemplate('technical');
        expect(technicalTemplate).toBeDefined();
        expect(technicalTemplate!.name).toBe('technical');
        expect(technicalTemplate!.displayName).toBe('Technical Architecture PRD');

        const businessTemplate = await templateService.getTemplate('business');
        expect(businessTemplate).toBeDefined();
        expect(businessTemplate!.name).toBe('business');
        expect(businessTemplate!.displayName).toBe('Business Requirements PRD');
      });
    });

    describe('customizeTemplate', () => {
      it('should customize an existing template', async () => {
        // 先获取内置模板
        const baseTemplate = await templateService.getTemplate('technical');
        expect(baseTemplate).toBeDefined();

        const customizations: TemplateCustomization = {
          name: 'Customized Technical Template',
          description: 'A customized version of the technical template',
          addSections: [{
            id: 'custom_section',
            title: 'Custom Section',
            description: 'A custom section',
            order: 10,
            level: 2,
            isRequired: false,
            editableBy: ['developer'],
            visibleTo: [],
            fields: []
          }],
          metadata: {
            tags: ['custom', 'technical']
          }
        };

        const customTemplate = await templateService.customizeTemplate('technical', customizations);

        expect(customTemplate.name).toBe('Customized Technical Template');
        expect(customTemplate.description).toBe('A customized version of the technical template');
        expect(customTemplate.metadata.basedOn).toBe('technical');
        expect(customTemplate.metadata.tags).toEqual(['custom', 'technical']);
        expect(customTemplate.structure.sections.length).toBe(baseTemplate!.structure.sections.length + 1);
        expect(customTemplate.structure.sections.some(s => s.id === 'custom_section')).toBe(true);
      });

      it('should remove sections from template', async () => {
        const baseTemplate = await templateService.getTemplate('business');
        expect(baseTemplate).toBeDefined();

        const customizations: TemplateCustomization = {
          removeSections: ['timeline'] // 移除时间规划章节
        };

        const customTemplate = await templateService.customizeTemplate('business', customizations);

        expect(customTemplate.structure.sections.length).toBe(baseTemplate!.structure.sections.length - 1);
        expect(customTemplate.structure.sections.some(s => s.id === 'timeline')).toBe(false);
      });

      it('should modify existing sections', async () => {
        const baseTemplate = await templateService.getTemplate('technical');
        expect(baseTemplate).toBeDefined();

        const customizations: TemplateCustomization = {
          modifySections: [{
            sectionName: 'overview',
            changes: {
              title: 'Modified Overview',
              description: 'A modified overview section',
              isRequired: false
            }
          }]
        };

        const customTemplate = await templateService.customizeTemplate('technical', customizations);

        const overviewSection = customTemplate.structure.sections.find(s => s.id === 'overview');
        expect(overviewSection).toBeDefined();
        expect(overviewSection!.title).toBe('Modified Overview');
        expect(overviewSection!.description).toBe('A modified overview section');
        expect(overviewSection!.isRequired).toBe(false);
      });

      it('should add fields to sections', async () => {
        const baseTemplate = await templateService.getTemplate('technical');
        expect(baseTemplate).toBeDefined();

        const customizations: TemplateCustomization = {
          addFields: [{
            sectionName: 'overview',
            fields: [{
              id: 'custom_field',
              name: 'Custom Field',
              type: 'text',
              label: 'Custom Field Label',
              isRequired: false,
              order: 1
            }]
          }]
        };

        const customTemplate = await templateService.customizeTemplate('technical', customizations);

        const overviewSection = customTemplate.structure.sections.find(s => s.id === 'overview');
        expect(overviewSection).toBeDefined();
        expect(overviewSection!.fields).toBeDefined();
        expect(overviewSection!.fields!.some(f => f.id === 'custom_field')).toBe(true);
      });

      it('should throw error for non-existent template', async () => {
        const customizations: TemplateCustomization = {
          name: 'Custom Non-existent'
        };

        await expect(
          templateService.customizeTemplate('non-existent-template', customizations)
        ).rejects.toThrow('Template not found: non-existent-template');
      });

      it('should validate customized template', async () => {
        const baseTemplate = await templateService.getTemplate('technical');
        expect(baseTemplate).toBeDefined();

        // 尝试创建无效的自定义
        const invalidCustomizations: TemplateCustomization = {
          name: '', // 空名称应该触发验证错误
          removeSections: ['overview', 'architecture', 'implementation', 'security', 'performance', 'testing'] // 移除所有章节
        };

        await expect(
          templateService.customizeTemplate('technical', invalidCustomizations)
        ).rejects.toThrow('Customized template validation failed');
      });
    });
  });

  describe('Template Usage', () => {
    describe('applyTemplate', () => {
      it('should apply template with default content', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'apply_section',
            title: 'Apply Section',
            description: 'Apply test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Apply Test Template',
          description: 'Template for apply test',
          category: 'test',
          structure,
          defaultContent: '# Apply Section\n\nDefault content with {{placeholder}}.'
        };

        const template = await templateService.createTemplate(request);
        const applied = await templateService.applyTemplate(template.id);

        expect(applied.template).toEqual(template);
        expect(applied.content).toBe('# Apply Section\n\nDefault content with {{placeholder}}.');
        expect(applied.placeholders).toHaveLength(1);
        expect(applied.placeholders[0].name).toBe('placeholder');
      });

      it('should extract placeholders from content', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'placeholder_section',
            title: 'Placeholder Section',
            description: 'Placeholder test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Placeholder Test Template',
          description: 'Template for placeholder test',
          category: 'test',
          structure,
          defaultContent: 'Project: {{project_name}}\nDate: {{start_date:date}}\nPriority: {{priority:choice}}'
        };

        const template = await templateService.createTemplate(request);
        const applied = await templateService.applyTemplate(template.id);

        expect(applied.placeholders).toHaveLength(3);
        expect(applied.placeholders.map(p => p.name)).toEqual(['project_name', 'start_date', 'priority']);
        expect(applied.placeholders.find(p => p.name === 'start_date')?.type).toBe('date');
        expect(applied.placeholders.find(p => p.name === 'priority')?.type).toBe('choice');
      });

      it('should adapt content to context', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'context_section',
            title: 'Context Section',
            description: 'Context test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Context Test Template',
          description: 'Template for context test',
          category: 'test',
          structure,
          defaultContent: 'Project Type: {{project_type}}\nComplexity: {{complexity}}'
        };

        const template = await templateService.createTemplate(request);

        const context: TemplateContext = {
          projectType: 'web',
          complexity: 'medium',
          complianceRequired: true,
          teamSize: 15
        };

        const applied = await templateService.applyTemplate(template.id, context);

        expect(applied.content).toContain('Project Type: web');
        expect(applied.content).toContain('Complexity: medium');
        expect(applied.suggestions.length).toBeGreaterThan(0);
        expect(applied.suggestions.some(s => s.message.includes('compliance'))).toBe(true);
        expect(applied.suggestions.some(s => s.message.includes('large team'))).toBe(true);
      });

      it('should throw error for non-existent template', async () => {
        await expect(
          templateService.applyTemplate('non-existent-template')
        ).rejects.toThrow('Template not found: non-existent-template');
      });
    });

    describe('generateContent', () => {
      it('should generate content with placeholders replaced', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'generate_section',
            title: 'Generate Section',
            description: 'Generate test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Generate Test Template',
          description: 'Template for generate test',
          category: 'test',
          structure,
          defaultContent: '# {{project_name}}\n\n**Description**: {{description}}\n**Priority**: {{priority}}'
        };

        const template = await templateService.createTemplate(request);

        const data = {
          project_name: 'Test Project',
          description: 'This is a test project',
          priority: 'High'
        };

        const content = await templateService.generateContent(template, data);

        expect(content).toBe('# Test Project\n\n**Description**: This is a test project\n**Priority**: High');
      });

      it('should generate structured content when defaultContent is empty', async () => {
        const structure: TemplateStructure = {
          sections: [
            {
              id: 'overview',
              title: 'Overview',
              description: 'Project overview',
              order: 1,
              level: 2,
              isRequired: true,
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: [{
                id: 'project_name',
                name: 'Project Name',
                type: 'text',
                label: 'Project Name',
                isRequired: true,
                order: 1
              }]
            },
            {
              id: 'requirements',
              title: 'Requirements',
              description: 'System requirements',
              order: 2,
              level: 2,
              isRequired: true,
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: []
            }
          ],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Structured Generate Template',
          description: 'Template for structured generation',
          category: 'test',
          structure,
          defaultContent: '' // 空内容，应该基于结构生成
        };

        const template = await templateService.createTemplate(request);
        const content = await templateService.generateContent(template, {});

        expect(content).toContain('# Overview');
        expect(content).toContain('# Requirements');
        expect(content).toContain('**Project Name**:');
      });
    });

    describe('extractTemplateData', () => {
      it('should extract sections and fields from content', async () => {
        const structure: TemplateStructure = {
          sections: [
            {
              id: 'overview',
              title: 'Overview',
              description: 'Project overview',
              order: 1,
              level: 2,
              isRequired: true,
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: [{
                id: 'project_name',
                name: 'Project Name',
                type: 'text',
                label: 'Project Name',
                isRequired: true,
                order: 1
              }]
            },
            {
              id: 'requirements',
              title: 'Requirements',
              description: 'System requirements',
              order: 2,
              level: 2,
              isRequired: true,
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: []
            }
          ],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Extract Test Template',
          description: 'Template for extract test',
          category: 'test',
          structure
        };

        const template = await templateService.createTemplate(request);

        const content = `# Overview

This is the overview section with detailed information.

**Project Name**: Test Project

# Requirements

These are the system requirements.

- Requirement 1
- Requirement 2`;

        const extracted = await templateService.extractTemplateData(content, template);

        expect(extracted.sections).toHaveLength(2);
        expect(extracted.sections[0].name).toBe('Overview');
        expect(extracted.sections[0].content).toContain('This is the overview section');
        expect(extracted.sections[1].name).toBe('Requirements');
        expect(extracted.sections[1].content).toContain('These are the system requirements');

        expect(extracted.fields).toHaveLength(1);
        expect(extracted.fields[0].name).toBe('Project Name');
        expect(extracted.fields[0].value).toBe('Test Project');
        expect(extracted.fields[0].section).toBe('Overview');

        expect(extracted.completeness).toBeGreaterThan(0);
        expect(extracted.quality.score).toBeGreaterThan(0);
      });

      it('should calculate completeness based on filled sections and fields', async () => {
        const structure: TemplateStructure = {
          sections: [
            {
              id: 'complete_section',
              title: 'Complete Section',
              description: 'A complete section',
              order: 1,
              level: 2,
              isRequired: true,
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: [{
                id: 'field1',
                name: 'Field 1',
                type: 'text',
                label: 'Field 1',
                isRequired: true,
                order: 1
              }]
            },
            {
              id: 'empty_section',
              title: 'Empty Section',
              description: 'An empty section',
              order: 2,
              level: 2,
              isRequired: false,
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: []
            }
          ],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Completeness Test Template',
          description: 'Template for completeness test',
          category: 'test',
          structure
        };

        const template = await templateService.createTemplate(request);

        const partialContent = `# Complete Section

This section has content.

**Field 1**: Filled Value

# Empty Section

`;

        const extracted = await templateService.extractTemplateData(partialContent, template);

        expect(extracted.completeness).toBe(75); // 1.5/2 sections and 1/1 fields = (1.5/2 + 1/1) / 2 = 0.75
      });

      it('should assess content quality', async () => {
        const structure: TemplateStructure = {
          sections: [{
            id: 'quality_section',
            title: 'Quality Section',
            description: 'Quality test section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        const request: CreateTemplateRequest = {
          name: 'Quality Test Template',
          description: 'Template for quality test',
          category: 'test',
          structure
        };

        const template = await templateService.createTemplate(request);

        const poorContent = 'Brief content.'; // 太简短且没有结构
        const poorExtracted = await templateService.extractTemplateData(poorContent, template);

        expect(poorExtracted.quality.issues.length).toBeGreaterThan(0);
        expect(poorExtracted.quality.suggestions.length).toBeGreaterThan(0);
        expect(poorExtracted.quality.score).toBeLessThan(100);

        const goodContent = `# Quality Section

## Introduction

This is a comprehensive document with proper structure and detailed content.
It contains multiple paragraphs with sufficient information to demonstrate
good content quality.

## Details

### Subsection 1

Detailed information about the first aspect of the project.

### Subsection 2

Detailed information about the second aspect of the project.

## Conclusion

Summary of the document with key points highlighted.`;

        const goodExtracted = await templateService.extractTemplateData(goodContent, template);

        expect(goodExtracted.quality.score).toBe(100);
        expect(goodExtracted.quality.issues).toHaveLength(0);
      });
    });
  });

  describe('Template Discovery', () => {
    describe('suggestTemplate', () => {
      beforeEach(async () => {
        // 创建测试模板
        const webStructure: TemplateStructure = {
          sections: [{
            id: 'web_section',
            title: 'Web Section',
            description: 'Web-specific section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        await templateService.createTemplate({
          name: 'Web Application Template',
          description: 'Template for web applications',
          category: 'web',
          structure: webStructure,
          metadata: {
            tags: ['web', 'frontend', 'application']
          }
        });

        const mobileStructure: TemplateStructure = {
          sections: [{
            id: 'mobile_section',
            title: 'Mobile Section',
            description: 'Mobile-specific section',
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'],
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        };

        await templateService.createTemplate({
          name: 'Mobile App Template',
          description: 'Template for mobile applications',
          category: 'mobile',
          structure: mobileStructure,
          metadata: {
            tags: ['mobile', 'app', 'ios', 'android']
          }
        });
      });

      it('should suggest templates based on project type', async () => {
        const context: TemplateSuggestionContext = {
          projectType: 'web'
        };

        const suggestions = await templateService.suggestTemplate(context);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.some(t => t.name === 'Web Application Template')).toBe(true);
      });

      it('should suggest templates based on keywords', async () => {
        const context: TemplateSuggestionContext = {
          keywords: ['mobile', 'app']
        };

        const suggestions = await templateService.suggestTemplate(context);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.some(t => t.name === 'Mobile App Template')).toBe(true);
      });

      it('should suggest templates based on existing content', async () => {
        const context: TemplateSuggestionContext = {
          existingContent: 'This is a web application with frontend components'
        };

        const suggestions = await templateService.suggestTemplate(context);

        expect(suggestions.length).toBeGreaterThan(0);
        // 应该建议包含相似内容的模板
      });

      it('should prioritize previously used templates', async () => {
        const webTemplate = await templateService.getTemplate('technical');
        expect(webTemplate).toBeDefined();

        const context: TemplateSuggestionContext = {
          previousTemplates: ['technical']
        };

        const suggestions = await templateService.suggestTemplate(context);

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0].id).toBe('technical'); // 应该排在前面
      });

      it('should consider usage frequency', async () => {
        // 增加某个模板的使用次数
        const popularTemplate = await templateService.getTemplate('business');
        if (popularTemplate) {
          for (let i = 0; i < 5; i++) {
            await templateService.getTemplate('business');
          }
        }

        const context: TemplateSuggestionContext = {};

        const suggestions = await templateService.suggestTemplate(context);

        expect(suggestions.length).toBeGreaterThan(0);
        // 使用次数多的模板应该有更高的分数
      });

      it('should return maximum 5 suggestions', async () => {
        const context: TemplateSuggestionContext = {
          keywords: ['template'] // 通用关键词应该匹配多个模板
        };

        const suggestions = await templateService.suggestTemplate(context);

        expect(suggestions.length).toBeLessThanOrEqual(5);
      });
    });

    describe('searchTemplates', () => {
      beforeEach(async () => {
        // 创建测试模板
        const searchStructures = Array.from({ length: 3 }, (_, i) => ({
          sections: [{
            id: `search_section_${i}`,
            title: `Search Section ${i}`,
            description: `Search section ${i} description`,
            order: 1,
            level: 2,
            isRequired: true,
            editableBy: ['product_manager'] as any,
            visibleTo: [],
            fields: []
          }],
          fields: [],
          rules: [],
          decisionTables: [],
          globalSettings: {
            allowCustomSections: true,
            requireAllSections: false,
            autoNumbering: true,
            defaultLanguage: 'zh-CN',
            maxContentLength: 10485760,
            enableVersioning: true,
            enableComments: true
          }
        }));

        await templateService.createTemplate({
          name: 'Search Template 1',
          description: 'First search template for API development',
          category: 'api',
          structure: searchStructures[0],
          metadata: {
            tags: ['api', 'backend', 'development']
          }
        });

        await templateService.createTemplate({
          name: 'Search Template 2',
          description: 'Second search template for frontend development',
          category: 'frontend',
          structure: searchStructures[1],
          metadata: {
            tags: ['frontend', 'ui', 'development']
          }
        });

        await templateService.createTemplate({
          name: 'Search Template 3',
          description: 'Third search template for testing',
          category: 'testing',
          structure: searchStructures[2],
          metadata: {
            tags: ['testing', 'qa', 'automation']
          }
        });
      });

      it('should search templates by text in name', async () => {
        const query: TemplateSearchQuery = {
          text: 'Search Template 1'
        };

        const results = await templateService.searchTemplates(query);

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].template.name).toBe('Search Template 1');
        expect(results[0].matchedFields).toContain('name');
        expect(results[0].score).toBeGreaterThan(0);
      });

      it('should search templates by text in description', async () => {
        const query: TemplateSearchQuery = {
          text: 'API development'
        };

        const results = await templateService.searchTemplates(query);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.template.name === 'Search Template 1')).toBe(true);
        expect(results.find(r => r.template.name === 'Search Template 1')?.matchedFields).toContain('description');
      });

      it('should search templates by tags', async () => {
        const query: TemplateSearchQuery = {
          text: 'development'
        };

        const results = await templateService.searchTemplates(query);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.matchedFields.includes('tags'))).toBe(true);
      });

      it('should filter by category', async () => {
        const query: TemplateSearchQuery = {
          category: 'api'
        };

        const results = await templateService.searchTemplates(query);

        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.template.category === 'api')).toBe(true);
        expect(results[0].matchedFields).toContain('category');
      });

      it('should filter by tags', async () => {
        const query: TemplateSearchQuery = {
          tags: ['frontend']
        };

        const results = await templateService.searchTemplates(query);

        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.template.metadata.tags.includes('frontend'))).toBe(true);
        expect(results[0].matchedFields).toContain('tags');
      });

      it('should search by similarity', async () => {
        const referenceTemplate = await templateService.getTemplate('technical');
        expect(referenceTemplate).toBeDefined();

        const query: TemplateSearchQuery = {
          similarity: {
            template: referenceTemplate!,
            threshold: 0.1 // 低阈值以便测试
          }
        };

        const results = await templateService.searchTemplates(query);

        expect(results.length).toBeGreaterThan(0);
        expect(results.some(r => r.matchedFields.includes('structure'))).toBe(true);
        expect(results.some(r => r.relevanceReason.includes('similarity'))).toBe(true);
      });

      it('should sort results by score descending', async () => {
        const query: TemplateSearchQuery = {
          text: 'template'
        };

        const results = await templateService.searchTemplates(query);

        expect(results.length).toBeGreaterThan(1);
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
        }
      });

      it('should provide relevance reasons', async () => {
        const query: TemplateSearchQuery = {
          text: 'Search Template',
          category: 'api',
          tags: ['backend']
        };

        const results = await templateService.searchTemplates(query);

        expect(results.length).toBeGreaterThan(0);
        expect(results.every(r => r.relevanceReason.length > 0)).toBe(true);
      });

      it('should return empty results for no matches', async () => {
        const query: TemplateSearchQuery = {
          text: 'nonexistent-template-xyz'
        };

        const results = await templateService.searchTemplates(query);

        expect(results).toHaveLength(0);
      });
    });
  });
});