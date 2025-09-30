/**
 * DocumentService - PRD草稿文档的CRUD操作和业务逻辑
 *
 * 核心功能：
 * - 文档创建、读取、更新、删除 (CRUD)
 * - 模板应用和内容验证
 * - 文档搜索和组织
 * - 文件系统存储集成
 */

import { PRDDraft, CollaborationData, DocumentStatistics } from '../models/prd-draft.js';
import { Template } from '../models/template.js';
import { UserRole } from '../models/user-role.js';
import { ReviewStatus } from '../models/review-status.js';
import { Version } from '../models/version.js';

export interface DocumentService {
  // CRUD Operations
  createDraft(data: CreateDraftRequest): Promise<PRDDraft>;
  getDraft(id: string, userId?: string): Promise<PRDDraft | null>;
  updateDraft(id: string, data: UpdateDraftRequest, userId: string): Promise<PRDDraft>;
  deleteDraft(id: string, userId: string): Promise<boolean>;
  listDrafts(filter?: DraftFilter): Promise<PRDDraft[]>;

  // Template Integration
  applyTemplate(draftId: string, template: Template, userId: string): Promise<PRDDraft>;
  validateContent(draft: PRDDraft): Promise<ValidationResult>;

  // Search and Organization
  searchDrafts(query: SearchQuery): Promise<SearchResult[]>;
  organizeDrafts(criteria: OrganizationCriteria): Promise<OrganizedDrafts>;

  // Metadata and Statistics
  getDraftStatistics(draftId: string): Promise<DocumentStatistics>;
  updateMetadata(
    draftId: string,
    metadata: Partial<PRDDraft['metadata']>,
    userId: string
  ): Promise<PRDDraft>;
}

// Request/Response Interfaces
export interface CreateDraftRequest {
  title: string;
  templateId?: string;
  initialContent?: string;
  metadata?: {
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    category?: string;
    tags?: string[];
  };
  permissions?: {
    owner: string;
    collaborators?: string[];
    viewers?: string[];
  };
}

export interface UpdateDraftRequest {
  title?: string;
  content?: string;
  metadata?: Partial<PRDDraft['metadata']>;
  permissions?: Partial<PRDDraft['permissions']>;
}

export interface DraftFilter {
  owner?: string;
  status?: string[];
  priority?: string[];
  category?: string;
  tags?: string[];
  dateRange?: {
    from: Date;
    to: Date;
    field: 'created' | 'updated' | 'reviewed';
  };
  limit?: number;
  offset?: number;
  sortBy?: 'title' | 'created' | 'updated' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
  location?: {
    line?: number;
    column?: number;
    section?: string;
  };
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationSuggestion {
  type: 'structure' | 'content' | 'style' | 'completeness';
  message: string;
  action?: string;
}

export interface SearchQuery {
  text?: string;
  fields?: ('title' | 'content' | 'metadata')[];
  filters?: DraftFilter;
  fuzzy?: boolean;
  highlight?: boolean;
}

export interface SearchResult {
  draft: PRDDraft;
  score: number;
  highlights?: {
    field: string;
    matches: string[];
  }[];
}

export interface OrganizationCriteria {
  groupBy: 'status' | 'priority' | 'category' | 'owner' | 'date';
  sortBy?: 'count' | 'recent' | 'alphabetical';
  includeEmpty?: boolean;
}

export interface OrganizedDrafts {
  groups: {
    key: string;
    name: string;
    count: number;
    drafts: PRDDraft[];
  }[];
  total: number;
}

/**
 * DocumentService 的默认实现
 *
 * 使用文件系统存储，集成模板应用、权限检查、版本管理
 */
export class FileSystemDocumentService implements DocumentService {
  private drafts: Map<string, PRDDraft> = new Map();
  private nextId = 1;

  constructor(
    private readonly storagePath: string = './data/drafts',
    private readonly templateService?: any, // TemplateService - 稍后实现
    private readonly permissionService?: any, // PermissionService - 稍后实现
    private readonly versionService?: any // VersionService - 稍后实现
  ) {}

  async createDraft(data: CreateDraftRequest): Promise<PRDDraft> {
    const id = `draft_${Date.now()}_${this.nextId++}`;

    // 应用模板（如果指定）
    let template: Template | undefined;
    if (data.templateId && this.templateService) {
      template = await this.templateService.getTemplate(data.templateId);
    }

    // 创建初始版本
    const initialVersion: Version = {
      id: `${id}_v1`,
      draftId: id,
      versionNumber: 1,
      changeType: 'created',
      changes: [
        {
          type: 'created',
          timestamp: new Date(),
          userId: data.permissions?.owner || 'system',
          description: 'Initial draft creation',
          oldValue: null,
          newValue: data.initialContent || '',
        },
      ],
      contentSnapshot: data.initialContent || '',
      metadata: {
        author: data.permissions?.owner || 'system',
        timestamp: new Date(),
        message: 'Initial draft creation',
        checksum: this.calculateChecksum(data.initialContent || ''),
        compressed: false,
        size: (data.initialContent || '').length,
      },
    };

    // 创建初始审查状态
    const initialReviewStatus: ReviewStatus = {
      currentStatus: 'draft',
      phases: [],
      reviews: [],
      assignees: [],
      settings: {
        requireAllApprovals: false,
        allowSelfReview: false,
        autoMerge: false,
        requiredReviewers: 1,
      },
      statistics: {
        totalReviews: 0,
        approvedReviews: 0,
        rejectedReviews: 0,
        averageReviewTime: 0,
        currentPhaseProgress: 0,
      },
    };

    // 创建协作数据
    const collaborationData: CollaborationData = {
      activeEditors: [],
      editLocks: [],
      comments: [],
      suggestions: [],
      activityFeed: [
        {
          timestamp: new Date(),
          userId: data.permissions?.owner || 'system',
          action: 'created',
          description: `Created draft: ${data.title}`,
          metadata: {},
        },
      ],
    };

    // 创建文档统计
    const statistics: DocumentStatistics = {
      wordCount: this.countWords(data.initialContent || ''),
      sectionCount: this.countSections(data.initialContent || ''),
      lastModified: new Date(),
      viewCount: 0,
      editCount: 1,
      collaboratorCount: (data.permissions?.collaborators?.length || 0) + 1,
      versionCount: 1,
      reviewCount: 0,
    };

    const draft: PRDDraft = {
      id,
      title: data.title,
      content: data.initialContent || '',
      template: template || this.getDefaultTemplate(),
      reviewStatus: initialReviewStatus,
      versions: [initialVersion],
      decisions: [],
      diagrams: [],
      metadata: {
        description: data.metadata?.description || '',
        priority: data.metadata?.priority || 'medium',
        category: data.metadata?.category || '',
        tags: data.metadata?.tags || [],
        created: new Date(),
        updated: new Date(),
        lastAccessed: new Date(),
        version: '1.0.0',
        status: 'draft',
      },
      permissions: {
        owner: data.permissions?.owner || 'system',
        collaborators: data.permissions?.collaborators || [],
        viewers: data.permissions?.viewers || [],
        public: false,
        inheritance: {
          from: null,
          depth: 0,
        },
      },
      collaboration: collaborationData,
      statistics,
    };

    this.drafts.set(id, draft);
    await this.persistDraft(draft);

    return draft;
  }

  async getDraft(id: string, userId?: string): Promise<PRDDraft | null> {
    const draft = this.drafts.get(id);
    if (!draft) {
      return null;
    }

    // 检查读取权限
    if (userId && this.permissionService) {
      const canRead = await this.permissionService.canRead(userId, draft);
      if (!canRead) {
        throw new Error('Permission denied: Cannot read this draft');
      }
    }

    // 更新访问统计
    draft.statistics.viewCount++;
    draft.metadata.lastAccessed = new Date();
    await this.persistDraft(draft);

    return draft;
  }

  async updateDraft(id: string, data: UpdateDraftRequest, userId: string): Promise<PRDDraft> {
    const draft = this.drafts.get(id);
    if (!draft) {
      throw new Error(`Draft not found: ${id}`);
    }

    // 检查编辑权限
    if (this.permissionService) {
      const canEdit = await this.permissionService.canEdit(userId, draft);
      if (!canEdit) {
        throw new Error('Permission denied: Cannot edit this draft');
      }
    }

    // 记录更改
    const changes: Version['changes'] = [];

    if (data.title && data.title !== draft.title) {
      changes.push({
        type: 'updated',
        timestamp: new Date(),
        userId,
        description: `Title changed from "${draft.title}" to "${data.title}"`,
        oldValue: draft.title,
        newValue: data.title,
      });
      draft.title = data.title;
    }

    if (data.content && data.content !== draft.content) {
      changes.push({
        type: 'updated',
        timestamp: new Date(),
        userId,
        description: 'Content updated',
        oldValue: draft.content,
        newValue: data.content,
      });
      draft.content = data.content;
      draft.statistics.wordCount = this.countWords(data.content);
      draft.statistics.sectionCount = this.countSections(data.content);
    }

    if (data.metadata) {
      Object.assign(draft.metadata, data.metadata);
    }

    if (data.permissions) {
      Object.assign(draft.permissions, data.permissions);
    }

    // 更新统计信息
    draft.metadata.updated = new Date();
    draft.statistics.lastModified = new Date();
    draft.statistics.editCount++;

    // 创建新版本（如果有实质性更改）
    if (changes.length > 0 && this.versionService) {
      const newVersion = await this.versionService.createVersion(draft, changes, userId);
      draft.versions.push(newVersion);
      draft.statistics.versionCount++;
    }

    // 添加到活动动态
    draft.collaboration.activityFeed.unshift({
      timestamp: new Date(),
      userId,
      action: 'updated',
      description: `Updated draft: ${changes.map((c) => c.description).join(', ')}`,
      metadata: { changesCount: changes.length },
    });

    await this.persistDraft(draft);
    return draft;
  }

  async deleteDraft(id: string, userId: string): Promise<boolean> {
    const draft = this.drafts.get(id);
    if (!draft) {
      return false;
    }

    // 检查删除权限
    if (this.permissionService) {
      const canDelete = await this.permissionService.canDelete(userId, draft);
      if (!canDelete) {
        throw new Error('Permission denied: Cannot delete this draft');
      }
    }

    this.drafts.delete(id);
    await this.removeDraftFile(id);
    return true;
  }

  async listDrafts(filter?: DraftFilter): Promise<PRDDraft[]> {
    let drafts = Array.from(this.drafts.values());

    if (filter) {
      // 应用过滤条件
      if (filter.owner) {
        drafts = drafts.filter((d) => d.permissions.owner === filter.owner);
      }

      if (filter.status?.length) {
        drafts = drafts.filter((d) => filter.status!.includes(d.metadata.status));
      }

      if (filter.priority?.length) {
        drafts = drafts.filter((d) => filter.priority!.includes(d.metadata.priority));
      }

      if (filter.category) {
        drafts = drafts.filter((d) => d.metadata.category === filter.category);
      }

      if (filter.tags?.length) {
        drafts = drafts.filter((d) => filter.tags!.some((tag) => d.metadata.tags.includes(tag)));
      }

      if (filter.dateRange) {
        const { from, to, field } = filter.dateRange;
        drafts = drafts.filter((d) => {
          const date =
            field === 'created'
              ? d.metadata.created
              : field === 'updated'
                ? d.metadata.updated
                : d.metadata.updated; // 默认使用updated
          return date >= from && date <= to;
        });
      }

      // 排序
      if (filter.sortBy) {
        drafts.sort((a, b) => {
          let valueA: any, valueB: any;

          switch (filter.sortBy) {
            case 'title':
              valueA = a.title;
              valueB = b.title;
              break;
            case 'created':
              valueA = a.metadata.created;
              valueB = b.metadata.created;
              break;
            case 'updated':
              valueA = a.metadata.updated;
              valueB = b.metadata.updated;
              break;
            case 'priority':
              const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
              valueA = priorityOrder[a.metadata.priority as keyof typeof priorityOrder];
              valueB = priorityOrder[b.metadata.priority as keyof typeof priorityOrder];
              break;
            default:
              valueA = a.title;
              valueB = b.title;
          }

          if (typeof valueA === 'string') {
            return filter.sortOrder === 'desc'
              ? valueB.localeCompare(valueA)
              : valueA.localeCompare(valueB);
          } else {
            return filter.sortOrder === 'desc' ? valueB - valueA : valueA - valueB;
          }
        });
      }

      // 分页
      if (filter.offset || filter.limit) {
        const start = filter.offset || 0;
        const end = filter.limit ? start + filter.limit : undefined;
        drafts = drafts.slice(start, end);
      }
    }

    return drafts;
  }

  async applyTemplate(draftId: string, template: Template, userId: string): Promise<PRDDraft> {
    const draft = await this.getDraft(draftId, userId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    // 检查编辑权限
    if (this.permissionService) {
      const canEdit = await this.permissionService.canEdit(userId, draft);
      if (!canEdit) {
        throw new Error('Permission denied: Cannot apply template to this draft');
      }
    }

    // 应用模板结构
    draft.template = template;

    // 如果内容为空，使用模板的默认内容
    if (!draft.content.trim() && template.defaultContent) {
      draft.content = template.defaultContent;
    }

    // 更新元数据
    draft.metadata.updated = new Date();
    draft.statistics.lastModified = new Date();

    // 记录模板应用活动
    draft.collaboration.activityFeed.unshift({
      timestamp: new Date(),
      userId,
      action: 'template_applied',
      description: `Applied template: ${template.name}`,
      metadata: { templateId: template.id, templateVersion: template.version },
    });

    await this.persistDraft(draft);
    return draft;
  }

  async validateContent(draft: PRDDraft): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // 基本验证
    if (!draft.title.trim()) {
      errors.push({
        field: 'title',
        message: 'Title is required',
        severity: 'error',
      });
    }

    if (!draft.content.trim()) {
      warnings.push({
        field: 'content',
        message: 'Content is empty',
        suggestion: 'Add some content to describe your requirements',
      });
    }

    // 模板验证
    if (draft.template && draft.template.structure) {
      for (const section of draft.template.structure.sections) {
        if (section.required && !this.contentHasSection(draft.content, section.name)) {
          errors.push({
            field: 'content',
            message: `Required section missing: ${section.name}`,
            severity: 'error',
            location: { section: section.name },
          });
        }
      }
    }

    // 内容质量检查
    const wordCount = this.countWords(draft.content);
    if (wordCount < 100) {
      suggestions.push({
        type: 'completeness',
        message: 'Content seems too brief for a PRD',
        action: 'Consider adding more detailed requirements and specifications',
      });
    }

    // 结构建议
    if (!this.hasProperStructure(draft.content)) {
      suggestions.push({
        type: 'structure',
        message: 'Consider adding proper headings and sections',
        action: 'Use markdown headers (# ## ###) to organize content',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  async searchDrafts(query: SearchQuery): Promise<SearchResult[]> {
    const allDrafts = Array.from(this.drafts.values());
    const results: SearchResult[] = [];

    if (!query.text) {
      return allDrafts.map((draft) => ({ draft, score: 1 }));
    }

    for (const draft of allDrafts) {
      let score = 0;
      const highlights: SearchResult['highlights'] = [];

      // 搜索字段
      const searchFields = query.fields || ['title', 'content', 'metadata'];

      for (const field of searchFields) {
        let fieldContent = '';
        let fieldWeight = 1;

        switch (field) {
          case 'title':
            fieldContent = draft.title;
            fieldWeight = 3; // 标题权重更高
            break;
          case 'content':
            fieldContent = draft.content;
            fieldWeight = 1;
            break;
          case 'metadata':
            fieldContent = [
              draft.metadata.description,
              draft.metadata.category,
              ...draft.metadata.tags,
            ].join(' ');
            fieldWeight = 2;
            break;
        }

        const matches = this.findMatches(fieldContent, query.text, query.fuzzy);
        if (matches.length > 0) {
          score += matches.length * fieldWeight;

          if (query.highlight) {
            highlights.push({
              field,
              matches: matches.slice(0, 3), // 限制高亮数量
            });
          }
        }
      }

      if (score > 0) {
        results.push({ draft, score, highlights: highlights.length > 0 ? highlights : undefined });
      }
    }

    // 按得分排序
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  async organizeDrafts(criteria: OrganizationCriteria): Promise<OrganizedDrafts> {
    const allDrafts = Array.from(this.drafts.values());
    const groups: OrganizedDrafts['groups'] = [];

    // 按条件分组
    const groupMap = new Map<string, PRDDraft[]>();

    for (const draft of allDrafts) {
      let groupKey = '';
      let groupName = '';

      switch (criteria.groupBy) {
        case 'status':
          groupKey = draft.metadata.status;
          groupName = this.formatStatusName(draft.metadata.status);
          break;
        case 'priority':
          groupKey = draft.metadata.priority;
          groupName = this.formatPriorityName(draft.metadata.priority);
          break;
        case 'category':
          groupKey = draft.metadata.category || 'uncategorized';
          groupName = draft.metadata.category || 'Uncategorized';
          break;
        case 'owner':
          groupKey = draft.permissions.owner;
          groupName = draft.permissions.owner;
          break;
        case 'date':
          const date = draft.metadata.created;
          groupKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
          groupName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
          break;
      }

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(draft);
    }

    // 转换为结果格式
    for (const [key, drafts] of groupMap.entries()) {
      groups.push({
        key,
        name: key,
        count: drafts.length,
        drafts,
      });
    }

    // 排序组
    if (criteria.sortBy) {
      groups.sort((a, b) => {
        switch (criteria.sortBy) {
          case 'count':
            return b.count - a.count;
          case 'recent':
            const latestA = Math.max(...a.drafts.map((d) => d.metadata.updated.getTime()));
            const latestB = Math.max(...b.drafts.map((d) => d.metadata.updated.getTime()));
            return latestB - latestA;
          case 'alphabetical':
          default:
            return a.name.localeCompare(b.name);
        }
      });
    }

    return {
      groups,
      total: allDrafts.length,
    };
  }

  async getDraftStatistics(draftId: string): Promise<DocumentStatistics> {
    const draft = await this.getDraft(draftId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }
    return draft.statistics;
  }

  async updateMetadata(
    draftId: string,
    metadata: Partial<PRDDraft['metadata']>,
    userId: string
  ): Promise<PRDDraft> {
    const draft = await this.getDraft(draftId, userId);
    if (!draft) {
      throw new Error(`Draft not found: ${draftId}`);
    }

    // 检查编辑权限
    if (this.permissionService) {
      const canEdit = await this.permissionService.canEdit(userId, draft);
      if (!canEdit) {
        throw new Error('Permission denied: Cannot update metadata for this draft');
      }
    }

    // 更新元数据
    Object.assign(draft.metadata, metadata);
    draft.metadata.updated = new Date();

    // 记录活动
    draft.collaboration.activityFeed.unshift({
      timestamp: new Date(),
      userId,
      action: 'metadata_updated',
      description: 'Metadata updated',
      metadata: { fields: Object.keys(metadata) },
    });

    await this.persistDraft(draft);
    return draft;
  }

  // 私有辅助方法
  private getDefaultTemplate(): Template {
    return {
      id: 'default',
      name: 'Default PRD Template',
      description: 'Basic PRD template',
      version: '1.0.0',
      category: 'general',
      structure: {
        sections: [
          {
            name: 'Overview',
            description: 'Project overview and objectives',
            required: true,
            fields: [],
            subsections: [],
          },
        ],
      },
      defaultContent:
        '# Project Requirements Document\n\n## Overview\n\nAdd your requirements here...',
      validationRules: [],
      metadata: {
        author: 'system',
        created: new Date(),
        updated: new Date(),
        tags: ['default'],
        usage: 0,
      },
    };
  }

  private countWords(content: string): number {
    return content
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private countSections(content: string): number {
    return (content.match(/^#+\s/gm) || []).length;
  }

  private calculateChecksum(content: string): string {
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(16);
  }

  private contentHasSection(content: string, sectionName: string): boolean {
    const sectionRegex = new RegExp(`^#+\\s*${sectionName}`, 'mi');
    return sectionRegex.test(content);
  }

  private hasProperStructure(content: string): boolean {
    return /^#+\s/.test(content) && content.includes('\n');
  }

  private findMatches(text: string, query: string, fuzzy = false): string[] {
    const matches: string[] = [];
    const searchText = text.toLowerCase();
    const searchQuery = query.toLowerCase();

    if (fuzzy) {
      // 简单的模糊匹配
      const words = searchQuery.split(/\s+/);
      for (const word of words) {
        if (searchText.includes(word)) {
          matches.push(word);
        }
      }
    } else {
      // 精确匹配
      if (searchText.includes(searchQuery)) {
        matches.push(query);
      }
    }

    return matches;
  }

  private formatStatusName(status: string): string {
    return status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }

  private formatPriorityName(priority: string): string {
    return priority.charAt(0).toUpperCase() + priority.slice(1);
  }

  private async persistDraft(draft: PRDDraft): Promise<void> {
    // 实现文件系统持久化
    // 这里暂时只是内存存储，后续会在存储层实现真正的文件持久化
  }

  private async removeDraftFile(draftId: string): Promise<void> {
    // 实现文件删除
    // 这里暂时只是内存删除，后续会在存储层实现真正的文件删除
  }
}

export default FileSystemDocumentService;
