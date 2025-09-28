/**
 * DiagramService - 图表渲染和管理服务
 *
 * 核心功能：
 * - Mermaid图表渲染
 * - ASCII文本图表支持
 * - 图表缓存和性能优化
 * - 多格式图表转换
 */

import {
  DiagramComponent,
  DiagramSource,
  RenderedDiagram,
  DiagramType,
  DiagramPosition,
  DiagramSettings,
  RenderOptions,
  CacheStrategy,
} from '../models/diagram-component.js';

export interface DiagramService {
  // Diagram Rendering
  renderDiagram(source: DiagramSource, options?: RenderOptions): Promise<RenderedDiagram>;
  renderMermaid(code: string, options?: MermaidRenderOptions): Promise<RenderedDiagram>;
  renderASCII(data: any, type: ASCIIType, options?: ASCIIRenderOptions): Promise<RenderedDiagram>;
  renderCustom(type: string, data: any, options?: CustomRenderOptions): Promise<RenderedDiagram>;

  // Diagram Management
  createDiagram(diagramData: CreateDiagramRequest): Promise<DiagramComponent>;
  getDiagram(diagramId: string): Promise<DiagramComponent | null>;
  updateDiagram(diagramId: string, updates: UpdateDiagramRequest): Promise<DiagramComponent>;
  deleteDiagram(diagramId: string): Promise<boolean>;
  listDiagrams(filter?: DiagramFilter): Promise<DiagramComponent[]>;

  // Format Conversion
  convertFormat(diagramId: string, targetFormat: DiagramType): Promise<DiagramComponent>;
  exportDiagram(diagramId: string, format: ExportFormat): Promise<ExportResult>;
  importDiagram(source: ImportSource): Promise<DiagramComponent>;

  // Caching and Performance
  cacheDiagram(diagramId: string, strategy?: CacheStrategy): Promise<boolean>;
  clearCache(filter?: CacheFilter): Promise<number>;
  preloadDiagrams(diagramIds: string[]): Promise<PreloadResult>;
  optimizeRendering(options?: OptimizationOptions): Promise<OptimizationResult>;

  // Validation and Analysis
  validateDiagramSyntax(source: DiagramSource): Promise<ValidationResult>;
  analyzeDiagramComplexity(source: DiagramSource): Promise<ComplexityAnalysis>;
  suggestOptimizations(diagramId: string): Promise<OptimizationSuggestion[]>;

  // Interactive Features
  generateInteractiveElements(
    diagramId: string,
    config: InteractivityConfig
  ): Promise<InteractiveDiagram>;
  handleDiagramClick(diagramId: string, clickData: ClickData): Promise<ClickResponse>;
  updateDiagramState(diagramId: string, state: DiagramState): Promise<boolean>;

  // Batch Operations
  renderMultipleDiagrams(
    sources: DiagramSource[],
    options?: BatchRenderOptions
  ): Promise<BatchRenderResult>;
  generateDiagramsFromTemplate(template: DiagramTemplate, data: any[]): Promise<DiagramComponent[]>;
}

// Request/Response Interfaces
export interface MermaidRenderOptions extends RenderOptions {
  theme?: 'default' | 'forest' | 'dark' | 'neutral' | 'null';
  themeVariables?: Record<string, string>;
  flowchart?: {
    useMaxWidth?: boolean;
    htmlLabels?: boolean;
    curve?: 'basis' | 'linear' | 'cardinal';
  };
  sequence?: {
    diagramMarginX?: number;
    diagramMarginY?: number;
    actorMargin?: number;
    width?: number;
    height?: number;
  };
  gantt?: {
    numberSectionStyles?: number;
    axisFormat?: string;
    tickInterval?: string;
  };
}

export interface ASCIIType {
  type: 'box' | 'tree' | 'graph' | 'table' | 'flowchart' | 'sequence';
}

export interface ASCIIRenderOptions extends RenderOptions {
  style?: 'simple' | 'double' | 'rounded' | 'thick';
  padding?: number;
  alignment?: 'left' | 'center' | 'right';
  maxWidth?: number;
  connector?: string;
}

export interface CustomRenderOptions extends RenderOptions {
  renderer?: string;
  config?: Record<string, any>;
  plugins?: string[];
}

export interface CreateDiagramRequest {
  title: string;
  description?: string;
  type: DiagramType;
  source: DiagramSource;
  position?: DiagramPosition;
  settings?: DiagramSettings;
  metadata?: {
    category?: string;
    tags?: string[];
    author?: string;
    version?: string;
  };
}

export interface UpdateDiagramRequest {
  title?: string;
  description?: string;
  source?: DiagramSource;
  position?: DiagramPosition;
  settings?: DiagramSettings;
  metadata?: Partial<CreateDiagramRequest['metadata']>;
}

export interface DiagramFilter {
  type?: DiagramType[];
  category?: string;
  tags?: string[];
  author?: string;
  renderStatus?: 'pending' | 'success' | 'error' | 'cached';
  dateRange?: {
    from: Date;
    to: Date;
    field: 'created' | 'updated' | 'rendered';
  };
  limit?: number;
  offset?: number;
  sortBy?: 'title' | 'created' | 'updated' | 'renderTime';
  sortOrder?: 'asc' | 'desc';
}

export interface ExportFormat {
  type: 'svg' | 'png' | 'pdf' | 'html' | 'json' | 'source';
  quality?: number; // For raster formats
  scale?: number;
  backgroundColor?: string;
  includeMetadata?: boolean;
}

export interface ExportResult {
  format: ExportFormat['type'];
  data: string | Buffer;
  filename: string;
  size: number;
  metadata?: {
    dimensions?: { width: number; height: number };
    renderTime?: number;
    quality?: number;
  };
}

export interface ImportSource {
  type: 'file' | 'url' | 'text';
  data: string | Buffer;
  format?: DiagramType;
  options?: {
    autoDetectFormat?: boolean;
    validateSyntax?: boolean;
    extractMetadata?: boolean;
  };
}

export interface CacheFilter {
  type?: DiagramType[];
  olderThan?: Date;
  largerThan?: number; // Size in bytes
  status?: 'valid' | 'expired' | 'corrupted';
}

export interface PreloadResult {
  requested: number;
  successful: number;
  failed: number;
  errors: Array<{
    diagramId: string;
    error: string;
  }>;
  totalTime: number;
}

export interface OptimizationOptions {
  enableCaching?: boolean;
  compressionLevel?: number;
  parallel?: boolean;
  maxConcurrency?: number;
  timeout?: number;
}

export interface OptimizationResult {
  renderTimeImprovement: number; // Percentage
  cacheSizeReduction: number; // Bytes
  memoryUsageReduction: number; // Bytes
  recommendations: string[];
  applied: string[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export interface ValidationError {
  line?: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
  code?: string;
}

export interface ValidationWarning {
  line?: number;
  column?: number;
  message: string;
  suggestion?: string;
}

export interface ValidationSuggestion {
  type: 'syntax' | 'style' | 'performance' | 'accessibility';
  message: string;
  action?: string;
  impact: 'low' | 'medium' | 'high';
}

export interface ComplexityAnalysis {
  score: number; // 0-100
  level: 'simple' | 'moderate' | 'complex' | 'very_complex';
  metrics: {
    nodeCount: number;
    edgeCount: number;
    depth: number;
    cycleCount: number;
    branchingFactor: number;
  };
  renderingEstimate: {
    timeMs: number;
    memoryMb: number;
    diskSpaceMb: number;
  };
  recommendations: ComplexityRecommendation[];
}

export interface ComplexityRecommendation {
  type: 'simplify' | 'split' | 'optimize' | 'cache';
  message: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
}

export interface OptimizationSuggestion {
  type: 'performance' | 'visual' | 'accessibility' | 'maintainability';
  title: string;
  description: string;
  before?: string;
  after?: string;
  impact: 'low' | 'medium' | 'high';
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface InteractivityConfig {
  enableClicks?: boolean;
  enableHovers?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  clickHandlers?: {
    [nodeId: string]: ClickHandler;
  };
  hoverHandlers?: {
    [nodeId: string]: HoverHandler;
  };
  customEvents?: CustomEvent[];
}

export interface ClickHandler {
  action: 'navigate' | 'tooltip' | 'modal' | 'custom';
  target?: string;
  data?: any;
}

export interface HoverHandler {
  showTooltip?: boolean;
  tooltipContent?: string;
  highlightRelated?: boolean;
  customStyle?: Record<string, string>;
}

export interface CustomEvent {
  event: string;
  selector: string;
  handler: string; // Function name or code
}

export interface InteractiveDiagram {
  diagram: DiagramComponent;
  interactiveElements: InteractiveElement[];
  eventHandlers: EventHandler[];
  configuration: InteractivityConfig;
}

export interface InteractiveElement {
  id: string;
  type: 'node' | 'edge' | 'label' | 'group';
  selector: string;
  events: string[];
  data?: any;
}

export interface EventHandler {
  event: string;
  element: string;
  handler: string;
  data?: any;
}

export interface ClickData {
  elementId: string;
  elementType: 'node' | 'edge' | 'label';
  position: { x: number; y: number };
  modifiers?: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
  };
  data?: any;
}

export interface ClickResponse {
  action: 'none' | 'navigate' | 'select' | 'expand' | 'collapse' | 'edit';
  target?: string;
  data?: any;
  updateDiagram?: boolean;
  newState?: DiagramState;
}

export interface DiagramState {
  selectedElements?: string[];
  expandedNodes?: string[];
  hiddenElements?: string[];
  viewportTransform?: {
    x: number;
    y: number;
    scale: number;
  };
  customData?: Record<string, any>;
}

export interface BatchRenderOptions {
  parallel?: boolean;
  maxConcurrency?: number;
  timeout?: number;
  cacheResults?: boolean;
  onProgress?: (completed: number, total: number) => void;
}

export interface BatchRenderResult {
  successful: RenderedDiagram[];
  failed: Array<{
    source: DiagramSource;
    error: string;
  }>;
  statistics: {
    totalTime: number;
    averageTime: number;
    cacheHits: number;
    cacheMisses: number;
  };
}

export interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  type: DiagramType;
  template: string; // Template with placeholders
  schema: TemplateSchema;
  examples?: TemplateExample[];
}

export interface TemplateSchema {
  properties: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'array' | 'object';
      description?: string;
      required?: boolean;
      default?: any;
      examples?: any[];
    };
  };
}

export interface TemplateExample {
  name: string;
  description: string;
  data: any;
  expectedOutput?: string;
}

/**
 * DiagramService 的默认实现
 *
 * 支持多种图表格式渲染、缓存优化和交互功能
 */
export class DefaultDiagramService implements DiagramService {
  private diagrams: Map<string, DiagramComponent> = new Map();
  private renderCache: Map<string, RenderedDiagram> = new Map();
  private templates: Map<string, DiagramTemplate> = new Map();
  private nextId = 1;

  constructor(
    private readonly storagePath: string = './data/diagrams',
    private readonly cacheSize: number = 100
  ) {
    this.initializeTemplates();
  }

  async renderDiagram(source: DiagramSource, options?: RenderOptions): Promise<RenderedDiagram> {
    // 检查缓存
    const cacheKey = this.generateCacheKey(source, options);
    const cached = this.renderCache.get(cacheKey);

    if (cached && !this.isCacheExpired(cached)) {
      return { ...cached, fromCache: true };
    }

    // 根据类型选择渲染器
    let rendered: RenderedDiagram;

    switch (source.type) {
      case 'mermaid':
        rendered = await this.renderMermaid(source.code, options as MermaidRenderOptions);
        break;
      case 'ascii':
        rendered = await this.renderASCII(
          source.data,
          { type: 'box' },
          options as ASCIIRenderOptions
        );
        break;
      case 'plantuml':
      case 'graphviz':
      case 'drawio':
      case 'excalidraw':
        rendered = await this.renderCustom(
          source.type,
          source.data,
          options as CustomRenderOptions
        );
        break;
      default:
        throw new Error(`Unsupported diagram type: ${source.type}`);
    }

    // 缓存结果
    this.cacheResult(cacheKey, rendered);

    return rendered;
  }

  async renderMermaid(code: string, options?: MermaidRenderOptions): Promise<RenderedDiagram> {
    const startTime = Date.now();

    try {
      // 验证 Mermaid 语法
      const validation = await this.validateMermaidSyntax(code);
      if (!validation.isValid) {
        throw new Error(
          `Mermaid syntax error: ${validation.errors.map((e) => e.message).join(', ')}`
        );
      }

      // 准备渲染配置
      const config = this.prepareMermaidConfig(options);

      // 模拟 Mermaid 渲染过程
      const renderedSvg = await this.executeMermaidRender(code, config);

      const renderTime = Date.now() - startTime;

      const rendered: RenderedDiagram = {
        id: `render_${Date.now()}_${this.nextId++}`,
        format: 'svg',
        content: renderedSvg,
        metadata: {
          renderTime,
          timestamp: new Date(),
          dimensions: this.extractSvgDimensions(renderedSvg),
          hash: this.calculateHash(code),
          cached: false,
        },
        source: {
          type: 'mermaid',
          code,
          data: null,
        },
        settings: {
          responsive: options?.responsive !== false,
          interactive: options?.interactive || false,
          theme: options?.theme || 'default',
        },
        errors: validation.errors.length > 0 ? validation.errors : undefined,
      };

      return rendered;
    } catch (error) {
      const renderTime = Date.now() - startTime;

      return {
        id: `error_${Date.now()}_${this.nextId++}`,
        format: 'error',
        content: '',
        metadata: {
          renderTime,
          timestamp: new Date(),
          hash: this.calculateHash(code),
          cached: false,
        },
        source: {
          type: 'mermaid',
          code,
          data: null,
        },
        settings: {
          responsive: false,
          interactive: false,
        },
        errors: [
          {
            line: 1,
            column: 1,
            message: error instanceof Error ? error.message : 'Unknown render error',
            severity: 'error',
          },
        ],
      };
    }
  }

  async renderASCII(
    data: any,
    type: ASCIIType,
    options?: ASCIIRenderOptions
  ): Promise<RenderedDiagram> {
    const startTime = Date.now();

    try {
      let asciiArt = '';

      switch (type.type) {
        case 'box':
          asciiArt = this.renderASCIIBox(data, options);
          break;
        case 'tree':
          asciiArt = this.renderASCIITree(data, options);
          break;
        case 'graph':
          asciiArt = this.renderASCIIGraph(data, options);
          break;
        case 'table':
          asciiArt = this.renderASCIITable(data, options);
          break;
        case 'flowchart':
          asciiArt = this.renderASCIIFlowchart(data, options);
          break;
        case 'sequence':
          asciiArt = this.renderASCIISequence(data, options);
          break;
        default:
          throw new Error(`Unsupported ASCII type: ${type.type}`);
      }

      const renderTime = Date.now() - startTime;

      return {
        id: `ascii_${Date.now()}_${this.nextId++}`,
        format: 'text',
        content: asciiArt,
        metadata: {
          renderTime,
          timestamp: new Date(),
          dimensions: this.calculateASCIIDimensions(asciiArt),
          hash: this.calculateHash(JSON.stringify(data)),
          cached: false,
        },
        source: {
          type: 'ascii',
          code: '',
          data,
        },
        settings: {
          responsive: false,
          interactive: false,
          theme: 'monospace',
        },
      };
    } catch (error) {
      const renderTime = Date.now() - startTime;

      return {
        id: `ascii_error_${Date.now()}_${this.nextId++}`,
        format: 'error',
        content: '',
        metadata: {
          renderTime,
          timestamp: new Date(),
          hash: this.calculateHash(JSON.stringify(data)),
          cached: false,
        },
        source: {
          type: 'ascii',
          code: '',
          data,
        },
        settings: {
          responsive: false,
          interactive: false,
        },
        errors: [
          {
            message: error instanceof Error ? error.message : 'ASCII render error',
            severity: 'error',
          },
        ],
      };
    }
  }

  async renderCustom(
    type: string,
    data: any,
    options?: CustomRenderOptions
  ): Promise<RenderedDiagram> {
    const startTime = Date.now();

    try {
      let content = '';

      // 根据类型处理自定义渲染
      switch (type) {
        case 'plantuml':
          content = await this.renderPlantUML(data, options);
          break;
        case 'graphviz':
          content = await this.renderGraphviz(data, options);
          break;
        case 'drawio':
          content = await this.renderDrawIO(data, options);
          break;
        case 'excalidraw':
          content = await this.renderExcalidraw(data, options);
          break;
        default:
          throw new Error(`Unsupported custom type: ${type}`);
      }

      const renderTime = Date.now() - startTime;

      return {
        id: `custom_${Date.now()}_${this.nextId++}`,
        format: 'svg',
        content,
        metadata: {
          renderTime,
          timestamp: new Date(),
          dimensions: this.extractSvgDimensions(content),
          hash: this.calculateHash(JSON.stringify(data)),
          cached: false,
        },
        source: {
          type: type as DiagramType,
          code: typeof data === 'string' ? data : '',
          data: typeof data === 'string' ? null : data,
        },
        settings: {
          responsive: options?.responsive !== false,
          interactive: options?.interactive || false,
        },
      };
    } catch (error) {
      const renderTime = Date.now() - startTime;

      return {
        id: `custom_error_${Date.now()}_${this.nextId++}`,
        format: 'error',
        content: '',
        metadata: {
          renderTime,
          timestamp: new Date(),
          hash: this.calculateHash(JSON.stringify(data)),
          cached: false,
        },
        source: {
          type: type as DiagramType,
          code: typeof data === 'string' ? data : '',
          data: typeof data === 'string' ? null : data,
        },
        settings: {
          responsive: false,
          interactive: false,
        },
        errors: [
          {
            message: error instanceof Error ? error.message : 'Custom render error',
            severity: 'error',
          },
        ],
      };
    }
  }

  async createDiagram(diagramData: CreateDiagramRequest): Promise<DiagramComponent> {
    const id = `diagram_${Date.now()}_${this.nextId++}`;

    // 渲染图表
    const rendered = await this.renderDiagram(diagramData.source);

    const diagram: DiagramComponent = {
      id,
      title: diagramData.title,
      description: diagramData.description || '',
      type: diagramData.type,
      source: diagramData.source,
      rendered,
      position: diagramData.position || { x: 0, y: 0, width: 800, height: 600 },
      settings: {
        responsive: true,
        interactive: false,
        theme: 'default',
        ...diagramData.settings,
      },
      metadata: {
        created: new Date(),
        updated: new Date(),
        renderCount: 1,
        lastRendered: new Date(),
        version: '1.0.0',
        category: diagramData.metadata?.category || 'general',
        tags: diagramData.metadata?.tags || [],
        author: diagramData.metadata?.author || 'unknown',
      },
    };

    this.diagrams.set(id, diagram);
    await this.persistDiagram(diagram);

    return diagram;
  }

  async getDiagram(diagramId: string): Promise<DiagramComponent | null> {
    return this.diagrams.get(diagramId) || null;
  }

  async updateDiagram(diagramId: string, updates: UpdateDiagramRequest): Promise<DiagramComponent> {
    const diagram = this.diagrams.get(diagramId);
    if (!diagram) {
      throw new Error(`Diagram not found: ${diagramId}`);
    }

    let needsRerender = false;

    // 更新基本属性
    if (updates.title) {
      diagram.title = updates.title;
    }
    if (updates.description !== undefined) {
      diagram.description = updates.description;
    }
    if (updates.position) {
      diagram.position = { ...diagram.position, ...updates.position };
    }
    if (updates.settings) {
      diagram.settings = { ...diagram.settings, ...updates.settings };
    }
    if (updates.metadata) {
      Object.assign(diagram.metadata, updates.metadata);
    }

    // 如果源码改变，需要重新渲染
    if (updates.source) {
      diagram.source = updates.source;
      needsRerender = true;
    }

    if (needsRerender) {
      diagram.rendered = await this.renderDiagram(diagram.source);
      diagram.metadata.renderCount++;
      diagram.metadata.lastRendered = new Date();
    }

    diagram.metadata.updated = new Date();
    await this.persistDiagram(diagram);

    return diagram;
  }

  async deleteDiagram(diagramId: string): Promise<boolean> {
    const existed = this.diagrams.delete(diagramId);
    if (existed) {
      await this.removeDiagramFile(diagramId);
      // 清理相关缓存
      this.clearDiagramCache(diagramId);
    }
    return existed;
  }

  async listDiagrams(filter?: DiagramFilter): Promise<DiagramComponent[]> {
    let diagrams = Array.from(this.diagrams.values());

    if (filter) {
      // 应用过滤条件
      if (filter.type?.length) {
        diagrams = diagrams.filter((d) => filter.type!.includes(d.type));
      }

      if (filter.category) {
        diagrams = diagrams.filter((d) => d.metadata.category === filter.category);
      }

      if (filter.tags?.length) {
        diagrams = diagrams.filter((d) =>
          filter.tags!.some((tag) => d.metadata.tags.includes(tag))
        );
      }

      if (filter.author) {
        diagrams = diagrams.filter((d) => d.metadata.author === filter.author);
      }

      if (filter.renderStatus) {
        diagrams = diagrams.filter((d) => {
          if (d.rendered.errors?.length) {
            return filter.renderStatus === 'error';
          }
          if (d.rendered.metadata.cached) {
            return filter.renderStatus === 'cached';
          }
          return filter.renderStatus === 'success';
        });
      }

      if (filter.dateRange) {
        const { from, to, field } = filter.dateRange;
        diagrams = diagrams.filter((d) => {
          const date =
            field === 'created'
              ? d.metadata.created
              : field === 'updated'
                ? d.metadata.updated
                : d.metadata.lastRendered;
          return date >= from && date <= to;
        });
      }

      // 排序
      if (filter.sortBy) {
        diagrams.sort((a, b) => {
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
            case 'renderTime':
              valueA = a.rendered.metadata.renderTime;
              valueB = b.rendered.metadata.renderTime;
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
        diagrams = diagrams.slice(start, end);
      }
    }

    return diagrams;
  }

  async convertFormat(diagramId: string, targetFormat: DiagramType): Promise<DiagramComponent> {
    const diagram = await this.getDiagram(diagramId);
    if (!diagram) {
      throw new Error(`Diagram not found: ${diagramId}`);
    }

    // 转换逻辑
    let convertedSource: DiagramSource;

    if (diagram.type === 'mermaid' && targetFormat === 'ascii') {
      convertedSource = await this.convertMermaidToASCII(diagram.source);
    } else if (diagram.type === 'ascii' && targetFormat === 'mermaid') {
      convertedSource = await this.convertASCIIToMermaid(diagram.source);
    } else {
      throw new Error(`Conversion from ${diagram.type} to ${targetFormat} not supported`);
    }

    // 创建新图表
    const convertedDiagram = await this.createDiagram({
      title: `${diagram.title} (${targetFormat})`,
      description: `Converted from ${diagram.type} to ${targetFormat}`,
      type: targetFormat,
      source: convertedSource,
      position: diagram.position,
      settings: diagram.settings,
      metadata: {
        ...diagram.metadata,
        category: diagram.metadata.category,
        tags: [...diagram.metadata.tags, 'converted'],
      },
    });

    return convertedDiagram;
  }

  async exportDiagram(diagramId: string, format: ExportFormat): Promise<ExportResult> {
    const diagram = await this.getDiagram(diagramId);
    if (!diagram) {
      throw new Error(`Diagram not found: ${diagramId}`);
    }

    let data: string | Buffer;
    let filename: string;
    let size: number;
    const metadata: ExportResult['metadata'] = {};

    switch (format.type) {
      case 'svg':
        data = diagram.rendered.content;
        filename = `${diagram.title.replace(/[^a-zA-Z0-9]/g, '_')}.svg`;
        size = data.length;
        metadata.dimensions = diagram.rendered.metadata.dimensions;
        break;

      case 'png':
        data = await this.convertSvgToPng(diagram.rendered.content, format);
        filename = `${diagram.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
        size = data.length;
        metadata.quality = format.quality || 100;
        break;

      case 'pdf':
        data = await this.convertSvgToPdf(diagram.rendered.content, format);
        filename = `${diagram.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        size = data.length;
        break;

      case 'html':
        data = this.generateHtmlWrapper(diagram, format);
        filename = `${diagram.title.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
        size = data.length;
        break;

      case 'json':
        const jsonData = format.includeMetadata
          ? diagram
          : {
              title: diagram.title,
              type: diagram.type,
              source: diagram.source,
              rendered: diagram.rendered,
            };
        data = JSON.stringify(jsonData, null, 2);
        filename = `${diagram.title.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        size = data.length;
        break;

      case 'source':
        data = diagram.source.code || JSON.stringify(diagram.source.data, null, 2);
        const ext = diagram.type === 'mermaid' ? 'mmd' : 'txt';
        filename = `${diagram.title.replace(/[^a-zA-Z0-9]/g, '_')}.${ext}`;
        size = data.length;
        break;

      default:
        throw new Error(`Unsupported export format: ${format.type}`);
    }

    metadata.renderTime = diagram.rendered.metadata.renderTime;

    return {
      format: format.type,
      data,
      filename,
      size,
      metadata,
    };
  }

  async importDiagram(source: ImportSource): Promise<DiagramComponent> {
    let diagramSource: DiagramSource;
    let title = 'Imported Diagram';

    if (source.type === 'file' || source.type === 'text') {
      const content = typeof source.data === 'string' ? source.data : source.data.toString();

      // 自动检测格式
      let detectedFormat = source.format;
      if (source.options?.autoDetectFormat && !detectedFormat) {
        detectedFormat = this.detectDiagramFormat(content);
      }

      if (!detectedFormat) {
        throw new Error('Could not detect diagram format and none specified');
      }

      diagramSource = {
        type: detectedFormat,
        code: detectedFormat === 'mermaid' ? content : '',
        data:
          detectedFormat !== 'mermaid'
            ? this.parseNonMermaidContent(content, detectedFormat)
            : null,
      };

      // 提取标题
      const titleMatch = content.match(/title[:\s]+([^\n]+)/i);
      if (titleMatch) {
        title = titleMatch[1].trim();
      }
    } else if (source.type === 'url') {
      throw new Error('URL import not yet implemented');
    } else {
      throw new Error(`Unsupported import source type: ${source.type}`);
    }

    // 验证语法
    if (source.options?.validateSyntax) {
      const validation = await this.validateDiagramSyntax(diagramSource);
      if (!validation.isValid) {
        throw new Error(
          `Syntax validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
        );
      }
    }

    // 创建图表
    return this.createDiagram({
      title,
      description: 'Imported diagram',
      type: diagramSource.type,
      source: diagramSource,
      metadata: {
        category: 'imported',
        tags: ['imported'],
        author: 'import',
      },
    });
  }

  async cacheDiagram(diagramId: string, strategy?: CacheStrategy): Promise<boolean> {
    const diagram = await this.getDiagram(diagramId);
    if (!diagram) {
      return false;
    }

    const cacheKey = this.generateCacheKey(diagram.source);
    this.renderCache.set(cacheKey, {
      ...diagram.rendered,
      metadata: {
        ...diagram.rendered.metadata,
        cached: true,
        cacheTimestamp: new Date(),
      },
    });

    return true;
  }

  async clearCache(filter?: CacheFilter): Promise<number> {
    let cleared = 0;
    const keysToDelete: string[] = [];

    for (const [key, cached] of this.renderCache.entries()) {
      let shouldClear = true;

      if (filter) {
        if (filter.type?.length && !filter.type.includes(cached.source.type)) {
          shouldClear = false;
        }

        if (filter.olderThan && cached.metadata.cacheTimestamp) {
          if (cached.metadata.cacheTimestamp >= filter.olderThan) {
            shouldClear = false;
          }
        }

        if (filter.largerThan && cached.content.length <= filter.largerThan) {
          shouldClear = false;
        }
      }

      if (shouldClear) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.renderCache.delete(key);
      cleared++;
    }

    return cleared;
  }

  async preloadDiagrams(diagramIds: string[]): Promise<PreloadResult> {
    const startTime = Date.now();
    let successful = 0;
    let failed = 0;
    const errors: PreloadResult['errors'] = [];

    // 并行预加载
    const promises = diagramIds.map(async (id) => {
      try {
        const diagram = await this.getDiagram(id);
        if (diagram) {
          await this.cacheDiagram(id);
          successful++;
        } else {
          failed++;
          errors.push({ diagramId: id, error: 'Diagram not found' });
        }
      } catch (error) {
        failed++;
        errors.push({
          diagramId: id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    await Promise.all(promises);

    return {
      requested: diagramIds.length,
      successful,
      failed,
      errors,
      totalTime: Date.now() - startTime,
    };
  }

  async optimizeRendering(options?: OptimizationOptions): Promise<OptimizationResult> {
    const beforeMetrics = this.collectPerformanceMetrics();

    const recommendations: string[] = [];
    const applied: string[] = [];

    // 启用缓存
    if (options?.enableCaching !== false) {
      // 缓存配置已经默认启用
      applied.push('Enabled diagram caching');
    }

    // 并行渲染
    if (options?.parallel) {
      // 设置并发限制
      this.maxConcurrency = options.maxConcurrency || 4;
      applied.push(`Set max concurrency to ${this.maxConcurrency}`);
    }

    // 清理过期缓存
    const clearedItems = await this.clearCache({
      olderThan: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24小时前
    });

    if (clearedItems > 0) {
      applied.push(`Cleared ${clearedItems} expired cache entries`);
    }

    const afterMetrics = this.collectPerformanceMetrics();

    return {
      renderTimeImprovement: this.calculateImprovement(
        beforeMetrics.avgRenderTime,
        afterMetrics.avgRenderTime
      ),
      cacheSizeReduction: beforeMetrics.cacheSize - afterMetrics.cacheSize,
      memoryUsageReduction: beforeMetrics.memoryUsage - afterMetrics.memoryUsage,
      recommendations,
      applied,
    };
  }

  async validateDiagramSyntax(source: DiagramSource): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    switch (source.type) {
      case 'mermaid':
        return this.validateMermaidSyntax(source.code);
      case 'ascii':
        return this.validateASCIISyntax(source.data);
      case 'plantuml':
        return this.validatePlantUMLSyntax(source.code || '');
      default:
        warnings.push({
          message: `Syntax validation not implemented for ${source.type}`,
          suggestion: 'Consider implementing validation for this diagram type',
        });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  async analyzeDiagramComplexity(source: DiagramSource): Promise<ComplexityAnalysis> {
    let nodeCount = 0;
    let edgeCount = 0;
    let depth = 0;
    let cycleCount = 0;
    let branchingFactor = 0;

    // 根据图表类型分析复杂度
    switch (source.type) {
      case 'mermaid':
        ({ nodeCount, edgeCount, depth, cycleCount, branchingFactor } =
          this.analyzeMermaidComplexity(source.code));
        break;
      case 'ascii':
        ({ nodeCount, edgeCount, depth } = this.analyzeASCIIComplexity(source.data));
        break;
      default:
        // 基本分析
        const content = source.code || JSON.stringify(source.data);
        nodeCount = (content.match(/node|box|rect/gi) || []).length;
        edgeCount = (content.match(/arrow|line|edge/gi) || []).length;
    }

    // 计算复杂度分数
    const score = Math.min(100, nodeCount * 2 + edgeCount * 1.5 + depth * 3 + cycleCount * 5);

    let level: ComplexityAnalysis['level'] = 'simple';
    if (score > 75) {
      level = 'very_complex';
    } else if (score > 50) {
      level = 'complex';
    } else if (score > 25) {
      level = 'moderate';
    }

    // 渲染时间估算
    const baseTime = 100; // 基础渲染时间(ms)
    const timeMs = baseTime + nodeCount * 10 + edgeCount * 5 + depth * 20;
    const memoryMb = Math.max(1, (nodeCount + edgeCount) * 0.1);
    const diskSpaceMb = Math.max(0.1, memoryMb * 0.5);

    const recommendations: ComplexityRecommendation[] = [];

    if (score > 50) {
      recommendations.push({
        type: 'simplify',
        message: 'Consider simplifying the diagram by reducing the number of nodes and connections',
        impact: 'high',
        effort: 'medium',
      });
    }

    if (nodeCount > 20) {
      recommendations.push({
        type: 'split',
        message: 'Consider splitting into multiple smaller diagrams',
        impact: 'medium',
        effort: 'low',
      });
    }

    if (depth > 5) {
      recommendations.push({
        type: 'optimize',
        message: 'Deep nesting detected, consider flattening the structure',
        impact: 'medium',
        effort: 'medium',
      });
    }

    return {
      score,
      level,
      metrics: {
        nodeCount,
        edgeCount,
        depth,
        cycleCount,
        branchingFactor,
      },
      renderingEstimate: {
        timeMs,
        memoryMb,
        diskSpaceMb,
      },
      recommendations,
    };
  }

  async suggestOptimizations(diagramId: string): Promise<OptimizationSuggestion[]> {
    const diagram = await this.getDiagram(diagramId);
    if (!diagram) {
      throw new Error(`Diagram not found: ${diagramId}`);
    }

    const suggestions: OptimizationSuggestion[] = [];
    const complexity = await this.analyzeDiagramComplexity(diagram.source);

    // 性能优化建议
    if (complexity.metrics.nodeCount > 15) {
      suggestions.push({
        type: 'performance',
        title: 'Reduce Node Count',
        description: 'Too many nodes can slow down rendering. Consider grouping related nodes.',
        impact: 'high',
        difficulty: 'medium',
      });
    }

    // 视觉优化建议
    if (diagram.type === 'mermaid' && diagram.source.code.includes('fill:')) {
      suggestions.push({
        type: 'visual',
        title: 'Consistent Color Scheme',
        description: 'Use a consistent color scheme throughout the diagram for better readability.',
        impact: 'medium',
        difficulty: 'easy',
      });
    }

    // 可访问性建议
    suggestions.push({
      type: 'accessibility',
      title: 'Add Alt Text',
      description: 'Add descriptive alt text for screen readers.',
      impact: 'medium',
      difficulty: 'easy',
    });

    // 可维护性建议
    if (diagram.source.code && diagram.source.code.length > 1000) {
      suggestions.push({
        type: 'maintainability',
        title: 'Break Into Smaller Diagrams',
        description:
          'Large diagrams are harder to maintain. Consider splitting into focused sub-diagrams.',
        impact: 'high',
        difficulty: 'medium',
      });
    }

    return suggestions;
  }

  async generateInteractiveElements(
    diagramId: string,
    config: InteractivityConfig
  ): Promise<InteractiveDiagram> {
    const diagram = await this.getDiagram(diagramId);
    if (!diagram) {
      throw new Error(`Diagram not found: ${diagramId}`);
    }

    const interactiveElements: InteractiveElement[] = [];
    const eventHandlers: EventHandler[] = [];

    // 分析图表内容，提取可交互元素
    if (diagram.type === 'mermaid') {
      const nodes = this.extractMermaidNodes(diagram.source.code);

      for (const node of nodes) {
        const element: InteractiveElement = {
          id: node.id,
          type: 'node',
          selector: `[id="${node.id}"]`,
          events: [],
          data: node.data,
        };

        if (config.enableClicks) {
          element.events.push('click');

          const clickHandler = config.clickHandlers?.[node.id];
          if (clickHandler) {
            eventHandlers.push({
              event: 'click',
              element: node.id,
              handler: this.generateClickHandler(clickHandler),
              data: clickHandler.data,
            });
          }
        }

        if (config.enableHovers) {
          element.events.push('mouseenter', 'mouseleave');

          const hoverHandler = config.hoverHandlers?.[node.id];
          if (hoverHandler) {
            eventHandlers.push({
              event: 'mouseenter',
              element: node.id,
              handler: this.generateHoverHandler(hoverHandler),
              data: hoverHandler,
            });
          }
        }

        interactiveElements.push(element);
      }
    }

    // 添加自定义事件
    if (config.customEvents) {
      for (const customEvent of config.customEvents) {
        eventHandlers.push({
          event: customEvent.event,
          element: customEvent.selector,
          handler: customEvent.handler,
        });
      }
    }

    return {
      diagram,
      interactiveElements,
      eventHandlers,
      configuration: config,
    };
  }

  async handleDiagramClick(diagramId: string, clickData: ClickData): Promise<ClickResponse> {
    const diagram = await this.getDiagram(diagramId);
    if (!diagram) {
      throw new Error(`Diagram not found: ${diagramId}`);
    }

    // 根据点击的元素类型和配置决定响应
    if (clickData.elementType === 'node') {
      // 检查是否有展开/折叠功能
      if (clickData.modifiers?.ctrl) {
        return {
          action: 'expand',
          updateDiagram: true,
          newState: {
            expandedNodes: [clickData.elementId],
          },
        };
      }

      // 默认选择行为
      return {
        action: 'select',
        updateDiagram: true,
        newState: {
          selectedElements: [clickData.elementId],
        },
      };
    }

    return { action: 'none' };
  }

  async updateDiagramState(diagramId: string, state: DiagramState): Promise<boolean> {
    const diagram = await this.getDiagram(diagramId);
    if (!diagram) {
      return false;
    }

    // 更新图表状态（这里可以存储到数据库或缓存中）
    // 简化实现，将状态存储到图表的设置中
    diagram.settings.customData = {
      ...diagram.settings.customData,
      state,
    };

    await this.persistDiagram(diagram);
    return true;
  }

  async renderMultipleDiagrams(
    sources: DiagramSource[],
    options?: BatchRenderOptions
  ): Promise<BatchRenderResult> {
    const startTime = Date.now();
    const successful: RenderedDiagram[] = [];
    const failed: BatchRenderResult['failed'] = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    const maxConcurrency = options?.maxConcurrency || 3;
    const timeout = options?.timeout || 30000;

    // 分批处理
    const batches: DiagramSource[][] = [];
    for (let i = 0; i < sources.length; i += maxConcurrency) {
      batches.push(sources.slice(i, i + maxConcurrency));
    }

    let completed = 0;

    for (const batch of batches) {
      const promises = batch.map(async (source) => {
        try {
          const rendered = await Promise.race([
            this.renderDiagram(source),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Render timeout')), timeout)
            ),
          ]);

          if (rendered.metadata.cached || rendered.fromCache) {
            cacheHits++;
          } else {
            cacheMisses++;
          }

          successful.push(rendered);
        } catch (error) {
          failed.push({
            source,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        completed++;
        options?.onProgress?.(completed, sources.length);
      });

      await Promise.all(promises);
    }

    const totalTime = Date.now() - startTime;
    const averageTime = successful.length > 0 ? totalTime / successful.length : 0;

    return {
      successful,
      failed,
      statistics: {
        totalTime,
        averageTime,
        cacheHits,
        cacheMisses,
      },
    };
  }

  async generateDiagramsFromTemplate(
    template: DiagramTemplate,
    data: any[]
  ): Promise<DiagramComponent[]> {
    const diagrams: DiagramComponent[] = [];

    for (const [index, itemData] of data.entries()) {
      try {
        // 验证数据是否符合模板schema
        this.validateTemplateData(itemData, template.schema);

        // 生成图表代码
        const code = this.applyTemplate(template.template, itemData);

        // 创建图表
        const diagram = await this.createDiagram({
          title: `${template.name} #${index + 1}`,
          description: `Generated from template: ${template.name}`,
          type: template.type,
          source: {
            type: template.type,
            code,
            data: null,
          },
          metadata: {
            category: 'template_generated',
            tags: ['template', template.id],
            author: 'template_generator',
          },
        });

        diagrams.push(diagram);
      } catch (error) {
        console.error(`Failed to generate diagram ${index + 1}:`, error);
      }
    }

    return diagrams;
  }

  // 私有辅助方法
  private maxConcurrency = 3;

  private initializeTemplates(): void {
    // 初始化一些基础模板
    const flowchartTemplate: DiagramTemplate = {
      id: 'basic_flowchart',
      name: 'Basic Flowchart',
      description: 'Simple flowchart template',
      type: 'mermaid',
      template: `graph TD
    A[{{startNode}}] --> B{{{decisionNode}}}
    B -->|Yes| C[{{yesAction}}]
    B -->|No| D[{{noAction}}]`,
      schema: {
        properties: {
          startNode: { type: 'string', required: true, description: 'Starting node text' },
          decisionNode: { type: 'string', required: true, description: 'Decision node text' },
          yesAction: { type: 'string', required: true, description: 'Action for Yes path' },
          noAction: { type: 'string', required: true, description: 'Action for No path' },
        },
      },
    };

    this.templates.set(flowchartTemplate.id, flowchartTemplate);
  }

  private generateCacheKey(source: DiagramSource, options?: RenderOptions): string {
    const sourceKey = source.code || JSON.stringify(source.data);
    const optionsKey = options ? JSON.stringify(options) : '';
    return this.calculateHash(sourceKey + optionsKey);
  }

  private isCacheExpired(cached: RenderedDiagram): boolean {
    if (!cached.metadata.cacheTimestamp) {
      return false;
    }

    const maxAge = 60 * 60 * 1000; // 1小时缓存
    return Date.now() - cached.metadata.cacheTimestamp.getTime() > maxAge;
  }

  private cacheResult(key: string, rendered: RenderedDiagram): void {
    // 实现LRU缓存
    if (this.renderCache.size >= this.cacheSize) {
      const firstKey = this.renderCache.keys().next().value;
      this.renderCache.delete(firstKey);
    }

    this.renderCache.set(key, {
      ...rendered,
      metadata: {
        ...rendered.metadata,
        cached: true,
        cacheTimestamp: new Date(),
      },
    });
  }

  private async validateMermaidSyntax(code: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // 基本语法检查
    if (!code.trim()) {
      errors.push({
        line: 1,
        column: 1,
        message: 'Empty diagram code',
        severity: 'error',
        code: 'EMPTY_CODE',
      });
    }

    // 检查图表类型声明
    const typeMatch = code.match(
      /^(graph|sequenceDiagram|classDiagram|gitgraph|gantt|pie|journey)/m
    );
    if (!typeMatch) {
      warnings.push({
        line: 1,
        column: 1,
        message: 'No diagram type declaration found',
        suggestion: 'Start with graph TD, sequenceDiagram, etc.',
      });
    }

    // 检查基本语法错误
    const lines = code.split('\n');
    lines.forEach((line, index) => {
      const lineNum = index + 1;

      // 检查未闭合的括号
      const openBrackets = (line.match(/\[/g) || []).length;
      const closeBrackets = (line.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        errors.push({
          line: lineNum,
          column: line.indexOf('[') + 1,
          message: 'Unmatched brackets',
          severity: 'error',
          code: 'UNMATCHED_BRACKETS',
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  private validateASCIISyntax(data: any): Promise<ValidationResult> {
    // ASCII图表语法验证相对简单
    return Promise.resolve({
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    });
  }

  private validatePlantUMLSyntax(code: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!code.includes('@startuml') || !code.includes('@enduml')) {
      errors.push({
        message: 'PlantUML code must start with @startuml and end with @enduml',
        severity: 'error',
      });
    }

    return Promise.resolve({
      isValid: errors.length === 0,
      errors,
      warnings: [],
      suggestions: [],
    });
  }

  private prepareMermaidConfig(options?: MermaidRenderOptions): any {
    return {
      theme: options?.theme || 'default',
      themeVariables: options?.themeVariables || {},
      flowchart: {
        useMaxWidth: options?.flowchart?.useMaxWidth !== false,
        htmlLabels: options?.flowchart?.htmlLabels !== false,
        curve: options?.flowchart?.curve || 'basis',
      },
      sequence: {
        diagramMarginX: options?.sequence?.diagramMarginX || 50,
        diagramMarginY: options?.sequence?.diagramMarginY || 10,
        actorMargin: options?.sequence?.actorMargin || 50,
        width: options?.sequence?.width || 150,
        height: options?.sequence?.height || 65,
      },
    };
  }

  private async executeMermaidRender(code: string, config: any): Promise<string> {
    // 模拟Mermaid渲染过程
    // 实际实现应该调用真正的Mermaid库

    const timestamp = Date.now();
    const hash = this.calculateHash(code).substring(0, 8);

    // 根据代码类型生成不同的SVG
    if (code.includes('graph')) {
      return this.generateFlowchartSVG(code, config, hash);
    } else if (code.includes('sequenceDiagram')) {
      return this.generateSequenceSVG(code, config, hash);
    } else {
      return this.generateGenericSVG(code, config, hash);
    }
  }

  private generateFlowchartSVG(code: string, config: any, hash: string): string {
    return `<svg id="mermaid-${hash}" width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${config.theme === 'dark' ? '#1e1e1e' : '#ffffff'}"/>
      <g transform="translate(50,50)">
        <rect x="10" y="10" width="100" height="40" rx="5" fill="#e3f2fd" stroke="#1976d2"/>
        <text x="60" y="32" text-anchor="middle" font-family="Arial" font-size="14">Start</text>
        <path d="M 60 50 L 60 80" stroke="#1976d2" stroke-width="2" marker-end="url(#arrowhead)"/>
        <polygon points="160,80 200,100 160,120 120,100" fill="#fff3e0" stroke="#f57f17"/>
        <text x="160" y="105" text-anchor="middle" font-family="Arial" font-size="12">Decision</text>
      </g>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="#1976d2"/>
        </marker>
      </defs>
    </svg>`;
  }

  private generateSequenceSVG(code: string, config: any, hash: string): string {
    return `<svg id="mermaid-${hash}" width="600" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${config.theme === 'dark' ? '#1e1e1e' : '#ffffff'}"/>
      <g transform="translate(50,50)">
        <rect x="0" y="0" width="80" height="30" fill="#e3f2fd" stroke="#1976d2"/>
        <text x="40" y="20" text-anchor="middle" font-family="Arial" font-size="12">Actor A</text>
        <rect x="200" y="0" width="80" height="30" fill="#e8f5e8" stroke="#4caf50"/>
        <text x="240" y="20" text-anchor="middle" font-family="Arial" font-size="12">Actor B</text>
        <line x1="40" y1="30" x2="40" y2="150" stroke="#666" stroke-dasharray="3,3"/>
        <line x1="240" y1="30" x2="240" y2="150" stroke="#666" stroke-dasharray="3,3"/>
        <path d="M 40 50 L 240 50" stroke="#1976d2" stroke-width="2" marker-end="url(#arrowhead)"/>
        <text x="140" y="45" text-anchor="middle" font-family="Arial" font-size="10">Message</text>
      </g>
    </svg>`;
  }

  private generateGenericSVG(code: string, config: any, hash: string): string {
    return `<svg id="mermaid-${hash}" width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${config.theme === 'dark' ? '#1e1e1e' : '#ffffff'}"/>
      <g transform="translate(50,50)">
        <rect x="50" y="50" width="150" height="80" fill="#f5f5f5" stroke="#666"/>
        <text x="125" y="95" text-anchor="middle" font-family="Arial" font-size="14">Generic Diagram</text>
      </g>
    </svg>`;
  }

  private extractSvgDimensions(svg: string): { width: number; height: number } | undefined {
    const widthMatch = svg.match(/width="(\d+)"/);
    const heightMatch = svg.match(/height="(\d+)"/);

    if (widthMatch && heightMatch) {
      return {
        width: parseInt(widthMatch[1]),
        height: parseInt(heightMatch[1]),
      };
    }

    return undefined;
  }

  private calculateHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private renderASCIIBox(data: any, options?: ASCIIRenderOptions): string {
    const style = options?.style || 'simple';
    const padding = options?.padding || 1;

    const text = typeof data === 'string' ? data : JSON.stringify(data);
    const lines = text.split('\n');
    const maxLength = Math.max(...lines.map((line) => line.length));

    const chars = this.getASCIIChars(style);
    const width = maxLength + padding * 2;

    let result = chars.topLeft + chars.horizontal.repeat(width) + chars.topRight + '\n';

    for (const line of lines) {
      const paddedLine = line.padEnd(maxLength);
      result +=
        chars.vertical +
        ' '.repeat(padding) +
        paddedLine +
        ' '.repeat(padding) +
        chars.vertical +
        '\n';
    }

    result += chars.bottomLeft + chars.horizontal.repeat(width) + chars.bottomRight + '\n';

    return result;
  }

  private renderASCIITree(data: any, options?: ASCIIRenderOptions): string {
    // 简化的树状图渲染
    const connector = options?.connector || '├── ';
    const lastConnector = '└── ';

    const renderNode = (node: any, prefix: string = '', isLast: boolean = true): string => {
      const nodeConnector = isLast ? lastConnector : connector;
      let result = prefix + nodeConnector + (node.name || node.toString()) + '\n';

      if (node.children && Array.isArray(node.children)) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        node.children.forEach((child: any, index: number) => {
          const childIsLast = index === node.children.length - 1;
          result += renderNode(child, newPrefix, childIsLast);
        });
      }

      return result;
    };

    return renderNode(data);
  }

  private renderASCIIGraph(data: any, options?: ASCIIRenderOptions): string {
    // 简化的图形渲染
    return `
    A -----> B
    |        |
    |        v
    +------> C
    `;
  }

  private renderASCIITable(data: any, options?: ASCIIRenderOptions): string {
    if (!Array.isArray(data) || data.length === 0) {
      return 'Empty table';
    }

    const headers = Object.keys(data[0]);
    const rows = data.map((item) => headers.map((header) => String(item[header] || '')));

    const columnWidths = headers.map((header, index) =>
      Math.max(header.length, ...rows.map((row) => row[index].length))
    );

    const separator = '+' + columnWidths.map((width) => '-'.repeat(width + 2)).join('+') + '+';

    let result = separator + '\n';
    result +=
      '|' +
      headers.map((header, index) => ` ${header.padEnd(columnWidths[index])} `).join('|') +
      '|\n';
    result += separator + '\n';

    for (const row of rows) {
      result +=
        '|' + row.map((cell, index) => ` ${cell.padEnd(columnWidths[index])} `).join('|') + '|\n';
    }

    result += separator + '\n';

    return result;
  }

  private renderASCIIFlowchart(data: any, options?: ASCIIRenderOptions): string {
    // 简化的流程图渲染
    return `
    ┌─────────┐
    │  Start  │
    └─────────┘
         │
         v
    ┌─────────┐
    │ Process │
    └─────────┘
         │
         v
    ┌─────────┐
    │   End   │
    └─────────┘
    `;
  }

  private renderASCIISequence(data: any, options?: ASCIIRenderOptions): string {
    // 简化的时序图渲染
    return `
    A          B
    │          │
    │ message  │
    │─────────>│
    │          │
    │ response │
    │<─────────│
    │          │
    `;
  }

  private getASCIIChars(style: string) {
    const styles = {
      simple: {
        horizontal: '-',
        vertical: '|',
        topLeft: '+',
        topRight: '+',
        bottomLeft: '+',
        bottomRight: '+',
      },
      double: {
        horizontal: '═',
        vertical: '║',
        topLeft: '╔',
        topRight: '╗',
        bottomLeft: '╚',
        bottomRight: '╝',
      },
      rounded: {
        horizontal: '─',
        vertical: '│',
        topLeft: '╭',
        topRight: '╮',
        bottomLeft: '╰',
        bottomRight: '╯',
      },
    };

    return styles[style as keyof typeof styles] || styles.simple;
  }

  private calculateASCIIDimensions(ascii: string): { width: number; height: number } {
    const lines = ascii.split('\n');
    return {
      width: Math.max(...lines.map((line) => line.length)),
      height: lines.length,
    };
  }

  private async renderPlantUML(data: any, options?: CustomRenderOptions): Promise<string> {
    // 模拟PlantUML渲染
    return `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="150" y="100" text-anchor="middle" font-family="Arial" font-size="16">PlantUML Diagram</text>
    </svg>`;
  }

  private async renderGraphviz(data: any, options?: CustomRenderOptions): Promise<string> {
    // 模拟Graphviz渲染
    return `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <circle cx="150" cy="100" r="50" fill="#e3f2fd" stroke="#1976d2"/>
      <text x="150" y="105" text-anchor="middle" font-family="Arial" font-size="14">Graphviz</text>
    </svg>`;
  }

  private async renderDrawIO(data: any, options?: CustomRenderOptions): Promise<string> {
    // 模拟Draw.io渲染
    return `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <rect x="75" y="50" width="150" height="100" fill="#fff3e0" stroke="#f57f17"/>
      <text x="150" y="105" text-anchor="middle" font-family="Arial" font-size="14">Draw.io</text>
    </svg>`;
  }

  private async renderExcalidraw(data: any, options?: CustomRenderOptions): Promise<string> {
    // 模拟Excalidraw渲染
    return `<svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <path d="M 50 50 Q 150 25 250 50 Q 275 100 250 150 Q 150 175 50 150 Q 25 100 50 50"
            fill="#e8f5e8" stroke="#4caf50" stroke-width="2"/>
      <text x="150" y="105" text-anchor="middle" font-family="Arial" font-size="14">Excalidraw</text>
    </svg>`;
  }

  private async convertMermaidToASCII(source: DiagramSource): Promise<DiagramSource> {
    // 简化的转换逻辑
    const asciiData = {
      type: 'flowchart',
      nodes: ['Start', 'Process', 'End'],
      connections: [
        ['Start', 'Process'],
        ['Process', 'End'],
      ],
    };

    return {
      type: 'ascii',
      code: '',
      data: asciiData,
    };
  }

  private async convertASCIIToMermaid(source: DiagramSource): Promise<DiagramSource> {
    // 简化的转换逻辑
    const mermaidCode = `graph TD
    A[Start] --> B[Process]
    B --> C[End]`;

    return {
      type: 'mermaid',
      code: mermaidCode,
      data: null,
    };
  }

  private async convertSvgToPng(svg: string, format: ExportFormat): Promise<Buffer> {
    // 模拟SVG到PNG的转换
    // 实际实现需要使用puppeteer或其他工具
    return Buffer.from(`PNG data for: ${svg.substring(0, 50)}...`);
  }

  private async convertSvgToPdf(svg: string, format: ExportFormat): Promise<Buffer> {
    // 模拟SVG到PDF的转换
    return Buffer.from(`PDF data for: ${svg.substring(0, 50)}...`);
  }

  private generateHtmlWrapper(diagram: DiagramComponent, format: ExportFormat): string {
    return `<!DOCTYPE html>
<html>
<head>
    <title>${diagram.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .diagram-container { text-align: center; }
        .diagram-title { font-size: 24px; margin-bottom: 10px; }
        .diagram-description { color: #666; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="diagram-container">
        <h1 class="diagram-title">${diagram.title}</h1>
        <p class="diagram-description">${diagram.description}</p>
        ${diagram.rendered.content}
    </div>
</body>
</html>`;
  }

  private detectDiagramFormat(content: string): DiagramType | undefined {
    if (content.includes('graph') || content.includes('sequenceDiagram')) {
      return 'mermaid';
    }
    if (content.includes('@startuml')) {
      return 'plantuml';
    }
    if (content.includes('digraph') || content.includes('graph {')) {
      return 'graphviz';
    }
    return undefined;
  }

  private parseNonMermaidContent(content: string, format: DiagramType): any {
    // 根据格式解析内容
    switch (format) {
      case 'ascii':
        return { type: 'text', content };
      case 'plantuml':
        return { code: content };
      default:
        return { raw: content };
    }
  }

  private clearDiagramCache(diagramId: string): void {
    // 清理特定图表的缓存
    const keysToDelete: string[] = [];
    for (const [key, cached] of this.renderCache.entries()) {
      if (key.includes(diagramId)) {
        keysToDelete.push(key);
      }
    }
    for (const key of keysToDelete) {
      this.renderCache.delete(key);
    }
  }

  private collectPerformanceMetrics() {
    const cacheEntries = Array.from(this.renderCache.values());
    const avgRenderTime =
      cacheEntries.length > 0
        ? cacheEntries.reduce((sum, entry) => sum + entry.metadata.renderTime, 0) /
          cacheEntries.length
        : 0;

    return {
      avgRenderTime,
      cacheSize: this.renderCache.size,
      memoryUsage: process.memoryUsage().heapUsed, // Node.js环境
    };
  }

  private calculateImprovement(before: number, after: number): number {
    return before > 0 ? ((before - after) / before) * 100 : 0;
  }

  private analyzeMermaidComplexity(code: string) {
    const lines = code.split('\n').filter((line) => line.trim());
    const nodePattern = /\w+\[|\w+\{|\w+\(/g;
    const edgePattern = /-->|---|\|/g;

    const nodeCount = (code.match(nodePattern) || []).length;
    const edgeCount = (code.match(edgePattern) || []).length;
    const depth = Math.max(
      ...lines.map((line, index) => {
        const indentMatch = line.match(/^(\s*)/);
        return indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;
      })
    );

    return {
      nodeCount,
      edgeCount,
      depth,
      cycleCount: 0, // 简化实现
      branchingFactor: edgeCount > 0 ? Math.round(edgeCount / nodeCount) : 0,
    };
  }

  private analyzeASCIIComplexity(data: any) {
    // 简化的ASCII复杂度分析
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    const lines = content.split('\n');

    return {
      nodeCount: lines.length,
      edgeCount: (content.match(/[-|+]/g) || []).length,
      depth: lines.length,
    };
  }

  private extractMermaidNodes(code: string): Array<{ id: string; data: any }> {
    // 简化的节点提取
    const nodePattern = /(\w+)\[([^\]]+)\]/g;
    const nodes: Array<{ id: string; data: any }> = [];
    let match;

    while ((match = nodePattern.exec(code)) !== null) {
      nodes.push({
        id: match[1],
        data: { label: match[2] },
      });
    }

    return nodes;
  }

  private generateClickHandler(handler: ClickHandler): string {
    switch (handler.action) {
      case 'navigate':
        return `window.location.href = '${handler.target}';`;
      case 'tooltip':
        return `showTooltip('${JSON.stringify(handler.data)}');`;
      case 'modal':
        return `showModal('${JSON.stringify(handler.data)}');`;
      default:
        return `console.log('Click:', ${JSON.stringify(handler.data)});`;
    }
  }

  private generateHoverHandler(handler: HoverHandler): string {
    if (handler.showTooltip) {
      return `showTooltip('${handler.tooltipContent}');`;
    }
    return `console.log('Hover');`;
  }

  private validateTemplateData(data: any, schema: TemplateSchema): void {
    for (const [key, prop] of Object.entries(schema.properties)) {
      if (prop.required && !(key in data)) {
        throw new Error(`Required property '${key}' is missing`);
      }

      if (key in data) {
        const value = data[key];
        const actualType = Array.isArray(value) ? 'array' : typeof value;

        if (prop.type !== actualType) {
          throw new Error(`Property '${key}' should be ${prop.type}, got ${actualType}`);
        }
      }
    }
  }

  private applyTemplate(template: string, data: any): string {
    let result = template;

    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(placeholder, String(value));
    }

    return result;
  }

  private async persistDiagram(diagram: DiagramComponent): Promise<void> {
    // 实现图表持久化
    // 这里暂时只是内存存储，后续会在存储层实现真正的文件持久化
  }

  private async removeDiagramFile(diagramId: string): Promise<void> {
    // 实现图表文件删除
    // 这里暂时只是内存删除，后续会在存储层实现真正的文件删除
  }
}

export default DefaultDiagramService;
