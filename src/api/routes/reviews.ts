/**
 * T033: 审查管理 API 端点
 * 提供草稿审查工作流管理，包含审查提交、状态查询、决策处理等功能
 */

import { Router, Request, Response, NextFunction } from 'express';
import type { PRDRequest, APIResponse } from '../server.js';
import type { ReviewStatus } from '../../models/review-status.js';

/**
 * 提交审查请求接口
 */
interface SubmitReviewRequest {
  reviewers: string[];
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  message?: string;
  sections?: string[];
  reviewType?: 'full' | 'partial' | 'quick';
}

/**
 * 审查决策请求接口
 */
interface ReviewDecisionRequest {
  decision: 'approve' | 'reject' | 'request_changes';
  comment?: string;
  sections?: {
    section: string;
    comment: string;
  }[];
  suggestions?: {
    section: string;
    original: string;
    suggested: string;
    reason: string;
  }[];
}

/**
 * 审查状态查询参数接口
 */
interface ReviewStatusQuery {
  detailed?: string;
  includeHistory?: string;
  format?: 'timeline' | 'summary' | 'full';
}

/**
 * 创建审查管理路由
 */
export function createReviewRoutes(): Router {
  const router = Router();

  // GET /api/drafts/:id/reviews - 获取审查状态
  router.get('/:id/reviews', getReviewStatus);

  // POST /api/drafts/:id/reviews - 提交审查请求
  router.post('/:id/reviews', submitForReview);

  // GET /api/drafts/:id/reviews/:reviewId - 获取特定审查详情
  router.get('/:id/reviews/:reviewId', getReviewDetails);

  // PUT /api/drafts/:id/reviews/:reviewId - 提交审查决策
  router.put('/:id/reviews/:reviewId', submitReview);

  // DELETE /api/drafts/:id/reviews/:reviewId - 撤销审查请求
  router.delete('/:id/reviews/:reviewId', cancelReview);

  // POST /api/drafts/:id/reviews/:reviewId/reassign - 重新分配审查员
  router.post('/:id/reviews/:reviewId/reassign', reassignReview);

  // GET /api/drafts/:id/reviews/:reviewId/timeline - 审查时间线
  router.get('/:id/reviews/:reviewId/timeline', getReviewTimeline);

  // POST /api/drafts/:id/reviews/:reviewId/comments - 添加审查评论
  router.post('/:id/reviews/:reviewId/comments', addReviewComment);

  return router;
}

/**
 * 获取审查状态 - GET /api/drafts/:id/reviews
 */
async function getReviewStatus(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId } = req.params;
    const query = req.query as ReviewStatusQuery;

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

    // 检查查看审查权限
    const canViewReview = await req.services!.permissionService.canViewReview(req.user!.id, draft);
    if (!canViewReview) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有查看此草稿审查状态的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 构建审查状态数据
    const reviewStatus = {
      draftId: draft.id,
      title: draft.title,
      status: draft.status,
      reviewers: draft.reviewers || [],
      reviewMetadata: draft.reviewMetadata || {},
      reviewHistory: draft.reviewHistory || [],
      progress: calculateReviewProgress(draft),
      estimatedCompletion: estimateReviewCompletion(draft),
      currentReviewCycle: getCurrentReviewCycle(draft),
      blockers: identifyReviewBlockers(draft),
    };

    let responseData: any = reviewStatus;

    // 根据查询参数调整返回数据
    if (query.format === 'summary') {
      responseData = {
        draftId: reviewStatus.draftId,
        title: reviewStatus.title,
        status: reviewStatus.status,
        progress: reviewStatus.progress,
        estimatedCompletion: reviewStatus.estimatedCompletion,
        activeReviewers: reviewStatus.reviewers.length,
        blockers: reviewStatus.blockers,
      };
    } else if (query.format === 'timeline') {
      responseData = formatReviewTimeline(reviewStatus);
    }

    const response: APIResponse<typeof responseData> = {
      success: true,
      data: responseData,
      message: `审查状态: ${draft.title}`,
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
 * 提交审查请求 - POST /api/drafts/:id/reviews
 */
async function submitForReview(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId } = req.params;
    const reviewData = req.body as SubmitReviewRequest;

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

    // 检查提交审查权限
    const canSubmitReview = await req.services!.permissionService.canSubmitForReview(
      req.user!.id,
      draft
    );
    if (!canSubmitReview) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有提交此草稿进行审查的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 验证审查员列表
    if (!reviewData.reviewers || reviewData.reviewers.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必须指定至少一个审查员',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 验证审查员权限
    for (const reviewerId of reviewData.reviewers) {
      const canReview = await req.services!.permissionService.canReview(reviewerId, draft);
      if (!canReview) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `用户 ${reviewerId} 没有审查权限`,
          },
          meta: {
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
          },
        });
      }
    }

    // 检查草稿状态是否允许提交审查
    if (draft.status === 'in_review') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: '草稿已在审查中',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 创建审查请求
    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const updatedDraft = await req.services!.documentService.updateDraft(
      draftId,
      {
        status: 'in_review',
        reviewers: reviewData.reviewers,
        reviewMetadata: {
          submittedBy: req.user!.id,
          submittedAt: new Date(),
          dueDate: reviewData.dueDate ? new Date(reviewData.dueDate) : undefined,
          priority: reviewData.priority || 'medium',
          message: reviewData.message,
          sections: reviewData.sections,
          reviewType: reviewData.reviewType || 'full',
          reviewId,
        },
      },
      req.user!.id
    );

    // 发送审查通知（模拟）
    const notifications = reviewData.reviewers.map((reviewerId) => ({
      to: reviewerId,
      type: 'review_request',
      draftId: draft.id,
      draftTitle: draft.title,
      requester: req.user!.id,
      dueDate: reviewData.dueDate,
      priority: reviewData.priority,
    }));

    const response: APIResponse<{
      draft: typeof updatedDraft;
      reviewId: string;
      notifications: typeof notifications;
    }> = {
      success: true,
      data: {
        draft: updatedDraft,
        reviewId,
        notifications,
      },
      message: `成功提交审查请求: ${updatedDraft.title}`,
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
 * 获取特定审查详情 - GET /api/drafts/:id/reviews/:reviewId
 */
async function getReviewDetails(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId, reviewId } = req.params;

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

    // 验证审查是否存在
    if (!draft.reviewMetadata?.reviewId || draft.reviewMetadata.reviewId !== reviewId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `审查不存在: ${reviewId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查权限
    const canViewReview = await req.services!.permissionService.canViewReview(req.user!.id, draft);
    if (!canViewReview) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有查看此审查详情的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    const reviewDetails = {
      reviewId: draft.reviewMetadata.reviewId,
      draftId: draft.id,
      draftTitle: draft.title,
      submittedBy: draft.reviewMetadata.submittedBy,
      submittedAt: draft.reviewMetadata.submittedAt,
      dueDate: draft.reviewMetadata.dueDate,
      priority: draft.reviewMetadata.priority,
      message: draft.reviewMetadata.message,
      sections: draft.reviewMetadata.sections,
      reviewType: draft.reviewMetadata.reviewType,
      reviewers: draft.reviewers || [],
      status: draft.status,
      reviewHistory: draft.reviewHistory || [],
      progress: calculateReviewProgress(draft),
      metrics: calculateReviewMetrics(draft),
    };

    const response: APIResponse<typeof reviewDetails> = {
      success: true,
      data: reviewDetails,
      message: `审查详情: ${reviewId}`,
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
 * 提交审查决策 - PUT /api/drafts/:id/reviews/:reviewId
 */
async function submitReview(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId, reviewId } = req.params;
    const reviewDecision = req.body as ReviewDecisionRequest;

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

    // 验证审查是否存在
    if (!draft.reviewMetadata?.reviewId || draft.reviewMetadata.reviewId !== reviewId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `审查不存在: ${reviewId}`,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查审查权限
    const canReview = await req.services!.permissionService.canReview(req.user!.id, draft);
    if (!canReview) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有审查此草稿的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 检查是否是指定的审查员
    if (!draft.reviewers?.includes(req.user!.id)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '您不是此草稿的指定审查员',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 验证决策数据
    if (
      !reviewDecision.decision ||
      !['approve', 'reject', 'request_changes'].includes(reviewDecision.decision)
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '必须提供有效的审查决策',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 创建审查记录
    const reviewRecord = {
      reviewer: req.user!.id,
      decision: reviewDecision.decision,
      comment: reviewDecision.comment,
      sections: reviewDecision.sections,
      suggestions: reviewDecision.suggestions,
      reviewedAt: new Date(),
      reviewId: `decision_${Date.now()}`,
    };

    const reviewHistory = [...(draft.reviewHistory || []), reviewRecord];

    // 计算整体审查状态
    const overallStatus = calculateOverallReviewStatus(reviewHistory, draft.reviewers || []);

    // 更新草稿
    const updatedDraft = await req.services!.documentService.updateDraft(
      draftId,
      {
        status: overallStatus,
        reviewHistory,
      },
      req.user!.id
    );

    // 如果审查完成，发送通知
    const notifications: any[] = [];
    if (['approved', 'rejected', 'requires_changes'].includes(overallStatus)) {
      notifications.push({
        to: draft.reviewMetadata!.submittedBy,
        type: 'review_completed',
        draftId: draft.id,
        draftTitle: draft.title,
        finalDecision: overallStatus,
        reviewer: req.user!.id,
      });
    }

    const response: APIResponse<{
      draft: typeof updatedDraft;
      reviewRecord: typeof reviewRecord;
      overallStatus: string;
      progress: any;
      notifications: typeof notifications;
    }> = {
      success: true,
      data: {
        draft: updatedDraft,
        reviewRecord,
        overallStatus,
        progress: calculateReviewProgress(updatedDraft),
        notifications,
      },
      message: `成功提交审查决策: ${reviewDecision.decision}`,
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
 * 撤销审查请求 - DELETE /api/drafts/:id/reviews/:reviewId
 */
async function cancelReview(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId, reviewId } = req.params;

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

    // 只有提交者或管理员可以撤销审查
    if (draft.reviewMetadata?.submittedBy !== req.user!.id && req.user!.role !== 'architect') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '只有审查提交者或管理员可以撤销审查',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 撤销审查
    const updatedDraft = await req.services!.documentService.updateDraft(
      draftId,
      {
        status: 'draft',
        reviewers: [],
        reviewMetadata: undefined,
        reviewHistory: [],
      },
      req.user!.id
    );

    const response: APIResponse<typeof updatedDraft> = {
      success: true,
      data: updatedDraft,
      message: `成功撤销审查: ${draft.title}`,
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
 * 重新分配审查员 - POST /api/drafts/:id/reviews/:reviewId/reassign
 */
async function reassignReview(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId, reviewId } = req.params;
    const { newReviewers, message } = req.body;

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

    // 验证权限
    if (draft.reviewMetadata?.submittedBy !== req.user!.id && req.user!.role !== 'architect') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '只有审查提交者或管理员可以重新分配审查员',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 更新审查员
    const updatedDraft = await req.services!.documentService.updateDraft(
      draftId,
      {
        reviewers: newReviewers,
        reviewMetadata: {
          ...draft.reviewMetadata!,
          reassignedBy: req.user!.id,
          reassignedAt: new Date(),
          reassignMessage: message,
        },
      },
      req.user!.id
    );

    const response: APIResponse<typeof updatedDraft> = {
      success: true,
      data: updatedDraft,
      message: '成功重新分配审查员',
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
 * 获取审查时间线 - GET /api/drafts/:id/reviews/:reviewId/timeline
 */
async function getReviewTimeline(
  req: PRDRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id: draftId, reviewId } = req.params;

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

    const timeline = generateReviewTimeline(draft);

    const response: APIResponse<typeof timeline> = {
      success: true,
      data: timeline,
      message: '审查时间线',
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
 * 添加审查评论 - POST /api/drafts/:id/reviews/:reviewId/comments
 */
async function addReviewComment(req: PRDRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: draftId, reviewId } = req.params;
    const { comment, section, type = 'general' } = req.body;

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

    // 检查权限
    const canComment = await req.services!.permissionService.canViewReview(req.user!.id, draft);
    if (!canComment) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: '没有添加评论的权限',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        },
      });
    }

    // 添加评论到审查历史
    const commentRecord = {
      reviewer: req.user!.id,
      decision: 'comment',
      comment,
      section,
      type,
      reviewedAt: new Date(),
      reviewId: `comment_${Date.now()}`,
    };

    const reviewHistory = [...(draft.reviewHistory || []), commentRecord];

    const updatedDraft = await req.services!.documentService.updateDraft(
      draftId,
      {
        reviewHistory,
      },
      req.user!.id
    );

    const response: APIResponse<typeof commentRecord> = {
      success: true,
      data: commentRecord,
      message: '成功添加评论',
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

// =============================================================================
// 辅助函数 (Helper Functions)
// =============================================================================

/**
 * 计算审查进度
 */
function calculateReviewProgress(draft: any): any {
  const totalReviewers = draft.reviewers?.length || 0;
  const reviewHistory = draft.reviewHistory || [];

  const completedReviewers = new Set(
    reviewHistory
      .filter((record: any) => ['approve', 'reject', 'request_changes'].includes(record.decision))
      .map((record: any) => record.reviewer)
  );

  const pendingReviewers = (draft.reviewers || []).filter(
    (reviewer: string) => !completedReviewers.has(reviewer)
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
function estimateReviewCompletion(draft: any): string | null {
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
 * 获取当前审查周期
 */
function getCurrentReviewCycle(draft: any): any {
  return {
    cycle: 1, // 简化实现
    startDate: draft.reviewMetadata?.submittedAt,
    expectedEndDate: draft.reviewMetadata?.dueDate,
    status: draft.status,
  };
}

/**
 * 识别审查阻塞因素
 */
function identifyReviewBlockers(draft: any): string[] {
  const blockers: string[] = [];

  const progress = calculateReviewProgress(draft);
  if (progress.pendingReviewers.length > 0) {
    blockers.push(`等待 ${progress.pendingReviewers.length} 位审查员响应`);
  }

  const dueDate = draft.reviewMetadata?.dueDate;
  if (dueDate && new Date(dueDate) < new Date()) {
    blockers.push('审查已逾期');
  }

  return blockers;
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
    if (['approve', 'reject', 'request_changes'].includes(record.decision)) {
      latestDecisions.set(record.reviewer, record.decision);
    }
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
 * 计算审查指标
 */
function calculateReviewMetrics(draft: any): any {
  const reviewHistory = draft.reviewHistory || [];
  const submittedAt = draft.reviewMetadata?.submittedAt;

  if (!submittedAt) {
    return null;
  }

  const startTime = new Date(submittedAt).getTime();
  const now = Date.now();
  const duration = now - startTime;

  return {
    totalDuration: Math.round(duration / (1000 * 60 * 60)), // 小时
    averageResponseTime:
      reviewHistory.length > 0 ? Math.round(duration / reviewHistory.length / (1000 * 60 * 60)) : 0,
    totalComments: reviewHistory.filter((r: any) => r.comment).length,
    decisionsCount: reviewHistory.filter((r: any) =>
      ['approve', 'reject', 'request_changes'].includes(r.decision)
    ).length,
  };
}

/**
 * 生成审查时间线
 */
function generateReviewTimeline(draft: any): any {
  const events = [];

  // 创建事件
  events.push({
    type: 'created',
    date: draft.created,
    description: `草稿由 ${draft.author} 创建`,
  });

  // 提交审查事件
  if (draft.reviewMetadata?.submittedAt) {
    events.push({
      type: 'review_submitted',
      date: draft.reviewMetadata.submittedAt,
      description: `由 ${draft.reviewMetadata.submittedBy} 提交审查`,
    });
  }

  // 审查历史事件
  draft.reviewHistory?.forEach((record: any) => {
    events.push({
      type: 'review_action',
      date: record.reviewedAt,
      reviewer: record.reviewer,
      decision: record.decision,
      description: `${record.reviewer}: ${record.decision}`,
    });
  });

  return {
    draftId: draft.id,
    title: draft.title,
    events: events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
  };
}
