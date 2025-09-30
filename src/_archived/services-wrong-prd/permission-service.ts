/**
 * PermissionService - 权限和角色管理服务
 *
 * 核心功能：
 * - 基于角色的访问控制 (RBAC)
 * - 部分级别的编辑权限
 * - 权限检查和验证
 * - 审查工作流权限管理
 */

import {
  UserRole,
  RoleType,
  Permission,
  PermissionCondition,
  ResourceType,
  ActionType,
  User,
} from '../models/user-role.js';
import { PRDDraft } from '../models/prd-draft.js';
import { ReviewStatus } from '../models/review-status.js';

export interface PermissionService {
  // User and Role Management
  createUser(userData: CreateUserRequest): Promise<User>;
  getUser(userId: string): Promise<User | null>;
  updateUser(userId: string, userData: UpdateUserRequest): Promise<User>;
  deleteUser(userId: string): Promise<boolean>;
  listUsers(filter?: UserFilter): Promise<User[]>;

  // Role Management
  createRole(roleData: CreateRoleRequest): Promise<UserRole>;
  getRole(roleId: string): Promise<UserRole | null>;
  updateRole(roleId: string, roleData: UpdateRoleRequest): Promise<UserRole>;
  deleteRole(roleId: string): Promise<boolean>;
  listRoles(): Promise<UserRole[]>;

  // Permission Checking
  canRead(userId: string, resource: any): Promise<boolean>;
  canEdit(userId: string, resource: any): Promise<boolean>;
  canDelete(userId: string, resource: any): Promise<boolean>;
  canReview(userId: string, resource: any): Promise<boolean>;
  canApprove(userId: string, resource: any): Promise<boolean>;

  // Section-level Permissions
  canEditSection(userId: string, draft: PRDDraft, sectionName: string): Promise<boolean>;
  getSectionPermissions(userId: string, draft: PRDDraft): Promise<SectionPermissionMap>;
  updateSectionPermissions(
    draftId: string,
    sectionName: string,
    permissions: SectionPermission,
    adminUserId: string
  ): Promise<boolean>;

  // Review Workflow Permissions
  canSubmitForReview(userId: string, draft: PRDDraft): Promise<boolean>;
  canAssignReviewer(userId: string, draft: PRDDraft, reviewerUserId: string): Promise<boolean>;
  canChangeReviewStatus(userId: string, draft: PRDDraft, newStatus: string): Promise<boolean>;

  // Permission Inheritance and Hierarchy
  getEffectivePermissions(userId: string, resource: any): Promise<Permission[]>;
  checkPermissionHierarchy(userId: string, permission: Permission): Promise<boolean>;
  resolvePermissionConflicts(permissions: Permission[]): Permission[];

  // Audit and Logging
  logPermissionCheck(
    userId: string,
    action: string,
    resource: any,
    granted: boolean
  ): Promise<void>;
  getPermissionAuditLog(filter: AuditLogFilter): Promise<PermissionAuditEntry[]>;
}

// Request/Response Interfaces
export interface CreateUserRequest {
  id: string;
  name: string;
  email: string;
  roleId: string;
  profile?: {
    title?: string;
    department?: string;
    location?: string;
    avatar?: string;
  };
  preferences?: {
    language?: string;
    timezone?: string;
    notifications?: boolean;
  };
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  roleId?: string;
  profile?: Partial<User['profile']>;
  preferences?: Partial<User['preferences']>;
  active?: boolean;
}

export interface UserFilter {
  roleId?: string;
  department?: string;
  active?: boolean;
  search?: string; // 搜索姓名或邮箱
  limit?: number;
  offset?: number;
}

export interface CreateRoleRequest {
  name: string;
  type: RoleType;
  description: string;
  permissions: Permission[];
  inheritsFrom?: string; // 继承自其他角色
  isDefault?: boolean;
}

export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  permissions?: Permission[];
  inheritsFrom?: string;
  active?: boolean;
}

export interface SectionPermission {
  allowRead: boolean;
  allowEdit: boolean;
  allowDelete: boolean;
  conditions?: PermissionCondition[];
  restrictions?: {
    timeWindow?: {
      start: Date;
      end: Date;
    };
    approvalRequired?: boolean;
    maxEditsPerDay?: number;
  };
}

export interface SectionPermissionMap {
  [sectionName: string]: SectionPermission;
}

export interface PermissionAuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  granted: boolean;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface AuditLogFilter {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  granted?: boolean;
  dateRange?: {
    from: Date;
    to: Date;
  };
  limit?: number;
  offset?: number;
}

// Permission Context for complex decisions
export interface PermissionContext {
  user: User;
  resource: any;
  action: ActionType;
  conditions?: PermissionCondition[];
  time?: Date;
  environment?: 'production' | 'staging' | 'development';
}

/**
 * PermissionService 的默认实现
 *
 * 实现基于角色的访问控制，支持继承、条件权限和审计日志
 */
export class DefaultPermissionService implements PermissionService {
  private users: Map<string, User> = new Map();
  private roles: Map<string, UserRole> = new Map();
  private auditLog: PermissionAuditEntry[] = [];
  private sectionPermissions: Map<string, Map<string, SectionPermission>> = new Map(); // draftId -> sectionName -> permission

  constructor() {
    this.initializeDefaultRoles();
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    const role = this.roles.get(userData.roleId);
    if (!role) {
      throw new Error(`Role not found: ${userData.roleId}`);
    }

    const user: User = {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      role: role,
      profile: {
        title: userData.profile?.title || '',
        department: userData.profile?.department || '',
        location: userData.profile?.location || '',
        avatar: userData.profile?.avatar || '',
      },
      preferences: {
        language: userData.preferences?.language || 'en',
        timezone: userData.preferences?.timezone || 'UTC',
        notifications: userData.preferences?.notifications !== false,
      },
      metadata: {
        created: new Date(),
        lastLogin: null,
        active: true,
        loginCount: 0,
      },
    };

    this.users.set(user.id, user);
    return user;
  }

  async getUser(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async updateUser(userId: string, userData: UpdateUserRequest): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (userData.name) {
      user.name = userData.name;
    }
    if (userData.email) {
      user.email = userData.email;
    }
    if (userData.roleId) {
      const role = this.roles.get(userData.roleId);
      if (!role) {
        throw new Error(`Role not found: ${userData.roleId}`);
      }
      user.role = role;
    }
    if (userData.profile) {
      Object.assign(user.profile, userData.profile);
    }
    if (userData.preferences) {
      Object.assign(user.preferences, userData.preferences);
    }
    if (typeof userData.active === 'boolean') {
      user.metadata.active = userData.active;
    }

    this.users.set(userId, user);
    return user;
  }

  async deleteUser(userId: string): Promise<boolean> {
    return this.users.delete(userId);
  }

  async listUsers(filter?: UserFilter): Promise<User[]> {
    let users = Array.from(this.users.values());

    if (filter) {
      if (filter.roleId) {
        users = users.filter((u) => u.role.id === filter.roleId);
      }

      if (filter.department) {
        users = users.filter((u) => u.profile.department === filter.department);
      }

      if (typeof filter.active === 'boolean') {
        users = users.filter((u) => u.metadata.active === filter.active);
      }

      if (filter.search) {
        const search = filter.search.toLowerCase();
        users = users.filter(
          (u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search)
        );
      }

      // 分页
      if (filter.offset || filter.limit) {
        const start = filter.offset || 0;
        const end = filter.limit ? start + filter.limit : undefined;
        users = users.slice(start, end);
      }
    }

    return users;
  }

  async createRole(roleData: CreateRoleRequest): Promise<UserRole> {
    const role: UserRole = {
      id: `role_${Date.now()}`,
      name: roleData.name,
      type: roleData.type,
      description: roleData.description,
      permissions: roleData.permissions,
      hierarchy: {
        level: this.calculateRoleLevel(roleData.type),
        inheritsFrom: roleData.inheritsFrom ? [roleData.inheritsFrom] : [],
        canDelegate: this.canRoleDelegate(roleData.type),
      },
      metadata: {
        created: new Date(),
        updated: new Date(),
        active: true,
        isBuiltin: false,
        isDefault: roleData.isDefault || false,
      },
    };

    this.roles.set(role.id, role);
    return role;
  }

  async getRole(roleId: string): Promise<UserRole | null> {
    return this.roles.get(roleId) || null;
  }

  async updateRole(roleId: string, roleData: UpdateRoleRequest): Promise<UserRole> {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    if (role.metadata.isBuiltin) {
      throw new Error('Cannot modify builtin role');
    }

    if (roleData.name) {
      role.name = roleData.name;
    }
    if (roleData.description) {
      role.description = roleData.description;
    }
    if (roleData.permissions) {
      role.permissions = roleData.permissions;
    }
    if (roleData.inheritsFrom !== undefined) {
      role.hierarchy.inheritsFrom = roleData.inheritsFrom ? [roleData.inheritsFrom] : [];
    }
    if (typeof roleData.active === 'boolean') {
      role.metadata.active = roleData.active;
    }

    role.metadata.updated = new Date();
    this.roles.set(roleId, role);
    return role;
  }

  async deleteRole(roleId: string): Promise<boolean> {
    const role = this.roles.get(roleId);
    if (!role) {
      return false;
    }

    if (role.metadata.isBuiltin) {
      throw new Error('Cannot delete builtin role');
    }

    // 检查是否有用户在使用此角色
    const usersWithRole = Array.from(this.users.values()).filter((u) => u.role.id === roleId);
    if (usersWithRole.length > 0) {
      throw new Error(`Cannot delete role: ${usersWithRole.length} users are using this role`);
    }

    return this.roles.delete(roleId);
  }

  async listRoles(): Promise<UserRole[]> {
    return Array.from(this.roles.values()).filter((role) => role.metadata.active);
  }

  async canRead(userId: string, resource: any): Promise<boolean> {
    return this.checkPermission(userId, resource, 'read');
  }

  async canEdit(userId: string, resource: any): Promise<boolean> {
    return this.checkPermission(userId, resource, 'edit');
  }

  async canDelete(userId: string, resource: any): Promise<boolean> {
    return this.checkPermission(userId, resource, 'delete');
  }

  async canReview(userId: string, resource: any): Promise<boolean> {
    return this.checkPermission(userId, resource, 'review');
  }

  async canApprove(userId: string, resource: any): Promise<boolean> {
    return this.checkPermission(userId, resource, 'approve');
  }

  async canEditSection(userId: string, draft: PRDDraft, sectionName: string): Promise<boolean> {
    // 首先检查基本编辑权限
    const canEditDraft = await this.canEdit(userId, draft);
    if (!canEditDraft) {
      return false;
    }

    // 检查部分级权限
    const sectionPerms = this.sectionPermissions.get(draft.id);
    if (sectionPerms && sectionPerms.has(sectionName)) {
      const sectionPerm = sectionPerms.get(sectionName)!;

      if (!sectionPerm.allowEdit) {
        return false;
      }

      // 检查条件权限
      if (sectionPerm.conditions) {
        const user = await this.getUser(userId);
        if (!user) {
          return false;
        }

        for (const condition of sectionPerm.conditions) {
          if (!this.evaluateCondition(condition, { user, resource: draft, section: sectionName })) {
            return false;
          }
        }
      }

      // 检查限制条件
      if (sectionPerm.restrictions) {
        if (sectionPerm.restrictions.timeWindow) {
          const now = new Date();
          const { start, end } = sectionPerm.restrictions.timeWindow;
          if (now < start || now > end) {
            return false;
          }
        }

        if (sectionPerm.restrictions.approvalRequired) {
          // 检查是否有待审批的编辑请求
          // 这里简化处理，实际应该检查审批状态
        }
      }
    }

    return true;
  }

  async getSectionPermissions(userId: string, draft: PRDDraft): Promise<SectionPermissionMap> {
    const permissions: SectionPermissionMap = {};

    // 为模板中的每个部分生成权限映射
    for (const section of draft.template.structure.sections) {
      const canEdit = await this.canEditSection(userId, draft, section.name);
      const canRead = await this.canRead(userId, draft);

      permissions[section.name] = {
        allowRead: canRead,
        allowEdit: canEdit,
        allowDelete: canEdit && (await this.canDelete(userId, draft)),
      };
    }

    return permissions;
  }

  async updateSectionPermissions(
    draftId: string,
    sectionName: string,
    permissions: SectionPermission,
    adminUserId: string
  ): Promise<boolean> {
    const adminUser = await this.getUser(adminUserId);
    if (!adminUser || !this.isAdmin(adminUser)) {
      throw new Error('Permission denied: Only administrators can update section permissions');
    }

    if (!this.sectionPermissions.has(draftId)) {
      this.sectionPermissions.set(draftId, new Map());
    }

    this.sectionPermissions.get(draftId)!.set(sectionName, permissions);
    return true;
  }

  async canSubmitForReview(userId: string, draft: PRDDraft): Promise<boolean> {
    // 检查是否是所有者或有编辑权限
    if (draft.permissions.owner === userId) {
      return true;
    }

    return this.canEdit(userId, draft);
  }

  async canAssignReviewer(
    userId: string,
    draft: PRDDraft,
    reviewerUserId: string
  ): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) {
      return false;
    }

    // 架构师和产品经理可以分配审查者
    if (user.role.type === 'architect' || user.role.type === 'product_manager') {
      return true;
    }

    // 所有者可以分配审查者
    if (draft.permissions.owner === userId) {
      return true;
    }

    return false;
  }

  async canChangeReviewStatus(
    userId: string,
    draft: PRDDraft,
    newStatus: string
  ): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) {
      return false;
    }

    const currentStatus = draft.reviewStatus.currentStatus;

    // 状态转换权限检查
    switch (newStatus) {
      case 'in_review':
        return this.canSubmitForReview(userId, draft);

      case 'approved':
        return (
          user.role.type === 'architect' ||
          user.role.type === 'product_manager' ||
          this.isAssignedReviewer(userId, draft)
        );

      case 'rejected':
        return this.isAssignedReviewer(userId, draft);

      case 'changes_requested':
        return this.isAssignedReviewer(userId, draft);

      case 'draft':
        return draft.permissions.owner === userId || user.role.type === 'architect';

      default:
        return false;
    }
  }

  async getEffectivePermissions(userId: string, resource: any): Promise<Permission[]> {
    const user = await this.getUser(userId);
    if (!user) {
      return [];
    }

    let permissions: Permission[] = [...user.role.permissions];

    // 添加继承的权限
    for (const inheritedRoleId of user.role.hierarchy.inheritsFrom) {
      const inheritedRole = await this.getRole(inheritedRoleId);
      if (inheritedRole) {
        permissions.push(...inheritedRole.permissions);
      }
    }

    // 解决权限冲突
    permissions = this.resolvePermissionConflicts(permissions);

    // 过滤适用于当前资源的权限
    const resourceType = this.getResourceType(resource);
    return permissions.filter((p) => p.resource === resourceType || p.resource === 'all');
  }

  async checkPermissionHierarchy(userId: string, permission: Permission): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) {
      return false;
    }

    // 检查用户角色层级是否足够
    const requiredLevel = this.getPermissionRequiredLevel(permission);
    return user.role.hierarchy.level >= requiredLevel;
  }

  resolvePermissionConflicts(permissions: Permission[]): Permission[] {
    const permissionMap = new Map<string, Permission>();

    for (const permission of permissions) {
      const key = `${permission.resource}:${permission.action}`;
      const existing = permissionMap.get(key);

      if (!existing) {
        permissionMap.set(key, permission);
      } else {
        // 解决冲突：更宽松的权限优先
        if (this.isMorePermissive(permission, existing)) {
          permissionMap.set(key, permission);
        }
      }
    }

    return Array.from(permissionMap.values());
  }

  async logPermissionCheck(
    userId: string,
    action: string,
    resource: any,
    granted: boolean
  ): Promise<void> {
    const user = await this.getUser(userId);
    const entry: PermissionAuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2)}`,
      timestamp: new Date(),
      userId,
      userName: user?.name || 'Unknown',
      action,
      resourceType: this.getResourceType(resource),
      resourceId: this.getResourceId(resource),
      granted,
      metadata: {
        userRole: user?.role.type,
        resourceData: this.sanitizeResourceData(resource),
      },
    };

    this.auditLog.push(entry);

    // 保持审计日志大小
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  async getPermissionAuditLog(filter: AuditLogFilter): Promise<PermissionAuditEntry[]> {
    let entries = [...this.auditLog];

    if (filter.userId) {
      entries = entries.filter((e) => e.userId === filter.userId);
    }

    if (filter.action) {
      entries = entries.filter((e) => e.action === filter.action);
    }

    if (filter.resourceType) {
      entries = entries.filter((e) => e.resourceType === filter.resourceType);
    }

    if (filter.resourceId) {
      entries = entries.filter((e) => e.resourceId === filter.resourceId);
    }

    if (typeof filter.granted === 'boolean') {
      entries = entries.filter((e) => e.granted === filter.granted);
    }

    if (filter.dateRange) {
      entries = entries.filter(
        (e) => e.timestamp >= filter.dateRange!.from && e.timestamp <= filter.dateRange!.to
      );
    }

    // 按时间排序（最新的在前）
    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // 分页
    if (filter.offset || filter.limit) {
      const start = filter.offset || 0;
      const end = filter.limit ? start + filter.limit : undefined;
      entries = entries.slice(start, end);
    }

    return entries;
  }

  // 私有辅助方法
  private async checkPermission(
    userId: string,
    resource: any,
    action: ActionType
  ): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user || !user.metadata.active) {
      await this.logPermissionCheck(userId, action, resource, false);
      return false;
    }

    const resourceType = this.getResourceType(resource);
    const effectivePermissions = await this.getEffectivePermissions(userId, resource);

    // 检查特定权限
    const hasPermission = effectivePermissions.some((p) => {
      if (p.resource !== resourceType && p.resource !== 'all') {
        return false;
      }
      if (p.action !== action && p.action !== 'all') {
        return false;
      }

      // 检查条件权限
      if (p.conditions) {
        return p.conditions.every((condition) =>
          this.evaluateCondition(condition, { user, resource, action })
        );
      }

      return true;
    });

    // 特殊规则检查
    if (!hasPermission && resource && typeof resource === 'object') {
      // 所有者权限
      if (resource.permissions?.owner === userId) {
        await this.logPermissionCheck(userId, action, resource, true);
        return true;
      }

      // 协作者权限
      if (action === 'read' && resource.permissions?.collaborators?.includes(userId)) {
        await this.logPermissionCheck(userId, action, resource, true);
        return true;
      }

      // 观察者权限
      if (action === 'read' && resource.permissions?.viewers?.includes(userId)) {
        await this.logPermissionCheck(userId, action, resource, true);
        return true;
      }

      // 公开资源读取权限
      if (action === 'read' && resource.permissions?.public) {
        await this.logPermissionCheck(userId, action, resource, true);
        return true;
      }
    }

    await this.logPermissionCheck(userId, action, resource, hasPermission);
    return hasPermission;
  }

  private initializeDefaultRoles(): void {
    const defaultRoles: UserRole[] = [
      {
        id: 'architect',
        name: 'Architect',
        type: 'architect',
        description: 'System architect with full permissions',
        permissions: [{ resource: 'all', action: 'all', conditions: [] }],
        hierarchy: {
          level: 100,
          inheritsFrom: [],
          canDelegate: true,
        },
        metadata: {
          created: new Date(),
          updated: new Date(),
          active: true,
          isBuiltin: true,
          isDefault: false,
        },
      },
      {
        id: 'product_manager',
        name: 'Product Manager',
        type: 'product_manager',
        description: 'Product manager with business requirements permissions',
        permissions: [
          { resource: 'prd_draft', action: 'all', conditions: [] },
          { resource: 'template', action: 'read', conditions: [] },
          { resource: 'review', action: 'all', conditions: [] },
        ],
        hierarchy: {
          level: 80,
          inheritsFrom: [],
          canDelegate: true,
        },
        metadata: {
          created: new Date(),
          updated: new Date(),
          active: true,
          isBuiltin: true,
          isDefault: true,
        },
      },
      {
        id: 'developer',
        name: 'Developer',
        type: 'developer',
        description: 'Developer with read and review permissions',
        permissions: [
          { resource: 'prd_draft', action: 'read', conditions: [] },
          { resource: 'template', action: 'read', conditions: [] },
          { resource: 'review', action: 'create', conditions: [] },
          { resource: 'review', action: 'read', conditions: [] },
        ],
        hierarchy: {
          level: 40,
          inheritsFrom: [],
          canDelegate: false,
        },
        metadata: {
          created: new Date(),
          updated: new Date(),
          active: true,
          isBuiltin: true,
          isDefault: false,
        },
      },
      {
        id: 'tester',
        name: 'Tester',
        type: 'tester',
        description: 'Tester with testing-related permissions',
        permissions: [
          { resource: 'prd_draft', action: 'read', conditions: [] },
          { resource: 'template', action: 'read', conditions: [] },
          {
            resource: 'review',
            action: 'create',
            conditions: [{ type: 'section_access', value: 'testing' }],
          },
        ],
        hierarchy: {
          level: 30,
          inheritsFrom: [],
          canDelegate: false,
        },
        metadata: {
          created: new Date(),
          updated: new Date(),
          active: true,
          isBuiltin: true,
          isDefault: false,
        },
      },
      {
        id: 'reviewer',
        name: 'Reviewer',
        type: 'reviewer',
        description: 'Reviewer with review permissions',
        permissions: [
          { resource: 'prd_draft', action: 'read', conditions: [] },
          { resource: 'review', action: 'all', conditions: [] },
        ],
        hierarchy: {
          level: 50,
          inheritsFrom: [],
          canDelegate: false,
        },
        metadata: {
          created: new Date(),
          updated: new Date(),
          active: true,
          isBuiltin: true,
          isDefault: false,
        },
      },
      {
        id: 'viewer',
        name: 'Viewer',
        type: 'viewer',
        description: 'Viewer with read-only permissions',
        permissions: [
          { resource: 'prd_draft', action: 'read', conditions: [] },
          { resource: 'template', action: 'read', conditions: [] },
        ],
        hierarchy: {
          level: 10,
          inheritsFrom: [],
          canDelegate: false,
        },
        metadata: {
          created: new Date(),
          updated: new Date(),
          active: true,
          isBuiltin: true,
          isDefault: false,
        },
      },
    ];

    for (const role of defaultRoles) {
      this.roles.set(role.id, role);
    }
  }

  private calculateRoleLevel(roleType: RoleType): number {
    const levels: Record<RoleType, number> = {
      architect: 100,
      product_manager: 80,
      reviewer: 50,
      developer: 40,
      tester: 30,
      viewer: 10,
    };
    return levels[roleType] || 0;
  }

  private canRoleDelegate(roleType: RoleType): boolean {
    return ['architect', 'product_manager', 'reviewer'].includes(roleType);
  }

  private evaluateCondition(condition: PermissionCondition, context: any): boolean {
    switch (condition.type) {
      case 'owner_only':
        return context.resource?.permissions?.owner === context.user?.id;

      case 'time_window':
        const now = new Date();
        const start = new Date(condition.value.start);
        const end = new Date(condition.value.end);
        return now >= start && now <= end;

      case 'section_access':
        return context.section === condition.value || context.user?.role?.type === 'architect';

      case 'role_level':
        return context.user?.role?.hierarchy?.level >= condition.value;

      case 'department':
        return context.user?.profile?.department === condition.value;

      default:
        return true;
    }
  }

  private isAdmin(user: User): boolean {
    return user.role.type === 'architect';
  }

  private isAssignedReviewer(userId: string, draft: PRDDraft): boolean {
    return draft.reviewStatus.assignees.some((assignee) => assignee.userId === userId);
  }

  private getResourceType(resource: any): ResourceType {
    if (!resource || typeof resource !== 'object') {
      return 'unknown';
    }

    if (resource.id && resource.title && resource.content) {
      return 'prd_draft';
    }
    if (resource.id && resource.name && resource.structure) {
      return 'template';
    }
    if (resource.id && resource.currentStatus) {
      return 'review';
    }
    if (resource.id && resource.versionNumber) {
      return 'version';
    }
    if (resource.id && resource.type === 'decision') {
      return 'decision';
    }

    return 'unknown';
  }

  private getResourceId(resource: any): string {
    return resource?.id || 'unknown';
  }

  private getPermissionRequiredLevel(permission: Permission): number {
    // 根据权限类型返回所需的最低角色级别
    if (permission.action === 'delete') {
      return 80;
    }
    if (permission.action === 'approve') {
      return 70;
    }
    if (permission.action === 'edit') {
      return 40;
    }
    if (permission.action === 'read') {
      return 10;
    }
    return 50;
  }

  private isMorePermissive(perm1: Permission, perm2: Permission): boolean {
    // 简化的权限比较逻辑
    if (perm1.action === 'all') {
      return true;
    }
    if (perm2.action === 'all') {
      return false;
    }

    const actionHierarchy: Record<string, number> = {
      read: 1,
      edit: 2,
      delete: 3,
      approve: 4,
      all: 5,
    };

    return (actionHierarchy[perm1.action] || 0) > (actionHierarchy[perm2.action] || 0);
  }

  private sanitizeResourceData(resource: any): any {
    // 移除敏感信息，只保留基本标识信息
    if (!resource || typeof resource !== 'object') {
      return resource;
    }

    return {
      id: resource.id,
      type: this.getResourceType(resource),
      title: resource.title || resource.name,
      owner: resource.permissions?.owner,
    };
  }
}

export default DefaultPermissionService;
