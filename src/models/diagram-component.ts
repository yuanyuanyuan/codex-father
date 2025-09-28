/**
 * T016: DiagramComponent 数据模型
 *
 * 图表组件实体，管理文档中的可视化元素
 * 支持多种图表格式、渲染配置、缓存管理和版本控制
 */

// 图表类型枚举
export type DiagramType =
  | 'mermaid' // Mermaid图表（流程图、时序图等）
  | 'ascii' // ASCII艺术图
  | 'plantuml' // PlantUML图表
  | 'graphviz' // Graphviz DOT图表
  | 'drawio' // Draw.io图表
  | 'excalidraw' // Excalidraw手绘风格图表
  | 'custom'; // 自定义图表

// 渲染格式枚举
export type RenderFormat =
  | 'svg' // 矢量图格式
  | 'png' // 位图格式
  | 'jpg' // JPEG格式
  | 'pdf' // PDF格式
  | 'html' // HTML嵌入格式
  | 'base64'; // Base64编码

// 图表子类型枚举（针对Mermaid）
export type MermaidSubtype =
  | 'flowchart' // 流程图
  | 'sequence' // 时序图
  | 'classDiagram' // 类图
  | 'stateDiagram' // 状态图
  | 'erDiagram' // ER图
  | 'gantt' // 甘特图
  | 'pie' // 饼图
  | 'journey' // 用户旅程图
  | 'gitgraph' // Git图
  | 'requirement' // 需求图
  | 'mindmap'; // 思维导图

// 渲染质量枚举
export type RenderQuality =
  | 'low' // 低质量（快速预览）
  | 'medium' // 中等质量（标准使用）
  | 'high' // 高质量（打印/展示）
  | 'vector'; // 矢量质量（最高）

// 缓存策略枚举
export type CacheStrategy =
  | 'none' // 不缓存
  | 'memory' // 内存缓存
  | 'disk' // 磁盘缓存
  | 'hybrid'; // 混合缓存

// 图表状态枚举
export type DiagramStatus =
  | 'draft' // 草稿状态
  | 'valid' // 有效状态
  | 'invalid' // 无效状态（语法错误）
  | 'rendering' // 渲染中
  | 'cached' // 已缓存
  | 'expired'; // 已过期

// 图表源码接口
export interface DiagramSource {
  content: string; // 源码内容
  language: string; // 语言类型（mermaid、plantuml等）
  subtype?: MermaidSubtype; // 子类型（针对Mermaid）
  dependencies: string[]; // 外部依赖
  config?: DiagramConfig; // 图表配置参数
  preprocessors: string[]; // 预处理器列表
  variables?: Record<string, any>; // 变量定义
}

// 图表配置接口
export interface DiagramConfig {
  theme?: string; // 主题设置
  direction?: 'TD' | 'LR' | 'BT' | 'RL'; // 图表方向
  nodeSpacing?: number; // 节点间距
  rankSpacing?: number; // 层级间距
  curve?: 'basis' | 'linear' | 'stepAfter'; // 曲线类型
  fontFamily?: string; // 字体
  fontSize?: number; // 字体大小
  background?: string; // 背景色
  primaryColor?: string; // 主色调
  secondaryColor?: string; // 辅助色
  tertiaryColor?: string; // 第三色
  primaryBorderColor?: string; // 主边框色
  primaryTextColor?: string; // 主文字色
  lineColor?: string; // 线条颜色
  gridColor?: string; // 网格颜色
  customCSS?: string; // 自定义CSS
  clickable?: boolean; // 是否可点击
  panZoom?: boolean; // 是否支持缩放平移
}

// 渲染元数据接口
export interface RenderMetadata {
  width: number; // 图表宽度（像素）
  height: number; // 图表高度（像素）
  fileSize: number; // 文件大小（字节）
  renderTime: number; // 渲染时间（毫秒）
  cacheKey: string; // 缓存键
  lastRendered: Date; // 最后渲染时间
  renderCount: number; // 渲染次数
  optimized: boolean; // 是否已优化
  compression?: CompressionInfo; // 压缩信息
}

// 压缩信息接口
export interface CompressionInfo {
  algorithm: 'gzip' | 'brotli' | 'lz4'; // 压缩算法
  originalSize: number; // 原始大小
  compressedSize: number; // 压缩后大小
  ratio: number; // 压缩比例
}

// 渲染结果接口
export interface RenderedDiagram {
  svg?: string; // SVG格式内容
  png?: Buffer; // PNG格式数据
  jpg?: Buffer; // JPG格式数据
  pdf?: Buffer; // PDF格式数据
  html?: string; // HTML格式内容
  base64?: string; // Base64编码
  error?: RenderError; // 渲染错误信息
  metadata: RenderMetadata; // 渲染元数据
  format: RenderFormat; // 实际输出格式
  quality: RenderQuality; // 实际质量
}

// 渲染错误接口
export interface RenderError {
  code: string; // 错误代码
  message: string; // 错误消息
  line?: number; // 错误行号
  column?: number; // 错误列号
  suggestions?: string[]; // 修复建议
  documentation?: string; // 相关文档链接
}

// 图表位置接口
export interface DiagramPosition {
  order: number; // 在文档中的顺序
  sectionId?: string; // 所属章节ID
  alignment: 'left' | 'center' | 'right'; // 对齐方式
  width?: string; // 显示宽度（CSS格式）
  height?: string; // 显示高度（CSS格式）
  caption?: string; // 图表标题
  description?: string; // 图表描述
  anchor?: string; // 锚点标识
  float?: 'left' | 'right' | 'none'; // 浮动方式
  margin?: MarginSettings; // 边距设置
}

// 边距设置接口
export interface MarginSettings {
  top: string; // 上边距
  right: string; // 右边距
  bottom: string; // 下边距
  left: string; // 左边距
}

// 图表设置接口
export interface DiagramSettings {
  theme: string; // 主题设置
  scale: number; // 缩放比例（0.1-5.0）
  maxWidth: number; // 最大宽度（像素）
  maxHeight: number; // 最大高度（像素）
  quality: RenderQuality; // 渲染质量
  format: RenderFormat; // 输出格式
  cacheEnabled: boolean; // 是否启用缓存
  cacheStrategy: CacheStrategy; // 缓存策略
  autoRerender: boolean; // 是否自动重新渲染
  optimizeOutput: boolean; // 是否优化输出
  retryOnError: boolean; // 错误时是否重试
  timeout: number; // 渲染超时时间（毫秒）
  customConfig?: Record<string, any>; // 自定义配置
}

// 交互设置接口
export interface InteractionSettings {
  enabled: boolean; // 是否启用交互
  clickHandlers: ClickHandler[]; // 点击处理器
  hoverEffects: boolean; // 鼠标悬停效果
  panZoom: boolean; // 缩放平移
  selection: boolean; // 选择功能
  editing: boolean; // 编辑功能
  animation: AnimationSettings; // 动画设置
}

// 点击处理器接口
export interface ClickHandler {
  nodeId: string; // 节点ID
  action: 'navigate' | 'popup' | 'expand' | 'custom'; // 动作类型
  target?: string; // 目标（链接、弹窗内容等）
  parameters?: Record<string, any>; // 参数
}

// 动画设置接口
export interface AnimationSettings {
  enabled: boolean; // 是否启用动画
  duration: number; // 动画时长（毫秒）
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out'; // 缓动函数
  effects: AnimationEffect[]; // 动画效果
}

// 动画效果接口
export interface AnimationEffect {
  type: 'fadeIn' | 'slideIn' | 'zoomIn' | 'highlight' | 'pulse'; // 效果类型
  target: 'all' | 'nodes' | 'edges' | 'text'; // 目标元素
  delay?: number; // 延迟时间
  repeat?: boolean; // 是否重复
}

// 版本信息接口
export interface DiagramVersion {
  version: number; // 版本号
  sourceHash: string; // 源码哈希
  configHash: string; // 配置哈希
  createdAt: Date; // 创建时间
  createdBy: string; // 创建者
  changes: string[]; // 变更说明
  deprecated: boolean; // 是否已废弃
}

// 图表组件接口
export interface DiagramComponent {
  id: string; // 图表ID
  draftId: string; // 关联文档ID
  sectionId?: string; // 关联章节ID
  type: DiagramType; // 图表类型
  title: string; // 图表标题
  description?: string; // 图表描述
  source: DiagramSource; // 图表源码
  rendered: RenderedDiagram; // 渲染结果
  position: DiagramPosition; // 位置信息
  settings: DiagramSettings; // 渲染设置
  interaction?: InteractionSettings; // 交互设置
  status: DiagramStatus; // 图表状态
  version: number; // 图表版本
  versions: DiagramVersion[]; // 版本历史
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
  createdBy: string; // 创建者
  tags: string[]; // 标签
  metadata: DiagramMetadata; // 图表元数据
}

// 图表元数据接口
export interface DiagramMetadata {
  complexity: 'simple' | 'moderate' | 'complex'; // 复杂度
  nodeCount?: number; // 节点数量
  edgeCount?: number; // 边数量
  layerCount?: number; // 层级数量
  estimatedSize: number; // 预估大小（字节）
  renderHistory: RenderHistoryEntry[]; // 渲染历史
  performanceStats: PerformanceStats; // 性能统计
  accessibility: AccessibilityInfo; // 无障碍信息
  seo: SEOInfo; // SEO信息
}

// 渲染历史条目接口
export interface RenderHistoryEntry {
  timestamp: Date; // 渲染时间
  format: RenderFormat; // 渲染格式
  quality: RenderQuality; // 渲染质量
  duration: number; // 渲染时长
  success: boolean; // 是否成功
  errorCode?: string; // 错误码
}

// 性能统计接口
export interface PerformanceStats {
  averageRenderTime: number; // 平均渲染时间
  totalRenders: number; // 总渲染次数
  cacheHitRate: number; // 缓存命中率
  errorRate: number; // 错误率
  sizeTrend: SizeTrendPoint[]; // 大小趋势
}

// 大小趋势点接口
export interface SizeTrendPoint {
  timestamp: Date; // 时间点
  sourceSize: number; // 源码大小
  outputSize: number; // 输出大小
  compressionRatio: number; // 压缩比
}

// 无障碍信息接口
export interface AccessibilityInfo {
  altText?: string; // 替代文本
  longDescription?: string; // 详细描述
  ariaLabel?: string; // ARIA标签
  keyboardNavigable: boolean; // 键盘导航
  screenReaderFriendly: boolean; // 屏幕阅读器友好
  colorBlindFriendly: boolean; // 色盲友好
}

// SEO信息接口
export interface SEOInfo {
  keywords: string[]; // 关键词
  description?: string; // 描述
  structuredData?: Record<string, any>; // 结构化数据
}

// DiagramComponent 工具类
export class DiagramComponentManager {
  /**
   * 创建图表组件
   */
  static createDiagram(
    draftId: string,
    type: DiagramType,
    title: string,
    source: DiagramSource,
    createdBy: string,
    sectionId?: string
  ): DiagramComponent {
    const now = new Date();

    return {
      id: `diagram-${draftId}-${Date.now()}`,
      draftId,
      sectionId,
      type,
      title,
      source,
      rendered: this.createEmptyRender(),
      position: {
        order: 0,
        alignment: 'center',
      },
      settings: this.getDefaultSettings(),
      status: 'draft',
      version: 1,
      versions: [
        {
          version: 1,
          sourceHash: this.calculateHash(source.content),
          configHash: this.calculateHash(JSON.stringify(source.config || {})),
          createdAt: now,
          createdBy,
          changes: ['Initial creation'],
          deprecated: false,
        },
      ],
      createdAt: now,
      updatedAt: now,
      createdBy,
      tags: [],
      metadata: {
        complexity: this.assessComplexity(source.content),
        estimatedSize: source.content.length * 2, // 粗略估算
        renderHistory: [],
        performanceStats: {
          averageRenderTime: 0,
          totalRenders: 0,
          cacheHitRate: 0,
          errorRate: 0,
          sizeTrend: [],
        },
        accessibility: {
          keyboardNavigable: false,
          screenReaderFriendly: false,
          colorBlindFriendly: false,
        },
        seo: {
          keywords: [],
        },
      },
    };
  }

  /**
   * 创建空渲染结果
   */
  private static createEmptyRender(): RenderedDiagram {
    return {
      metadata: {
        width: 0,
        height: 0,
        fileSize: 0,
        renderTime: 0,
        cacheKey: '',
        lastRendered: new Date(),
        renderCount: 0,
        optimized: false,
      },
      format: 'svg',
      quality: 'medium',
    };
  }

  /**
   * 获取默认设置
   */
  private static getDefaultSettings(): DiagramSettings {
    return {
      theme: 'default',
      scale: 1.0,
      maxWidth: 1200,
      maxHeight: 800,
      quality: 'medium',
      format: 'svg',
      cacheEnabled: true,
      cacheStrategy: 'hybrid',
      autoRerender: true,
      optimizeOutput: true,
      retryOnError: true,
      timeout: 30000, // 30秒
    };
  }

  /**
   * 评估图表复杂度
   */
  private static assessComplexity(content: string): 'simple' | 'moderate' | 'complex' {
    const lines = content.split('\n').length;
    const nodeCount = (content.match(/\w+\s*\[/g) || []).length;
    const edgeCount = (content.match(/-->/g) || []).length;

    if (lines < 10 && nodeCount < 5) {
      return 'simple';
    }
    if (lines < 50 && nodeCount < 20) {
      return 'moderate';
    }
    return 'complex';
  }

  /**
   * 计算哈希值
   */
  private static calculateHash(content: string): string {
    // 简化的哈希实现
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  /**
   * 渲染图表
   */
  static async renderDiagram(
    diagram: DiagramComponent,
    format: RenderFormat = 'svg',
    quality: RenderQuality = 'medium'
  ): Promise<RenderedDiagram> {
    const startTime = Date.now();
    diagram.status = 'rendering';

    try {
      // 检查缓存
      const cacheKey = this.generateCacheKey(diagram, format, quality);
      if (diagram.settings.cacheEnabled) {
        const cached = this.getCachedRender(cacheKey);
        if (cached) {
          diagram.status = 'cached';
          return cached;
        }
      }

      // 实际渲染逻辑（这里是简化实现）
      const rendered = await this.performRender(diagram, format, quality);

      const renderTime = Date.now() - startTime;
      rendered.metadata.renderTime = renderTime;
      rendered.metadata.cacheKey = cacheKey;
      rendered.metadata.lastRendered = new Date();
      rendered.metadata.renderCount++;

      // 更新统计
      this.updateRenderStats(diagram, renderTime, true);

      // 缓存结果
      if (diagram.settings.cacheEnabled) {
        this.cacheRender(cacheKey, rendered);
      }

      diagram.rendered = rendered;
      diagram.status = 'valid';
      diagram.updatedAt = new Date();

      return rendered;
    } catch (error) {
      const renderTime = Date.now() - startTime;

      const errorResult: RenderedDiagram = {
        error: {
          code: 'RENDER_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          suggestions: ['Check diagram syntax', 'Verify dependencies'],
        },
        metadata: {
          width: 0,
          height: 0,
          fileSize: 0,
          renderTime,
          cacheKey: '',
          lastRendered: new Date(),
          renderCount: diagram.rendered.metadata.renderCount + 1,
          optimized: false,
        },
        format,
        quality,
      };

      this.updateRenderStats(diagram, renderTime, false);
      diagram.status = 'invalid';
      diagram.rendered = errorResult;

      return errorResult;
    }
  }

  /**
   * 生成缓存键
   */
  private static generateCacheKey(
    diagram: DiagramComponent,
    format: RenderFormat,
    quality: RenderQuality
  ): string {
    const sourceHash = this.calculateHash(diagram.source.content);
    const settingsHash = this.calculateHash(JSON.stringify(diagram.settings));
    return `${diagram.id}-${sourceHash}-${settingsHash}-${format}-${quality}`;
  }

  /**
   * 获取缓存渲染结果
   */
  private static getCachedRender(cacheKey: string): RenderedDiagram | null {
    // 实际实现应该从缓存系统获取
    return null;
  }

  /**
   * 缓存渲染结果
   */
  private static cacheRender(cacheKey: string, rendered: RenderedDiagram): void {
    // 实际实现应该将结果存储到缓存系统
  }

  /**
   * 执行实际渲染
   */
  private static async performRender(
    diagram: DiagramComponent,
    format: RenderFormat,
    quality: RenderQuality
  ): Promise<RenderedDiagram> {
    // 这里应该根据图表类型调用相应的渲染引擎
    // 比如Mermaid、PlantUML等

    // 简化实现：返回模拟的渲染结果
    const mockSvg = `<svg width="200" height="100"><rect width="200" height="100" fill="lightblue"/><text x="100" y="50" text-anchor="middle">${diagram.title}</text></svg>`;

    return {
      svg: format === 'svg' ? mockSvg : undefined,
      html: format === 'html' ? `<div>${mockSvg}</div>` : undefined,
      metadata: {
        width: 200,
        height: 100,
        fileSize: mockSvg.length,
        renderTime: 0,
        cacheKey: '',
        lastRendered: new Date(),
        renderCount: 0,
        optimized: true,
      },
      format,
      quality,
    };
  }

  /**
   * 更新渲染统计
   */
  private static updateRenderStats(
    diagram: DiagramComponent,
    renderTime: number,
    success: boolean
  ): void {
    const stats = diagram.metadata.performanceStats;

    stats.totalRenders++;
    stats.averageRenderTime =
      (stats.averageRenderTime * (stats.totalRenders - 1) + renderTime) / stats.totalRenders;

    if (!success) {
      stats.errorRate = (stats.errorRate * (stats.totalRenders - 1) + 1) / stats.totalRenders;
    } else {
      stats.errorRate = (stats.errorRate * (stats.totalRenders - 1)) / stats.totalRenders;
    }

    // 添加渲染历史
    diagram.metadata.renderHistory.push({
      timestamp: new Date(),
      format: diagram.settings.format,
      quality: diagram.settings.quality,
      duration: renderTime,
      success,
      errorCode: success ? undefined : 'RENDER_FAILED',
    });

    // 保持历史记录在合理范围内
    if (diagram.metadata.renderHistory.length > 100) {
      diagram.metadata.renderHistory = diagram.metadata.renderHistory.slice(-50);
    }
  }

  /**
   * 更新图表源码
   */
  static updateSource(
    diagram: DiagramComponent,
    newSource: DiagramSource,
    updatedBy: string,
    changes: string[]
  ): void {
    // 创建新版本
    const newVersion: DiagramVersion = {
      version: diagram.version + 1,
      sourceHash: this.calculateHash(newSource.content),
      configHash: this.calculateHash(JSON.stringify(newSource.config || {})),
      createdAt: new Date(),
      createdBy: updatedBy,
      changes,
      deprecated: false,
    };

    // 标记旧版本
    const currentVersion = diagram.versions.find((v) => v.version === diagram.version);
    if (currentVersion && diagram.version > 1) {
      currentVersion.deprecated = true;
    }

    diagram.source = newSource;
    diagram.version = newVersion.version;
    diagram.versions.push(newVersion);
    diagram.updatedAt = new Date();
    diagram.status = 'draft'; // 需要重新渲染

    // 重新评估复杂度
    diagram.metadata.complexity = this.assessComplexity(newSource.content);
    diagram.metadata.estimatedSize = newSource.content.length * 2;
  }

  /**
   * 验证图表数据
   */
  static validateDiagram(diagram: Partial<DiagramComponent>): string[] {
    const errors: string[] = [];

    if (!diagram.title) {
      errors.push('图表标题不能为空');
    }

    if (!diagram.source || !diagram.source.content) {
      errors.push('图表源码不能为空');
    } else if (diagram.source.content.length > 102400) {
      // 100KB
      errors.push('图表源码不能超过100KB');
    }

    if (!diagram.type) {
      errors.push('图表类型不能为空');
    }

    if (diagram.settings) {
      if (diagram.settings.scale < 0.1 || diagram.settings.scale > 5.0) {
        errors.push('缩放比例必须在0.1-5.0范围内');
      }

      if (diagram.settings.timeout < 1000 || diagram.settings.timeout > 300000) {
        errors.push('超时时间必须在1-300秒范围内');
      }
    }

    if (diagram.position && diagram.position.order < 0) {
      errors.push('图表顺序不能为负数');
    }

    return errors;
  }

  /**
   * 清理过期缓存
   */
  static cleanupExpiredCache(
    diagrams: DiagramComponent[],
    maxAge: number = 7 * 24 * 60 * 60 * 1000
  ): void {
    const cutoffTime = new Date(Date.now() - maxAge);

    for (const diagram of diagrams) {
      if (diagram.rendered.metadata.lastRendered < cutoffTime) {
        // 清理缓存（实际实现应该调用缓存系统的清理方法）
        diagram.status = 'expired';
      }
    }
  }

  /**
   * 导出图表
   */
  static exportDiagram(
    diagram: DiagramComponent,
    format: RenderFormat,
    includeMetadata = false
  ): ExportResult {
    const rendered = diagram.rendered;

    if (rendered.error) {
      throw new Error(`Cannot export diagram with render error: ${rendered.error.message}`);
    }

    let content: string | Buffer;
    let mimeType: string;
    let extension: string;

    switch (format) {
      case 'svg':
        content = rendered.svg || '';
        mimeType = 'image/svg+xml';
        extension = 'svg';
        break;
      case 'png':
        content = rendered.png || Buffer.alloc(0);
        mimeType = 'image/png';
        extension = 'png';
        break;
      case 'pdf':
        content = rendered.pdf || Buffer.alloc(0);
        mimeType = 'application/pdf';
        extension = 'pdf';
        break;
      case 'html':
        content = rendered.html || '';
        mimeType = 'text/html';
        extension = 'html';
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    const result: ExportResult = {
      content,
      mimeType,
      extension,
      filename: `${diagram.title.replace(/[^a-zA-Z0-9]/g, '_')}.${extension}`,
      size: typeof content === 'string' ? content.length : content.length,
    };

    if (includeMetadata) {
      result.metadata = {
        title: diagram.title,
        description: diagram.description,
        type: diagram.type,
        createdAt: diagram.createdAt,
        version: diagram.version,
        renderMetadata: rendered.metadata,
      };
    }

    return result;
  }
}

// 导出结果接口
export interface ExportResult {
  content: string | Buffer; // 文件内容
  mimeType: string; // MIME类型
  extension: string; // 文件扩展名
  filename: string; // 建议文件名
  size: number; // 文件大小
  metadata?: ExportMetadata; // 元数据（可选）
}

// 导出元数据接口
export interface ExportMetadata {
  title: string;
  description?: string;
  type: DiagramType;
  createdAt: Date;
  version: number;
  renderMetadata: RenderMetadata;
}
