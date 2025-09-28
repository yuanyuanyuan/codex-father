/**
 * PermissionService 单元测试
 *
 * 测试范围：
 * - 用户管理 (创建、读取、更新、删除、列表)
 * - 角色管理 (创建、读取、更新、删除、列表)
 * - 基础权限检查 (读取、编辑、删除、审查、批准)
 * - 章节级权限管理
 * - 审查工作流权限
 * - 权限继承和层级
 * - 审计日志功能
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DefaultPermissionService,
  type PermissionService,
  type CreateUserRequest,
  type UpdateUserRequest,
  type UserFilter,
  type CreateRoleRequest,
  type UpdateRoleRequest,
  type SectionPermission,
  type AuditLogFilter
} from '../../../src/services/permission-service.js';
import {
  type UserRole,
  type Permission,
  type User,
  type RoleType
} from '../../../src/models/user-role.js';
import { type PRDDraft, type CollaborationData, type DocumentStatistics } from '../../../src/models/prd-draft.js';
import { type Template } from '../../../src/models/template.js';
import { type ReviewStatus } from '../../../src/models/review-status.js';
import { type Version } from '../../../src/models/version.js';

describe('PermissionService', () => {
  let permissionService: PermissionService;

  beforeEach(() => {
    permissionService = new DefaultPermissionService();
  });

  describe('User Management', () => {
    describe('createUser', () => {
      it('should create a user with valid role', async () => {
        const userData: CreateUserRequest = {
          id: 'user1',
          name: 'Test User',
          email: 'test@example.com',
          roleId: 'product_manager',
          profile: {
            title: 'Senior PM',
            department: 'Product',
            location: 'Remote'
          },
          preferences: {
            language: 'zh-CN',
            timezone: 'Asia/Shanghai',
            notifications: true
          }
        };

        const user = await permissionService.createUser(userData);

        expect(user).toBeDefined();
        expect(user.id).toBe('user1');
        expect(user.name).toBe('Test User');
        expect(user.email).toBe('test@example.com');
        expect(user.role.id).toBe('product_manager');
        expect(user.profile.title).toBe('Senior PM');
        expect(user.profile.department).toBe('Product');
        expect(user.preferences.language).toBe('zh-CN');
        expect(user.metadata.active).toBe(true);
        expect(user.metadata.loginCount).toBe(0);
      });

      it('should create user with minimal data', async () => {
        const userData: CreateUserRequest = {
          id: 'user2',
          name: 'Minimal User',
          email: 'minimal@example.com',
          roleId: 'developer'
        };

        const user = await permissionService.createUser(userData);

        expect(user.id).toBe('user2');
        expect(user.name).toBe('Minimal User');
        expect(user.role.id).toBe('developer');
        expect(user.profile.title).toBe('');
        expect(user.preferences.language).toBe('en');
        expect(user.preferences.notifications).toBe(true);
      });

      it('should throw error for invalid role', async () => {
        const userData: CreateUserRequest = {
          id: 'user3',
          name: 'Invalid Role User',
          email: 'invalid@example.com',
          roleId: 'non_existent_role'
        };

        await expect(permissionService.createUser(userData)).rejects.toThrow('Role not found: non_existent_role');
      });
    });

    describe('getUser', () => {
      it('should get an existing user', async () => {
        const userData: CreateUserRequest = {
          id: 'user4',
          name: 'Get Test User',
          email: 'get@example.com',
          roleId: 'architect'
        };

        await permissionService.createUser(userData);
        const user = await permissionService.getUser('user4');

        expect(user).toBeDefined();
        expect(user!.id).toBe('user4');
        expect(user!.name).toBe('Get Test User');
      });

      it('should return null for non-existent user', async () => {
        const user = await permissionService.getUser('non_existent_user');
        expect(user).toBeNull();
      });
    });

    describe('updateUser', () => {
      it('should update user fields', async () => {
        const userData: CreateUserRequest = {
          id: 'user5',
          name: 'Update Test User',
          email: 'update@example.com',
          roleId: 'developer'
        };

        await permissionService.createUser(userData);

        const updateData: UpdateUserRequest = {
          name: 'Updated Name',
          email: 'updated@example.com',
          roleId: 'product_manager',
          profile: {
            title: 'Updated Title'
          },
          preferences: {
            language: 'zh-CN'
          },
          active: false
        };

        const updatedUser = await permissionService.updateUser('user5', updateData);

        expect(updatedUser.name).toBe('Updated Name');
        expect(updatedUser.email).toBe('updated@example.com');
        expect(updatedUser.role.id).toBe('product_manager');
        expect(updatedUser.profile.title).toBe('Updated Title');
        expect(updatedUser.preferences.language).toBe('zh-CN');
        expect(updatedUser.metadata.active).toBe(false);
      });

      it('should throw error for non-existent user', async () => {
        const updateData: UpdateUserRequest = {
          name: 'Non-existent Update'
        };

        await expect(permissionService.updateUser('non_existent_user', updateData)).rejects.toThrow('User not found: non_existent_user');
      });

      it('should throw error for invalid role in update', async () => {
        const userData: CreateUserRequest = {
          id: 'user6',
          name: 'Role Update Test',
          email: 'roleupdate@example.com',
          roleId: 'developer'
        };

        await permissionService.createUser(userData);

        const updateData: UpdateUserRequest = {
          roleId: 'invalid_role'
        };

        await expect(permissionService.updateUser('user6', updateData)).rejects.toThrow('Role not found: invalid_role');
      });
    });

    describe('deleteUser', () => {
      it('should delete an existing user', async () => {
        const userData: CreateUserRequest = {
          id: 'user7',
          name: 'Delete Test User',
          email: 'delete@example.com',
          roleId: 'viewer'
        };

        await permissionService.createUser(userData);
        const result = await permissionService.deleteUser('user7');

        expect(result).toBe(true);

        const deletedUser = await permissionService.getUser('user7');
        expect(deletedUser).toBeNull();
      });

      it('should return false for non-existent user', async () => {
        const result = await permissionService.deleteUser('non_existent_user');
        expect(result).toBe(false);
      });
    });

    describe('listUsers', () => {
      beforeEach(async () => {
        // 创建测试用户
        await permissionService.createUser({
          id: 'list_user1',
          name: 'List User 1',
          email: 'list1@example.com',
          roleId: 'product_manager',
          profile: { department: 'Product' }
        });

        await permissionService.createUser({
          id: 'list_user2',
          name: 'List User 2',
          email: 'list2@example.com',
          roleId: 'developer',
          profile: { department: 'Engineering' }
        });

        await permissionService.createUser({
          id: 'list_user3',
          name: 'List User 3',
          email: 'list3@example.com',
          roleId: 'tester',
          profile: { department: 'QA' }
        });

        // 停用一个用户
        await permissionService.updateUser('list_user3', { active: false });
      });

      it('should list all users without filter', async () => {
        const users = await permissionService.listUsers();

        expect(users.length).toBeGreaterThanOrEqual(3);
        const testUsers = users.filter(u => u.id.startsWith('list_user'));
        expect(testUsers).toHaveLength(3);
      });

      it('should filter by role', async () => {
        const filter: UserFilter = { roleId: 'developer' };
        const users = await permissionService.listUsers(filter);

        expect(users.every(u => u.role.id === 'developer')).toBe(true);
        expect(users.some(u => u.id === 'list_user2')).toBe(true);
      });

      it('should filter by department', async () => {
        const filter: UserFilter = { department: 'Product' };
        const users = await permissionService.listUsers(filter);

        expect(users.every(u => u.profile.department === 'Product')).toBe(true);
        expect(users.some(u => u.id === 'list_user1')).toBe(true);
      });

      it('should filter by active status', async () => {
        const filter: UserFilter = { active: false };
        const users = await permissionService.listUsers(filter);

        expect(users.every(u => !u.metadata.active)).toBe(true);
        expect(users.some(u => u.id === 'list_user3')).toBe(true);
      });

      it('should search by name and email', async () => {
        const filter: UserFilter = { search: 'List User 1' };
        const users = await permissionService.listUsers(filter);

        expect(users.some(u => u.name.includes('List User 1'))).toBe(true);

        const emailFilter: UserFilter = { search: 'list2@example.com' };
        const emailUsers = await permissionService.listUsers(emailFilter);

        expect(emailUsers.some(u => u.email === 'list2@example.com')).toBe(true);
      });

      it('should apply pagination', async () => {
        const filter: UserFilter = { limit: 2, offset: 1 };
        const users = await permissionService.listUsers(filter);

        expect(users.length).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Role Management', () => {
    describe('createRole', () => {
      it('should create a custom role', async () => {
        const permissions: Permission[] = [
          { resource: 'prd_draft', action: 'read', conditions: [] },
          { resource: 'template', action: 'edit', conditions: [] }
        ];

        const roleData: CreateRoleRequest = {
          name: 'Custom Role',
          type: 'developer',
          description: 'A custom developer role',
          permissions,
          isDefault: false
        };

        const role = await permissionService.createRole(roleData);

        expect(role).toBeDefined();
        expect(role.id).toMatch(/^role_\d+$/);
        expect(role.name).toBe('Custom Role');
        expect(role.type).toBe('developer');
        expect(role.description).toBe('A custom developer role');
        expect(role.permissions).toEqual(permissions);
        expect(role.hierarchy.level).toBe(40); // Developer level
        expect(role.hierarchy.canDelegate).toBe(false);
        expect(role.metadata.isBuiltin).toBe(false);
        expect(role.metadata.isDefault).toBe(false);
      });

      it('should create role with inheritance', async () => {
        const permissions: Permission[] = [
          { resource: 'review', action: 'create', conditions: [] }
        ];

        const roleData: CreateRoleRequest = {
          name: 'Senior Developer',
          type: 'developer',
          description: 'A senior developer role',
          permissions,
          inheritsFrom: 'developer'
        };

        const role = await permissionService.createRole(roleData);

        expect(role.hierarchy.inheritsFrom).toEqual(['developer']);
      });
    });

    describe('getRole', () => {
      it('should get builtin roles', async () => {
        const architectRole = await permissionService.getRole('architect');

        expect(architectRole).toBeDefined();
        expect(architectRole!.id).toBe('architect');
        expect(architectRole!.type).toBe('architect');
        expect(architectRole!.metadata.isBuiltin).toBe(true);
      });

      it('should return null for non-existent role', async () => {
        const role = await permissionService.getRole('non_existent_role');
        expect(role).toBeNull();
      });
    });

    describe('updateRole', () => {
      it('should update custom role', async () => {
        const permissions: Permission[] = [
          { resource: 'prd_draft', action: 'read', conditions: [] }
        ];

        const roleData: CreateRoleRequest = {
          name: 'Update Test Role',
          type: 'developer',
          description: 'Role for update test',
          permissions
        };

        const role = await permissionService.createRole(roleData);

        const updateData: UpdateRoleRequest = {
          name: 'Updated Role',
          description: 'Updated description',
          permissions: [
            { resource: 'template', action: 'edit', conditions: [] }
          ],
          active: false
        };

        const updatedRole = await permissionService.updateRole(role.id, updateData);

        expect(updatedRole.name).toBe('Updated Role');
        expect(updatedRole.description).toBe('Updated description');
        expect(updatedRole.permissions).toEqual(updateData.permissions);
        expect(updatedRole.metadata.active).toBe(false);
      });

      it('should throw error for builtin role', async () => {
        const updateData: UpdateRoleRequest = {
          name: 'Modified Architect'
        };

        await expect(permissionService.updateRole('architect', updateData)).rejects.toThrow('Cannot modify builtin role');
      });

      it('should throw error for non-existent role', async () => {
        const updateData: UpdateRoleRequest = {
          name: 'Non-existent Update'
        };

        await expect(permissionService.updateRole('non_existent_role', updateData)).rejects.toThrow('Role not found: non_existent_role');
      });
    });

    describe('deleteRole', () => {
      it('should delete custom role', async () => {
        const permissions: Permission[] = [
          { resource: 'prd_draft', action: 'read', conditions: [] }
        ];

        const roleData: CreateRoleRequest = {
          name: 'Delete Test Role',
          type: 'viewer',
          description: 'Role for delete test',
          permissions
        };

        const role = await permissionService.createRole(roleData);
        const result = await permissionService.deleteRole(role.id);

        expect(result).toBe(true);

        const deletedRole = await permissionService.getRole(role.id);
        expect(deletedRole).toBeNull();
      });

      it('should throw error for builtin role', async () => {
        await expect(permissionService.deleteRole('architect')).rejects.toThrow('Cannot delete builtin role');
      });

      it('should throw error when users are using the role', async () => {
        const permissions: Permission[] = [
          { resource: 'prd_draft', action: 'read', conditions: [] }
        ];

        const roleData: CreateRoleRequest = {
          name: 'Role In Use',
          type: 'viewer',
          description: 'Role being used',
          permissions
        };

        const role = await permissionService.createRole(roleData);

        // 创建使用此角色的用户
        await permissionService.createUser({
          id: 'user_with_custom_role',
          name: 'User with Custom Role',
          email: 'custom@example.com',
          roleId: role.id
        });

        await expect(permissionService.deleteRole(role.id)).rejects.toThrow('Cannot delete role: 1 users are using this role');
      });

      it('should return false for non-existent role', async () => {
        const result = await permissionService.deleteRole('non_existent_role');
        expect(result).toBe(false);
      });
    });

    describe('listRoles', () => {
      it('should list all active roles', async () => {
        const roles = await permissionService.listRoles();

        expect(roles.length).toBeGreaterThanOrEqual(6); // 6 builtin roles
        expect(roles.every(r => r.metadata.active)).toBe(true);

        const builtinRoles = roles.filter(r => r.metadata.isBuiltin);
        expect(builtinRoles).toHaveLength(6);
      });

      it('should include custom roles', async () => {
        const permissions: Permission[] = [
          { resource: 'prd_draft', action: 'read', conditions: [] }
        ];

        const roleData: CreateRoleRequest = {
          name: 'List Test Role',
          type: 'viewer',
          description: 'Role for list test',
          permissions
        };

        await permissionService.createRole(roleData);

        const roles = await permissionService.listRoles();
        expect(roles.some(r => r.name === 'List Test Role')).toBe(true);
      });
    });
  });

  describe('Basic Permission Checking', () => {
    let testUser: User;
    let testDraft: PRDDraft;

    beforeEach(async () => {
      // 创建测试用户
      testUser = await permissionService.createUser({
        id: 'perm_test_user',
        name: 'Permission Test User',
        email: 'permtest@example.com',
        roleId: 'product_manager'
      });

      // 创建测试草稿
      const mockTemplate: Template = {
        id: 'test_template',
        name: 'Test Template',
        displayName: 'Test Template',
        description: 'Test template',
        version: '1.0.0',
        category: 'test',
        tags: [],
        isDefault: false,
        isPublic: true,
        structure: {
          sections: [{
            id: 'overview',
            title: 'Overview',
            description: 'Overview section',
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
        },
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
        createdBy: 'system'
      };

      const mockReviewStatus: ReviewStatus = {
        currentStatus: 'draft',
        phases: [],
        reviews: [],
        assignees: [],
        settings: {
          requireAllApprovals: false,
          allowSelfReview: false,
          autoMerge: false,
          requiredReviewers: 1
        },
        statistics: {
          totalReviews: 0,
          approvedReviews: 0,
          rejectedReviews: 0,
          averageReviewTime: 0,
          currentPhaseProgress: 0
        }
      };

      const mockVersion: Version = {
        id: 'version1',
        draftId: 'test_draft',
        versionNumber: 1,
        changeType: 'created',
        changes: [],
        contentSnapshot: 'test content',
        metadata: {
          author: testUser.id,
          timestamp: new Date(),
          message: 'Initial version',
          checksum: 'abc123',
          compressed: false,
          size: 100
        }
      };

      const mockCollaboration: CollaborationData = {
        activeEditors: [],
        editLocks: [],
        comments: [],
        suggestions: [],
        activityFeed: []
      };

      const mockStatistics: DocumentStatistics = {
        wordCount: 100,
        sectionCount: 1,
        lastModified: new Date(),
        viewCount: 0,
        editCount: 1,
        collaboratorCount: 1,
        versionCount: 1,
        reviewCount: 0
      };

      testDraft = {
        id: 'test_draft',
        title: 'Test Draft',
        content: 'Test content',
        template: mockTemplate,
        reviewStatus: mockReviewStatus,
        versions: [mockVersion],
        decisions: [],
        diagrams: [],
        metadata: {
          description: 'Test draft',
          priority: 'medium',
          category: 'test',
          tags: [],
          created: new Date(),
          updated: new Date(),
          lastAccessed: new Date(),
          version: '1.0.0',
          status: 'draft'
        },
        permissions: {
          owner: testUser.id,
          collaborators: [],
          viewers: [],
          public: false,
          inheritance: {
            from: null,
            depth: 0
          }
        },
        collaboration: mockCollaboration,
        statistics: mockStatistics
      };
    });

    describe('canRead', () => {
      it('should allow owner to read', async () => {
        const canRead = await permissionService.canRead(testUser.id, testDraft);
        expect(canRead).toBe(true);
      });

      it('should allow collaborators to read', async () => {
        const collaborator = await permissionService.createUser({
          id: 'collaborator',
          name: 'Collaborator',
          email: 'collab@example.com',
          roleId: 'developer'
        });

        testDraft.permissions.collaborators = [collaborator.id];
        const canRead = await permissionService.canRead(collaborator.id, testDraft);
        expect(canRead).toBe(true);
      });

      it('should allow viewers to read', async () => {
        const viewer = await permissionService.createUser({
          id: 'viewer_user',
          name: 'Viewer',
          email: 'viewer@example.com',
          roleId: 'viewer'
        });

        testDraft.permissions.viewers = [viewer.id];
        const canRead = await permissionService.canRead(viewer.id, testDraft);
        expect(canRead).toBe(true);
      });

      it('should allow public read for public resources', async () => {
        const randomUser = await permissionService.createUser({
          id: 'random_user',
          name: 'Random User',
          email: 'random@example.com',
          roleId: 'viewer'
        });

        testDraft.permissions.public = true;
        const canRead = await permissionService.canRead(randomUser.id, testDraft);
        expect(canRead).toBe(true);
      });

      it('should deny read for unauthorized users', async () => {
        const unauthorizedUser = await permissionService.createUser({
          id: 'unauthorized',
          name: 'Unauthorized',
          email: 'unauth@example.com',
          roleId: 'viewer'
        });

        const canRead = await permissionService.canRead(unauthorizedUser.id, testDraft);
        expect(canRead).toBe(false);
      });

      it('should deny read for inactive users', async () => {
        await permissionService.updateUser(testUser.id, { active: false });
        const canRead = await permissionService.canRead(testUser.id, testDraft);
        expect(canRead).toBe(false);
      });
    });

    describe('canEdit', () => {
      it('should allow owner to edit', async () => {
        const canEdit = await permissionService.canEdit(testUser.id, testDraft);
        expect(canEdit).toBe(true);
      });

      it('should allow users with edit permissions', async () => {
        const editor = await permissionService.createUser({
          id: 'editor',
          name: 'Editor',
          email: 'editor@example.com',
          roleId: 'product_manager'
        });

        const canEdit = await permissionService.canEdit(editor.id, testDraft);
        expect(canEdit).toBe(true);
      });

      it('should deny edit for users without permissions', async () => {
        const viewer = await permissionService.createUser({
          id: 'readonly_user',
          name: 'Read Only User',
          email: 'readonly@example.com',
          roleId: 'viewer'
        });

        const canEdit = await permissionService.canEdit(viewer.id, testDraft);
        expect(canEdit).toBe(false);
      });
    });

    describe('canDelete', () => {
      it('should allow architect to delete', async () => {
        const architect = await permissionService.createUser({
          id: 'architect_user',
          name: 'Architect',
          email: 'architect@example.com',
          roleId: 'architect'
        });

        const canDelete = await permissionService.canDelete(architect.id, testDraft);
        expect(canDelete).toBe(true);
      });

      it('should allow owner to delete', async () => {
        const canDelete = await permissionService.canDelete(testUser.id, testDraft);
        expect(canDelete).toBe(true);
      });

      it('should deny delete for lower-level users', async () => {
        const developer = await permissionService.createUser({
          id: 'dev_user',
          name: 'Developer',
          email: 'dev@example.com',
          roleId: 'developer'
        });

        const canDelete = await permissionService.canDelete(developer.id, testDraft);
        expect(canDelete).toBe(false);
      });
    });

    describe('canReview', () => {
      it('should allow reviewers to review', async () => {
        const reviewer = await permissionService.createUser({
          id: 'reviewer_user',
          name: 'Reviewer',
          email: 'reviewer@example.com',
          roleId: 'reviewer'
        });

        const canReview = await permissionService.canReview(reviewer.id, testDraft);
        expect(canReview).toBe(true);
      });

      it('should allow product managers to review', async () => {
        const canReview = await permissionService.canReview(testUser.id, testDraft);
        expect(canReview).toBe(true);
      });

      it('should deny review for viewers', async () => {
        const viewer = await permissionService.createUser({
          id: 'viewer_no_review',
          name: 'Viewer No Review',
          email: 'viewernoreview@example.com',
          roleId: 'viewer'
        });

        const canReview = await permissionService.canReview(viewer.id, testDraft);
        expect(canReview).toBe(false);
      });
    });

    describe('canApprove', () => {
      it('should allow architects to approve', async () => {
        const architect = await permissionService.createUser({
          id: 'architect_approve',
          name: 'Architect Approve',
          email: 'architectapprove@example.com',
          roleId: 'architect'
        });

        const canApprove = await permissionService.canApprove(architect.id, testDraft);
        expect(canApprove).toBe(true);
      });

      it('should allow product managers to approve', async () => {
        const canApprove = await permissionService.canApprove(testUser.id, testDraft);
        expect(canApprove).toBe(true);
      });

      it('should deny approval for developers', async () => {
        const developer = await permissionService.createUser({
          id: 'dev_no_approve',
          name: 'Developer No Approve',
          email: 'devnoapprove@example.com',
          roleId: 'developer'
        });

        const canApprove = await permissionService.canApprove(developer.id, testDraft);
        expect(canApprove).toBe(false);
      });
    });
  });

  describe('Section-level Permissions', () => {
    let testUser: User;
    let testDraft: PRDDraft;

    beforeEach(async () => {
      testUser = await permissionService.createUser({
        id: 'section_test_user',
        name: 'Section Test User',
        email: 'sectiontest@example.com',
        roleId: 'product_manager'
      });

      // 创建带有多个章节的测试草稿
      const mockTemplate: Template = {
        id: 'section_template',
        name: 'Section Template',
        displayName: 'Section Template',
        description: 'Template with sections',
        version: '1.0.0',
        category: 'test',
        tags: [],
        isDefault: false,
        isPublic: true,
        structure: {
          sections: [
            {
              id: 'overview',
              title: 'Overview',
              description: 'Overview section',
              order: 1,
              level: 2,
              isRequired: true,
              editableBy: ['product_manager'],
              visibleTo: [],
              fields: []
            },
            {
              id: 'technical',
              title: 'Technical Details',
              description: 'Technical section',
              order: 2,
              level: 2,
              isRequired: false,
              editableBy: ['architect'],
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
        },
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
        createdBy: 'system'
      };

      testDraft = {
        id: 'section_test_draft',
        title: 'Section Test Draft',
        content: 'Test content',
        template: mockTemplate,
        reviewStatus: {
          currentStatus: 'draft',
          phases: [],
          reviews: [],
          assignees: [],
          settings: {
            requireAllApprovals: false,
            allowSelfReview: false,
            autoMerge: false,
            requiredReviewers: 1
          },
          statistics: {
            totalReviews: 0,
            approvedReviews: 0,
            rejectedReviews: 0,
            averageReviewTime: 0,
            currentPhaseProgress: 0
          }
        },
        versions: [],
        decisions: [],
        diagrams: [],
        metadata: {
          description: 'Section test draft',
          priority: 'medium',
          category: 'test',
          tags: [],
          created: new Date(),
          updated: new Date(),
          lastAccessed: new Date(),
          version: '1.0.0',
          status: 'draft'
        },
        permissions: {
          owner: testUser.id,
          collaborators: [],
          viewers: [],
          public: false,
          inheritance: {
            from: null,
            depth: 0
          }
        },
        collaboration: {
          activeEditors: [],
          editLocks: [],
          comments: [],
          suggestions: [],
          activityFeed: []
        },
        statistics: {
          wordCount: 100,
          sectionCount: 2,
          lastModified: new Date(),
          viewCount: 0,
          editCount: 1,
          collaboratorCount: 1,
          versionCount: 1,
          reviewCount: 0
        }
      };
    });

    describe('canEditSection', () => {
      it('should allow editing section based on template permissions', async () => {
        const canEditOverview = await permissionService.canEditSection(testUser.id, testDraft, 'Overview');
        expect(canEditOverview).toBe(true);
      });

      it('should deny editing section without permission', async () => {
        const developer = await permissionService.createUser({
          id: 'dev_section',
          name: 'Developer Section',
          email: 'devsection@example.com',
          roleId: 'developer'
        });

        const canEditTechnical = await permissionService.canEditSection(developer.id, testDraft, 'Technical Details');
        expect(canEditTechnical).toBe(false);
      });

      it('should allow architect to edit any section', async () => {
        const architect = await permissionService.createUser({
          id: 'architect_section',
          name: 'Architect Section',
          email: 'architectsection@example.com',
          roleId: 'architect'
        });

        const canEditTechnical = await permissionService.canEditSection(architect.id, testDraft, 'Technical Details');
        expect(canEditTechnical).toBe(true);
      });

      it('should respect custom section permissions', async () => {
        const admin = await permissionService.createUser({
          id: 'admin_section',
          name: 'Admin Section',
          email: 'adminsection@example.com',
          roleId: 'architect'
        });

        const sectionPermission: SectionPermission = {
          allowRead: true,
          allowEdit: false,
          allowDelete: false
        };

        await permissionService.updateSectionPermissions(
          testDraft.id,
          'Overview',
          sectionPermission,
          admin.id
        );

        const canEditOverview = await permissionService.canEditSection(testUser.id, testDraft, 'Overview');
        expect(canEditOverview).toBe(false);
      });

      it('should evaluate condition permissions', async () => {
        const admin = await permissionService.createUser({
          id: 'admin_condition',
          name: 'Admin Condition',
          email: 'admincondition@example.com',
          roleId: 'architect'
        });

        const sectionPermission: SectionPermission = {
          allowRead: true,
          allowEdit: true,
          allowDelete: false,
          conditions: [{
            type: 'owner_only',
            value: true
          }]
        };

        await permissionService.updateSectionPermissions(
          testDraft.id,
          'Overview',
          sectionPermission,
          admin.id
        );

        // 所有者应该可以编辑
        const canEditAsOwner = await permissionService.canEditSection(testUser.id, testDraft, 'Overview');
        expect(canEditAsOwner).toBe(true);

        // 非所有者应该不能编辑
        const otherUser = await permissionService.createUser({
          id: 'other_user',
          name: 'Other User',
          email: 'other@example.com',
          roleId: 'product_manager'
        });

        const canEditAsOther = await permissionService.canEditSection(otherUser.id, testDraft, 'Overview');
        expect(canEditAsOther).toBe(false);
      });

      it('should respect time window restrictions', async () => {
        const admin = await permissionService.createUser({
          id: 'admin_time',
          name: 'Admin Time',
          email: 'admintime@example.com',
          roleId: 'architect'
        });

        const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 明天
        const pastTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 昨天

        const sectionPermission: SectionPermission = {
          allowRead: true,
          allowEdit: true,
          allowDelete: false,
          restrictions: {
            timeWindow: {
              start: futureTime,
              end: new Date(futureTime.getTime() + 60 * 60 * 1000) // 1小时窗口
            }
          }
        };

        await permissionService.updateSectionPermissions(
          testDraft.id,
          'Overview',
          sectionPermission,
          admin.id
        );

        const canEditNow = await permissionService.canEditSection(testUser.id, testDraft, 'Overview');
        expect(canEditNow).toBe(false); // 当前时间不在允许的时间窗口内
      });
    });

    describe('getSectionPermissions', () => {
      it('should return permissions for all sections', async () => {
        const permissions = await permissionService.getSectionPermissions(testUser.id, testDraft);

        expect(permissions).toBeDefined();
        expect(permissions['Overview']).toBeDefined();
        expect(permissions['Technical Details']).toBeDefined();
        expect(permissions['Overview'].allowRead).toBe(true);
        expect(permissions['Overview'].allowEdit).toBe(true);
        expect(permissions['Technical Details'].allowEdit).toBe(false); // PM无法编辑技术章节
      });
    });

    describe('updateSectionPermissions', () => {
      it('should allow admin to update section permissions', async () => {
        const admin = await permissionService.createUser({
          id: 'admin_update',
          name: 'Admin Update',
          email: 'adminupdate@example.com',
          roleId: 'architect'
        });

        const sectionPermission: SectionPermission = {
          allowRead: true,
          allowEdit: false,
          allowDelete: false
        };

        const result = await permissionService.updateSectionPermissions(
          testDraft.id,
          'Overview',
          sectionPermission,
          admin.id
        );

        expect(result).toBe(true);
      });

      it('should deny non-admin users from updating permissions', async () => {
        const regularUser = await permissionService.createUser({
          id: 'regular_update',
          name: 'Regular Update',
          email: 'regularupdate@example.com',
          roleId: 'developer'
        });

        const sectionPermission: SectionPermission = {
          allowRead: true,
          allowEdit: false,
          allowDelete: false
        };

        await expect(
          permissionService.updateSectionPermissions(
            testDraft.id,
            'Overview',
            sectionPermission,
            regularUser.id
          )
        ).rejects.toThrow('Permission denied: Only administrators can update section permissions');
      });
    });
  });

  describe('Review Workflow Permissions', () => {
    let testUser: User;
    let reviewer: User;
    let testDraft: PRDDraft;

    beforeEach(async () => {
      testUser = await permissionService.createUser({
        id: 'review_test_user',
        name: 'Review Test User',
        email: 'reviewtest@example.com',
        roleId: 'product_manager'
      });

      reviewer = await permissionService.createUser({
        id: 'reviewer_test',
        name: 'Reviewer Test',
        email: 'reviewertest@example.com',
        roleId: 'reviewer'
      });

      testDraft = {
        id: 'review_test_draft',
        title: 'Review Test Draft',
        content: 'Test content for review',
        template: {} as Template,
        reviewStatus: {
          currentStatus: 'draft',
          phases: [],
          reviews: [],
          assignees: [{
            userId: reviewer.id,
            assignedAt: new Date(),
            assignedBy: testUser.id,
            role: 'reviewer',
            permissions: ['review', 'comment']
          }],
          settings: {
            requireAllApprovals: false,
            allowSelfReview: false,
            autoMerge: false,
            requiredReviewers: 1
          },
          statistics: {
            totalReviews: 0,
            approvedReviews: 0,
            rejectedReviews: 0,
            averageReviewTime: 0,
            currentPhaseProgress: 0
          }
        },
        versions: [],
        decisions: [],
        diagrams: [],
        metadata: {
          description: 'Review test draft',
          priority: 'medium',
          category: 'test',
          tags: [],
          created: new Date(),
          updated: new Date(),
          lastAccessed: new Date(),
          version: '1.0.0',
          status: 'draft'
        },
        permissions: {
          owner: testUser.id,
          collaborators: [],
          viewers: [],
          public: false,
          inheritance: {
            from: null,
            depth: 0
          }
        },
        collaboration: {
          activeEditors: [],
          editLocks: [],
          comments: [],
          suggestions: [],
          activityFeed: []
        },
        statistics: {
          wordCount: 100,
          sectionCount: 1,
          lastModified: new Date(),
          viewCount: 0,
          editCount: 1,
          collaboratorCount: 1,
          versionCount: 1,
          reviewCount: 0
        }
      };
    });

    describe('canSubmitForReview', () => {
      it('should allow owner to submit for review', async () => {
        const canSubmit = await permissionService.canSubmitForReview(testUser.id, testDraft);
        expect(canSubmit).toBe(true);
      });

      it('should allow users with edit permissions to submit for review', async () => {
        const editor = await permissionService.createUser({
          id: 'editor_submit',
          name: 'Editor Submit',
          email: 'editorsubmit@example.com',
          roleId: 'product_manager'
        });

        const canSubmit = await permissionService.canSubmitForReview(editor.id, testDraft);
        expect(canSubmit).toBe(true);
      });

      it('should deny submission for users without edit permissions', async () => {
        const viewer = await permissionService.createUser({
          id: 'viewer_submit',
          name: 'Viewer Submit',
          email: 'viewersubmit@example.com',
          roleId: 'viewer'
        });

        const canSubmit = await permissionService.canSubmitForReview(viewer.id, testDraft);
        expect(canSubmit).toBe(false);
      });
    });

    describe('canAssignReviewer', () => {
      it('should allow architect to assign reviewers', async () => {
        const architect = await permissionService.createUser({
          id: 'architect_assign',
          name: 'Architect Assign',
          email: 'architectassign@example.com',
          roleId: 'architect'
        });

        const canAssign = await permissionService.canAssignReviewer(architect.id, testDraft, reviewer.id);
        expect(canAssign).toBe(true);
      });

      it('should allow product manager to assign reviewers', async () => {
        const canAssign = await permissionService.canAssignReviewer(testUser.id, testDraft, reviewer.id);
        expect(canAssign).toBe(true);
      });

      it('should allow owner to assign reviewers', async () => {
        const canAssign = await permissionService.canAssignReviewer(testUser.id, testDraft, reviewer.id);
        expect(canAssign).toBe(true);
      });

      it('should deny assignment for unauthorized users', async () => {
        const developer = await permissionService.createUser({
          id: 'dev_assign',
          name: 'Developer Assign',
          email: 'devassign@example.com',
          roleId: 'developer'
        });

        const canAssign = await permissionService.canAssignReviewer(developer.id, testDraft, reviewer.id);
        expect(canAssign).toBe(false);
      });
    });

    describe('canChangeReviewStatus', () => {
      it('should allow submitting for review', async () => {
        const canChange = await permissionService.canChangeReviewStatus(testUser.id, testDraft, 'in_review');
        expect(canChange).toBe(true);
      });

      it('should allow assigned reviewer to approve', async () => {
        const canApprove = await permissionService.canChangeReviewStatus(reviewer.id, testDraft, 'approved');
        expect(canApprove).toBe(true);
      });

      it('should allow assigned reviewer to reject', async () => {
        const canReject = await permissionService.canChangeReviewStatus(reviewer.id, testDraft, 'rejected');
        expect(canReject).toBe(true);
      });

      it('should allow assigned reviewer to request changes', async () => {
        const canRequestChanges = await permissionService.canChangeReviewStatus(reviewer.id, testDraft, 'changes_requested');
        expect(canRequestChanges).toBe(true);
      });

      it('should allow owner to revert to draft', async () => {
        const canRevertToDraft = await permissionService.canChangeReviewStatus(testUser.id, testDraft, 'draft');
        expect(canRevertToDraft).toBe(true);
      });

      it('should allow architect to revert to draft', async () => {
        const architect = await permissionService.createUser({
          id: 'architect_revert',
          name: 'Architect Revert',
          email: 'architectrevert@example.com',
          roleId: 'architect'
        });

        const canRevertToDraft = await permissionService.canChangeReviewStatus(architect.id, testDraft, 'draft');
        expect(canRevertToDraft).toBe(true);
      });

      it('should deny unauthorized status changes', async () => {
        const unauthorized = await permissionService.createUser({
          id: 'unauth_status',
          name: 'Unauthorized Status',
          email: 'unauthstatus@example.com',
          roleId: 'viewer'
        });

        const canChange = await permissionService.canChangeReviewStatus(unauthorized.id, testDraft, 'approved');
        expect(canChange).toBe(false);
      });
    });
  });

  describe('Permission Inheritance and Hierarchy', () => {
    let testUser: User;
    let testDraft: PRDDraft;

    beforeEach(async () => {
      // 创建具有继承关系的角色
      const customPermissions: Permission[] = [
        { resource: 'template', action: 'edit', conditions: [] }
      ];

      await permissionService.createRole({
        name: 'Senior Developer',
        type: 'developer',
        description: 'Senior developer with additional permissions',
        permissions: customPermissions,
        inheritsFrom: 'developer'
      });

      const roles = await permissionService.listRoles();
      const seniorDevRole = roles.find(r => r.name === 'Senior Developer');
      expect(seniorDevRole).toBeDefined();

      testUser = await permissionService.createUser({
        id: 'inherit_test_user',
        name: 'Inherit Test User',
        email: 'inherittest@example.com',
        roleId: seniorDevRole!.id
      });

      testDraft = {
        id: 'inherit_test_draft',
        title: 'Inherit Test Draft',
        content: 'Test content',
        template: {} as Template,
        reviewStatus: {} as ReviewStatus,
        versions: [],
        decisions: [],
        diagrams: [],
        metadata: {
          description: 'Inherit test draft',
          priority: 'medium',
          category: 'test',
          tags: [],
          created: new Date(),
          updated: new Date(),
          lastAccessed: new Date(),
          version: '1.0.0',
          status: 'draft'
        },
        permissions: {
          owner: 'someone_else',
          collaborators: [],
          viewers: [],
          public: false,
          inheritance: {
            from: null,
            depth: 0
          }
        },
        collaboration: {
          activeEditors: [],
          editLocks: [],
          comments: [],
          suggestions: [],
          activityFeed: []
        },
        statistics: {
          wordCount: 100,
          sectionCount: 1,
          lastModified: new Date(),
          viewCount: 0,
          editCount: 1,
          collaboratorCount: 1,
          versionCount: 1,
          reviewCount: 0
        }
      };
    });

    describe('getEffectivePermissions', () => {
      it('should return combined permissions from role and inheritance', async () => {
        const permissions = await permissionService.getEffectivePermissions(testUser.id, testDraft);

        expect(permissions.length).toBeGreaterThan(0);

        // 应该包含基础开发者权限
        expect(permissions.some(p => p.resource === 'prd_draft' && p.action === 'read')).toBe(true);

        // 应该包含继承的额外权限
        expect(permissions.some(p => p.resource === 'template' && p.action === 'edit')).toBe(true);
      });
    });

    describe('checkPermissionHierarchy', () => {
      it('should check if user role level is sufficient', async () => {
        const readPermission: Permission = {
          resource: 'prd_draft',
          action: 'read',
          conditions: []
        };

        const deletePermission: Permission = {
          resource: 'prd_draft',
          action: 'delete',
          conditions: []
        };

        const canRead = await permissionService.checkPermissionHierarchy(testUser.id, readPermission);
        expect(canRead).toBe(true); // Developer level >= read requirement

        const canDelete = await permissionService.checkPermissionHierarchy(testUser.id, deletePermission);
        expect(canDelete).toBe(false); // Developer level < delete requirement
      });
    });

    describe('resolvePermissionConflicts', () => {
      it('should resolve conflicts in favor of more permissive permissions', async () => {
        const conflictingPermissions: Permission[] = [
          { resource: 'prd_draft', action: 'read', conditions: [] },
          { resource: 'prd_draft', action: 'edit', conditions: [] },
          { resource: 'prd_draft', action: 'all', conditions: [] }
        ];

        const resolved = permissionService.resolvePermissionConflicts(conflictingPermissions);

        expect(resolved).toHaveLength(1);
        expect(resolved[0].action).toBe('all'); // Most permissive wins
      });

      it('should keep permissions for different resources', async () => {
        const permissions: Permission[] = [
          { resource: 'prd_draft', action: 'read', conditions: [] },
          { resource: 'template', action: 'edit', conditions: [] },
          { resource: 'review', action: 'create', conditions: [] }
        ];

        const resolved = permissionService.resolvePermissionConflicts(permissions);

        expect(resolved).toHaveLength(3);
        expect(resolved.some(p => p.resource === 'prd_draft')).toBe(true);
        expect(resolved.some(p => p.resource === 'template')).toBe(true);
        expect(resolved.some(p => p.resource === 'review')).toBe(true);
      });
    });
  });

  describe('Audit and Logging', () => {
    let testUser: User;
    let testDraft: PRDDraft;

    beforeEach(async () => {
      testUser = await permissionService.createUser({
        id: 'audit_test_user',
        name: 'Audit Test User',
        email: 'audittest@example.com',
        roleId: 'product_manager'
      });

      testDraft = {
        id: 'audit_test_draft',
        title: 'Audit Test Draft',
        content: 'Test content',
        template: {} as Template,
        reviewStatus: {} as ReviewStatus,
        versions: [],
        decisions: [],
        diagrams: [],
        metadata: {
          description: 'Audit test draft',
          priority: 'medium',
          category: 'test',
          tags: [],
          created: new Date(),
          updated: new Date(),
          lastAccessed: new Date(),
          version: '1.0.0',
          status: 'draft'
        },
        permissions: {
          owner: testUser.id,
          collaborators: [],
          viewers: [],
          public: false,
          inheritance: {
            from: null,
            depth: 0
          }
        },
        collaboration: {
          activeEditors: [],
          editLocks: [],
          comments: [],
          suggestions: [],
          activityFeed: []
        },
        statistics: {
          wordCount: 100,
          sectionCount: 1,
          lastModified: new Date(),
          viewCount: 0,
          editCount: 1,
          collaboratorCount: 1,
          versionCount: 1,
          reviewCount: 0
        }
      };
    });

    describe('logPermissionCheck', () => {
      it('should log permission checks', async () => {
        await permissionService.logPermissionCheck(testUser.id, 'read', testDraft, true);

        const auditLog = await permissionService.getPermissionAuditLog({});
        expect(auditLog.length).toBeGreaterThan(0);

        const logEntry = auditLog.find(entry =>
          entry.userId === testUser.id &&
          entry.action === 'read' &&
          entry.resourceId === testDraft.id
        );

        expect(logEntry).toBeDefined();
        expect(logEntry!.granted).toBe(true);
        expect(logEntry!.userName).toBe(testUser.name);
        expect(logEntry!.resourceType).toBe('prd_draft');
      });
    });

    describe('getPermissionAuditLog', () => {
      beforeEach(async () => {
        // 创建一些审计日志条目
        await permissionService.canRead(testUser.id, testDraft);
        await permissionService.canEdit(testUser.id, testDraft);
        await permissionService.canDelete(testUser.id, testDraft);
      });

      it('should return all audit entries without filter', async () => {
        const auditLog = await permissionService.getPermissionAuditLog({});
        expect(auditLog.length).toBeGreaterThanOrEqual(3);
      });

      it('should filter by user ID', async () => {
        const filter: AuditLogFilter = { userId: testUser.id };
        const auditLog = await permissionService.getPermissionAuditLog(filter);

        expect(auditLog.every(entry => entry.userId === testUser.id)).toBe(true);
      });

      it('should filter by action', async () => {
        const filter: AuditLogFilter = { action: 'read' };
        const auditLog = await permissionService.getPermissionAuditLog(filter);

        expect(auditLog.every(entry => entry.action === 'read')).toBe(true);
      });

      it('should filter by resource type', async () => {
        const filter: AuditLogFilter = { resourceType: 'prd_draft' };
        const auditLog = await permissionService.getPermissionAuditLog(filter);

        expect(auditLog.every(entry => entry.resourceType === 'prd_draft')).toBe(true);
      });

      it('should filter by resource ID', async () => {
        const filter: AuditLogFilter = { resourceId: testDraft.id };
        const auditLog = await permissionService.getPermissionAuditLog(filter);

        expect(auditLog.every(entry => entry.resourceId === testDraft.id)).toBe(true);
      });

      it('should filter by granted status', async () => {
        const filter: AuditLogFilter = { granted: true };
        const auditLog = await permissionService.getPermissionAuditLog(filter);

        expect(auditLog.every(entry => entry.granted === true)).toBe(true);
      });

      it('should filter by date range', async () => {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

        const filter: AuditLogFilter = {
          dateRange: {
            from: oneHourAgo,
            to: oneHourLater
          }
        };

        const auditLog = await permissionService.getPermissionAuditLog(filter);

        expect(auditLog.every(entry =>
          entry.timestamp >= oneHourAgo && entry.timestamp <= oneHourLater
        )).toBe(true);
      });

      it('should apply pagination', async () => {
        const filter: AuditLogFilter = { limit: 2, offset: 1 };
        const auditLog = await permissionService.getPermissionAuditLog(filter);

        expect(auditLog.length).toBeLessThanOrEqual(2);
      });

      it('should sort by timestamp descending', async () => {
        const auditLog = await permissionService.getPermissionAuditLog({});

        for (let i = 0; i < auditLog.length - 1; i++) {
          expect(auditLog[i].timestamp.getTime()).toBeGreaterThanOrEqual(auditLog[i + 1].timestamp.getTime());
        }
      });
    });
  });

  describe('Permission Context Evaluation', () => {
    let testUser: User;
    let testDraft: PRDDraft;

    beforeEach(async () => {
      testUser = await permissionService.createUser({
        id: 'context_test_user',
        name: 'Context Test User',
        email: 'contexttest@example.com',
        roleId: 'product_manager',
        profile: {
          department: 'Product'
        }
      });

      testDraft = {
        id: 'context_test_draft',
        title: 'Context Test Draft',
        content: 'Test content',
        template: {} as Template,
        reviewStatus: {} as ReviewStatus,
        versions: [],
        decisions: [],
        diagrams: [],
        metadata: {
          description: 'Context test draft',
          priority: 'medium',
          category: 'test',
          tags: [],
          created: new Date(),
          updated: new Date(),
          lastAccessed: new Date(),
          version: '1.0.0',
          status: 'draft'
        },
        permissions: {
          owner: testUser.id,
          collaborators: [],
          viewers: [],
          public: false,
          inheritance: {
            from: null,
            depth: 0
          }
        },
        collaboration: {
          activeEditors: [],
          editLocks: [],
          comments: [],
          suggestions: [],
          activityFeed: []
        },
        statistics: {
          wordCount: 100,
          sectionCount: 1,
          lastModified: new Date(),
          viewCount: 0,
          editCount: 1,
          collaboratorCount: 1,
          versionCount: 1,
          reviewCount: 0
        }
      };
    });

    it('should evaluate owner_only condition', async () => {
      // 创建具有条件权限的自定义角色
      const conditionalPermissions: Permission[] = [
        {
          resource: 'prd_draft',
          action: 'edit',
          conditions: [{
            type: 'owner_only',
            value: true
          }]
        }
      ];

      await permissionService.createRole({
        name: 'Conditional Editor',
        type: 'developer',
        description: 'Editor with owner-only condition',
        permissions: conditionalPermissions
      });

      const roles = await permissionService.listRoles();
      const conditionalRole = roles.find(r => r.name === 'Conditional Editor');
      expect(conditionalRole).toBeDefined();

      const conditionalUser = await permissionService.createUser({
        id: 'conditional_user',
        name: 'Conditional User',
        email: 'conditional@example.com',
        roleId: conditionalRole!.id
      });

      // 测试非所有者不能编辑
      const canEditAsNonOwner = await permissionService.canEdit(conditionalUser.id, testDraft);
      expect(canEditAsNonOwner).toBe(false);

      // 测试所有者可以编辑
      testDraft.permissions.owner = conditionalUser.id;
      const canEditAsOwner = await permissionService.canEdit(conditionalUser.id, testDraft);
      expect(canEditAsOwner).toBe(true);
    });

    it('should evaluate department condition', async () => {
      // 创建具有部门条件的自定义角色
      const departmentPermissions: Permission[] = [
        {
          resource: 'prd_draft',
          action: 'edit',
          conditions: [{
            type: 'department',
            value: 'Product'
          }]
        }
      ];

      await permissionService.createRole({
        name: 'Department Editor',
        type: 'developer',
        description: 'Editor with department condition',
        permissions: departmentPermissions
      });

      const roles = await permissionService.listRoles();
      const departmentRole = roles.find(r => r.name === 'Department Editor');
      expect(departmentRole).toBeDefined();

      // 正确部门的用户
      const productUser = await permissionService.createUser({
        id: 'product_user',
        name: 'Product User',
        email: 'product@example.com',
        roleId: departmentRole!.id,
        profile: {
          department: 'Product'
        }
      });

      // 错误部门的用户
      const engineeringUser = await permissionService.createUser({
        id: 'engineering_user',
        name: 'Engineering User',
        email: 'engineering@example.com',
        roleId: departmentRole!.id,
        profile: {
          department: 'Engineering'
        }
      });

      testDraft.permissions.owner = 'someone_else'; // 非所有者权限

      const canEditProduct = await permissionService.canEdit(productUser.id, testDraft);
      expect(canEditProduct).toBe(true);

      const canEditEngineering = await permissionService.canEdit(engineeringUser.id, testDraft);
      expect(canEditEngineering).toBe(false);
    });

    it('should evaluate role_level condition', async () => {
      // 创建具有角色级别条件的自定义角色
      const levelPermissions: Permission[] = [
        {
          resource: 'prd_draft',
          action: 'delete',
          conditions: [{
            type: 'role_level',
            value: 80 // 需要产品经理级别或以上
          }]
        }
      ];

      await permissionService.createRole({
        name: 'Level Deleter',
        type: 'developer',
        description: 'Deleter with level condition',
        permissions: levelPermissions
      });

      const roles = await permissionService.listRoles();
      const levelRole = roles.find(r => r.name === 'Level Deleter');
      expect(levelRole).toBeDefined();

      const levelUser = await permissionService.createUser({
        id: 'level_user',
        name: 'Level User',
        email: 'level@example.com',
        roleId: levelRole!.id
      });

      testDraft.permissions.owner = 'someone_else'; // 非所有者权限

      // 开发者级别(40)不足以满足条件(80)
      const canDelete = await permissionService.canDelete(levelUser.id, testDraft);
      expect(canDelete).toBe(false);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle non-existent users gracefully', async () => {
      const testDraft = {
        id: 'test_draft',
        permissions: { owner: 'non_existent_user' }
      };

      const canRead = await permissionService.canRead('non_existent_user', testDraft);
      expect(canRead).toBe(false);
    });

    it('should handle invalid resource types', async () => {
      const testUser = await permissionService.createUser({
        id: 'invalid_resource_user',
        name: 'Invalid Resource User',
        email: 'invalid@example.com',
        roleId: 'developer'
      });

      const invalidResource = { someField: 'someValue' };

      const canRead = await permissionService.canRead(testUser.id, invalidResource);
      expect(canRead).toBe(false);
    });

    it('should handle null/undefined resources', async () => {
      const testUser = await permissionService.createUser({
        id: 'null_resource_user',
        name: 'Null Resource User',
        email: 'null@example.com',
        roleId: 'developer'
      });

      const canReadNull = await permissionService.canRead(testUser.id, null);
      expect(canReadNull).toBe(false);

      const canReadUndefined = await permissionService.canRead(testUser.id, undefined);
      expect(canReadUndefined).toBe(false);
    });

    it('should maintain audit log size limit', async () => {
      const testUser = await permissionService.createUser({
        id: 'audit_limit_user',
        name: 'Audit Limit User',
        email: 'auditlimit@example.com',
        roleId: 'developer'
      });

      const testResource = { id: 'test_resource' };

      // 生成大量审计日志
      for (let i = 0; i < 50; i++) {
        await permissionService.logPermissionCheck(testUser.id, `action_${i}`, testResource, true);
      }

      const auditLog = await permissionService.getPermissionAuditLog({});
      expect(auditLog.length).toBeLessThanOrEqual(10000); // 验证日志大小限制
    });
  });
});