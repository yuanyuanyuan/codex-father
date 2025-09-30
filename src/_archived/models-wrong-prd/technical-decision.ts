/**
 * T015: TechnicalDecision 数据模型
 *
 * 技术决策实体，记录和追踪技术方案选择
 * 支持方案对比、成本估算、风险评估和实施追踪
 */

// 决策状态枚举
export type DecisionStatus =
  | 'proposed' // 已提议 - 初始状态，方案已提出
  | 'under_review' // 审查中 - 正在评估和讨论
  | 'decided' // 已决策 - 已选择方案
  | 'implementing' // 实施中 - 正在执行选定方案
  | 'implemented' // 已实施 - 方案已完成实施
  | 'superseded' // 已替代 - 被新方案替代
  | 'deprecated' // 已废弃 - 方案不再使用
  | 'cancelled'; // 已取消 - 决策被取消

// 风险等级枚举
export type RiskLevel =
  | 'low' // 低风险
  | 'medium' // 中等风险
  | 'high' // 高风险
  | 'critical'; // 严重风险

// 成本类型枚举
export type CostType =
  | 'development' // 开发成本
  | 'maintenance' // 维护成本
  | 'infrastructure' // 基础设施成本
  | 'training' // 培训成本
  | 'migration' // 迁移成本
  | 'opportunity'; // 机会成本

// 优先级枚举
export type PriorityLevel =
  | 'low' // 低优先级
  | 'medium' // 中等优先级
  | 'high' // 高优先级
  | 'critical'; // 关键优先级

// 成本估算接口
export interface CostEstimate {
  development: number; // 开发成本（工时）
  maintenance: number; // 维护成本（月/工时）
  infrastructure: number; // 基础设施成本
  training: number; // 培训成本
  migration: number; // 迁移成本
  currency: string; // 货币单位
  confidence: number; // 估算信心度（0-1）
  assumptions: string[]; // 成本估算假设
  breakdown: CostBreakdown[]; // 成本明细
}

// 成本明细接口
export interface CostBreakdown {
  category: CostType; // 成本类别
  description: string; // 成本描述
  amount: number; // 金额
  unit: string; // 单位（小时/天/月等）
  notes?: string; // 备注
}

// 风险评估接口
export interface RiskAssessment {
  technical: RiskLevel; // 技术风险
  business: RiskLevel; // 业务风险
  timeline: RiskLevel; // 时间风险
  maintenance: RiskLevel; // 维护风险
  security: RiskLevel; // 安全风险
  compliance: RiskLevel; // 合规风险
  mitigation: string[]; // 风险缓解措施
  contingency: string[]; // 应急预案
  riskMatrix: RiskMatrixItem[]; // 风险矩阵
}

// 风险矩阵项接口
export interface RiskMatrixItem {
  risk: string; // 风险描述
  probability: number; // 发生概率（0-1）
  impact: RiskLevel; // 影响程度
  mitigation: string; // 缓解措施
  owner: string; // 风险负责人
}

// 实施步骤接口
export interface ImplementationStep {
  order: number; // 步骤序号
  title: string; // 步骤标题
  description: string; // 步骤描述
  estimatedTime: string; // 预估时间
  assignee?: string; // 负责人
  dependencies: number[]; // 依赖步骤序号
  deliverables: string[]; // 交付物
  criteria: string[]; // 完成标准
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'; // 步骤状态
  startDate?: Date; // 开始时间
  endDate?: Date; // 结束时间
  notes?: string; // 备注
}

// 实施说明接口
export interface ImplementationNotes {
  prerequisites: string[]; // 前置条件
  steps: ImplementationStep[]; // 实施步骤
  verification: string[]; // 验证方法
  rollback: string[]; // 回滚方案
  timeline: string; // 时间安排
  resources: ResourceRequirement[]; // 资源需求
  constraints: string[]; // 约束条件
  successCriteria: string[]; // 成功标准
}

// 资源需求接口
export interface ResourceRequirement {
  type: 'human' | 'infrastructure' | 'software' | 'hardware'; // 资源类型
  description: string; // 资源描述
  quantity: number; // 数量
  unit: string; // 单位
  duration?: string; // 使用时长
  cost?: number; // 成本
  availability: 'available' | 'needs_procurement' | 'uncertain'; // 可用性
}

// 技术债务评估接口
export interface TechnicalDebtAssessment {
  currentDebt: string[]; // 当前技术债务
  newDebt: string[]; // 新增技术债务
  debtReduction: string[]; // 减少的技术债务
  paybackPeriod?: number; // 偿还周期（月）
  impact: 'positive' | 'negative' | 'neutral'; // 对技术债务的整体影响
}

// 决策选项接口
export interface DecisionOption {
  id: string; // 选项ID
  title: string; // 选项标题
  description: string; // 详细描述
  pros: string[]; // 优点列表
  cons: string[]; // 缺点列表
  cost: CostEstimate; // 成本估算
  risk: RiskAssessment; // 风险评估
  timeline: string; // 时间估算
  dependencies: string[]; // 依赖项
  implementation: ImplementationNotes; // 实施说明
  technicalDebt: TechnicalDebtAssessment; // 技术债务评估
  score?: number; // 综合评分（0-100）
  weight?: number; // 权重（0-1）
  metadata: OptionMetadata; // 选项元数据
}

// 选项元数据接口
export interface OptionMetadata {
  maturity: 'experimental' | 'emerging' | 'mature' | 'legacy'; // 技术成熟度
  complexity: 'low' | 'medium' | 'high'; // 复杂度
  maintainability: 'poor' | 'fair' | 'good' | 'excellent'; // 可维护性
  scalability: 'limited' | 'moderate' | 'high' | 'unlimited'; // 可扩展性
  community: 'small' | 'medium' | 'large' | 'enterprise'; // 社区支持
  documentation: 'poor' | 'fair' | 'good' | 'excellent'; // 文档质量
  licensing: string; // 许可证
  vendor?: string; // 供应商
  supportLevel?: string; // 支持级别
}

// 决策评估标准接口
export interface DecisionCriteria {
  id: string; // 标准ID
  name: string; // 标准名称
  description: string; // 标准描述
  weight: number; // 权重（0-1）
  scoreFunction: string; // 评分函数
  required: boolean; // 是否必须满足
}

// 决策历史记录接口
export interface DecisionHistory {
  timestamp: Date; // 时间戳
  action: string; // 操作类型
  actor: string; // 操作人
  details: string; // 操作详情
  changedFields: string[]; // 变更字段
  previousValues?: Record<string, any>; // 原值
  newValues?: Record<string, any>; // 新值
}

// 技术决策接口
export interface TechnicalDecision {
  id: string; // 决策ID
  draftId: string; // 关联文档ID
  title: string; // 决策标题
  description: string; // 决策描述
  context: string; // 决策背景
  problem: string; // 要解决的问题
  goals: string[]; // 决策目标
  constraints: string[]; // 约束条件
  assumptions: string[]; // 假设条件
  options: DecisionOption[]; // 方案选项
  selectedOption?: string; // 选中方案ID
  rationale?: string; // 决策理由
  consequences: string[]; // 预期后果
  alternatives: string[]; // 被否决的替代方案
  status: DecisionStatus; // 决策状态
  priority: PriorityLevel; // 优先级
  stakeholders: string[]; // 利益相关者
  decisionDate?: Date; // 决策时间
  implementationStart?: Date; // 实施开始时间
  implementationEnd?: Date; // 实施结束时间
  reviewDate?: Date; // 计划复审时间
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
  createdBy: string; // 创建者
  criteria: DecisionCriteria[]; // 评估标准
  history: DecisionHistory[]; // 决策历史
  tags: string[]; // 标签
  relatedDecisions: string[]; // 相关决策ID
  metadata: DecisionMetadata; // 决策元数据
}

// 决策元数据接口
export interface DecisionMetadata {
  category: string; // 决策类别
  impact: 'low' | 'medium' | 'high'; // 影响范围
  reversibility: 'easy' | 'moderate' | 'difficult' | 'irreversible'; // 可逆性
  urgency: 'low' | 'medium' | 'high' | 'immediate'; // 紧急程度
  confidenceLevel: number; // 信心水平（0-1）
  dataQuality: 'poor' | 'fair' | 'good' | 'excellent'; // 数据质量
  consensusLevel: number; // 共识程度（0-1）
  estimatedROI?: number; // 预估投资回报率
  learningValue: 'low' | 'medium' | 'high'; // 学习价值
  architecturalSignificance: boolean; // 是否具有架构重要性
}

// TechnicalDecision 工具类
export class TechnicalDecisionManager {
  /**
   * 创建技术决策
   */
  static createDecision(
    draftId: string,
    title: string,
    description: string,
    context: string,
    problem: string,
    createdBy: string
  ): TechnicalDecision {
    const now = new Date();

    return {
      id: `decision-${draftId}-${Date.now()}`,
      draftId,
      title,
      description,
      context,
      problem,
      goals: [],
      constraints: [],
      assumptions: [],
      options: [],
      consequences: [],
      alternatives: [],
      status: 'proposed',
      priority: 'medium',
      stakeholders: [createdBy],
      createdAt: now,
      updatedAt: now,
      createdBy,
      criteria: this.getDefaultCriteria(),
      history: [
        {
          timestamp: now,
          action: 'created',
          actor: createdBy,
          details: 'Initial decision created',
          changedFields: [],
        },
      ],
      tags: [],
      relatedDecisions: [],
      metadata: {
        category: 'technical',
        impact: 'medium',
        reversibility: 'moderate',
        urgency: 'medium',
        confidenceLevel: 0.5,
        dataQuality: 'fair',
        consensusLevel: 0.5,
        learningValue: 'medium',
        architecturalSignificance: false,
      },
    };
  }

  /**
   * 获取默认评估标准
   */
  private static getDefaultCriteria(): DecisionCriteria[] {
    return [
      {
        id: 'technical-feasibility',
        name: '技术可行性',
        description: '技术方案的可实现性和成熟度',
        weight: 0.25,
        scoreFunction: 'maturity * feasibility',
        required: true,
      },
      {
        id: 'cost-effectiveness',
        name: '成本效益',
        description: '投入产出比和总体拥有成本',
        weight: 0.2,
        scoreFunction: 'value / total_cost',
        required: true,
      },
      {
        id: 'time-to-market',
        name: '上市时间',
        description: '实施速度和交付时间',
        weight: 0.15,
        scoreFunction: '1 / implementation_time',
        required: true,
      },
      {
        id: 'maintainability',
        name: '可维护性',
        description: '长期维护的难易程度',
        weight: 0.15,
        scoreFunction: 'maintainability_score',
        required: false,
      },
      {
        id: 'scalability',
        name: '可扩展性',
        description: '系统扩展能力',
        weight: 0.1,
        scoreFunction: 'scalability_score',
        required: false,
      },
      {
        id: 'risk-level',
        name: '风险水平',
        description: '整体风险评估',
        weight: 0.15,
        scoreFunction: '1 - risk_score',
        required: true,
      },
    ];
  }

  /**
   * 添加决策选项
   */
  static addOption(
    decision: TechnicalDecision,
    option: Omit<DecisionOption, 'id' | 'metadata'>
  ): DecisionOption {
    const fullOption: DecisionOption = {
      ...option,
      id: `option-${decision.id}-${Date.now()}`,
      metadata: {
        maturity: 'emerging',
        complexity: 'medium',
        maintainability: 'fair',
        scalability: 'moderate',
        community: 'medium',
        documentation: 'fair',
        licensing: 'unknown',
      },
    };

    decision.options.push(fullOption);
    decision.updatedAt = new Date();

    this.addHistory(decision, 'option_added', decision.createdBy, `Added option: ${option.title}`, [
      'options',
    ]);

    return fullOption;
  }

  /**
   * 选择方案
   */
  static selectOption(
    decision: TechnicalDecision,
    optionId: string,
    rationale: string,
    selectedBy: string
  ): boolean {
    const option = decision.options.find((o) => o.id === optionId);
    if (!option) {
      return false;
    }

    const previousSelection = decision.selectedOption;
    decision.selectedOption = optionId;
    decision.rationale = rationale;
    decision.status = 'decided';
    decision.decisionDate = new Date();
    decision.updatedAt = new Date();

    this.addHistory(
      decision,
      'option_selected',
      selectedBy,
      `Selected option: ${option.title}`,
      ['selectedOption', 'rationale', 'status', 'decisionDate'],
      { selectedOption: previousSelection },
      { selectedOption: optionId, rationale, status: 'decided' }
    );

    return true;
  }

  /**
   * 更新实施状态
   */
  static updateImplementationStatus(
    decision: TechnicalDecision,
    status: DecisionStatus,
    updatedBy: string,
    notes?: string
  ): boolean {
    const validTransitions: Record<DecisionStatus, DecisionStatus[]> = {
      proposed: ['under_review', 'cancelled'],
      under_review: ['decided', 'cancelled'],
      decided: ['implementing', 'cancelled'],
      implementing: ['implemented', 'cancelled'],
      implemented: ['superseded', 'deprecated'],
      superseded: [],
      deprecated: [],
      cancelled: [],
    };

    const allowedStatuses = validTransitions[decision.status];
    if (!allowedStatuses.includes(status)) {
      return false;
    }

    const previousStatus = decision.status;
    decision.status = status;
    decision.updatedAt = new Date();

    if (status === 'implementing' && !decision.implementationStart) {
      decision.implementationStart = new Date();
    }

    if (status === 'implemented' && !decision.implementationEnd) {
      decision.implementationEnd = new Date();
    }

    this.addHistory(
      decision,
      'status_updated',
      updatedBy,
      notes || `Status changed from ${previousStatus} to ${status}`,
      ['status'],
      { status: previousStatus },
      { status }
    );

    return true;
  }

  /**
   * 计算选项综合评分
   */
  static calculateOptionScore(option: DecisionOption, criteria: DecisionCriteria[]): number {
    let totalScore = 0;
    let totalWeight = 0;

    for (const criterion of criteria) {
      const weight = criterion.weight;
      let score = 0;

      // 简化的评分计算（实际应该基于criterion.scoreFunction）
      switch (criterion.id) {
        case 'technical-feasibility':
          score =
            this.getMaturityScore(option.metadata.maturity) * 0.7 +
            this.getComplexityScore(option.metadata.complexity) * 0.3;
          break;
        case 'cost-effectiveness':
          score = this.calculateCostScore(option.cost);
          break;
        case 'time-to-market':
          score = this.calculateTimelineScore(option.timeline);
          break;
        case 'maintainability':
          score = this.getMaintainabilityScore(option.metadata.maintainability);
          break;
        case 'scalability':
          score = this.getScalabilityScore(option.metadata.scalability);
          break;
        case 'risk-level':
          score = this.calculateRiskScore(option.risk);
          break;
        default:
          score = 0.5; // 默认中等评分
      }

      totalScore += score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
  }

  /**
   * 获取技术成熟度评分
   */
  private static getMaturityScore(maturity: string): number {
    switch (maturity) {
      case 'experimental':
        return 0.3;
      case 'emerging':
        return 0.6;
      case 'mature':
        return 0.9;
      case 'legacy':
        return 0.4;
      default:
        return 0.5;
    }
  }

  /**
   * 获取复杂度评分（复杂度越低评分越高）
   */
  private static getComplexityScore(complexity: string): number {
    switch (complexity) {
      case 'low':
        return 0.9;
      case 'medium':
        return 0.6;
      case 'high':
        return 0.3;
      default:
        return 0.5;
    }
  }

  /**
   * 计算成本评分
   */
  private static calculateCostScore(cost: CostEstimate): number {
    const totalCost =
      cost.development +
      cost.maintenance * 12 +
      cost.infrastructure +
      cost.training +
      cost.migration;

    // 简化的成本评分：成本越低评分越高
    // 实际应该基于预算和相对成本来计算
    if (totalCost < 1000) {
      return 0.9;
    }
    if (totalCost < 5000) {
      return 0.7;
    }
    if (totalCost < 10000) {
      return 0.5;
    }
    return 0.3;
  }

  /**
   * 计算时间线评分
   */
  private static calculateTimelineScore(timeline: string): number {
    // 从时间线字符串中提取时间（简化实现）
    const months = this.extractMonthsFromTimeline(timeline);

    if (months <= 1) {
      return 0.9;
    }
    if (months <= 3) {
      return 0.7;
    }
    if (months <= 6) {
      return 0.5;
    }
    return 0.3;
  }

  /**
   * 从时间线字符串提取月数
   */
  private static extractMonthsFromTimeline(timeline: string): number {
    const monthMatch = timeline.match(/(\d+)\s*月/);
    if (monthMatch) {
      return parseInt(monthMatch[1]);
    }

    const weekMatch = timeline.match(/(\d+)\s*周/);
    if (weekMatch) {
      return parseInt(weekMatch[1]) / 4;
    }

    return 3; // 默认3个月
  }

  /**
   * 获取可维护性评分
   */
  private static getMaintainabilityScore(maintainability: string): number {
    switch (maintainability) {
      case 'excellent':
        return 0.9;
      case 'good':
        return 0.7;
      case 'fair':
        return 0.5;
      case 'poor':
        return 0.3;
      default:
        return 0.5;
    }
  }

  /**
   * 获取可扩展性评分
   */
  private static getScalabilityScore(scalability: string): number {
    switch (scalability) {
      case 'unlimited':
        return 0.9;
      case 'high':
        return 0.7;
      case 'moderate':
        return 0.5;
      case 'limited':
        return 0.3;
      default:
        return 0.5;
    }
  }

  /**
   * 计算风险评分
   */
  private static calculateRiskScore(risk: RiskAssessment): number {
    const riskValues = {
      low: 0.1,
      medium: 0.3,
      high: 0.6,
      critical: 0.9,
    };

    const totalRisk =
      (riskValues[risk.technical] +
        riskValues[risk.business] +
        riskValues[risk.timeline] +
        riskValues[risk.maintenance] +
        riskValues[risk.security] +
        riskValues[risk.compliance]) /
      6;

    return 1 - totalRisk; // 风险越低评分越高
  }

  /**
   * 添加历史记录
   */
  private static addHistory(
    decision: TechnicalDecision,
    action: string,
    actor: string,
    details: string,
    changedFields: string[],
    previousValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): void {
    decision.history.push({
      timestamp: new Date(),
      action,
      actor,
      details,
      changedFields,
      previousValues,
      newValues,
    });
  }

  /**
   * 验证技术决策数据
   */
  static validateDecision(decision: Partial<TechnicalDecision>): string[] {
    const errors: string[] = [];

    if (!decision.title || decision.title.length < 5 || decision.title.length > 200) {
      errors.push('决策标题必须在5-200字符之间');
    }

    if (!decision.context) {
      errors.push('决策背景不能为空');
    }

    if (!decision.problem) {
      errors.push('问题描述不能为空');
    }

    if (decision.options && decision.options.length < 2) {
      errors.push('至少需要2个选项进行对比');
    }

    if (decision.selectedOption && decision.options) {
      const selectedExists = decision.options.some((o) => o.id === decision.selectedOption);
      if (!selectedExists) {
        errors.push('选中的方案ID必须是有效的选项');
      }
    }

    if (decision.options) {
      for (const option of decision.options) {
        if (option.cost) {
          const costFields = [
            option.cost.development,
            option.cost.maintenance,
            option.cost.infrastructure,
            option.cost.training,
            option.cost.migration,
          ];
          if (costFields.some((cost) => cost < 0)) {
            errors.push('成本估算字段必须为非负数');
          }
        }
      }
    }

    return errors;
  }

  /**
   * 生成决策报告
   */
  static generateDecisionReport(decision: TechnicalDecision): string {
    const selectedOption = decision.selectedOption
      ? decision.options.find((o) => o.id === decision.selectedOption)
      : null;

    const report = [
      `# 技术决策报告: ${decision.title}`,
      '',
      `**决策ID**: ${decision.id}`,
      `**状态**: ${decision.status}`,
      `**优先级**: ${decision.priority}`,
      `**创建时间**: ${decision.createdAt.toLocaleDateString()}`,
      decision.decisionDate ? `**决策时间**: ${decision.decisionDate.toLocaleDateString()}` : '',
      '',
      '## 问题背景',
      decision.context,
      '',
      '## 需要解决的问题',
      decision.problem,
      '',
      '## 候选方案',
      ...decision.options.map(
        (option) =>
          `### ${option.title}\n${option.description}\n\n**优点**:\n${option.pros.map((p) => `- ${p}`).join('\n')}\n\n**缺点**:\n${option.cons.map((c) => `- ${c}`).join('\n')}\n`
      ),
      '',
      selectedOption ? '## 选定方案' : '## 待决策',
      selectedOption ? `**选定**: ${selectedOption.title}` : '尚未选择方案',
      decision.rationale ? `**理由**: ${decision.rationale}` : '',
      '',
      '## 预期后果',
      ...decision.consequences.map((c) => `- ${c}`),
      '',
    ]
      .filter((line) => line !== '')
      .join('\n');

    return report;
  }
}
