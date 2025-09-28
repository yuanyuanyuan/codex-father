/**
 * MarkdownParser - Markdown解析和处理
 *
 * 核心功能：
 * - Markdown解析与渲染 (使用marked.js + GFM)
 * - XSS防护和内容清理
 * - 章节提取和交叉引用
 * - 图表解析和渲染集成
 */

import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';
import DOMPurify from 'isomorphic-dompurify';

export interface MarkdownParserOptions {
  enableGFM?: boolean;
  enableHighlight?: boolean;
  enableMath?: boolean;
  enableTables?: boolean;
  enableDiagrams?: boolean;
  sanitize?: boolean;
  allowHTML?: boolean;
  maxDepth?: number;
  baseUrl?: string;
}

export interface ParsedSection {
  id: string;
  title: string;
  level: number;
  content: string;
  htmlContent: string;
  children: ParsedSection[];
  parent?: ParsedSection;
  metadata: {
    lineStart: number;
    lineEnd: number;
    wordCount: number;
    hasImages: boolean;
    hasTables: boolean;
    hasDiagrams: boolean;
    hasCodeBlocks: boolean;
  };
}

export interface ParsedDocument {
  title?: string;
  sections: ParsedSection[];
  metadata: DocumentMetadata;
  toc: TableOfContents;
  crossReferences: CrossReference[];
  diagrams: DiagramReference[];
  assets: AssetReference[];
}

export interface DocumentMetadata {
  wordCount: number;
  readingTime: number; // minutes
  complexity: 'low' | 'medium' | 'high';
  structure: {
    depth: number;
    sectionCount: number;
    subsectionCount: number;
  };
  content: {
    hasImages: boolean;
    hasTables: boolean;
    hasDiagrams: boolean;
    hasCodeBlocks: boolean;
    hasLinks: boolean;
    hasMath: boolean;
  };
  lastModified?: Date;
  checksum?: string;
}

export interface TableOfContents {
  sections: TOCEntry[];
  maxDepth: number;
}

export interface TOCEntry {
  id: string;
  title: string;
  level: number;
  anchor: string;
  children: TOCEntry[];
  lineNumber: number;
}

export interface CrossReference {
  id: string;
  type: 'section' | 'figure' | 'table' | 'code' | 'link';
  source: {
    sectionId: string;
    lineNumber: number;
    text: string;
  };
  target: {
    id: string;
    title?: string;
    url?: string;
    external: boolean;
  };
  valid: boolean;
}

export interface DiagramReference {
  id: string;
  type: 'mermaid' | 'plantuml' | 'ascii' | 'custom';
  source: string;
  rendered?: string;
  position: {
    sectionId: string;
    lineNumber: number;
  };
  metadata: {
    title?: string;
    caption?: string;
    width?: number;
    height?: number;
  };
}

export interface AssetReference {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document';
  url: string;
  alt?: string;
  title?: string;
  position: {
    sectionId: string;
    lineNumber: number;
  };
  metadata: {
    size?: number;
    dimensions?: { width: number; height: number };
    format?: string;
  };
}

export interface RenderOptions {
  format?: 'html' | 'text' | 'json';
  includeCSS?: boolean;
  includeTOC?: boolean;
  includeDiagrams?: boolean;
  sanitize?: boolean;
  baseUrl?: string;
  theme?: 'default' | 'github' | 'minimal';
}

export interface SectionExtractionOptions {
  includeContent?: boolean;
  includeMetadata?: boolean;
  maxDepth?: number;
  filter?: (section: ParsedSection) => boolean;
}

/**
 * MarkdownParser 类
 *
 * 提供全面的Markdown解析和处理能力
 */
export class MarkdownParser {
  private options: Required<MarkdownParserOptions>;
  private renderer: marked.Renderer;
  private tokenizer: marked.Tokenizer;

  constructor(options: MarkdownParserOptions = {}) {
    this.options = {
      enableGFM: options.enableGFM !== false,
      enableHighlight: options.enableHighlight !== false,
      enableMath: options.enableMath || false,
      enableTables: options.enableTables !== false,
      enableDiagrams: options.enableDiagrams !== false,
      sanitize: options.sanitize !== false,
      allowHTML: options.allowHTML || false,
      maxDepth: options.maxDepth || 6,
      baseUrl: options.baseUrl || '',
    };

    this.setupMarked();
    this.setupRenderer();
    this.setupTokenizer();
  }

  /**
   * 解析Markdown文档
   */
  async parse(markdown: string): Promise<ParsedDocument> {
    // 预处理
    const preprocessed = this.preprocess(markdown);

    // 解析tokens
    const tokens = marked.lexer(preprocessed);

    // 提取章节
    const sections = this.extractSections(tokens, preprocessed);

    // 生成目录
    const toc = this.generateTOC(sections);

    // 提取交叉引用
    const crossReferences = this.extractCrossReferences(preprocessed, sections);

    // 提取图表引用
    const diagrams = this.extractDiagramReferences(preprocessed, sections);

    // 提取资源引用
    const assets = this.extractAssetReferences(preprocessed, sections);

    // 生成文档元数据
    const metadata = this.generateDocumentMetadata(preprocessed, sections);

    // 提取标题
    const title = this.extractTitle(sections);

    return {
      title,
      sections,
      metadata,
      toc,
      crossReferences,
      diagrams,
      assets,
    };
  }

  /**
   * 渲染Markdown为HTML
   */
  async render(markdown: string, options: RenderOptions = {}): Promise<string> {
    const parsed = await this.parse(markdown);

    switch (options.format) {
      case 'text':
        return this.renderToText(parsed);
      case 'json':
        return JSON.stringify(parsed, null, 2);
      case 'html':
      default:
        return this.renderToHTML(parsed, options);
    }
  }

  /**
   * 提取文档章节
   */
  async extractSections(
    markdown: string,
    options: SectionExtractionOptions = {}
  ): Promise<ParsedSection[]> {
    const parsed = await this.parse(markdown);
    let sections = parsed.sections;

    // 应用过滤器
    if (options.filter) {
      sections = sections.filter(options.filter);
    }

    // 限制深度
    if (options.maxDepth) {
      sections = this.limitSectionDepth(sections, options.maxDepth);
    }

    // 清理内容和元数据
    if (!options.includeContent) {
      sections = sections.map((section) => ({
        ...section,
        content: '',
        htmlContent: '',
      }));
    }

    if (!options.includeMetadata) {
      sections = sections.map((section) => ({
        ...section,
        metadata: undefined as any,
      }));
    }

    return sections;
  }

  /**
   * 获取交叉引用
   */
  async getCrossReferences(markdown: string): Promise<CrossReference[]> {
    const parsed = await this.parse(markdown);
    return parsed.crossReferences;
  }

  /**
   * 验证文档结构
   */
  async validateStructure(markdown: string): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  }> {
    const parsed = await this.parse(markdown);
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // 检查标题层级
    for (let i = 0; i < parsed.sections.length; i++) {
      const section = parsed.sections[i];
      const nextSection = parsed.sections[i + 1];

      if (nextSection && nextSection.level > section.level + 1) {
        warnings.push(
          `Section "${section.title}" skips heading levels (${section.level} to ${nextSection.level})`
        );
      }
    }

    // 检查空章节
    const emptySections = parsed.sections.filter((s) => s.content.trim().length === 0);
    if (emptySections.length > 0) {
      warnings.push(`${emptySections.length} empty sections found`);
    }

    // 检查重复标题
    const titles = parsed.sections.map((s) => s.title.toLowerCase());
    const duplicates = titles.filter((title, index) => titles.indexOf(title) !== index);
    if (duplicates.length > 0) {
      warnings.push(`Duplicate section titles: ${[...new Set(duplicates)].join(', ')}`);
    }

    // 检查无效的交叉引用
    const invalidRefs = parsed.crossReferences.filter((ref) => !ref.valid);
    if (invalidRefs.length > 0) {
      errors.push(`${invalidRefs.length} invalid cross-references found`);
    }

    // 生成建议
    if (parsed.metadata.structure.depth > 4) {
      suggestions.push('Consider reducing document depth for better readability');
    }

    if (parsed.metadata.wordCount > 5000) {
      suggestions.push('Consider breaking long document into smaller sections');
    }

    if (!parsed.title) {
      suggestions.push('Add a main title to the document');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * 清理和净化内容
   */
  sanitize(html: string): string {
    if (!this.options.sanitize) {
      return html;
    }

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'br',
        'hr',
        'strong',
        'em',
        'u',
        'code',
        'ul',
        'ol',
        'li',
        'blockquote',
        'pre',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'a',
        'img',
        'div',
        'span',
      ],
      ALLOWED_ATTR: [
        'href',
        'title',
        'alt',
        'src',
        'class',
        'id',
        'width',
        'height',
        'target',
        'rel',
      ],
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
  }

  /**
   * 生成文档预览
   */
  async generatePreview(
    markdown: string,
    options: {
      maxWords?: number;
      includeImages?: boolean;
      format?: 'text' | 'html';
    } = {}
  ): Promise<string> {
    const maxWords = options.maxWords || 200;
    const parsed = await this.parse(markdown);

    let preview = '';
    let wordCount = 0;

    for (const section of parsed.sections) {
      if (wordCount >= maxWords) {
        break;
      }

      const sectionWords = section.content.split(/\s+/).length;
      if (wordCount + sectionWords <= maxWords) {
        preview += section.content + '\n\n';
        wordCount += sectionWords;
      } else {
        const remainingWords = maxWords - wordCount;
        const truncated = section.content.split(/\s+/).slice(0, remainingWords).join(' ');
        preview += truncated + '...';
        break;
      }
    }

    if (options.format === 'html') {
      return marked.parse(preview);
    }

    return preview.trim();
  }

  // 私有方法
  private setupMarked(): void {
    // 设置Marked选项
    marked.setOptions({
      gfm: this.options.enableGFM,
      breaks: true,
      pedantic: false,
      silent: false,
    });

    // 设置语法高亮
    if (this.options.enableHighlight) {
      marked.use(
        markedHighlight({
          langPrefix: 'hljs language-',
          highlight(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
          },
        })
      );
    }

    // 设置GFM扩展
    if (this.options.enableGFM) {
      marked.use({
        extensions: [
          {
            name: 'table',
            level: 'block',
            start: (src: string) => src.match(/^\|/)?.index,
            tokenizer: this.tokenizeTable.bind(this),
          },
        ],
      });
    }
  }

  private setupRenderer(): void {
    this.renderer = new marked.Renderer();

    // 自定义标题渲染
    this.renderer.heading = (text: string, level: number, raw: string) => {
      const anchor = this.generateAnchor(text);
      return `<h${level} id="${anchor}">${text}</h${level}>\n`;
    };

    // 自定义链接渲染
    this.renderer.link = (href: string, title: string | null, text: string) => {
      const isExternal = href.startsWith('http') || href.startsWith('//');
      const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      const titleAttr = title ? ` title="${title}"` : '';

      return `<a href="${href}"${titleAttr}${target}>${text}</a>`;
    };

    // 自定义图片渲染
    this.renderer.image = (href: string, title: string | null, text: string) => {
      const titleAttr = title ? ` title="${title}"` : '';
      const altAttr = text ? ` alt="${text}"` : '';

      return `<img src="${href}"${altAttr}${titleAttr} loading="lazy">`;
    };

    // 自定义代码块渲染
    this.renderer.code = (code: string, language: string | undefined) => {
      const lang = language || 'plaintext';

      // 检查是否是图表代码
      if (this.options.enableDiagrams && this.isDiagramCode(lang)) {
        return this.renderDiagramCode(code, lang);
      }

      const highlighted =
        this.options.enableHighlight && language ? hljs.highlight(code, { language }).value : code;

      return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>\n`;
    };

    marked.use({ renderer: this.renderer });
  }

  private setupTokenizer(): void {
    this.tokenizer = new marked.Tokenizer();

    // 扩展tokenizer以支持自定义语法
    const originalParagraph = this.tokenizer.paragraph;
    this.tokenizer.paragraph = (src: string) => {
      // 检查图表标记
      const diagramMatch = src.match(/^```(mermaid|plantuml|ascii)\n([\s\S]*?)\n```/);
      if (diagramMatch) {
        return {
          type: 'diagram',
          raw: diagramMatch[0],
          lang: diagramMatch[1],
          code: diagramMatch[2],
        };
      }

      return originalParagraph.call(this.tokenizer, src);
    };
  }

  private preprocess(markdown: string): string {
    let processed = markdown;

    // 标准化行结束符
    processed = processed.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 移除多余的空行
    processed = processed.replace(/\n{3,}/g, '\n\n');

    // 修复常见的Markdown问题
    processed = this.fixCommonIssues(processed);

    return processed;
  }

  private fixCommonIssues(markdown: string): string {
    let fixed = markdown;

    // 修复标题周围的空白
    fixed = fixed.replace(/(^|\n)(#{1,6})\s*([^\n]+)\s*$/gm, '$1$2 $3');

    // 修复列表项
    fixed = fixed.replace(/(^|\n)([*+-])\s*([^\n]+)/gm, '$1$2 $3');
    fixed = fixed.replace(/(^|\n)(\d+\.)\s*([^\n]+)/gm, '$1$2 $3');

    // 修复代码块
    fixed = fixed.replace(/(^|\n)```(\w*)\s*\n([\s\S]*?)\n```/gm, (match, prefix, lang, code) => {
      return `${prefix}\`\`\`${lang}\n${code.trim()}\n\`\`\``;
    });

    return fixed;
  }

  private extractSections(tokens: marked.Token[], markdown: string): ParsedSection[] {
    const sections: ParsedSection[] = [];
    const lines = markdown.split('\n');
    let currentSection: Partial<ParsedSection> | null = null;
    let lineIndex = 0;

    for (const token of tokens) {
      if (token.type === 'heading') {
        // 保存前一个章节
        if (currentSection) {
          currentSection.metadata!.lineEnd = lineIndex - 1;
          sections.push(this.finalizeSectionOFClass(currentSection as ParsedSection));
        }

        // 创建新章节
        currentSection = {
          id: this.generateSectionId(token.text),
          title: token.text,
          level: token.depth,
          content: '',
          htmlContent: '',
          children: [],
          metadata: {
            lineStart: lineIndex,
            lineEnd: 0,
            wordCount: 0,
            hasImages: false,
            hasTables: false,
            hasDiagrams: false,
            hasCodeBlocks: false,
          },
        };
      } else if (currentSection) {
        // 添加内容到当前章节
        const tokenContent = this.tokenToMarkdown(token);
        currentSection.content += tokenContent + '\n';
        currentSection.htmlContent += marked.parser([token]) + '\n';

        // 更新元数据
        this.updateSectionMetadata(currentSection.metadata!, token);
      }

      lineIndex += this.countTokenLines(token);
    }

    // 保存最后一个章节
    if (currentSection) {
      currentSection.metadata!.lineEnd = lines.length - 1;
      sections.push(this.finalizeSectionOFClass(currentSection as ParsedSection));
    }

    // 构建章节层次结构
    return this.buildSectionHierarchy(sections);
  }

  private finalizeSectionOFClass(section: ParsedSection): ParsedSection {
    section.metadata.wordCount = this.countWords(section.content);
    section.htmlContent = this.sanitize(section.htmlContent);
    return section;
  }

  private generateTOC(sections: ParsedSection[]): TableOfContents {
    const tocEntries: TOCEntry[] = [];
    let maxDepth = 0;

    for (const section of sections) {
      maxDepth = Math.max(maxDepth, section.level);

      const entry: TOCEntry = {
        id: section.id,
        title: section.title,
        level: section.level,
        anchor: this.generateAnchor(section.title),
        children: [],
        lineNumber: section.metadata.lineStart,
      };

      tocEntries.push(entry);
    }

    // 构建层次结构
    const hierarchicalTOC = this.buildTOCHierarchy(tocEntries);

    return {
      sections: hierarchicalTOC,
      maxDepth,
    };
  }

  private extractCrossReferences(markdown: string, sections: ParsedSection[]): CrossReference[] {
    const references: CrossReference[] = [];
    const lines = markdown.split('\n');

    // 创建章节映射
    const sectionMap = new Map<string, ParsedSection>();
    for (const section of sections) {
      sectionMap.set(section.id, section);
      sectionMap.set(section.title.toLowerCase(), section);
    }

    // 查找引用
    lines.forEach((line, lineIndex) => {
      // 内部链接 [text](#anchor)
      const internalLinks = line.matchAll(/\[([^\]]+)\]\(#([^)]+)\)/g);
      for (const match of internalLinks) {
        const [fullMatch, text, anchor] = match;
        const targetSection = Array.from(sectionMap.values()).find(
          (s) => this.generateAnchor(s.title) === anchor
        );

        references.push({
          id: this.generateReferenceId(),
          type: 'section',
          source: {
            sectionId: this.findSectionForLine(lineIndex, sections)?.id || '',
            lineNumber: lineIndex + 1,
            text: fullMatch,
          },
          target: {
            id: anchor,
            title: targetSection?.title,
            external: false,
          },
          valid: !!targetSection,
        });
      }

      // 外部链接 [text](url)
      const externalLinks = line.matchAll(/\[([^\]]+)\]\(([^)#]+)\)/g);
      for (const match of externalLinks) {
        const [fullMatch, text, url] = match;

        references.push({
          id: this.generateReferenceId(),
          type: 'link',
          source: {
            sectionId: this.findSectionForLine(lineIndex, sections)?.id || '',
            lineNumber: lineIndex + 1,
            text: fullMatch,
          },
          target: {
            id: url,
            url,
            external: true,
          },
          valid: true, // 假设外部链接有效
        });
      }
    });

    return references;
  }

  private extractDiagramReferences(
    markdown: string,
    sections: ParsedSection[]
  ): DiagramReference[] {
    const diagrams: DiagramReference[] = [];
    const lines = markdown.split('\n');

    let inCodeBlock = false;
    let currentDiagram: Partial<DiagramReference> | null = null;
    let diagramContent = '';

    lines.forEach((line, lineIndex) => {
      const codeBlockMatch = line.match(/^```(\w+)?/);

      if (codeBlockMatch && !inCodeBlock) {
        const language = codeBlockMatch[1];
        if (this.isDiagramLanguage(language)) {
          inCodeBlock = true;
          currentDiagram = {
            id: this.generateDiagramId(),
            type: language as DiagramReference['type'],
            position: {
              sectionId: this.findSectionForLine(lineIndex, sections)?.id || '',
              lineNumber: lineIndex + 1,
            },
            metadata: {},
          };
          diagramContent = '';
        }
      } else if (line.match(/^```$/) && inCodeBlock && currentDiagram) {
        currentDiagram.source = diagramContent.trim();
        diagrams.push(currentDiagram as DiagramReference);
        inCodeBlock = false;
        currentDiagram = null;
        diagramContent = '';
      } else if (inCodeBlock) {
        diagramContent += line + '\n';
      }
    });

    return diagrams;
  }

  private extractAssetReferences(markdown: string, sections: ParsedSection[]): AssetReference[] {
    const assets: AssetReference[] = [];
    const lines = markdown.split('\n');

    lines.forEach((line, lineIndex) => {
      // 图片引用 ![alt](url "title")
      const imageMatches = line.matchAll(/!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]+)")?\)/g);
      for (const match of imageMatches) {
        const [fullMatch, alt, url, title] = match;

        assets.push({
          id: this.generateAssetId(),
          type: 'image',
          url,
          alt,
          title,
          position: {
            sectionId: this.findSectionForLine(lineIndex, sections)?.id || '',
            lineNumber: lineIndex + 1,
          },
          metadata: {
            format: this.getFileExtension(url),
          },
        });
      }

      // 视频/音频链接（简化检测）
      const mediaMatches = line.matchAll(/\[([^\]]+)\]\(([^)]+\.(mp4|mp3|wav|avi|mov))\)/gi);
      for (const match of mediaMatches) {
        const [fullMatch, text, url, extension] = match;

        assets.push({
          id: this.generateAssetId(),
          type: ['mp4', 'avi', 'mov'].includes(extension.toLowerCase()) ? 'video' : 'audio',
          url,
          title: text,
          position: {
            sectionId: this.findSectionForLine(lineIndex, sections)?.id || '',
            lineNumber: lineIndex + 1,
          },
          metadata: {
            format: extension.toLowerCase(),
          },
        });
      }
    });

    return assets;
  }

  private generateDocumentMetadata(markdown: string, sections: ParsedSection[]): DocumentMetadata {
    const wordCount = this.countWords(markdown);
    const readingTime = Math.ceil(wordCount / 200); // 假设200字/分钟

    const structure = {
      depth: Math.max(...sections.map((s) => s.level), 0),
      sectionCount: sections.filter((s) => s.level === 1).length,
      subsectionCount: sections.filter((s) => s.level > 1).length,
    };

    const content = {
      hasImages: /!\[.*?\]\(.*?\)/.test(markdown),
      hasTables: /\|.*?\|/.test(markdown),
      hasDiagrams: /```(mermaid|plantuml|ascii)/.test(markdown),
      hasCodeBlocks: /```/.test(markdown),
      hasLinks: /\[.*?\]\(.*?\)/.test(markdown),
      hasMath: /\$.*?\$|\$\$.*?\$\$/.test(markdown),
    };

    let complexity: DocumentMetadata['complexity'] = 'low';
    if (wordCount > 3000 || structure.depth > 4) {
      complexity = 'high';
    } else if (wordCount > 1000 || structure.depth > 3) {
      complexity = 'medium';
    }

    return {
      wordCount,
      readingTime,
      complexity,
      structure,
      content,
      lastModified: new Date(),
    };
  }

  private extractTitle(sections: ParsedSection[]): string | undefined {
    const firstH1 = sections.find((s) => s.level === 1);
    return firstH1?.title;
  }

  private renderToHTML(parsed: ParsedDocument, options: RenderOptions): string {
    let html = '';

    // 添加CSS
    if (options.includeCSS) {
      html += this.generateCSS(options.theme || 'default');
    }

    // 添加目录
    if (options.includeTOC) {
      html += this.renderTOC(parsed.toc);
    }

    // 渲染章节
    for (const section of parsed.sections) {
      html += `<section id="${section.id}" class="document-section level-${section.level}">`;
      html += `<h${section.level}>${section.title}</h${section.level}>`;
      html += section.htmlContent;
      html += '</section>';
    }

    // 添加图表
    if (options.includeDiagrams && parsed.diagrams.length > 0) {
      html += this.renderDiagrams(parsed.diagrams);
    }

    return this.sanitize(html);
  }

  private renderToText(parsed: ParsedDocument): string {
    return parsed.sections
      .map((section) => `${'#'.repeat(section.level)} ${section.title}\n\n${section.content}`)
      .join('\n\n');
  }

  private renderTOC(toc: TableOfContents): string {
    const renderEntry = (entry: TOCEntry): string => {
      const indent = '  '.repeat(entry.level - 1);
      let html = `${indent}<li><a href="#${entry.anchor}">${entry.title}</a>`;

      if (entry.children.length > 0) {
        html += '<ul>' + entry.children.map(renderEntry).join('') + '</ul>';
      }

      html += '</li>';
      return html;
    };

    return `<nav class="table-of-contents">
      <h2>目录</h2>
      <ul>${toc.sections.map(renderEntry).join('')}</ul>
    </nav>`;
  }

  private renderDiagrams(diagrams: DiagramReference[]): string {
    return diagrams
      .map((diagram) => {
        if (diagram.rendered) {
          return `<div class="diagram" id="${diagram.id}">${diagram.rendered}</div>`;
        } else {
          return `<pre class="diagram-source" data-type="${diagram.type}"><code>${diagram.source}</code></pre>`;
        }
      })
      .join('\n');
  }

  private generateCSS(theme: string): string {
    const baseCSS = `
      <style>
        .document-section { margin-bottom: 2em; }
        .table-of-contents { margin-bottom: 2em; border: 1px solid #ddd; padding: 1em; }
        .table-of-contents ul { list-style: none; padding-left: 1.5em; }
        .table-of-contents > ul { padding-left: 0; }
        .diagram { margin: 1em 0; text-align: center; }
        .diagram-source { background: #f5f5f5; padding: 1em; border-radius: 4px; }
      </style>
    `;

    const themes = {
      default: baseCSS,
      github:
        baseCSS +
        `
        <style>
          body { font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif; }
          h1, h2, h3, h4, h5, h6 { border-bottom: 1px solid #eaecef; padding-bottom: .3em; }
        </style>
      `,
      minimal:
        baseCSS +
        `
        <style>
          body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; }
          h1, h2, h3, h4, h5, h6 { color: #333; }
        </style>
      `,
    };

    return themes[theme as keyof typeof themes] || themes.default;
  }

  // 辅助方法
  private isDiagramCode(language: string): boolean {
    return this.isDiagramLanguage(language);
  }

  private isDiagramLanguage(language?: string): boolean {
    return (
      !!language &&
      ['mermaid', 'plantuml', 'ascii', 'dot', 'graphviz'].includes(language.toLowerCase())
    );
  }

  private renderDiagramCode(code: string, language: string): string {
    // 这里应该集成图表渲染服务
    return `<div class="diagram-placeholder" data-type="${language}">
      <pre><code>${code}</code></pre>
      <p><em>Diagram rendering not implemented</em></p>
    </div>`;
  }

  private generateAnchor(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();
  }

  private generateSectionId(title: string): string {
    return `section-${this.generateAnchor(title)}`;
  }

  private generateReferenceId(): string {
    return `ref-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private generateDiagramId(): string {
    return `diagram-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private generateAssetId(): string {
    return `asset-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }

  private countTokenLines(token: marked.Token): number {
    if ('raw' in token && token.raw) {
      return (token.raw.match(/\n/g) || []).length + 1;
    }
    return 1;
  }

  private tokenToMarkdown(token: marked.Token): string {
    if ('raw' in token && token.raw) {
      return token.raw;
    }
    return '';
  }

  private tokenizeTable(this: marked.Tokenizer, src: string): marked.Tokens.Table | undefined {
    // 简化的表格解析
    const tableMatch = src.match(/^\|(.+)\|\n\|(.+)\|\n((?:\|.+\|\n?)*)/);
    if (tableMatch) {
      return {
        type: 'table',
        raw: tableMatch[0],
        header: tableMatch[1].split('|').map((cell) => ({ text: cell.trim(), tokens: [] })),
        rows: tableMatch[3]
          .split('\n')
          .filter((row) => row.trim())
          .map((row) =>
            row
              .split('|')
              .slice(1, -1)
              .map((cell) => ({ text: cell.trim(), tokens: [] }))
          ),
      };
    }
    return undefined;
  }

  private updateSectionMetadata(metadata: ParsedSection['metadata'], token: marked.Token): void {
    if (token.type === 'image') {
      metadata.hasImages = true;
    } else if (token.type === 'table') {
      metadata.hasTables = true;
    } else if (token.type === 'code') {
      metadata.hasCodeBlocks = true;
      if ('lang' in token && this.isDiagramLanguage(token.lang)) {
        metadata.hasDiagrams = true;
      }
    }
  }

  private buildSectionHierarchy(sections: ParsedSection[]): ParsedSection[] {
    const result: ParsedSection[] = [];
    const stack: ParsedSection[] = [];

    for (const section of sections) {
      // 找到正确的父级
      while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
        stack.pop();
      }

      // 设置父子关系
      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        section.parent = parent;
        parent.children.push(section);
      } else {
        result.push(section);
      }

      stack.push(section);
    }

    return result;
  }

  private buildTOCHierarchy(entries: TOCEntry[]): TOCEntry[] {
    const result: TOCEntry[] = [];
    const stack: TOCEntry[] = [];

    for (const entry of entries) {
      while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) {
        stack.pop();
      }

      if (stack.length > 0) {
        stack[stack.length - 1].children.push(entry);
      } else {
        result.push(entry);
      }

      stack.push(entry);
    }

    return result;
  }

  private limitSectionDepth(sections: ParsedSection[], maxDepth: number): ParsedSection[] {
    return sections.filter((section) => section.level <= maxDepth);
  }

  private findSectionForLine(
    lineIndex: number,
    sections: ParsedSection[]
  ): ParsedSection | undefined {
    return sections.find(
      (section) => lineIndex >= section.metadata.lineStart && lineIndex <= section.metadata.lineEnd
    );
  }

  private getFileExtension(url: string): string {
    const match = url.match(/\.([^.?#]+)(?:[?#]|$)/);
    return match ? match[1].toLowerCase() : '';
  }
}

export default MarkdownParser;
