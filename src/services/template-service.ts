/**
 * TemplateService - 模板管理和验证服务
 *
 * 核心功能：
 * - 模板CRUD操作
 * - 模板验证和结构检查
 * - 默认模板加载
 * - 模板定制和继承
 */

import {
  Template,
  TemplateStructure,
  TemplateSectionDef,
  TemplateFieldDef,
  DecisionTableDef,
  ValidationRule,
  BUILTIN_TEMPLATES,
  BuiltinTemplateType,
} from '../models/template.js';

export interface TemplateService {
  // CRUD Operations
  createTemplate(data: CreateTemplateRequest): Promise<Template>;
  getTemplate(id: string): Promise<Template | null>;
  updateTemplate(id: string, data: UpdateTemplateRequest, userId: string): Promise<Template>;
  deleteTemplate(id: string, userId: string): Promise<boolean>;
  listTemplates(filter?: TemplateFilter): Promise<Template[]>;

  // Template Management
  validateTemplate(template: Template): Promise<TemplateValidationResult>;
  validateTemplateStructure(structure: TemplateStructure): Promise<StructureValidationResult>;
  loadDefaultTemplates(): Promise<Template[]>;
  customizeTemplate(templateId: string, customizations: TemplateCustomization): Promise<Template>;

  // Template Usage
  applyTemplate(templateId: string, context?: TemplateContext): Promise<AppliedTemplate>;
  generateContent(template: Template, data: Record<string, any>): Promise<string>;
  extractTemplateData(content: string, template: Template): Promise<ExtractedData>;

  // Template Discovery
  suggestTemplate(context: TemplateSuggestionContext): Promise<Template[]>;
  searchTemplates(query: TemplateSearchQuery): Promise<TemplateSearchResult[]>;
}

// Request/Response Interfaces
export interface CreateTemplateRequest {
  name: string;
  description: string;
  category: string;
  structure: TemplateStructure;
  defaultContent?: string;
  validationRules?: ValidationRule[];
  metadata?: {
    tags?: string[];
    author?: string;
    version?: string;
    license?: string;
  };
  basedOn?: string; // 基于已有模板创建
}

export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  category?: string;
  structure?: TemplateStructure;
  defaultContent?: string;
  validationRules?: ValidationRule[];
  metadata?: Partial<Template['metadata']>;
}

export interface TemplateFilter {
  category?: string;
  tags?: string[];
  author?: string;
  builtin?: boolean;
  active?: boolean;
  usage?: {
    min?: number;
    max?: number;
  };
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'usage' | 'created' | 'updated';
  sortOrder?: 'asc' | 'desc';
}

export interface TemplateValidationResult {
  isValid: boolean;
  errors: TemplateValidationError[];
  warnings: TemplateValidationWarning[];
  suggestions: TemplateValidationSuggestion[];
  score?: number; // 模板质量得分 (0-100)
}

export interface TemplateValidationError {
  field: string;
  path: string;
  message: string;
  severity: 'error' | 'warning';
  code: string;
}

export interface TemplateValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface TemplateValidationSuggestion {
  type: 'structure' | 'content' | 'naming' | 'validation';
  message: string;
  action?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface StructureValidationResult {
  isValid: boolean;
  issues: StructureIssue[];
  recommendations: StructureRecommendation[];
}

export interface StructureIssue {
  section: string;
  type: 'missing_required' | 'invalid_type' | 'circular_dependency' | 'invalid_reference';
  message: string;
  severity: 'error' | 'warning';
}

export interface StructureRecommendation {
  section: string;
  type: 'add_section' | 'reorder_sections' | 'merge_sections' | 'split_section';
  message: string;
  rationale: string;
}

export interface TemplateCustomization {
  name?: string;
  description?: string;
  addSections?: TemplateSectionDef[];
  removeSections?: string[];
  modifySections?: {
    sectionName: string;
    changes: Partial<TemplateSectionDef>;
  }[];
  addFields?: {
    sectionName: string;
    fields: TemplateFieldDef[];
  }[];
  removeFields?: {
    sectionName: string;
    fieldNames: string[];
  }[];
  updateValidation?: ValidationRule[];
  metadata?: Partial<Template['metadata']>;
}

export interface TemplateContext {
  projectType?: 'web' | 'mobile' | 'api' | 'library' | 'service';
  complexity?: 'simple' | 'medium' | 'complex';
  audience?: 'technical' | 'business' | 'mixed';
  urgency?: 'low' | 'medium' | 'high';
  teamSize?: number;
  industry?: string;
  complianceRequired?: boolean;
}

export interface AppliedTemplate {
  template: Template;
  content: string;
  placeholders: TemplatePlaceholder[];
  suggestions: ContentSuggestion[];
}

export interface TemplatePlaceholder {
  name: string;
  description: string;
  type: 'text' | 'number' | 'date' | 'list' | 'choice';
  required: boolean;
  defaultValue?: any;
  validation?: ValidationRule;
  position: {
    line: number;
    column: number;
  };
}

export interface ContentSuggestion {
  section: string;
  type: 'add_content' | 'improve_structure' | 'add_details';
  message: string;
  example?: string;
}

export interface ExtractedData {
  sections: {
    name: string;
    content: string;
    metadata: Record<string, any>;
  }[];
  fields: {
    name: string;
    value: any;
    type: string;
    section: string;
  }[];
  completeness: number; // 0-100%
  quality: {
    score: number;
    issues: string[];
    suggestions: string[];
  };
}

export interface TemplateSuggestionContext {
  projectType?: string;
  keywords?: string[];
  existingContent?: string;
  teamRole?: string;
  previousTemplates?: string[];
}

export interface TemplateSearchQuery {
  text?: string;
  category?: string;
  tags?: string[];
  similarity?: {
    template: Template;
    threshold?: number;
  };
  fuzzy?: boolean;
}

export interface TemplateSearchResult {
  template: Template;
  score: number;
  matchedFields: string[];
  relevanceReason: string;
}

/**
 * TemplateService 的默认实现
 *
 * 支持内置模板加载、自定义模板创建、模板验证和应用
 */
export class DefaultTemplateService implements TemplateService {
  private templates: Map<string, Template> = new Map();
  private nextId = 1;

  constructor(private readonly storagePath: string = './data/templates') {
    this.initializeBuiltinTemplates();
  }

  async createTemplate(data: CreateTemplateRequest): Promise<Template> {
    const id = `template_${Date.now()}_${this.nextId++}`;

    // 如果基于已有模板创建
    let baseTemplate: Template | undefined;
    if (data.basedOn) {
      baseTemplate = await this.getTemplate(data.basedOn);
      if (!baseTemplate) {
        throw new Error(`Base template not found: ${data.basedOn}`);
      }
    }

    const template: Template = {
      id,
      name: data.name,
      description: data.description,
      version: data.metadata?.version || '1.0.0',
      category: data.category,
      structure: data.structure,
      defaultContent: data.defaultContent || this.generateDefaultContent(data.structure),
      validationRules: data.validationRules || [],
      metadata: {
        author: data.metadata?.author || 'user',
        created: new Date(),
        updated: new Date(),
        tags: data.metadata?.tags || [],
        usage: 0,
        license: data.metadata?.license,
        basedOn: data.basedOn,
      },
    };

    // 如果基于已有模板，继承其结构
    if (baseTemplate) {
      template.structure = this.mergeStructures(baseTemplate.structure, data.structure);
      template.validationRules = [
        ...(baseTemplate.validationRules || []),
        ...template.validationRules,
      ];
    }

    // 验证模板
    const validation = await this.validateTemplate(template);
    if (!validation.isValid) {
      throw new Error(
        `Template validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    this.templates.set(id, template);
    await this.persistTemplate(template);

    return template;
  }

  async getTemplate(id: string): Promise<Template | null> {
    const template = this.templates.get(id);
    if (template) {
      // 更新使用统计
      template.metadata.usage++;
      await this.persistTemplate(template);
    }
    return template || null;
  }

  async updateTemplate(id: string, data: UpdateTemplateRequest, userId: string): Promise<Template> {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Template not found: ${id}`);
    }

    // 检查权限（简化版本）
    if (template.metadata.author !== userId && userId !== 'admin') {
      throw new Error('Permission denied: Cannot update this template');
    }

    // 更新字段
    if (data.name) {
      template.name = data.name;
    }
    if (data.description) {
      template.description = data.description;
    }
    if (data.category) {
      template.category = data.category;
    }
    if (data.structure) {
      template.structure = data.structure;
    }
    if (data.defaultContent) {
      template.defaultContent = data.defaultContent;
    }
    if (data.validationRules) {
      template.validationRules = data.validationRules;
    }
    if (data.metadata) {
      Object.assign(template.metadata, data.metadata);
    }

    // 增加版本号
    const [major, minor, patch] = template.version.split('.').map(Number);
    template.version = `${major}.${minor}.${patch + 1}`;
    template.metadata.updated = new Date();

    // 验证更新后的模板
    const validation = await this.validateTemplate(template);
    if (!validation.isValid) {
      throw new Error(
        `Template validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    await this.persistTemplate(template);
    return template;
  }

  async deleteTemplate(id: string, userId: string): Promise<boolean> {
    const template = this.templates.get(id);
    if (!template) {
      return false;
    }

    // 检查权限
    if (template.metadata.author !== userId && userId !== 'admin') {
      throw new Error('Permission denied: Cannot delete this template');
    }

    // 不能删除内置模板
    if (Object.values(BUILTIN_TEMPLATES).some((bt) => (bt as Template).id === id)) {
      throw new Error('Cannot delete builtin template');
    }

    this.templates.delete(id);
    await this.removeTemplateFile(id);
    return true;
  }

  async listTemplates(filter?: TemplateFilter): Promise<Template[]> {
    let templates = Array.from(this.templates.values());

    if (filter) {
      // 应用过滤条件
      if (filter.category) {
        templates = templates.filter((t) => t.category === filter.category);
      }

      if (filter.tags?.length) {
        templates = templates.filter((t) =>
          filter.tags!.some((tag) => t.metadata.tags.includes(tag))
        );
      }

      if (filter.author) {
        templates = templates.filter((t) => t.metadata.author === filter.author);
      }

      if (typeof filter.builtin === 'boolean') {
        const builtinIds = Object.keys(BUILTIN_TEMPLATES);
        templates = templates.filter((t) =>
          filter.builtin ? builtinIds.includes(t.id) : !builtinIds.includes(t.id)
        );
      }

      if (filter.usage) {
        templates = templates.filter((t) => {
          const usage = t.metadata.usage;
          return (
            (!filter.usage!.min || usage >= filter.usage!.min) &&
            (!filter.usage!.max || usage <= filter.usage!.max)
          );
        });
      }

      // 排序
      if (filter.sortBy) {
        templates.sort((a, b) => {
          let valueA: any, valueB: any;

          switch (filter.sortBy) {
            case 'name':
              valueA = a.name;
              valueB = b.name;
              break;
            case 'usage':
              valueA = a.metadata.usage;
              valueB = b.metadata.usage;
              break;
            case 'created':
              valueA = a.metadata.created;
              valueB = b.metadata.created;
              break;
            case 'updated':
              valueA = a.metadata.updated;
              valueB = b.metadata.updated;
              break;
            default:
              valueA = a.name;
              valueB = b.name;
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
        templates = templates.slice(start, end);
      }
    }

    return templates;
  }

  async validateTemplate(template: Template): Promise<TemplateValidationResult> {
    const errors: TemplateValidationError[] = [];
    const warnings: TemplateValidationWarning[] = [];
    const suggestions: TemplateValidationSuggestion[] = [];

    // 基本字段验证
    if (!template.name.trim()) {
      errors.push({
        field: 'name',
        path: 'name',
        message: 'Template name is required',
        severity: 'error',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!template.description.trim()) {
      warnings.push({
        field: 'description',
        message: 'Template description is empty',
        suggestion: 'Add a clear description of what this template is for',
      });
    }

    // 版本格式验证
    if (!/^\d+\.\d+\.\d+$/.test(template.version)) {
      errors.push({
        field: 'version',
        path: 'version',
        message: 'Version must follow semver format (x.y.z)',
        severity: 'error',
        code: 'INVALID_VERSION',
      });
    }

    // 结构验证
    const structureResult = await this.validateTemplateStructure(template.structure);
    if (!structureResult.isValid) {
      for (const issue of structureResult.issues) {
        errors.push({
          field: 'structure',
          path: `structure.${issue.section}`,
          message: issue.message,
          severity: issue.severity,
          code: issue.type.toUpperCase(),
        });
      }
    }

    // 内容验证
    if (template.defaultContent) {
      const contentIssues = this.validateDefaultContent(
        template.defaultContent,
        template.structure
      );
      errors.push(...contentIssues);
    }

    // 验证规则检查
    if (template.validationRules) {
      for (const rule of template.validationRules) {
        if (!this.isValidValidationRule(rule)) {
          errors.push({
            field: 'validationRules',
            path: `validationRules.${rule.name}`,
            message: `Invalid validation rule: ${rule.name}`,
            severity: 'error',
            code: 'INVALID_VALIDATION_RULE',
          });
        }
      }
    }

    // 生成建议
    if (template.structure.sections.length < 3) {
      suggestions.push({
        type: 'structure',
        message: 'Consider adding more sections for better organization',
        action: 'Add sections like "Background", "Requirements", "Implementation"',
        priority: 'medium',
      });
    }

    if (!template.metadata.tags.length) {
      suggestions.push({
        type: 'content',
        message: 'Add tags to improve template discoverability',
        action: 'Add relevant tags like project type, complexity, etc.',
        priority: 'low',
      });
    }

    // 计算质量得分
    const score = this.calculateTemplateScore(template, errors, warnings, suggestions);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      score,
    };
  }

  async validateTemplateStructure(
    structure: TemplateStructure
  ): Promise<StructureValidationResult> {
    const issues: StructureIssue[] = [];
    const recommendations: StructureRecommendation[] = [];

    // 检查必需部分
    if (!structure.sections.length) {
      issues.push({
        section: 'root',
        type: 'missing_required',
        message: 'Template must have at least one section',
        severity: 'error',
      });
    }

    // 检查部分名称唯一性
    const sectionNames = new Set<string>();
    for (const section of structure.sections) {
      if (sectionNames.has(section.name)) {
        issues.push({
          section: section.name,
          type: 'invalid_reference',
          message: `Duplicate section name: ${section.name}`,
          severity: 'error',
        });
      }
      sectionNames.add(section.name);

      // 检查子部分
      if (section.subsections) {
        for (const subsection of section.subsections) {
          const fullName = `${section.name}.${subsection.name}`;
          if (sectionNames.has(fullName)) {
            issues.push({
              section: fullName,
              type: 'invalid_reference',
              message: `Duplicate subsection name: ${fullName}`,
              severity: 'error',
            });
          }
          sectionNames.add(fullName);
        }
      }
    }

    // 检查循环依赖
    const dependencies = this.extractDependencies(structure);
    const cycles = this.findCycles(dependencies);
    for (const cycle of cycles) {
      issues.push({
        section: cycle.join(' -> '),
        type: 'circular_dependency',
        message: `Circular dependency detected: ${cycle.join(' -> ')}`,
        severity: 'error',
      });
    }

    // 生成建议
    if (structure.sections.length > 10) {
      recommendations.push({
        section: 'root',
        type: 'split_section',
        message: 'Consider splitting into multiple templates',
        rationale: 'Too many sections can make the template complex and hard to use',
      });
    }

    const requiredSections = structure.sections.filter((s) => s.required);
    if (requiredSections.length === 0) {
      recommendations.push({
        section: 'root',
        type: 'add_section',
        message: 'Consider marking some sections as required',
        rationale: 'Required sections help ensure content completeness',
      });
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      recommendations,
    };
  }

  async loadDefaultTemplates(): Promise<Template[]> {
    const defaultTemplates: Template[] = [];

    for (const [type, template] of Object.entries(BUILTIN_TEMPLATES)) {
      const fullTemplate: Template = {
        ...(template as Partial<Template>),
        id: type,
        version: template.version || '1.0.0',
        validationRules: template.validationRules || [],
        metadata: {
          ...template.metadata,
          created: new Date(),
          updated: new Date(),
          usage: 0,
        },
      } as Template;

      this.templates.set(type, fullTemplate);
      defaultTemplates.push(fullTemplate);
    }

    return defaultTemplates;
  }

  async customizeTemplate(
    templateId: string,
    customizations: TemplateCustomization
  ): Promise<Template> {
    const baseTemplate = await this.getTemplate(templateId);
    if (!baseTemplate) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // 创建自定义模板副本
    const customTemplate: Template = JSON.parse(JSON.stringify(baseTemplate));
    customTemplate.id = `${templateId}_custom_${Date.now()}`;
    customTemplate.name = customizations.name || `${baseTemplate.name} (Custom)`;
    customTemplate.description =
      customizations.description || `Customized from ${baseTemplate.name}`;

    // 应用自定义
    if (customizations.addSections) {
      customTemplate.structure.sections.push(...customizations.addSections);
    }

    if (customizations.removeSections) {
      customTemplate.structure.sections = customTemplate.structure.sections.filter(
        (section) => !customizations.removeSections!.includes(section.name)
      );
    }

    if (customizations.modifySections) {
      for (const modification of customizations.modifySections) {
        const section = customTemplate.structure.sections.find(
          (s) => s.name === modification.sectionName
        );
        if (section) {
          Object.assign(section, modification.changes);
        }
      }
    }

    if (customizations.addFields) {
      for (const fieldAddition of customizations.addFields) {
        const section = customTemplate.structure.sections.find(
          (s) => s.name === fieldAddition.sectionName
        );
        if (section) {
          section.fields.push(...fieldAddition.fields);
        }
      }
    }

    if (customizations.removeFields) {
      for (const fieldRemoval of customizations.removeFields) {
        const section = customTemplate.structure.sections.find(
          (s) => s.name === fieldRemoval.sectionName
        );
        if (section) {
          section.fields = section.fields.filter((f) => !fieldRemoval.fieldNames.includes(f.name));
        }
      }
    }

    if (customizations.updateValidation) {
      customTemplate.validationRules = customizations.updateValidation;
    }

    if (customizations.metadata) {
      Object.assign(customTemplate.metadata, customizations.metadata);
    }

    // 更新版本和时间戳
    customTemplate.version = '1.0.0';
    customTemplate.metadata.created = new Date();
    customTemplate.metadata.updated = new Date();
    customTemplate.metadata.basedOn = templateId;

    // 验证自定义模板
    const validation = await this.validateTemplate(customTemplate);
    if (!validation.isValid) {
      throw new Error(
        `Customized template validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    this.templates.set(customTemplate.id, customTemplate);
    await this.persistTemplate(customTemplate);

    return customTemplate;
  }

  async applyTemplate(templateId: string, context?: TemplateContext): Promise<AppliedTemplate> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let content = template.defaultContent || '';
    const placeholders: TemplatePlaceholder[] = [];
    const suggestions: ContentSuggestion[] = [];

    // 根据上下文调整内容
    if (context) {
      content = this.adaptContentToContext(content, context);
      suggestions.push(...this.generateContextSuggestions(template, context));
    }

    // 提取占位符
    const placeholderMatches = content.matchAll(/\{\{(\w+)(?::([^}]+))?\}\}/g);
    for (const match of placeholderMatches) {
      const [fullMatch, name, typeHint] = match;
      placeholders.push({
        name,
        description: `Placeholder for ${name}`,
        type: this.inferPlaceholderType(typeHint),
        required: true,
        position: {
          line: content.substring(0, match.index).split('\n').length,
          column: match.index! - content.lastIndexOf('\n', match.index!),
        },
      });
    }

    return {
      template,
      content,
      placeholders,
      suggestions,
    };
  }

  async generateContent(template: Template, data: Record<string, any>): Promise<string> {
    let content = template.defaultContent || '';

    // 替换占位符
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`\\{\\{${key}(?::[^}]+)?\\}\\}`, 'g');
      content = content.replace(placeholder, String(value));
    }

    // 根据模板结构生成内容
    if (!content.trim()) {
      content = this.generateStructuredContent(template.structure, data);
    }

    return content;
  }

  async extractTemplateData(content: string, template: Template): Promise<ExtractedData> {
    const sections: ExtractedData['sections'] = [];
    const fields: ExtractedData['fields'] = [];

    // 提取部分内容
    for (const sectionDef of template.structure.sections) {
      const sectionContent = this.extractSectionContent(content, sectionDef.name);
      sections.push({
        name: sectionDef.name,
        content: sectionContent,
        metadata: {},
      });

      // 提取字段数据
      for (const fieldDef of sectionDef.fields) {
        const fieldValue = this.extractFieldValue(sectionContent, fieldDef);
        if (fieldValue !== null) {
          fields.push({
            name: fieldDef.name,
            value: fieldValue,
            type: fieldDef.type,
            section: sectionDef.name,
          });
        }
      }
    }

    // 计算完整性
    const completeness = this.calculateCompleteness(template, sections, fields);

    // 评估质量
    const quality = this.assessContentQuality(content, template);

    return {
      sections,
      fields,
      completeness,
      quality,
    };
  }

  async suggestTemplate(context: TemplateSuggestionContext): Promise<Template[]> {
    const allTemplates = Array.from(this.templates.values());
    const suggestions: { template: Template; score: number }[] = [];

    for (const template of allTemplates) {
      let score = 0;

      // 项目类型匹配
      if (context.projectType && template.metadata.tags.includes(context.projectType)) {
        score += 30;
      }

      // 关键词匹配
      if (context.keywords) {
        for (const keyword of context.keywords) {
          if (
            template.name.toLowerCase().includes(keyword.toLowerCase()) ||
            template.description.toLowerCase().includes(keyword.toLowerCase()) ||
            template.metadata.tags.some((tag) => tag.toLowerCase().includes(keyword.toLowerCase()))
          ) {
            score += 10;
          }
        }
      }

      // 内容相似性
      if (context.existingContent) {
        const similarity = this.calculateContentSimilarity(
          context.existingContent,
          template.defaultContent || ''
        );
        score += similarity * 20;
      }

      // 使用历史
      if (context.previousTemplates && context.previousTemplates.includes(template.id)) {
        score += 15;
      }

      // 使用频率
      score += Math.min(template.metadata.usage * 0.1, 10);

      if (score > 10) {
        suggestions.push({ template, score });
      }
    }

    // 按得分排序
    suggestions.sort((a, b) => b.score - a.score);

    return suggestions.slice(0, 5).map((s) => s.template);
  }

  async searchTemplates(query: TemplateSearchQuery): Promise<TemplateSearchResult[]> {
    const allTemplates = Array.from(this.templates.values());
    const results: TemplateSearchResult[] = [];

    for (const template of allTemplates) {
      let score = 0;
      const matchedFields: string[] = [];
      let relevanceReason = '';

      // 文本搜索
      if (query.text) {
        const searchText = query.text.toLowerCase();

        if (template.name.toLowerCase().includes(searchText)) {
          score += 30;
          matchedFields.push('name');
        }

        if (template.description.toLowerCase().includes(searchText)) {
          score += 20;
          matchedFields.push('description');
        }

        if (template.metadata.tags.some((tag) => tag.toLowerCase().includes(searchText))) {
          score += 15;
          matchedFields.push('tags');
        }
      }

      // 分类过滤
      if (query.category && template.category === query.category) {
        score += 25;
        matchedFields.push('category');
      }

      // 标签过滤
      if (query.tags && query.tags.some((tag) => template.metadata.tags.includes(tag))) {
        score += 20;
        matchedFields.push('tags');
      }

      // 相似性搜索
      if (query.similarity) {
        const similarity = this.calculateTemplateSimilarity(template, query.similarity.template);
        if (similarity >= (query.similarity.threshold || 0.7)) {
          score += similarity * 40;
          matchedFields.push('structure');
          relevanceReason = `${Math.round(similarity * 100)}% structure similarity`;
        }
      }

      if (score > 0) {
        if (!relevanceReason) {
          relevanceReason = `Matched ${matchedFields.join(', ')}`;
        }

        results.push({
          template,
          score,
          matchedFields,
          relevanceReason,
        });
      }
    }

    // 按得分排序
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  // 私有辅助方法
  private initializeBuiltinTemplates(): void {
    // 在构造函数中调用 loadDefaultTemplates
    this.loadDefaultTemplates().catch(console.error);
  }

  private generateDefaultContent(structure: TemplateStructure): string {
    let content = '';

    for (const section of structure.sections) {
      content += `\n# ${section.name}\n\n`;

      if (section.description) {
        content += `${section.description}\n\n`;
      }

      // 为字段添加占位符
      for (const field of section.fields) {
        if (field.type === 'header') {
          content += `## ${field.name}\n\n`;
        } else {
          content += `**${field.name}**: {{${field.name.toLowerCase().replace(/\s+/g, '_')}}}\n\n`;
        }
      }

      // 处理子部分
      if (section.subsections) {
        for (const subsection of section.subsections) {
          content += `## ${subsection.name}\n\n`;
          if (subsection.description) {
            content += `${subsection.description}\n\n`;
          }
        }
      }
    }

    return content.trim();
  }

  private mergeStructures(base: TemplateStructure, overlay: TemplateStructure): TemplateStructure {
    // 简单的结构合并逻辑
    return {
      sections: [...base.sections, ...overlay.sections],
    };
  }

  private validateDefaultContent(
    content: string,
    structure: TemplateStructure
  ): TemplateValidationError[] {
    const errors: TemplateValidationError[] = [];

    // 检查必需部分是否存在
    for (const section of structure.sections) {
      if (section.required) {
        const sectionRegex = new RegExp(`^#+\\s*${section.name}`, 'mi');
        if (!sectionRegex.test(content)) {
          errors.push({
            field: 'defaultContent',
            path: `defaultContent.sections.${section.name}`,
            message: `Required section "${section.name}" not found in default content`,
            severity: 'error',
            code: 'MISSING_REQUIRED_SECTION',
          });
        }
      }
    }

    return errors;
  }

  private isValidValidationRule(rule: ValidationRule): boolean {
    return !!(rule.name && rule.description && rule.type);
  }

  private calculateTemplateScore(
    template: Template,
    errors: TemplateValidationError[],
    warnings: TemplateValidationWarning[],
    suggestions: TemplateValidationSuggestion[]
  ): number {
    let score = 100;

    // 扣分规则
    score -= errors.length * 20;
    score -= warnings.length * 10;
    score -= suggestions.length * 5;

    // 加分规则
    if (template.structure.sections.length >= 3) {
      score += 10;
    }
    if (template.metadata.tags.length >= 3) {
      score += 5;
    }
    if (template.validationRules.length > 0) {
      score += 10;
    }
    if (template.defaultContent && template.defaultContent.length > 200) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  private extractDependencies(structure: TemplateStructure): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();

    for (const section of structure.sections) {
      dependencies.set(section.name, []);

      // 简化的依赖提取逻辑
      if (section.fields) {
        for (const field of section.fields) {
          if (field.validation?.dependencies) {
            dependencies.get(section.name)!.push(...field.validation.dependencies);
          }
        }
      }
    }

    return dependencies;
  }

  private findCycles(dependencies: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (visiting.has(node)) {
        // 发现循环
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart).concat(node));
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visiting.add(node);
      const deps = dependencies.get(node) || [];

      for (const dep of deps) {
        dfs(dep, [...path, node]);
      }

      visiting.delete(node);
      visited.add(node);
    };

    for (const node of dependencies.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  private adaptContentToContext(content: string, context: TemplateContext): string {
    // 根据上下文调整内容的简化实现
    let adaptedContent = content;

    if (context.projectType) {
      adaptedContent = adaptedContent.replace(/{{project_type}}/g, context.projectType);
    }

    if (context.complexity) {
      adaptedContent = adaptedContent.replace(/{{complexity}}/g, context.complexity);
    }

    return adaptedContent;
  }

  private generateContextSuggestions(
    template: Template,
    context: TemplateContext
  ): ContentSuggestion[] {
    const suggestions: ContentSuggestion[] = [];

    if (context.complianceRequired) {
      suggestions.push({
        section: 'Requirements',
        type: 'add_content',
        message: 'Add compliance requirements section',
        example: 'Consider adding GDPR, SOX, or other relevant compliance requirements',
      });
    }

    if (context.teamSize && context.teamSize > 10) {
      suggestions.push({
        section: 'Communication',
        type: 'add_content',
        message: 'Add communication plan for large team',
        example: 'Define stakeholder communication, review processes, and approval workflows',
      });
    }

    return suggestions;
  }

  private inferPlaceholderType(typeHint?: string): TemplatePlaceholder['type'] {
    if (!typeHint) {
      return 'text';
    }

    switch (typeHint.toLowerCase()) {
      case 'number':
      case 'num':
        return 'number';
      case 'date':
      case 'datetime':
        return 'date';
      case 'list':
      case 'array':
        return 'list';
      case 'choice':
      case 'select':
        return 'choice';
      default:
        return 'text';
    }
  }

  private generateStructuredContent(
    structure: TemplateStructure,
    data: Record<string, any>
  ): string {
    // 基于结构生成内容的实现
    return this.generateDefaultContent(structure);
  }

  private extractSectionContent(content: string, sectionName: string): string {
    const sectionRegex = new RegExp(`^#+\\s*${sectionName}\\s*$`, 'mi');
    const match = content.match(sectionRegex);

    if (!match) {
      return '';
    }

    const startIndex = match.index! + match[0].length;
    const nextSectionRegex = /^#+\s/gm;
    nextSectionRegex.lastIndex = startIndex;
    const nextMatch = nextSectionRegex.exec(content);

    const endIndex = nextMatch ? nextMatch.index : content.length;
    return content.substring(startIndex, endIndex).trim();
  }

  private extractFieldValue(sectionContent: string, fieldDef: TemplateFieldDef): any {
    // 简化的字段值提取
    const fieldRegex = new RegExp(`\\*\\*${fieldDef.name}\\*\\*:?\\s*(.+)`, 'i');
    const match = sectionContent.match(fieldRegex);
    return match ? match[1].trim() : null;
  }

  private calculateCompleteness(
    template: Template,
    sections: ExtractedData['sections'],
    fields: ExtractedData['fields']
  ): number {
    const totalSections = template.structure.sections.length;
    const completedSections = sections.filter((s) => s.content.trim().length > 0).length;

    const totalFields = template.structure.sections.reduce(
      (sum, section) => sum + section.fields.length,
      0
    );
    const completedFields = fields.filter(
      (f) => f.value !== null && String(f.value).trim().length > 0
    ).length;

    const sectionCompleteness = totalSections > 0 ? completedSections / totalSections : 1;
    const fieldCompleteness = totalFields > 0 ? completedFields / totalFields : 1;

    return Math.round(((sectionCompleteness + fieldCompleteness) / 2) * 100);
  }

  private assessContentQuality(content: string, template: Template): ExtractedData['quality'] {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // 基本质量检查
    const wordCount = content.trim().split(/\s+/).length;
    if (wordCount < 100) {
      issues.push('Content is too brief');
      suggestions.push('Add more detailed information to each section');
    }

    const headerCount = (content.match(/^#+\s/gm) || []).length;
    if (headerCount < 3) {
      issues.push('Insufficient structure');
      suggestions.push('Add more headers and subsections for better organization');
    }

    // 计算质量得分
    let score = 100;
    score -= issues.length * 20;

    return {
      score: Math.max(0, score),
      issues,
      suggestions,
    };
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    // 简化的相似性计算
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter((word) => words2.has(word)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateTemplateSimilarity(template1: Template, template2: Template): number {
    // 比较模板结构相似性
    const sections1 = new Set(template1.structure.sections.map((s) => s.name.toLowerCase()));
    const sections2 = new Set(template2.structure.sections.map((s) => s.name.toLowerCase()));

    const intersection = new Set([...sections1].filter((section) => sections2.has(section)));
    const union = new Set([...sections1, ...sections2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private async persistTemplate(template: Template): Promise<void> {
    // 实现模板持久化
    // 这里暂时只是内存存储，后续会在存储层实现真正的文件持久化
  }

  private async removeTemplateFile(templateId: string): Promise<void> {
    // 实现模板文件删除
    // 这里暂时只是内存删除，后续会在存储层实现真正的文件删除
  }
}

export default DefaultTemplateService;
