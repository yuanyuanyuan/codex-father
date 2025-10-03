/**
 * T034: 用户管理 API 端点
 * 提供用户信息管理，包含用户列表、个人信息、偏好设置等功能
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { PRDRequest, APIResponse } from '../server.js';
import type { UserRole } from '../../models/user-role.js';
import { extractPaginationParams, createPaginationMeta } from '../server.js';

/**
 * 用户信息接口
 */
interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole['name'];
  avatar?: string;
  department?: string;
  title?: string;
  permissions: string[];
  preferences: UserPreferences;
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: Date;
  created: Date;
  updated: Date;
}

/**
 * 用户偏好接口
 */
interface UserPreferences {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark' | 'auto';
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  notifications: {
    email: boolean;
    push: boolean;
    reviewReminders: boolean;
    weeklyDigest: boolean;
  };
  editor: {
    defaultTemplate: string;
    autoSave: boolean;
    showLineNumbers: boolean;
    wordWrap: boolean;
  };
  dashboard: {
    defaultView: 'grid' | 'list';
    itemsPerPage: number;
    showPreview: boolean;
  };
}

/**
 * 用户列表查询参数接口
 */
interface ListUsersQuery {
  page?: string;
  limit?: string;
  role?: string;
  department?: string;
  status?: 'active' | 'inactive' | 'suspended';
  search?: string;
  sortBy?: 'name' | 'email' | 'created' | 'lastLogin';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 更新用户请求接口
 */
interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: string;
  department?: string;
  title?: string;
  status?: 'active' | 'inactive' | 'suspended';
  preferences?: Partial<UserPreferences>;
}

/**
 * 创建用户管理路由
 */
export function createUserRoutes(): Router {
  const router = Router();

  // GET /api/users - 获取用户列表
  router.get('/', listUsers);

  // GET /api/users/me - 获取当前用户信息
  router.get('/me', getCurrentUser);

  // PUT /api/users/me - 更新当前用户信息
  router.put('/me', updateCurrentUser);

  // GET /api/users/:id - 获取指定用户信息
  router.get('/:id', getUser);

  // PUT /api/users/:id - 更新指定用户信息（管理员）
  router.put('/:id', updateUser);

  // GET /api/users/me/activity - 获取当前用户活动记录
  router.get('/me/activity', getUserActivity);

  // GET /api/users/me/statistics - 获取当前用户统计信息
  router.get('/me/statistics', getUserStatistics);

  // POST /api/users/me/preferences/reset - 重置用户偏好
  router.post('/me/preferences/reset', resetUserPreferences);

  // GET /api/users/me/drafts - 获取当前用户的草稿
  router.get('/me/drafts', getUserDrafts);

  // GET /api/users/me/reviews - 获取当前用户的审查任务
  router.get('/me/reviews', getUserReviews);

  // POST /api/users/me/avatar - 上传用户头像
  router.post('/me/avatar', uploadUserAvatar);

  return router;
}

/**
 * 获取用户列表 - GET /api/users
 */
async function listUsers(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as ListUsersQuery;
    const { page, limit, offset } = extractPaginationParams(req);

    // 检查查看用户列表权限
    const canListUsers = await req.services!.permissionService.canListUsers(req.user!.id);
    if (!canListUsers) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有查看用户列表的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 模拟用户数据（在实际项目中应该从数据库获取）
    const mockUsers = await getMockUsers();

    // 应用过滤条件
    let filteredUsers = mockUsers;

    if (query.role) {
      filteredUsers = filteredUsers.filter((user) => user.role === query.role);
    }

    if (query.department) {
      filteredUsers = filteredUsers.filter((user) => user.department === query.department);
    }

    if (query.status) {
      filteredUsers = filteredUsers.filter((user) => user.status === query.status);
    }

    if (query.search) {
      const searchLower = query.search.toLowerCase();
      filteredUsers = filteredUsers.filter(
        (user) =>
          user.name.toLowerCase().includes(searchLower) ||
          user.email.toLowerCase().includes(searchLower)
      );
    }

    // 排序
    const sortBy = query.sortBy || 'name';
    const sortOrder = query.sortOrder || 'asc';

    filteredUsers.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'email':
          comparison = a.email.localeCompare(b.email);
          break;
        case 'created':
          comparison = new Date(a.created).getTime() - new Date(b.created).getTime();
          break;
        case 'lastLogin':
          const aTime = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
          const bTime = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
          comparison = aTime - bTime;
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // 分页
    const totalCount = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice(offset, offset + limit);

    // 格式化响应数据（移除敏感信息）
    const responseData = paginatedUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      department: user.department,
      title: user.title,
      status: user.status,
      lastLogin: user.lastLogin,
      created: user.created,
    }));

    const response: APIResponse<typeof responseData> = {
      success: true,
      data: responseData,
      message: `找到 ${responseData.length} 个用户`,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        pagination: createPaginationMeta(page, limit, totalCount),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * 获取当前用户信息 - GET /api/users/me
 */
async function getCurrentUser(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // 模拟获取当前用户信息
    const currentUser = await getMockUserById(req.user!.id);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '用户信息不存在',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const response: APIResponse<User> = {
      success: true,
      data: currentUser,
      message: '当前用户信息',
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * 更新当前用户信息 - PUT /api/users/me
 */
async function updateCurrentUser(
  req: PRDRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const updateData = req.body as UpdateUserRequest;

    // 获取当前用户信息
    const currentUser = await getMockUserById(req.user!.id);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: '用户信息不存在',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 验证更新数据
    if (updateData.email && !isValidEmail(updateData.email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '邮箱格式无效',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 普通用户不能修改角色和状态
    if (updateData.role || updateData.status) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有修改角色或状态的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 更新用户信息
    const updatedUser: User = {
      ...currentUser,
      name: updateData.name || currentUser.name,
      email: updateData.email || currentUser.email,
      department: updateData.department || currentUser.department,
      title: updateData.title || currentUser.title,
      preferences: updateData.preferences
        ? { ...currentUser.preferences, ...updateData.preferences }
        : currentUser.preferences,
      updated: new Date(),
    };

    const response: APIResponse<User> = {
      success: true,
      data: updatedUser,
      message: '用户信息更新成功',
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * 获取指定用户信息 - GET /api/users/:id
 */
async function getUser(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    // 检查查看用户权限
    const canViewUser = await req.services!.permissionService.canViewUser(req.user!.id, id);
    if (!canViewUser) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有查看此用户信息的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const user = await getMockUserById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `用户不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 移除敏感信息（非管理员用户）
    let responseData: any = user;
    if (req.user!.role !== 'architect' && req.user!.id !== id) {
      const { preferences, permissions, ...publicInfo } = user;
      responseData = publicInfo;
    }

    const response: APIResponse<typeof responseData> = {
      success: true,
      data: responseData,
      message: `用户信息: ${user.name}`,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * 更新指定用户信息 - PUT /api/users/:id（管理员）
 */
async function updateUser(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body as UpdateUserRequest;

    // 只有管理员可以更新其他用户信息
    if (req.user!.role !== 'architect') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '只有管理员可以更新其他用户信息',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const user = await getMockUserById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `用户不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 验证角色
    if (
      updateData.role &&
      !['architect', 'product_manager', 'developer', 'tester', 'viewer'].includes(updateData.role)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '角色无效',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 更新用户信息
    const updatedUser: User = {
      ...user,
      name: updateData.name || user.name,
      email: updateData.email || user.email,
      role: (updateData.role as UserRole['name']) || user.role,
      department: updateData.department || user.department,
      title: updateData.title || user.title,
      status: updateData.status || user.status,
      permissions: updateData.role
        ? await getRolePermissions(updateData.role as UserRole['name'])
        : user.permissions,
      updated: new Date(),
    };

    const response: APIResponse<User> = {
      success: true,
      data: updatedUser,
      message: `用户信息更新成功: ${updatedUser.name}`,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * 获取当前用户活动记录 - GET /api/users/me/activity
 */
async function getUserActivity(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, offset } = extractPaginationParams(req);
    const { type, startDate, endDate } = req.query;

    // 模拟用户活动数据
    const activities = await getMockUserActivities(req.user!.id, {
      type: type as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit,
      offset,
    });

    const totalCount = 100; // 模拟总数

    const response: APIResponse<typeof activities> = {
      success: true,
      data: activities,
      message: '用户活动记录',
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        pagination: createPaginationMeta(page || 1, limit, totalCount),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * 获取当前用户统计信息 - GET /api/users/me/statistics
 */
async function getUserStatistics(
  req: PRDRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 模拟用户统计数据
    const statistics = {
      drafts: {
        total: 25,
        draft: 5,
        inReview: 3,
        approved: 15,
        rejected: 2,
      },
      reviews: {
        pending: 8,
        completed: 42,
        averageTime: 2.5, // 天
      },
      templates: {
        created: 3,
        used: 12,
      },
      activity: {
        thisWeek: 18,
        thisMonth: 65,
        totalActions: 456,
      },
    };

    const response: APIResponse<typeof statistics> = {
      success: true,
      data: statistics,
      message: '用户统计信息',
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * 重置用户偏好 - POST /api/users/me/preferences/reset
 */
async function resetUserPreferences(
  req: PRDRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const defaultPreferences: UserPreferences = {
      language: 'zh-CN',
      theme: 'light',
      timezone: 'Asia/Shanghai',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: '24h',
      notifications: {
        email: true,
        push: true,
        reviewReminders: true,
        weeklyDigest: false,
      },
      editor: {
        defaultTemplate: 'basic',
        autoSave: true,
        showLineNumbers: true,
        wordWrap: true,
      },
      dashboard: {
        defaultView: 'grid',
        itemsPerPage: 20,
        showPreview: true,
      },
    };

    const response: APIResponse<UserPreferences> = {
      success: true,
      data: defaultPreferences,
      message: '用户偏好已重置为默认设置',
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * 获取当前用户的草稿 - GET /api/users/me/drafts
 */
async function getUserDrafts(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, offset } = extractPaginationParams(req);
    const { status } = req.query;

    // 使用草稿服务获取用户草稿
    const drafts = await req.services!.documentService.listDrafts({
      author: req.user!.id,
      status: status as any,
      limit,
      offset,
      sortBy: 'updated',
      sortOrder: 'desc',
    });

    const totalCount = await req.services!.documentService.countDrafts({
      author: req.user!.id,
      status: status as any,
    });

    const responseData = drafts.map((draft) => ({
      id: draft.id,
      title: draft.title,
      status: draft.status,
      template: draft.template,
      created: draft.created,
      updated: draft.updated,
      reviewers: draft.reviewers?.length || 0,
    }));

    const response: APIResponse<typeof responseData> = {
      success: true,
      data: responseData,
      message: '用户草稿列表',
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        pagination: createPaginationMeta(page || 1, limit, totalCount),
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * 获取当前用户的审查任务 - GET /api/users/me/reviews
 */
async function getUserReviews(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status = 'pending' } = req.query;

    // 模拟获取用户审查任务
    const reviews = await getMockUserReviews(req.user!.id, status as string);

    const response: APIResponse<typeof reviews> = {
      success: true,
      data: reviews,
      message: '用户审查任务列表',
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * 上传用户头像 - POST /api/users/me/avatar
 */
async function uploadUserAvatar(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // 模拟头像上传
    const avatarUrl = `https://example.com/avatars/${req.user!.id}.jpg`;

    const response: APIResponse<{ avatarUrl: string }> = {
      success: true,
      data: { avatarUrl },
      message: '头像上传成功',
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

// =============================================================================
// 辅助函数 (Helper Functions)
// =============================================================================

/**
 * 获取模拟用户数据
 */
async function getMockUsers(): Promise<User[]> {
  const defaultPreferences: UserPreferences = {
    language: 'zh-CN',
    theme: 'light',
    timezone: 'Asia/Shanghai',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '24h',
    notifications: {
      email: true,
      push: true,
      reviewReminders: true,
      weeklyDigest: false,
    },
    editor: {
      defaultTemplate: 'basic',
      autoSave: true,
      showLineNumbers: true,
      wordWrap: true,
    },
    dashboard: {
      defaultView: 'grid',
      itemsPerPage: 20,
      showPreview: true,
    },
  };

  return [
    {
      id: 'user-1',
      name: '张三',
      email: 'zhangsan@example.com',
      role: 'architect',
      avatar: 'https://example.com/avatars/user-1.jpg',
      department: '技术部',
      title: '技术架构师',
      permissions: ['read', 'write', 'review', 'admin'],
      preferences: defaultPreferences,
      status: 'active',
      lastLogin: new Date('2024-01-15T10:30:00Z'),
      created: new Date('2023-06-01T00:00:00Z'),
      updated: new Date('2024-01-15T10:30:00Z'),
    },
    {
      id: 'user-2',
      name: '李四',
      email: 'lisi@example.com',
      role: 'product_manager',
      department: '产品部',
      title: '产品经理',
      permissions: ['read', 'write', 'review'],
      preferences: defaultPreferences,
      status: 'active',
      lastLogin: new Date('2024-01-14T16:45:00Z'),
      created: new Date('2023-08-15T00:00:00Z'),
      updated: new Date('2024-01-14T16:45:00Z'),
    },
    {
      id: 'user-3',
      name: '王五',
      email: 'wangwu@example.com',
      role: 'developer',
      department: '技术部',
      title: '前端开发工程师',
      permissions: ['read', 'write'],
      preferences: defaultPreferences,
      status: 'active',
      lastLogin: new Date('2024-01-15T09:15:00Z'),
      created: new Date('2023-09-20T00:00:00Z'),
      updated: new Date('2024-01-15T09:15:00Z'),
    },
  ];
}

/**
 * 根据 ID 获取模拟用户
 */
async function getMockUserById(id: string): Promise<User | null> {
  const users = await getMockUsers();
  return users.find((user) => user.id === id) || null;
}

/**
 * 获取角色权限
 */
async function getRolePermissions(role: UserRole['name']): Promise<string[]> {
  const rolePermissions: Record<string, string[]> = {
    architect: ['read', 'write', 'review', 'admin'],
    product_manager: ['read', 'write', 'review'],
    developer: ['read', 'write'],
    tester: ['read', 'review'],
    viewer: ['read'],
  };

  return rolePermissions[role] || ['read'];
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 获取模拟用户活动数据
 */
async function getMockUserActivities(userId: string, filters: any): Promise<any[]> {
  return [
    {
      id: 'activity-1',
      type: 'draft_created',
      description: '创建了草稿 "新产品功能规划"',
      timestamp: new Date('2024-01-15T10:30:00Z'),
      metadata: {
        draftId: 'draft-123',
        draftTitle: '新产品功能规划',
      },
    },
    {
      id: 'activity-2',
      type: 'review_submitted',
      description: '提交了对草稿 "API 设计文档" 的审查',
      timestamp: new Date('2024-01-15T09:45:00Z'),
      metadata: {
        draftId: 'draft-456',
        draftTitle: 'API 设计文档',
        decision: 'approve',
      },
    },
  ];
}

/**
 * 获取模拟用户审查任务
 */
async function getMockUserReviews(userId: string, status: string): Promise<any[]> {
  const allReviews = [
    {
      id: 'review-1',
      draftId: 'draft-789',
      draftTitle: '移动端界面设计',
      author: '赵六',
      status: 'pending',
      priority: 'high',
      dueDate: new Date('2024-01-20T00:00:00Z'),
      submittedAt: new Date('2024-01-12T10:00:00Z'),
    },
    {
      id: 'review-2',
      draftId: 'draft-101',
      draftTitle: '数据库架构设计',
      author: '孙七',
      status: 'completed',
      priority: 'medium',
      decision: 'approve',
      completedAt: new Date('2024-01-10T14:30:00Z'),
    },
  ];

  return status === 'all' ? allReviews : allReviews.filter((review) => review.status === status);
}
