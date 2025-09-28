/**
 * T037: Diagram Rendering Integration Test
 *
 * Tests DiagramService integration with MarkdownParser and document rendering,
 * diagram caching, performance optimization, and error fallback mechanisms.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import { FileManager } from '../../src/lib/file-manager';
import { DocumentService } from '../../src/services/document-service';
import { TemplateService } from '../../src/services/template-service';
import { DiagramService } from '../../src/services/diagram-service';
import { MarkdownParser } from '../../src/lib/markdown-parser';
import { PRDDraft } from '../../src/models/prd-draft';
import { Template } from '../../src/models/template';
import { DiagramComponent } from '../../src/models/diagram-component';

describe('T037: Diagram Rendering Integration', () => {
  let testDir: string;
  let fileManager: FileManager;
  let documentService: DocumentService;
  let templateService: TemplateService;
  let diagramService: DiagramService;
  let markdownParser: MarkdownParser;

  // Test diagram samples
  const testDiagrams = {
    mermaid: {
      flowchart: `
        flowchart TD
          A[开始] --> B{决策}
          B -->|是| C[执行A]
          B -->|否| D[执行B]
          C --> E[结束]
          D --> E
      `,
      sequence: `
        sequenceDiagram
          participant U as 用户
          participant S as 系统
          participant D as 数据库
          U->>S: 发送请求
          S->>D: 查询数据
          D-->>S: 返回结果
          S-->>U: 响应
      `,
      classDiagram: `
        classDiagram
          class PRDDraft {
            +String id
            +String title
            +String content
            +createDraft()
            +updateDraft()
          }
          class Template {
            +String id
            +String name
            +Section[] sections
            +validateTemplate()
          }
          PRDDraft --> Template : uses
      `
    },
    plantuml: {
      usecase: `
        @startuml
        left to right direction
        actor 用户
        actor 管理员

        rectangle PRD系统 {
          用户 --> (创建文档)
          用户 --> (编辑文档)
          用户 --> (查看文档)
          管理员 --> (审核文档)
          管理员 --> (管理模板)
        }
        @enduml
      `,
      component: `
        @startuml
        package "PRD系统架构" {
          component [前端界面] as Frontend
          component [API服务] as API
          component [业务逻辑] as Business
          component [数据存储] as Storage

          Frontend --> API : HTTP
          API --> Business : 调用
          Business --> Storage : 读写
        }
        @enduml
      `
    }
  };

  beforeAll(async () => {
    testDir = path.join(__dirname, '..', 'temp', 'diagram-rendering-integration');
    await fs.mkdir(testDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    fileManager = new FileManager(testDir);
    markdownParser = new MarkdownParser();
    diagramService = new DiagramService(fileManager, markdownParser);
    documentService = new DocumentService(fileManager, markdownParser);
    templateService = new TemplateService(fileManager);

    await fileManager.initialize();
    await diagramService.initialize();
  });

  afterEach(async () => {
    const files = await fs.readdir(testDir);
    for (const file of files) {
      await fs.rm(path.join(testDir, file), { recursive: true, force: true });
    }
  });

  describe('DiagramService and MarkdownParser Integration', () => {
    it('应该在 Markdown 解析过程中识别和处理图表', async () => {
      const markdownWithDiagrams = `
# PRD 文档测试

## 系统流程图

\`\`\`mermaid
${testDiagrams.mermaid.flowchart}
\`\`\`

## 时序图

\`\`\`mermaid
${testDiagrams.mermaid.sequence}
\`\`\`

## 用例图

\`\`\`plantuml
${testDiagrams.plantuml.usecase}
\`\`\`

## 普通代码块

\`\`\`javascript
function test() {
  console.log('这不是图表');
}
\`\`\`
      `;

      // Parse markdown and extract diagrams
      const parseResult = await markdownParser.parseWithDiagrams(markdownWithDiagrams);

      expect(parseResult.html).toBeDefined();
      expect(parseResult.diagrams).toHaveLength(3);

      // Verify each diagram was properly identified
      const diagramTypes = parseResult.diagrams.map(d => d.type);
      expect(diagramTypes).toContain('mermaid');
      expect(diagramTypes).toContain('plantuml');

      // Verify diagram content extraction
      const mermaidDiagrams = parseResult.diagrams.filter(d => d.type === 'mermaid');
      expect(mermaidDiagrams).toHaveLength(2);

      const flowchartDiagram = mermaidDiagrams.find(d => d.source.includes('flowchart TD'));
      expect(flowchartDiagram).toBeDefined();
      expect(flowchartDiagram!.source).toContain('开始');

      const sequenceDiagram = mermaidDiagrams.find(d => d.source.includes('sequenceDiagram'));
      expect(sequenceDiagram).toBeDefined();
      expect(sequenceDiagram!.source).toContain('用户');
    });

    it('应该渲染图表并生成可嵌入的 HTML', async () => {
      // Test Mermaid diagram rendering
      const mermaidDiagram: DiagramComponent = {
        id: 'test-mermaid',
        type: 'mermaid',
        source: testDiagrams.mermaid.flowchart,
        title: '测试流程图',
        description: 'Mermaid 流程图测试',
        metadata: {
          theme: 'default',
          scale: 1.0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const renderResult = await diagramService.renderDiagram(mermaidDiagram);

      expect(renderResult.success).toBe(true);
      expect(renderResult.html).toBeDefined();
      expect(renderResult.html).toContain('svg');
      expect(renderResult.html).toContain('开始');

      // Test PlantUML diagram rendering
      const plantumlDiagram: DiagramComponent = {
        id: 'test-plantuml',
        type: 'plantuml',
        source: testDiagrams.plantuml.usecase,
        title: '用例图',
        description: 'PlantUML 用例图测试',
        metadata: {
          format: 'svg',
          theme: 'plain'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const plantumlResult = await diagramService.renderDiagram(plantumlDiagram);

      expect(plantumlResult.success).toBe(true);
      expect(plantumlResult.html).toBeDefined();
    });

    it('应该在文档渲染中集成图表渲染', async () => {
      // Create template with diagram sections
      const diagramTemplate: Template = {
        id: 'diagram-template',
        name: '图表模板',
        description: '包含图表的模板',
        category: 'diagram',
        sections: [
          {
            id: 'architecture',
            title: '系统架构',
            type: 'diagram',
            required: true,
            content: testDiagrams.mermaid.classDiagram,
            metadata: {
              diagramType: 'mermaid',
              theme: 'default'
            }
          },
          {
            id: 'workflow',
            title: '业务流程',
            type: 'diagram',
            required: true,
            content: testDiagrams.plantuml.component,
            metadata: {
              diagramType: 'plantuml',
              format: 'svg'
            }
          }
        ],
        metadata: {
          version: '1.0.0',
          author: 'system',
          tags: ['diagram']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await templateService.createTemplate(diagramTemplate);

      // Create draft using diagram template
      const diagramDraft: PRDDraft = {
        id: 'diagram-draft',
        title: '图表测试文档',
        description: '包含图表的 PRD 文档',
        content: {
          architecture: testDiagrams.mermaid.classDiagram,
          workflow: testDiagrams.plantuml.component
        },
        templateId: 'diagram-template',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: ['diagram-test'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(diagramDraft);

      // Render complete document with diagrams
      const renderedDocument = await documentService.renderDocument('diagram-draft', {
        includeDiagrams: true,
        diagramTheme: 'default'
      });

      expect(renderedDocument.success).toBe(true);
      expect(renderedDocument.html).toBeDefined();
      expect(renderedDocument.html).toContain('svg'); // Should contain rendered diagrams
      expect(renderedDocument.diagrams).toHaveLength(2);

      // Verify diagram metadata
      const architectureDiagram = renderedDocument.diagrams.find(d => d.id.includes('architecture'));
      expect(architectureDiagram).toBeDefined();
      expect(architectureDiagram!.type).toBe('mermaid');

      const workflowDiagram = renderedDocument.diagrams.find(d => d.id.includes('workflow'));
      expect(workflowDiagram).toBeDefined();
      expect(workflowDiagram!.type).toBe('plantuml');
    });
  });

  describe('Diagram Caching and Performance', () => {
    it('应该缓存渲染后的图表以提高性能', async () => {
      const diagram: DiagramComponent = {
        id: 'cache-test-diagram',
        type: 'mermaid',
        source: testDiagrams.mermaid.flowchart,
        title: '缓存测试图表',
        description: '用于测试缓存功能',
        metadata: {
          theme: 'default'
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // First render - should cache the result
      const startTime1 = Date.now();
      const result1 = await diagramService.renderDiagram(diagram);
      const renderTime1 = Date.now() - startTime1;

      expect(result1.success).toBe(true);
      expect(result1.cached).toBe(false);

      // Second render - should use cache
      const startTime2 = Date.now();
      const result2 = await diagramService.renderDiagram(diagram);
      const renderTime2 = Date.now() - startTime2;

      expect(result2.success).toBe(true);
      expect(result2.cached).toBe(true);
      expect(result2.html).toBe(result1.html);

      // Cache should be significantly faster
      expect(renderTime2).toBeLessThan(renderTime1 * 0.5);

      // Verify cache file exists
      const cacheKey = diagramService.generateCacheKey(diagram);
      const cacheExists = await diagramService.isCached(cacheKey);
      expect(cacheExists).toBe(true);
    });

    it('应该在图表源码变更时刷新缓存', async () => {
      const originalDiagram: DiagramComponent = {
        id: 'cache-invalidation-test',
        type: 'mermaid',
        source: testDiagrams.mermaid.flowchart,
        title: '缓存失效测试',
        description: '测试缓存失效机制',
        metadata: { theme: 'default' },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Initial render
      const result1 = await diagramService.renderDiagram(originalDiagram);
      expect(result1.cached).toBe(false);

      // Second render with same content
      const result2 = await diagramService.renderDiagram(originalDiagram);
      expect(result2.cached).toBe(true);

      // Third render with modified content
      const modifiedDiagram = {
        ...originalDiagram,
        source: testDiagrams.mermaid.sequence, // Different source
        updatedAt: new Date()
      };

      const result3 = await diagramService.renderDiagram(modifiedDiagram);
      expect(result3.cached).toBe(false); // Should regenerate
      expect(result3.html).not.toBe(result1.html); // Should be different
    });

    it('应该优化大型图表的渲染性能', async () => {
      // Create a complex diagram
      const complexMermaidDiagram = `
        flowchart TD
          ${Array.from({ length: 50 }, (_, i) => `
            A${i}[节点${i}] --> B${i}{决策${i}}
            B${i} -->|是| C${i}[处理${i}]
            B${i} -->|否| D${i}[跳过${i}]
            C${i} --> E${i}[结束${i}]
            D${i} --> E${i}
          `).join('\n')}
      `;

      const complexDiagram: DiagramComponent = {
        id: 'complex-diagram',
        type: 'mermaid',
        source: complexMermaidDiagram,
        title: '复杂图表',
        description: '性能测试用复杂图表',
        metadata: {
          theme: 'default',
          scale: 0.8 // Smaller scale for performance
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Test rendering performance
      const startTime = Date.now();
      const result = await diagramService.renderDiagram(complexDiagram);
      const renderTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(renderTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Test with performance optimizations enabled
      const optimizedResult = await diagramService.renderDiagram(complexDiagram, {
        enableOptimization: true,
        maxRenderTime: 3000,
        fallbackToStatic: true
      });

      expect(optimizedResult.success).toBe(true);
    });

    it('应该提供图表渲染统计和监控', async () => {
      const diagrams = [
        {
          id: 'stats-test-1',
          type: 'mermaid' as const,
          source: testDiagrams.mermaid.flowchart
        },
        {
          id: 'stats-test-2',
          type: 'mermaid' as const,
          source: testDiagrams.mermaid.sequence
        },
        {
          id: 'stats-test-3',
          type: 'plantuml' as const,
          source: testDiagrams.plantuml.usecase
        }
      ];

      // Render multiple diagrams
      for (const diagramData of diagrams) {
        const diagram: DiagramComponent = {
          ...diagramData,
          title: `统计测试图表 ${diagramData.id}`,
          description: '用于统计测试',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await diagramService.renderDiagram(diagram);
      }

      // Get rendering statistics
      const stats = await diagramService.getRenderingStatistics();

      expect(stats.totalRendered).toBeGreaterThanOrEqual(3);
      expect(stats.byType.mermaid).toBeGreaterThanOrEqual(2);
      expect(stats.byType.plantuml).toBeGreaterThanOrEqual(1);
      expect(stats.averageRenderTime).toBeGreaterThan(0);
      expect(stats.cacheHitRatio).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling and Fallback Mechanisms', () => {
    it('应该处理无效的图表语法', async () => {
      const invalidDiagrams = [
        {
          type: 'mermaid' as const,
          source: 'invalid mermaid syntax',
          description: '无效的 Mermaid 语法'
        },
        {
          type: 'plantuml' as const,
          source: '@startuml\ninvalid syntax\n@enduml',
          description: '无效的 PlantUML 语法'
        }
      ];

      for (const invalidData of invalidDiagrams) {
        const invalidDiagram: DiagramComponent = {
          id: `invalid-${invalidData.type}`,
          type: invalidData.type,
          source: invalidData.source,
          title: '无效图表测试',
          description: invalidData.description,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await diagramService.renderDiagram(invalidDiagram);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.fallbackHtml).toBeDefined(); // Should provide fallback
        expect(result.fallbackHtml).toContain('语法错误'); // Error message in Chinese
      }
    });

    it('应该提供图表渲染失败时的降级方案', async () => {
      const problematicDiagram: DiagramComponent = {
        id: 'fallback-test',
        type: 'mermaid',
        source: 'flowchart TD\n  A[开始] --> B{这是一个非常非常长的标签，可能会导致渲染问题}',
        title: '降级测试图表',
        description: '可能导致渲染问题的图表',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await diagramService.renderDiagram(problematicDiagram, {
        enableFallback: true,
        fallbackMode: 'static_image'
      });

      if (!result.success) {
        expect(result.fallbackHtml).toBeDefined();
        expect(result.fallbackHtml).toContain('diagram-fallback');

        // Fallback should contain the source code
        expect(result.fallbackHtml).toContain('开始');
      }
    });

    it('应该处理渲染超时', async () => {
      // Create a diagram that might take long to render
      const timeoutDiagram: DiagramComponent = {
        id: 'timeout-test',
        type: 'mermaid',
        source: `
          flowchart TD
            ${Array.from({ length: 100 }, (_, i) => `
              A${i} --> B${i}
              B${i} --> C${i}
              C${i} --> D${i}
            `).join('\n')}
        `,
        title: '超时测试图表',
        description: '可能导致渲染超时的复杂图表',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await diagramService.renderDiagram(timeoutDiagram, {
        timeout: 100, // Very short timeout
        enableFallback: true
      });

      if (!result.success && result.error?.includes('timeout')) {
        expect(result.fallbackHtml).toBeDefined();
        expect(result.fallbackHtml).toContain('渲染超时');
      }
    });

    it('应该提供图表验证功能', async () => {
      const validationTests = [
        {
          type: 'mermaid' as const,
          source: testDiagrams.mermaid.flowchart,
          expectedValid: true
        },
        {
          type: 'mermaid' as const,
          source: 'invalid syntax',
          expectedValid: false
        },
        {
          type: 'plantuml' as const,
          source: testDiagrams.plantuml.usecase,
          expectedValid: true
        },
        {
          type: 'unsupported' as any,
          source: 'any content',
          expectedValid: false
        }
      ];

      for (const test of validationTests) {
        const diagram: DiagramComponent = {
          id: `validation-test-${test.type}`,
          type: test.type,
          source: test.source,
          title: '验证测试',
          description: '语法验证测试',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const validationResult = await diagramService.validateDiagram(diagram);
        expect(validationResult.valid).toBe(test.expectedValid);

        if (!validationResult.valid) {
          expect(validationResult.errors).toHaveLength.greaterThan(0);
          expect(validationResult.suggestions).toBeDefined();
        }
      }
    });

    it('应该优雅降级不支持的图表类型', async () => {
      const unsupportedDiagram: DiagramComponent = {
        id: 'unsupported-type',
        type: 'graphviz' as any, // Unsupported type
        source: 'digraph G { A -> B; }',
        title: '不支持的图表类型',
        description: '测试不支持的图表类型处理',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await diagramService.renderDiagram(unsupportedDiagram);

      expect(result.success).toBe(false);
      expect(result.error).toContain('不支持');
      expect(result.fallbackHtml).toBeDefined();
      expect(result.fallbackHtml).toContain('不支持的图表类型');
    });
  });

  describe('Integration with Document Workflow', () => {
    it('应该在文档编辑过程中实时更新图表', async () => {
      // Create draft with diagram
      const editableDraft: PRDDraft = {
        id: 'editable-diagram-draft',
        title: '可编辑图表文档',
        description: '测试图表编辑功能',
        content: {
          diagram: testDiagrams.mermaid.flowchart
        },
        templateId: 'basic',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(editableDraft);

      // Update diagram content
      const updatedContent = {
        ...editableDraft.content,
        diagram: testDiagrams.mermaid.sequence
      };

      const updateResult = await documentService.updateDraft(
        'editable-diagram-draft',
        { ...editableDraft, content: updatedContent }
      );

      expect(updateResult.success).toBe(true);

      // Verify diagram was re-rendered
      const renderedDocument = await documentService.renderDocument('editable-diagram-draft', {
        includeDiagrams: true
      });

      expect(renderedDocument.success).toBe(true);
      expect(renderedDocument.html).toContain('sequenceDiagram');
      expect(renderedDocument.html).not.toContain('flowchart TD');
    });

    it('应该支持图表版本控制', async () => {
      // Create initial draft with diagram
      const versionDraft: PRDDraft = {
        id: 'version-diagram-draft',
        title: '版本控制图表文档',
        description: '测试图表版本控制',
        content: {
          architecture: testDiagrams.mermaid.classDiagram
        },
        templateId: 'basic',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(versionDraft);

      // Create version snapshot
      const versionResult = await documentService.createVersion(
        'version-diagram-draft',
        {
          version: '1.1.0',
          message: '更新架构图',
          changes: [{
            type: 'update',
            section: 'architecture',
            description: '更新类图结构'
          }]
        }
      );

      expect(versionResult.success).toBe(true);

      // Update diagram in new version
      const updatedDraft = {
        ...versionDraft,
        content: {
          architecture: testDiagrams.plantuml.component
        },
        version: '1.1.0'
      };

      await documentService.updateDraft('version-diagram-draft', updatedDraft);

      // Verify both versions have correct diagrams
      const v1Document = await documentService.renderDocument('version-diagram-draft', {
        version: '1.0.0',
        includeDiagrams: true
      });

      const v2Document = await documentService.renderDocument('version-diagram-draft', {
        version: '1.1.0',
        includeDiagrams: true
      });

      expect(v1Document.html).toContain('classDiagram');
      expect(v2Document.html).toContain('component');
    });

    it('应该支持图表导出功能', async () => {
      const exportDraft: PRDDraft = {
        id: 'export-diagram-draft',
        title: '图表导出测试',
        description: '测试图表导出功能',
        content: {
          flowchart: testDiagrams.mermaid.flowchart,
          usecase: testDiagrams.plantuml.usecase
        },
        templateId: 'basic',
        author: 'test-user',
        status: 'draft',
        version: '1.0.0',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await documentService.createDraft(exportDraft);

      // Export document with diagrams
      const exportResult = await documentService.exportDocument('export-diagram-draft', {
        format: 'html',
        includeDiagrams: true,
        diagramFormat: 'svg'
      });

      expect(exportResult.success).toBe(true);
      expect(exportResult.content).toContain('svg');
      expect(exportResult.diagrams).toHaveLength(2);

      // Test individual diagram export
      const diagramExport = await diagramService.exportDiagram('export-diagram-draft', 'flowchart', {
        format: 'png',
        width: 800,
        height: 600
      });

      expect(diagramExport.success).toBe(true);
      expect(diagramExport.format).toBe('png');
      expect(diagramExport.data).toBeDefined();
    });
  });
});