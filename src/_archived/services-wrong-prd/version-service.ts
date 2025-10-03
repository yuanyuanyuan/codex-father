/**
 * VersionService - 版本历史管理服务
 *
 * 核心功能：
 * - 版本创建和管理
 * - 变更跟踪和差异计算
 * - 版本恢复和回滚
 * - 冲突检测和解决
 */

import {
  Version,
  VersionChange,
  VersionMetadata,
  ChangeType,
  ConflictResolution,
  MergeStrategy,
} from '../models/version.js';
import { PRDDraft } from '../models/prd-draft.js';

export interface VersionService {
  // Version Management
  createVersion(draft: PRDDraft, changes: VersionChange[], userId: string): Promise<Version>;
  getVersion(versionId: string): Promise<Version | null>;
  listVersions(draftId: string, filter?: VersionFilter): Promise<Version[]>;
  deleteVersion(versionId: string, userId: string): Promise<boolean>;

  // Version Comparison
  compareVersions(versionId1: string, versionId2: string): Promise<VersionComparison>;
  getDiff(fromVersion: string, toVersion: string): Promise<DiffResult>;
  getChangeHistory(draftId: string, options?: ChangeHistoryOptions): Promise<ChangeHistoryEntry[]>;

  // Version Restoration
  restoreVersion(draftId: string, versionId: string, userId: string): Promise<PRDDraft>;
  rollbackToVersion(draftId: string, versionId: string, userId: string): Promise<PRDDraft>;
  previewRestore(draftId: string, versionId: string): Promise<RestorePreview>;

  // Conflict Management
  detectConflicts(baseVersion: string, targetVersion: string): Promise<ConflictDetectionResult>;
  resolveConflicts(
    conflicts: VersionConflict[],
    resolutions: ConflictResolution[]
  ): Promise<ConflictResolutionResult>;
  mergeVersions(
    baseVersion: string,
    sourceVersion: string,
    strategy: MergeStrategy
  ): Promise<MergeResult>;

  // Branching and Tagging
  createBranch(fromVersionId: string, branchName: string, userId: string): Promise<VersionBranch>;
  listBranches(draftId: string): Promise<VersionBranch[]>;
  createTag(
    versionId: string,
    tagName: string,
    description: string,
    userId: string
  ): Promise<VersionTag>;
  listTags(draftId: string): Promise<VersionTag[]>;

  // Content Analysis
  analyzeChanges(changes: VersionChange[]): Promise<ChangeAnalysis>;
  getVersionStatistics(draftId: string): Promise<VersionStatistics>;
  validateVersionIntegrity(versionId: string): Promise<IntegrityCheckResult>;

  // Compression and Optimization
  compressVersionHistory(draftId: string, options?: CompressionOptions): Promise<CompressionResult>;
  optimizeStorage(draftId: string): Promise<OptimizationResult>;
}

// Request/Response Interfaces
export interface VersionFilter {
  authorId?: string;
  changeType?: ChangeType[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  sortBy?: 'versionNumber' | 'timestamp' | 'changeCount';
  sortOrder?: 'asc' | 'desc';
}

export interface VersionComparison {
  fromVersion: Version;
  toVersion: Version;
  differences: VersionDifference[];
  statistics: {
    totalChanges: number;
    addedLines: number;
    deletedLines: number;
    modifiedLines: number;
    addedSections: number;
    deletedSections: number;
    modifiedSections: number;
  };
  compatibility: 'compatible' | 'breaking' | 'major' | 'minor';
}

export interface VersionDifference {
  type: 'added' | 'deleted' | 'modified';
  path: string;
  section?: string;
  oldValue?: any;
  newValue?: any;
  context?: {
    line?: number;
    column?: number;
    surrounding?: string;
  };
}

export interface DiffResult {
  unified: string; // unified diff format
  structured: StructuredDiff;
  summary: DiffSummary;
  conflicts?: DiffConflict[];
}

export interface StructuredDiff {
  sections: {
    name: string;
    changes: {
      type: 'added' | 'deleted' | 'modified';
      lineNumber: number;
      content: string;
      metadata?: any;
    }[];
  }[];
  metadata: {
    linesAdded: number;
    linesDeleted: number;
    linesModified: number;
  };
}

export interface DiffSummary {
  totalChanges: number;
  changesByType: Record<ChangeType, number>;
  affectedSections: string[];
  impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface DiffConflict {
  section: string;
  type: 'content' | 'structure' | 'metadata';
  description: string;
  resolution?: 'manual' | 'auto_merge' | 'prefer_source' | 'prefer_target';
}

export interface ChangeHistoryOptions {
  includeContent?: boolean;
  includeMetadata?: boolean;
  groupByAuthor?: boolean;
  groupByDate?: boolean;
  maxEntries?: number;
}

export interface ChangeHistoryEntry {
  version: Version;
  author: {
    id: string;
    name: string;
  };
  timestamp: Date;
  changes: VersionChange[];
  summary: string;
  impact: 'low' | 'medium' | 'high';
  tags?: string[];
}

export interface RestorePreview {
  targetVersion: Version;
  currentContent: string;
  restoredContent: string;
  changes: VersionDifference[];
  warnings: RestoreWarning[];
  conflicts?: VersionConflict[];
}

export interface RestoreWarning {
  type: 'data_loss' | 'breaking_change' | 'compatibility' | 'dependency';
  message: string;
  severity: 'low' | 'medium' | 'high';
  affectedItems?: string[];
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: VersionConflict[];
  autoResolvable: VersionConflict[];
  manualResolutionRequired: VersionConflict[];
}

export interface VersionConflict {
  id: string;
  type: 'content' | 'structure' | 'metadata' | 'permission';
  section: string;
  description: string;
  baseValue: any;
  sourceValue: any;
  targetValue: any;
  suggestions?: ConflictResolution[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ConflictResolutionResult {
  resolved: number;
  remaining: number;
  conflicts: VersionConflict[];
  mergedContent: string;
  warnings: string[];
}

export interface MergeResult {
  success: boolean;
  mergedVersion: Version;
  conflicts?: VersionConflict[];
  warnings?: string[];
  statistics: {
    totalChanges: number;
    autoMerged: number;
    manuallyResolved: number;
    conflictsRemaining: number;
  };
}

export interface VersionBranch {
  id: string;
  name: string;
  description: string;
  baseVersionId: string;
  headVersionId: string;
  draftId: string;
  author: {
    id: string;
    name: string;
  };
  created: Date;
  lastCommit: Date;
  status: 'active' | 'merged' | 'abandoned';
  metadata: {
    commitCount: number;
    mergeConflicts?: boolean;
  };
}

export interface VersionTag {
  id: string;
  name: string;
  description: string;
  versionId: string;
  draftId: string;
  author: {
    id: string;
    name: string;
  };
  created: Date;
  type: 'release' | 'milestone' | 'checkpoint' | 'custom';
  metadata?: Record<string, any>;
}

export interface ChangeAnalysis {
  complexity: 'low' | 'medium' | 'high' | 'critical';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  impactScore: number; // 0-100
  categories: {
    structural: number;
    content: number;
    metadata: number;
    permissions: number;
  };
  recommendations: string[];
  warnings: string[];
}

export interface VersionStatistics {
  totalVersions: number;
  versionsByAuthor: Record<string, number>;
  versionsByType: Record<ChangeType, number>;
  averageChangeSize: number;
  largestChange: {
    versionId: string;
    size: number;
    date: Date;
  };
  changeFrequency: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  storageUsage: {
    total: number;
    compressed: number;
    compressionRatio: number;
  };
}

export interface IntegrityCheckResult {
  isValid: boolean;
  issues: IntegrityIssue[];
  warnings: IntegrityWarning[];
  repairSuggestions?: IntegrityRepairSuggestion[];
}

export interface IntegrityIssue {
  type: 'checksum_mismatch' | 'missing_content' | 'corrupted_data' | 'invalid_reference';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: string;
  repairAction?: string;
}

export interface IntegrityWarning {
  type: 'performance' | 'compatibility' | 'storage';
  message: string;
  suggestion?: string;
}

export interface IntegrityRepairSuggestion {
  issue: string;
  action: 'recompute_checksum' | 'restore_from_backup' | 'remove_version' | 'manual_fix';
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface CompressionOptions {
  strategy: 'lz4' | 'gzip' | 'brotli' | 'delta';
  level?: number; // 1-9
  keepVersions?: number; // number of recent versions to keep uncompressed
  threshold?: number; // minimum size in bytes to compress
}

export interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  versionsProcessed: number;
  timeElapsed: number;
  errors?: string[];
}

export interface OptimizationResult {
  before: {
    versions: number;
    totalSize: number;
    redundancy: number;
  };
  after: {
    versions: number;
    totalSize: number;
    redundancy: number;
  };
  savings: {
    size: number;
    percentage: number;
  };
  operations: string[];
}

/**
 * VersionService 的默认实现
 *
 * 支持增量存储、压缩、冲突检测和智能合并
 */
export class DefaultVersionService implements VersionService {
  private versions: Map<string, Version> = new Map();
  private branches: Map<string, VersionBranch> = new Map();
  private tags: Map<string, VersionTag> = new Map();
  private nextId = 1;

  constructor(private readonly storagePath: string = './data/versions') {}

  async createVersion(draft: PRDDraft, changes: VersionChange[], userId: string): Promise<Version> {
    const versionNumber = Math.max(...draft.versions.map((v) => v.versionNumber), 0) + 1;
    const versionId = `${draft.id}_v${versionNumber}`;

    // 计算内容快照
    const contentSnapshot = this.compressContent(draft.content);

    // 计算校验和
    const checksum = this.calculateChecksum(draft.content);

    const version: Version = {
      id: versionId,
      draftId: draft.id,
      versionNumber,
      changeType: this.inferChangeType(changes),
      changes,
      contentSnapshot,
      metadata: {
        author: userId,
        timestamp: new Date(),
        message: this.generateChangeMessage(changes),
        checksum,
        compressed: true,
        size: draft.content.length,
      },
    };

    this.versions.set(versionId, version);
    await this.persistVersion(version);

    return version;
  }

  async getVersion(versionId: string): Promise<Version | null> {
    const version = this.versions.get(versionId);
    if (version && version.metadata.compressed) {
      // 解压缩内容
      version.contentSnapshot = this.decompressContent(version.contentSnapshot);
    }
    return version || null;
  }

  async listVersions(draftId: string, filter?: VersionFilter): Promise<Version[]> {
    let versions = Array.from(this.versions.values()).filter((v) => v.draftId === draftId);

    if (filter) {
      if (filter.authorId) {
        versions = versions.filter((v) => v.metadata.author === filter.authorId);
      }

      if (filter.changeType?.length) {
        versions = versions.filter((v) => filter.changeType!.includes(v.changeType));
      }

      if (filter.dateRange) {
        const { from, to } = filter.dateRange;
        versions = versions.filter(
          (v) => v.metadata.timestamp >= from && v.metadata.timestamp <= to
        );
      }

      // 排序
      if (filter.sortBy) {
        versions.sort((a, b) => {
          let valueA: any, valueB: any;

          switch (filter.sortBy) {
            case 'versionNumber':
              valueA = a.versionNumber;
              valueB = b.versionNumber;
              break;
            case 'timestamp':
              valueA = a.metadata.timestamp;
              valueB = b.metadata.timestamp;
              break;
            case 'changeCount':
              valueA = a.changes.length;
              valueB = b.changes.length;
              break;
            default:
              valueA = a.versionNumber;
              valueB = b.versionNumber;
          }

          const order = filter.sortOrder === 'desc' ? -1 : 1;
          if (typeof valueA === 'number') {
            return (valueA - valueB) * order;
          } else {
            return valueA.toString().localeCompare(valueB.toString()) * order;
          }
        });
      }

      // 分页
      if (filter.offset || filter.limit) {
        const start = filter.offset || 0;
        const end = filter.limit ? start + filter.limit : undefined;
        versions = versions.slice(start, end);
      }
    }

    return versions;
  }

  async deleteVersion(versionId: string, userId: string): Promise<boolean> {
    const version = this.versions.get(versionId);
    if (!version) {
      return false;
    }

    // 检查是否是最新版本
    const allVersions = await this.listVersions(version.draftId);
    const latestVersion = allVersions.reduce((latest, current) =>
      current.versionNumber > latest.versionNumber ? current : latest
    );

    if (version.id === latestVersion.id) {
      throw new Error('Cannot delete the latest version');
    }

    this.versions.delete(versionId);
    await this.removeVersionFile(versionId);
    return true;
  }

  async compareVersions(versionId1: string, versionId2: string): Promise<VersionComparison> {
    const version1 = await this.getVersion(versionId1);
    const version2 = await this.getVersion(versionId2);

    if (!version1 || !version2) {
      throw new Error('One or both versions not found');
    }

    const content1 = version1.contentSnapshot;
    const content2 = version2.contentSnapshot;

    const differences = this.calculateDifferences(content1, content2);
    const statistics = this.calculateComparisonStatistics(differences);
    const compatibility = this.assessCompatibility(differences);

    return {
      fromVersion: version1,
      toVersion: version2,
      differences,
      statistics,
      compatibility,
    };
  }

  async getDiff(fromVersion: string, toVersion: string): Promise<DiffResult> {
    const comparison = await this.compareVersions(fromVersion, toVersion);

    const unified = this.generateUnifiedDiff(
      comparison.fromVersion.contentSnapshot,
      comparison.toVersion.contentSnapshot
    );

    const structured = this.generateStructuredDiff(comparison.differences);
    const summary = this.generateDiffSummary(comparison.differences);
    const conflicts = this.detectDiffConflicts(comparison.differences);

    return {
      unified,
      structured,
      summary,
      conflicts: conflicts.length > 0 ? conflicts : undefined,
    };
  }

  async getChangeHistory(
    draftId: string,
    options?: ChangeHistoryOptions
  ): Promise<ChangeHistoryEntry[]> {
    const versions = await this.listVersions(draftId, {
      sortBy: 'timestamp',
      sortOrder: 'desc',
      limit: options?.maxEntries,
    });

    const entries: ChangeHistoryEntry[] = [];

    for (const version of versions) {
      const entry: ChangeHistoryEntry = {
        version,
        author: {
          id: version.metadata.author,
          name: await this.getAuthorName(version.metadata.author),
        },
        timestamp: version.metadata.timestamp,
        changes: version.changes,
        summary: version.metadata.message,
        impact: this.assessChangeImpact(version.changes),
        tags: await this.getVersionTags(version.id),
      };

      entries.push(entry);
    }

    return entries;
  }

  async restoreVersion(draftId: string, versionId: string, userId: string): Promise<PRDDraft> {
    const version = await this.getVersion(versionId);
    if (!version || version.draftId !== draftId) {
      throw new Error('Version not found or does not belong to the draft');
    }

    // 这里需要从 DocumentService 获取当前草稿并更新
    // 简化实现，返回包含恢复内容的草稿结构
    const restoredDraft: Partial<PRDDraft> = {
      id: draftId,
      content: version.contentSnapshot,
      metadata: {
        updated: new Date(),
        version: `restored_from_v${version.versionNumber}`,
      } as any,
    };

    // 创建恢复操作的新版本
    const restoreChanges: VersionChange[] = [
      {
        type: 'restored',
        timestamp: new Date(),
        userId,
        description: `Restored from version ${version.versionNumber}`,
        oldValue: 'current_content',
        newValue: version.contentSnapshot,
      },
    ];

    await this.createVersion(restoredDraft as PRDDraft, restoreChanges, userId);

    return restoredDraft as PRDDraft;
  }

  async rollbackToVersion(draftId: string, versionId: string, userId: string): Promise<PRDDraft> {
    // 回滚与恢复类似，但会删除目标版本之后的所有版本
    const targetVersion = await this.getVersion(versionId);
    if (!targetVersion || targetVersion.draftId !== draftId) {
      throw new Error('Target version not found or does not belong to the draft');
    }

    const allVersions = await this.listVersions(draftId, {
      sortBy: 'versionNumber',
      sortOrder: 'asc',
    });
    const versionsToDelete = allVersions.filter(
      (v) => v.versionNumber > targetVersion.versionNumber
    );

    // 删除后续版本
    for (const version of versionsToDelete) {
      await this.deleteVersion(version.id, userId);
    }

    return this.restoreVersion(draftId, versionId, userId);
  }

  async previewRestore(draftId: string, versionId: string): Promise<RestorePreview> {
    const targetVersion = await this.getVersion(versionId);
    if (!targetVersion) {
      throw new Error('Version not found');
    }

    // 获取当前版本（最新版本）
    const currentVersions = await this.listVersions(draftId, {
      sortBy: 'versionNumber',
      sortOrder: 'desc',
      limit: 1,
    });
    const currentVersion = currentVersions[0];

    const currentContent = currentVersion?.contentSnapshot || '';
    const restoredContent = targetVersion.contentSnapshot;

    const changes = this.calculateDifferences(currentContent, restoredContent);
    const warnings = this.analyzeRestoreRisks(currentVersion, targetVersion);
    const conflicts = await this.detectConflicts(currentVersion?.id || '', versionId);

    return {
      targetVersion,
      currentContent,
      restoredContent,
      changes,
      warnings,
      conflicts: conflicts.hasConflicts ? conflicts.conflicts : undefined,
    };
  }

  async detectConflicts(
    baseVersionId: string,
    targetVersionId: string
  ): Promise<ConflictDetectionResult> {
    const baseVersion = await this.getVersion(baseVersionId);
    const targetVersion = await this.getVersion(targetVersionId);

    if (!baseVersion || !targetVersion) {
      return {
        hasConflicts: false,
        conflicts: [],
        autoResolvable: [],
        manualResolutionRequired: [],
      };
    }

    const conflicts: VersionConflict[] = [];

    // 检测内容冲突
    const contentConflicts = this.detectContentConflicts(baseVersion, targetVersion);
    conflicts.push(...contentConflicts);

    // 检测结构冲突
    const structureConflicts = this.detectStructureConflicts(baseVersion, targetVersion);
    conflicts.push(...structureConflicts);

    // 分类冲突
    const autoResolvable = conflicts.filter((c) => this.canAutoResolve(c));
    const manualResolutionRequired = conflicts.filter((c) => !this.canAutoResolve(c));

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      autoResolvable,
      manualResolutionRequired,
    };
  }

  async resolveConflicts(
    conflicts: VersionConflict[],
    resolutions: ConflictResolution[]
  ): Promise<ConflictResolutionResult> {
    let resolved = 0;
    let mergedContent = '';
    const warnings: string[] = [];
    const remainingConflicts: VersionConflict[] = [];

    for (const conflict of conflicts) {
      const resolution = resolutions.find((r) => r.conflictId === conflict.id);

      if (resolution) {
        try {
          mergedContent = this.applyResolution(mergedContent, conflict, resolution);
          resolved++;
        } catch (error) {
          warnings.push(`Failed to resolve conflict ${conflict.id}: ${error}`);
          remainingConflicts.push(conflict);
        }
      } else {
        remainingConflicts.push(conflict);
      }
    }

    return {
      resolved,
      remaining: remainingConflicts.length,
      conflicts: remainingConflicts,
      mergedContent,
      warnings,
    };
  }

  async mergeVersions(
    baseVersionId: string,
    sourceVersionId: string,
    strategy: MergeStrategy
  ): Promise<MergeResult> {
    const baseVersion = await this.getVersion(baseVersionId);
    const sourceVersion = await this.getVersion(sourceVersionId);

    if (!baseVersion || !sourceVersion) {
      throw new Error('One or both versions not found');
    }

    const conflicts = await this.detectConflicts(baseVersionId, sourceVersionId);

    let mergedContent = baseVersion.contentSnapshot;
    const autoMerged = 0;
    const manuallyResolved = 0;

    // 应用合并策略
    switch (strategy.type) {
      case 'three_way':
        mergedContent = this.performThreeWayMerge(baseVersion, sourceVersion, strategy);
        break;
      case 'fast_forward':
        mergedContent = sourceVersion.contentSnapshot;
        break;
      case 'ours':
        mergedContent = baseVersion.contentSnapshot;
        break;
      case 'theirs':
        mergedContent = sourceVersion.contentSnapshot;
        break;
    }

    // 创建合并版本
    const mergeChanges: VersionChange[] = [
      {
        type: 'merged',
        timestamp: new Date(),
        userId: strategy.userId || 'system',
        description: `Merged version ${sourceVersion.versionNumber} using ${strategy.type} strategy`,
        oldValue: baseVersion.contentSnapshot,
        newValue: mergedContent,
      },
    ];

    const mergedVersion = await this.createVersion(
      {
        id: baseVersion.draftId,
        content: mergedContent,
      } as PRDDraft,
      mergeChanges,
      strategy.userId || 'system'
    );

    return {
      success:
        !conflicts.hasConflicts || conflicts.autoResolvable.length === conflicts.conflicts.length,
      mergedVersion,
      conflicts:
        conflicts.manualResolutionRequired.length > 0
          ? conflicts.manualResolutionRequired
          : undefined,
      statistics: {
        totalChanges: mergeChanges.length,
        autoMerged,
        manuallyResolved,
        conflictsRemaining: conflicts.manualResolutionRequired.length,
      },
    };
  }

  async createBranch(
    fromVersionId: string,
    branchName: string,
    userId: string
  ): Promise<VersionBranch> {
    const baseVersion = await this.getVersion(fromVersionId);
    if (!baseVersion) {
      throw new Error('Base version not found');
    }

    const branch: VersionBranch = {
      id: `branch_${Date.now()}_${this.nextId++}`,
      name: branchName,
      description: `Branch created from version ${baseVersion.versionNumber}`,
      baseVersionId: fromVersionId,
      headVersionId: fromVersionId,
      draftId: baseVersion.draftId,
      author: {
        id: userId,
        name: await this.getAuthorName(userId),
      },
      created: new Date(),
      lastCommit: baseVersion.metadata.timestamp,
      status: 'active',
      metadata: {
        commitCount: 0,
      },
    };

    this.branches.set(branch.id, branch);
    return branch;
  }

  async listBranches(draftId: string): Promise<VersionBranch[]> {
    return Array.from(this.branches.values()).filter((b) => b.draftId === draftId);
  }

  async createTag(
    versionId: string,
    tagName: string,
    description: string,
    userId: string
  ): Promise<VersionTag> {
    const version = await this.getVersion(versionId);
    if (!version) {
      throw new Error('Version not found');
    }

    const tag: VersionTag = {
      id: `tag_${Date.now()}_${this.nextId++}`,
      name: tagName,
      description,
      versionId,
      draftId: version.draftId,
      author: {
        id: userId,
        name: await this.getAuthorName(userId),
      },
      created: new Date(),
      type: this.inferTagType(tagName),
    };

    this.tags.set(tag.id, tag);
    return tag;
  }

  async listTags(draftId: string): Promise<VersionTag[]> {
    return Array.from(this.tags.values()).filter((t) => t.draftId === draftId);
  }

  async analyzeChanges(changes: VersionChange[]): Promise<ChangeAnalysis> {
    const complexity = this.assessChangeComplexity(changes);
    const riskLevel = this.assessChangeRisk(changes);
    const impactScore = this.calculateImpactScore(changes);

    const categories = {
      structural: changes.filter((c) => c.type === 'structure').length,
      content: changes.filter((c) => c.type === 'updated').length,
      metadata: changes.filter((c) => c.type === 'metadata').length,
      permissions: changes.filter((c) => c.type === 'permissions').length,
    };

    const recommendations = this.generateChangeRecommendations(changes);
    const warnings = this.generateChangeWarnings(changes);

    return {
      complexity,
      riskLevel,
      impactScore,
      categories,
      recommendations,
      warnings,
    };
  }

  async getVersionStatistics(draftId: string): Promise<VersionStatistics> {
    const versions = await this.listVersions(draftId);

    const versionsByAuthor: Record<string, number> = {};
    const versionsByType: Record<ChangeType, number> = {};
    let totalChangeSize = 0;
    let largestChange = { versionId: '', size: 0, date: new Date() };

    for (const version of versions) {
      // 按作者统计
      versionsByAuthor[version.metadata.author] =
        (versionsByAuthor[version.metadata.author] || 0) + 1;

      // 按类型统计
      versionsByType[version.changeType] = (versionsByType[version.changeType] || 0) + 1;

      // 变更大小统计
      const changeSize = version.changes.length;
      totalChangeSize += changeSize;

      if (changeSize > largestChange.size) {
        largestChange = {
          versionId: version.id,
          size: changeSize,
          date: version.metadata.timestamp,
        };
      }
    }

    const averageChangeSize = versions.length > 0 ? totalChangeSize / versions.length : 0;

    // 计算变更频率
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyVersions = versions.filter((v) => v.metadata.timestamp >= oneDayAgo).length;
    const weeklyVersions = versions.filter((v) => v.metadata.timestamp >= oneWeekAgo).length;
    const monthlyVersions = versions.filter((v) => v.metadata.timestamp >= oneMonthAgo).length;

    // 存储使用统计
    const totalSize = versions.reduce((sum, v) => sum + v.metadata.size, 0);
    const compressedSize = totalSize * 0.7; // 假设压缩率

    return {
      totalVersions: versions.length,
      versionsByAuthor,
      versionsByType,
      averageChangeSize,
      largestChange,
      changeFrequency: {
        daily: dailyVersions,
        weekly: weeklyVersions,
        monthly: monthlyVersions,
      },
      storageUsage: {
        total: totalSize,
        compressed: compressedSize,
        compressionRatio: compressedSize / totalSize,
      },
    };
  }

  async validateVersionIntegrity(versionId: string): Promise<IntegrityCheckResult> {
    const version = await this.getVersion(versionId);
    if (!version) {
      return {
        isValid: false,
        issues: [
          {
            type: 'missing_content',
            severity: 'critical',
            description: 'Version not found',
          },
        ],
        warnings: [],
      };
    }

    const issues: IntegrityIssue[] = [];
    const warnings: IntegrityWarning[] = [];

    // 校验和检查
    const currentChecksum = this.calculateChecksum(version.contentSnapshot);
    if (currentChecksum !== version.metadata.checksum) {
      issues.push({
        type: 'checksum_mismatch',
        severity: 'high',
        description: 'Content checksum does not match stored checksum',
        repairAction: 'recompute_checksum',
      });
    }

    // 内容完整性检查
    if (!version.contentSnapshot || version.contentSnapshot.trim().length === 0) {
      issues.push({
        type: 'missing_content',
        severity: 'critical',
        description: 'Version content is empty or missing',
      });
    }

    // 大小一致性检查
    if (version.contentSnapshot.length !== version.metadata.size) {
      warnings.push({
        type: 'compatibility',
        message: 'Content size does not match metadata',
        suggestion: 'Update metadata to match actual content size',
      });
    }

    return {
      isValid: issues.filter((i) => i.severity === 'critical').length === 0,
      issues,
      warnings,
    };
  }

  async compressVersionHistory(
    draftId: string,
    options?: CompressionOptions
  ): Promise<CompressionResult> {
    const versions = await this.listVersions(draftId);
    const startTime = Date.now();
    let originalSize = 0;
    let compressedSize = 0;
    let versionsProcessed = 0;
    const errors: string[] = [];

    const strategy = options?.strategy || 'gzip';
    const keepVersions = options?.keepVersions || 5;

    // 保持最近的版本不压缩，压缩较旧的版本
    const versionsToCompress = versions
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .slice(keepVersions);

    for (const version of versionsToCompress) {
      try {
        if (!version.metadata.compressed) {
          const original = version.contentSnapshot;
          const compressed = this.compressContent(original, strategy);

          originalSize += original.length;
          compressedSize += compressed.length;

          version.contentSnapshot = compressed;
          version.metadata.compressed = true;

          await this.persistVersion(version);
          versionsProcessed++;
        }
      } catch (error) {
        errors.push(`Failed to compress version ${version.id}: ${error}`);
      }
    }

    const timeElapsed = Date.now() - startTime;

    return {
      originalSize,
      compressedSize,
      compressionRatio: originalSize > 0 ? compressedSize / originalSize : 1,
      versionsProcessed,
      timeElapsed,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async optimizeStorage(draftId: string): Promise<OptimizationResult> {
    const beforeStats = await this.getVersionStatistics(draftId);

    // 执行优化操作
    const operations: string[] = [];

    // 1. 压缩版本历史
    const compressionResult = await this.compressVersionHistory(draftId);
    operations.push(`Compressed ${compressionResult.versionsProcessed} versions`);

    // 2. 删除冗余数据（示例：删除过于频繁的小改动）
    const versions = await this.listVersions(draftId);
    let deletedVersions = 0;

    for (const version of versions) {
      if (
        version.changes.length === 1 &&
        version.changes[0].type === 'updated' &&
        (version.changes[0].newValue?.length || 0) < 50
      ) {
        // 删除小改动版本（除非是最新版本）
        if (version.versionNumber < Math.max(...versions.map((v) => v.versionNumber))) {
          await this.deleteVersion(version.id, 'system');
          deletedVersions++;
        }
      }
    }

    if (deletedVersions > 0) {
      operations.push(`Removed ${deletedVersions} redundant versions`);
    }

    const afterStats = await this.getVersionStatistics(draftId);

    const sizeSavings = beforeStats.storageUsage.total - afterStats.storageUsage.total;
    const percentageSavings =
      beforeStats.storageUsage.total > 0 ? (sizeSavings / beforeStats.storageUsage.total) * 100 : 0;

    return {
      before: {
        versions: beforeStats.totalVersions,
        totalSize: beforeStats.storageUsage.total,
        redundancy: 0, // 简化计算
      },
      after: {
        versions: afterStats.totalVersions,
        totalSize: afterStats.storageUsage.total,
        redundancy: 0,
      },
      savings: {
        size: sizeSavings,
        percentage: percentageSavings,
      },
      operations,
    };
  }

  // 私有辅助方法
  private inferChangeType(changes: VersionChange[]): ChangeType {
    if (changes.some((c) => c.type === 'created')) {
      return 'created';
    }
    if (changes.some((c) => c.type === 'deleted')) {
      return 'deleted';
    }
    if (changes.some((c) => c.type === 'merged')) {
      return 'merged';
    }
    if (changes.some((c) => c.type === 'restored')) {
      return 'restored';
    }
    return 'updated';
  }

  private compressContent(content: string, strategy: string = 'gzip'): string {
    // 简化的压缩实现
    // 实际应该使用真正的压缩算法
    return Buffer.from(content).toString('base64');
  }

  private decompressContent(compressedContent: string): string {
    // 简化的解压缩实现
    try {
      return Buffer.from(compressedContent, 'base64').toString('utf-8');
    } catch {
      return compressedContent; // 如果解压失败，返回原内容
    }
  }

  private calculateChecksum(content: string): string {
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private generateChangeMessage(changes: VersionChange[]): string {
    if (changes.length === 1) {
      return changes[0].description;
    }

    const grouped = this.groupChangesByType(changes);
    const parts: string[] = [];

    if (grouped.created.length > 0) {
      parts.push(`Created ${grouped.created.length} items`);
    }
    if (grouped.updated.length > 0) {
      parts.push(`Updated ${grouped.updated.length} items`);
    }
    if (grouped.deleted.length > 0) {
      parts.push(`Deleted ${grouped.deleted.length} items`);
    }

    return parts.join(', ') || 'Multiple changes';
  }

  private groupChangesByType(changes: VersionChange[]) {
    return {
      created: changes.filter((c) => c.type === 'created'),
      updated: changes.filter((c) => c.type === 'updated'),
      deleted: changes.filter((c) => c.type === 'deleted'),
      merged: changes.filter((c) => c.type === 'merged'),
      restored: changes.filter((c) => c.type === 'restored'),
    };
  }

  private calculateDifferences(content1: string, content2: string): VersionDifference[] {
    const differences: VersionDifference[] = [];

    // 简化的差异计算
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    const maxLines = Math.max(lines1.length, lines2.length);

    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';

      if (line1 !== line2) {
        if (!line1) {
          differences.push({
            type: 'added',
            path: `line_${i + 1}`,
            newValue: line2,
            context: { line: i + 1 },
          });
        } else if (!line2) {
          differences.push({
            type: 'deleted',
            path: `line_${i + 1}`,
            oldValue: line1,
            context: { line: i + 1 },
          });
        } else {
          differences.push({
            type: 'modified',
            path: `line_${i + 1}`,
            oldValue: line1,
            newValue: line2,
            context: { line: i + 1 },
          });
        }
      }
    }

    return differences;
  }

  private calculateComparisonStatistics(differences: VersionDifference[]) {
    const stats = {
      totalChanges: differences.length,
      addedLines: differences.filter((d) => d.type === 'added').length,
      deletedLines: differences.filter((d) => d.type === 'deleted').length,
      modifiedLines: differences.filter((d) => d.type === 'modified').length,
      addedSections: 0,
      deletedSections: 0,
      modifiedSections: 0,
    };

    // 简化的部分统计
    const sectionDiffs = differences.filter((d) => d.section);
    stats.addedSections = sectionDiffs.filter((d) => d.type === 'added').length;
    stats.deletedSections = sectionDiffs.filter((d) => d.type === 'deleted').length;
    stats.modifiedSections = sectionDiffs.filter((d) => d.type === 'modified').length;

    return stats;
  }

  private assessCompatibility(
    differences: VersionDifference[]
  ): 'compatible' | 'breaking' | 'major' | 'minor' {
    const deletions = differences.filter((d) => d.type === 'deleted').length;
    const modifications = differences.filter((d) => d.type === 'modified').length;

    if (deletions > 0) {
      return 'breaking';
    }
    if (modifications > 5) {
      return 'major';
    }
    if (modifications > 0) {
      return 'minor';
    }
    return 'compatible';
  }

  private generateUnifiedDiff(content1: string, content2: string): string {
    // 简化的 unified diff 生成
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');

    let diff = `--- Version A\n+++ Version B\n@@ -1,${lines1.length} +1,${lines2.length} @@\n`;

    const maxLines = Math.max(lines1.length, lines2.length);
    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i];
      const line2 = lines2[i];

      if (line1 === line2) {
        diff += ` ${line1 || ''}\n`;
      } else {
        if (line1 !== undefined) {
          diff += `-${line1}\n`;
        }
        if (line2 !== undefined) {
          diff += `+${line2}\n`;
        }
      }
    }

    return diff;
  }

  private generateStructuredDiff(differences: VersionDifference[]): StructuredDiff {
    const sections: StructuredDiff['sections'] = [];
    const sectionMap = new Map<string, (typeof sections)[0]>();

    let linesAdded = 0;
    let linesDeleted = 0;
    let linesModified = 0;

    for (const diff of differences) {
      const sectionName = diff.section || 'default';

      if (!sectionMap.has(sectionName)) {
        const section = { name: sectionName, changes: [] };
        sectionMap.set(sectionName, section);
        sections.push(section);
      }

      const section = sectionMap.get(sectionName)!;
      section.changes.push({
        type: diff.type,
        lineNumber: diff.context?.line || 0,
        content: (diff.newValue || diff.oldValue || '').toString(),
      });

      if (diff.type === 'added') {
        linesAdded++;
      } else if (diff.type === 'deleted') {
        linesDeleted++;
      } else if (diff.type === 'modified') {
        linesModified++;
      }
    }

    return {
      sections,
      metadata: {
        linesAdded,
        linesDeleted,
        linesModified,
      },
    };
  }

  private generateDiffSummary(differences: VersionDifference[]): DiffSummary {
    const changesByType: Record<ChangeType, number> = {
      created: 0,
      updated: differences.filter((d) => d.type === 'modified').length,
      deleted: differences.filter((d) => d.type === 'deleted').length,
      merged: 0,
      restored: 0,
    };

    const affectedSections = [
      ...new Set(differences.map((d) => d.section).filter(Boolean)),
    ] as string[];

    let impact: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (differences.length > 50) {
      impact = 'critical';
    } else if (differences.length > 20) {
      impact = 'high';
    } else if (differences.length > 5) {
      impact = 'medium';
    }

    return {
      totalChanges: differences.length,
      changesByType,
      affectedSections,
      impact,
    };
  }

  private detectDiffConflicts(differences: VersionDifference[]): DiffConflict[] {
    const conflicts: DiffConflict[] = [];

    // 检测冲突的逻辑
    const modifiedSections = new Set(
      differences.filter((d) => d.type === 'modified').map((d) => d.section)
    );

    for (const section of modifiedSections) {
      const sectionDiffs = differences.filter(
        (d) => d.section === section && d.type === 'modified'
      );
      if (sectionDiffs.length > 1) {
        conflicts.push({
          section: section || 'unknown',
          type: 'content',
          description: `Multiple modifications in section ${section}`,
          resolution: 'manual',
        });
      }
    }

    return conflicts;
  }

  private async getAuthorName(userId: string): Promise<string> {
    // 简化实现，实际应该从用户服务获取
    return userId;
  }

  private async getVersionTags(versionId: string): Promise<string[]> {
    const tags = Array.from(this.tags.values()).filter((t) => t.versionId === versionId);
    return tags.map((t) => t.name);
  }

  private assessChangeImpact(changes: VersionChange[]): 'low' | 'medium' | 'high' {
    if (changes.length > 10) {
      return 'high';
    }
    if (changes.length > 3) {
      return 'medium';
    }
    return 'low';
  }

  private analyzeRestoreRisks(
    currentVersion: Version | undefined,
    targetVersion: Version
  ): RestoreWarning[] {
    const warnings: RestoreWarning[] = [];

    if (!currentVersion) {
      warnings.push({
        type: 'data_loss',
        message: 'No current version found, restore may overwrite existing data',
        severity: 'high',
      });
      return warnings;
    }

    if (targetVersion.versionNumber < currentVersion.versionNumber) {
      warnings.push({
        type: 'data_loss',
        message: `Restoring to older version (${targetVersion.versionNumber}) will lose changes from versions ${targetVersion.versionNumber + 1}-${currentVersion.versionNumber}`,
        severity: 'high',
      });
    }

    return warnings;
  }

  private detectContentConflicts(version1: Version, version2: Version): VersionConflict[] {
    const conflicts: VersionConflict[] = [];

    // 简化的内容冲突检测
    if (version1.contentSnapshot !== version2.contentSnapshot) {
      conflicts.push({
        id: `conflict_${Date.now()}`,
        type: 'content',
        section: 'main',
        description: 'Content differs between versions',
        baseValue: version1.contentSnapshot,
        sourceValue: version1.contentSnapshot,
        targetValue: version2.contentSnapshot,
        severity: 'medium',
      });
    }

    return conflicts;
  }

  private detectStructureConflicts(version1: Version, version2: Version): VersionConflict[] {
    // 简化实现，实际应该比较文档结构
    return [];
  }

  private canAutoResolve(conflict: VersionConflict): boolean {
    return conflict.severity === 'low' && conflict.type === 'content';
  }

  private applyResolution(
    content: string,
    conflict: VersionConflict,
    resolution: ConflictResolution
  ): string {
    // 简化的冲突解决应用
    switch (resolution.strategy) {
      case 'use_source':
        return conflict.sourceValue;
      case 'use_target':
        return conflict.targetValue;
      case 'merge':
        return `${conflict.sourceValue}\n${conflict.targetValue}`;
      default:
        return content;
    }
  }

  private performThreeWayMerge(
    baseVersion: Version,
    sourceVersion: Version,
    strategy: MergeStrategy
  ): string {
    // 简化的三方合并
    return sourceVersion.contentSnapshot;
  }

  private inferTagType(tagName: string): VersionTag['type'] {
    if (tagName.match(/^v?\d+\.\d+\.\d+/)) {
      return 'release';
    }
    if (tagName.toLowerCase().includes('milestone')) {
      return 'milestone';
    }
    if (tagName.toLowerCase().includes('checkpoint')) {
      return 'checkpoint';
    }
    return 'custom';
  }

  private assessChangeComplexity(changes: VersionChange[]): 'low' | 'medium' | 'high' | 'critical' {
    if (changes.length > 20) {
      return 'critical';
    }
    if (changes.length > 10) {
      return 'high';
    }
    if (changes.length > 3) {
      return 'medium';
    }
    return 'low';
  }

  private assessChangeRisk(changes: VersionChange[]): 'low' | 'medium' | 'high' | 'critical' {
    const deletions = changes.filter((c) => c.type === 'deleted').length;
    const structuralChanges = changes.filter((c) => c.type === 'structure').length;

    if (deletions > 5 || structuralChanges > 3) {
      return 'critical';
    }
    if (deletions > 2 || structuralChanges > 1) {
      return 'high';
    }
    if (deletions > 0 || structuralChanges > 0) {
      return 'medium';
    }
    return 'low';
  }

  private calculateImpactScore(changes: VersionChange[]): number {
    let score = 0;

    for (const change of changes) {
      switch (change.type) {
        case 'created':
          score += 10;
          break;
        case 'updated':
          score += 5;
          break;
        case 'deleted':
          score += 15;
          break;
        case 'merged':
          score += 8;
          break;
        case 'restored':
          score += 12;
          break;
        default:
          score += 3;
          break;
      }
    }

    return Math.min(100, score);
  }

  private generateChangeRecommendations(changes: VersionChange[]): string[] {
    const recommendations: string[] = [];

    if (changes.length > 10) {
      recommendations.push('Consider breaking this change into smaller, more focused commits');
    }

    const deletions = changes.filter((c) => c.type === 'deleted');
    if (deletions.length > 0) {
      recommendations.push(
        'Review deleted content carefully to ensure no important information is lost'
      );
    }

    return recommendations;
  }

  private generateChangeWarnings(changes: VersionChange[]): string[] {
    const warnings: string[] = [];

    const deletions = changes.filter((c) => c.type === 'deleted');
    if (deletions.length > 5) {
      warnings.push('High number of deletions detected - risk of data loss');
    }

    return warnings;
  }

  private async persistVersion(version: Version): Promise<void> {
    // 实现版本持久化
    // 这里暂时只是内存存储，后续会在存储层实现真正的文件持久化
  }

  private async removeVersionFile(versionId: string): Promise<void> {
    // 实现版本文件删除
    // 这里暂时只是内存删除，后续会在存储层实现真正的文件删除
  }
}

export default DefaultVersionService;
