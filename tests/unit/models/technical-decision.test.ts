/**
 * T039: TechnicalDecision Model Unit Tests
 *
 * Comprehensive unit tests for TechnicalDecision model including validation rules,
 * decision tracking, impact analysis, and decision lifecycle management.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TechnicalDecision,
  DecisionStatus,
  DecisionCategory,
  DecisionImpact,
  Alternative,
  createTechnicalDecision,
  isTechnicalDecision,
  validateTechnicalDecision,
  calculateDecisionScore,
  getDecisionTimeline
} from '../../../src/models/technical-decision';

describe('TechnicalDecision Model', () => {
  let validTechnicalDecision: TechnicalDecision;
  let validAlternative: Alternative;

  beforeEach(() => {
    validAlternative = {
      id: 'alt-001',
      title: 'React + TypeScript',
      description: '使用 React 框架配合 TypeScript 开发前端应用',
      pros: [
        '强类型支持，减少运行时错误',
        '庞大的生态系统和社区支持',
        '组件化开发模式，代码复用性高'
      ],
      cons: [
        '学习曲线相对陡峭',
        '编译时间较长',
        '包大小可能较大'
      ],
      effort: {
        development: 'medium',
        maintenance: 'low',
        learning: 'medium'
      },
      risks: [
        {
          description: '技术栈更新频率高',
          severity: 'medium',
          probability: 'high',
          mitigation: '建立技术更新评估流程'
        }
      ],
      score: 85
    };

    validTechnicalDecision = {
      id: 'decision-001',
      title: '前端技术栈选择',
      description: '为新的 PRD 管理系统选择合适的前端技术栈',
      category: 'architecture',
      status: 'approved',
      context: {
        problem: '现有系统使用的技术栈已过时，需要选择新的前端技术栈',
        requirements: [
          '支持现代浏览器',
          '开发效率高',
          '可维护性强',
          '团队技能匹配'
        ],
        constraints: [
          '开发时间限制为 3 个月',
          '团队规模 5 人',
          '需要兼容现有后端 API'
        ]
      },
      alternatives: [
        validAlternative,
        {
          id: 'alt-002',
          title: 'Vue.js + TypeScript',
          description: '使用 Vue.js 框架配合 TypeScript',
          pros: ['学习曲线平缓', '轻量级', '双向数据绑定'],
          cons: ['生态系统相对较小', '企业级应用案例较少'],
          effort: {
            development: 'low',
            maintenance: 'low',
            learning: 'low'
          },
          risks: [],
          score: 75
        }
      ],
      selectedAlternative: 'alt-001',
      rationale: '选择 React + TypeScript 主要基于以下考虑：团队已有相关经验、生态系统成熟、长期维护性好',
      impact: {
        scope: 'high',
        reversibility: 'medium',
        timeToImplement: 30, // 天
        affectedComponents: ['frontend', 'build-system', 'testing'],
        stakeholders: ['development-team', 'qa-team', 'product-team']
      },
      decisionMakers: ['tech-lead', 'architect', 'frontend-lead'],
      reviewers: ['cto', 'engineering-manager'],
      metadata: {
        tags: ['frontend', 'architecture', 'typescript'],
        relatedDecisions: ['decision-002', 'decision-003'],
        confidenceLevel: 'high',
        reviewDate: new Date('2024-06-01T00:00:00Z'),
        implementationDeadline: new Date('2024-04-01T00:00:00Z')
      },
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T12:00:00Z'),
      decisionDate: new Date('2024-01-01T10:00:00Z')
    };
  });

  describe('Type Guards', () => {
    it('应该正确识别有效的 TechnicalDecision 对象', () => {
      expect(isTechnicalDecision(validTechnicalDecision)).toBe(true);
    });

    it('应该拒绝缺少必需字段的对象', () => {
      const requiredFields = [
        'id', 'title', 'description', 'category', 'status', 'context',
        'alternatives', 'decisionMakers', 'createdAt', 'updatedAt'
      ];

      requiredFields.forEach(field => {
        const invalidDecision = { ...validTechnicalDecision };
        delete (invalidDecision as any)[field];
        expect(isTechnicalDecision(invalidDecision)).toBe(false);
      });
    });

    it('应该验证枚举值', () => {
      // 测试 DecisionStatus
      const validStatuses: DecisionStatus[] = [
        'proposed', 'under_review', 'approved', 'rejected', 'implemented', 'superseded'
      ];
      validStatuses.forEach(status => {
        const decision = { ...validTechnicalDecision, status };
        expect(isTechnicalDecision(decision)).toBe(true);
      });

      const invalidStatus = { ...validTechnicalDecision, status: 'invalid' };
      expect(isTechnicalDecision(invalidStatus)).toBe(false);

      // 测试 DecisionCategory
      const validCategories: DecisionCategory[] = [
        'architecture', 'technology', 'process', 'security', 'performance', 'integration'
      ];
      validCategories.forEach(category => {
        const decision = { ...validTechnicalDecision, category };
        expect(isTechnicalDecision(decision)).toBe(true);
      });

      const invalidCategory = { ...validTechnicalDecision, category: 'invalid' };
      expect(isTechnicalDecision(invalidCategory)).toBe(false);
    });

    it('应该验证备选方案数组结构', () => {
      // 有效的备选方案
      const validAlternativesArrays = [
        [validAlternative],
        [validAlternative, { ...validAlternative, id: 'alt-003', title: '另一个方案' }],
        [] // 空数组在某些状态下可能有效
      ];

      validAlternativesArrays.forEach(alternatives => {
        const decision = { ...validTechnicalDecision, alternatives };
        expect(isTechnicalDecision(decision)).toBe(true);
      });

      // 无效的备选方案
      const invalidAlternativesArrays = [
        'not an array',
        [{ id: 'invalid', missing: 'title' }], // 缺少必需字段
        [{ ...validAlternative, effort: 'invalid' }], // 无效的effort结构
        null,
        undefined
      ];

      invalidAlternativesArrays.forEach(alternatives => {
        const decision = { ...validTechnicalDecision, alternatives: alternatives as any };
        expect(isTechnicalDecision(decision)).toBe(false);
      });
    });

    it('应该正确处理可选字段', () => {
      // 最小技术决策
      const minimalDecision = {
        id: 'minimal-decision',
        title: '最小决策',
        description: '最小字段测试',
        category: 'technology' as DecisionCategory,
        status: 'proposed' as DecisionStatus,
        context: {
          problem: '测试问题',
          requirements: ['基本需求'],
          constraints: ['基本约束']
        },
        alternatives: [],
        decisionMakers: ['decision-maker'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isTechnicalDecision(minimalDecision)).toBe(true);

      // 带可选字段的决策
      const decisionWithOptionals = {
        ...minimalDecision,
        selectedAlternative: 'alt-001',
        rationale: '选择理由',
        impact: {
          scope: 'medium',
          reversibility: 'high',
          timeToImplement: 15,
          affectedComponents: ['component1'],
          stakeholders: ['stakeholder1']
        }
      };

      expect(isTechnicalDecision(decisionWithOptionals)).toBe(true);
    });
  });

  describe('Decision Context Validation', () => {
    it('应该验证决策上下文完整性', () => {
      // 有效的上下文
      const validContexts = [
        {
          problem: '明确的问题描述',
          requirements: ['需求1', '需求2'],
          constraints: ['约束1', '约束2']
        },
        {
          problem: '复杂的技术选择问题，涉及多个维度的考量',
          requirements: [
            '性能要求：响应时间 < 100ms',
            '可扩展性：支持 1000+ 并发用户',
            '兼容性：支持 IE 11+',
            '安全性：符合 GDPR 要求'
          ],
          constraints: [
            '预算限制：开发成本 < 50万',
            '时间限制：6个月内完成',
            '人力限制：5人开发团队',
            '技术限制：必须使用现有基础设施'
          ],
          assumptions: ['团队技能假设', '市场环境假设'],
          goals: ['提升用户体验', '降低维护成本']
        }
      ];

      validContexts.forEach(context => {
        const decision = { ...validTechnicalDecision, context };
        expect(validateTechnicalDecision(decision).valid).toBe(true);
      });

      // 无效的上下文
      const invalidContexts = [
        { problem: '', requirements: ['req'], constraints: ['constraint'] }, // 空问题
        { problem: 'problem', requirements: [], constraints: ['constraint'] }, // 空需求
        { problem: 'problem', requirements: ['req'], constraints: [] }, // 空约束
        { problem: 'problem', requirements: 'not array', constraints: ['constraint'] }, // 非数组需求
        { problem: 'problem', requirements: [''], constraints: ['constraint'] }, // 空需求项
        null,
        undefined
      ];

      invalidContexts.forEach(context => {
        const decision = { ...validTechnicalDecision, context: context as any };
        const result = validateTechnicalDecision(decision);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证需求和约束的质量', () => {
      const qualityTests = [
        {
          requirements: ['具体的性能需求：响应时间 < 100ms'],
          shouldBeValid: true
        },
        {
          requirements: ['模糊需求'], // 过于模糊
          shouldBeValid: false
        },
        {
          constraints: ['明确的预算约束：开发成本 < 100万元'],
          shouldBeValid: true
        },
        {
          constraints: ['约束'], // 过于简单
          shouldBeValid: false
        }
      ];

      qualityTests.forEach(({ requirements, constraints, shouldBeValid }) => {
        const context = {
          problem: '测试问题',
          requirements: requirements || ['默认需求'],
          constraints: constraints || ['默认约束']
        };

        const decision = { ...validTechnicalDecision, context };
        const result = validateTechnicalDecision(decision);
        expect(result.valid).toBe(shouldBeValid);
      });
    });
  });

  describe('Alternative Validation', () => {
    it('应该验证备选方案的完整性', () => {
      // 有效的备选方案
      const validAlternatives = [
        {
          id: 'complete-alt',
          title: '完整的备选方案',
          description: '详细的方案描述',
          pros: ['优点1', '优点2'],
          cons: ['缺点1', '缺点2'],
          effort: {
            development: 'medium',
            maintenance: 'low',
            learning: 'high'
          },
          risks: [
            {
              description: '技术风险',
              severity: 'high',
              probability: 'medium',
              mitigation: '风险缓解策略'
            }
          ],
          score: 80
        }
      ];

      validAlternatives.forEach(alternative => {
        const decision = {
          ...validTechnicalDecision,
          alternatives: [alternative]
        };
        expect(validateTechnicalDecision(decision).valid).toBe(true);
      });

      // 无效的备选方案
      const invalidAlternatives = [
        { id: '', title: 'test', description: 'test' }, // 空ID
        { id: 'test', title: '', description: 'test' }, // 空标题
        { id: 'test', title: 'test', description: '' }, // 空描述
        { id: 'test', title: 'test', description: 'test', pros: 'not array' }, // 非数组优点
        { id: 'test', title: 'test', description: 'test', score: 'not number' }, // 非数字评分
        { id: 'test', title: 'test', description: 'test', score: -1 }, // 负分
        { id: 'test', title: 'test', description: 'test', score: 101 } // 超出范围
      ];

      invalidAlternatives.forEach(alternative => {
        const decision = {
          ...validTechnicalDecision,
          alternatives: [alternative]
        };
        const result = validateTechnicalDecision(decision);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证effort评估', () => {
      const effortTests = [
        {
          effort: { development: 'low', maintenance: 'low', learning: 'low' },
          shouldBeValid: true
        },
        {
          effort: { development: 'medium', maintenance: 'medium', learning: 'medium' },
          shouldBeValid: true
        },
        {
          effort: { development: 'high', maintenance: 'high', learning: 'high' },
          shouldBeValid: true
        },
        {
          effort: { development: 'invalid', maintenance: 'low', learning: 'low' },
          shouldBeValid: false
        },
        {
          effort: { development: 'low' }, // 缺少字段
          shouldBeValid: false
        }
      ];

      effortTests.forEach(({ effort, shouldBeValid }) => {
        const alternative = {
          ...validAlternative,
          effort: effort as any
        };

        const decision = {
          ...validTechnicalDecision,
          alternatives: [alternative]
        };

        const result = validateTechnicalDecision(decision);
        expect(result.valid).toBe(shouldBeValid);
      });
    });

    it('应该验证风险评估', () => {
      const riskTests = [
        {
          risks: [
            {
              description: '详细的风险描述',
              severity: 'high',
              probability: 'medium',
              mitigation: '具体的缓解策略'
            }
          ],
          shouldBeValid: true
        },
        {
          risks: [], // 空风险数组
          shouldBeValid: true
        },
        {
          risks: [
            {
              description: '', // 空描述
              severity: 'high',
              probability: 'medium',
              mitigation: '策略'
            }
          ],
          shouldBeValid: false
        },
        {
          risks: [
            {
              description: '风险',
              severity: 'invalid', // 无效严重程度
              probability: 'medium',
              mitigation: '策略'
            }
          ],
          shouldBeValid: false
        }
      ];

      riskTests.forEach(({ risks, shouldBeValid }) => {
        const alternative = {
          ...validAlternative,
          risks: risks as any
        };

        const decision = {
          ...validTechnicalDecision,
          alternatives: [alternative]
        };

        const result = validateTechnicalDecision(decision);
        expect(result.valid).toBe(shouldBeValid);
      });
    });
  });

  describe('Decision Impact Validation', () => {
    it('应该验证影响评估', () => {
      const validImpacts: DecisionImpact[] = [
        {
          scope: 'low',
          reversibility: 'high',
          timeToImplement: 5,
          affectedComponents: ['component1'],
          stakeholders: ['team1']
        },
        {
          scope: 'high',
          reversibility: 'low',
          timeToImplement: 90,
          affectedComponents: ['frontend', 'backend', 'database', 'infrastructure'],
          stakeholders: ['dev-team', 'qa-team', 'ops-team', 'product-team'],
          estimatedCost: 50000,
          riskLevel: 'medium'
        }
      ];

      validImpacts.forEach(impact => {
        const decision = { ...validTechnicalDecision, impact };
        expect(validateTechnicalDecision(decision).valid).toBe(true);
      });

      const invalidImpacts = [
        { scope: 'invalid', reversibility: 'high', timeToImplement: 5 }, // 无效范围
        { scope: 'low', reversibility: 'invalid', timeToImplement: 5 }, // 无效可逆性
        { scope: 'low', reversibility: 'high', timeToImplement: -1 }, // 负实施时间
        { scope: 'low', reversibility: 'high', timeToImplement: 'invalid' }, // 非数字时间
        { scope: 'low', reversibility: 'high', timeToImplement: 5, affectedComponents: 'not array' }
      ];

      invalidImpacts.forEach(impact => {
        const decision = { ...validTechnicalDecision, impact: impact as any };
        const result = validateTechnicalDecision(decision);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证受影响组件和利益相关者', () => {
      const componentTests = [
        {
          affectedComponents: ['frontend'],
          stakeholders: ['dev-team'],
          shouldBeValid: true
        },
        {
          affectedComponents: [],
          stakeholders: ['team'],
          shouldBeValid: false // 必须有受影响的组件
        },
        {
          affectedComponents: ['component'],
          stakeholders: [],
          shouldBeValid: false // 必须有利益相关者
        },
        {
          affectedComponents: [''], // 空组件名
          stakeholders: ['team'],
          shouldBeValid: false
        }
      ];

      componentTests.forEach(({ affectedComponents, stakeholders, shouldBeValid }) => {
        const impact = {
          scope: 'medium',
          reversibility: 'medium',
          timeToImplement: 10,
          affectedComponents,
          stakeholders
        };

        const decision = { ...validTechnicalDecision, impact };
        const result = validateTechnicalDecision(decision);
        expect(result.valid).toBe(shouldBeValid);
      });
    });
  });

  describe('Decision Scoring and Analysis', () => {
    it('应该正确计算决策分数', () => {
      const scoringTests = [
        {
          alternative: {
            ...validAlternative,
            pros: ['优点1', '优点2', '优点3'],
            cons: ['缺点1'],
            effort: { development: 'low', maintenance: 'low', learning: 'low' },
            risks: []
          },
          expectedRange: [80, 100]
        },
        {
          alternative: {
            ...validAlternative,
            pros: ['优点1'],
            cons: ['缺点1', '缺点2', '缺点3'],
            effort: { development: 'high', maintenance: 'high', learning: 'high' },
            risks: [
              { description: '高风险', severity: 'high', probability: 'high', mitigation: '策略' }
            ]
          },
          expectedRange: [20, 50]
        }
      ];

      scoringTests.forEach(({ alternative, expectedRange }) => {
        const score = calculateDecisionScore(alternative);
        expect(score).toBeGreaterThanOrEqual(expectedRange[0]);
        expect(score).toBeLessThanOrEqual(expectedRange[1]);
      });
    });

    it('应该生成决策时间线', () => {
      const decision = {
        ...validTechnicalDecision,
        status: 'implemented' as DecisionStatus,
        metadata: {
          ...validTechnicalDecision.metadata,
          approvedDate: new Date('2024-01-02T00:00:00Z'),
          implementedDate: new Date('2024-01-15T00:00:00Z')
        }
      };

      const timeline = getDecisionTimeline(decision);

      expect(timeline.length).toBeGreaterThan(0);
      expect(timeline[0].status).toBe('proposed');
      expect(timeline.some(entry => entry.status === 'approved')).toBe(true);
      expect(timeline.some(entry => entry.status === 'implemented')).toBe(true);

      // 验证时间线顺序
      for (let i = 1; i < timeline.length; i++) {
        expect(timeline[i].date.getTime()).toBeGreaterThanOrEqual(timeline[i-1].date.getTime());
      }
    });

    it('应该验证决策选择的一致性', () => {
      // 选择的备选方案应该在备选方案列表中
      const validSelection = {
        ...validTechnicalDecision,
        selectedAlternative: 'alt-001'
      };
      expect(validateTechnicalDecision(validSelection).valid).toBe(true);

      // 选择不存在的备选方案
      const invalidSelection = {
        ...validTechnicalDecision,
        selectedAlternative: 'non-existent-alt'
      };
      const result = validateTechnicalDecision(invalidSelection);
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.field === 'selectedAlternative')).toBe(true);
    });
  });

  describe('Factory Methods', () => {
    it('应该创建有效的 TechnicalDecision 实例', () => {
      const decisionData = {
        title: '新技术决策',
        description: '技术决策描述',
        category: 'technology' as DecisionCategory,
        context: {
          problem: '需要解决的问题',
          requirements: ['需求1', '需求2'],
          constraints: ['约束1', '约束2']
        },
        alternatives: [
          {
            id: 'alt-1',
            title: '方案1',
            description: '方案1描述',
            pros: ['优点1'],
            cons: ['缺点1'],
            effort: {
              development: 'medium',
              maintenance: 'low',
              learning: 'low'
            },
            risks: [],
            score: 70
          }
        ],
        decisionMakers: ['maker1']
      };

      const decision = createTechnicalDecision(decisionData);

      expect(isTechnicalDecision(decision)).toBe(true);
      expect(decision.title).toBe(decisionData.title);
      expect(decision.category).toBe(decisionData.category);
      expect(decision.context).toEqual(decisionData.context);
      expect(decision.alternatives).toEqual(decisionData.alternatives);
      expect(decision.decisionMakers).toEqual(decisionData.decisionMakers);
      expect(decision.status).toBe('proposed');
      expect(decision.id).toMatch(/^decision-\d+$/);
      expect(decision.createdAt).toBeInstanceOf(Date);
      expect(decision.updatedAt).toBeInstanceOf(Date);
    });

    it('应该接受可选参数覆盖默认值', () => {
      const customData = {
        title: '自定义决策',
        description: '自定义描述',
        category: 'architecture' as DecisionCategory,
        context: {
          problem: '问题',
          requirements: ['需求'],
          constraints: ['约束']
        },
        alternatives: [],
        decisionMakers: ['maker'],
        id: 'custom-decision-id',
        status: 'approved' as DecisionStatus,
        selectedAlternative: 'alt-1',
        rationale: '选择理由'
      };

      const decision = createTechnicalDecision(customData);

      expect(decision.id).toBe(customData.id);
      expect(decision.status).toBe(customData.status);
      expect(decision.selectedAlternative).toBe(customData.selectedAlternative);
      expect(decision.rationale).toBe(customData.rationale);
    });

    it('应该生成唯一的决策 ID', () => {
      const ids = new Set();

      for (let i = 0; i < 50; i++) {
        const decision = createTechnicalDecision({
          title: `决策 ${i}`,
          description: '描述',
          category: 'technology',
          context: {
            problem: '问题',
            requirements: ['需求'],
            constraints: ['约束']
          },
          alternatives: [],
          decisionMakers: ['maker']
        });

        expect(ids.has(decision.id)).toBe(false);
        ids.add(decision.id);
      }
    });

    it('应该验证工厂方法的输入参数', () => {
      const invalidInputs = [
        { title: '', description: '描述', category: 'technology' }, // 空标题
        { title: '标题', description: '', category: 'technology' }, // 空描述
        { title: '标题', description: '描述', category: 'invalid' }, // 无效分类
        { title: '标题', description: '描述', category: 'technology', context: null }, // 空上下文
        { title: '标题', description: '描述', category: 'technology', decisionMakers: [] } // 空决策者
      ];

      invalidInputs.forEach(input => {
        expect(() => createTechnicalDecision(input as any)).toThrow();
      });
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('应该处理大量备选方案', () => {
      const manyAlternatives = Array.from({ length: 20 }, (_, i) => ({
        id: `alt-${i}`,
        title: `备选方案 ${i}`,
        description: `方案 ${i} 的详细描述`,
        pros: [`优点 ${i}-1`, `优点 ${i}-2`],
        cons: [`缺点 ${i}-1`],
        effort: {
          development: 'medium',
          maintenance: 'low',
          learning: 'low'
        },
        risks: [],
        score: 50 + i
      }));

      const decision = {
        ...validTechnicalDecision,
        alternatives: manyAlternatives
      };

      const result = validateTechnicalDecision(decision);
      expect(result.valid).toBe(true);
    });

    it('应该处理复杂的决策上下文', () => {
      const complexContext = {
        problem: `
          现有系统面临多重挑战：
          1. 性能瓶颈 - 响应时间超过 2 秒
          2. 可扩展性问题 - 无法支持超过 100 并发用户
          3. 维护成本高 - 代码耦合度高，修改困难
          4. 安全性不足 - 存在多个已知漏洞
        `,
        requirements: [
          '性能要求：平均响应时间 < 500ms，95% 请求 < 1s',
          '可扩展性：支持 1000+ 并发用户，水平扩展能力',
          '安全性：符合 OWASP Top 10 安全标准',
          '可维护性：代码覆盖率 > 80%，文档完整',
          '兼容性：支持 Chrome 80+, Firefox 75+, Safari 13+',
          '国际化：支持中文、英文、日文'
        ],
        constraints: [
          '预算约束：总开发成本不超过 200万人民币',
          '时间约束：必须在 12 个月内完成并上线',
          '人力约束：核心开发团队不超过 10 人',
          '技术约束：必须与现有 Oracle 数据库兼容',
          '运维约束：必须支持 Kubernetes 部署',
          '合规约束：符合 GDPR 和网络安全法要求'
        ],
        assumptions: [
          '团队具备 React 和 Node.js 开发经验',
          '云基础设施可用性达到 99.9%',
          '第三方服务 API 稳定性良好',
          '用户增长符合预期（年增长率 50%）'
        ],
        goals: [
          '提升用户体验和满意度',
          '降低系统维护成本',
          '增强系统安全性和可靠性',
          '支持业务快速发展需求'
        ]
      };

      const decision = {
        ...validTechnicalDecision,
        context: complexContext
      };

      const result = validateTechnicalDecision(decision);
      expect(result.valid).toBe(true);
    });

    it('应该处理特殊字符和多语言内容', () => {
      const multilingualDecision = {
        ...validTechnicalDecision,
        title: 'Multi-language Decision 多语言技术决策',
        description: 'Decision with émojis 🚀 and special chars @#$%',
        rationale: '选择理由包含中文、English、and special symbols ñáéíóú',
        alternatives: [
          {
            ...validAlternative,
            title: 'React + TypeScript 方案',
            description: 'Solution with "quotes" and special characters',
            pros: ['优点：强类型支持', 'Advantage: Large ecosystem'],
            cons: ['缺点：学习曲线', 'Disadvantage: Bundle size']
          }
        ]
      };

      const result = validateTechnicalDecision(multilingualDecision);
      expect(result.valid).toBe(true);
    });

    it('应该处理长期决策和复杂时间线', () => {
      const longTermDecision = {
        ...validTechnicalDecision,
        impact: {
          scope: 'high',
          reversibility: 'low',
          timeToImplement: 365, // 1年实施期
          affectedComponents: [
            'frontend', 'backend', 'database', 'infrastructure',
            'monitoring', 'logging', 'security', 'ci-cd'
          ],
          stakeholders: [
            'development-team', 'qa-team', 'devops-team', 'security-team',
            'product-team', 'management', 'end-users', 'compliance-team'
          ],
          estimatedCost: 5000000,
          riskLevel: 'high'
        },
        metadata: {
          ...validTechnicalDecision.metadata,
          implementationDeadline: new Date('2025-12-31T00:00:00Z'),
          reviewDate: new Date('2025-06-30T00:00:00Z'),
          confidenceLevel: 'medium'
        }
      };

      const result = validateTechnicalDecision(longTermDecision);
      expect(result.valid).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    it('应该高效处理决策验证', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const decision = {
          ...validTechnicalDecision,
          id: `performance-test-${i}`
        };

        validateTechnicalDecision(decision);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 100 次验证应该在 200ms 内完成
      expect(duration).toBeLessThan(200);
    });

    it('应该高效计算决策分数', () => {
      const complexAlternative = {
        ...validAlternative,
        pros: Array.from({ length: 50 }, (_, i) => `优点 ${i}`),
        cons: Array.from({ length: 30 }, (_, i) => `缺点 ${i}`),
        risks: Array.from({ length: 20 }, (_, i) => ({
          description: `风险 ${i}`,
          severity: 'medium',
          probability: 'medium',
          mitigation: `策略 ${i}`
        }))
      };

      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        calculateDecisionScore(complexAlternative);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 大量评分计算应该在合理时间内完成
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('应该提供详细的验证错误信息', () => {
      const invalidDecision = {
        ...validTechnicalDecision,
        category: 'invalid-category',
        context: {
          problem: '', // 空问题
          requirements: [], // 空需求
          constraints: ['约束']
        },
        alternatives: [
          { id: '', title: 'test', description: 'test' } // 空ID
        ],
        selectedAlternative: 'non-existent' // 不存在的选择
      };

      const result = validateTechnicalDecision(invalidDecision);

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

    it('应该处理分数计算的异常情况', () => {
      const edgeCases = [
        { ...validAlternative, pros: undefined },
        { ...validAlternative, cons: undefined },
        { ...validAlternative, effort: undefined },
        { ...validAlternative, risks: undefined },
        null,
        undefined
      ];

      edgeCases.forEach(alternative => {
        expect(() => calculateDecisionScore(alternative as any)).not.toThrow();

        if (alternative !== null && alternative !== undefined) {
          const score = calculateDecisionScore(alternative as any);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        }
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
        expect(() => validateTechnicalDecision(input as any)).not.toThrow();
        expect(() => isTechnicalDecision(input as any)).not.toThrow();

        const isValid = isTechnicalDecision(input as any);
        expect(isValid).toBe(false);
      });
    });
  });
});