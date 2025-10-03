/**
 * T031: 草稿管理 API 端点
 * 提供草稿的 CRUD 操作，包含分页、过滤、搜索、版本控制等功能
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { PRDRequest, APIResponse } from '../server.js';
import type { PRDDraft, CreateDraftRequest, UpdateDraftRequest } from '../../models/prd-draft.js';
import { extractPaginationParams, createPaginationMeta } from '../server.js';

/**
 * 草稿列表查询参数接口
 */
interface ListDraftsQuery {
  page?: string;
  limit?: string;
  status?: 'draft' | 'in_review' | 'approved' | 'rejected' | 'requires_changes' | 'archived';
  author?: string;
  template?: string;
  search?: string;
  sortBy?: 'title' | 'created' | 'updated' | 'status';
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

/**
 * 草稿详情查询参数接口
 */
interface GetDraftQuery {
  version?: string;
  sections?: string;
  format?: 'full' | 'summary' | 'content-only';
}

/**
 * 创建草稿管理路由
 */
export function createDraftRoutes(): Router {
  const router = Router();

  // GET /api/drafts - 列出草稿
  router.get('/', listDrafts);

  // POST /api/drafts - 创建草稿
  router.post('/', createDraft);

  // GET /api/drafts/:id - 获取草稿详情
  router.get('/:id', getDraft);

  // PUT /api/drafts/:id - 更新草稿
  router.put('/:id', updateDraft);

  // DELETE /api/drafts/:id - 删除草稿
  router.delete('/:id', deleteDraft);

  // POST /api/drafts/search - 高级搜索
  router.post('/search', searchDrafts);

  // POST /api/drafts/:id/duplicate - 复制草稿
  router.post('/:id/duplicate', duplicateDraft);

  // GET /api/drafts/:id/export - 导出草稿
  router.get('/:id/export', exportDraft);

  return router;
}

/**
 * 列出草稿 - GET /api/drafts
 */
async function listDrafts(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as ListDraftsQuery;
    const { page, limit, offset } = extractPaginationParams(req);

    // 构建过滤条件
    const filters = {
      status: query.status,
      author: query.author,
      template: query.template,
      search: query.search,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      sortBy: query.sortBy || 'updated',
      sortOrder: query.sortOrder || 'desc',
      limit,
      offset,
    };

    // 检查权限 - 用户只能看到有权限的草稿
    const canListAll = await req.services!.permissionService.canListAllDrafts(req.user!.id);
    if (!canListAll && !query.author) {
      filters.author = req.user!.id; // 只显示自己的草稿
    }

    const drafts = await req.services!.documentService.listDrafts(filters);

    // 获取总数用于分页
    const totalCount = await req.services!.documentService.countDrafts(filters);

    // 格式化响应数据
    const responseData = drafts.map((draft) => ({
      id: draft.id,
      title: draft.title,
      description: draft.description,
      status: draft.status,
      author: draft.author,
      template: draft.template,
      created: draft.created,
      updated: draft.updated,
      version: draft.version,
      reviewers: draft.reviewers?.length || 0,
      hasContent: Boolean(draft.content && Object.keys(draft.content).length > 0),
    }));

    const response: APIResponse<typeof responseData> = {
      success: true,
      data: responseData,
      message: `找到 ${responseData.length} 个草稿`,
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
 * 创建草稿 - POST /api/drafts
 */
async function createDraft(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const createData: CreateDraftRequest = {
      title: req.body.title,
      description: req.body.description,
      template: req.body.template || 'basic',
      author: req.user!.id,
      content: req.body.content || {},
    };

    // 验证输入数据
    if (!createData.title || createData.title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '标题不能为空',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查创建权限
    const canCreate = await req.services!.permissionService.canCreateDraft(req.user!.id);
    if (!canCreate) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有创建草稿的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 验证模板是否存在
    if (createData.template !== 'basic') {
      const template = await req.services!.templateService.getTemplate(createData.template);
      if (!template) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `模板不存在: ${createData.template}`,
          },
          meta: {
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
          },
        });
      }
    }

    // 创建草稿
    const draft = await req.services!.documentService.createDraft(createData);

    const response: APIResponse<PRDDraft> = {
      success: true,
      data: draft,
      message: `成功创建草稿: ${draft.title}`,
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
 * 获取草稿详情 - GET /api/drafts/:id
 */
async function getDraft(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const query = req.query as GetDraftQuery;

    const draft = await req.services!.documentService.getDraft(id);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `草稿不存在: ${id}`,
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
          message: '没有阅读此草稿的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 根据查询参数调整返回数据
    let responseData: any = draft;

    if (query.format === 'summary') {
      responseData = {
        id: draft.id,
        title: draft.title,
        description: draft.description,
        status: draft.status,
        author: draft.author,
        template: draft.template,
        created: draft.created,
        updated: draft.updated,
        version: draft.version,
        reviewers: draft.reviewers,
        sectionsCount: draft.content ? Object.keys(draft.content).length : 0,
      };
    } else if (query.format === 'content-only') {
      responseData = {
        id: draft.id,
        title: draft.title,
        content: draft.content,
      };
    }

    // 过滤特定章节
    if (query.sections && draft.content) {
      const requestedSections = query.sections.split(',');
      const filteredContent: Record<string, string> = {};

      requestedSections.forEach((section) => {
        if (draft.content![section.trim()]) {
          filteredContent[section.trim()] = draft.content![section.trim()];
        }
      });

      responseData = {
        ...responseData,
        content: filteredContent,
        requestedSections,
      };
    }

    const response: APIResponse<typeof responseData> = {
      success: true,
      data: responseData,
      message: `草稿详情: ${draft.title}`,
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
 * 更新草稿 - PUT /api/drafts/:id
 */
async function updateDraft(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updateData: UpdateDraftRequest = req.body;

    const existingDraft = await req.services!.documentService.getDraft(id);
    if (!existingDraft) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `草稿不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查编辑权限
    const canEdit = await req.services!.permissionService.canEditDraft(req.user!.id, existingDraft);
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有编辑此草稿的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 冲突检测 - 检查版本号
    if (req.headers['if-match'] && req.headers['if-match'] !== existingDraft.version) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '草稿已被其他用户修改，请刷新后重试',
          details: {
            currentVersion: existingDraft.version,
            requestedVersion: req.headers['if-match'],
          },
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 更新草稿
    const updatedDraft = await req.services!.documentService.updateDraft(
      id,
      updateData,
      req.user!.id
    );

    // 创建版本记录
    if (updateData.content || updateData.title || updateData.description) {
      const changes = [];

      if (updateData.title && updateData.title !== existingDraft.title) {
        changes.push({
          type: 'title_update' as const,
          section: 'title',
          oldValue: existingDraft.title,
          newValue: updateData.title,
          description: '标题更新',
          author: req.user!.id,
        });
      }

      if (updateData.content) {
        changes.push({
          type: 'content_update' as const,
          section: 'content',
          oldValue: existingDraft.content,
          newValue: updateData.content,
          description: '内容更新',
          author: req.user!.id,
        });
      }

      if (changes.length > 0) {
        await req.services!.versionService.createVersion(updatedDraft, changes, req.user!.id);
      }
    }

    const response: APIResponse<PRDDraft> = {
      success: true,
      data: updatedDraft,
      message: `成功更新草稿: ${updatedDraft.title}`,
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
 * 删除草稿 - DELETE /api/drafts/:id
 */
async function deleteDraft(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { archive } = req.query;

    const draft = await req.services!.documentService.getDraft(id);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `草稿不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查删除权限
    const canDelete = await req.services!.permissionService.canDeleteDraft(req.user!.id, draft);
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有删除此草稿的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    let message: string;

    if (archive === 'true') {
      // 归档而不是删除
      const archivedDraft = await req.services!.documentService.updateDraft(
        id,
        {
          status: 'archived',
        },
        req.user!.id
      );

      message = `成功归档草稿: ${archivedDraft.title}`;
    } else {
      // 永久删除
      await req.services!.documentService.deleteDraft(id);
      message = `成功删除草稿: ${draft.title}`;
    }

    const response: APIResponse<null> = {
      success: true,
      data: null,
      message,
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
 * 高级搜索 - POST /api/drafts/search
 */
async function searchDrafts(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      query: searchQuery,
      filters = {},
      sort = { field: 'updated', order: 'desc' },
      pagination = { page: 1, limit: 20 },
    } = req.body;

    const { page, limit, offset } = {
      page: pagination.page || 1,
      limit: Math.min(100, pagination.limit || 20),
      offset: ((pagination.page || 1) - 1) * (pagination.limit || 20),
    };

    const searchParams = {
      query: searchQuery,
      scope: filters.scope || 'all',
      author: filters.author,
      status: filters.status,
      template: filters.template,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      sortBy: sort.field || 'updated',
      sortOrder: sort.order || 'desc',
      limit,
      offset,
    };

    const results = await req.services!.documentService.searchDrafts(searchParams);
    const totalCount = await req.services!.documentService.countSearchResults(searchParams);

    const response: APIResponse<typeof results> = {
      success: true,
      data: results,
      message: `找到 ${results.length} 个匹配结果`,
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
 * 复制草稿 - POST /api/drafts/:id/duplicate
 */
async function duplicateDraft(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { title, includeReviews = false } = req.body;

    const originalDraft = await req.services!.documentService.getDraft(id);
    if (!originalDraft) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `草稿不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查阅读权限
    const canRead = await req.services!.permissionService.canReadDraft(req.user!.id, originalDraft);
    if (!canRead) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有阅读此草稿的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 创建复制的草稿
    const duplicateData: CreateDraftRequest = {
      title: title || `${originalDraft.title} (副本)`,
      description: originalDraft.description,
      template: originalDraft.template,
      author: req.user!.id,
      content: originalDraft.content || {},
    };

    const duplicatedDraft = await req.services!.documentService.createDraft(duplicateData);

    const response: APIResponse<PRDDraft> = {
      success: true,
      data: duplicatedDraft,
      message: `成功复制草稿: ${duplicatedDraft.title}`,
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
 * 导出草稿 - GET /api/drafts/:id/export
 */
async function exportDraft(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { format = 'json' } = req.query;

    const draft = await req.services!.documentService.getDraft(id);
    if (!draft) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `草稿不存在: ${id}`,
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
          message: '没有阅读此草稿的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const filename = `${draft.title.replace(/[^a-zA-Z0-9]/g, '_')}.${format}`;

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    switch (format) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(draft);
        break;

      case 'markdown':
        res.setHeader('Content-Type', 'text/markdown');
        const markdownContent = generateMarkdownExport(draft);
        res.status(200).send(markdownContent);
        break;

      default:
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `不支持的导出格式: ${format}`,
          },
          meta: {
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
          },
        });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * 生成 Markdown 导出内容
 */
function generateMarkdownExport(draft: PRDDraft): string {
  let markdown = `# ${draft.title}\n\n`;

  if (draft.description) {
    markdown += `${draft.description}\n\n`;
  }

  markdown += `---\n`;
  markdown += `**作者:** ${draft.author}  \n`;
  markdown += `**状态:** ${draft.status}  \n`;
  markdown += `**模板:** ${draft.template}  \n`;
  markdown += `**创建时间:** ${new Date(draft.created).toLocaleString()}  \n`;
  markdown += `**更新时间:** ${new Date(draft.updated).toLocaleString()}  \n`;
  markdown += `---\n\n`;

  if (draft.content) {
    Object.entries(draft.content).forEach(([section, content]) => {
      markdown += `## ${section}\n\n${content}\n\n`;
    });
  }

  return markdown;
}
