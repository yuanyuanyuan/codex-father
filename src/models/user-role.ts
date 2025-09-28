/**
 * T011: UserRole 数据模型
 *
 * 用户角色和权限管理实体，定义系统中的访问控制
 * 包含角色定义、权限配置和用户管理功能
 */

// 用户角色类型枚举
export type RoleType =
  | 'architect' // 架构师 - 完整权限
  | 'product_manager' // 产品经理 - 业务需求权限
  | 'developer' // 开发者 - 只读+审查权限
  | 'tester' // 测试工程师 - 测试相关权限
  | 'reviewer' // 审查者 - 审查权限
  | 'viewer'; // 观察者 - 只读权限

// 资源类型枚举
export type ResourceType =
  | 'draft' // PRD草稿
  | 'template' // 模板
  | 'review' // 审查
  | 'version' // 版本
  | 'user' // 用户
  | 'system'; // 系统

// 操作类型枚举
export type ActionType =
  | 'create' // 创建
  | 'read' // 读取
  | 'update' // 更新
  | 'delete' // 删除
  | 'approve' // 批准
  | 'assign' // 指派
  | 'export'; // 导出

// 权限条件接口
export interface PermissionCondition {
  field: string; // 条件字段，如 "status", "authorId"
  operator: 'eq' | 'ne' | 'in' | 'contains'; // 操作符
  value: any; // 条件值
  description: string; // 条件说明，用于调试和文档
}

// 权限定义接口
export interface Permission {
  resource: ResourceType; // 资源类型
  actions: ActionType[]; // 允许的操作列表
  conditions?: PermissionCondition[]; // 权限条件（可选）
}

// 用户角色接口
export interface UserRole {
  id: string; // 角色ID
  name: RoleType; // 角色名称
  displayName: string; // 显示名称
  description: string; // 角色描述
  permissions: Permission[]; // 权限列表
  isActive: boolean; // 是否启用
  createdAt: Date; // 创建时间
}

// 编辑器设置接口
export interface EditorSettings {
  theme: 'light' | 'dark' | 'auto'; // 编辑器主题
  fontSize: number; // 字体大小
  tabSize: number; // 缩进大小
  wordWrap: boolean; // 自动换行
  lineNumbers: boolean; // 显示行号
  minimap: boolean; // 显示缩略图
  autoSave: boolean; // 自动保存
  formatOnSave: boolean; // 保存时格式化
}

// 用户偏好设置接口
export interface UserPreferences {
  language: string; // 界面语言，如 "zh-CN", "en-US"
  timezone: string; // 时区设置，如 "Asia/Shanghai", "UTC"
  emailNotifications: boolean; // 是否接收邮件通知
  defaultTemplate?: string; // 默认模板ID
  editorSettings: EditorSettings; // 编辑器设置
}

// 用户接口
export interface User {
  id: string; // 用户ID (UUID)
  username: string; // 用户名，唯一标识
  email: string; // 邮箱地址，唯一
  displayName: string; // 显示名称
  roles: UserRole[]; // 用户角色列表
  isActive: boolean; // 是否启用
  lastLoginAt?: Date; // 最后登录时间
  preferences: UserPreferences; // 用户偏好设置
}

// 默认角色权限配置
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleType, Permission[]> = {
  architect: [
    // 架构师具有完整权限
    { resource: 'draft', actions: ['create', 'read', 'update', 'delete', 'export'] },
    { resource: 'template', actions: ['create', 'read', 'update', 'delete'] },
    { resource: 'review', actions: ['create', 'read', 'update', 'approve', 'assign'] },
    { resource: 'version', actions: ['read', 'create'] },
    { resource: 'user', actions: ['read', 'update'] },
    { resource: 'system', actions: ['read'] },
  ],

  product_manager: [
    // 产品经理主要负责业务需求
    {
      resource: 'draft',
      actions: ['create', 'read', 'update', 'export'],
      conditions: [
        {
          field: 'templateType',
          operator: 'in',
          value: ['business', 'feature'],
          description: '只能创建业务和功能类型PRD',
        },
      ],
    },
    { resource: 'template', actions: ['read'] },
    { resource: 'review', actions: ['create', 'read', 'update'] },
    { resource: 'version', actions: ['read'] },
    { resource: 'user', actions: ['read'] },
  ],

  developer: [
    // 开发者主要参与审查和实施
    { resource: 'draft', actions: ['read', 'export'] },
    { resource: 'template', actions: ['read'] },
    { resource: 'review', actions: ['read', 'update'] },
    { resource: 'version', actions: ['read'] },
    { resource: 'user', actions: ['read'] },
  ],

  tester: [
    // 测试工程师负责测试相关内容
    { resource: 'draft', actions: ['read', 'export'] },
    {
      resource: 'draft',
      actions: ['update'],
      conditions: [
        { field: 'section', operator: 'eq', value: 'testing', description: '只能编辑测试章节' },
      ],
    },
    { resource: 'template', actions: ['read'] },
    { resource: 'review', actions: ['read', 'update'] },
    { resource: 'version', actions: ['read'] },
    { resource: 'user', actions: ['read'] },
  ],

  reviewer: [
    // 审查者专注于审查流程
    { resource: 'draft', actions: ['read', 'export'] },
    { resource: 'template', actions: ['read'] },
    { resource: 'review', actions: ['read', 'update', 'approve'] },
    { resource: 'version', actions: ['read'] },
    { resource: 'user', actions: ['read'] },
  ],

  viewer: [
    // 观察者只有只读权限
    { resource: 'draft', actions: ['read'] },
    { resource: 'template', actions: ['read'] },
    { resource: 'review', actions: ['read'] },
    { resource: 'version', actions: ['read'] },
    { resource: 'user', actions: ['read'] },
  ],
};

// 默认角色显示名称
export const ROLE_DISPLAY_NAMES: Record<RoleType, string> = {
  architect: '架构师',
  product_manager: '产品经理',
  developer: '开发工程师',
  tester: '测试工程师',
  reviewer: '审查专员',
  viewer: '观察者',
};

// 默认角色描述
export const ROLE_DESCRIPTIONS: Record<RoleType, string> = {
  architect: '拥有完整系统权限，可创建、编辑、审批所有类型的PRD文档，管理技术架构和系统设计',
  product_manager: '负责业务需求和产品规划，可创建和编辑业务类型PRD，参与需求审查流程',
  developer: '开发工程师，可查看所有PRD文档，参与技术审查，提供开发实施反馈',
  tester: '测试工程师，可查看PRD文档，编辑测试相关章节，参与质量保证审查',
  reviewer: '专业审查人员，可查看和审批PRD文档，提供专业意见和建议',
  viewer: '只读用户，可查看所有公开的PRD文档，用于学习和了解项目需求',
};

// UserRole 工具类
export class UserRoleManager {
  /**
   * 验证用户名格式
   */
  static validateUsername(username: string): boolean {
    if (!username || username.length < 3 || username.length > 50) {
      return false;
    }
    // 只允许字母、数字、下划线
    return /^[a-zA-Z0-9_]+$/.test(username);
  }

  /**
   * 验证邮箱格式
   */
  static validateEmail(email: string): boolean {
    if (!email) {
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 创建默认用户角色
   */
  static createDefaultRole(roleType: RoleType): UserRole {
    return {
      id: `role-${roleType}-${Date.now()}`,
      name: roleType,
      displayName: ROLE_DISPLAY_NAMES[roleType],
      description: ROLE_DESCRIPTIONS[roleType],
      permissions: DEFAULT_ROLE_PERMISSIONS[roleType],
      isActive: true,
      createdAt: new Date(),
    };
  }

  /**
   * 创建默认用户偏好设置
   */
  static createDefaultPreferences(): UserPreferences {
    return {
      language: 'zh-CN',
      timezone: 'Asia/Shanghai',
      emailNotifications: true,
      editorSettings: {
        theme: 'auto',
        fontSize: 14,
        tabSize: 2,
        wordWrap: true,
        lineNumbers: true,
        minimap: true,
        autoSave: true,
        formatOnSave: true,
      },
    };
  }

  /**
   * 检查用户是否有特定权限
   */
  static hasPermission(
    user: User,
    resource: ResourceType,
    action: ActionType,
    context?: Record<string, any>
  ): boolean {
    // 检查用户是否激活
    if (!user.isActive) {
      return false;
    }

    // 遍历用户的所有角色
    for (const role of user.roles) {
      if (!role.isActive) {
        continue;
      }

      // 检查角色权限
      for (const permission of role.permissions) {
        if (permission.resource === resource && permission.actions.includes(action)) {
          // 如果有条件，检查条件是否满足
          if (permission.conditions && context) {
            const conditionsMet = permission.conditions.every((condition) => {
              const contextValue = context[condition.field];

              switch (condition.operator) {
                case 'eq':
                  return contextValue === condition.value;
                case 'ne':
                  return contextValue !== condition.value;
                case 'in':
                  return Array.isArray(condition.value) && condition.value.includes(contextValue);
                case 'contains':
                  return Array.isArray(contextValue) && contextValue.includes(condition.value);
                default:
                  return false;
              }
            });

            if (conditionsMet) {
              return true;
            }
          } else if (!permission.conditions) {
            // 没有条件限制，直接允许
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * 获取用户可执行的操作列表
   */
  static getUserActions(user: User, resource: ResourceType): ActionType[] {
    const actions = new Set<ActionType>();

    if (!user.isActive) {
      return [];
    }

    for (const role of user.roles) {
      if (!role.isActive) {
        continue;
      }

      for (const permission of role.permissions) {
        if (permission.resource === resource) {
          permission.actions.forEach((action) => actions.add(action));
        }
      }
    }

    return Array.from(actions);
  }

  /**
   * 验证用户数据完整性
   */
  static validateUser(user: Partial<User>): string[] {
    const errors: string[] = [];

    if (!user.username) {
      errors.push('用户名不能为空');
    } else if (!this.validateUsername(user.username)) {
      errors.push('用户名格式无效，只能包含字母、数字、下划线，长度3-50字符');
    }

    if (!user.email) {
      errors.push('邮箱不能为空');
    } else if (!this.validateEmail(user.email)) {
      errors.push('邮箱格式无效');
    }

    if (!user.displayName) {
      errors.push('显示名称不能为空');
    }

    if (!user.roles || user.roles.length === 0) {
      errors.push('用户必须至少拥有一个角色');
    }

    return errors;
  }

  /**
   * 检查角色是否可以编辑特定章节
   */
  static canEditSection(role: UserRole, sectionType: string): boolean {
    // 架构师可以编辑所有章节
    if (role.name === 'architect') {
      return true;
    }

    // 产品经理可以编辑业务相关章节
    if (role.name === 'product_manager') {
      const businessSections = [
        'requirements',
        'market',
        'stakeholders',
        'timeline',
        'success_metrics',
      ];
      return businessSections.includes(sectionType);
    }

    // 测试工程师只能编辑测试章节
    if (role.name === 'tester') {
      return sectionType === 'testing';
    }

    // 其他角色默认不能编辑
    return false;
  }
}
