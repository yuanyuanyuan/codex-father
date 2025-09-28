/**
 * MarkdownParser 单元测试
 *
 * 测试范围：
 * - Markdown解析和渲染 (基本语法、GFM、高亮)
 * - XSS防护和内容清理
 * - 章节提取和结构分析
 * - 交叉引用和链接处理
 * - 图表解析和集成
 * - 目录生成和导航
 * - 性能和安全验证
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import {
  MarkdownParser,
  type MarkdownParserOptions,
  type ParsedSection,
  type ParsedDocument,
  type DocumentMetadata,
  type TableOfContents,
  type TOCEntry,
  type CrossReference,
  type DiagramReference,
  type AssetReference
} from '../../../src/lib/markdown-parser.js';

describe('MarkdownParser', () => {
  let parser: MarkdownParser;
  let defaultOptions: MarkdownParserOptions;

  beforeEach(() => {
    defaultOptions = {
      enableGFM: true,
      enableHighlight: true,
      enableMath: false,
      enableTables: true,
      enableDiagrams: true,
      sanitize: true,
      allowHTML: false,
      maxDepth: 6,
      baseUrl: 'https://example.com'
    };

    parser = new MarkdownParser(defaultOptions);

    // 清理模拟
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const defaultParser = new MarkdownParser();

      expect(defaultParser).toBeDefined();
      expect(defaultParser).toBeInstanceOf(MarkdownParser);
    });

    it('should configure marked with custom options', () => {
      const customOptions: MarkdownParserOptions = {
        enableGFM: false,
        enableHighlight: false,
        sanitize: false,
        allowHTML: true
      };

      const customParser = new MarkdownParser(customOptions);

      expect(customParser).toBeDefined();
    });

    it('should validate parser options', () => {
      expect(() => {
        new MarkdownParser({ maxDepth: -1 });
      }).toThrow('Invalid maxDepth value');

      expect(() => {
        new MarkdownParser({ maxDepth: 10 });
      }).toThrow('maxDepth exceeds maximum allowed value');
    });
  });

  describe('Basic Markdown Parsing', () => {
    describe('parseMarkdown', () => {
      it('should parse basic markdown syntax', async () => {
        const markdown = `
# Main Title

This is a paragraph with **bold** and *italic* text.

## Section 1

- List item 1
- List item 2

### Subsection 1.1

\`\`\`javascript
const hello = "world";
\`\`\`
        `;

        const document = await parser.parseMarkdown(markdown);

        expect(document).toBeDefined();
        expect(document.title).toBe('Main Title');
        expect(document.sections).toHaveLength(3); // Main Title, Section 1, Subsection 1.1
        expect(document.metadata.structure.sectionCount).toBe(3);
      });

      it('should handle empty markdown', async () => {
        const document = await parser.parseMarkdown('');

        expect(document.sections).toHaveLength(0);
        expect(document.metadata.wordCount).toBe(0);
        expect(document.title).toBeUndefined();
      });

      it('should parse markdown without headers', async () => {
        const markdown = 'Just a paragraph without any headers.';

        const document = await parser.parseMarkdown(markdown);

        expect(document.sections).toHaveLength(0);
        expect(document.metadata.wordCount).toBe(7);
      });

      it('should handle deeply nested sections', async () => {
        const markdown = `
# Level 1
## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6
        `;

        const document = await parser.parseMarkdown(markdown);

        expect(document.sections).toHaveLength(6);
        expect(document.metadata.structure.depth).toBe(6);
      });
    });

    describe('renderToHTML', () => {
      it('should render markdown to HTML', async () => {
        const markdown = '# Title\n\nParagraph with **bold** text.';

        const html = await parser.renderToHTML(markdown);

        expect(html).toContain('<h1');
        expect(html).toContain('Title');
        expect(html).toContain('<p>');
        expect(html).toContain('<strong>bold</strong>');
      });

      it('should sanitize HTML when enabled', async () => {
        const markdown = 'Safe text <script>alert("xss")</script>';

        const html = await parser.renderToHTML(markdown);

        expect(html).toContain('Safe text');
        expect(html).not.toContain('<script>');
        expect(html).not.toContain('alert');
      });

      it('should allow safe HTML when configured', async () => {
        const safeParser = new MarkdownParser({
          sanitize: true,
          allowHTML: true
        });

        const markdown = 'Text with <em>emphasis</em> and <script>bad()</script>';

        const html = await safeParser.renderToHTML(markdown);

        expect(html).toContain('<em>emphasis</em>');
        expect(html).not.toContain('<script>');
      });
    });
  });

  describe('Section Extraction', () => {
    describe('extractSections', () => {
      it('should extract sections with metadata', async () => {
        const markdown = `
# Main Section

Content of main section with multiple words.

## Subsection A

Content with **formatting** and [links](http://example.com).

| Table | Header |
|-------|--------|
| Cell  | Data   |

### Deep Subsection

\`\`\`mermaid
graph TD
  A --> B
\`\`\`
        `;

        const document = await parser.parseMarkdown(markdown);
        const sections = document.sections;

        expect(sections).toHaveLength(3);

        const mainSection = sections[0];
        expect(mainSection.title).toBe('Main Section');
        expect(mainSection.level).toBe(1);
        expect(mainSection.metadata.wordCount).toBeGreaterThan(0);

        const subsectionA = sections[1];
        expect(subsectionA.title).toBe('Subsection A');
        expect(subsectionA.level).toBe(2);
        expect(subsectionA.metadata.hasTables).toBe(true);

        const deepSubsection = sections[2];
        expect(deepSubsection.title).toBe('Deep Subsection');
        expect(deepSubsection.level).toBe(3);
        expect(deepSubsection.metadata.hasDiagrams).toBe(true);
      });

      it('should build section hierarchy', async () => {
        const markdown = `
# Parent
## Child 1
### Grandchild 1.1
### Grandchild 1.2
## Child 2
        `;

        const document = await parser.parseMarkdown(markdown);
        const sections = document.sections;

        const parent = sections[0];
        expect(parent.children).toHaveLength(2);

        const child1 = sections[1];
        expect(child1.parent?.title).toBe('Parent');
        expect(child1.children).toHaveLength(2);

        const grandchild11 = sections[2];
        expect(grandchild11.parent?.title).toBe('Child 1');
      });

      it('should calculate section metadata correctly', async () => {
        const markdown = `
## Test Section

This section contains:
- Multiple **words**
- An image: ![Alt text](image.png)
- A code block:

\`\`\`python
print("Hello, World!")
\`\`\`

| Column 1 | Column 2 |
|----------|----------|
| Data     | More     |
        `;

        const document = await parser.parseMarkdown(markdown);
        const section = document.sections[0];

        expect(section.metadata.wordCount).toBeGreaterThan(10);
        expect(section.metadata.hasImages).toBe(true);
        expect(section.metadata.hasCodeBlocks).toBe(true);
        expect(section.metadata.hasTables).toBe(true);
        expect(section.metadata.lineStart).toBeGreaterThan(0);
        expect(section.metadata.lineEnd).toBeGreaterThan(section.metadata.lineStart);
      });
    });
  });

  describe('Table of Contents Generation', () => {
    describe('generateTOC', () => {
      it('should generate table of contents', async () => {
        const markdown = `
# Introduction
## Getting Started
### Prerequisites
### Installation
## Usage
### Basic Usage
### Advanced Features
# Conclusion
        `;

        const document = await parser.parseMarkdown(markdown);
        const toc = document.toc;

        expect(toc.sections).toHaveLength(2); // Introduction and Conclusion (top-level)
        expect(toc.maxDepth).toBe(3);

        const introduction = toc.sections[0];
        expect(introduction.title).toBe('Introduction');
        expect(introduction.children).toHaveLength(2); // Getting Started and Usage

        const gettingStarted = introduction.children[0];
        expect(gettingStarted.title).toBe('Getting Started');
        expect(gettingStarted.children).toHaveLength(2); // Prerequisites and Installation
      });

      it('should generate anchors for TOC entries', async () => {
        const markdown = `
# Section with Spaces
## Section-with-Hyphens
### Section_with_Underscores
#### Section123
        `;

        const document = await parser.parseMarkdown(markdown);
        const toc = document.toc;

        expect(toc.sections[0].anchor).toBe('section-with-spaces');
        expect(toc.sections[0].children[0].anchor).toBe('section-with-hyphens');
        expect(toc.sections[0].children[0].children[0].anchor).toBe('section_with_underscores');
        expect(toc.sections[0].children[0].children[0].children[0].anchor).toBe('section123');
      });

      it('should handle duplicate section titles', async () => {
        const markdown = `
# Duplicate
## Duplicate
### Duplicate
        `;

        const document = await parser.parseMarkdown(markdown);
        const toc = document.toc;

        const anchors = [
          toc.sections[0].anchor,
          toc.sections[0].children[0].anchor,
          toc.sections[0].children[0].children[0].anchor
        ];

        // 所有锚点应该是唯一的
        const uniqueAnchors = new Set(anchors);
        expect(uniqueAnchors.size).toBe(anchors.length);
      });
    });
  });

  describe('Cross-Reference Analysis', () => {
    describe('findCrossReferences', () => {
      it('should find internal section references', async () => {
        const markdown = `
# Introduction

See [Getting Started](#getting-started) for more info.

# Getting Started

Refer back to [Introduction](#introduction).
        `;

        const document = await parser.parseMarkdown(markdown);
        const crossRefs = document.crossReferences;

        expect(crossRefs).toHaveLength(2);

        const ref1 = crossRefs.find(ref => ref.target.anchor === 'getting-started');
        expect(ref1).toBeDefined();
        expect(ref1?.type).toBe('section');

        const ref2 = crossRefs.find(ref => ref.target.anchor === 'introduction');
        expect(ref2).toBeDefined();
        expect(ref2?.type).toBe('section');
      });

      it('should find external links', async () => {
        const markdown = `
# External Resources

Check out [GitHub](https://github.com) and [Stack Overflow](https://stackoverflow.com).
        `;

        const document = await parser.parseMarkdown(markdown);
        const crossRefs = document.crossReferences;

        const externalRefs = crossRefs.filter(ref => ref.type === 'link');
        expect(externalRefs).toHaveLength(2);

        const githubRef = externalRefs.find(ref => ref.target.url?.includes('github.com'));
        expect(githubRef).toBeDefined();
      });

      it('should find figure and table references', async () => {
        const markdown = `
# Document

See Figure 1 below and Table 2 in the next section.

![Figure 1: Diagram](diagram.png)

| Table 2: Data |
|---------------|
| Values        |
        `;

        const document = await parser.parseMarkdown(markdown);
        const crossRefs = document.crossReferences;

        const figureRefs = crossRefs.filter(ref => ref.type === 'figure');
        const tableRefs = crossRefs.filter(ref => ref.type === 'table');

        expect(figureRefs.length).toBeGreaterThan(0);
        expect(tableRefs.length).toBeGreaterThan(0);
      });
    });

    describe('validateReferences', () => {
      it('should validate internal references', async () => {
        const markdown = `
# Section 1

Link to [Section 2](#section-2) and [Non-existent](#missing).

# Section 2

Content here.
        `;

        const document = await parser.parseMarkdown(markdown);
        const validation = await parser.validateReferences(document);

        expect(validation.validReferences).toBeGreaterThan(0);
        expect(validation.invalidReferences).toBeGreaterThan(0);
        expect(validation.brokenLinks).toHaveLength(1);
        expect(validation.brokenLinks[0]).toContain('missing');
      });
    });
  });

  describe('Diagram Integration', () => {
    describe('extractDiagrams', () => {
      it('should extract Mermaid diagrams', async () => {
        const markdown = `
# Diagrams

\`\`\`mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action]
  B -->|No| D[End]
\`\`\`

Another diagram:

\`\`\`mermaid
sequenceDiagram
  Alice->>Bob: Hello
  Bob-->>Alice: Hi!
\`\`\`
        `;

        const document = await parser.parseMarkdown(markdown);
        const diagrams = document.diagrams;

        expect(diagrams).toHaveLength(2);

        const flowchart = diagrams[0];
        expect(flowchart.type).toBe('mermaid');
        expect(flowchart.subtype).toBe('graph');
        expect(flowchart.source).toContain('graph TD');

        const sequence = diagrams[1];
        expect(sequence.type).toBe('mermaid');
        expect(sequence.subtype).toBe('sequenceDiagram');
        expect(sequence.source).toContain('Alice->>Bob');
      });

      it('should extract PlantUML diagrams', async () => {
        const markdown = `
\`\`\`plantuml
@startuml
Alice -> Bob: Authentication Request
Bob --> Alice: Authentication Response
@enduml
\`\`\`
        `;

        const document = await parser.parseMarkdown(markdown);
        const diagrams = document.diagrams;

        expect(diagrams).toHaveLength(1);
        expect(diagrams[0].type).toBe('plantuml');
        expect(diagrams[0].source).toContain('@startuml');
      });

      it('should handle invalid diagram syntax', async () => {
        const markdown = `
\`\`\`mermaid
invalid diagram syntax
\`\`\`
        `;

        const document = await parser.parseMarkdown(markdown);
        const diagrams = document.diagrams;

        expect(diagrams).toHaveLength(1);
        expect(diagrams[0].valid).toBe(false);
        expect(diagrams[0].errors).toHaveLength(1);
      });
    });

    describe('renderDiagrams', () => {
      it('should render valid diagrams to SVG', async () => {
        const markdown = `
\`\`\`mermaid
graph TD
  A --> B
\`\`\`
        `;

        const document = await parser.parseMarkdown(markdown);
        const htmlWithDiagrams = await parser.renderWithDiagrams(document);

        expect(htmlWithDiagrams).toContain('<svg');
        expect(htmlWithDiagrams).not.toContain('```mermaid');
      });

      it('should handle diagram rendering errors gracefully', async () => {
        const markdown = `
\`\`\`mermaid
invalid syntax here
\`\`\`
        `;

        const document = await parser.parseMarkdown(markdown);
        const htmlWithDiagrams = await parser.renderWithDiagrams(document);

        // 应该包含错误信息而不是崩溃
        expect(htmlWithDiagrams).toContain('error');
        expect(htmlWithDiagrams).toBeDefined();
      });
    });
  });

  describe('Asset Management', () => {
    describe('extractAssets', () => {
      it('should extract images', async () => {
        const markdown = `
# Images

![Local image](./images/local.png)
![Remote image](https://example.com/remote.jpg "Title")
![Base64 image](data:image/png;base64,iVBORw0KGgo...)
        `;

        const document = await parser.parseMarkdown(markdown);
        const assets = document.assets;

        const images = assets.filter(asset => asset.type === 'image');
        expect(images).toHaveLength(3);

        const localImage = images.find(img => img.url.includes('./images/local.png'));
        expect(localImage?.isLocal).toBe(true);

        const remoteImage = images.find(img => img.url.includes('example.com'));
        expect(remoteImage?.isLocal).toBe(false);

        const base64Image = images.find(img => img.url.startsWith('data:'));
        expect(base64Image?.isEmbedded).toBe(true);
      });

      it('should extract links', async () => {
        const markdown = `
# Links

[Internal link](./page.md)
[External link](https://example.com)
[Email link](mailto:test@example.com)
[Anchor link](#section)
        `;

        const document = await parser.parseMarkdown(markdown);
        const assets = document.assets;

        const links = assets.filter(asset => asset.type === 'link');
        expect(links).toHaveLength(4);

        const internalLink = links.find(link => link.url.includes('./page.md'));
        expect(internalLink?.isLocal).toBe(true);

        const emailLink = links.find(link => link.url.includes('mailto:'));
        expect(emailLink?.isEmail).toBe(true);
      });

      it('should resolve relative URLs', async () => {
        const parserWithBase = new MarkdownParser({
          baseUrl: 'https://example.com/docs/'
        });

        const markdown = '![Image](../images/photo.jpg)';
        const document = await parserWithBase.parseMarkdown(markdown);
        const assets = document.assets;

        const image = assets[0];
        expect(image.resolvedUrl).toBe('https://example.com/images/photo.jpg');
      });
    });

    describe('validateAssets', () => {
      it('should validate asset accessibility', async () => {
        const markdown = `
![Valid image](./valid.png)
![Invalid image](./missing.png)
[Valid link](https://example.com)
[Invalid link](https://non-existent-domain-12345.com)
        `;

        const document = await parser.parseMarkdown(markdown);
        const validation = await parser.validateAssets(document);

        expect(validation.totalAssets).toBe(4);
        expect(validation.validAssets).toBeGreaterThan(0);
        expect(validation.invalidAssets).toBeGreaterThan(0);
        expect(validation.brokenAssets.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Document Metadata Analysis', () => {
    describe('calculateMetadata', () => {
      it('should calculate reading time', async () => {
        const longMarkdown = Array(200).fill('word').join(' '); // 200 words
        const document = await parser.parseMarkdown(longMarkdown);

        expect(document.metadata.readingTime).toBeGreaterThan(0);
        expect(document.metadata.readingTime).toBeLessThan(5); // Should be less than 5 minutes
      });

      it('should analyze document complexity', async () => {
        const complexMarkdown = `
# Complex Document

## Multiple Sections
### With Deep Nesting
#### Very Deep
##### Extremely Deep
###### Maximum Depth

Complex content with:
- Lists
- **Formatting**
- \`code\`
- [Links](http://example.com)

| Tables | Are |
|--------|-----|
| Complex| Too |

\`\`\`javascript
// Code blocks add complexity
function complex() {
  return "very complex";
}
\`\`\`

\`\`\`mermaid
graph TD
  A --> B --> C
\`\`\`
        `;

        const document = await parser.parseMarkdown(complexMarkdown);
        const metadata = document.metadata;

        expect(metadata.complexity).toBe('high'); // Should be classified as high complexity
        expect(metadata.structure.depth).toBe(6);
        expect(metadata.content.hasCodeBlocks).toBe(true);
        expect(metadata.content.hasTables).toBe(true);
        expect(metadata.content.hasDiagrams).toBe(true);
        expect(metadata.content.hasLinks).toBe(true);
      });

      it('should detect content features', async () => {
        const featureRichMarkdown = `
# Document

Math: $E = mc^2$

\`\`\`python
print("Code")
\`\`\`

| Table |
|-------|
| Data  |

![Image](img.png)

[Link](http://example.com)

\`\`\`mermaid
graph TD; A-->B
\`\`\`
        `;

        const mathParser = new MarkdownParser({ enableMath: true });
        const document = await mathParser.parseMarkdown(featureRichMarkdown);
        const content = document.metadata.content;

        expect(content.hasMath).toBe(true);
        expect(content.hasCodeBlocks).toBe(true);
        expect(content.hasTables).toBe(true);
        expect(content.hasImages).toBe(true);
        expect(content.hasLinks).toBe(true);
        expect(content.hasDiagrams).toBe(true);
      });
    });
  });

  describe('Security and Sanitization', () => {
    describe('sanitizeContent', () => {
      it('should remove dangerous HTML', async () => {
        const dangerousMarkdown = `
# Safe Title

Safe content <script>alert('xss')</script>

<iframe src="javascript:alert('xss')"></iframe>

<img src="x" onerror="alert('xss')">

Safe **formatting** remains.
        `;

        const html = await parser.renderToHTML(dangerousMarkdown);

        expect(html).not.toContain('<script>');
        expect(html).not.toContain('<iframe>');
        expect(html).not.toContain('onerror');
        expect(html).not.toContain('javascript:');
        expect(html).toContain('<strong>formatting</strong>');
      });

      it('should preserve safe HTML elements', async () => {
        const safeMarkdown = `
# Title

Paragraph with <em>emphasis</em> and <strong>strong</strong> text.

<blockquote>This is a quote</blockquote>

<code>inline code</code>
        `;

        const html = await parser.renderToHTML(safeMarkdown);

        expect(html).toContain('<em>emphasis</em>');
        expect(html).toContain('<strong>strong</strong>');
        expect(html).toContain('<blockquote>');
        expect(html).toContain('<code>');
      });

      it('should handle malicious markdown syntax', async () => {
        const maliciousMarkdown = `
[XSS](javascript:alert('xss'))

![XSS](javascript:alert('xss'))

<a href="javascript:alert('xss')">Link</a>
        `;

        const html = await parser.renderToHTML(maliciousMarkdown);

        expect(html).not.toContain('javascript:');
        expect(html).not.toContain('alert');
      });
    });

    describe('validateSyntax', () => {
      it('should detect malformed markdown', async () => {
        const malformedMarkdown = `
# Unclosed [link](

| Malformed | table
|-----------|

\`\`\`unclosed
code block
        `;

        const validation = await parser.validateSyntax(malformedMarkdown);

        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
        expect(validation.warnings.length).toBeGreaterThan(0);
      });

      it('should provide helpful error messages', async () => {
        const invalidMarkdown = `
# Title

[Broken link](

| Table | Missing |
|-------|
        `;

        const validation = await parser.validateSyntax(invalidMarkdown);

        expect(validation.errors[0].message).toContain('link');
        expect(validation.errors[0].line).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance and Limits', () => {
    it('should handle large documents efficiently', async () => {
      const largeMarkdown = `
# Large Document

${'## Section\n\nContent paragraph.\n\n'.repeat(100)}
      `;

      const startTime = Date.now();
      const document = await parser.parseMarkdown(largeMarkdown);
      const parseTime = Date.now() - startTime;

      expect(document.sections).toHaveLength(100);
      expect(parseTime).toBeLessThan(1000); // Should parse in less than 1 second
    });

    it('should enforce depth limits', async () => {
      const deepMarkdown = `
# Level 1
## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6
####### Level 7 (should be ignored)
######## Level 8 (should be ignored)
      `;

      const limitedParser = new MarkdownParser({ maxDepth: 6 });
      const document = await limitedParser.parseMarkdown(deepMarkdown);

      expect(document.sections).toHaveLength(6);
      expect(document.metadata.structure.depth).toBe(6);
    });

    it('should handle memory efficiently', async () => {
      const memoryIntensiveMarkdown = `
${'# Section\n\n' + 'Word '.repeat(1000) + '\n\n'.repeat(50)}
      `;

      const document = await parser.parseMarkdown(memoryIntensiveMarkdown);

      expect(document).toBeDefined();
      expect(document.metadata.wordCount).toBeGreaterThan(10000);
    });
  });

  describe('Custom Extensions', () => {
    it('should support custom renderers', async () => {
      const customParser = new MarkdownParser();

      // 添加自定义渲染器
      customParser.addCustomRenderer('highlight', (code, lang) => {
        return `<pre class="custom-highlight" data-lang="${lang}"><code>${code}</code></pre>`;
      });

      const markdown = '```javascript\nconst x = 1;\n```';
      const html = await customParser.renderToHTML(markdown);

      expect(html).toContain('custom-highlight');
      expect(html).toContain('data-lang="javascript"');
    });

    it('should support custom validators', async () => {
      const customParser = new MarkdownParser();

      customParser.addCustomValidator('no-caps', (text) => {
        const hasCaps = /[A-Z]/.test(text);
        return {
          isValid: !hasCaps,
          message: hasCaps ? 'Text should not contain capital letters' : ''
        };
      });

      const validation = await customParser.validateSyntax('# TITLE');

      expect(validation.isValid).toBe(false);
      expect(validation.errors[0].message).toContain('capital letters');
    });
  });

  describe('Error Handling', () => {
    it('should handle parsing errors gracefully', async () => {
      // 模拟解析器抛出错误
      const errorParser = new MarkdownParser();
      vi.spyOn(marked, 'parse').mockImplementation(() => {
        throw new Error('Parsing failed');
      });

      await expect(errorParser.parseMarkdown('# Title'))
        .rejects.toThrow('Parsing failed');

      vi.restoreAllMocks();
    });

    it('should provide detailed error information', async () => {
      const invalidMarkdown = `
# Title

[Invalid link](
      `;

      try {
        await parser.validateSyntax(invalidMarkdown);
      } catch (error: any) {
        expect(error.message).toBeDefined();
        expect(error.line).toBeDefined();
        expect(error.column).toBeDefined();
      }
    });

    it('should handle corrupted input', async () => {
      const corruptedInput = '\uFFFD\uFFFE\uFFFF'; // Invalid Unicode characters

      const document = await parser.parseMarkdown(corruptedInput);

      expect(document).toBeDefined();
      expect(document.sections).toHaveLength(0);
    });
  });
});