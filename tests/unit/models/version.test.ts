/**
 * T039: Version Model Unit Tests
 *
 * Comprehensive unit tests for Version model including validation rules,
 * version comparison, change tracking, and snapshot management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  Version,
  VersionChange,
  VersionChangeType,
  createVersion,
  isVersion,
  validateVersion,
  compareVersions,
  parseVersion
} from '../../../src/models/version';

describe('Version Model', () => {
  let validVersion: Version;
  let validChange: VersionChange;

  beforeEach(() => {
    validChange = {
      type: 'update',
      section: 'overview',
      description: '更新产品概述内容',
      before: '旧的概述内容',
      after: '新的概述内容',
      lineNumber: 5,
      author: 'test-user'
    };

    validVersion = {
      id: 'version-001',
      draftId: 'prd-draft-001',
      version: '1.2.0',
      message: '更新产品概述和需求分析',
      changes: [validChange],
      author: 'product-manager',
      createdAt: new Date('2024-01-01T12:00:00Z'),
      snapshot: {
        content: {
          overview: '新的产品概述',
          requirements: '需求分析内容'
        },
        metadata: {
          title: 'PRD 文档 v1.2.0',
          status: 'draft',
          lastModified: new Date('2024-01-01T12:00:00Z')
        }
      },
      size: 1024,
      checksum: 'sha256:abcd1234'
    };
  });

  describe('Type Guards', () => {
    it('应该正确识别有效的 Version 对象', () => {
      expect(isVersion(validVersion)).toBe(true);
    });

    it('应该拒绝缺少必需字段的对象', () => {
      const requiredFields = ['id', 'draftId', 'version', 'message', 'changes', 'author', 'createdAt'];

      requiredFields.forEach(field => {
        const invalidVersion = { ...validVersion };
        delete (invalidVersion as any)[field];
        expect(isVersion(invalidVersion)).toBe(false);
      });
    });

    it('应该验证 changes 数组结构', () => {
      // 有效的 changes
      const validChangesArrays = [
        [validChange],
        [
          validChange,
          { ...validChange, type: 'create', section: 'new-section' }
        ],
        [] // 空数组也允许（初始版本）
      ];

      validChangesArrays.forEach(changes => {
        const version = { ...validVersion, changes };
        expect(isVersion(version)).toBe(true);
      });

      // 无效的 changes
      const invalidChangesArrays = [
        'not an array',
        [{ type: 'invalid-type' }], // 无效变更类型
        [{ ...validChange, type: undefined }], // 缺少必需字段
        null,
        undefined
      ];

      invalidChangesArrays.forEach(changes => {
        const version = { ...validVersion, changes: changes as any };
        expect(isVersion(version)).toBe(false);
      });
    });

    it('应该验证 VersionChangeType 枚举值', () => {
      const validTypes: VersionChangeType[] = ['create', 'update', 'delete', 'move', 'rename'];

      validTypes.forEach(type => {
        const change = { ...validChange, type };
        const version = { ...validVersion, changes: [change] };
        expect(isVersion(version)).toBe(true);
      });

      const invalidType = { ...validChange, type: 'invalid-type' };
      const version = { ...validVersion, changes: [invalidType] };
      expect(isVersion(version)).toBe(false);
    });

    it('应该正确处理可选字段', () => {
      // 最小版本
      const minimalVersion = {
        id: 'minimal-version',
        draftId: 'draft-001',
        version: '1.0.0',
        message: '初始版本',
        changes: [],
        author: 'test',
        createdAt: new Date()
      };

      expect(isVersion(minimalVersion)).toBe(true);

      // 带可选字段的版本
      const versionWithOptionals = {
        ...minimalVersion,
        snapshot: { content: {}, metadata: {} },
        size: 512,
        checksum: 'sha256:efgh5678',
        tags: ['release', 'stable']
      };

      expect(isVersion(versionWithOptionals)).toBe(true);
    });
  });

  describe('Version String Validation', () => {
    it('应该验证语义化版本格式', () => {
      const validVersions = [
        '1.0.0',
        '2.1.3',
        '10.20.30',
        '1.0.0-alpha',
        '1.0.0-alpha.1',
        '1.0.0-beta.2',
        '1.0.0-rc.1',
        '2.0.0-preview.20240101',
        '1.2.3-alpha.beta',
        '10.2.3-DEV.SNAPSHOT'
      ];

      validVersions.forEach(versionStr => {
        const version = { ...validVersion, version: versionStr };
        expect(validateVersion(version).valid).toBe(true);
      });

      const invalidVersions = [
        '', // 空版本
        '1', // 不完整
        '1.0', // 不完整
        'v1.0.0', // 带前缀
        '1.0.0.0', // 四段式
        '1.a.0', // 非数字
        '01.0.0', // 前导零
        '1.0.0-', // 末尾连字符
        '1.0.0+', // 末尾加号但无内容
        'invalid'
      ];

      invalidVersions.forEach(versionStr => {
        const version = { ...validVersion, version: versionStr };
        const result = validateVersion(version);
        expect(result.valid).toBe(false);
        expect(result.errors.some(error => error.field === 'version')).toBe(true);
      });
    });

    it('应该解析版本字符串组件', () => {
      const testCases = [
        {
          version: '1.2.3',
          expected: { major: 1, minor: 2, patch: 3, prerelease: undefined, build: undefined }
        },
        {
          version: '2.0.0-alpha.1',
          expected: { major: 2, minor: 0, patch: 0, prerelease: 'alpha.1', build: undefined }
        },
        {
          version: '1.0.0+20240101',
          expected: { major: 1, minor: 0, patch: 0, prerelease: undefined, build: '20240101' }
        },
        {
          version: '1.0.0-beta+exp.sha.5114f85',
          expected: { major: 1, minor: 0, patch: 0, prerelease: 'beta', build: 'exp.sha.5114f85' }
        }
      ];

      testCases.forEach(({ version, expected }) => {
        const parsed = parseVersion(version);
        expect(parsed).toEqual(expected);
      });
    });

    it('应该比较版本号大小', () => {
      const versionComparisons = [
        { v1: '1.0.0', v2: '2.0.0', expected: -1 },
        { v1: '2.0.0', v2: '1.0.0', expected: 1 },
        { v1: '1.0.0', v2: '1.0.0', expected: 0 },
        { v1: '1.0.0', v2: '1.0.1', expected: -1 },
        { v1: '1.0.1', v2: '1.0.0', expected: 1 },
        { v1: '1.1.0', v2: '1.0.1', expected: 1 },
        { v1: '1.0.0-alpha', v2: '1.0.0', expected: -1 },
        { v1: '1.0.0-alpha', v2: '1.0.0-beta', expected: -1 },
        { v1: '1.0.0-alpha.1', v2: '1.0.0-alpha.2', expected: -1 },
        { v1: '1.0.0-rc.1', v2: '1.0.0', expected: -1 }
      ];

      versionComparisons.forEach(({ v1, v2, expected }) => {
        const result = compareVersions(v1, v2);
        expect(result).toBe(expected);
      });
    });
  });

  describe('Version Change Validation', () => {
    it('应该验证变更类型和相关字段', () => {
      const changeValidationTests = [
        {
          change: { type: 'create', section: 'new-section', description: '创建新章节' },
          shouldBeValid: true
        },
        {
          change: { type: 'update', section: 'overview', description: '更新概述', before: '旧内容', after: '新内容' },
          shouldBeValid: true
        },
        {
          change: { type: 'delete', section: 'old-section', description: '删除旧章节' },
          shouldBeValid: true
        },
        {
          change: { type: 'move', section: 'overview', description: '移动章节', from: 'section1', to: 'section2' },
          shouldBeValid: true
        },
        {
          change: { type: 'rename', section: 'overview', description: '重命名章节', oldName: '旧名称', newName: '新名称' },
          shouldBeValid: true
        },
        {
          change: { type: 'update', section: '', description: '空章节名' }, // 无效：空章节
          shouldBeValid: false
        },
        {
          change: { type: 'create', description: '缺少章节名' }, // 无效：缺少章节
          shouldBeValid: false
        }
      ];

      changeValidationTests.forEach(({ change, shouldBeValid }) => {
        const version = {
          ...validVersion,
          changes: [{ ...validChange, ...change }]
        };

        const result = validateVersion(version);
        expect(result.valid).toBe(shouldBeValid);
      });
    });

    it('应该验证变更描述质量', () => {
      const validDescriptions = [
        '添加用户注册功能',
        'Update product overview section',
        '修复登录页面的显示问题',
        '重构数据访问层以提高性能',
        '添加单元测试覆盖核心业务逻辑'
      ];

      validDescriptions.forEach(description => {
        const change = { ...validChange, description };
        const version = { ...validVersion, changes: [change] };
        expect(validateVersion(version).valid).toBe(true);
      });

      const invalidDescriptions = [
        '', // 空描述
        '   ', // 只有空格
        'a', // 太短
        'A'.repeat(1001), // 太长
        '修改了一些东西', // 描述不够具体
        'change', // 英文太简单
        '!!!', // 只有标点符号
      ];

      invalidDescriptions.forEach(description => {
        const change = { ...validChange, description };
        const version = { ...validVersion, changes: [change] };
        const result = validateVersion(version);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证变更的完整性', () => {
      // 对于 update 类型，应该有 before 和 after
      const updateChange = {
        type: 'update' as VersionChangeType,
        section: 'overview',
        description: '更新概述',
        before: '旧内容',
        after: '新内容'
      };

      let version = { ...validVersion, changes: [updateChange] };
      expect(validateVersion(version).valid).toBe(true);

      // 缺少 before 应该失败
      const updateWithoutBefore = { ...updateChange, before: undefined };
      version = { ...validVersion, changes: [updateWithoutBefore] };
      expect(validateVersion(version).valid).toBe(false);

      // 对于 move 类型，应该有 from 和 to
      const moveChange = {
        type: 'move' as VersionChangeType,
        section: 'overview',
        description: '移动章节',
        from: 'position1',
        to: 'position2'
      };

      version = { ...validVersion, changes: [moveChange] };
      expect(validateVersion(version).valid).toBe(true);

      // 缺少 to 应该失败
      const moveWithoutTo = { ...moveChange, to: undefined };
      version = { ...validVersion, changes: [moveWithoutTo] };
      expect(validateVersion(version).valid).toBe(false);
    });
  });

  describe('Snapshot Validation', () => {
    it('应该验证快照内容结构', () => {
      const validSnapshots = [
        undefined, // 可选字段
        {
          content: {},
          metadata: {}
        },
        {
          content: {
            overview: '产品概述',
            requirements: '需求分析'
          },
          metadata: {
            title: 'PRD 文档',
            status: 'draft'
          }
        }
      ];

      validSnapshots.forEach(snapshot => {
        const version = { ...validVersion, snapshot };
        expect(validateVersion(version).valid).toBe(true);
      });

      const invalidSnapshots = [
        'string instead of object',
        { content: 'should be object' },
        { metadata: 'should be object' },
        { content: {}, metadata: {}, extraField: 'not allowed' }
      ];

      invalidSnapshots.forEach(snapshot => {
        const version = { ...validVersion, snapshot: snapshot as any };
        const result = validateVersion(version);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证快照大小和校验和', () => {
      const validSizeAndChecksum = [
        { size: 0, checksum: undefined }, // 空内容
        { size: 1024, checksum: 'sha256:abcd1234' },
        { size: 1048576, checksum: 'md5:ef12345' }, // 1MB
        { size: undefined, checksum: undefined } // 都为空
      ];

      validSizeAndChecksum.forEach(({ size, checksum }) => {
        const version = { ...validVersion, size, checksum };
        expect(validateVersion(version).valid).toBe(true);
      });

      const invalidSizeAndChecksum = [
        { size: -1, checksum: 'sha256:valid' }, // 负数大小
        { size: 'string', checksum: 'sha256:valid' }, // 非数字大小
        { size: 1024, checksum: '' }, // 空校验和
        { size: 1024, checksum: 'invalid-format' }, // 无效校验和格式
        { size: Number.MAX_SAFE_INTEGER + 1, checksum: 'sha256:valid' } // 过大
      ];

      invalidSizeAndChecksum.forEach(({ size, checksum }) => {
        const version = { ...validVersion, size: size as any, checksum: checksum as any };
        const result = validateVersion(version);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证校验和格式', () => {
      const validChecksums = [
        'sha256:1234567890abcdef',
        'md5:9e107d9d372bb6826bd81d3542a419d6',
        'sha1:aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
        'crc32:04c11db7'
      ];

      validChecksums.forEach(checksum => {
        const version = { ...validVersion, checksum };
        expect(validateVersion(version).valid).toBe(true);
      });

      const invalidChecksums = [
        'sha256:', // 空哈希值
        'invalid:1234', // 不支持的算法
        'sha256:xyz', // 非十六进制
        'sha256:123', // 长度不正确
        'SHA256:1234567890abcdef' // 大写算法名
      ];

      invalidChecksums.forEach(checksum => {
        const version = { ...validVersion, checksum };
        const result = validateVersion(version);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Factory Methods', () => {
    it('应该创建有效的 Version 实例', () => {
      const versionData = {
        draftId: 'new-draft',
        message: '初始版本',
        changes: [
          {
            type: 'create' as VersionChangeType,
            section: 'overview',
            description: '创建概述章节'
          }
        ],
        author: 'factory-test'
      };

      const version = createVersion(versionData);

      expect(isVersion(version)).toBe(true);
      expect(version.draftId).toBe(versionData.draftId);
      expect(version.message).toBe(versionData.message);
      expect(version.changes).toEqual(versionData.changes);
      expect(version.author).toBe(versionData.author);
      expect(version.version).toBe('1.0.0'); // 默认版本
      expect(version.id).toMatch(/^version-\d+$/);
      expect(version.createdAt).toBeInstanceOf(Date);
    });

    it('应该支持自定义版本号', () => {
      const versionData = {
        draftId: 'test-draft',
        version: '2.1.0-beta',
        message: '测试版本',
        changes: [],
        author: 'test'
      };

      const version = createVersion(versionData);
      expect(version.version).toBe('2.1.0-beta');
    });

    it('应该自动生成快照', () => {
      const content = {
        overview: '产品概述',
        requirements: '功能需求'
      };

      const versionData = {
        draftId: 'snapshot-test',
        message: '快照测试',
        changes: [],
        author: 'test',
        content
      };

      const version = createVersion(versionData);

      expect(version.snapshot).toBeDefined();
      expect(version.snapshot!.content).toEqual(content);
      expect(version.size).toBeGreaterThan(0);
      expect(version.checksum).toMatch(/^sha256:[a-f0-9]+$/);
    });

    it('应该生成唯一的版本 ID', () => {
      const ids = new Set();

      for (let i = 0; i < 50; i++) {
        const version = createVersion({
          draftId: `draft-${i}`,
          message: `版本 ${i}`,
          changes: [],
          author: 'test'
        });

        expect(ids.has(version.id)).toBe(false);
        ids.add(version.id);
      }
    });

    it('应该验证工厂方法的输入参数', () => {
      const invalidInputs = [
        { draftId: '', message: '空草稿ID', changes: [], author: 'test' },
        { draftId: 'draft', message: '', changes: [], author: 'test' },
        { draftId: 'draft', message: '测试', changes: [], author: '' },
        { draftId: 'draft', message: '测试', changes: 'not array', author: 'test' }
      ];

      invalidInputs.forEach(input => {
        expect(() => createVersion(input as any)).toThrow();
      });
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('应该处理大量变更记录', () => {
      const manyChanges: VersionChange[] = [];

      for (let i = 0; i < 1000; i++) {
        manyChanges.push({
          type: 'update',
          section: `section-${i}`,
          description: `更新章节 ${i}`,
          before: `旧内容 ${i}`,
          after: `新内容 ${i}`,
          author: 'bulk-test'
        });
      }

      const version = {
        ...validVersion,
        changes: manyChanges
      };

      const result = validateVersion(version);
      expect(result.valid).toBe(true);
    });

    it('应该处理极长的变更描述', () => {
      const longDescription = 'A'.repeat(1000); // 接近最大长度

      const change = {
        ...validChange,
        description: longDescription
      };

      const version = {
        ...validVersion,
        changes: [change]
      };

      const result = validateVersion(version);
      expect(result.valid).toBe(true);
    });

    it('应该处理大型快照内容', () => {
      const largeContent: Record<string, string> = {};

      for (let i = 0; i < 100; i++) {
        largeContent[`section-${i}`] = `这是第 ${i} 个章节的大量内容。`.repeat(100);
      }

      const version = {
        ...validVersion,
        snapshot: {
          content: largeContent,
          metadata: {
            title: '大型文档',
            sections: Object.keys(largeContent).length
          }
        },
        size: JSON.stringify(largeContent).length
      };

      const result = validateVersion(version);
      expect(result.valid).toBe(true);
    });

    it('应该处理特殊字符和多语言内容', () => {
      const multilingualChanges = [
        {
          type: 'update' as VersionChangeType,
          section: 'overview-en',
          description: 'Update with émojis 🚀 and unicode ñáéíóú',
          before: 'Old content with "quotes"',
          after: 'New content with special chars @#$%'
        },
        {
          type: 'create' as VersionChangeType,
          section: 'overview-zh',
          description: '添加中文内容，包含特殊符号：【】《》（）',
          author: '中文用户'
        }
      ];

      const version = {
        ...validVersion,
        message: 'Multi-language update 多语言更新',
        changes: multilingualChanges
      };

      const result = validateVersion(version);
      expect(result.valid).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    it('应该高效处理版本验证', () => {
      const startTime = Date.now();

      for (let i = 0; i < 200; i++) {
        const version = {
          ...validVersion,
          id: `performance-test-${i}`,
          version: `1.${i}.0`
        };

        validateVersion(version);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 200 次验证应该在 100ms 内完成
      expect(duration).toBeLessThan(100);
    });

    it('应该高效处理版本比较', () => {
      const versions = Array.from({ length: 100 }, (_, i) => `1.${i}.0`);

      const startTime = Date.now();

      // 比较所有版本对
      for (let i = 0; i < versions.length; i++) {
        for (let j = i + 1; j < versions.length; j++) {
          compareVersions(versions[i], versions[j]);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 大量版本比较应该在合理时间内完成
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Error Handling', () => {
    it('应该提供详细的验证错误信息', () => {
      const invalidVersion = {
        ...validVersion,
        version: 'invalid-version',
        message: '', // 空消息
        changes: [
          { ...validChange, type: 'invalid-type' }, // 无效类型
          { ...validChange, description: '' } // 空描述
        ]
      };

      const result = validateVersion(invalidVersion);

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

    it('应该处理版本比较的边界情况', () => {
      const edgeCases = [
        { v1: '1.0.0', v2: 'invalid', shouldThrow: true },
        { v1: 'invalid', v2: '1.0.0', shouldThrow: true },
        { v1: '', v2: '1.0.0', shouldThrow: true },
        { v1: '1.0.0', v2: '', shouldThrow: true }
      ];

      edgeCases.forEach(({ v1, v2, shouldThrow }) => {
        if (shouldThrow) {
          expect(() => compareVersions(v1, v2)).toThrow();
        } else {
          expect(() => compareVersions(v1, v2)).not.toThrow();
        }
      });
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
        expect(() => validateVersion(input as any)).not.toThrow();
        expect(() => isVersion(input as any)).not.toThrow();

        const isValid = isVersion(input as any);
        expect(isValid).toBe(false);
      });
    });
  });
});