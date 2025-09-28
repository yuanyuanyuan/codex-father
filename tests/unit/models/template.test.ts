/**
 * T039: Template Model Unit Tests
 *
 * Comprehensive unit tests for Template model including validation rules,
 * section structure, metadata handling, and template relationships.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Template,
  TemplateSection,
  SectionType,
  createTemplate,
  isTemplate,
  validateTemplate,
  validateTemplateSection
} from '../../../src/models/template';

describe('Template Model', () => {
  let validTemplate: Template;
  let validSection: TemplateSection;

  beforeEach(() => {
    validSection = {
      id: 'overview',
      title: '产品概述',
      type: 'text',
      required: true,
      content: '## 产品概述\n\n描述产品的核心功能和价值。',
      permissions: {
        read: ['product_manager', 'architect', 'developer'],
        write: ['product_manager']
      },
      metadata: {
        order: 1,
        helpText: '请详细描述产品的核心功能',
        placeholder: '在此输入产品概述...'
      }
    };

    validTemplate = {
      id: 'standard-prd-template',
      name: '标准 PRD 模板',
      description: '适用于大多数产品需求文档的标准模板',
      category: 'standard',
      sections: [
        validSection,
        {
          id: 'requirements',
          title: '需求分析',
          type: 'text',
          required: true,
          content: '## 需求分析\n\n功能需求和非功能需求列表。'
        },
        {
          id: 'architecture',
          title: '系统架构',
          type: 'diagram',
          required: false,
          content: '## 系统架构\n\n```mermaid\ngraph TD\n  A --> B\n```',
          metadata: {
            diagramType: 'mermaid'
          }
        }
      ],
      metadata: {
        version: '1.0.0',
        author: 'template-team',
        tags: ['standard', 'prd'],
        reviewRequired: true,
        estimatedTime: 120
      },
      permissions: {
        read: ['product_manager', 'architect', 'developer', 'tester'],
        write: ['product_manager', 'template_admin'],
        review: ['template_admin']
      },
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T12:00:00Z')
    };
  });

  describe('Type Guards', () => {
    it('应该正确识别有效的 Template 对象', () => {
      expect(isTemplate(validTemplate)).toBe(true);
    });

    it('应该拒绝缺少必需字段的对象', () => {
      const requiredFields = ['id', 'name', 'description', 'category', 'sections', 'metadata', 'createdAt', 'updatedAt'];

      requiredFields.forEach(field => {
        const invalidTemplate = { ...validTemplate };
        delete (invalidTemplate as any)[field];
        expect(isTemplate(invalidTemplate)).toBe(false);
      });
    });

    it('应该验证 sections 数组结构', () => {
      // 有效的 sections
      const validSectionArrays = [
        [validSection],
        [validSection, { ...validSection, id: 'section2', title: '第二章节' }],
        []  // 空数组也允许
      ];

      validSectionArrays.forEach(sections => {
        const template = { ...validTemplate, sections };
        expect(isTemplate(template)).toBe(true);
      });

      // 无效的 sections
      const invalidSectionArrays = [
        'not an array',
        [{ id: 'invalid', missing: 'title' }], // 缺少必需字段
        [{ ...validSection, type: 'invalid-type' }], // 无效类型
        null,
        undefined
      ];

      invalidSectionArrays.forEach(sections => {
        const template = { ...validTemplate, sections: sections as any };
        expect(isTemplate(template)).toBe(false);
      });
    });

    it('应该验证 SectionType 枚举值', () => {
      const validTypes: SectionType[] = ['text', 'diagram', 'table', 'list', 'code'];

      validTypes.forEach(type => {
        const section = { ...validSection, type };
        const template = { ...validTemplate, sections: [section] };
        expect(isTemplate(template)).toBe(true);
      });

      const invalidType = { ...validSection, type: 'invalid-type' };
      const template = { ...validTemplate, sections: [invalidType] };
      expect(isTemplate(template)).toBe(false);
    });

    it('应该正确处理可选字段', () => {
      // 最小模板
      const minimalTemplate = {
        id: 'minimal-template',
        name: '最小模板',
        description: '最小字段测试',
        category: 'test',
        sections: [],
        metadata: {
          version: '1.0.0',
          author: 'test',
          tags: []
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isTemplate(minimalTemplate)).toBe(true);

      // 带可选字段的模板
      const templateWithOptionals = {
        ...minimalTemplate,
        permissions: {
          read: ['user1'],
          write: ['user2']
        },
        usage: {
          count: 10,
          lastUsed: new Date()
        }
      };

      expect(isTemplate(templateWithOptionals)).toBe(true);
    });
  });

  describe('Template Section Validation', () => {
    it('应该验证章节 ID 格式', () => {
      const validIds = [
        'overview',
        'technical-requirements',
        'section_01',
        'user_stories',
        'appendix-a'
      ];

      validIds.forEach(id => {
        const section = { ...validSection, id };
        expect(validateTemplateSection(section).valid).toBe(true);
      });

      const invalidIds = [
        '', // 空 ID
        'section with spaces',
        'UPPERCASE',
        '123numeric-start',
        'special@chars',
        'id-with-中文'
      ];

      invalidIds.forEach(id => {
        const section = { ...validSection, id };
        const result = validateTemplateSection(section);
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.field === 'id')).toBe(true);
      });
    });

    it('应该验证章节标题', () => {
      const validTitles = [
        '概述',
        'Product Overview',
        '技术需求分析',
        'Section 1: Introduction',
        '附录 A - 技术规范'
      ];

      validTitles.forEach(title => {
        const section = { ...validSection, title };
        expect(validateTemplateSection(section).valid).toBe(true);
      });

      const invalidTitles = [
        '', // 空标题
        '   ', // 只有空格
        'A'.repeat(256), // 过长
        '\n\n\n' // 只有换行符
      ];

      invalidTitles.forEach(title => {
        const section = { ...validSection, title };
        const result = validateTemplateSection(section);
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.field === 'title')).toBe(true);
      });
    });

    it('应该验证章节内容格式', () => {
      const validContents = [
        '# 标题\n\n内容段落。',
        '## 二级标题\n\n- 列表项1\n- 列表项2',
        '```javascript\nconsole.log("code block");\n```',
        '| 表格 | 标题 |\n|------|------|\n| 内容 | 内容 |',
        '' // 空内容也允许
      ];

      validContents.forEach(content => {
        const section = { ...validSection, content };
        expect(validateTemplateSection(section).valid).toBe(true);
      });

      // 测试图表类型章节的特殊验证
      const diagramSection = {
        ...validSection,
        type: 'diagram' as SectionType,
        content: '```mermaid\ngraph TD\n  A --> B\n```',
        metadata: { diagramType: 'mermaid' }
      };
      expect(validateTemplateSection(diagramSection).valid).toBe(true);

      // 图表章节缺少图表类型
      const invalidDiagramSection = {
        ...diagramSection,
        metadata: {}
      };
      const result = validateTemplateSection(invalidDiagramSection);
      expect(result.valid).toBe(false);
    });

    it('应该验证章节权限配置', () => {
      const validPermissions = [
        undefined, // 可选字段
        {
          read: ['user1', 'user2'],
          write: ['user1']
        },
        {
          read: ['*'], // 通配符
          write: ['admin']
        },
        {
          read: [],
          write: []
        }
      ];

      validPermissions.forEach(permissions => {
        const section = { ...validSection, permissions };
        expect(validateTemplateSection(section).valid).toBe(true);
      });

      const invalidPermissions = [
        { read: 'string' }, // 非数组
        { read: [123] }, // 非字符串元素
        { invalidAction: ['user'] }, // 无效权限动作
        { read: [''], write: ['valid'] } // 空用户名
      ];

      invalidPermissions.forEach(permissions => {
        const section = { ...validSection, permissions: permissions as any };
        const result = validateTemplateSection(section);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证章节元数据', () => {
      const validMetadata = [
        undefined,
        {},
        { order: 1 },
        { helpText: '帮助信息', placeholder: '占位符' },
        { diagramType: 'mermaid', theme: 'default' },
        { validation: { minLength: 10, maxLength: 1000 } }
      ];

      validMetadata.forEach(metadata => {
        const section = { ...validSection, metadata };
        expect(validateTemplateSection(section).valid).toBe(true);
      });

      const invalidMetadata = [
        'string instead of object',
        { order: 'not a number' },
        { order: -1 }, // 负数序号
        { order: 1001 }, // 过大序号
        null
      ];

      invalidMetadata.forEach(metadata => {
        const section = { ...validSection, metadata: metadata as any };
        const result = validateTemplateSection(section);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Template Validation', () => {
    it('应该验证模板 ID 唯一性和格式', () => {
      const validIds = [
        'standard-template',
        'project_planning_v2',
        'technical-spec',
        'user-story-template'
      ];

      validIds.forEach(id => {
        const template = { ...validTemplate, id };
        expect(validateTemplate(template).valid).toBe(true);
      });

      const invalidIds = [
        '',
        'UPPERCASE',
        'template with spaces',
        'template@special',
        'template-中文',
        'a'.repeat(101) // 过长
      ];

      invalidIds.forEach(id => {
        const template = { ...validTemplate, id };
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.field === 'id')).toBe(true);
      });
    });

    it('应该验证章节 ID 在模板内的唯一性', () => {
      const duplicatedSections = [
        { ...validSection, id: 'overview', title: '概述1' },
        { ...validSection, id: 'overview', title: '概述2' } // 重复 ID
      ];

      const template = { ...validTemplate, sections: duplicatedSections };
      const result = validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.message.includes('重复'))).toBe(true);
    });

    it('应该验证模板分类', () => {
      const validCategories = [
        'standard',
        'agile',
        'waterfall',
        'technical',
        'business',
        'research',
        'custom'
      ];

      validCategories.forEach(category => {
        const template = { ...validTemplate, category };
        expect(validateTemplate(template).valid).toBe(true);
      });

      const invalidCategories = [
        '',
        'invalid-category',
        'UPPERCASE',
        'category with spaces'
      ];

      invalidCategories.forEach(category => {
        const template = { ...validTemplate, category };
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证模板元数据', () => {
      const validMetadata = [
        {
          version: '1.0.0',
          author: 'test',
          tags: ['test']
        },
        {
          version: '2.1.0-beta',
          author: 'team',
          tags: ['tag1', 'tag2'],
          reviewRequired: false,
          estimatedTime: 60,
          complexity: 'medium'
        }
      ];

      validMetadata.forEach(metadata => {
        const template = { ...validTemplate, metadata };
        expect(validateTemplate(template).valid).toBe(true);
      });

      const invalidMetadata = [
        { version: '', author: 'test', tags: [] }, // 空版本
        { version: '1.0.0', author: '', tags: [] }, // 空作者
        { version: 'invalid', author: 'test', tags: [] }, // 无效版本格式
        { version: '1.0.0', author: 'test', tags: 'not array' }, // 标签非数组
        { version: '1.0.0', author: 'test', tags: [], estimatedTime: -1 } // 负时间
      ];

      invalidMetadata.forEach(metadata => {
        const template = { ...validTemplate, metadata: metadata as any };
        const result = validateTemplate(template);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证章节依赖关系', () => {
      const sectionsWithDependencies = [
        {
          id: 'overview',
          title: '概述',
          type: 'text' as SectionType,
          required: true,
          content: '概述内容'
        },
        {
          id: 'detailed-design',
          title: '详细设计',
          type: 'text' as SectionType,
          required: true,
          content: '详细设计内容',
          metadata: {
            dependsOn: ['overview'] // 依赖概述章节
          }
        }
      ];

      const template = { ...validTemplate, sections: sectionsWithDependencies };
      expect(validateTemplate(template).valid).toBe(true);

      // 无效依赖：依赖不存在的章节
      const invalidDependencies = [
        ...sectionsWithDependencies,
        {
          id: 'conclusion',
          title: '结论',
          type: 'text' as SectionType,
          required: false,
          content: '结论内容',
          metadata: {
            dependsOn: ['non-existent-section']
          }
        }
      ];

      const invalidTemplate = { ...validTemplate, sections: invalidDependencies };
      const result = validateTemplate(invalidTemplate);
      expect(result.valid).toBe(false);
    });
  });

  describe('Factory Methods', () => {
    it('应该创建有效的 Template 实例', () => {
      const templateData = {
        name: '新建模板',
        description: '通过工厂方法创建的模板',
        category: 'custom' as const,
        sections: [
          {
            id: 'intro',
            title: '介绍',
            type: 'text' as SectionType,
            required: true,
            content: '介绍内容'
          }
        ],
        author: 'factory-test'
      };

      const template = createTemplate(templateData);

      expect(isTemplate(template)).toBe(true);
      expect(template.name).toBe(templateData.name);
      expect(template.description).toBe(templateData.description);
      expect(template.category).toBe(templateData.category);
      expect(template.sections).toEqual(templateData.sections);
      expect(template.id).toMatch(/^template-\d+$/);
      expect(template.metadata.version).toBe('1.0.0');
      expect(template.metadata.author).toBe(templateData.author);
      expect(template.metadata.tags).toEqual([]);
      expect(template.createdAt).toBeInstanceOf(Date);
      expect(template.updatedAt).toBeInstanceOf(Date);
    });

    it('应该接受可选参数覆盖默认值', () => {
      const customData = {
        name: '自定义模板',
        description: '自定义描述',
        category: 'business' as const,
        sections: [],
        author: 'custom-author',
        id: 'custom-template-id',
        version: '2.0.0',
        tags: ['自定义', '模板'],
        reviewRequired: true
      };

      const template = createTemplate(customData);

      expect(template.id).toBe(customData.id);
      expect(template.metadata.version).toBe(customData.version);
      expect(template.metadata.tags).toEqual(customData.tags);
      expect(template.metadata.reviewRequired).toBe(customData.reviewRequired);
    });

    it('应该生成唯一的模板 ID', () => {
      const ids = new Set();

      for (let i = 0; i < 50; i++) {
        const template = createTemplate({
          name: `测试模板 ${i}`,
          description: '唯一性测试',
          category: 'test',
          sections: [],
          author: 'test'
        });

        expect(ids.has(template.id)).toBe(false);
        ids.add(template.id);
      }
    });

    it('应该验证工厂方法的输入参数', () => {
      const invalidInputs = [
        { name: '', description: '空名称', category: 'test', sections: [], author: 'test' },
        { name: '测试', description: '', category: 'test', sections: [], author: 'test' },
        { name: '测试', description: '测试', category: 'invalid', sections: [], author: 'test' },
        { name: '测试', description: '测试', category: 'test', sections: [], author: '' }
      ];

      invalidInputs.forEach(input => {
        expect(() => createTemplate(input as any)).toThrow();
      });
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('应该处理大型模板结构', () => {
      const largeSections: TemplateSection[] = [];

      for (let i = 0; i < 100; i++) {
        largeSections.push({
          id: `section-${i}`,
          title: `章节 ${i}`,
          type: 'text',
          required: i < 50, // 前50个必需
          content: `这是第 ${i} 个章节的内容。`.repeat(10),
          metadata: {
            order: i,
            helpText: `章节 ${i} 的帮助信息`
          }
        });
      }

      const largeTemplate = {
        ...validTemplate,
        sections: largeSections
      };

      const result = validateTemplate(largeTemplate);
      expect(result.valid).toBe(true);
    });

    it('应该处理复杂的权限配置', () => {
      const complexPermissions = {
        read: ['product_manager', 'architect', 'developer', 'tester', 'stakeholder'],
        write: ['product_manager', 'template_admin'],
        review: ['senior_architect', 'lead_developer'],
        approve: ['director', 'cto'],
        publish: ['admin']
      };

      const template = {
        ...validTemplate,
        permissions: complexPermissions
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(true);
    });

    it('应该处理特殊字符和多语言内容', () => {
      const multilingualTemplate = {
        ...validTemplate,
        name: 'Multi-language Template 多语言模板',
        description: 'Supports émojis 🚀 and unicode characters ñáéíóú',
        sections: [
          {
            id: 'overview-en',
            title: 'Product Overview (English)',
            type: 'text' as SectionType,
            required: true,
            content: '## Product Overview\n\nDescription with "quotes" and special chars @#$%'
          },
          {
            id: 'overview-zh',
            title: '产品概述（中文）',
            type: 'text' as SectionType,
            required: true,
            content: '## 产品概述\n\n包含中文标点符号：【】《》（）'
          }
        ]
      };

      const result = validateTemplate(multilingualTemplate);
      expect(result.valid).toBe(true);
    });

    it('应该正确处理嵌套的元数据结构', () => {
      const nestedMetadataSection = {
        ...validSection,
        metadata: {
          order: 1,
          validation: {
            minLength: 10,
            maxLength: 1000,
            required: true,
            pattern: '^[A-Za-z0-9\\s]+$'
          },
          ui: {
            component: 'rich-text-editor',
            options: {
              toolbar: ['bold', 'italic', 'link'],
              placeholder: 'Enter your content here...',
              autoSave: true
            }
          },
          workflow: {
            autoAdvance: false,
            notifications: ['author', 'reviewer']
          }
        }
      };

      const template = {
        ...validTemplate,
        sections: [nestedMetadataSection]
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    it('应该高效处理模板验证', () => {
      const startTime = Date.now();

      for (let i = 0; i < 500; i++) {
        const template = {
          ...validTemplate,
          id: `performance-test-${i}`,
          name: `性能测试模板 ${i}`
        };

        validateTemplate(template);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 500 次验证应该在 200ms 内完成
      expect(duration).toBeLessThan(200);
    });

    it('应该避免深度递归导致的栈溢出', () => {
      // 创建深度嵌套的元数据结构
      let deepMetadata: any = { level: 0 };
      for (let i = 1; i < 100; i++) {
        deepMetadata = { level: i, nested: deepMetadata };
      }

      const sectionWithDeepMetadata = {
        ...validSection,
        metadata: deepMetadata
      };

      const template = {
        ...validTemplate,
        sections: [sectionWithDeepMetadata]
      };

      // 应该能处理深度嵌套而不崩溃
      expect(() => validateTemplate(template)).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('应该提供详细的验证错误信息', () => {
      const invalidTemplate = {
        ...validTemplate,
        id: '', // 空 ID
        name: 'A'.repeat(256), // 名称过长
        category: 'invalid-category', // 无效分类
        sections: [
          { ...validSection, id: 'duplicate' },
          { ...validSection, id: 'duplicate' } // 重复章节 ID
        ]
      };

      const result = validateTemplate(invalidTemplate);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      result.errors.forEach(error => {
        expect(error.field).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(5);
      });
    });

    it('应该处理循环依赖', () => {
      const circularDependencySections = [
        {
          id: 'section-a',
          title: '章节 A',
          type: 'text' as SectionType,
          required: true,
          content: '内容 A',
          metadata: { dependsOn: ['section-b'] }
        },
        {
          id: 'section-b',
          title: '章节 B',
          type: 'text' as SectionType,
          required: true,
          content: '内容 B',
          metadata: { dependsOn: ['section-a'] } // 循环依赖
        }
      ];

      const template = {
        ...validTemplate,
        sections: circularDependencySections
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.message.includes('循环依赖'))).toBe(true);
    });

    it('应该优雅处理畸形输入', () => {
      const malformedInputs = [
        null,
        undefined,
        'string',
        123,
        [],
        new Date(),
        Symbol('test'),
        function() {},
        { incomplete: 'object' }
      ];

      malformedInputs.forEach(input => {
        expect(() => validateTemplate(input as any)).not.toThrow();
        expect(() => isTemplate(input as any)).not.toThrow();

        const isValid = isTemplate(input as any);
        expect(isValid).toBe(false);
      });
    });
  });
});