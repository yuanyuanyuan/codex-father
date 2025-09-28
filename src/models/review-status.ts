/**
 * T013: ReviewStatus 数据模型
 *
 * 审查状态实体，管理文档的审查流程状态
 * 包含状态流转、审查者分配、审查记录和评论管理
 */

import { RoleType } from './user-role.js';

// 状态类型枚举
export type StatusType =
  | 'draft' // 草稿状态 - 初始创建，作者编辑中
  | 'in_review' // 审查中 - 已提交审查，等待审查者响应
  | 'changes_requested' // 需要修改 - 审查者要求修改
  | 'approved' // 已批准 - 审查通过
  | 'rejected' // 已拒绝 - 审查不通过
  | 'confirmed'; // 已确认 - 最终确认状态

// 审查阶段枚举
export type ReviewPhase =
  | 'technical' // 技术审查阶段
  | 'business' // 业务审查阶段
  | 'final' // 最终审查阶段
  | 'complete'; // 完成状态

// 评论类型枚举
export type CommentType =
  | 'suggestion' // 建议
  | 'issue' // 问题
  | 'question' // 疑问
  | 'approval' // 认可
  | 'blocking'; // 阻塞性问题

// 严重程度枚举
export type SeverityLevel =
  | 'low' // 低 - 建议性修改
  | 'medium' // 中 - 应该修改
  | 'high' // 高 - 必须修改
  | 'blocking'; // 阻塞 - 不修改无法通过

// 审查者状态枚举
export type ReviewerStatus =
  | 'pending' // 待处理 - 已分配但未开始
  | 'in_progress' // 处理中 - 正在审查
  | 'completed'; // 已完成 - 已提交审查意见

// 审查结果枚举
export type ReviewDecision =
  | 'approved' // 通过
  | 'rejected' // 拒绝
  | 'changes_requested'; // 要求修改

// 审查评论接口
export interface ReviewComment {
  id: string; // 评论ID
  sectionId?: string; // 关联章节ID（可选，全局评论时为空）
  lineNumber?: number; // 行号（针对具体位置的评论）
  content: string; // 评论内容
  type: CommentType; // 评论类型
  severity: SeverityLevel; // 严重程度
  resolved: boolean; // 是否已解决
  resolvedBy?: string; // 解决者ID
  resolvedAt?: Date; // 解决时间
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
  parentId?: string; // 父评论ID（回复评论时使用）
  attachments?: string[]; // 附件文件路径
  metadata: CommentMetadata; // 评论元数据
}

// 评论元数据接口
export interface CommentMetadata {
  quotedText?: string; // 引用的原文
  suggestedChange?: string; // 建议的修改内容
  tags: string[]; // 评论标签
  priority: number; // 优先级（1-5）
  category?: string; // 评论分类
  isActionRequired: boolean; // 是否需要行动
}

// 审查记录接口
export interface Review {
  id: string; // 审查记录ID
  reviewerId: string; // 审查者ID
  reviewerName: string; // 审查者名称
  reviewerRole: RoleType; // 审查者角色
  decision: ReviewDecision; // 审查结果
  comments: ReviewComment[]; // 审查意见列表
  summary?: string; // 总体评价摘要
  estimatedFixTime?: number; // 预估修复时间（小时）
  createdAt: Date; // 提交时间
  resolvedAt?: Date; // 解决时间
  metadata: ReviewMetadata; // 审查元数据
}

// 审查元数据接口
export interface ReviewMetadata {
  timeSpent: number; // 审查耗时（分钟）
  linesReviewed: number; // 审查行数
  sectionsReviewed: string[]; // 审查的章节ID列表
  overallRating: number; // 整体评分（1-5）
  confidence: number; // 审查信心度（1-5）
  reviewMethod: 'detailed' | 'quick' | 'focus'; // 审查方式
  checklist?: ReviewChecklistItem[]; // 审查检查项
}

// 审查检查项接口
export interface ReviewChecklistItem {
  item: string; // 检查项内容
  checked: boolean; // 是否通过
  comment?: string; // 检查说明
}

// 审查分配接口
export interface ReviewAssignee {
  userId: string; // 用户ID
  userName: string; // 用户名称
  role: RoleType; // 用户角色
  assignedAt: Date; // 指派时间
  status: ReviewerStatus; // 个人审查状态
  dueDate?: Date; // 预期完成时间
  requiredActions: string[]; // 需要执行的动作
  weight: number; // 审查权重（0-1，用于加权计算）
  isLead: boolean; // 是否为主审查者
  notificationSent: boolean; // 是否已发送通知
  reminderCount: number; // 提醒次数
}

// 状态转换历史接口
export interface StatusTransition {
  fromStatus: StatusType; // 原状态
  toStatus: StatusType; // 新状态
  timestamp: Date; // 转换时间
  triggeredBy: string; // 触发者ID
  reason?: string; // 转换原因
  metadata?: Record<string, any>; // 额外元数据
}

// 审查状态接口
export interface ReviewStatus {
  id: string; // 状态ID
  draftId: string; // 关联文档ID
  status: StatusType; // 当前状态
  phase: ReviewPhase; // 审查阶段
  assignees: ReviewAssignee[]; // 指派审查者列表
  reviews: Review[]; // 审查记录列表
  transitions: StatusTransition[]; // 状态转换历史
  createdAt: Date; // 状态创建时间
  updatedAt: Date; // 状态更新时间
  submittedAt?: Date; // 提交审查时间
  dueDate?: Date; // 截止时间
  priority: 'low' | 'medium' | 'high' | 'urgent'; // 优先级
  metadata: ReviewStatusMetadata; // 状态元数据
}

// 审查状态元数据接口
export interface ReviewStatusMetadata {
  requiresAll: boolean; // 是否需要所有审查者通过
  autoApprovalThreshold?: number; // 自动批准阈值（审查者通过比例）
  escalationRules: EscalationRule[]; // 升级规则
  notificationSettings: NotificationSettings; // 通知设置
  tags: string[]; // 状态标签
  customFields: Record<string, any>; // 自定义字段
}

// 升级规则接口
export interface EscalationRule {
  condition: string; // 升级条件（表达式）
  action: 'notify' | 'reassign' | 'auto_approve' | 'cancel'; // 升级动作
  target: string; // 升级目标（用户ID或角色）
  delay: number; // 延迟时间（小时）
  isActive: boolean; // 是否启用
}

// 通知设置接口
export interface NotificationSettings {
  emailEnabled: boolean; // 是否启用邮件通知
  webhookEnabled: boolean; // 是否启用Webhook通知
  reminderInterval: number; // 提醒间隔（小时）
  escalationDelay: number; // 升级延迟（小时）
  notifyOnComment: boolean; // 评论时是否通知
  notifyOnStatusChange: boolean; // 状态变更时是否通知
}

// 状态流转规则映射
export const STATUS_TRANSITIONS: Record<StatusType, StatusType[]> = {
  draft: ['in_review'],
  in_review: ['approved', 'rejected', 'changes_requested'],
  changes_requested: ['in_review', 'draft'],
  approved: ['confirmed'],
  rejected: ['draft'],
  confirmed: [], // 终态，不能再转换
};

// 阶段权重配置（用于计算整体进度）
export const PHASE_WEIGHTS: Record<ReviewPhase, number> = {
  technical: 0.4, // 技术审查占40%
  business: 0.3, // 业务审查占30%
  final: 0.3, // 最终审查占30%
  complete: 1.0, // 完成状态占100%
};

// ReviewStatus 工具类
export class ReviewStatusManager {
  /**
   * 检查状态转换是否合法
   */
  static isValidTransition(from: StatusType, to: StatusType): boolean {
    const allowedTransitions = STATUS_TRANSITIONS[from];
    return allowedTransitions.includes(to);
  }

  /**
   * 创建初始审查状态
   */
  static createInitialStatus(draftId: string, createdBy: string): ReviewStatus {
    const now = new Date();

    return {
      id: `review-${draftId}-${Date.now()}`,
      draftId,
      status: 'draft',
      phase: 'technical',
      assignees: [],
      reviews: [],
      transitions: [],
      createdAt: now,
      updatedAt: now,
      priority: 'medium',
      metadata: {
        requiresAll: false,
        autoApprovalThreshold: 0.5,
        escalationRules: [],
        notificationSettings: {
          emailEnabled: true,
          webhookEnabled: false,
          reminderInterval: 24,
          escalationDelay: 72,
          notifyOnComment: true,
          notifyOnStatusChange: true,
        },
        tags: [],
        customFields: {},
      },
    };
  }

  /**
   * 添加审查者
   */
  static addReviewer(
    status: ReviewStatus,
    userId: string,
    userName: string,
    role: RoleType,
    dueDate?: Date
  ): ReviewAssignee {
    const assignee: ReviewAssignee = {
      userId,
      userName,
      role,
      assignedAt: new Date(),
      status: 'pending',
      dueDate,
      requiredActions: ['review_document', 'provide_feedback'],
      weight: this.getDefaultWeight(role),
      isLead: false,
      notificationSent: false,
      reminderCount: 0,
    };

    status.assignees.push(assignee);
    status.updatedAt = new Date();

    return assignee;
  }

  /**
   * 获取角色默认权重
   */
  private static getDefaultWeight(role: RoleType): number {
    switch (role) {
      case 'architect':
        return 0.4; // 架构师权重最高
      case 'product_manager':
        return 0.3; // 产品经理次之
      case 'reviewer':
        return 0.2; // 专业审查者
      case 'developer':
      case 'tester':
        return 0.1; // 开发和测试人员权重较低
      default:
        return 0.1;
    }
  }

  /**
   * 提交审查
   */
  static submitReview(
    status: ReviewStatus,
    reviewerId: string,
    decision: ReviewDecision,
    comments: ReviewComment[],
    summary?: string
  ): Review {
    const reviewer = status.assignees.find((a) => a.userId === reviewerId);
    if (!reviewer) {
      throw new Error('审查者未被分配到此文档');
    }

    const review: Review = {
      id: `review-${reviewerId}-${Date.now()}`,
      reviewerId,
      reviewerName: reviewer.userName,
      reviewerRole: reviewer.role,
      decision,
      comments,
      summary,
      createdAt: new Date(),
      metadata: {
        timeSpent: 0,
        linesReviewed: 0,
        sectionsReviewed: [],
        overallRating: 3,
        confidence: 3,
        reviewMethod: 'detailed',
      },
    };

    status.reviews.push(review);
    reviewer.status = 'completed';
    status.updatedAt = new Date();

    // 根据审查结果更新状态
    this.updateStatusFromReviews(status);

    return review;
  }

  /**
   * 根据审查结果更新状态
   */
  private static updateStatusFromReviews(status: ReviewStatus): void {
    const completedReviews = status.reviews;
    const totalAssignees = status.assignees.length;

    if (completedReviews.length === 0) {
      return;
    }

    const approvedCount = completedReviews.filter((r) => r.decision === 'approved').length;
    const rejectedCount = completedReviews.filter((r) => r.decision === 'rejected').length;
    const changesRequestedCount = completedReviews.filter(
      (r) => r.decision === 'changes_requested'
    ).length;

    // 如果有拒绝，整体状态为拒绝
    if (rejectedCount > 0) {
      this.transitionStatus(status, 'rejected', 'system', '审查被拒绝');
      return;
    }

    // 如果有要求修改，整体状态为要求修改
    if (changesRequestedCount > 0) {
      this.transitionStatus(status, 'changes_requested', 'system', '需要修改');
      return;
    }

    // 检查是否所有审查者都已通过
    if (status.metadata.requiresAll) {
      if (completedReviews.length === totalAssignees && approvedCount === totalAssignees) {
        this.transitionStatus(status, 'approved', 'system', '所有审查者通过');
      }
    } else {
      // 按阈值计算
      const approvalRatio = approvedCount / totalAssignees;
      if (approvalRatio >= (status.metadata.autoApprovalThreshold || 0.5)) {
        this.transitionStatus(status, 'approved', 'system', '达到自动批准阈值');
      }
    }
  }

  /**
   * 状态转换
   */
  static transitionStatus(
    status: ReviewStatus,
    newStatus: StatusType,
    triggeredBy: string,
    reason?: string
  ): boolean {
    if (!this.isValidTransition(status.status, newStatus)) {
      return false;
    }

    const transition: StatusTransition = {
      fromStatus: status.status,
      toStatus: newStatus,
      timestamp: new Date(),
      triggeredBy,
      reason,
    };

    status.transitions.push(transition);
    status.status = newStatus;
    status.updatedAt = new Date();

    // 更新提交时间
    if (newStatus === 'in_review' && !status.submittedAt) {
      status.submittedAt = new Date();
    }

    return true;
  }

  /**
   * 添加评论
   */
  static addComment(
    review: Review,
    content: string,
    type: CommentType = 'suggestion',
    severity: SeverityLevel = 'medium',
    sectionId?: string,
    lineNumber?: number
  ): ReviewComment {
    const comment: ReviewComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sectionId,
      lineNumber,
      content,
      type,
      severity,
      resolved: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        tags: [],
        priority: this.getSeverityPriority(severity),
        isActionRequired: severity === 'blocking' || severity === 'high',
      },
    };

    review.comments.push(comment);
    return comment;
  }

  /**
   * 获取严重程度对应的优先级
   */
  private static getSeverityPriority(severity: SeverityLevel): number {
    switch (severity) {
      case 'blocking':
        return 5;
      case 'high':
        return 4;
      case 'medium':
        return 3;
      case 'low':
        return 2;
      default:
        return 1;
    }
  }

  /**
   * 解决评论
   */
  static resolveComment(comment: ReviewComment, resolvedBy: string): void {
    comment.resolved = true;
    comment.resolvedBy = resolvedBy;
    comment.resolvedAt = new Date();
    comment.updatedAt = new Date();
  }

  /**
   * 获取未解决的阻塞性问题数量
   */
  static getBlockingIssuesCount(status: ReviewStatus): number {
    let count = 0;

    for (const review of status.reviews) {
      count += review.comments.filter((c) => !c.resolved && c.severity === 'blocking').length;
    }

    return count;
  }

  /**
   * 计算审查进度
   */
  static calculateProgress(status: ReviewStatus): number {
    const totalAssignees = status.assignees.length;
    if (totalAssignees === 0) {
      return 0;
    }

    const completedCount = status.assignees.filter((a) => a.status === 'completed').length;
    return completedCount / totalAssignees;
  }

  /**
   * 检查是否需要升级
   */
  static needsEscalation(status: ReviewStatus): boolean {
    if (!status.dueDate) {
      return false;
    }

    const now = new Date();
    const overdue = now > status.dueDate;

    if (overdue) {
      return true;
    }

    // 检查是否有审查者超时
    return status.assignees.some((assignee) => {
      if (assignee.dueDate && assignee.status === 'pending') {
        return now > assignee.dueDate;
      }
      return false;
    });
  }

  /**
   * 验证审查状态数据
   */
  static validateReviewStatus(status: Partial<ReviewStatus>): string[] {
    const errors: string[] = [];

    if (!status.draftId) {
      errors.push('关联文档ID不能为空');
    }

    if (status.dueDate && status.dueDate <= new Date()) {
      errors.push('截止时间不能早于当前时间');
    }

    if (status.assignees && status.assignees.length === 0 && status.status === 'in_review') {
      errors.push('审查中状态必须至少包含一个审查者');
    }

    if (status.reviews) {
      for (const review of status.reviews) {
        if (review.decision === 'rejected' && review.comments.length === 0) {
          errors.push('拒绝状态必须包含至少一个评论');
        }
      }
    }

    return errors;
  }
}
