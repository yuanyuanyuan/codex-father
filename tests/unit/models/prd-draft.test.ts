/**
 * T039: PRDDraft Model Unit Tests
 *
 * Comprehensive unit tests for PRDDraft model including validation rules,
 * factory methods, type guards, edge cases, and boundary values.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PRDDraft, PRDStatus, createPRDDraft, isPRDDraft, validatePRDDraft } from '../../../src/models/prd-draft';

describe('PRDDraft Model', () => {
  let validPRDDraft: PRDDraft;

  beforeEach(() => {
    validPRDDraft = {
      id: 'test-prd-001',
      title: '测试 PRD 文档',
      description: '这是一个测试用的 PRD 文档',
      content: {
        overview: '产品概述内容',
        requirements: '需求分析内容',
        architecture: '系统架构设计'
      },
      templateId: 'standard-template',
      author: 'test-author',
      status: 'draft',
      version: '1.0.0',
      tags: ['测试', 'demo'],
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T12:00:00Z')
    };
  });

  describe('Type Guards', () => {
    it('应该正确识别有效的 PRDDraft 对象', () => {
      expect(isPRDDraft(validPRDDraft)).toBe(true);
    });

    it('应该拒绝缺少必需字段的对象', () => {
      const invalidCases = [
        { ...validPRDDraft, id: undefined },
        { ...validPRDDraft, title: undefined },
        { ...validPRDDraft, content: undefined },
        { ...validPRDDraft, templateId: undefined },
        { ...validPRDDraft, author: undefined },
        { ...validPRDDraft, status: undefined },
        { ...validPRDDraft, version: undefined },
        { ...validPRDDraft, createdAt: undefined },
        { ...validPRDDraft, updatedAt: undefined }
      ];

      invalidCases.forEach(invalidCase => {
        expect(isPRDDraft(invalidCase)).toBe(false);
      });
    });

    it('应该拒绝类型错误的字段', () => {
      const invalidTypeCases = [
        { ...validPRDDraft, id: 123 },
        { ...validPRDDraft, title: null },
        { ...validPRDDraft, content: 'string instead of object' },
        { ...validPRDDraft, tags: 'string instead of array' },
        { ...validPRDDraft, createdAt: 'invalid date' },
        { ...validPRDDraft, status: 'invalid-status' }
      ];

      invalidTypeCases.forEach(invalidCase => {
        expect(isPRDDraft(invalidCase)).toBe(false);
      });
    });

    it('应该正确处理可选字段', () => {
      const minimalDraft = {
        id: 'minimal-test',
        title: '最小测试',
        description: '最小字段测试',
        content: { overview: '概述' },
        templateId: 'basic',
        author: 'test',
        status: 'draft' as PRDStatus,
        version: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isPRDDraft(minimalDraft)).toBe(true);

      // 添加可选字段
      const draftWithOptionals = {
        ...minimalDraft,
        tags: ['test'],
        reviewStatus: 'pending' as const,
        permissions: {
          read: ['user1'],
          write: ['user2'],
          review: ['user3']
        }
      };

      expect(isPRDDraft(draftWithOptionals)).toBe(true);
    });

    it('应该验证 PRDStatus 枚举值', () => {
      const validStatuses: PRDStatus[] = ['draft', 'in_review', 'approved', 'published', 'archived'];

      validStatuses.forEach(status => {
        const draft = { ...validPRDDraft, status };
        expect(isPRDDraft(draft)).toBe(true);
      });

      const invalidStatus = { ...validPRDDraft, status: 'invalid-status' };
      expect(isPRDDraft(invalidStatus)).toBe(false);
    });
  });

  describe('Validation Rules', () => {
    it('应该验证 ID 格式', () => {
      const validIds = [
        'test-001',
        'prd-draft-123',
        'user_document_v2',
        'a'.repeat(100) // 长 ID
      ];

      validIds.forEach(id => {
        const result = validatePRDDraft({ ...validPRDDraft, id });
        expect(result.valid).toBe(true);
      });

      const invalidIds = [
        '', // 空字符串
        ' ', // 只有空格
        'id with spaces',
        'id-with-中文',
        'a'.repeat(256), // 过长
        'ID-WITH-UPPERCASE'
      ];

      invalidIds.forEach(id => {
        const result = validatePRDDraft({ ...validPRDDraft, id });
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.field === 'id')).toBe(true);
      });
    });

    it('应该验证标题长度和内容', () => {
      // 有效标题
      const validTitles = [
        '短标题',
        '这是一个正常长度的 PRD 文档标题',
        'A'.repeat(100) // 接近最大长度
      ];

      validTitles.forEach(title => {
        const result = validatePRDDraft({ ...validPRDDraft, title });
        expect(result.valid).toBe(true);
      });

      // 无效标题
      const invalidTitles = [
        '', // 空标题
        '   ', // 只有空格
        'A'.repeat(256), // 过长
        '\n\n\n' // 只有换行符
      ];

      invalidTitles.forEach(title => {
        const result = validatePRDDraft({ ...validPRDDraft, title });
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.field === 'title')).toBe(true);
      });
    });

    it('应该验证版本号格式', () => {
      const validVersions = [
        '1.0.0',
        '1.2.3',
        '10.20.30',
        '1.0.0-alpha',
        '1.0.0-beta.1',
        '1.0.0-rc.1',
        '2.0.0-preview.20240101'
      ];

      validVersions.forEach(version => {
        const result = validatePRDDraft({ ...validPRDDraft, version });
        expect(result.valid).toBe(true);
      });

      const invalidVersions = [
        '', // 空版本
        '1', // 不完整
        '1.0', // 不完整
        'v1.0.0', // 带前缀
        '1.0.0.0', // 四段式
        '1.a.0', // 非数字
        '01.0.0' // 前导零
      ];

      invalidVersions.forEach(version => {
        const result = validatePRDDraft({ ...validPRDDraft, version });
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.field === 'version')).toBe(true);
      });
    });

    it('应该验证内容结构', () => {
      // 有效内容
      const validContents = [
        { overview: '概述' },
        { overview: '概述', requirements: '需求' },
        { section1: '内容1', section2: '内容2', section3: '内容3' },
        {} // 空内容对象也允许
      ];

      validContents.forEach(content => {
        const result = validatePRDDraft({ ...validPRDDraft, content });
        expect(result.valid).toBe(true);
      });

      // 无效内容
      const invalidContents = [
        null,
        'string instead of object',
        [],
        { section1: null }, // null 值
        { section1: 123 }, // 非字符串值
        { '': 'empty key' }, // 空键名
        { 'key with spaces': 'value' } // 键名有空格
      ];

      invalidContents.forEach(content => {
        const result = validatePRDDraft({ ...validPRDDraft, content: content as any });
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.field === 'content')).toBe(true);
      });
    });

    it('应该验证标签数组', () => {
      // 有效标签
      const validTags = [
        [],
        ['tag1'],
        ['tag1', 'tag2', 'tag3'],
        ['中文标签', 'english-tag', 'mixed_tag']
      ];

      validTags.forEach(tags => {
        const result = validatePRDDraft({ ...validPRDDraft, tags });
        expect(result.valid).toBe(true);
      });

      // 无效标签
      const invalidTags = [
        'string instead of array',
        [123], // 非字符串元素
        [''], // 空字符串标签
        ['tag with spaces'],
        ['duplicate', 'duplicate'], // 重复标签
        new Array(21).fill('tag') // 超过最大数量
      ];

      invalidTags.forEach(tags => {
        const result = validatePRDDraft({ ...validPRDDraft, tags: tags as any });
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.field === 'tags')).toBe(true);
      });
    });

    it('应该验证权限配置', () => {
      const validPermissions = [
        undefined, // 可选字段
        {
          read: ['user1', 'user2'],
          write: ['user1'],
          review: ['admin']
        },
        {
          read: ['*'], // 通配符
          write: ['owner'],
          review: []
        }
      ];

      validPermissions.forEach(permissions => {
        const result = validatePRDDraft({ ...validPRDDraft, permissions });
        expect(result.valid).toBe(true);
      });

      const invalidPermissions = [
        { read: 'string instead of array' },
        { read: [123] }, // 非字符串用户
        { read: [''] }, // 空用户名
        { invalidKey: ['user'] }, // 无效权限类型
        { read: ['user1'], write: null } // null 值
      ];

      invalidPermissions.forEach(permissions => {
        const result = validatePRDDraft({ ...validPRDDraft, permissions: permissions as any });
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.field === 'permissions')).toBe(true);
      });
    });

    it('应该验证日期字段', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 1000);
      const past = new Date(now.getTime() - 1000);

      // 有效日期组合
      const validDates = [
        { createdAt: past, updatedAt: now },
        { createdAt: now, updatedAt: now },
        { createdAt: now, updatedAt: future }
      ];

      validDates.forEach(({ createdAt, updatedAt }) => {
        const result = validatePRDDraft({ ...validPRDDraft, createdAt, updatedAt });
        expect(result.valid).toBe(true);
      });

      // 无效日期：updatedAt 早于 createdAt
      const result = validatePRDDraft({
        ...validPRDDraft,
        createdAt: future,
        updatedAt: past
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.field === 'updatedAt')).toBe(true);
    });
  });

  describe('Factory Methods', () => {
    it('应该创建有效的 PRDDraft 实例', () => {
      const draftData = {
        title: '新建 PRD 文档',
        description: '通过工厂方法创建',
        templateId: 'basic-template',
        author: 'factory-test'
      };

      const draft = createPRDDraft(draftData);

      expect(isPRDDraft(draft)).toBe(true);
      expect(draft.title).toBe(draftData.title);
      expect(draft.description).toBe(draftData.description);
      expect(draft.templateId).toBe(draftData.templateId);
      expect(draft.author).toBe(draftData.author);
      expect(draft.status).toBe('draft');
      expect(draft.version).toBe('1.0.0');
      expect(draft.id).toMatch(/^prd-\d+$/);
      expect(draft.content).toEqual({});
      expect(draft.tags).toEqual([]);
      expect(draft.createdAt).toBeInstanceOf(Date);
      expect(draft.updatedAt).toBeInstanceOf(Date);
    });

    it('应该接受可选参数覆盖默认值', () => {
      const customData = {
        title: '自定义 PRD',
        description: '自定义描述',
        templateId: 'custom-template',
        author: 'custom-author',
        id: 'custom-id',
        status: 'in_review' as PRDStatus,
        version: '2.0.0',
        content: { overview: '自定义概述' },
        tags: ['自定义', '标签']
      };

      const draft = createPRDDraft(customData);

      expect(draft.id).toBe(customData.id);
      expect(draft.status).toBe(customData.status);
      expect(draft.version).toBe(customData.version);
      expect(draft.content).toEqual(customData.content);
      expect(draft.tags).toEqual(customData.tags);
    });

    it('应该生成唯一的 ID', () => {
      const ids = new Set();

      for (let i = 0; i < 100; i++) {
        const draft = createPRDDraft({
          title: `测试 ${i}`,
          description: '唯一性测试',
          templateId: 'test',
          author: 'test'
        });

        expect(ids.has(draft.id)).toBe(false);
        ids.add(draft.id);
      }
    });

    it('应该验证工厂方法的输入参数', () => {
      const invalidInputs = [
        { title: '', description: '空标题', templateId: 'test', author: 'test' },
        { title: '测试', description: '', templateId: 'test', author: 'test' },
        { title: '测试', description: '测试', templateId: '', author: 'test' },
        { title: '测试', description: '测试', templateId: 'test', author: '' }
      ];

      invalidInputs.forEach(input => {
        expect(() => createPRDDraft(input)).toThrow();
      });
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('应该处理最大长度的字段值', () => {
      const maxLengthDraft = {
        ...validPRDDraft,
        title: 'A'.repeat(255), // 最大标题长度
        description: 'B'.repeat(1000), // 最大描述长度
        content: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [`section${i}`, 'C'.repeat(2000)])
        ), // 最大内容
        tags: Array.from({ length: 20 }, (_, i) => `tag${i}`) // 最大标签数量
      };

      const result = validatePRDDraft(maxLengthDraft);
      expect(result.valid).toBe(true);
    });

    it('应该处理特殊字符', () => {
      const specialCharDraft = {
        ...validPRDDraft,
        title: '测试文档 - Special chars: @#$%^&*()',
        description: 'Description with émojis 🚀 and unicode ñáéíóú',
        content: {
          overview: 'Content with "quotes" and \'apostrophes\'',
          technical: 'Code snippets: console.log("Hello"); // comment'
        }
      };

      const result = validatePRDDraft(specialCharDraft);
      expect(result.valid).toBe(true);
    });

    it('应该处理极端日期值', () => {
      const extremeDates = [
        new Date('1970-01-01T00:00:00Z'), // Unix epoch
        new Date('2099-12-31T23:59:59Z'), // 远未来
        new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 一年后
      ];

      extremeDates.forEach(date => {
        const result = validatePRDDraft({
          ...validPRDDraft,
          createdAt: date,
          updatedAt: new Date(date.getTime() + 1000)
        });
        expect(result.valid).toBe(true);
      });
    });

    it('应该处理大型内容对象', () => {
      const largeContent: Record<string, string> = {};

      // 创建大量章节
      for (let i = 0; i < 100; i++) {
        largeContent[`section${i}`] = `这是第 ${i} 个章节的内容，包含详细的描述和技术细节。`.repeat(10);
      }

      const largeDraft = {
        ...validPRDDraft,
        content: largeContent
      };

      const result = validatePRDDraft(largeDraft);
      expect(result.valid).toBe(true);
    });

    it('应该正确处理 null 和 undefined 值', () => {
      const nullishValues = [null, undefined, '', 0, false, NaN];

      nullishValues.forEach(value => {
        // 测试可选字段
        const draftWithNullish = {
          ...validPRDDraft,
          tags: value === null || value === undefined ? value : validPRDDraft.tags,
          reviewStatus: value === null || value === undefined ? value : validPRDDraft.reviewStatus,
          permissions: value === null || value === undefined ? value : validPRDDraft.permissions
        };

        // 可选字段为 null/undefined 应该通过验证
        if (value === null || value === undefined) {
          const result = validatePRDDraft(draftWithNullish);
          expect(result.valid).toBe(true);
        }
      });
    });
  });

  describe('Performance and Memory', () => {
    it('应该高效处理大量验证请求', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        const draft = {
          ...validPRDDraft,
          id: `performance-test-${i}`,
          title: `性能测试文档 ${i}`
        };

        validatePRDDraft(draft);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 1000 次验证应该在 100ms 内完成
      expect(duration).toBeLessThan(100);
    });

    it('应该避免内存泄漏', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 10000; i++) {
        createPRDDraft({
          title: `内存测试 ${i}`,
          description: '内存测试描述',
          templateId: 'memory-test',
          author: 'test'
        });
      }

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 内存增长应该在合理范围内 (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Error Handling', () => {
    it('应该提供详细的验证错误信息', () => {
      const invalidDraft = {
        ...validPRDDraft,
        id: '', // 空 ID
        title: 'A'.repeat(300), // 标题过长
        version: 'invalid-version', // 无效版本
        tags: ['duplicate', 'duplicate'] // 重复标签
      };

      const result = validatePRDDraft(invalidDraft);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // 检查错误信息质量
      result.errors.forEach(error => {
        expect(error.field).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(5);
      });
    });

    it('应该处理循环引用和复杂对象', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const draftWithCircular = {
        ...validPRDDraft,
        content: circularObj
      };

      expect(() => validatePRDDraft(draftWithCircular)).not.toThrow();

      const result = validatePRDDraft(draftWithCircular);
      expect(result.valid).toBe(false);
    });

    it('应该优雅处理畸形输入', () => {
      const malformedInputs = [
        null,
        undefined,
        'string',
        123,
        [],
        new Date(),
        new RegExp('test'),
        Symbol('test'),
        function() {},
        new Map(),
        new Set()
      ];

      malformedInputs.forEach(input => {
        expect(() => validatePRDDraft(input as any)).not.toThrow();
        expect(() => isPRDDraft(input as any)).not.toThrow();

        const isValid = isPRDDraft(input as any);
        expect(isValid).toBe(false);
      });
    });
  });
});