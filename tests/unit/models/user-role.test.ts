/**
 * T039: UserRole Model Unit Tests
 *
 * Comprehensive unit tests for UserRole model including validation rules,
 * role hierarchy, permission management, and access control logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  UserRole,
  RoleType,
  Permission,
  PermissionScope,
  createUserRole,
  isUserRole,
  validateUserRole,
  hasPermission,
  canAccessResource,
  getRoleHierarchy,
  isHigherRole
} from '../../../src/models/user-role';

describe('UserRole Model', () => {
  let validUserRole: UserRole;

  beforeEach(() => {
    validUserRole = {
      id: 'role-001',
      userId: 'user-001',
      roleType: 'product_manager',
      displayName: '产品经理',
      permissions: [
        {
          action: 'read',
          resource: 'document',
          scope: 'all',
          conditions: {
            status: ['draft', 'in_review']
          }
        },
        {
          action: 'write',
          resource: 'document',
          scope: 'owned',
          conditions: {
            author: '${user.id}'
          }
        },
        {
          action: 'submit_review',
          resource: 'document',
          scope: 'owned'
        }
      ],
      metadata: {
        department: 'product',
        level: 'senior',
        assignedAt: new Date('2024-01-01T00:00:00Z'),
        assignedBy: 'admin-001',
        expiresAt: new Date('2025-01-01T00:00:00Z')
      },
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T12:00:00Z')
    };
  });

  describe('Type Guards', () => {
    it('应该正确识别有效的 UserRole 对象', () => {
      expect(isUserRole(validUserRole)).toBe(true);
    });

    it('应该拒绝缺少必需字段的对象', () => {
      const requiredFields = [
        'id', 'userId', 'roleType', 'displayName', 'permissions',
        'isActive', 'createdAt', 'updatedAt'
      ];

      requiredFields.forEach(field => {
        const invalidRole = { ...validUserRole };
        delete (invalidRole as any)[field];
        expect(isUserRole(invalidRole)).toBe(false);
      });
    });

    it('应该验证 RoleType 枚举值', () => {
      const validRoleTypes: RoleType[] = [
        'viewer', 'developer', 'tester', 'product_manager', 'architect', 'admin'
      ];

      validRoleTypes.forEach(roleType => {
        const role = { ...validUserRole, roleType };
        expect(isUserRole(role)).toBe(true);
      });

      const invalidRoleType = { ...validUserRole, roleType: 'invalid-role' };
      expect(isUserRole(invalidRoleType)).toBe(false);
    });

    it('应该验证权限数组结构', () => {
      // 有效的权限数组
      const validPermissions = [
        [], // 空权限（某些角色可能没有特殊权限）
        [
          {
            action: 'read',
            resource: 'document',
            scope: 'all' as PermissionScope
          }
        ],
        [
          {
            action: 'read',
            resource: 'document',
            scope: 'all' as PermissionScope
          },
          {
            action: 'write',
            resource: 'template',
            scope: 'department' as PermissionScope,
            conditions: { department: 'product' }
          }
        ]
      ];

      validPermissions.forEach(permissions => {
        const role = { ...validUserRole, permissions };
        expect(isUserRole(role)).toBe(true);
      });

      // 无效的权限数组
      const invalidPermissions = [
        'not an array',
        [{ action: 'read' }], // 缺少必需字段
        [{ action: 'invalid-action', resource: 'document', scope: 'all' }], // 无效动作
        [{ action: 'read', resource: 'document', scope: 'invalid-scope' }], // 无效范围
        null,
        undefined
      ];

      invalidPermissions.forEach(permissions => {
        const role = { ...validUserRole, permissions: permissions as any };
        expect(isUserRole(role)).toBe(false);
      });
    });

    it('应该正确处理可选字段', () => {
      // 最小用户角色
      const minimalRole = {
        id: 'minimal-role',
        userId: 'user-001',
        roleType: 'viewer' as RoleType,
        displayName: '查看者',
        permissions: [],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isUserRole(minimalRole)).toBe(true);

      // 带可选字段的角色
      const roleWithOptionals = {
        ...minimalRole,
        metadata: {
          department: 'engineering',
          level: 'junior',
          assignedAt: new Date()
        }
      };

      expect(isUserRole(roleWithOptionals)).toBe(true);
    });
  });

  describe('Permission Validation', () => {
    it('应该验证权限动作', () => {
      const validActions = [
        'read', 'write', 'delete', 'create', 'update',
        'submit_review', 'approve_review', 'publish', 'archive',
        'manage_users', 'manage_templates', 'manage_permissions'
      ];

      validActions.forEach(action => {
        const permission = {
          action,
          resource: 'document',
          scope: 'all' as PermissionScope
        };
        const role = { ...validUserRole, permissions: [permission] };
        expect(validateUserRole(role).valid).toBe(true);
      });

      const invalidActions = [
        '', // 空动作
        'invalid-action',
        'READ', // 大写
        'read write', // 包含空格
        '读取' // 中文
      ];

      invalidActions.forEach(action => {
        const permission = {
          action,
          resource: 'document',
          scope: 'all' as PermissionScope
        };
        const role = { ...validUserRole, permissions: [permission] };
        const result = validateUserRole(role);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证权限资源', () => {
      const validResources = [
        'document', 'template', 'user', 'role', 'review',
        'version', 'diagram', 'comment', 'notification', 'audit'
      ];

      validResources.forEach(resource => {
        const permission = {
          action: 'read',
          resource,
          scope: 'all' as PermissionScope
        };
        const role = { ...validUserRole, permissions: [permission] };
        expect(validateUserRole(role).valid).toBe(true);
      });

      const invalidResources = [
        '', // 空资源
        'invalid-resource',
        'DOCUMENT', // 大写
        'document template', // 包含空格
        '文档' // 中文
      ];

      invalidResources.forEach(resource => {
        const permission = {
          action: 'read',
          resource,
          scope: 'all' as PermissionScope
        };
        const role = { ...validUserRole, permissions: [permission] };
        const result = validateUserRole(role);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证权限范围', () => {
      const validScopes: PermissionScope[] = ['all', 'department', 'team', 'owned', 'none'];

      validScopes.forEach(scope => {
        const permission = {
          action: 'read',
          resource: 'document',
          scope
        };
        const role = { ...validUserRole, permissions: [permission] };
        expect(validateUserRole(role).valid).toBe(true);
      });

      const invalidScope = {
        action: 'read',
        resource: 'document',
        scope: 'invalid-scope' as PermissionScope
      };
      const role = { ...validUserRole, permissions: [invalidScope] };
      expect(validateUserRole(role).valid).toBe(false);
    });

    it('应该验证权限条件', () => {
      const validConditions = [
        undefined, // 无条件
        {},
        { status: ['draft', 'published'] },
        { author: '${user.id}' },
        { department: 'engineering', level: 'senior' },
        {
          tags: ['urgent'],
          createdAfter: '2024-01-01',
          size: { max: 1000000 }
        }
      ];

      validConditions.forEach(conditions => {
        const permission = {
          action: 'read',
          resource: 'document',
          scope: 'all' as PermissionScope,
          conditions
        };
        const role = { ...validUserRole, permissions: [permission] };
        expect(validateUserRole(role).valid).toBe(true);
      });

      const invalidConditions = [
        'string instead of object',
        { invalidKey: 'value' },
        { status: 'should be array' },
        { author: 123 }, // 非字符串
        null
      ];

      invalidConditions.forEach(conditions => {
        const permission = {
          action: 'read',
          resource: 'document',
          scope: 'all' as PermissionScope,
          conditions: conditions as any
        };
        const role = { ...validUserRole, permissions: [permission] };
        const result = validateUserRole(role);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Role Hierarchy and Access Control', () => {
    it('应该正确计算角色层次结构', () => {
      const hierarchy = getRoleHierarchy();

      // 验证层次结构的正确性
      expect(hierarchy['admin']).toBeGreaterThan(hierarchy['architect']);
      expect(hierarchy['architect']).toBeGreaterThan(hierarchy['product_manager']);
      expect(hierarchy['product_manager']).toBeGreaterThan(hierarchy['developer']);
      expect(hierarchy['developer']).toBeGreaterThan(hierarchy['tester']);
      expect(hierarchy['tester']).toBeGreaterThan(hierarchy['viewer']);
    });

    it('应该正确比较角色级别', () => {
      const roleComparisons = [
        { role1: 'admin', role2: 'architect', expected: true },
        { role1: 'architect', role2: 'product_manager', expected: true },
        { role1: 'product_manager', role2: 'developer', expected: true },
        { role1: 'developer', role2: 'tester', expected: true },
        { role1: 'tester', role2: 'viewer', expected: true },
        { role1: 'viewer', role2: 'admin', expected: false },
        { role1: 'developer', role2: 'developer', expected: false }
      ];

      roleComparisons.forEach(({ role1, role2, expected }) => {
        const result = isHigherRole(role1 as RoleType, role2 as RoleType);
        expect(result).toBe(expected);
      });
    });

    it('应该正确检查权限', () => {
      // 测试基本权限检查
      expect(hasPermission(validUserRole, 'read', 'document')).toBe(true);
      expect(hasPermission(validUserRole, 'write', 'document')).toBe(true);
      expect(hasPermission(validUserRole, 'delete', 'document')).toBe(false);
      expect(hasPermission(validUserRole, 'read', 'user')).toBe(false);

      // 测试带条件的权限检查
      const resourceContext = {
        status: 'draft',
        author: 'user-001'
      };

      expect(canAccessResource(
        validUserRole,
        'read',
        'document',
        resourceContext
      )).toBe(true);

      expect(canAccessResource(
        validUserRole,
        'write',
        'document',
        { ...resourceContext, author: 'other-user' }
      )).toBe(false);
    });

    it('应该处理复杂的权限条件', () => {
      const complexRole: UserRole = {
        ...validUserRole,
        permissions: [
          {
            action: 'read',
            resource: 'document',
            scope: 'department',
            conditions: {
              status: ['draft', 'in_review'],
              department: 'product',
              tags: ['high-priority']
            }
          },
          {
            action: 'write',
            resource: 'document',
            scope: 'owned',
            conditions: {
              author: '${user.id}',
              status: ['draft']
            }
          }
        ]
      };

      // 满足所有条件
      expect(canAccessResource(
        complexRole,
        'read',
        'document',
        {
          status: 'draft',
          department: 'product',
          tags: ['high-priority', 'feature']
        }
      )).toBe(true);

      // 不满足标签条件
      expect(canAccessResource(
        complexRole,
        'read',
        'document',
        {
          status: 'draft',
          department: 'product',
          tags: ['low-priority']
        }
      )).toBe(false);

      // 不满足部门条件
      expect(canAccessResource(
        complexRole,
        'read',
        'document',
        {
          status: 'draft',
          department: 'engineering',
          tags: ['high-priority']
        }
      )).toBe(false);
    });

    it('应该处理角色继承权限', () => {
      // 高级角色应该继承低级角色的基本权限
      const adminRole: UserRole = {
        ...validUserRole,
        roleType: 'admin',
        permissions: [
          {
            action: 'manage_users',
            resource: 'user',
            scope: 'all'
          }
        ]
      };

      // 管理员应该具有基本的读取权限（继承）
      expect(hasPermission(adminRole, 'read', 'document', true)).toBe(true);
      expect(hasPermission(adminRole, 'write', 'document', true)).toBe(true);
      expect(hasPermission(adminRole, 'manage_users', 'user')).toBe(true);
    });
  });

  describe('Factory Methods', () => {
    it('应该创建有效的 UserRole 实例', () => {
      const roleData = {
        userId: 'new-user',
        roleType: 'developer' as RoleType,
        displayName: '开发工程师',
        permissions: [
          {
            action: 'read',
            resource: 'document',
            scope: 'team' as PermissionScope
          }
        ]
      };

      const role = createUserRole(roleData);

      expect(isUserRole(role)).toBe(true);
      expect(role.userId).toBe(roleData.userId);
      expect(role.roleType).toBe(roleData.roleType);
      expect(role.displayName).toBe(roleData.displayName);
      expect(role.permissions).toEqual(roleData.permissions);
      expect(role.isActive).toBe(true);
      expect(role.id).toMatch(/^role-\d+$/);
      expect(role.createdAt).toBeInstanceOf(Date);
      expect(role.updatedAt).toBeInstanceOf(Date);
    });

    it('应该接受可选参数覆盖默认值', () => {
      const customData = {
        userId: 'custom-user',
        roleType: 'architect' as RoleType,
        displayName: '系统架构师',
        permissions: [],
        id: 'custom-role-id',
        isActive: false,
        metadata: {
          department: 'architecture',
          level: 'principal'
        }
      };

      const role = createUserRole(customData);

      expect(role.id).toBe(customData.id);
      expect(role.isActive).toBe(customData.isActive);
      expect(role.metadata).toEqual(customData.metadata);
    });

    it('应该根据角色类型设置默认权限', () => {
      const viewerRole = createUserRole({
        userId: 'viewer-user',
        roleType: 'viewer',
        displayName: '查看者'
      });

      const adminRole = createUserRole({
        userId: 'admin-user',
        roleType: 'admin',
        displayName: '管理员'
      });

      // 查看者应该只有基本读取权限
      expect(viewerRole.permissions.some(p => p.action === 'read')).toBe(true);
      expect(viewerRole.permissions.some(p => p.action === 'write')).toBe(false);

      // 管理员应该有更多权限
      expect(adminRole.permissions.some(p => p.action === 'manage_users')).toBe(true);
      expect(adminRole.permissions.some(p => p.scope === 'all')).toBe(true);
    });

    it('应该生成唯一的角色 ID', () => {
      const ids = new Set();

      for (let i = 0; i < 50; i++) {
        const role = createUserRole({
          userId: `user-${i}`,
          roleType: 'developer',
          displayName: `开发者 ${i}`
        });

        expect(ids.has(role.id)).toBe(false);
        ids.add(role.id);
      }
    });

    it('应该验证工厂方法的输入参数', () => {
      const invalidInputs = [
        { userId: '', roleType: 'developer', displayName: '开发者' },
        { userId: 'user', roleType: 'invalid', displayName: '开发者' },
        { userId: 'user', roleType: 'developer', displayName: '' },
        { userId: 'user', roleType: 'developer', displayName: '开发者', permissions: 'invalid' }
      ];

      invalidInputs.forEach(input => {
        expect(() => createUserRole(input as any)).toThrow();
      });
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('应该处理大量权限', () => {
      const manyPermissions: Permission[] = [];

      // 创建大量权限
      const actions = ['read', 'write', 'create', 'update', 'delete'];
      const resources = ['document', 'template', 'user', 'review', 'version'];
      const scopes: PermissionScope[] = ['all', 'department', 'team', 'owned'];

      actions.forEach(action => {
        resources.forEach(resource => {
          scopes.forEach(scope => {
            manyPermissions.push({ action, resource, scope });
          });
        });
      });

      const role = {
        ...validUserRole,
        permissions: manyPermissions
      };

      const result = validateUserRole(role);
      expect(result.valid).toBe(true);
    });

    it('应该处理复杂的权限条件', () => {
      const complexPermission: Permission = {
        action: 'write',
        resource: 'document',
        scope: 'department',
        conditions: {
          status: ['draft', 'in_review'],
          author: ['${user.id}', '${user.team_lead}'],
          department: '${user.department}',
          tags: ['urgent', 'high-priority'],
          created_after: '2024-01-01',
          size: { min: 1000, max: 100000 },
          template: {
            category: 'technical',
            version: { gte: '2.0.0' }
          }
        }
      };

      const role = {
        ...validUserRole,
        permissions: [complexPermission]
      };

      const result = validateUserRole(role);
      expect(result.valid).toBe(true);
    });

    it('应该处理特殊字符和多语言内容', () => {
      const multilingualRole = {
        ...validUserRole,
        displayName: 'Multi-language Role 多语言角色',
        metadata: {
          department: '产品部门',
          level: 'senior-级别',
          description: 'Role with émojis 🚀 and special chars @#$%'
        }
      };

      const result = validateUserRole(multilingualRole);
      expect(result.valid).toBe(true);
    });

    it('应该处理权限的边界情况', () => {
      // 测试权限范围的边界
      const edgeCasePermissions = [
        {
          action: 'read',
          resource: 'document',
          scope: 'none' as PermissionScope // 无权限
        },
        {
          action: 'read',
          resource: 'document',
          scope: 'all' as PermissionScope, // 全部权限
          conditions: {} // 空条件
        }
      ];

      const role = {
        ...validUserRole,
        permissions: edgeCasePermissions
      };

      const result = validateUserRole(role);
      expect(result.valid).toBe(true);

      // 测试权限检查
      expect(hasPermission(role, 'read', 'document')).toBe(true);
      expect(canAccessResource(role, 'read', 'document', {})).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    it('应该高效处理角色验证', () => {
      const startTime = Date.now();

      for (let i = 0; i < 200; i++) {
        const role = {
          ...validUserRole,
          id: `performance-test-${i}`
        };

        validateUserRole(role);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 200 次验证应该在 100ms 内完成
      expect(duration).toBeLessThan(100);
    });

    it('应该高效处理权限检查', () => {
      const complexRole = {
        ...validUserRole,
        permissions: Array.from({ length: 100 }, (_, i) => ({
          action: `action-${i}`,
          resource: `resource-${i % 10}`,
          scope: 'all' as PermissionScope,
          conditions: {
            [`condition-${i}`]: `value-${i}`
          }
        }))
      };

      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        hasPermission(complexRole, `action-${i % 100}`, `resource-${i % 10}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 大量权限检查应该在合理时间内完成
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Error Handling', () => {
    it('应该提供详细的验证错误信息', () => {
      const invalidRole = {
        ...validUserRole,
        roleType: 'invalid-role',
        permissions: [
          { action: '', resource: 'document', scope: 'all' }, // 空动作
          { action: 'read', resource: '', scope: 'all' }, // 空资源
          { action: 'read', resource: 'document', scope: 'invalid' } // 无效范围
        ]
      };

      const result = validateUserRole(invalidRole);

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

    it('应该处理权限检查的异常情况', () => {
      const edgeCases = [
        { role: null, action: 'read', resource: 'document' },
        { role: validUserRole, action: '', resource: 'document' },
        { role: validUserRole, action: 'read', resource: '' },
        { role: validUserRole, action: null, resource: 'document' }
      ];

      edgeCases.forEach(({ role, action, resource }) => {
        expect(() => hasPermission(role as any, action as any, resource as any)).not.toThrow();
        expect(hasPermission(role as any, action as any, resource as any)).toBe(false);
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
        expect(() => validateUserRole(input as any)).not.toThrow();
        expect(() => isUserRole(input as any)).not.toThrow();

        const isValid = isUserRole(input as any);
        expect(isValid).toBe(false);
      });
    });
  });
});