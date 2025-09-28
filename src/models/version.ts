/**
 * T014: Version 数据模型
 *
 * 版本历史实体，记录文档的变更历史
 * 支持增量存储、内容快照、变更追踪和版本对比
 */

// 变更类型枚举
export type ChangeType =
  | 'create' // 创建 - 初始文档创建
  | 'edit' // 编辑 - 内容修改
  | 'review' // 审查 - 审查状态变更
  | 'approve' // 批准 - 审查通过
  | 'reject' // 拒绝 - 审查拒绝
  | 'restore' // 恢复 - 版本回滚
  | 'merge' // 合并 - 分支合并
  | 'branch'; // 分支 - 创建分支

// 操作类型枚举
export type OperationType =
  | 'add' // 添加 - 新增内容
  | 'remove' // 删除 - 移除内容
  | 'replace' // 替换 - 修改内容
  | 'move'; // 移动 - 调整位置

// 变更来源枚举
export type ChangeSource =
  | 'user' // 用户操作
  | 'auto' // 自动操作（如自动保存）
  | 'import' // 导入操作
  | 'merge' // 合并操作
  | 'system'; // 系统操作

// 版本变更详情接口
export interface VersionChange {
  path: string; // 变更路径，如 "sections.0.content", "metadata.title"
  operation: OperationType; // 操作类型
  oldValue?: any; // 原值（删除和替换操作）
  newValue?: any; // 新值（添加和替换操作）
  diffSize: number; // 变更大小（字符数）
  changeDescription?: string; // 变更描述
  lineStart?: number; // 起始行号
  lineEnd?: number; // 结束行号
  columnStart?: number; // 起始列号
  columnEnd?: number; // 结束列号
}

// 版本元数据接口
export interface VersionMetadata {
  source: ChangeSource; // 变更来源
  userAgent?: string; // 用户代理字符串
  sessionId?: string; // 会话ID
  parentVersions: string[]; // 父版本ID列表（合并场景下可能有多个）
  tags: string[]; // 版本标签
  branch?: string; // 分支名称
  mergeInfo?: MergeInfo; // 合并信息
  statistics: VersionStatistics; // 版本统计信息
  checksum: string; // 内容校验和
}

// 合并信息接口
export interface MergeInfo {
  strategy: 'auto' | 'manual' | 'ours' | 'theirs'; // 合并策略
  conflicts: ConflictInfo[]; // 冲突信息
  resolvedBy?: string; // 冲突解决者
  resolvedAt?: Date; // 冲突解决时间
}

// 冲突信息接口
export interface ConflictInfo {
  path: string; // 冲突路径
  ourValue: any; // 我们的值
  theirValue: any; // 他们的值
  resolution: any; // 解决方案
  resolvedManually: boolean; // 是否手动解决
}

// 版本统计信息接口
export interface VersionStatistics {
  addedLines: number; // 新增行数
  deletedLines: number; // 删除行数
  modifiedLines: number; // 修改行数
  addedChars: number; // 新增字符数
  deletedChars: number; // 删除字符数
  sectionsAdded: number; // 新增章节数
  sectionsDeleted: number; // 删除章节数
  sectionsModified: number; // 修改章节数
  imagesAdded: number; // 新增图片数
  diagramsAdded: number; // 新增图表数
}

// 版本接口
export interface Version {
  id: string; // 版本ID
  draftId: string; // 关联文档ID
  versionNumber: number; // 版本号（自动递增）
  changeType: ChangeType; // 变更类型
  changes: VersionChange[]; // 具体变更内容列表
  createdAt: Date; // 创建时间
  createdBy: string; // 变更作者ID
  createdByName: string; // 变更作者名称
  commitMessage?: string; // 变更说明
  contentSnapshot: string; // 内容快照（压缩存储）
  contentSize: number; // 内容大小（字节）
  metadata: VersionMetadata; // 版本元数据
  isSnapshot: boolean; // 是否为快照版本（重要版本标记）
  expiresAt?: Date; // 过期时间（临时版本）
}

// 版本对比结果接口
export interface VersionDiff {
  fromVersion: number; // 起始版本
  toVersion: number; // 目标版本
  summary: DiffSummary; // 对比摘要
  changes: DiffChange[]; // 详细变更
  statistics: DiffStatistics; // 对比统计
  generatedAt: Date; // 生成时间
}

// 对比摘要接口
export interface DiffSummary {
  totalChanges: number; // 总变更数
  sectionsChanged: string[]; // 变更的章节
  majorChanges: string[]; // 重大变更描述
  contributors: string[]; // 贡献者列表
  timeSpan: number; // 时间跨度（毫秒）
}

// 对比变更接口
export interface DiffChange {
  path: string; // 变更路径
  type: 'added' | 'removed' | 'modified'; // 变更类型
  oldContent?: string; // 原内容
  newContent?: string; // 新内容
  context?: string; // 上下文
  significance: 'minor' | 'major' | 'critical'; // 重要性
}

// 对比统计接口
export interface DiffStatistics {
  addedContent: number; // 新增内容量（字符）
  removedContent: number; // 删除内容量（字符）
  modifiedContent: number; // 修改内容量（字符）
  netChange: number; // 净变更量（字符）
  changeRatio: number; // 变更比例（0-1）
}

// 版本查询选项接口
export interface VersionQueryOptions {
  limit?: number; // 限制数量
  offset?: number; // 偏移量
  since?: Date; // 起始时间
  until?: Date; // 结束时间
  author?: string; // 作者筛选
  changeType?: ChangeType; // 变更类型筛选
  tags?: string[]; // 标签筛选
  includeContent?: boolean; // 是否包含内容
  includeStatistics?: boolean; // 是否包含统计信息
}

// 版本恢复选项接口
export interface RestoreOptions {
  createBackup: boolean; // 是否创建备份
  skipValidation: boolean; // 是否跳过验证
  preserveMetadata: boolean; // 是否保留元数据
  notifyUsers: boolean; // 是否通知用户
  reason?: string; // 恢复原因
}

// Version 工具类
export class VersionManager {
  /**
   * 创建新版本
   */
  static createVersion(
    draftId: string,
    versionNumber: number,
    changeType: ChangeType,
    changes: VersionChange[],
    contentSnapshot: string,
    createdBy: string,
    createdByName: string,
    commitMessage?: string
  ): Version {
    const now = new Date();
    const statistics = this.calculateStatistics(changes);

    return {
      id: `version-${draftId}-${versionNumber}`,
      draftId,
      versionNumber,
      changeType,
      changes,
      createdAt: now,
      createdBy,
      createdByName,
      commitMessage,
      contentSnapshot: this.compressContent(contentSnapshot),
      contentSize: contentSnapshot.length,
      metadata: {
        source: 'user',
        parentVersions: versionNumber > 1 ? [`version-${draftId}-${versionNumber - 1}`] : [],
        tags: [],
        statistics,
        checksum: this.calculateChecksum(contentSnapshot),
      },
      isSnapshot: this.isSnapshotVersion(changeType),
      expiresAt: this.calculateExpiryDate(changeType),
    };
  }

  /**
   * 计算变更统计
   */
  private static calculateStatistics(changes: VersionChange[]): VersionStatistics {
    const stats: VersionStatistics = {
      addedLines: 0,
      deletedLines: 0,
      modifiedLines: 0,
      addedChars: 0,
      deletedChars: 0,
      sectionsAdded: 0,
      sectionsDeleted: 0,
      sectionsModified: 0,
      imagesAdded: 0,
      diagramsAdded: 0,
    };

    for (const change of changes) {
      // 统计字符变更
      if (change.operation === 'add' && change.newValue) {
        stats.addedChars += this.getContentLength(change.newValue);
      } else if (change.operation === 'remove' && change.oldValue) {
        stats.deletedChars += this.getContentLength(change.oldValue);
      } else if (change.operation === 'replace') {
        if (change.oldValue) {
          stats.deletedChars += this.getContentLength(change.oldValue);
        }
        if (change.newValue) {
          stats.addedChars += this.getContentLength(change.newValue);
        }
      }

      // 统计章节变更
      if (change.path.startsWith('sections.')) {
        if (change.operation === 'add') {
          stats.sectionsAdded++;
        } else if (change.operation === 'remove') {
          stats.sectionsDeleted++;
        } else if (change.operation === 'replace') {
          stats.sectionsModified++;
        }
      }

      // 统计图表和图片
      if (change.path.includes('diagram') && change.operation === 'add') {
        stats.diagramsAdded++;
      }
      if (change.path.includes('image') && change.operation === 'add') {
        stats.imagesAdded++;
      }
    }

    return stats;
  }

  /**
   * 获取内容长度
   */
  private static getContentLength(content: any): number {
    if (typeof content === 'string') {
      return content.length;
    } else if (content && typeof content === 'object') {
      return JSON.stringify(content).length;
    }
    return 0;
  }

  /**
   * 判断是否为快照版本
   */
  private static isSnapshotVersion(changeType: ChangeType): boolean {
    return ['create', 'approve', 'restore', 'merge'].includes(changeType);
  }

  /**
   * 计算过期时间
   */
  private static calculateExpiryDate(changeType: ChangeType): Date | undefined {
    // 只有自动保存的版本有过期时间
    if (changeType === 'edit') {
      const expires = new Date();
      expires.setDate(expires.getDate() + 30); // 30天后过期
      return expires;
    }
    return undefined;
  }

  /**
   * 压缩内容
   */
  private static compressContent(content: string): string {
    // 简化的压缩实现，实际项目中应使用专业压缩库
    // 这里只是示例，返回base64编码
    return Buffer.from(content, 'utf8').toString('base64');
  }

  /**
   * 解压内容
   */
  static decompressContent(compressedContent: string): string {
    try {
      return Buffer.from(compressedContent, 'base64').toString('utf8');
    } catch (error) {
      throw new Error('Failed to decompress content');
    }
  }

  /**
   * 计算内容校验和
   */
  private static calculateChecksum(content: string): string {
    // 简化的校验和实现，实际项目中应使用专业哈希算法
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // 转为32位整数
    }
    return hash.toString(16);
  }

  /**
   * 对比两个版本
   */
  static compareVersions(
    fromVersion: Version,
    toVersion: Version,
    includeContent = true
  ): VersionDiff {
    const fromContent = this.decompressContent(fromVersion.contentSnapshot);
    const toContent = this.decompressContent(toVersion.contentSnapshot);

    const changes: DiffChange[] = [];

    if (includeContent) {
      // 简化的内容对比实现
      if (fromContent !== toContent) {
        changes.push({
          path: 'content',
          type: 'modified',
          oldContent: fromContent,
          newContent: toContent,
          significance: this.assessChangeSignificance(fromContent, toContent),
        });
      }
    }

    // 合并两个版本之间的所有变更
    const allChanges = this.collectChangesBetweenVersions(fromVersion, toVersion);
    const statistics = this.calculateDiffStatistics(fromContent, toContent);

    return {
      fromVersion: fromVersion.versionNumber,
      toVersion: toVersion.versionNumber,
      summary: {
        totalChanges: allChanges.length,
        sectionsChanged: this.extractChangedSections(allChanges),
        majorChanges: this.extractMajorChanges(allChanges),
        contributors: this.extractContributors(fromVersion, toVersion),
        timeSpan: toVersion.createdAt.getTime() - fromVersion.createdAt.getTime(),
      },
      changes,
      statistics,
      generatedAt: new Date(),
    };
  }

  /**
   * 评估变更重要性
   */
  private static assessChangeSignificance(
    oldContent: string,
    newContent: string
  ): 'minor' | 'major' | 'critical' {
    const oldLength = oldContent.length;
    const newLength = newContent.length;
    const changeRatio = Math.abs(newLength - oldLength) / Math.max(oldLength, 1);

    if (changeRatio > 0.5) {
      return 'critical';
    }
    if (changeRatio > 0.2) {
      return 'major';
    }
    return 'minor';
  }

  /**
   * 收集版本之间的变更
   */
  private static collectChangesBetweenVersions(
    fromVersion: Version,
    toVersion: Version
  ): VersionChange[] {
    // 实际实现应该收集从fromVersion到toVersion之间所有版本的变更
    return toVersion.changes;
  }

  /**
   * 提取变更的章节
   */
  private static extractChangedSections(changes: VersionChange[]): string[] {
    const sections = new Set<string>();
    for (const change of changes) {
      if (change.path.startsWith('sections.')) {
        const sectionMatch = change.path.match(/sections\.(\d+)/);
        if (sectionMatch) {
          sections.add(`section-${sectionMatch[1]}`);
        }
      }
    }
    return Array.from(sections);
  }

  /**
   * 提取重大变更
   */
  private static extractMajorChanges(changes: VersionChange[]): string[] {
    return changes
      .filter((change) => change.diffSize > 1000) // 大于1000字符的变更
      .map((change) => change.changeDescription || `${change.operation} at ${change.path}`)
      .slice(0, 5); // 最多5个重大变更
  }

  /**
   * 提取贡献者
   */
  private static extractContributors(fromVersion: Version, toVersion: Version): string[] {
    const contributors = new Set<string>();
    contributors.add(fromVersion.createdByName);
    contributors.add(toVersion.createdByName);
    return Array.from(contributors);
  }

  /**
   * 计算对比统计
   */
  private static calculateDiffStatistics(oldContent: string, newContent: string): DiffStatistics {
    const oldLength = oldContent.length;
    const newLength = newContent.length;

    return {
      addedContent: Math.max(0, newLength - oldLength),
      removedContent: Math.max(0, oldLength - newLength),
      modifiedContent: Math.min(oldLength, newLength),
      netChange: newLength - oldLength,
      changeRatio: Math.abs(newLength - oldLength) / Math.max(oldLength, 1),
    };
  }

  /**
   * 恢复到指定版本
   */
  static restoreToVersion(
    currentVersion: Version,
    targetVersion: Version,
    restoredBy: string,
    restoredByName: string,
    options: RestoreOptions = {
      createBackup: true,
      skipValidation: false,
      preserveMetadata: false,
      notifyUsers: true,
    }
  ): Version {
    const targetContent = this.decompressContent(targetVersion.contentSnapshot);

    // 创建恢复变更记录
    const restoreChanges: VersionChange[] = [
      {
        path: 'content',
        operation: 'replace',
        oldValue: this.decompressContent(currentVersion.contentSnapshot),
        newValue: targetContent,
        diffSize: Math.abs(targetContent.length - currentVersion.contentSize),
        changeDescription: `Restored to version ${targetVersion.versionNumber}`,
      },
    ];

    // 创建新版本
    const newVersion = this.createVersion(
      currentVersion.draftId,
      currentVersion.versionNumber + 1,
      'restore',
      restoreChanges,
      targetContent,
      restoredBy,
      restoredByName,
      options.reason || `Restored to version ${targetVersion.versionNumber}`
    );

    // 添加恢复元数据
    newVersion.metadata.parentVersions = [currentVersion.id];
    newVersion.metadata.tags.push('restore', `from-v${targetVersion.versionNumber}`);

    return newVersion;
  }

  /**
   * 验证版本数据
   */
  static validateVersion(version: Partial<Version>): string[] {
    const errors: string[] = [];

    if (!version.draftId) {
      errors.push('关联文档ID不能为空');
    }

    if (!version.versionNumber || version.versionNumber < 1) {
      errors.push('版本号必须为正整数');
    }

    if (!version.changes || version.changes.length === 0) {
      errors.push('版本变更记录不能为空');
    }

    if (!version.contentSnapshot) {
      errors.push('内容快照不能为空');
    }

    if (version.commitMessage && version.commitMessage.length > 500) {
      errors.push('提交信息不能超过500字符');
    }

    if (version.expiresAt && version.expiresAt <= new Date()) {
      errors.push('过期时间不能早于当前时间');
    }

    return errors;
  }

  /**
   * 清理过期版本
   */
  static findExpiredVersions(versions: Version[]): Version[] {
    const now = new Date();
    return versions.filter((version) => version.expiresAt && version.expiresAt <= now);
  }

  /**
   * 获取版本摘要信息
   */
  static getVersionSummary(version: Version): string {
    const { statistics } = version.metadata;
    const parts: string[] = [];

    if (statistics.sectionsAdded > 0) {
      parts.push(`+${statistics.sectionsAdded} 章节`);
    }
    if (statistics.sectionsDeleted > 0) {
      parts.push(`-${statistics.sectionsDeleted} 章节`);
    }
    if (statistics.sectionsModified > 0) {
      parts.push(`~${statistics.sectionsModified} 章节`);
    }
    if (statistics.diagramsAdded > 0) {
      parts.push(`+${statistics.diagramsAdded} 图表`);
    }

    const charChange = statistics.addedChars - statistics.deletedChars;
    if (charChange > 0) {
      parts.push(`+${charChange} 字符`);
    } else if (charChange < 0) {
      parts.push(`${charChange} 字符`);
    }

    return parts.length > 0 ? parts.join(', ') : '无变更';
  }
}
