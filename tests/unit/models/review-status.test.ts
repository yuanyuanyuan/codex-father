/**
 * T039: ReviewStatus Model Unit Tests
 *
 * Comprehensive unit tests for ReviewStatus model including validation rules,
 * review workflow states, decision tracking, and timeline management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ReviewStatus,
  ReviewDecision,
  ReviewPriority,
  ReviewStage,
  createReviewStatus,
  isReviewStatus,
  validateReviewStatus,
  calculateOverallStatus,
  isValidStatusTransition
} from '../../../src/models/review-status';

describe('ReviewStatus Model', () => {
  let validReviewStatus: ReviewStatus;

  beforeEach(() => {
    validReviewStatus = {
      id: 'review-001',
      draftId: 'prd-draft-001',
      submittedBy: 'product-manager',
      submittedAt: new Date('2024-01-01T09:00:00Z'),
      reviewers: ['architect-001', 'lead-developer'],
      currentStage: 'technical_review',
      priority: 'high',
      deadline: new Date('2024-01-08T18:00:00Z'),
      message: '请审核产品需求文档，重点关注技术可行性',
      decisions: [
        {
          reviewerId: 'architect-001',
          decision: 'approve',
          comments: '技术架构合理，同意实施',
          timestamp: new Date('2024-01-02T14:00:00Z'),
          section: 'architecture'
        }
      ],
      overallStatus: 'in_progress',
      progress: {
        completed: 1,
        total: 2,
        percentage: 50
      },
      timeline: [
        {
          stage: 'submitted',
          timestamp: new Date('2024-01-01T09:00:00Z'),
          actor: 'product-manager',
          description: '提交评审申请'
        },
        {
          stage: 'technical_review',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          actor: 'system',
          description: '开始技术评审阶段'
        }
      ],
      metadata: {
        estimatedDuration: 120, // 分钟
        complexity: 'medium',
        tags: ['feature', 'high-priority']
      },
      createdAt: new Date('2024-01-01T09:00:00Z'),
      updatedAt: new Date('2024-01-02T14:00:00Z')
    };
  });

  describe('Type Guards', () => {
    it('应该正确识别有效的 ReviewStatus 对象', () => {
      expect(isReviewStatus(validReviewStatus)).toBe(true);
    });

    it('应该拒绝缺少必需字段的对象', () => {
      const requiredFields = [
        'id', 'draftId', 'submittedBy', 'submittedAt', 'reviewers',
        'currentStage', 'priority', 'decisions', 'overallStatus',
        'timeline', 'createdAt', 'updatedAt'
      ];

      requiredFields.forEach(field => {
        const invalidReview = { ...validReviewStatus };
        delete (invalidReview as any)[field];
        expect(isReviewStatus(invalidReview)).toBe(false);
      });
    });

    it('应该验证枚举值', () => {
      // 测试 ReviewPriority
      const validPriorities: ReviewPriority[] = ['low', 'normal', 'high', 'urgent'];
      validPriorities.forEach(priority => {
        const review = { ...validReviewStatus, priority };
        expect(isReviewStatus(review)).toBe(true);
      });

      const invalidPriority = { ...validReviewStatus, priority: 'invalid' };
      expect(isReviewStatus(invalidPriority)).toBe(false);

      // 测试 ReviewStage
      const validStages: ReviewStage[] = [
        'submitted', 'assigned', 'technical_review', 'business_review',
        'final_review', 'approved', 'rejected', 'revision_required'
      ];
      validStages.forEach(currentStage => {
        const review = { ...validReviewStatus, currentStage };
        expect(isReviewStatus(review)).toBe(true);
      });

      const invalidStage = { ...validReviewStatus, currentStage: 'invalid' };
      expect(isReviewStatus(invalidStage)).toBe(false);

      // 测试 ReviewDecision
      const validDecisions: ReviewDecision[] = ['approve', 'reject', 'request_changes'];
      validDecisions.forEach(decision => {
        const review = {
          ...validReviewStatus,
          decisions: [{ ...validReviewStatus.decisions[0], decision }]
        };
        expect(isReviewStatus(review)).toBe(true);
      });

      const invalidDecision = {
        ...validReviewStatus,
        decisions: [{ ...validReviewStatus.decisions[0], decision: 'invalid' }]
      };
      expect(isReviewStatus(invalidDecision)).toBe(false);
    });

    it('应该正确处理可选字段', () => {
      // 最小评审状态
      const minimalReview = {
        id: 'minimal-review',
        draftId: 'draft-001',
        submittedBy: 'user',
        submittedAt: new Date(),
        reviewers: ['reviewer1'],
        currentStage: 'submitted' as ReviewStage,
        priority: 'normal' as ReviewPriority,
        decisions: [],
        overallStatus: 'pending',
        timeline: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isReviewStatus(minimalReview)).toBe(true);

      // 带可选字段的评审状态
      const reviewWithOptionals = {
        ...minimalReview,
        deadline: new Date(),
        message: '评审消息',
        progress: { completed: 0, total: 1, percentage: 0 },
        metadata: { estimatedDuration: 60 }
      };

      expect(isReviewStatus(reviewWithOptionals)).toBe(true);
    });
  });

  describe('ReviewStatus Validation', () => {
    it('应该验证评审者列表', () => {
      // 有效的评审者列表
      const validReviewers = [
        ['reviewer1'],
        ['reviewer1', 'reviewer2'],
        ['architect', 'lead-dev', 'product-owner'],
        [] // 空列表在某些情况下可能有效
      ];

      validReviewers.forEach(reviewers => {
        const review = { ...validReviewStatus, reviewers };
        expect(validateReviewStatus(review).valid).toBe(true);
      });

      // 无效的评审者列表
      const invalidReviewers = [
        'string instead of array',
        [123], // 非字符串元素
        [''], // 空字符串评审者
        ['reviewer with spaces'],
        ['duplicate', 'duplicate'], // 重复评审者
        new Array(21).fill('reviewer') // 超过最大数量
      ];

      invalidReviewers.forEach(reviewers => {
        const review = { ...validReviewStatus, reviewers: reviewers as any };
        const result = validateReviewStatus(review);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证截止日期合理性', () => {
      const now = new Date();
      const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天后
      const past = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1天前

      // 有效的截止日期
      const validDeadlines = [
        undefined, // 可选字段
        future,
        new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 1年后
      ];

      validDeadlines.forEach(deadline => {
        const review = { ...validReviewStatus, deadline };
        expect(validateReviewStatus(review).valid).toBe(true);
      });

      // 无效的截止日期：已过期
      const review = {
        ...validReviewStatus,
        deadline: past,
        overallStatus: 'pending' // 状态为待处理但截止日期已过
      };
      const result = validateReviewStatus(review);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.field === 'deadline')).toBe(true);
    });

    it('应该验证决策记录的完整性', () => {
      // 有效的决策记录
      const validDecisions = [
        [], // 空数组（刚提交的评审）
        [
          {
            reviewerId: 'reviewer1',
            decision: 'approve' as ReviewDecision,
            comments: '同意此提案',
            timestamp: new Date(),
            section: 'overall'
          }
        ],
        [
          {
            reviewerId: 'reviewer1',
            decision: 'request_changes' as ReviewDecision,
            comments: '需要修改架构部分',
            timestamp: new Date(),
            section: 'architecture',
            severity: 'major'
          },
          {
            reviewerId: 'reviewer2',
            decision: 'approve' as ReviewDecision,
            comments: '业务逻辑正确',
            timestamp: new Date(),
            section: 'business'
          }
        ]
      ];

      validDecisions.forEach(decisions => {
        const review = { ...validReviewStatus, decisions };
        expect(validateReviewStatus(review).valid).toBe(true);
      });

      // 无效的决策记录
      const invalidDecisions = [
        [{ reviewerId: '', decision: 'approve', comments: '评审者ID为空', timestamp: new Date() }],
        [{ reviewerId: 'reviewer1', decision: 'approve', comments: '', timestamp: new Date() }], // 空评论
        [{ reviewerId: 'reviewer1', decision: 'approve', comments: 'ok', timestamp: 'invalid' }], // 无效时间戳
        [{ reviewerId: 'reviewer1', decision: 'invalid', comments: '无效决策', timestamp: new Date() }]
      ];

      invalidDecisions.forEach(decisions => {
        const review = { ...validReviewStatus, decisions: decisions as any };
        const result = validateReviewStatus(review);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证时间线的一致性', () => {
      // 有效的时间线
      const validTimeline = [
        {
          stage: 'submitted' as ReviewStage,
          timestamp: new Date('2024-01-01T09:00:00Z'),
          actor: 'product-manager',
          description: '提交评审'
        },
        {
          stage: 'technical_review' as ReviewStage,
          timestamp: new Date('2024-01-01T10:00:00Z'),
          actor: 'system',
          description: '开始技术评审'
        },
        {
          stage: 'approved' as ReviewStage,
          timestamp: new Date('2024-01-02T14:00:00Z'),
          actor: 'reviewer',
          description: '评审通过'
        }
      ];

      const review = { ...validReviewStatus, timeline: validTimeline };
      expect(validateReviewStatus(review).valid).toBe(true);

      // 无效的时间线：时间倒序
      const invalidTimeline = [
        {
          stage: 'submitted' as ReviewStage,
          timestamp: new Date('2024-01-02T09:00:00Z'),
          actor: 'user',
          description: '提交'
        },
        {
          stage: 'technical_review' as ReviewStage,
          timestamp: new Date('2024-01-01T09:00:00Z'), // 早于提交时间
          actor: 'system',
          description: '技术评审'
        }
      ];

      const invalidReview = { ...validReviewStatus, timeline: invalidTimeline };
      const result = validateReviewStatus(invalidReview);
      expect(result.valid).toBe(false);
    });

    it('应该验证进度计算的正确性', () => {
      // 有效的进度
      const validProgress = [
        undefined, // 可选字段
        { completed: 0, total: 2, percentage: 0 },
        { completed: 1, total: 2, percentage: 50 },
        { completed: 2, total: 2, percentage: 100 }
      ];

      validProgress.forEach(progress => {
        const review = { ...validReviewStatus, progress };
        expect(validateReviewStatus(review).valid).toBe(true);
      });

      // 无效的进度
      const invalidProgress = [
        { completed: -1, total: 2, percentage: 0 }, // 负数
        { completed: 3, total: 2, percentage: 150 }, // 完成数超过总数
        { completed: 1, total: 2, percentage: 75 }, // 百分比不匹配
        { completed: 1, total: 0, percentage: 100 }, // 总数为0
        { completed: 'invalid', total: 2, percentage: 0 } // 非数字
      ];

      invalidProgress.forEach(progress => {
        const review = { ...validReviewStatus, progress: progress as any };
        const result = validateReviewStatus(review);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Status Calculation and Transitions', () => {
    it('应该正确计算整体评审状态', () => {
      const testCases = [
        {
          decisions: [],
          reviewers: ['r1', 'r2'],
          expected: 'pending'
        },
        {
          decisions: [
            { reviewerId: 'r1', decision: 'approve' as ReviewDecision }
          ],
          reviewers: ['r1', 'r2'],
          expected: 'in_progress'
        },
        {
          decisions: [
            { reviewerId: 'r1', decision: 'approve' as ReviewDecision },
            { reviewerId: 'r2', decision: 'approve' as ReviewDecision }
          ],
          reviewers: ['r1', 'r2'],
          expected: 'approved'
        },
        {
          decisions: [
            { reviewerId: 'r1', decision: 'reject' as ReviewDecision }
          ],
          reviewers: ['r1', 'r2'],
          expected: 'rejected'
        },
        {
          decisions: [
            { reviewerId: 'r1', decision: 'request_changes' as ReviewDecision }
          ],
          reviewers: ['r1', 'r2'],
          expected: 'changes_requested'
        },
        {
          decisions: [
            { reviewerId: 'r1', decision: 'approve' as ReviewDecision },
            { reviewerId: 'r2', decision: 'request_changes' as ReviewDecision }
          ],
          reviewers: ['r1', 'r2'],
          expected: 'changes_requested'
        }
      ];

      testCases.forEach(({ decisions, reviewers, expected }) => {
        const mockDecisions = decisions.map(d => ({
          ...d,
          comments: 'test comment',
          timestamp: new Date()
        }));

        const status = calculateOverallStatus(mockDecisions, reviewers);
        expect(status).toBe(expected);
      });
    });

    it('应该验证状态转换的合法性', () => {
      const validTransitions = [
        { from: 'pending', to: 'in_progress' },
        { from: 'in_progress', to: 'approved' },
        { from: 'in_progress', to: 'rejected' },
        { from: 'in_progress', to: 'changes_requested' },
        { from: 'changes_requested', to: 'in_progress' },
        { from: 'changes_requested', to: 'rejected' },
        { from: 'approved', to: 'published' }
      ];

      validTransitions.forEach(({ from, to }) => {
        expect(isValidStatusTransition(from, to)).toBe(true);
      });

      const invalidTransitions = [
        { from: 'pending', to: 'approved' }, // 跳过评审过程
        { from: 'approved', to: 'pending' }, // 逆向转换
        { from: 'rejected', to: 'approved' }, // 从拒绝到批准
        { from: 'published', to: 'in_progress' } // 从发布回到进行中
      ];

      invalidTransitions.forEach(({ from, to }) => {
        expect(isValidStatusTransition(from, to)).toBe(false);
      });
    });

    it('应该计算评审进度', () => {
      const decisions = [
        {
          reviewerId: 'r1',
          decision: 'approve' as ReviewDecision,
          comments: 'good',
          timestamp: new Date()
        }
      ];
      const reviewers = ['r1', 'r2', 'r3'];

      const review = {
        ...validReviewStatus,
        decisions,
        reviewers
      };

      const result = validateReviewStatus(review);
      expect(result.valid).toBe(true);

      // 应该自动计算正确的进度
      if (review.progress) {
        expect(review.progress.completed).toBe(1);
        expect(review.progress.total).toBe(3);
        expect(review.progress.percentage).toBe(Math.round((1 / 3) * 100));
      }
    });
  });

  describe('Factory Methods', () => {
    it('应该创建有效的 ReviewStatus 实例', () => {
      const reviewData = {
        draftId: 'new-draft',
        submittedBy: 'user1',
        reviewers: ['reviewer1', 'reviewer2'],
        priority: 'normal' as ReviewPriority,
        message: '请评审此文档'
      };

      const review = createReviewStatus(reviewData);

      expect(isReviewStatus(review)).toBe(true);
      expect(review.draftId).toBe(reviewData.draftId);
      expect(review.submittedBy).toBe(reviewData.submittedBy);
      expect(review.reviewers).toEqual(reviewData.reviewers);
      expect(review.priority).toBe(reviewData.priority);
      expect(review.message).toBe(reviewData.message);
      expect(review.currentStage).toBe('submitted');
      expect(review.overallStatus).toBe('pending');
      expect(review.decisions).toEqual([]);
      expect(review.timeline).toHaveLength(1);
      expect(review.id).toMatch(/^review-\d+$/);
      expect(review.submittedAt).toBeInstanceOf(Date);
      expect(review.createdAt).toBeInstanceOf(Date);
      expect(review.updatedAt).toBeInstanceOf(Date);
    });

    it('应该接受可选参数覆盖默认值', () => {
      const customData = {
        draftId: 'custom-draft',
        submittedBy: 'custom-user',
        reviewers: ['rev1'],
        priority: 'urgent' as ReviewPriority,
        message: '紧急评审',
        id: 'custom-review-id',
        currentStage: 'technical_review' as ReviewStage,
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

      const review = createReviewStatus(customData);

      expect(review.id).toBe(customData.id);
      expect(review.currentStage).toBe(customData.currentStage);
      expect(review.deadline).toEqual(customData.deadline);
    });

    it('应该生成唯一的评审 ID', () => {
      const ids = new Set();

      for (let i = 0; i < 50; i++) {
        const review = createReviewStatus({
          draftId: `draft-${i}`,
          submittedBy: 'user',
          reviewers: ['reviewer'],
          priority: 'normal',
          message: '测试评审'
        });

        expect(ids.has(review.id)).toBe(false);
        ids.add(review.id);
      }
    });

    it('应该验证工厂方法的输入参数', () => {
      const invalidInputs = [
        { draftId: '', submittedBy: 'user', reviewers: ['rev'], priority: 'normal', message: 'test' },
        { draftId: 'draft', submittedBy: '', reviewers: ['rev'], priority: 'normal', message: 'test' },
        { draftId: 'draft', submittedBy: 'user', reviewers: [], priority: 'normal', message: 'test' },
        { draftId: 'draft', submittedBy: 'user', reviewers: ['rev'], priority: 'invalid', message: 'test' }
      ];

      invalidInputs.forEach(input => {
        expect(() => createReviewStatus(input as any)).toThrow();
      });
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('应该处理大量评审者', () => {
      const manyReviewers = Array.from({ length: 20 }, (_, i) => `reviewer-${i}`);

      const review = {
        ...validReviewStatus,
        reviewers: manyReviewers
      };

      const result = validateReviewStatus(review);
      expect(result.valid).toBe(true);
    });

    it('应该处理复杂的评审决策历史', () => {
      const complexDecisions = [
        {
          reviewerId: 'architect',
          decision: 'request_changes' as ReviewDecision,
          comments: '架构需要调整，建议使用微服务模式',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          section: 'architecture',
          severity: 'major'
        },
        {
          reviewerId: 'security-expert',
          decision: 'request_changes' as ReviewDecision,
          comments: '安全考虑不足，需要添加身份验证',
          timestamp: new Date('2024-01-01T11:00:00Z'),
          section: 'security',
          severity: 'critical'
        },
        {
          reviewerId: 'architect',
          decision: 'approve' as ReviewDecision,
          comments: '架构调整后符合要求',
          timestamp: new Date('2024-01-02T09:00:00Z'),
          section: 'architecture'
        },
        {
          reviewerId: 'security-expert',
          decision: 'approve' as ReviewDecision,
          comments: '安全措施已完善',
          timestamp: new Date('2024-01-02T10:00:00Z'),
          section: 'security'
        }
      ];

      const review = {
        ...validReviewStatus,
        decisions: complexDecisions
      };

      const result = validateReviewStatus(review);
      expect(result.valid).toBe(true);
    });

    it('应该处理特殊字符和多语言内容', () => {
      const multilingualReview = {
        ...validReviewStatus,
        message: 'Multi-language review 多语言评审 with émojis 🚀',
        decisions: [
          {
            reviewerId: 'chinese-reviewer',
            decision: 'approve' as ReviewDecision,
            comments: '同意此方案，技术实现合理。包含特殊符号：【】《》（）',
            timestamp: new Date(),
            section: 'technical'
          },
          {
            reviewerId: 'english-reviewer',
            decision: 'request_changes' as ReviewDecision,
            comments: 'Looks good overall, but needs "better" documentation and @mentions',
            timestamp: new Date(),
            section: 'documentation'
          }
        ]
      };

      const result = validateReviewStatus(multilingualReview);
      expect(result.valid).toBe(true);
    });

    it('应该处理长时间跨度的评审流程', () => {
      const longTimelineReview = {
        ...validReviewStatus,
        submittedAt: new Date('2024-01-01T00:00:00Z'),
        deadline: new Date('2024-03-01T00:00:00Z'), // 2个月后
        timeline: [
          {
            stage: 'submitted' as ReviewStage,
            timestamp: new Date('2024-01-01T00:00:00Z'),
            actor: 'submitter',
            description: '提交长期评审'
          },
          {
            stage: 'technical_review' as ReviewStage,
            timestamp: new Date('2024-01-15T00:00:00Z'),
            actor: 'system',
            description: '开始技术评审'
          },
          {
            stage: 'business_review' as ReviewStage,
            timestamp: new Date('2024-02-01T00:00:00Z'),
            actor: 'system',
            description: '开始业务评审'
          }
        ]
      };

      const result = validateReviewStatus(longTimelineReview);
      expect(result.valid).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    it('应该高效处理评审状态验证', () => {
      const startTime = Date.now();

      for (let i = 0; i < 200; i++) {
        const review = {
          ...validReviewStatus,
          id: `performance-test-${i}`
        };

        validateReviewStatus(review);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 200 次验证应该在 100ms 内完成
      expect(duration).toBeLessThan(100);
    });

    it('应该高效计算复杂的评审状态', () => {
      const manyDecisions = Array.from({ length: 100 }, (_, i) => ({
        reviewerId: `reviewer-${i}`,
        decision: (i % 3 === 0 ? 'approve' : i % 3 === 1 ? 'reject' : 'request_changes') as ReviewDecision,
        comments: `Comment ${i}`,
        timestamp: new Date()
      }));

      const manyReviewers = Array.from({ length: 100 }, (_, i) => `reviewer-${i}`);

      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        calculateOverallStatus(manyDecisions, manyReviewers);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 复杂状态计算应该在合理时间内完成
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('应该提供详细的验证错误信息', () => {
      const invalidReview = {
        ...validReviewStatus,
        priority: 'invalid-priority',
        reviewers: [], // 空评审者列表
        decisions: [
          { reviewerId: '', decision: 'approve', comments: '空评审者ID', timestamp: new Date() }
        ],
        progress: { completed: -1, total: 2, percentage: 150 } // 无效进度
      };

      const result = validateReviewStatus(invalidReview);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      result.errors.forEach(error => {
        expect(error.field).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.code).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(5);
      });
    });

    it('应该处理状态转换的异常情况', () => {
      const edgeCases = [
        { from: 'invalid-status', to: 'approved' },
        { from: 'pending', to: 'invalid-status' },
        { from: '', to: 'approved' },
        { from: 'pending', to: '' }
      ];

      edgeCases.forEach(({ from, to }) => {
        expect(() => isValidStatusTransition(from, to)).not.toThrow();
        expect(isValidStatusTransition(from, to)).toBe(false);
      });
    });

    it('应该优雅处理畸形输入', () => {
      const malformedInputs = [
        null,
        undefined,
        'string',
        123,
        [],
        new Date(),
        Symbol('test'),
        function() {},
        { incomplete: 'object' }
      ];

      malformedInputs.forEach(input => {
        expect(() => validateReviewStatus(input as any)).not.toThrow();
        expect(() => isReviewStatus(input as any)).not.toThrow();

        const isValid = isReviewStatus(input as any);
        expect(isValid).toBe(false);
      });
    });
  });
});