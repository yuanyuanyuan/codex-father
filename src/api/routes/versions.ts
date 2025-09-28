/**
 * T032: 版本管理 API 端点
 * 提供草稿版本历史管理，包含版本列表、详情、恢复、比较等功能
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { PRDRequest, APIResponse } from '../server.js';
import type { Version, VersionChange } from '../../models/version.js';
import { extractPaginationParams, createPaginationMeta } from '../server.js';

/**
 * 版本列表查询参数接口
 */
interface ListVersionsQuery {
  page?: string;
  limit?: string;
  author?: string;
  startDate?: string;
  endDate?: string;
  changeType?: string;
  sortBy?: 'created' | 'version';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 版本比较查询参数接口
 */
interface CompareVersionsQuery {
  version1: string;
  version2: string;
  format?: 'unified' | 'side-by-side' | 'summary';
  section?: string;
}

/**
 * 版本恢复请求接口
 */
interface RestoreVersionRequest {
  createBackup?: boolean;
  message?: string;
}

/**
 * 创建版本管理路由
 */
export function createVersionRoutes(): Router {
  const router = Router();

  // GET /api/drafts/:id/versions - 获取草稿版本历史
  router.get('/:id/versions', listVersions);

  // POST /api/drafts/:id/versions - 创建新版本
  router.post('/:id/versions', createVersion);

  // GET /api/drafts/:id/versions/:versionId - 获取特定版本详情
  router.get('/:id/versions/:versionId', getVersion);

  // POST /api/drafts/:id/versions/:versionId/restore - 恢复到指定版本
  router.post('/:id/versions/:versionId/restore', restoreVersion);

  // GET /api/drafts/:id/versions/compare - 比较版本差异
  router.get('/:id/versions/compare', compareVersions);

  // GET /api/drafts/:id/versions/:versionId/content - 获取版本内容
  router.get('/:id/versions/:versionId/content', getVersionContent);

  // DELETE /api/drafts/:id/versions/:versionId - 删除版本（仅管理员）
  router.delete('/:id/versions/:versionId', deleteVersion);

  return router;
}

/**
 * 获取草稿版本历史 - GET /api/drafts/:id/versions
 */
async function listVersions(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId } = req.params;
    const query = req.query as ListVersionsQuery;
    const { page, limit, offset } = extractPaginationParams(req);

    // 验证草稿是否存在
    const draft = await req.services!.documentService.getDraft(draftId);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `草稿不存在: ${draftId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查阅读权限
    const canRead = await req.services!.permissionService.canReadDraft(req.user!.id, draft);
    if (!canRead) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有查看此草稿版本历史的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 构建查询条件
    const filters = {
      author: query.author,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      changeType: query.changeType,
      sortBy: query.sortBy || 'created',
      sortOrder: query.sortOrder || 'desc',
      limit,
      offset,
    };

    const versions = await req.services!.versionService.listVersions(draftId, filters);
    const totalCount = await req.services!.versionService.countVersions(draftId, filters);

    // 格式化响应数据
    const responseData = versions.map((version) => ({
      id: version.id,
      version: version.version,
      draftId: version.draftId,
      author: version.author,
      description: version.description,
      created: version.created,
      changesCount: version.changes?.length || 0,
      changesSummary: summarizeChanges(version.changes || []),
      tags: version.tags || [],
    }));

    const response: APIResponse<typeof responseData> = {
      success: true,
      data: responseData,
      message: `找到 ${responseData.length} 个版本`,
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
 * 创建新版本 - POST /api/drafts/:id/versions
 */
async function createVersion(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId } = req.params;
    const { changes, description, tags } = req.body;

    // 验证草稿是否存在
    const draft = await req.services!.documentService.getDraft(draftId);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `草稿不存在: ${draftId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查编辑权限
    const canEdit = await req.services!.permissionService.canEditDraft(req.user!.id, draft);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有创建此草稿版本的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 验证变更数据
    if (!changes || !Array.isArray(changes) || changes.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必须提供变更信息',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 创建版本
    const newVersion = await req.services!.versionService.createVersion(
      draft,
      changes,
      req.user!.id,
      {
        description,
        tags,
      }
    );

    const response: APIResponse<Version> = {
      success: true,
      data: newVersion,
      message: `成功创建版本: ${newVersion.version}`,
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * 获取特定版本详情 - GET /api/drafts/:id/versions/:versionId
 */
async function getVersion(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId, versionId } = req.params;

    // 验证草稿是否存在
    const draft = await req.services!.documentService.getDraft(draftId);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `草稿不存在: ${draftId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查阅读权限
    const canRead = await req.services!.permissionService.canReadDraft(req.user!.id, draft);
    if (!canRead) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有查看此草稿版本的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const version = await req.services!.versionService.getVersion(versionId);
    if (!version || version.draftId !== draftId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `版本不存在: ${versionId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 增强版本信息
    const responseData = {
      ...version,
      changesSummary: summarizeChanges(version.changes || []),
      changesDetail: version.changes?.map((change) => ({
        type: change.type,
        section: change.section,
        description: change.description,
        author: change.author,
        hasContent: Boolean(change.newValue),
      })),
    };

    const response: APIResponse<typeof responseData> = {
      success: true,
      data: responseData,
      message: `版本详情: ${version.version}`,
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
 * 恢复到指定版本 - POST /api/drafts/:id/versions/:versionId/restore
 */
async function restoreVersion(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId, versionId } = req.params;
    const { createBackup = true, message } = req.body as RestoreVersionRequest;

    // 验证草稿是否存在
    const draft = await req.services!.documentService.getDraft(draftId);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `草稿不存在: ${draftId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查编辑权限
    const canEdit = await req.services!.permissionService.canEditDraft(req.user!.id, draft);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有恢复此草稿版本的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 验证版本是否存在
    const version = await req.services!.versionService.getVersion(versionId);
    if (!version || version.draftId !== draftId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `版本不存在: ${versionId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 创建备份（如果需要）
    if (createBackup) {
      const backupChanges: VersionChange[] = [
        {
          type: 'backup',
          section: 'all',
          oldValue: null,
          newValue: draft.content,
          description: message || `恢复前备份 - 版本 ${version.version}`,
          author: req.user!.id,
        },
      ];

      await req.services!.versionService.createVersion(draft, backupChanges, req.user!.id, {
        description: `恢复前自动备份`,
        tags: ['backup', 'auto'],
      });
    }

    // 执行恢复
    const restoredDraft = await req.services!.versionService.restoreVersion(
      draft,
      versionId,
      req.user!.id
    );

    const response: APIResponse<typeof restoredDraft> = {
      success: true,
      data: restoredDraft,
      message: `成功恢复到版本 ${version.version}`,
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
 * 比较版本差异 - GET /api/drafts/:id/versions/compare
 */
async function compareVersions(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId } = req.params;
    const query = req.query as CompareVersionsQuery;

    if (!query.version1 || !query.version2) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必须指定两个版本进行比较',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 验证草稿是否存在
    const draft = await req.services!.documentService.getDraft(draftId);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `草稿不存在: ${draftId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查阅读权限
    const canRead = await req.services!.permissionService.canReadDraft(req.user!.id, draft);
    if (!canRead) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有比较此草稿版本的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const comparison = await req.services!.versionService.compareVersions(
      query.version1,
      query.version2
    );

    let responseData: any = comparison;

    // 根据格式选项调整返回数据
    if (query.format === 'summary') {
      responseData = {
        version1: comparison.version1,
        version2: comparison.version2,
        changesCount: comparison.changes?.length || 0,
        addedSections: comparison.changes?.filter((c) => c.type === 'addition').length || 0,
        modifiedSections: comparison.changes?.filter((c) => c.type === 'modification').length || 0,
        deletedSections: comparison.changes?.filter((c) => c.type === 'deletion').length || 0,
        summary: generateComparisonSummary(comparison.changes || []),
      };
    } else if (query.section) {
      const sectionChanges = comparison.changes?.filter((c) => c.section === query.section);
      responseData = {
        ...comparison,
        changes: sectionChanges,
        section: query.section,
      };
    }

    const response: APIResponse<typeof responseData> = {
      success: true,
      data: responseData,
      message: `版本比较: ${query.version1} vs ${query.version2}`,
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
 * 获取版本内容 - GET /api/drafts/:id/versions/:versionId/content
 */
async function getVersionContent(
  req: PRDRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id: draftId, versionId } = req.params;

    // 验证草稿和版本
    const draft = await req.services!.documentService.getDraft(draftId);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `草稿不存在: ${draftId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const version = await req.services!.versionService.getVersion(versionId);
    if (!version || version.draftId !== draftId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `版本不存在: ${versionId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查权限
    const canRead = await req.services!.permissionService.canReadDraft(req.user!.id, draft);
    if (!canRead) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有查看此版本内容的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 重建版本内容
    const versionContent = await req.services!.versionService.getVersionContent(versionId);

    const response: APIResponse<typeof versionContent> = {
      success: true,
      data: versionContent,
      message: `版本内容: ${version.version}`,
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
 * 删除版本 - DELETE /api/drafts/:id/versions/:versionId
 */
async function deleteVersion(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId, versionId } = req.params;

    // 仅管理员可以删除版本
    if (req.user!.role !== 'architect' && req.user!.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '只有管理员可以删除版本',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const version = await req.services!.versionService.getVersion(versionId);
    if (!version || version.draftId !== draftId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `版本不存在: ${versionId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    await req.services!.versionService.deleteVersion(versionId);

    const response: APIResponse<null> = {
      success: true,
      data: null,
      message: `成功删除版本: ${version.version}`,
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
 * 总结版本变更
 */
function summarizeChanges(changes: VersionChange[]): string {
  if (changes.length === 0) {
    return '无变更';
  }

  const types = changes.reduce(
    (acc, change) => {
      acc[change.type] = (acc[change.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const summary = Object.entries(types)
    .map(([type, count]) => `${getChangeTypeLabel(type)}: ${count}`)
    .join(', ');

  return summary;
}

/**
 * 生成比较摘要
 */
function generateComparisonSummary(changes: any[]): string {
  const totalChanges = changes.length;
  const sections = new Set(changes.map((c) => c.section)).size;

  return `共 ${totalChanges} 个变更，涉及 ${sections} 个章节`;
}

/**
 * 获取变更类型标签
 */
function getChangeTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    content_update: '内容更新',
    title_update: '标题更新',
    status_change: '状态变更',
    metadata_update: '元数据更新',
    section_add: '新增章节',
    section_remove: '删除章节',
    backup: '备份',
  };

  return labels[type] || type;
}
