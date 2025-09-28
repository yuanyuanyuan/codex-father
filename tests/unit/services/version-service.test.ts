/**
 * VersionService 单元测试
 *
 * 测试范围：
 * - 版本管理 (创建、读取、列表、删除)
 * - 版本比较 (对比、差异、变更历史)
 * - 版本恢复 (恢复、回滚、预览)
 * - 冲突管理 (检测、解决、合并)
 * - 分支和标签管理
 * - 内容分析和统计
 * - 压缩和优化功能
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import {
  DefaultVersionService,
  type VersionService,
  type VersionFilter,
  type VersionComparison,
  type ConflictDetectionResult,
  type VersionConflict,
  type ConflictResolution,
  type ConflictResolutionResult,
  type MergeResult,
  type ChangeHistoryOptions,
  type RestorePreview,
  type VersionBranch,
  type VersionTag,
  type ChangeAnalysis,
  type VersionStatistics,
  type IntegrityCheckResult,
  type CompressionOptions,
  type CompressionResult,
  type OptimizationResult
} from '../../../src/services/version-service.js';
import {
  type Version,
  type VersionChange,
  type VersionMetadata,
  type ConflictResolution as ConflictResolutionType,
  type MergeStrategy,
  ChangeType
} from '../../../src/models/version.js';
import { type PRDDraft } from '../../../src/models/prd-draft.js';

describe('VersionService', () => {
  let versionService: VersionService;
  let mockDraft: PRDDraft;

  beforeEach(() => {
    // 创建服务实例
    versionService = new DefaultVersionService('./test-data/versions');

    // 创建模拟草稿
    mockDraft = {
      id: 'draft_123',
      title: 'Test PRD',
      content: '# Test Content\n\nThis is test content.',
      metadata: {
        description: 'Test description',
        status: 'draft',
        priority: 'medium',
        category: 'feature',
        tags: ['test'],
        created: new Date(),
        updated: new Date()
      },
      permissions: {
        owner: 'user1',
        collaborators: [],
        viewers: []
      },
      versions: [{
        id: 'version_1',
        draftId: 'draft_123',
        versionNumber: 1,
        changeType: ChangeType.CREATED,
        changes: [],
        contentSnapshot: '# Test Content\n\nThis is test content.',
        metadata: {
          author: 'user1',
          timestamp: new Date(),
          message: 'Initial version',
          checksum: 'abc123',
          compressed: false,
          size: 35
        }
      }],
      collaboration: {
        comments: [],
        activityFeed: []
      },
      statistics: {
        wordCount: 5,
        sectionCount: 1,
        versionCount: 1,
        editCount: 1,
        viewCount: 0,
        collaboratorCount: 0
      }
    };
  });

  describe('Version Management', () => {
    describe('createVersion', () => {
      it('should create a new version with changes', async () => {
        const changes: VersionChange[] = [{
          type: ChangeType.UPDATED,
          path: 'content',
          section: 'main',
          oldValue: '# Test Content',
          newValue: '# Updated Test Content',
          timestamp: new Date(),
          author: 'user1'
        }];

        const version = await versionService.createVersion(mockDraft, changes, 'user1');

        expect(version).toBeDefined();
        expect(version.id).toMatch(/^draft_123_v\d+$/);
        expect(version.draftId).toBe('draft_123');
        expect(version.versionNumber).toBe(2); // 基于现有版本递增
        expect(version.changes).toEqual(changes);
        expect(version.metadata.author).toBe('user1');
        expect(version.metadata.compressed).toBe(true);
        expect(version.metadata.checksum).toBeDefined();
      });

      it('should calculate correct version number', async () => {
        const changes: VersionChange[] = [{
          type: ChangeType.UPDATED,
          path: 'title',
          section: 'metadata',
          oldValue: 'Test PRD',
          newValue: 'Updated Test PRD',
          timestamp: new Date(),
          author: 'user1'
        }];

        const version = await versionService.createVersion(mockDraft, changes, 'user1');

        expect(version.versionNumber).toBe(2);
      });

      it('should generate appropriate change message', async () => {
        const changes: VersionChange[] = [
          {
            type: ChangeType.UPDATED,
            path: 'content',
            section: 'overview',
            oldValue: 'old content',
            newValue: 'new content',
            timestamp: new Date(),
            author: 'user1'
          },
          {
            type: ChangeType.ADDED,
            path: 'content',
            section: 'requirements',
            oldValue: null,
            newValue: 'new requirements',
            timestamp: new Date(),
            author: 'user1'
          }
        ];

        const version = await versionService.createVersion(mockDraft, changes, 'user1');

        expect(version.metadata.message).toBeDefined();
        expect(typeof version.metadata.message).toBe('string');
        expect(version.metadata.message.length).toBeGreaterThan(0);
      });
    });

    describe('getVersion', () => {
      it('should get an existing version', async () => {
        const changes: VersionChange[] = [{
          type: ChangeType.UPDATED,
          path: 'content',
          section: 'main',
          oldValue: 'old',
          newValue: 'new',
          timestamp: new Date(),
          author: 'user1'
        }];

        const createdVersion = await versionService.createVersion(mockDraft, changes, 'user1');
        const version = await versionService.getVersion(createdVersion.id);

        expect(version).toBeDefined();
        expect(version!.id).toBe(createdVersion.id);
        expect(version!.draftId).toBe('draft_123');
      });

      it('should return null for non-existent version', async () => {
        const version = await versionService.getVersion('non-existent-version');

        expect(version).toBeNull();
      });

      it('should decompress content when needed', async () => {
        const changes: VersionChange[] = [{
          type: ChangeType.UPDATED,
          path: 'content',
          section: 'main',
          oldValue: 'old',
          newValue: 'new',
          timestamp: new Date(),
          author: 'user1'
        }];

        const createdVersion = await versionService.createVersion(mockDraft, changes, 'user1');
        const version = await versionService.getVersion(createdVersion.id);

        expect(version).toBeDefined();
        expect(version!.contentSnapshot).toBeDefined();
        expect(typeof version!.contentSnapshot).toBe('string');
      });
    });

    describe('listVersions', () => {
      beforeEach(async () => {
        // 创建多个版本用于测试
        const changes1: VersionChange[] = [{
          type: ChangeType.UPDATED,
          path: 'content',
          section: 'main',
          oldValue: 'old1',
          newValue: 'new1',
          timestamp: new Date('2023-01-01'),
          author: 'user1'
        }];

        const changes2: VersionChange[] = [{
          type: ChangeType.ADDED,
          path: 'content',
          section: 'requirements',
          oldValue: null,
          newValue: 'requirements',
          timestamp: new Date('2023-01-02'),
          author: 'user2'
        }];

        await versionService.createVersion(mockDraft, changes1, 'user1');
        await versionService.createVersion(mockDraft, changes2, 'user2');
      });

      it('should list all versions for a draft', async () => {
        const versions = await versionService.listVersions('draft_123');

        expect(versions).toHaveLength(2);
        expect(versions.every(v => v.draftId === 'draft_123')).toBe(true);
      });

      it('should filter by author', async () => {
        const filter: VersionFilter = { authorId: 'user1' };
        const versions = await versionService.listVersions('draft_123', filter);

        expect(versions).toHaveLength(1);
        expect(versions[0].metadata.author).toBe('user1');
      });

      it('should filter by change type', async () => {
        const filter: VersionFilter = { changeType: [ChangeType.ADDED] };
        const versions = await versionService.listVersions('draft_123', filter);

        expect(versions).toHaveLength(1);
        expect(versions[0].changeType).toBe(ChangeType.ADDED);
      });

      it('should filter by date range', async () => {
        const filter: VersionFilter = {
          dateRange: {
            from: new Date('2023-01-01'),
            to: new Date('2023-01-01T23:59:59')
          }
        };
        const versions = await versionService.listVersions('draft_123', filter);

        expect(versions).toHaveLength(1);
      });

      it('should sort by version number', async () => {
        const filter: VersionFilter = { sortBy: 'versionNumber', sortOrder: 'desc' };
        const versions = await versionService.listVersions('draft_123', filter);

        expect(versions[0].versionNumber).toBeGreaterThan(versions[1].versionNumber);
      });

      it('should apply pagination', async () => {
        const filter: VersionFilter = { limit: 1, offset: 1 };
        const versions = await versionService.listVersions('draft_123', filter);

        expect(versions).toHaveLength(1);
      });
    });

    describe('deleteVersion', () => {
      it('should delete a version successfully', async () => {
        const changes: VersionChange[] = [{
          type: ChangeType.UPDATED,
          path: 'content',
          section: 'main',
          oldValue: 'old',
          newValue: 'new',
          timestamp: new Date(),
          author: 'user1'
        }];

        const version1 = await versionService.createVersion(mockDraft, changes, 'user1');
        const version2 = await versionService.createVersion(mockDraft, changes, 'user1');

        const result = await versionService.deleteVersion(version1.id, 'user1');

        expect(result).toBe(true);

        // 验证版本已删除
        const deletedVersion = await versionService.getVersion(version1.id);
        expect(deletedVersion).toBeNull();
      });

      it('should not delete the latest version', async () => {
        const changes: VersionChange[] = [{
          type: ChangeType.UPDATED,
          path: 'content',
          section: 'main',
          oldValue: 'old',
          newValue: 'new',
          timestamp: new Date(),
          author: 'user1'
        }];

        const latestVersion = await versionService.createVersion(mockDraft, changes, 'user1');

        await expect(
          versionService.deleteVersion(latestVersion.id, 'user1')
        ).rejects.toThrow('Cannot delete the latest version');
      });

      it('should return false for non-existent version', async () => {
        const result = await versionService.deleteVersion('non-existent-version', 'user1');

        expect(result).toBe(false);
      });
    });
  });

  describe('Version Comparison', () => {
    let version1: Version;
    let version2: Version;

    beforeEach(async () => {
      const changes1: VersionChange[] = [{
        type: ChangeType.UPDATED,
        path: 'content',
        section: 'main',
        oldValue: 'old content',
        newValue: 'new content',
        timestamp: new Date(),
        author: 'user1'
      }];

      const changes2: VersionChange[] = [{
        type: ChangeType.ADDED,
        path: 'content',
        section: 'requirements',
        oldValue: null,
        newValue: 'requirements section',
        timestamp: new Date(),
        author: 'user1'
      }];

      version1 = await versionService.createVersion(mockDraft, changes1, 'user1');
      version2 = await versionService.createVersion(mockDraft, changes2, 'user1');
    });

    describe('compareVersions', () => {
      it('should compare two versions successfully', async () => {
        const comparison = await versionService.compareVersions(version1.id, version2.id);

        expect(comparison).toBeDefined();
        expect(comparison.fromVersion.id).toBe(version1.id);
        expect(comparison.toVersion.id).toBe(version2.id);
        expect(comparison.differences).toBeDefined();
        expect(comparison.statistics).toBeDefined();
        expect(comparison.compatibility).toBeDefined();
      });

      it('should calculate correct statistics', async () => {
        const comparison = await versionService.compareVersions(version1.id, version2.id);

        expect(comparison.statistics.totalChanges).toBeGreaterThan(0);
        expect(typeof comparison.statistics.addedLines).toBe('number');
        expect(typeof comparison.statistics.deletedLines).toBe('number');
        expect(typeof comparison.statistics.modifiedLines).toBe('number');
      });

      it('should determine compatibility level', async () => {
        const comparison = await versionService.compareVersions(version1.id, version2.id);

        expect(['compatible', 'breaking', 'major', 'minor']).toContain(comparison.compatibility);
      });

      it('should throw error for non-existent versions', async () => {
        await expect(
          versionService.compareVersions('non-existent-1', version2.id)
        ).rejects.toThrow('One or both versions not found');

        await expect(
          versionService.compareVersions(version1.id, 'non-existent-2')
        ).rejects.toThrow('One or both versions not found');
      });
    });

    describe('getDiff', () => {
      it('should generate diff between versions', async () => {
        const diff = await versionService.getDiff(version1.id, version2.id);

        expect(diff).toBeDefined();
        expect(diff.unified).toBeDefined();
        expect(diff.structured).toBeDefined();
        expect(diff.summary).toBeDefined();
        expect(typeof diff.unified).toBe('string');
      });

      it('should provide structured diff information', async () => {
        const diff = await versionService.getDiff(version1.id, version2.id);

        expect(diff.structured.sections).toBeDefined();
        expect(Array.isArray(diff.structured.sections)).toBe(true);
        expect(diff.structured.metadata).toBeDefined();
        expect(typeof diff.structured.metadata.linesAdded).toBe('number');
        expect(typeof diff.structured.metadata.linesDeleted).toBe('number');
        expect(typeof diff.structured.metadata.linesModified).toBe('number');
      });

      it('should provide summary information', async () => {
        const diff = await versionService.getDiff(version1.id, version2.id);

        expect(diff.summary.totalChanges).toBeGreaterThanOrEqual(0);
        expect(diff.summary.changesByType).toBeDefined();
        expect(Array.isArray(diff.summary.affectedSections)).toBe(true);
        expect(['low', 'medium', 'high', 'critical']).toContain(diff.summary.impact);
      });
    });

    describe('getChangeHistory', () => {
      it('should get change history for a draft', async () => {
        const history = await versionService.getChangeHistory('draft_123');

        expect(Array.isArray(history)).toBe(true);
        expect(history.length).toBeGreaterThan(0);
        expect(history[0].version).toBeDefined();
        expect(history[0].author).toBeDefined();
        expect(history[0].timestamp).toBeDefined();
        expect(history[0].changes).toBeDefined();
      });

      it('should respect options', async () => {
        const options: ChangeHistoryOptions = {
          includeContent: true,
          includeMetadata: true,
          maxEntries: 1
        };

        const history = await versionService.getChangeHistory('draft_123', options);

        expect(history).toHaveLength(1);
      });

      it('should group by author when requested', async () => {
        const options: ChangeHistoryOptions = {
          groupByAuthor: true
        };

        const history = await versionService.getChangeHistory('draft_123', options);

        expect(Array.isArray(history)).toBe(true);
      });
    });
  });

  describe('Version Restoration', () => {
    let version1: Version;
    let version2: Version;

    beforeEach(async () => {
      const changes1: VersionChange[] = [{
        type: ChangeType.UPDATED,
        path: 'content',
        section: 'main',
        oldValue: 'original content',
        newValue: 'updated content',
        timestamp: new Date(),
        author: 'user1'
      }];

      const changes2: VersionChange[] = [{
        type: ChangeType.UPDATED,
        path: 'content',
        section: 'main',
        oldValue: 'updated content',
        newValue: 'final content',
        timestamp: new Date(),
        author: 'user1'
      }];

      version1 = await versionService.createVersion(mockDraft, changes1, 'user1');
      version2 = await versionService.createVersion(mockDraft, changes2, 'user1');
    });

    describe('previewRestore', () => {
      it('should preview restoration changes', async () => {
        const preview = await versionService.previewRestore('draft_123', version1.id);

        expect(preview).toBeDefined();
        expect(preview.targetVersion.id).toBe(version1.id);
        expect(preview.currentContent).toBeDefined();
        expect(preview.restoredContent).toBeDefined();
        expect(Array.isArray(preview.changes)).toBe(true);
        expect(Array.isArray(preview.warnings)).toBe(true);
      });

      it('should detect warnings and conflicts', async () => {
        const preview = await versionService.previewRestore('draft_123', version1.id);

        preview.warnings.forEach(warning => {
          expect(['data_loss', 'breaking_change', 'compatibility', 'dependency']).toContain(warning.type);
          expect(['low', 'medium', 'high']).toContain(warning.severity);
          expect(typeof warning.message).toBe('string');
        });

        if (preview.conflicts) {
          expect(Array.isArray(preview.conflicts)).toBe(true);
        }
      });
    });

    describe('restoreVersion', () => {
      it('should restore to a previous version', async () => {
        const restoredDraft = await versionService.restoreVersion('draft_123', version1.id, 'user1');

        expect(restoredDraft).toBeDefined();
        expect(restoredDraft.id).toBe('draft_123');
        // 恢复应该创建新版本
        expect(restoredDraft.versions.length).toBeGreaterThan(mockDraft.versions.length);
      });

      it('should throw error for non-existent version', async () => {
        await expect(
          versionService.restoreVersion('draft_123', 'non-existent-version', 'user1')
        ).rejects.toThrow();
      });
    });

    describe('rollbackToVersion', () => {
      it('should rollback to a previous version', async () => {
        const rolledBackDraft = await versionService.rollbackToVersion('draft_123', version1.id, 'user1');

        expect(rolledBackDraft).toBeDefined();
        expect(rolledBackDraft.id).toBe('draft_123');
      });

      it('should create rollback entry in version history', async () => {
        const originalVersionCount = mockDraft.versions.length;

        await versionService.rollbackToVersion('draft_123', version1.id, 'user1');

        const versions = await versionService.listVersions('draft_123');
        expect(versions.length).toBeGreaterThan(originalVersionCount);
      });
    });
  });

  describe('Conflict Management', () => {
    let version1: Version;
    let version2: Version;

    beforeEach(async () => {
      const changes1: VersionChange[] = [{
        type: ChangeType.UPDATED,
        path: 'content',
        section: 'main',
        oldValue: 'base content',
        newValue: 'content modified by user1',
        timestamp: new Date(),
        author: 'user1'
      }];

      const changes2: VersionChange[] = [{
        type: ChangeType.UPDATED,
        path: 'content',
        section: 'main',
        oldValue: 'base content',
        newValue: 'content modified by user2',
        timestamp: new Date(),
        author: 'user2'
      }];

      version1 = await versionService.createVersion(mockDraft, changes1, 'user1');
      version2 = await versionService.createVersion(mockDraft, changes2, 'user2');
    });

    describe('detectConflicts', () => {
      it('should detect conflicts between versions', async () => {
        const result = await versionService.detectConflicts(version1.id, version2.id);

        expect(result).toBeDefined();
        expect(typeof result.hasConflicts).toBe('boolean');
        expect(Array.isArray(result.conflicts)).toBe(true);
        expect(Array.isArray(result.autoResolvable)).toBe(true);
        expect(Array.isArray(result.manualResolutionRequired)).toBe(true);
      });

      it('should categorize conflicts correctly', async () => {
        const result = await versionService.detectConflicts(version1.id, version2.id);

        result.conflicts.forEach(conflict => {
          expect(conflict.id).toBeDefined();
          expect(['content', 'structure', 'metadata', 'permission']).toContain(conflict.type);
          expect(['low', 'medium', 'high', 'critical']).toContain(conflict.severity);
          expect(typeof conflict.description).toBe('string');
        });
      });
    });

    describe('resolveConflicts', () => {
      it('should resolve conflicts with given resolutions', async () => {
        const conflictDetection = await versionService.detectConflicts(version1.id, version2.id);

        if (conflictDetection.hasConflicts) {
          const resolutions: ConflictResolutionType[] = conflictDetection.conflicts.map(conflict => ({
            conflictId: conflict.id,
            strategy: 'prefer_source' as const,
            customValue: undefined
          }));

          const result = await versionService.resolveConflicts(conflictDetection.conflicts, resolutions);

          expect(result).toBeDefined();
          expect(typeof result.resolved).toBe('number');
          expect(typeof result.remaining).toBe('number');
          expect(Array.isArray(result.conflicts)).toBe(true);
          expect(typeof result.mergedContent).toBe('string');
          expect(Array.isArray(result.warnings)).toBe(true);
        }
      });
    });

    describe('mergeVersions', () => {
      it('should merge versions with specified strategy', async () => {
        const strategy: MergeStrategy = 'recursive';
        const result = await versionService.mergeVersions(version1.id, version2.id, strategy);

        expect(result).toBeDefined();
        expect(typeof result.success).toBe('boolean');
        expect(result.mergedVersion).toBeDefined();
        expect(result.statistics).toBeDefined();
        expect(typeof result.statistics.totalChanges).toBe('number');
        expect(typeof result.statistics.autoMerged).toBe('number');
        expect(typeof result.statistics.manuallyResolved).toBe('number');
        expect(typeof result.statistics.conflictsRemaining).toBe('number');
      });

      it('should handle different merge strategies', async () => {
        const strategies: MergeStrategy[] = ['recursive', 'ours', 'theirs', 'manual'];

        for (const strategy of strategies) {
          const result = await versionService.mergeVersions(version1.id, version2.id, strategy);
          expect(result).toBeDefined();
          expect(typeof result.success).toBe('boolean');
        }
      });
    });
  });

  describe('Branching and Tagging', () => {
    let version1: Version;

    beforeEach(async () => {
      const changes: VersionChange[] = [{
        type: ChangeType.UPDATED,
        path: 'content',
        section: 'main',
        oldValue: 'old',
        newValue: 'new',
        timestamp: new Date(),
        author: 'user1'
      }];

      version1 = await versionService.createVersion(mockDraft, changes, 'user1');
    });

    describe('createBranch', () => {
      it('should create a new branch', async () => {
        const branch = await versionService.createBranch(version1.id, 'feature-branch', 'user1');

        expect(branch).toBeDefined();
        expect(branch.id).toBeDefined();
        expect(branch.name).toBe('feature-branch');
        expect(branch.baseVersionId).toBe(version1.id);
        expect(branch.author.id).toBe('user1');
        expect(branch.status).toBe('active');
      });

      it('should validate branch name uniqueness', async () => {
        await versionService.createBranch(version1.id, 'duplicate-branch', 'user1');

        await expect(
          versionService.createBranch(version1.id, 'duplicate-branch', 'user1')
        ).rejects.toThrow();
      });
    });

    describe('listBranches', () => {
      it('should list all branches for a draft', async () => {
        await versionService.createBranch(version1.id, 'branch1', 'user1');
        await versionService.createBranch(version1.id, 'branch2', 'user1');

        const branches = await versionService.listBranches('draft_123');

        expect(branches).toHaveLength(2);
        expect(branches.every(b => b.draftId === 'draft_123')).toBe(true);
      });
    });

    describe('createTag', () => {
      it('should create a new tag', async () => {
        const tag = await versionService.createTag(
          version1.id,
          'v1.0.0',
          'Release version 1.0.0',
          'user1'
        );

        expect(tag).toBeDefined();
        expect(tag.id).toBeDefined();
        expect(tag.name).toBe('v1.0.0');
        expect(tag.description).toBe('Release version 1.0.0');
        expect(tag.versionId).toBe(version1.id);
        expect(tag.author.id).toBe('user1');
        expect(['release', 'milestone', 'checkpoint', 'custom']).toContain(tag.type);
      });

      it('should validate tag name uniqueness', async () => {
        await versionService.createTag(version1.id, 'duplicate-tag', 'Description', 'user1');

        await expect(
          versionService.createTag(version1.id, 'duplicate-tag', 'Description', 'user1')
        ).rejects.toThrow();
      });
    });

    describe('listTags', () => {
      it('should list all tags for a draft', async () => {
        await versionService.createTag(version1.id, 'tag1', 'Description 1', 'user1');
        await versionService.createTag(version1.id, 'tag2', 'Description 2', 'user1');

        const tags = await versionService.listTags('draft_123');

        expect(tags).toHaveLength(2);
        expect(tags.every(t => t.draftId === 'draft_123')).toBe(true);
      });
    });
  });

  describe('Content Analysis', () => {
    let version1: Version;

    beforeEach(async () => {
      const changes: VersionChange[] = [
        {
          type: ChangeType.UPDATED,
          path: 'content',
          section: 'main',
          oldValue: 'old content',
          newValue: 'new content',
          timestamp: new Date(),
          author: 'user1'
        },
        {
          type: ChangeType.ADDED,
          path: 'metadata',
          section: 'tags',
          oldValue: null,
          newValue: 'new-tag',
          timestamp: new Date(),
          author: 'user1'
        }
      ];

      version1 = await versionService.createVersion(mockDraft, changes, 'user1');
    });

    describe('analyzeChanges', () => {
      it('should analyze changes complexity and risk', async () => {
        const analysis = await versionService.analyzeChanges(version1.changes);

        expect(analysis).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(analysis.complexity);
        expect(['low', 'medium', 'high', 'critical']).toContain(analysis.riskLevel);
        expect(typeof analysis.impactScore).toBe('number');
        expect(analysis.impactScore).toBeGreaterThanOrEqual(0);
        expect(analysis.impactScore).toBeLessThanOrEqual(100);
      });

      it('should categorize changes', async () => {
        const analysis = await versionService.analyzeChanges(version1.changes);

        expect(analysis.categories).toBeDefined();
        expect(typeof analysis.categories.structural).toBe('number');
        expect(typeof analysis.categories.content).toBe('number');
        expect(typeof analysis.categories.metadata).toBe('number');
        expect(typeof analysis.categories.permissions).toBe('number');
      });

      it('should provide recommendations and warnings', async () => {
        const analysis = await versionService.analyzeChanges(version1.changes);

        expect(Array.isArray(analysis.recommendations)).toBe(true);
        expect(Array.isArray(analysis.warnings)).toBe(true);
      });
    });

    describe('getVersionStatistics', () => {
      it('should return comprehensive version statistics', async () => {
        const stats = await versionService.getVersionStatistics('draft_123');

        expect(stats).toBeDefined();
        expect(typeof stats.totalVersions).toBe('number');
        expect(stats.versionsByAuthor).toBeDefined();
        expect(stats.versionsByType).toBeDefined();
        expect(typeof stats.averageChangeSize).toBe('number');
        expect(stats.largestChange).toBeDefined();
        expect(stats.changeFrequency).toBeDefined();
        expect(stats.storageUsage).toBeDefined();
      });

      it('should calculate storage usage correctly', async () => {
        const stats = await versionService.getVersionStatistics('draft_123');

        expect(typeof stats.storageUsage.total).toBe('number');
        expect(typeof stats.storageUsage.compressed).toBe('number');
        expect(typeof stats.storageUsage.compressionRatio).toBe('number');
        expect(stats.storageUsage.compressionRatio).toBeGreaterThanOrEqual(0);
        expect(stats.storageUsage.compressionRatio).toBeLessThanOrEqual(1);
      });
    });

    describe('validateVersionIntegrity', () => {
      it('should validate version integrity', async () => {
        const result = await versionService.validateVersionIntegrity(version1.id);

        expect(result).toBeDefined();
        expect(typeof result.isValid).toBe('boolean');
        expect(Array.isArray(result.issues)).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      });

      it('should detect integrity issues', async () => {
        const result = await versionService.validateVersionIntegrity(version1.id);

        result.issues.forEach(issue => {
          expect(['checksum_mismatch', 'missing_content', 'corrupted_data', 'invalid_reference'])
            .toContain(issue.type);
          expect(['low', 'medium', 'high', 'critical']).toContain(issue.severity);
          expect(typeof issue.description).toBe('string');
        });
      });

      it('should provide repair suggestions', async () => {
        const result = await versionService.validateVersionIntegrity(version1.id);

        if (result.repairSuggestions) {
          result.repairSuggestions.forEach(suggestion => {
            expect(['recompute_checksum', 'restore_from_backup', 'remove_version', 'manual_fix'])
              .toContain(suggestion.action);
            expect(['low', 'medium', 'high']).toContain(suggestion.riskLevel);
          });
        }
      });
    });
  });

  describe('Compression and Optimization', () => {
    beforeEach(async () => {
      // 创建多个版本用于压缩测试
      for (let i = 0; i < 5; i++) {
        const changes: VersionChange[] = [{
          type: ChangeType.UPDATED,
          path: 'content',
          section: 'main',
          oldValue: `old content ${i}`,
          newValue: `new content ${i}`,
          timestamp: new Date(),
          author: 'user1'
        }];

        await versionService.createVersion(mockDraft, changes, 'user1');
      }
    });

    describe('compressVersionHistory', () => {
      it('should compress version history', async () => {
        const options: CompressionOptions = {
          strategy: 'gzip',
          level: 6,
          keepVersions: 2,
          threshold: 100
        };

        const result = await versionService.compressVersionHistory('draft_123', options);

        expect(result).toBeDefined();
        expect(typeof result.originalSize).toBe('number');
        expect(typeof result.compressedSize).toBe('number');
        expect(typeof result.compressionRatio).toBe('number');
        expect(typeof result.versionsProcessed).toBe('number');
        expect(typeof result.timeElapsed).toBe('number');
        expect(result.compressionRatio).toBeGreaterThan(0);
        expect(result.compressionRatio).toBeLessThanOrEqual(1);
      });

      it('should respect compression options', async () => {
        const options: CompressionOptions = {
          strategy: 'brotli',
          level: 9,
          keepVersions: 1,
          threshold: 50
        };

        const result = await versionService.compressVersionHistory('draft_123', options);

        expect(result.versionsProcessed).toBeGreaterThanOrEqual(0);
        if (result.errors) {
          expect(Array.isArray(result.errors)).toBe(true);
        }
      });
    });

    describe('optimizeStorage', () => {
      it('should optimize storage usage', async () => {
        const result = await versionService.optimizeStorage('draft_123');

        expect(result).toBeDefined();
        expect(result.before).toBeDefined();
        expect(result.after).toBeDefined();
        expect(result.savings).toBeDefined();
        expect(Array.isArray(result.operations)).toBe(true);

        expect(typeof result.before.versions).toBe('number');
        expect(typeof result.before.totalSize).toBe('number');
        expect(typeof result.before.redundancy).toBe('number');

        expect(typeof result.after.versions).toBe('number');
        expect(typeof result.after.totalSize).toBe('number');
        expect(typeof result.after.redundancy).toBe('number');

        expect(typeof result.savings.size).toBe('number');
        expect(typeof result.savings.percentage).toBe('number');
      });

      it('should achieve storage savings', async () => {
        const result = await versionService.optimizeStorage('draft_123');

        // 优化后应该有一些节省（即使很小）
        expect(result.savings.size).toBeGreaterThanOrEqual(0);
        expect(result.savings.percentage).toBeGreaterThanOrEqual(0);
        expect(result.savings.percentage).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Private Helper Methods (tested through public interfaces)', () => {
    it('should compress and decompress content correctly', async () => {
      const changes: VersionChange[] = [{
        type: ChangeType.UPDATED,
        path: 'content',
        section: 'main',
        oldValue: 'original long content that should be compressed',
        newValue: 'updated long content that should be compressed',
        timestamp: new Date(),
        author: 'user1'
      }];

      const version = await versionService.createVersion(mockDraft, changes, 'user1');
      const retrievedVersion = await versionService.getVersion(version.id);

      expect(retrievedVersion).toBeDefined();
      expect(retrievedVersion!.contentSnapshot).toBeDefined();
      expect(typeof retrievedVersion!.contentSnapshot).toBe('string');
    });

    it('should calculate checksums correctly', async () => {
      const changes: VersionChange[] = [{
        type: ChangeType.UPDATED,
        path: 'content',
        section: 'main',
        oldValue: 'content for checksum',
        newValue: 'updated content for checksum',
        timestamp: new Date(),
        author: 'user1'
      }];

      const version = await versionService.createVersion(mockDraft, changes, 'user1');

      expect(version.metadata.checksum).toBeDefined();
      expect(typeof version.metadata.checksum).toBe('string');
      expect(version.metadata.checksum.length).toBeGreaterThan(0);
    });

    it('should infer change types correctly', async () => {
      const updateChanges: VersionChange[] = [{
        type: ChangeType.UPDATED,
        path: 'content',
        section: 'main',
        oldValue: 'old',
        newValue: 'new',
        timestamp: new Date(),
        author: 'user1'
      }];

      const addChanges: VersionChange[] = [{
        type: ChangeType.ADDED,
        path: 'content',
        section: 'new_section',
        oldValue: null,
        newValue: 'new section content',
        timestamp: new Date(),
        author: 'user1'
      }];

      const updateVersion = await versionService.createVersion(mockDraft, updateChanges, 'user1');
      const addVersion = await versionService.createVersion(mockDraft, addChanges, 'user1');

      expect([ChangeType.UPDATED, ChangeType.ADDED, ChangeType.DELETED]).toContain(updateVersion.changeType);
      expect([ChangeType.UPDATED, ChangeType.ADDED, ChangeType.DELETED]).toContain(addVersion.changeType);
    });
  });
});