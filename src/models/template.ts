/**
 * T012: Template 数据模型
 *
 * 模板配置实体，定义PRD文档的结构和字段
 * 支持自定义模板、章节定义、字段配置和决策表格
 */

import { UserRole, RoleType } from './user-role.js';

// 字段验证规则接口
export interface FieldValidation {
  required?: boolean; // 是否必填
  minLength?: number; // 最小长度
  maxLength?: number; // 最大长度
  pattern?: string; // 正则表达式
  min?: number; // 最小值（数字类型）
  max?: number; // 最大值（数字类型）
  customValidator?: string; // 自定义验证器名称
}

// 模板字段定义接口
export interface TemplateFieldDef {
  id: string; // 字段ID，在模板内唯一
  name: string; // 字段名称
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'textarea' | 'boolean'; // 字段类型
  label: string; // 字段标签（显示名称）
  placeholder?: string; // 占位符文本
  helpText?: string; // 帮助文本
  isRequired: boolean; // 是否必填
  defaultValue?: any; // 默认值
  options?: string[]; // 选择项（select/multiselect类型）
  validation?: FieldValidation; // 验证规则
  order: number; // 字段排序
  group?: string; // 字段分组
}

// 模板规则接口
export interface TemplateRule {
  id: string; // 规则ID
  name: string; // 规则名称
  description: string; // 规则描述
  type: 'validation' | 'workflow' | 'permission' | 'format'; // 规则类型
  condition: string; // 规则条件（表达式）
  action: string; // 规则动作
  isActive: boolean; // 是否启用
  priority: number; // 优先级
}

// 决策列定义接口
export interface DecisionColumn {
  id: string; // 列ID
  title: string; // 列标题
  type: 'text' | 'score' | 'boolean' | 'link' | 'rating' | 'currency'; // 列类型
  width?: string; // 列宽度（CSS格式，如 "120px", "20%"）
  sortable: boolean; // 是否可排序
  editable: boolean; // 是否可编辑
  required: boolean; // 是否必填
  options?: string[]; // 选择项（针对某些类型）
  format?: string; // 格式化模板
}

// 决策表格定义接口
export interface DecisionTableDef {
  id: string; // 表格定义ID
  name: string; // 表格名称
  description?: string; // 表格描述
  columns: DecisionColumn[]; // 列定义
  template: string; // Markdown表格模板
  minRows: number; // 最少行数
  maxRows: number; // 最多行数
  allowAddRows: boolean; // 是否允许添加行
  allowDeleteRows: boolean; // 是否允许删除行
}

// 模板章节定义接口
export interface TemplateSectionDef {
  id: string; // 章节定义ID
  title: string; // 默认章节标题
  description: string; // 章节说明
  order: number; // 默认排序
  level: number; // 层级深度（1-6，对应H1-H6）
  isRequired: boolean; // 是否必须包含
  defaultContent?: string; // 默认内容模板
  fields?: TemplateFieldDef[]; // 章节自定义字段
  editableBy: RoleType[]; // 允许编辑的角色
  visibleTo: RoleType[]; // 可见角色（为空表示所有角色可见）
  contentTemplate?: string; // 内容模板（Markdown格式）
  helpText?: string; // 章节帮助文本
  icon?: string; // 章节图标
}

// 模板结构定义接口
export interface TemplateStructure {
  sections: TemplateSectionDef[]; // 预定义章节
  fields: TemplateFieldDef[]; // 全局自定义字段
  rules: TemplateRule[]; // 验证规则
  decisionTables: DecisionTableDef[]; // 决策对比表格定义
  globalSettings: TemplateGlobalSettings; // 全局设置
}

// 模板全局设置接口
export interface TemplateGlobalSettings {
  allowCustomSections: boolean; // 是否允许自定义章节
  requireAllSections: boolean; // 是否要求所有章节都必填
  autoNumbering: boolean; // 是否自动编号
  defaultLanguage: string; // 默认语言
  maxContentLength: number; // 最大内容长度
  enableVersioning: boolean; // 是否启用版本控制
  enableComments: boolean; // 是否启用评论
  watermark?: string; // 水印文本
}

// 模板接口
export interface Template {
  id: string; // 模板ID
  name: string; // 模板名称（唯一）
  displayName: string; // 显示名称
  description: string; // 模板描述
  version: string; // 模板版本（semver格式）
  category: string; // 模板类别
  tags: string[]; // 模板标签
  isDefault: boolean; // 是否默认模板
  isPublic: boolean; // 是否公开模板
  structure: TemplateStructure; // 模板结构定义
  metadata: TemplateMetadata; // 模板元数据
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
  createdBy: string; // 创建者ID
}

// 模板元数据接口
export interface TemplateMetadata {
  usage: number; // 使用次数
  rating: number; // 用户评分（0-5）
  ratingCount: number; // 评分人数
  downloadCount: number; // 下载次数
  lastUsed?: Date; // 最后使用时间
  estimatedTime: number; // 预估完成时间（分钟）
  difficulty: 'beginner' | 'intermediate' | 'advanced'; // 难度等级
  targetAudience: RoleType[]; // 目标用户角色
  prerequisites: string[]; // 前置条件
  relatedTemplates: string[]; // 相关模板ID
}

// 内置模板类型
export type BuiltinTemplateType = 'technical' | 'business' | 'feature' | 'security' | 'api';

// 内置模板配置
export const BUILTIN_TEMPLATES: Record<BuiltinTemplateType, Partial<Template>> = {
  technical: {
    name: 'technical',
    displayName: 'Technical Architecture PRD',
    description: '技术架构类PRD模板，适用于系统设计和技术方案文档',
    category: 'technical',
    tags: ['架构', '技术', '系统设计'],
    structure: {
      sections: [
        {
          id: 'overview',
          title: '概述',
          description: '项目背景、目标和整体概述',
          order: 1,
          level: 2,
          isRequired: true,
          editableBy: ['architect', 'product_manager'],
          visibleTo: [],
          contentTemplate: `### 背景\n\n### 目标\n\n### 范围\n\n`,
        },
        {
          id: 'architecture',
          title: '技术架构',
          description: '系统架构设计和技术选型',
          order: 2,
          level: 2,
          isRequired: true,
          editableBy: ['architect'],
          visibleTo: [],
          contentTemplate: `### 系统架构\n\n### 技术选型\n\n### 部署架构\n\n`,
        },
        {
          id: 'implementation',
          title: '实施方案',
          description: '具体实施计划和开发安排',
          order: 3,
          level: 2,
          isRequired: true,
          editableBy: ['architect', 'developer'],
          visibleTo: [],
          contentTemplate: `### 开发计划\n\n### 部署策略\n\n### 风险控制\n\n`,
        },
        {
          id: 'security',
          title: '安全考虑',
          description: '安全设计和防护措施',
          order: 4,
          level: 2,
          isRequired: true,
          editableBy: ['architect'],
          visibleTo: [],
          contentTemplate: `### 安全架构\n\n### 认证授权\n\n### 数据保护\n\n`,
        },
        {
          id: 'performance',
          title: '性能指标',
          description: '性能要求和优化方案',
          order: 5,
          level: 2,
          isRequired: true,
          editableBy: ['architect', 'developer'],
          visibleTo: [],
          contentTemplate: `### 性能要求\n\n| 指标 | 目标值 |\n| ---- | ------ |\n| 响应时间 | < 200ms |\n| 并发量 | 1000+ |\n\n`,
        },
        {
          id: 'testing',
          title: '测试策略',
          description: '测试计划和质量保证',
          order: 6,
          level: 2,
          isRequired: true,
          editableBy: ['architect', 'tester'],
          visibleTo: [],
          contentTemplate: `### 测试计划\n\n### 质量标准\n\n### 自动化测试\n\n`,
        },
      ],
      fields: [],
      rules: [],
      decisionTables: [],
      globalSettings: {
        allowCustomSections: true,
        requireAllSections: false,
        autoNumbering: true,
        defaultLanguage: 'zh-CN',
        maxContentLength: 10485760, // 10MB
        enableVersioning: true,
        enableComments: true,
      },
    },
  },

  business: {
    name: 'business',
    displayName: 'Business Requirements PRD',
    description: '业务需求类PRD模板，适用于产品规划和业务分析',
    category: 'business',
    tags: ['业务', '需求', '产品'],
    structure: {
      sections: [
        {
          id: 'market',
          title: '市场分析',
          description: '市场机会和竞品分析',
          order: 1,
          level: 2,
          isRequired: true,
          editableBy: ['product_manager'],
          visibleTo: [],
          contentTemplate: `### 市场机会\n\n### 竞品分析\n\n| 竞品 | 优势 | 劣势 |\n| ---- | ---- | ---- |\n| | | |\n\n`,
        },
        {
          id: 'requirements',
          title: '业务需求',
          description: '详细的功能和非功能需求',
          order: 2,
          level: 2,
          isRequired: true,
          editableBy: ['product_manager'],
          visibleTo: [],
          contentTemplate: `### 功能需求\n\n### 非功能需求\n\n### 约束条件\n\n`,
        },
        {
          id: 'stakeholders',
          title: '利益相关者',
          description: '相关团队和人员职责',
          order: 3,
          level: 2,
          isRequired: true,
          editableBy: ['product_manager'],
          visibleTo: [],
          contentTemplate: `### 内部团队\n\n### 外部伙伴\n\n### 决策层\n\n`,
        },
        {
          id: 'success_metrics',
          title: '成功指标',
          description: 'KPI指标和成功标准',
          order: 4,
          level: 2,
          isRequired: true,
          editableBy: ['product_manager'],
          visibleTo: [],
          contentTemplate: `### KPI指标\n\n| KPI | 目标值 | 时间点 |\n| --- | ------ | ------ |\n| | | |\n\n`,
        },
        {
          id: 'timeline',
          title: '时间规划',
          description: '项目时间安排和里程碑',
          order: 5,
          level: 2,
          isRequired: true,
          editableBy: ['product_manager'],
          visibleTo: [],
          contentTemplate: `### 里程碑\n\n| 阶段 | 交付物 | 时间 |\n| ---- | ------ | ---- |\n| | | |\n\n`,
        },
      ],
      fields: [],
      rules: [],
      decisionTables: [],
      globalSettings: {
        allowCustomSections: true,
        requireAllSections: false,
        autoNumbering: true,
        defaultLanguage: 'zh-CN',
        maxContentLength: 10485760,
        enableVersioning: true,
        enableComments: true,
      },
    },
  },

  feature: {
    name: 'feature',
    displayName: 'Feature Specification PRD',
    description: '功能规格类PRD模板，适用于具体功能设计和用户故事',
    category: 'feature',
    tags: ['功能', '用户故事', '规格'],
    structure: {
      sections: [
        {
          id: 'feature',
          title: '功能描述',
          description: '功能的详细描述和使用场景',
          order: 1,
          level: 2,
          isRequired: true,
          editableBy: ['product_manager', 'architect'],
          visibleTo: [],
          contentTemplate: `### 核心功能\n\n### 使用场景\n\n### 业务价值\n\n`,
        },
        {
          id: 'user_stories',
          title: '用户故事',
          description: '详细的用户故事和流程描述',
          order: 2,
          level: 2,
          isRequired: true,
          editableBy: ['product_manager'],
          visibleTo: [],
          contentTemplate: `### 用户角色\n\n### 功能流程\n\n**作为** [用户角色]\n**我希望** [功能描述]\n**以便** [价值说明]\n\n`,
        },
        {
          id: 'acceptance',
          title: '验收标准',
          description: '功能的验收条件和测试标准',
          order: 3,
          level: 2,
          isRequired: true,
          editableBy: ['product_manager', 'tester'],
          visibleTo: [],
          contentTemplate: `### 验收条件\n\n- [ ] 条件1\n- [ ] 条件2\n\n### 测试用例\n\n`,
        },
        {
          id: 'dependencies',
          title: '依赖关系',
          description: '技术和业务依赖项',
          order: 4,
          level: 2,
          isRequired: false,
          editableBy: ['architect', 'developer'],
          visibleTo: [],
          contentTemplate: `### 技术依赖\n\n| 依赖项 | 类型 | 状态 |\n| ------ | ---- | ---- |\n| | | |\n\n### 业务依赖\n\n`,
        },
        {
          id: 'risks',
          title: '风险评估',
          description: '潜在风险和应对措施',
          order: 5,
          level: 2,
          isRequired: false,
          editableBy: ['architect', 'product_manager'],
          visibleTo: [],
          contentTemplate: `### 技术风险\n\n| 风险 | 概率 | 影响 | 缓解措施 |\n| ---- | ---- | ---- | -------- |\n| | | | |\n\n### 业务风险\n\n`,
        },
      ],
      fields: [],
      rules: [],
      decisionTables: [],
      globalSettings: {
        allowCustomSections: true,
        requireAllSections: false,
        autoNumbering: true,
        defaultLanguage: 'zh-CN',
        maxContentLength: 10485760,
        enableVersioning: true,
        enableComments: true,
      },
    },
  },

  security: {
    name: 'security',
    displayName: 'Security Assessment PRD',
    description: '安全评估类PRD模板，适用于安全审计和风险评估',
    category: 'security',
    tags: ['安全', '评估', '审计'],
    structure: {
      sections: [
        {
          id: 'scope',
          title: '评估范围',
          description: '安全评估的目标和边界',
          order: 1,
          level: 2,
          isRequired: true,
          editableBy: ['architect'],
          visibleTo: [],
          contentTemplate: `### 评估目标\n\n### 系统边界\n\n### 评估方法\n\n`,
        },
        {
          id: 'threats',
          title: '威胁分析',
          description: '潜在威胁和攻击向量分析',
          order: 2,
          level: 2,
          isRequired: true,
          editableBy: ['architect'],
          visibleTo: [],
          contentTemplate: `### 威胁模型\n\n### 攻击面分析\n\n### 风险评级\n\n`,
        },
      ],
      fields: [],
      rules: [],
      decisionTables: [],
      globalSettings: {
        allowCustomSections: true,
        requireAllSections: true,
        autoNumbering: true,
        defaultLanguage: 'zh-CN',
        maxContentLength: 10485760,
        enableVersioning: true,
        enableComments: true,
      },
    },
  },

  api: {
    name: 'api',
    displayName: 'API Design PRD',
    description: 'API设计类PRD模板，适用于接口设计和文档',
    category: 'api',
    tags: ['API', '接口', '设计'],
    structure: {
      sections: [
        {
          id: 'endpoints',
          title: '接口定义',
          description: 'API端点的详细定义',
          order: 1,
          level: 2,
          isRequired: true,
          editableBy: ['architect', 'developer'],
          visibleTo: [],
          contentTemplate: `### 端点列表\n\n| 方法 | 路径 | 描述 |\n| ---- | ---- | ---- |\n| | | |\n\n`,
        },
        {
          id: 'authentication',
          title: '认证方式',
          description: 'API认证和授权机制',
          order: 2,
          level: 2,
          isRequired: true,
          editableBy: ['architect'],
          visibleTo: [],
          contentTemplate: `### 认证类型\n\n### Token格式\n\n### 权限范围\n\n`,
        },
      ],
      fields: [],
      rules: [],
      decisionTables: [],
      globalSettings: {
        allowCustomSections: true,
        requireAllSections: false,
        autoNumbering: true,
        defaultLanguage: 'zh-CN',
        maxContentLength: 10485760,
        enableVersioning: true,
        enableComments: true,
      },
    },
  },
};

// Template 工具类
export class TemplateManager {
  /**
   * 验证模板名称格式
   */
  static validateTemplateName(name: string): boolean {
    if (!name || name.length < 3 || name.length > 50) {
      return false;
    }
    // 只允许字母、数字、下划线、连字符
    return /^[a-zA-Z0-9_-]+$/.test(name);
  }

  /**
   * 验证版本格式（semver）
   */
  static validateVersion(version: string): boolean {
    if (!version) {
      return false;
    }
    // 简化的semver正则表达式
    const semverRegex = /^\d+\.\d+\.\d+$/;
    return semverRegex.test(version);
  }

  /**
   * 创建内置模板
   */
  static createBuiltinTemplate(type: BuiltinTemplateType): Template {
    const builtin = BUILTIN_TEMPLATES[type];
    const now = new Date();

    return {
      id: `template-${type}-builtin`,
      name: builtin.name!,
      displayName: builtin.displayName!,
      description: builtin.description!,
      version: '1.0.0',
      category: builtin.category!,
      tags: builtin.tags!,
      isDefault: type === 'technical',
      isPublic: true,
      structure: builtin.structure!,
      metadata: {
        usage: 0,
        rating: 0,
        ratingCount: 0,
        downloadCount: 0,
        estimatedTime: 60, // 60分钟
        difficulty: 'intermediate',
        targetAudience: this.getTargetAudience(type),
        prerequisites: [],
        relatedTemplates: [],
      },
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
    };
  }

  /**
   * 获取模板目标用户
   */
  private static getTargetAudience(type: BuiltinTemplateType): RoleType[] {
    switch (type) {
      case 'technical':
      case 'security':
      case 'api':
        return ['architect'];
      case 'business':
        return ['product_manager'];
      case 'feature':
        return ['product_manager', 'architect'];
      default:
        return ['architect', 'product_manager'];
    }
  }

  /**
   * 验证模板结构
   */
  static validateTemplate(template: Partial<Template>): string[] {
    const errors: string[] = [];

    if (!template.name) {
      errors.push('模板名称不能为空');
    } else if (!this.validateTemplateName(template.name)) {
      errors.push('模板名称格式无效，只能包含字母、数字、下划线、连字符，长度3-50字符');
    }

    if (!template.displayName) {
      errors.push('显示名称不能为空');
    }

    if (!template.version) {
      errors.push('版本号不能为空');
    } else if (!this.validateVersion(template.version)) {
      errors.push('版本号格式无效，必须遵循semver格式（如1.0.0）');
    }

    if (!template.structure) {
      errors.push('模板结构不能为空');
    } else {
      if (!template.structure.sections || template.structure.sections.length === 0) {
        errors.push('模板必须至少包含一个章节');
      } else {
        // 检查是否有必填章节
        const hasRequiredSection = template.structure.sections.some((s) => s.isRequired);
        if (!hasRequiredSection) {
          errors.push('模板必须至少包含一个必填章节');
        }

        // 检查章节order是否唯一
        const orders = template.structure.sections.map((s) => s.order);
        const uniqueOrders = new Set(orders);
        if (orders.length !== uniqueOrders.size) {
          errors.push('章节排序号不能重复');
        }
      }
    }

    return errors;
  }

  /**
   * 获取章节可编辑的角色列表
   */
  static getSectionEditableRoles(section: TemplateSectionDef): RoleType[] {
    return section.editableBy || [];
  }

  /**
   * 检查角色是否可以编辑章节
   */
  static canRoleEditSection(role: RoleType, section: TemplateSectionDef): boolean {
    return section.editableBy.includes(role);
  }

  /**
   * 生成章节默认内容
   */
  static generateSectionContent(section: TemplateSectionDef): string {
    if (section.contentTemplate) {
      return section.contentTemplate;
    }

    // 根据章节类型生成默认内容
    return `## ${section.title}\n\n${section.description}\n\n<!-- 请在此处添加${section.title}的具体内容 -->\n\n`;
  }

  /**
   * 创建自定义模板
   */
  static createCustomTemplate(
    name: string,
    displayName: string,
    description: string,
    createdBy: string,
    sections: TemplateSectionDef[] = []
  ): Template {
    const now = new Date();

    return {
      id: `template-${name}-${Date.now()}`,
      name,
      displayName,
      description,
      version: '1.0.0',
      category: 'custom',
      tags: ['自定义'],
      isDefault: false,
      isPublic: false,
      structure: {
        sections,
        fields: [],
        rules: [],
        decisionTables: [],
        globalSettings: {
          allowCustomSections: true,
          requireAllSections: false,
          autoNumbering: true,
          defaultLanguage: 'zh-CN',
          maxContentLength: 10485760,
          enableVersioning: true,
          enableComments: true,
        },
      },
      metadata: {
        usage: 0,
        rating: 0,
        ratingCount: 0,
        downloadCount: 0,
        estimatedTime: 30,
        difficulty: 'beginner',
        targetAudience: ['architect', 'product_manager'],
        prerequisites: [],
        relatedTemplates: [],
      },
      createdAt: now,
      updatedAt: now,
      createdBy,
    };
  }
}
