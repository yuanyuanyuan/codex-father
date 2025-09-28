/**
 * T017: PRDDraft 数据模型
 *
 * PRD文档核心实体，代表产品需求文档的草稿状态
 * 整合所有其他模型，提供完整的文档管理功能
 */

import { Template } from './template.js';
import { ReviewStatus, StatusType } from './review-status.js';
import { Version } from './version.js';
import { TechnicalDecision } from './technical-decision.js';
import { DiagramComponent } from './diagram-component.js';
import { RoleType } from './user-role.js';

// 文档优先级枚举
export type DocumentPriority =
  | 'low' // 低优先级
  | 'medium' // 中等优先级
  | 'high' // 高优先级
  | 'urgent'; // 紧急

// 文档类别枚举
export type DocumentCategory =
  | 'technical' // 技术文档
  | 'business' // 业务文档
  | 'feature' // 功能规格
  | 'architecture' // 架构设计
  | 'security' // 安全文档
  | 'api' // API文档
  | 'process' // 流程文档
  | 'guide' // 指南文档
  | 'custom'; // 自定义类型

// 可见性级别枚举
export type VisibilityLevel =
  | 'public' // 公开 - 所有人可见
  | 'internal' // 内部 - 组织内可见
  | 'team' // 团队 - 团队成员可见
  | 'restricted' // 限制 - 指定人员可见
  | 'confidential' // 机密 - 最高权限人员可见
  | 'private'; // 私有 - 仅作者可见

// 文档状态枚举
export type DocumentStatus =
  | 'draft' // 草稿
  | 'in_review' // 审查中
  | 'approved' // 已批准
  | 'published' // 已发布
  | 'archived' // 已归档
  | 'deprecated'; // 已废弃

// 文档元数据接口
export interface DocumentMetadata {
  tags: string[]; // 标签分类
  category: DocumentCategory; // 文档类别
  priority: DocumentPriority; // 优先级
  visibility: VisibilityLevel; // 可见性级别
  estimatedReadTime: number; // 预估阅读时间（分钟）
  wordCount: number; // 字数统计
  characterCount: number; // 字符数统计
  lastEditor: string; // 最后编辑者ID
  lastEditorName: string; // 最后编辑者名称
  collaborators: string[]; // 协作者列表
  watchers: string[]; // 关注者列表
  language: string; // 文档语言
  timezone: string; // 时区设置
  customFields: Record<string, any>; // 自定义字段
}

// 文档章节接口
export interface DocumentSection {
  id: string; // 章节ID
  title: string; // 章节标题
  order: number; // 排序序号
  content: string; // 章节内容（Markdown格式）
  level: number; // 层级深度（1-6，对应H1-H6）
  isRequired: boolean; // 是否必填
  editableBy: RoleType[]; // 可编辑角色
  lastModified: Date; // 最后修改时间
  modifiedBy: string; // 修改者ID
  wordCount: number; // 章节字数
  commentCount: number; // 评论数量
  isLocked: boolean; // 是否锁定编辑
  lockReason?: string; // 锁定原因
  lockExpiry?: Date; // 锁定到期时间
  attachments: string[]; // 附件文件路径
  crossReferences: CrossReference[]; // 交叉引用
}

// 交叉引用接口
export interface CrossReference {
  type: 'section' | 'document' | 'decision' | 'diagram' | 'external'; // 引用类型
  target: string; // 引用目标ID或URL
  title: string; // 引用标题
  description?: string; // 引用描述
}

// 文档统计信息接口
export interface DocumentStatistics {
  totalViews: number; // 总浏览量
  uniqueViewers: number; // 独立浏览者数
  totalEdits: number; // 总编辑次数
  collaboratorCount: number; // 协作者数量
  commentCount: number; // 评论总数
  versionCount: number; // 版本数量
  diagramCount: number; // 图表数量
  decisionCount: number; // 决策数量
  lastViewedAt?: Date; // 最后浏览时间
  avgSessionTime: number; // 平均访问时长（分钟）
  popularSections: PopularSection[]; // 热门章节
  editFrequency: EditFrequency[]; // 编辑频率
}

// 热门章节接口
export interface PopularSection {
  sectionId: string; // 章节ID
  sectionTitle: string; // 章节标题
  viewCount: number; // 浏览次数
  editCount: number; // 编辑次数
  commentCount: number; // 评论次数
}

// 编辑频率接口
export interface EditFrequency {
  date: Date; // 日期
  editCount: number; // 编辑次数
  contributorCount: number; // 贡献者数量
}

// 导出设置接口
export interface ExportSettings {
  formats: ExportFormat[]; // 支持的导出格式
  includeMetadata: boolean; // 是否包含元数据
  includeDiagrams: boolean; // 是否包含图表
  includeDecisions: boolean; // 是否包含决策记录
  includeVersions: boolean; // 是否包含版本历史
  watermark?: string; // 水印文本
  customTemplate?: string; // 自定义模板
}

// 导出格式枚举
export type ExportFormat =
  | 'markdown' // Markdown格式
  | 'html' // HTML格式
  | 'pdf' // PDF格式
  | 'docx' // Word文档
  | 'json' // JSON格式
  | 'xml'; // XML格式

// 通知设置接口
export interface NotificationSettings {
  onEdit: boolean; // 编辑时通知
  onComment: boolean; // 评论时通知
  onReview: boolean; // 审查时通知
  onStatusChange: boolean; // 状态变更时通知
  onMention: boolean; // 提及时通知
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly'; // 通知频率
  channels: NotificationChannel[]; // 通知渠道
}

// 通知渠道枚举
export type NotificationChannel =
  | 'email' // 邮件
  | 'webhook' // Webhook
  | 'slack' // Slack
  | 'teams' // Microsoft Teams
  | 'sms'; // 短信

// 访问权限接口
export interface AccessPermission {
  userId: string; // 用户ID
  role: RoleType; // 用户角色
  permissions: DocumentPermission[]; // 权限列表
  grantedAt: Date; // 授权时间
  grantedBy: string; // 授权者
  expiresAt?: Date; // 过期时间
  conditions?: PermissionCondition[]; // 权限条件
}

// 文档权限枚举
export type DocumentPermission =
  | 'read' // 读取
  | 'edit' // 编辑
  | 'comment' // 评论
  | 'review' // 审查
  | 'approve' // 批准
  | 'share' // 分享
  | 'export' // 导出
  | 'delete' // 删除
  | 'admin'; // 管理

// 权限条件接口
export interface PermissionCondition {
  type: 'time' | 'location' | 'device' | 'section'; // 条件类型
  operator: 'eq' | 'ne' | 'in' | 'between'; // 操作符
  value: any; // 条件值
  description: string; // 条件描述
}

// 协作历史接口
export interface CollaborationHistory {
  timestamp: Date; // 时间戳
  userId: string; // 用户ID
  userName: string; // 用户名称
  action: CollaborationAction; // 操作类型
  target?: string; // 操作目标（章节ID等）
  description: string; // 操作描述
  metadata?: Record<string, any>; // 额外信息
}

// 协作操作枚举
export type CollaborationAction =
  | 'create' // 创建文档
  | 'edit' // 编辑内容
  | 'comment' // 添加评论
  | 'review' // 提交审查
  | 'approve' // 批准文档
  | 'share' // 分享文档
  | 'export' // 导出文档
  | 'view' // 查看文档
  | 'lock' // 锁定章节
  | 'unlock' // 解锁章节
  | 'assign' // 分配任务
  | 'mention'; // 提及用户

// PRD草稿核心接口
export interface PRDDraft {
  id: string; // 唯一标识符（UUID）
  title: string; // 文档标题
  description?: string; // 简短描述
  content: string; // 完整Markdown格式内容
  templateId: string; // 使用的模板ID
  template: Template; // 模板对象引用
  status: DocumentStatus; // 当前文档状态
  reviewStatus: ReviewStatus; // 审查状态对象
  authorId: string; // 创建者ID
  authorName: string; // 创建者名称
  createdAt: Date; // 创建时间
  updatedAt: Date; // 最后更新时间
  publishedAt?: Date; // 发布时间
  archivedAt?: Date; // 归档时间
  version: number; // 当前版本号
  versions: Version[]; // 版本历史列表
  metadata: DocumentMetadata; // 文档元数据
  sections: DocumentSection[]; // 文档章节结构
  decisions: TechnicalDecision[]; // 技术决策记录列表
  diagrams: DiagramComponent[]; // 图表组件列表
  statistics: DocumentStatistics; // 统计信息
  permissions: AccessPermission[]; // 访问权限列表
  collaborationHistory: CollaborationHistory[]; // 协作历史
  settings: DocumentSettings; // 文档设置
}

// 文档设置接口
export interface DocumentSettings {
  autoSave: boolean; // 自动保存
  autoSaveInterval: number; // 自动保存间隔（秒）
  versionControl: boolean; // 版本控制
  trackChanges: boolean; // 变更追踪
  allowComments: boolean; // 允许评论
  allowSuggestions: boolean; // 允许建议
  requireApproval: boolean; // 需要审批
  notificationSettings: NotificationSettings; // 通知设置
  exportSettings: ExportSettings; // 导出设置
  retentionPolicy?: RetentionPolicy; // 保留策略
  backupSettings: BackupSettings; // 备份设置
}

// 保留策略接口
export interface RetentionPolicy {
  maxVersions: number; // 最大版本数
  maxAge: number; // 最大保留时间（天）
  archiveAfter: number; // 归档时间（天）
  deleteAfter: number; // 删除时间（天）
  exceptions: string[]; // 例外情况
}

// 备份设置接口
export interface BackupSettings {
  enabled: boolean; // 是否启用备份
  frequency: 'hourly' | 'daily' | 'weekly'; // 备份频率
  retentionDays: number; // 备份保留天数
  includeVersions: boolean; // 是否包含版本历史
  includeMedia: boolean; // 是否包含媒体文件
  compression: boolean; // 是否压缩
}

// PRDDraft 工具类
export class PRDDraftManager {
  /**
   * 创建新的PRD草稿
   */
  static createDraft(
    title: string,
    templateId: string,
    template: Template,
    authorId: string,
    authorName: string,
    description?: string
  ): PRDDraft {
    const now = new Date();
    const draftId = `prd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // 基于模板创建章节
    const sections = template.structure.sections.map((sectionDef) => ({
      id: `section-${sectionDef.id}-${Date.now()}`,
      title: sectionDef.title,
      order: sectionDef.order,
      content:
        sectionDef.contentTemplate || `## ${sectionDef.title}\n\n${sectionDef.description}\n\n`,
      level: sectionDef.level,
      isRequired: sectionDef.isRequired,
      editableBy: sectionDef.editableBy,
      lastModified: now,
      modifiedBy: authorId,
      wordCount: 0,
      commentCount: 0,
      isLocked: false,
      attachments: [],
      crossReferences: [],
    }));

    // 生成初始内容
    const initialContent = this.generateInitialContent(title, description, sections);

    return {
      id: draftId,
      title,
      description,
      content: initialContent,
      templateId,
      template,
      status: 'draft',
      reviewStatus: this.createInitialReviewStatus(draftId),
      authorId,
      authorName,
      createdAt: now,
      updatedAt: now,
      version: 1,
      versions: [],
      metadata: {
        tags: [],
        category: this.inferCategory(template.category),
        priority: 'medium',
        visibility: 'team',
        estimatedReadTime: 5,
        wordCount: this.countWords(initialContent),
        characterCount: initialContent.length,
        lastEditor: authorId,
        lastEditorName: authorName,
        collaborators: [authorId],
        watchers: [authorId],
        language: 'zh-CN',
        timezone: 'Asia/Shanghai',
        customFields: {},
      },
      sections,
      decisions: [],
      diagrams: [],
      statistics: {
        totalViews: 0,
        uniqueViewers: 0,
        totalEdits: 0,
        collaboratorCount: 1,
        commentCount: 0,
        versionCount: 1,
        diagramCount: 0,
        decisionCount: 0,
        avgSessionTime: 0,
        popularSections: [],
        editFrequency: [],
      },
      permissions: [
        {
          userId: authorId,
          role: 'architect', // 默认给创建者完整权限
          permissions: [
            'read',
            'edit',
            'comment',
            'review',
            'approve',
            'share',
            'export',
            'delete',
            'admin',
          ],
          grantedAt: now,
          grantedBy: authorId,
        },
      ],
      collaborationHistory: [
        {
          timestamp: now,
          userId: authorId,
          userName: authorName,
          action: 'create',
          description: `Created PRD document: ${title}`,
        },
      ],
      settings: this.getDefaultSettings(),
    };
  }

  /**
   * 创建初始审查状态
   */
  private static createInitialReviewStatus(draftId: string): ReviewStatus {
    const now = new Date();

    return {
      id: `review-${draftId}`,
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
   * 推断文档类别
   */
  private static inferCategory(templateCategory: string): DocumentCategory {
    switch (templateCategory.toLowerCase()) {
      case 'technical':
      case 'architecture':
        return 'technical';
      case 'business':
        return 'business';
      case 'feature':
        return 'feature';
      case 'security':
        return 'security';
      case 'api':
        return 'api';
      default:
        return 'custom';
    }
  }

  /**
   * 生成初始内容
   */
  private static generateInitialContent(
    title: string,
    description: string | undefined,
    sections: DocumentSection[]
  ): string {
    const parts = [`# ${title}`, '', description ? description : '*请添加文档描述*', '', '---', ''];

    for (const section of sections.sort((a, b) => a.order - b.order)) {
      parts.push(section.content);
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * 获取默认设置
   */
  private static getDefaultSettings(): DocumentSettings {
    return {
      autoSave: true,
      autoSaveInterval: 30,
      versionControl: true,
      trackChanges: true,
      allowComments: true,
      allowSuggestions: true,
      requireApproval: false,
      notificationSettings: {
        onEdit: true,
        onComment: true,
        onReview: true,
        onStatusChange: true,
        onMention: true,
        frequency: 'immediate',
        channels: ['email'],
      },
      exportSettings: {
        formats: ['markdown', 'html', 'pdf'],
        includeMetadata: true,
        includeDiagrams: true,
        includeDecisions: true,
        includeVersions: false,
      },
      retentionPolicy: {
        maxVersions: 50,
        maxAge: 365,
        archiveAfter: 180,
        deleteAfter: 730,
        exceptions: [],
      },
      backupSettings: {
        enabled: true,
        frequency: 'daily',
        retentionDays: 30,
        includeVersions: true,
        includeMedia: true,
        compression: true,
      },
    };
  }

  /**
   * 统计字数
   */
  private static countWords(content: string): number {
    // 移除Markdown标记的简化实现
    const plainText = content
      .replace(/[#*`_~\[\]()]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!plainText) {
      return 0;
    }

    // 中英文混合字数统计
    const chineseChars = (plainText.match(/[\u4e00-\u9fff]/g) || []).length;
    const englishWords = plainText
      .replace(/[\u4e00-\u9fff]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

    return chineseChars + englishWords;
  }

  /**
   * 更新文档内容
   */
  static updateContent(
    draft: PRDDraft,
    newContent: string,
    editorId: string,
    editorName: string,
    sectionId?: string,
    commitMessage?: string
  ): void {
    const now = new Date();
    const oldContent = draft.content;

    // 更新内容
    draft.content = newContent;
    draft.updatedAt = now;

    // 更新元数据
    draft.metadata.lastEditor = editorId;
    draft.metadata.lastEditorName = editorName;
    draft.metadata.wordCount = this.countWords(newContent);
    draft.metadata.characterCount = newContent.length;

    // 添加协作历史
    draft.collaborationHistory.push({
      timestamp: now,
      userId: editorId,
      userName: editorName,
      action: 'edit',
      target: sectionId,
      description: commitMessage || 'Updated document content',
    });

    // 更新统计
    draft.statistics.totalEdits++;
    if (!draft.metadata.collaborators.includes(editorId)) {
      draft.metadata.collaborators.push(editorId);
      draft.statistics.collaboratorCount++;
    }

    // 如果启用了版本控制，创建新版本
    if (draft.settings.versionControl) {
      this.createVersion(draft, oldContent, newContent, editorId, editorName, commitMessage);
    }

    // 更新章节信息
    if (sectionId) {
      const section = draft.sections.find((s) => s.id === sectionId);
      if (section) {
        section.lastModified = now;
        section.modifiedBy = editorId;
        section.wordCount = this.countWords(section.content);
      }
    }
  }

  /**
   * 创建版本记录
   */
  private static createVersion(
    draft: PRDDraft,
    oldContent: string,
    newContent: string,
    editorId: string,
    editorName: string,
    commitMessage?: string
  ): void {
    // 简化的变更检测
    const changes = [
      {
        path: 'content',
        operation: 'replace' as const,
        oldValue: oldContent,
        newValue: newContent,
        diffSize: Math.abs(newContent.length - oldContent.length),
      },
    ];

    const version: Version = {
      id: `version-${draft.id}-${draft.version + 1}`,
      draftId: draft.id,
      versionNumber: draft.version + 1,
      changeType: 'edit',
      changes,
      createdAt: new Date(),
      createdBy: editorId,
      createdByName: editorName,
      commitMessage,
      contentSnapshot: this.compressContent(newContent),
      contentSize: newContent.length,
      metadata: {
        source: 'user',
        parentVersions: draft.version > 0 ? [`version-${draft.id}-${draft.version}`] : [],
        tags: [],
        statistics: {
          addedLines: 0,
          deletedLines: 0,
          modifiedLines: 1,
          addedChars: Math.max(0, newContent.length - oldContent.length),
          deletedChars: Math.max(0, oldContent.length - newContent.length),
          sectionsAdded: 0,
          sectionsDeleted: 0,
          sectionsModified: 1,
          imagesAdded: 0,
          diagramsAdded: 0,
        },
        checksum: this.calculateChecksum(newContent),
      },
      isSnapshot: false,
    };

    draft.versions.push(version);
    draft.version = version.versionNumber;
    draft.statistics.versionCount++;
  }

  /**
   * 压缩内容
   */
  private static compressContent(content: string): string {
    return Buffer.from(content, 'utf8').toString('base64');
  }

  /**
   * 计算校验和
   */
  private static calculateChecksum(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * 添加协作者
   */
  static addCollaborator(
    draft: PRDDraft,
    userId: string,
    role: RoleType,
    permissions: DocumentPermission[],
    grantedBy: string
  ): void {
    // 检查是否已存在
    const existingPermission = draft.permissions.find((p) => p.userId === userId);
    if (existingPermission) {
      // 更新权限
      existingPermission.permissions = permissions;
      existingPermission.role = role;
      existingPermission.grantedAt = new Date();
      existingPermission.grantedBy = grantedBy;
    } else {
      // 添加新权限
      draft.permissions.push({
        userId,
        role,
        permissions,
        grantedAt: new Date(),
        grantedBy,
      });
    }

    // 更新协作者列表
    if (!draft.metadata.collaborators.includes(userId)) {
      draft.metadata.collaborators.push(userId);
      draft.statistics.collaboratorCount++;
    }

    // 记录协作历史
    draft.collaborationHistory.push({
      timestamp: new Date(),
      userId: grantedBy,
      userName: '', // 需要从用户服务获取
      action: 'assign',
      description: `Added ${userId} as collaborator with role ${role}`,
    });
  }

  /**
   * 更新文档状态
   */
  static updateStatus(
    draft: PRDDraft,
    newStatus: DocumentStatus,
    updatedBy: string,
    updatedByName: string,
    reason?: string
  ): boolean {
    const validTransitions: Record<DocumentStatus, DocumentStatus[]> = {
      draft: ['in_review', 'archived'],
      in_review: ['draft', 'approved', 'archived'],
      approved: ['published', 'draft', 'archived'],
      published: ['archived', 'deprecated'],
      archived: ['draft'],
      deprecated: ['archived'],
    };

    const allowedStatuses = validTransitions[draft.status];
    if (!allowedStatuses.includes(newStatus)) {
      return false;
    }

    const oldStatus = draft.status;
    draft.status = newStatus;
    draft.updatedAt = new Date();

    // 设置特殊时间戳
    if (newStatus === 'published' && !draft.publishedAt) {
      draft.publishedAt = new Date();
    } else if (newStatus === 'archived' && !draft.archivedAt) {
      draft.archivedAt = new Date();
    }

    // 记录协作历史
    draft.collaborationHistory.push({
      timestamp: new Date(),
      userId: updatedBy,
      userName: updatedByName,
      action: 'approve', // 简化映射
      description: reason || `Status changed from ${oldStatus} to ${newStatus}`,
    });

    return true;
  }

  /**
   * 检查用户权限
   */
  static hasPermission(draft: PRDDraft, userId: string, permission: DocumentPermission): boolean {
    const userPermission = draft.permissions.find((p) => p.userId === userId);
    if (!userPermission) {
      return false;
    }

    // 检查权限是否过期
    if (userPermission.expiresAt && userPermission.expiresAt <= new Date()) {
      return false;
    }

    return (
      userPermission.permissions.includes(permission) ||
      userPermission.permissions.includes('admin')
    );
  }

  /**
   * 记录访问
   */
  static recordView(draft: PRDDraft, viewerId: string): void {
    draft.statistics.totalViews++;

    // 更新独立浏览者统计（简化实现）
    if (!draft.metadata.watchers.includes(viewerId)) {
      draft.statistics.uniqueViewers++;
      draft.metadata.watchers.push(viewerId);
    }

    draft.statistics.lastViewedAt = new Date();
  }

  /**
   * 生成文档摘要
   */
  static generateSummary(draft: PRDDraft): DocumentSummary {
    const recentActivity = draft.collaborationHistory
      .slice(-10)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const activeSections = draft.sections.filter(
      (s) => s.lastModified > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;

    return {
      id: draft.id,
      title: draft.title,
      status: draft.status,
      priority: draft.metadata.priority,
      wordCount: draft.metadata.wordCount,
      sectionCount: draft.sections.length,
      diagramCount: draft.diagrams.length,
      decisionCount: draft.decisions.length,
      collaboratorCount: draft.statistics.collaboratorCount,
      lastUpdated: draft.updatedAt,
      recentActivity,
      activeSections,
      completionRate: this.calculateCompletionRate(draft),
      healthScore: this.calculateHealthScore(draft),
    };
  }

  /**
   * 计算完成率
   */
  private static calculateCompletionRate(draft: PRDDraft): number {
    const requiredSections = draft.sections.filter((s) => s.isRequired);
    const completedSections = requiredSections.filter(
      (s) => s.content && s.content.trim().length > 50 // 基本内容判断
    );

    return requiredSections.length > 0 ? completedSections.length / requiredSections.length : 0;
  }

  /**
   * 计算健康评分
   */
  private static calculateHealthScore(draft: PRDDraft): number {
    let score = 0;
    let maxScore = 0;

    // 内容完整性 (40分)
    const completionRate = this.calculateCompletionRate(draft);
    score += completionRate * 40;
    maxScore += 40;

    // 协作活跃度 (20分)
    const recentEdits = draft.collaborationHistory.filter(
      (h) => h.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;
    score += Math.min(recentEdits / 5, 1) * 20;
    maxScore += 20;

    // 审查状态 (20分)
    if (draft.reviewStatus.status === 'approved') {
      score += 20;
    } else if (draft.reviewStatus.status === 'in_review') {
      score += 10;
    }
    maxScore += 20;

    // 文档结构 (20分)
    const hasDecisions = draft.decisions.length > 0 ? 10 : 0;
    const hasDiagrams = draft.diagrams.length > 0 ? 10 : 0;
    score += hasDecisions + hasDiagrams;
    maxScore += 20;

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  /**
   * 验证PRD草稿数据
   */
  static validateDraft(draft: Partial<PRDDraft>): string[] {
    const errors: string[] = [];

    if (!draft.title || draft.title.length < 1 || draft.title.length > 200) {
      errors.push('文档标题必须在1-200字符之间');
    }

    if (!draft.content) {
      errors.push('文档内容不能为空');
    } else if (draft.content.length > 10485760) {
      // 10MB
      errors.push('文档内容不能超过10MB');
    }

    if (!draft.templateId) {
      errors.push('模板ID不能为空');
    }

    if (!draft.authorId) {
      errors.push('作者ID不能为空');
    }

    if (draft.metadata) {
      if (draft.metadata.tags && draft.metadata.tags.length > 10) {
        errors.push('标签数量不能超过10个');
      }
    }

    if (draft.sections) {
      const requiredSections = draft.sections.filter((s) => s.isRequired);
      if (requiredSections.length === 0) {
        errors.push('至少需要包含一个必填章节');
      }
    }

    return errors;
  }
}

// 文档摘要接口
export interface DocumentSummary {
  id: string;
  title: string;
  status: DocumentStatus;
  priority: DocumentPriority;
  wordCount: number;
  sectionCount: number;
  diagramCount: number;
  decisionCount: number;
  collaboratorCount: number;
  lastUpdated: Date;
  recentActivity: CollaborationHistory[];
  activeSections: number;
  completionRate: number;
  healthScore: number;
}
