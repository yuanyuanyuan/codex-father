/**
 * PRD CLI 命令处理器
 * 实现草稿管理、审查管理、版本管理、模板和工具命令
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import type { PRDCommandContext, PRDCommandResult, PRDCommandHandler } from './prd-commands.js';
import type { PRDDraft, CreateDraftRequest, UpdateDraftRequest } from '../models/prd-draft.js';
import type { Template, CreateTemplateRequest } from '../models/template.js';
import type { Version, VersionChange } from '../models/version.js';
import type { ReviewStatus } from '../models/review-status.js';
import { FileSystemDocumentService } from '../services/document-service.js';
import { DefaultTemplateService } from '../services/template-service.js';
import { DefaultPermissionService } from '../services/permission-service.js';
import { DefaultVersionService } from '../services/version-service.js';
import { DefaultDiagramService } from '../services/diagram-service.js';

// 服务实例
let documentService: FileSystemDocumentService;
let templateService: DefaultTemplateService;
let permissionService: DefaultPermissionService;
let versionService: DefaultVersionService;
let diagramService: DefaultDiagramService;

/**
 * 初始化服务
 */
function initializeServices(workingDirectory: string): void {
  if (!documentService) {
    documentService = new FileSystemDocumentService(workingDirectory);
    templateService = new DefaultTemplateService();
    permissionService = new DefaultPermissionService();
    versionService = new DefaultVersionService();
    diagramService = new DefaultDiagramService();
  }
}

// =============================================================================
// T027: 草稿管理命令 (Draft Management Commands)
// =============================================================================

/**
 * 创建新的 PRD 草稿
 */
export const createDraftCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const options = context.options as {
      title?: string;
      template?: string;
      description?: string;
      interactive?: boolean;
      author?: string;
    };

    let draftData: CreateDraftRequest;

    if (options.interactive || (!options.title && !context.args[0])) {
      // 交互模式
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'title',
          message: '请输入 PRD 标题:',
          default: options.title,
          validate: (input: string) => input.trim().length > 0 || '标题不能为空',
        },
        {
          type: 'list',
          name: 'template',
          message: '选择模板:',
          choices: await getTemplateChoices(),
          default: options.template || context.userConfig.defaultTemplate,
        },
        {
          type: 'input',
          name: 'description',
          message: '请输入描述 (可选):',
          default: options.description || '',
        },
      ]);

      draftData = {
        title: answers.title,
        template: answers.template,
        description: answers.description,
        author: options.author || context.userConfig.defaultAuthor || 'unknown',
      };
    } else {
      // 命令行模式
      draftData = {
        title: options.title || context.args[0],
        template: options.template || context.userConfig.defaultTemplate || 'basic',
        description: options.description || '',
        author: options.author || context.userConfig.defaultAuthor || 'unknown',
      };
    }

    // 检查权限
    const canCreate = await permissionService.canCreateDraft(draftData.author);
    if (!canCreate) {
      return {
        success: false,
        message: '没有创建草稿的权限',
        exitCode: 1,
        executionTime: 0,
      };
    }

    if (context.spinner) {
      context.spinner.text = '正在创建 PRD 草稿...';
    }

    const draft = await documentService.createDraft(draftData);

    return {
      success: true,
      message: `成功创建 PRD 草稿: ${draft.title}`,
      data: formatDraftForDisplay(draft, context),
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `创建草稿失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 列出 PRD 草稿
 */
export const listDraftsCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const options = context.options as {
      status?: string;
      author?: string;
      template?: string;
      search?: string;
      sort?: 'title' | 'created' | 'updated' | 'status';
      order?: 'asc' | 'desc';
      limit?: number;
    };

    if (context.spinner) {
      context.spinner.text = '正在获取 PRD 草稿列表...';
    }

    const drafts = await documentService.listDrafts({
      status: options.status as any,
      author: options.author,
      template: options.template,
      search: options.search,
      sort: options.sort || 'updated',
      order: options.order || 'desc',
      limit: options.limit || 20,
    });

    const formattedDrafts = drafts.map((draft) => formatDraftForDisplay(draft, context));

    return {
      success: true,
      message: `找到 ${drafts.length} 个 PRD 草稿`,
      data: formattedDrafts,
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `获取草稿列表失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 显示 PRD 草稿详情
 */
export const showDraftCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const draftId = context.args[0];
    if (!draftId) {
      return {
        success: false,
        message: '请指定草稿 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const options = context.options as {
      version?: string;
      section?: string;
      format?: 'full' | 'summary' | 'outline';
    };

    if (context.spinner) {
      context.spinner.text = '正在获取 PRD 草稿详情...';
    }

    const draft = await documentService.getDraft(draftId);
    if (!draft) {
      return {
        success: false,
        message: `未找到草稿: ${draftId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    // 检查阅读权限
    const canRead = await permissionService.canReadDraft('user', draft);
    if (!canRead) {
      return {
        success: false,
        message: '没有阅读此草稿的权限',
        exitCode: 1,
        executionTime: 0,
      };
    }

    let displayData = formatDraftForDisplay(draft, context);

    // 根据格式选项调整显示内容
    if (options.format === 'summary') {
      displayData = {
        id: draft.id,
        title: draft.title,
        status: draft.status,
        author: draft.author,
        created: draft.created,
        updated: draft.updated,
        description: draft.description,
      };
    } else if (options.format === 'outline') {
      displayData = {
        id: draft.id,
        title: draft.title,
        sections: Object.keys(draft.content || {}),
      };
    }

    // 过滤特定章节
    if (options.section && draft.content) {
      const sectionContent = draft.content[options.section];
      if (sectionContent) {
        displayData = {
          id: draft.id,
          title: draft.title,
          section: options.section,
          content: sectionContent,
        };
      } else {
        return {
          success: false,
          message: `未找到章节: ${options.section}`,
          exitCode: 1,
          executionTime: 0,
        };
      }
    }

    return {
      success: true,
      message: `草稿详情: ${draft.title}`,
      data: displayData,
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `获取草稿详情失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 编辑 PRD 草稿
 */
export const editDraftCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const draftId = context.args[0];
    if (!draftId) {
      return {
        success: false,
        message: '请指定草稿 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const options = context.options as {
      section?: string;
      editor?: string;
      message?: string;
      interactive?: boolean;
    };

    const draft = await documentService.getDraft(draftId);
    if (!draft) {
      return {
        success: false,
        message: `未找到草稿: ${draftId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    // 检查编辑权限
    const canEdit = await permissionService.canEditDraft('user', draft);
    if (!canEdit) {
      return {
        success: false,
        message: '没有编辑此草稿的权限',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const editor = options.editor || context.userConfig.editor;
    const tempFile = join(context.workingDirectory, `.prd-edit-${draftId}.md`);

    try {
      // 准备编辑内容
      let editContent = '';
      if (options.section && draft.content?.[options.section]) {
        editContent = draft.content[options.section];
      } else {
        editContent = generateMarkdownContent(draft);
      }

      // 写入临时文件
      writeFileSync(tempFile, editContent, 'utf-8');

      if (context.spinner) {
        context.spinner.text = `正在打开编辑器: ${editor}`;
      }

      // 打开编辑器
      await openEditor(editor, tempFile);

      // 读取编辑后的内容
      const editedContent = readFileSync(tempFile, 'utf-8');

      // 解析内容更新
      const updateData: UpdateDraftRequest = options.section
        ? { content: { ...draft.content, [options.section]: editedContent } }
        : parseMarkdownContent(editedContent);

      // 创建版本变更记录
      const changes: VersionChange[] = [
        {
          type: 'content_update',
          section: options.section || 'all',
          oldValue: options.section ? draft.content?.[options.section] : draft.content,
          newValue: options.section ? editedContent : updateData.content,
          description: options.message || '内容更新',
          author: 'user',
        },
      ];

      // 更新草稿
      const updatedDraft = await documentService.updateDraft(draftId, updateData, 'user');

      // 创建版本记录
      await versionService.createVersion(updatedDraft, changes, 'user');

      return {
        success: true,
        message: `成功更新草稿: ${updatedDraft.title}`,
        data: formatDraftForDisplay(updatedDraft, context),
        exitCode: 0,
        executionTime: 0,
      };
    } finally {
      // 清理临时文件
      if (existsSync(tempFile)) {
        try {
          require('fs').unlinkSync(tempFile);
        } catch (cleanupError) {
          // 忽略清理错误
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `编辑草稿失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 删除 PRD 草稿
 */
export const deleteDraftCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const draftId = context.args[0];
    if (!draftId) {
      return {
        success: false,
        message: '请指定草稿 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const options = context.options as {
      force?: boolean;
      archive?: boolean;
    };

    const draft = await documentService.getDraft(draftId);
    if (!draft) {
      return {
        success: false,
        message: `未找到草稿: ${draftId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    // 检查删除权限
    const canDelete = await permissionService.canDeleteDraft('user', draft);
    if (!canDelete) {
      return {
        success: false,
        message: '没有删除此草稿的权限',
        exitCode: 1,
        executionTime: 0,
      };
    }

    // 确认删除（除非使用 --force）
    if (!options.force && context.userConfig.preferences.confirmDelete) {
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'delete',
          message: `确定要删除草稿 "${draft.title}" 吗？此操作不可撤销。`,
          default: false,
        },
      ]);

      if (!confirm.delete) {
        return {
          success: false,
          message: '取消删除操作',
          exitCode: 0,
          executionTime: 0,
        };
      }
    }

    if (context.spinner) {
      context.spinner.text = '正在删除 PRD 草稿...';
    }

    if (options.archive) {
      // 归档而不是删除
      const archivedDraft = await documentService.updateDraft(
        draftId,
        {
          status: 'archived',
        },
        'user'
      );

      return {
        success: true,
        message: `成功归档草稿: ${archivedDraft.title}`,
        exitCode: 0,
        executionTime: 0,
      };
    } else {
      // 永久删除
      await documentService.deleteDraft(draftId);

      return {
        success: true,
        message: `成功删除草稿: ${draft.title}`,
        exitCode: 0,
        executionTime: 0,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `删除草稿失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

// =============================================================================
// T028: 审查管理命令 (Review Management Commands)
// =============================================================================

/**
 * 提交草稿进行审查
 */
export const submitReviewCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const draftId = context.args[0];
    if (!draftId) {
      return {
        success: false,
        message: '请指定草稿 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const options = context.options as {
      reviewers?: string[];
      reviewer?: string;
      dueDate?: string;
      priority?: 'low' | 'medium' | 'high';
      message?: string;
      interactive?: boolean;
    };

    const draft = await documentService.getDraft(draftId);
    if (!draft) {
      return {
        success: false,
        message: `未找到草稿: ${draftId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    // 检查提交审查权限
    const canSubmitReview = await permissionService.canSubmitForReview('user', draft);
    if (!canSubmitReview) {
      return {
        success: false,
        message: '没有提交此草稿进行审查的权限',
        exitCode: 1,
        executionTime: 0,
      };
    }

    let reviewData: {
      reviewers: string[];
      dueDate?: Date;
      priority: 'low' | 'medium' | 'high';
      message?: string;
    };

    if (options.interactive || (!options.reviewers && !options.reviewer)) {
      // 交互模式
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'reviewers',
          message: '请输入审查员（用逗号分隔）:',
          default: options.reviewer || '',
          validate: (input: string) => input.trim().length > 0 || '至少需要一个审查员',
        },
        {
          type: 'list',
          name: 'priority',
          message: '选择审查优先级:',
          choices: [
            { name: '低优先级', value: 'low' },
            { name: '中等优先级', value: 'medium' },
            { name: '高优先级', value: 'high' },
          ],
          default: options.priority || 'medium',
        },
        {
          type: 'input',
          name: 'dueDate',
          message: '设置截止日期 (YYYY-MM-DD) [可选]:',
          default: options.dueDate || '',
          validate: (input: string) => {
            if (!input.trim()) {
              return true;
            }
            const date = new Date(input);
            return !isNaN(date.getTime()) || '请输入有效的日期格式 (YYYY-MM-DD)';
          },
        },
        {
          type: 'input',
          name: 'message',
          message: '审查说明 [可选]:',
          default: options.message || '',
        },
      ]);

      reviewData = {
        reviewers: answers.reviewers.split(',').map((r: string) => r.trim()),
        priority: answers.priority,
        dueDate: answers.dueDate ? new Date(answers.dueDate) : undefined,
        message: answers.message || undefined,
      };
    } else {
      // 命令行模式
      const reviewers = options.reviewers || (options.reviewer ? [options.reviewer] : []);
      if (reviewers.length === 0) {
        return {
          success: false,
          message: '请指定至少一个审查员',
          exitCode: 1,
          executionTime: 0,
        };
      }

      reviewData = {
        reviewers,
        priority: options.priority || 'medium',
        dueDate: options.dueDate ? new Date(options.dueDate) : undefined,
        message: options.message,
      };
    }

    if (context.spinner) {
      context.spinner.text = '正在提交审查请求...';
    }

    // 更新草稿状态为审查中
    const updatedDraft = await documentService.updateDraft(
      draftId,
      {
        status: 'in_review',
        reviewers: reviewData.reviewers,
        reviewMetadata: {
          submittedBy: 'user',
          submittedAt: new Date(),
          dueDate: reviewData.dueDate,
          priority: reviewData.priority,
          message: reviewData.message,
        },
      },
      'user'
    );

    return {
      success: true,
      message: `成功提交审查请求: ${updatedDraft.title}`,
      data: {
        draftId: updatedDraft.id,
        title: updatedDraft.title,
        status: updatedDraft.status,
        reviewers: reviewData.reviewers,
        priority: reviewData.priority,
        dueDate: reviewData.dueDate?.toISOString(),
        message: reviewData.message,
      },
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `提交审查失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 查看审查状态
 */
export const reviewStatusCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const draftId = context.args[0];
    if (!draftId) {
      return {
        success: false,
        message: '请指定草稿 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const options = context.options as {
      detailed?: boolean;
      format?: 'table' | 'timeline';
    };

    const draft = await documentService.getDraft(draftId);
    if (!draft) {
      return {
        success: false,
        message: `未找到草稿: ${draftId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    // 检查查看审查权限
    const canViewReview = await permissionService.canViewReview('user', draft);
    if (!canViewReview) {
      return {
        success: false,
        message: '没有查看此草稿审查状态的权限',
        exitCode: 1,
        executionTime: 0,
      };
    }

    if (context.spinner) {
      context.spinner.text = '正在获取审查状态...';
    }

    const reviewStatus = {
      draftId: draft.id,
      title: draft.title,
      status: draft.status,
      reviewers: draft.reviewers || [],
      reviewMetadata: draft.reviewMetadata || {},
      reviewHistory: draft.reviewHistory || [],
      progress: calculateReviewProgress(draft),
      estimatedCompletion: estimateReviewCompletion(draft),
    };

    let displayData: any = reviewStatus;

    if (options.format === 'timeline') {
      displayData = formatReviewTimeline(reviewStatus);
    } else if (!options.detailed) {
      displayData = {
        draftId: reviewStatus.draftId,
        title: reviewStatus.title,
        status: reviewStatus.status,
        progress: reviewStatus.progress,
        reviewers: reviewStatus.reviewers.length,
        estimatedCompletion: reviewStatus.estimatedCompletion,
      };
    }

    return {
      success: true,
      message: `审查状态: ${draft.title}`,
      data: displayData,
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `获取审查状态失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 响应审查请求
 */
export const reviewRespondCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const draftId = context.args[0];
    if (!draftId) {
      return {
        success: false,
        message: '请指定草稿 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const options = context.options as {
      decision?: 'approve' | 'reject' | 'request_changes';
      comment?: string;
      section?: string;
      interactive?: boolean;
    };

    const draft = await documentService.getDraft(draftId);
    if (!draft) {
      return {
        success: false,
        message: `未找到草稿: ${draftId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    // 检查审查权限
    const canReview = await permissionService.canReview('user', draft);
    if (!canReview) {
      return {
        success: false,
        message: '没有审查此草稿的权限',
        exitCode: 1,
        executionTime: 0,
      };
    }

    // 检查是否是指定的审查员
    if (!draft.reviewers?.includes('user')) {
      return {
        success: false,
        message: '您不是此草稿的指定审查员',
        exitCode: 1,
        executionTime: 0,
      };
    }

    let reviewResponse: {
      decision: 'approve' | 'reject' | 'request_changes';
      comment?: string;
      section?: string;
    };

    if (options.interactive || !options.decision) {
      // 交互模式
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'decision',
          message: '请选择审查决策:',
          choices: [
            { name: '批准 (Approve)', value: 'approve' },
            { name: '拒绝 (Reject)', value: 'reject' },
            { name: '请求修改 (Request Changes)', value: 'request_changes' },
          ],
          default: options.decision,
        },
        {
          type: 'input',
          name: 'comment',
          message: '审查意见 [可选]:',
          default: options.comment || '',
        },
        {
          type: 'input',
          name: 'section',
          message: '特定章节 [可选]:',
          default: options.section || '',
        },
      ]);

      reviewResponse = {
        decision: answers.decision,
        comment: answers.comment || undefined,
        section: answers.section || undefined,
      };
    } else {
      reviewResponse = {
        decision: options.decision,
        comment: options.comment,
        section: options.section,
      };
    }

    if (context.spinner) {
      context.spinner.text = '正在提交审查意见...';
    }

    // 添加审查记录
    const reviewRecord = {
      reviewer: 'user',
      decision: reviewResponse.decision,
      comment: reviewResponse.comment,
      section: reviewResponse.section,
      reviewedAt: new Date(),
      reviewId: `review_${Date.now()}`,
    };

    const reviewHistory = [...(draft.reviewHistory || []), reviewRecord];

    // 计算整体审查状态
    const overallStatus = calculateOverallReviewStatus(reviewHistory, draft.reviewers || []);

    // 更新草稿
    const updatedDraft = await documentService.updateDraft(
      draftId,
      {
        status: overallStatus,
        reviewHistory,
      },
      'user'
    );

    return {
      success: true,
      message: `成功提交审查意见: ${reviewResponse.decision}`,
      data: {
        draftId: updatedDraft.id,
        title: updatedDraft.title,
        decision: reviewResponse.decision,
        comment: reviewResponse.comment,
        section: reviewResponse.section,
        overallStatus: updatedDraft.status,
        reviewProgress: calculateReviewProgress(updatedDraft),
      },
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `提交审查意见失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

// =============================================================================
// T029: 版本管理命令 (Version Management Commands)
// =============================================================================

/**
 * 列出版本历史
 */
export const listVersionsCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const draftId = context.args[0];
    if (!draftId) {
      return {
        success: false,
        message: '请指定草稿 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const options = context.options as {
      limit?: number;
      format?: 'table' | 'timeline' | 'detailed';
      author?: string;
    };

    const draft = await documentService.getDraft(draftId);
    if (!draft) {
      return {
        success: false,
        message: `未找到草稿: ${draftId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    if (context.spinner) {
      context.spinner.text = '正在获取版本历史...';
    }

    const versions = await versionService.listVersions(draftId, {
      limit: options.limit || 20,
      author: options.author,
    });

    let displayData: any = versions;

    if (options.format === 'timeline') {
      displayData = formatVersionTimeline(versions);
    } else if (options.format === 'detailed') {
      displayData = versions.map((version) => ({
        ...version,
        changesSummary: summarizeChanges(version.changes || []),
        formattedDate: new Date(version.created).toLocaleString(),
      }));
    } else {
      displayData = versions.map((version) => ({
        id: version.id,
        version: version.version,
        author: version.author,
        created: new Date(version.created).toLocaleString(),
        changesCount: version.changes?.length || 0,
        description: version.description,
      }));
    }

    return {
      success: true,
      message: `找到 ${versions.length} 个版本`,
      data: displayData,
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `获取版本历史失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 显示版本详情
 */
export const showVersionCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const draftId = context.args[0];
    const versionId = context.args[1];

    if (!draftId || !versionId) {
      return {
        success: false,
        message: '请指定草稿 ID 和版本 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    if (context.spinner) {
      context.spinner.text = '正在获取版本详情...';
    }

    const version = await versionService.getVersion(versionId);
    if (!version) {
      return {
        success: false,
        message: `未找到版本: ${versionId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    const displayData = {
      ...version,
      formattedDate: new Date(version.created).toLocaleString(),
      changesSummary: summarizeChanges(version.changes || []),
      changesDetail: version.changes?.map((change) => ({
        type: change.type,
        section: change.section,
        description: change.description,
        author: change.author,
      })),
    };

    return {
      success: true,
      message: `版本详情: ${version.version}`,
      data: displayData,
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `获取版本详情失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 恢复到指定版本
 */
export const restoreVersionCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const draftId = context.args[0];
    const versionId = context.args[1];

    if (!draftId || !versionId) {
      return {
        success: false,
        message: '请指定草稿 ID 和版本 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const options = context.options as {
      force?: boolean;
      createBackup?: boolean;
    };

    const draft = await documentService.getDraft(draftId);
    if (!draft) {
      return {
        success: false,
        message: `未找到草稿: ${draftId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    const version = await versionService.getVersion(versionId);
    if (!version) {
      return {
        success: false,
        message: `未找到版本: ${versionId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    // 检查权限
    const canEdit = await permissionService.canEditDraft('user', draft);
    if (!canEdit) {
      return {
        success: false,
        message: '没有编辑此草稿的权限',
        exitCode: 1,
        executionTime: 0,
      };
    }

    // 确认回滚（除非使用 --force）
    if (!options.force) {
      const confirm = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'restore',
          message: `确定要将草稿恢复到版本 ${version.version} 吗？当前更改将丢失。`,
          default: false,
        },
      ]);

      if (!confirm.restore) {
        return {
          success: false,
          message: '取消版本恢复操作',
          exitCode: 0,
          executionTime: 0,
        };
      }
    }

    if (context.spinner) {
      context.spinner.text = '正在恢复版本...';
    }

    // 创建备份（如果需要）
    if (options.createBackup !== false) {
      const backupChanges: VersionChange[] = [
        {
          type: 'backup',
          section: 'all',
          oldValue: null,
          newValue: draft.content,
          description: `恢复前备份 - 版本 ${version.version}`,
          author: 'user',
        },
      ];

      await versionService.createVersion(draft, backupChanges, 'user');
    }

    // 执行恢复
    const restoredDraft = await versionService.restoreVersion(draft, versionId, 'user');

    return {
      success: true,
      message: `成功恢复到版本 ${version.version}`,
      data: {
        draftId: restoredDraft.id,
        title: restoredDraft.title,
        restoredVersion: version.version,
        currentVersion: restoredDraft.version,
      },
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `版本恢复失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 比较版本差异
 */
export const diffVersionsCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const draftId = context.args[0];
    const version1 = context.args[1];
    const version2 = context.args[2];

    if (!draftId || !version1 || !version2) {
      return {
        success: false,
        message: '请指定草稿 ID 和两个版本 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const options = context.options as {
      format?: 'unified' | 'side-by-side' | 'summary';
      section?: string;
    };

    if (context.spinner) {
      context.spinner.text = '正在比较版本差异...';
    }

    const comparison = await versionService.compareVersions(version1, version2);

    let displayData: any = comparison;

    if (options.format === 'summary') {
      displayData = {
        version1: comparison.version1,
        version2: comparison.version2,
        changesCount: comparison.changes?.length || 0,
        addedSections: comparison.changes?.filter((c) => c.type === 'addition').length || 0,
        modifiedSections: comparison.changes?.filter((c) => c.type === 'modification').length || 0,
        deletedSections: comparison.changes?.filter((c) => c.type === 'deletion').length || 0,
      };
    } else if (options.section) {
      const sectionChanges = comparison.changes?.filter((c) => c.section === options.section);
      displayData = {
        ...comparison,
        changes: sectionChanges,
        section: options.section,
      };
    }

    return {
      success: true,
      message: `版本比较: ${version1} vs ${version2}`,
      data: displayData,
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `版本比较失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

// =============================================================================
// T030: 模板和工具命令 (Template and Utility Commands)
// =============================================================================

/**
 * 列出模板
 */
export const listTemplatesCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const options = context.options as {
      category?: string;
      detailed?: boolean;
    };

    if (context.spinner) {
      context.spinner.text = '正在获取模板列表...';
    }

    const templates = await templateService.listTemplates({
      category: options.category,
    });

    const displayData = templates.map((template) =>
      options.detailed
        ? template
        : {
            id: template.id,
            name: template.name,
            description: template.description,
            category: template.category,
            created: new Date(template.created).toLocaleString(),
          }
    );

    return {
      success: true,
      message: `找到 ${templates.length} 个模板`,
      data: displayData,
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `获取模板列表失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 显示模板详情
 */
export const showTemplateCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const templateId = context.args[0];
    if (!templateId) {
      return {
        success: false,
        message: '请指定模板 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    if (context.spinner) {
      context.spinner.text = '正在获取模板详情...';
    }

    const template = await templateService.getTemplate(templateId);
    if (!template) {
      return {
        success: false,
        message: `未找到模板: ${templateId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    return {
      success: true,
      message: `模板详情: ${template.name}`,
      data: template,
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `获取模板详情失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 导出草稿
 */
export const exportDraftCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const draftId = context.args[0];
    if (!draftId) {
      return {
        success: false,
        message: '请指定草稿 ID',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const options = context.options as {
      format?: 'markdown' | 'html' | 'pdf' | 'docx';
      output?: string;
      template?: string;
    };

    const draft = await documentService.getDraft(draftId);
    if (!draft) {
      return {
        success: false,
        message: `未找到草稿: ${draftId}`,
        exitCode: 1,
        executionTime: 0,
      };
    }

    const format = options.format || 'markdown';
    const outputPath = options.output || `${draft.title.replace(/[^a-zA-Z0-9]/g, '_')}.${format}`;

    if (context.spinner) {
      context.spinner.text = `正在导出为 ${format.toUpperCase()} 格式...`;
    }

    let exportedContent: string;

    switch (format) {
      case 'markdown':
        exportedContent = generateMarkdownContent(draft);
        break;
      case 'html':
        exportedContent = await generateHtmlContent(draft, options.template);
        break;
      case 'pdf':
      case 'docx':
        return {
          success: false,
          message: `${format.toUpperCase()} 格式导出功能正在开发中`,
          exitCode: 1,
          executionTime: 0,
        };
      default:
        return {
          success: false,
          message: `不支持的导出格式: ${format}`,
          exitCode: 1,
          executionTime: 0,
        };
    }

    // 写入文件
    writeFileSync(resolve(context.workingDirectory, outputPath), exportedContent, 'utf-8');

    return {
      success: true,
      message: `成功导出到: ${outputPath}`,
      data: {
        draftId: draft.id,
        title: draft.title,
        format,
        outputPath,
        size: exportedContent.length,
      },
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `导出失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

/**
 * 搜索草稿
 */
export const searchCommand: PRDCommandHandler = async (
  context: PRDCommandContext
): Promise<PRDCommandResult> => {
  try {
    initializeServices(context.workingDirectory);

    const query = context.args[0];
    if (!query) {
      return {
        success: false,
        message: '请指定搜索关键词',
        exitCode: 1,
        executionTime: 0,
      };
    }

    const options = context.options as {
      scope?: 'title' | 'content' | 'all';
      author?: string;
      status?: string;
      limit?: number;
    };

    if (context.spinner) {
      context.spinner.text = '正在搜索...';
    }

    const results = await documentService.searchDrafts({
      query,
      scope: options.scope || 'all',
      author: options.author,
      status: options.status as any,
      limit: options.limit || 10,
    });

    const displayData = results.map((result) => ({
      id: result.id,
      title: result.title,
      author: result.author,
      status: result.status,
      updated: new Date(result.updated).toLocaleString(),
      relevance: result.relevanceScore || 0,
      matchHighlight: result.matchHighlight || '',
    }));

    return {
      success: true,
      message: `找到 ${results.length} 个匹配结果`,
      data: displayData,
      exitCode: 0,
      executionTime: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `搜索失败: ${(error as Error).message}`,
      error: error as Error,
      exitCode: 1,
      executionTime: 0,
    };
  }
};

// =============================================================================
// 辅助函数 (Helper Functions)
// =============================================================================

/**
 * 获取模板选项列表
 */
async function getTemplateChoices(): Promise<Array<{ name: string; value: string }>> {
  try {
    const templates = await templateService.listTemplates({});
    return templates.map((template) => ({
      name: `${template.name} - ${template.description}`,
      value: template.id,
    }));
  } catch (error) {
    return [
      { name: 'Basic Template - 基础模板', value: 'basic' },
      { name: 'Feature Template - 功能模板', value: 'feature' },
      { name: 'Architecture Template - 架构模板', value: 'architecture' },
    ];
  }
}

/**
 * 格式化草稿显示数据
 */
function formatDraftForDisplay(draft: PRDDraft, context: PRDCommandContext): any {
  const baseData = {
    id: draft.id,
    title: draft.title,
    status: draft.status,
    author: draft.author,
    template: draft.template,
    created: new Date(draft.created).toLocaleString(),
    updated: new Date(draft.updated).toLocaleString(),
  };

  if (context.userConfig.outputFormat === 'json') {
    return draft;
  }

  return baseData;
}

/**
 * 生成草稿的 Markdown 内容
 */
function generateMarkdownContent(draft: PRDDraft): string {
  let markdown = `# ${draft.title}\n\n`;

  if (draft.description) {
    markdown += `${draft.description}\n\n`;
  }

  if (draft.content) {
    Object.entries(draft.content).forEach(([section, content]) => {
      markdown += `## ${section}\n\n${content}\n\n`;
    });
  }

  return markdown;
}

/**
 * 解析 Markdown 内容为草稿数据
 */
function parseMarkdownContent(markdown: string): UpdateDraftRequest {
  const lines = markdown.split('\n');
  const content: Record<string, string> = {};
  let currentSection = '';
  let currentContent: string[] = [];
  let title = '';

  for (const line of lines) {
    if (line.startsWith('# ')) {
      title = line.substring(2).trim();
    } else if (line.startsWith('## ')) {
      // 保存前一个章节
      if (currentSection && currentContent.length > 0) {
        content[currentSection] = currentContent.join('\n').trim();
      }

      // 开始新章节
      currentSection = line.substring(3).trim();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // 保存最后一个章节
  if (currentSection && currentContent.length > 0) {
    content[currentSection] = currentContent.join('\n').trim();
  }

  return {
    title: title || undefined,
    content,
  };
}

/**
 * 打开编辑器
 */
function openEditor(editor: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const editorProcess = spawn(editor, [filePath], {
      stdio: 'inherit',
    });

    editorProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`编辑器退出代码: ${code}`));
      }
    });

    editorProcess.on('error', (error) => {
      reject(new Error(`无法启动编辑器 ${editor}: ${error.message}`));
    });
  });
}

/**
 * 计算审查进度
 */
function calculateReviewProgress(draft: PRDDraft): {
  completed: number;
  total: number;
  percentage: number;
  pendingReviewers: string[];
  completedReviewers: string[];
} {
  const totalReviewers = draft.reviewers?.length || 0;
  const reviewHistory = draft.reviewHistory || [];

  const completedReviewers = new Set(reviewHistory.map((record) => record.reviewer));

  const pendingReviewers = (draft.reviewers || []).filter(
    (reviewer) => !completedReviewers.has(reviewer)
  );

  const completed = completedReviewers.size;
  const percentage = totalReviewers > 0 ? Math.round((completed / totalReviewers) * 100) : 0;

  return {
    completed,
    total: totalReviewers,
    percentage,
    pendingReviewers,
    completedReviewers: Array.from(completedReviewers),
  };
}

/**
 * 估算审查完成时间
 */
function estimateReviewCompletion(draft: PRDDraft): string | null {
  const reviewMetadata = draft.reviewMetadata;
  if (!reviewMetadata?.dueDate) {
    return null;
  }

  const dueDate = new Date(reviewMetadata.dueDate);
  const now = new Date();

  if (dueDate < now) {
    return '已逾期';
  }

  const diffTime = dueDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return '今日截止';
  } else if (diffDays === 1) {
    return '明日截止';
  } else {
    return `${diffDays} 天后截止`;
  }
}

/**
 * 计算整体审查状态
 */
function calculateOverallReviewStatus(
  reviewHistory: any[],
  reviewers: string[]
): 'draft' | 'in_review' | 'approved' | 'rejected' | 'requires_changes' {
  if (reviewHistory.length === 0) {
    return 'in_review';
  }

  const latestDecisions = new Map<string, string>();

  // 获取每个审查员的最新决策
  reviewHistory.forEach((record) => {
    latestDecisions.set(record.reviewer, record.decision);
  });

  const decisions = Array.from(latestDecisions.values());

  // 如果有拒绝，整体状态为拒绝
  if (decisions.includes('reject')) {
    return 'rejected';
  }

  // 如果有请求修改，整体状态为需要修改
  if (decisions.includes('request_changes')) {
    return 'requires_changes';
  }

  // 如果所有审查员都批准了，状态为已批准
  if (reviewers.every((reviewer) => latestDecisions.get(reviewer) === 'approve')) {
    return 'approved';
  }

  // 否则仍在审查中
  return 'in_review';
}

/**
 * 格式化审查时间线
 */
function formatReviewTimeline(reviewStatus: any): any {
  const timeline = [];

  // 添加提交审查事件
  if (reviewStatus.reviewMetadata?.submittedAt) {
    timeline.push({
      date: reviewStatus.reviewMetadata.submittedAt,
      event: 'submitted',
      description: `由 ${reviewStatus.reviewMetadata.submittedBy} 提交审查`,
      priority: reviewStatus.reviewMetadata.priority,
    });
  }

  // 添加审查历史事件
  reviewStatus.reviewHistory?.forEach((record: any) => {
    timeline.push({
      date: record.reviewedAt,
      event: 'review',
      reviewer: record.reviewer,
      decision: record.decision,
      comment: record.comment,
      section: record.section,
      description: `${record.reviewer} 的审查决策: ${record.decision}`,
    });
  });

  // 按时间排序
  timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    draftId: reviewStatus.draftId,
    title: reviewStatus.title,
    status: reviewStatus.status,
    timeline,
  };
}

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
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');

  return summary;
}

/**
 * 格式化版本时间线
 */
function formatVersionTimeline(versions: Version[]): any {
  return {
    versions: versions.length,
    timeline: versions
      .map((version) => ({
        version: version.version,
        author: version.author,
        created: new Date(version.created).toLocaleString(),
        description: version.description,
        changesCount: version.changes?.length || 0,
      }))
      .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()),
  };
}

/**
 * 生成 HTML 内容
 */
async function generateHtmlContent(draft: PRDDraft, templateName?: string): Promise<string> {
  const markdownContent = generateMarkdownContent(draft);

  // 简单的 Markdown 到 HTML 转换
  const htmlContent = markdownContent
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^\s*$/gm, '');

  // 添加基础 HTML 结构
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${draft.title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1, h2, h3 {
            color: #2c3e50;
            margin-top: 2em;
        }
        h1 {
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            border-bottom: 1px solid #ecf0f1;
            padding-bottom: 5px;
        }
        p {
            margin: 1em 0;
        }
        .meta {
            background: #f8f9fa;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin: 20px 0;
        }
    </style>
</head>
<body>
    <div class="meta">
        <strong>作者:</strong> ${draft.author}<br>
        <strong>状态:</strong> ${draft.status}<br>
        <strong>创建时间:</strong> ${new Date(draft.created).toLocaleString()}<br>
        <strong>更新时间:</strong> ${new Date(draft.updated).toLocaleString()}
    </div>
    <p>${htmlContent}</p>
</body>
</html>`;

  return html;
}
