/**
 * T034: 模板管理 API 端点
 * 提供 PRD 模板的管理功能，包含模板 CRUD 操作、验证、导入导出等
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { PRDRequest, APIResponse } from '../server.js';
import type { Template, CreateTemplateRequest } from '../../models/template.js';
import { extractPaginationParams, createPaginationMeta } from '../server.js';

/**
 * 模板列表查询参数接口
 */
interface ListTemplatesQuery {
  page?: string;
  limit?: string;
  category?: string;
  author?: string;
  tag?: string;
  search?: string;
  sortBy?: 'name' | 'created' | 'updated' | 'usage';
  sortOrder?: 'asc' | 'desc';
  active?: string;
}

/**
 * 模板验证结果接口
 */
interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * 创建模板管理路由
 */
export function createTemplateRoutes(): Router {
  const router = Router();

  // GET /api/templates - 获取模板列表
  router.get('/', listTemplates);

  // POST /api/templates - 创建新模板
  router.post('/', createTemplate);

  // GET /api/templates/:id - 获取模板详情
  router.get('/:id', getTemplate);

  // PUT /api/templates/:id - 更新模板
  router.put('/:id', updateTemplate);

  // DELETE /api/templates/:id - 删除模板
  router.delete('/:id', deleteTemplate);

  // POST /api/templates/:id/validate - 验证模板
  router.post('/:id/validate', validateTemplate);

  // POST /api/templates/:id/duplicate - 复制模板
  router.post('/:id/duplicate', duplicateTemplate);

  // GET /api/templates/:id/usage - 获取模板使用统计
  router.get('/:id/usage', getTemplateUsage);

  // POST /api/templates/import - 导入模板
  router.post('/import', importTemplate);

  // GET /api/templates/:id/export - 导出模板
  router.get('/:id/export', exportTemplate);

  // GET /api/templates/categories - 获取模板分类
  router.get('/meta/categories', getTemplateCategories);

  // GET /api/templates/tags - 获取模板标签
  router.get('/meta/tags', getTemplateTags);

  return router;
}

/**
 * 获取模板列表 - GET /api/templates
 */
async function listTemplates(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as ListTemplatesQuery;
    const { page, limit, offset } = extractPaginationParams(req);

    // 构建过滤条件
    const filters = {
      category: query.category,
      author: query.author,
      tag: query.tag,
      search: query.search,
      active: query.active === 'true' ? true : query.active === 'false' ? false : undefined,
      sortBy: query.sortBy || 'updated',
      sortOrder: query.sortOrder || 'desc',
      limit,
      offset,
    };

    const templates = await req.services!.templateService.listTemplates(filters);
    const totalCount = await req.services!.templateService.countTemplates(filters);

    // 格式化响应数据
    const responseData = templates.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      author: template.author,
      version: template.version,
      created: template.created,
      updated: template.updated,
      tags: template.tags || [],
      isActive: template.isActive,
      usageCount: template.usageCount || 0,
      sectionsCount: template.structure?.sections?.length || 0,
    }));

    const response: APIResponse<typeof responseData> = {
      success: true,
      data: responseData,
      message: `找到 ${responseData.length} 个模板`,
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
 * 创建新模板 - POST /api/templates
 */
async function createTemplate(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const templateData: CreateTemplateRequest = {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category || 'general',
      author: req.user!.id,
      structure: req.body.structure,
      metadata: req.body.metadata || {},
      tags: req.body.tags || [],
      isActive: req.body.isActive !== false,
    };

    // 验证输入数据
    if (!templateData.name || templateData.name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '模板名称不能为空',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    if (!templateData.structure || !templateData.structure.sections) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必须提供模板结构',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查创建权限
    const canCreateTemplate = await req.services!.permissionService.canCreateTemplate(req.user!.id);
    if (!canCreateTemplate) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有创建模板的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查模板名称是否重复
    const existingTemplate = await req.services!.templateService.findTemplateByName(
      templateData.name
    );
    if (existingTemplate) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `模板名称已存在: ${templateData.name}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 创建模板
    const template = await req.services!.templateService.createTemplate(templateData);

    const response: APIResponse<Template> = {
      success: true,
      data: template,
      message: `成功创建模板: ${template.name}`,
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
 * 获取模板详情 - GET /api/templates/:id
 */
async function getTemplate(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { includeUsage, includeStats } = req.query;

    const template = await req.services!.templateService.getTemplate(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `模板不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 增强模板信息
    let responseData: any = template;

    if (includeUsage === 'true') {
      const usageStats = await req.services!.templateService.getTemplateUsage(id);
      responseData = {
        ...template,
        usage: usageStats,
      };
    }

    if (includeStats === 'true') {
      const stats = await req.services!.templateService.getTemplateStats(id);
      responseData = {
        ...responseData,
        stats,
      };
    }

    const response: APIResponse<typeof responseData> = {
      success: true,
      data: responseData,
      message: `模板详情: ${template.name}`,
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
 * 更新模板 - PUT /api/templates/:id
 */
async function updateTemplate(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const existingTemplate = await req.services!.templateService.getTemplate(id);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `模板不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查编辑权限
    const canEdit = await req.services!.permissionService.canEditTemplate(
      req.user!.id,
      existingTemplate
    );
    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有编辑此模板的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 更新模板
    const updatedTemplate = await req.services!.templateService.updateTemplate(id, updateData);

    const response: APIResponse<Template> = {
      success: true,
      data: updatedTemplate,
      message: `成功更新模板: ${updatedTemplate.name}`,
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
 * 删除模板 - DELETE /api/templates/:id
 */
async function deleteTemplate(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const template = await req.services!.templateService.getTemplate(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `模板不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查删除权限
    const canDelete = await req.services!.permissionService.canDeleteTemplate(
      req.user!.id,
      template
    );
    if (!canDelete) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有删除此模板的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查模板是否正在使用
    const usageCount = await req.services!.templateService.getTemplateUsageCount(id);
    if (usageCount > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: `模板正在被 ${usageCount} 个草稿使用，无法删除`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    await req.services!.templateService.deleteTemplate(id);

    const response: APIResponse<null> = {
      success: true,
      data: null,
      message: `成功删除模板: ${template.name}`,
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
 * 验证模板 - POST /api/templates/:id/validate
 */
async function validateTemplate(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const template = await req.services!.templateService.getTemplate(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `模板不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const validationResult = await req.services!.templateService.validateTemplate(template);

    const response: APIResponse<typeof validationResult> = {
      success: true,
      data: validationResult,
      message: validationResult.valid ? '模板验证通过' : '模板验证失败',
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
 * 复制模板 - POST /api/templates/:id/duplicate
 */
async function duplicateTemplate(
  req: PRDRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const originalTemplate = await req.services!.templateService.getTemplate(id);
    if (!originalTemplate) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `模板不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查创建权限
    const canCreate = await req.services!.permissionService.canCreateTemplate(req.user!.id);
    if (!canCreate) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有创建模板的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 创建复制的模板
    const duplicateData: CreateTemplateRequest = {
      name: name || `${originalTemplate.name} (副本)`,
      description: description || originalTemplate.description,
      category: originalTemplate.category,
      author: req.user!.id,
      structure: originalTemplate.structure,
      metadata: {
        ...originalTemplate.metadata,
        originalTemplateId: originalTemplate.id,
        duplicatedFrom: originalTemplate.name,
      },
      tags: [...(originalTemplate.tags || []), 'duplicate'],
      isActive: true,
    };

    const duplicatedTemplate = await req.services!.templateService.createTemplate(duplicateData);

    const response: APIResponse<Template> = {
      success: true,
      data: duplicatedTemplate,
      message: `成功复制模板: ${duplicatedTemplate.name}`,
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
 * 获取模板使用统计 - GET /api/templates/:id/usage
 */
async function getTemplateUsage(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const template = await req.services!.templateService.getTemplate(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `模板不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const usageStats = await req.services!.templateService.getTemplateUsage(id);

    const response: APIResponse<typeof usageStats> = {
      success: true,
      data: usageStats,
      message: `模板使用统计: ${template.name}`,
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
 * 导入模板 - POST /api/templates/import
 */
async function importTemplate(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { templateData, format = 'json', overwrite = false } = req.body;

    if (!templateData) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必须提供模板数据',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查创建权限
    const canCreate = await req.services!.permissionService.canCreateTemplate(req.user!.id);
    if (!canCreate) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有导入模板的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 解析模板数据
    let parsedTemplate;
    try {
      parsedTemplate = typeof templateData === 'string' ? JSON.parse(templateData) : templateData;
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '模板数据格式无效',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查是否存在同名模板
    if (!overwrite) {
      const existingTemplate = await req.services!.templateService.findTemplateByName(
        parsedTemplate.name
      );
      if (existingTemplate) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONFLICT',
            message: `模板名称已存在: ${parsedTemplate.name}。使用 overwrite=true 强制覆盖`,
          },
          meta: {
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
          },
        });
      }
    }

    // 导入模板
    const importedTemplate = await req.services!.templateService.importTemplate(parsedTemplate, {
      author: req.user!.id,
      overwrite,
    });

    const response: APIResponse<Template> = {
      success: true,
      data: importedTemplate,
      message: `成功导入模板: ${importedTemplate.name}`,
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
 * 导出模板 - GET /api/templates/:id/export
 */
async function exportTemplate(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { format = 'json', includeMetadata = true } = req.query;

    const template = await req.services!.templateService.getTemplate(id);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `模板不存在: ${id}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const filename = `${template.name.replace(/[^a-zA-Z0-9]/g, '_')}.${format}`;

    // 准备导出数据
    let exportData = template;
    if (includeMetadata === 'false') {
      const { created, updated, usageCount, ...templateWithoutMeta } = template;
      exportData = templateWithoutMeta;
    }

    // 设置响应头
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    switch (format) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(exportData);
        break;

      case 'yaml':
        res.setHeader('Content-Type', 'text/yaml');
        const yaml = require('js-yaml');
        res.status(200).send(yaml.dump(exportData));
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
 * 获取模板分类 - GET /api/templates/meta/categories
 */
async function getTemplateCategories(
  req: PRDRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const categories = await req.services!.templateService.getTemplateCategories();

    const response: APIResponse<typeof categories> = {
      success: true,
      data: categories,
      message: '模板分类列表',
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
 * 获取模板标签 - GET /api/templates/meta/tags
 */
async function getTemplateTags(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const tags = await req.services!.templateService.getTemplateTags();

    const response: APIResponse<typeof tags> = {
      success: true,
      data: tags,
      message: '模板标签列表',
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
