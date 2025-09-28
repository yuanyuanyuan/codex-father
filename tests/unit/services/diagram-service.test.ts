/**
 * DiagramService 单元测试
 *
 * 测试范围：
 * - 图表渲染 (Mermaid、ASCII、自定义格式)
 * - 图表管理 (创建、读取、更新、删除、列表)
 * - 格式转换 (导出、导入、格式转换)
 * - 缓存和性能优化
 * - 验证和分析功能
 * - 交互功能
 * - 批量操作
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import {
  DefaultDiagramService,
  type DiagramService,
  type CreateDiagramRequest,
  type UpdateDiagramRequest,
  type DiagramFilter,
  type MermaidRenderOptions,
  type ASCIIType,
  type ASCIIRenderOptions,
  type CustomRenderOptions,
  type ExportFormat,
  type ExportResult,
  type ImportSource,
  type CacheFilter,
  type PreloadResult,
  type OptimizationOptions,
  type OptimizationResult,
  type ValidationResult,
  type ComplexityAnalysis,
  type OptimizationSuggestion,
  type InteractivityConfig,
  type InteractiveDiagram,
  type ClickData,
  type ClickResponse,
  type DiagramState,
  type BatchRenderOptions,
  type BatchRenderResult,
  type DiagramTemplate
} from '../../../src/services/diagram-service.js';
import {
  type DiagramComponent,
  type DiagramSource,
  type RenderedDiagram,
  type DiagramType,
  type DiagramPosition,
  type DiagramSettings,
  type RenderOptions,
  type CacheStrategy
} from '../../../src/models/diagram-component.js';

describe('DiagramService', () => {
  let diagramService: DiagramService;
  let mockDiagramSource: DiagramSource;
  let mockDiagramComponent: DiagramComponent;

  beforeEach(() => {
    // 创建服务实例
    diagramService = new DefaultDiagramService('./test-data/diagrams', 50);

    // 创建模拟图表源
    mockDiagramSource = {
      type: 'mermaid' as DiagramType,
      code: 'graph TD; A-->B; B-->C;',
      data: null
    };

    // 创建模拟图表组件
    mockDiagramComponent = {
      id: 'diagram_123',
      title: 'Test Diagram',
      description: 'A test diagram',
      type: 'mermaid' as DiagramType,
      source: mockDiagramSource,
      position: {
        x: 0,
        y: 0,
        width: 400,
        height: 300,
        z: 1
      },
      settings: {
        responsive: true,
        theme: 'default',
        scale: 1.0,
        quality: 'high'
      },
      metadata: {
        created: new Date(),
        updated: new Date(),
        author: 'user1',
        version: '1.0.0',
        category: 'flowchart',
        tags: ['test', 'example']
      },
      renderStatus: 'success',
      lastRendered: new Date(),
      renderTime: 150,
      cacheKey: 'cache_123'
    };
  });

  describe('Diagram Rendering', () => {
    describe('renderDiagram', () => {
      it('should render a Mermaid diagram successfully', async () => {
        const options: RenderOptions = {
          responsive: true,
          scale: 1.0,
          quality: 'high'
        };

        const rendered = await diagramService.renderDiagram(mockDiagramSource, options);

        expect(rendered).toBeDefined();
        expect(rendered.id).toBeDefined();
        expect(rendered.format).toBe('svg');
        expect(rendered.content).toBeDefined();
        expect(rendered.metadata).toBeDefined();
        expect(rendered.metadata.renderTime).toBeGreaterThan(0);
        expect(rendered.metadata.timestamp).toBeDefined();
        expect(rendered.source).toEqual(mockDiagramSource);
      });

      it('should use cache for repeated renders', async () => {
        const options: RenderOptions = { responsive: true };

        // 首次渲染
        const firstRender = await diagramService.renderDiagram(mockDiagramSource, options);
        expect(firstRender.metadata.cached).toBe(false);

        // 二次渲染应该使用缓存
        const secondRender = await diagramService.renderDiagram(mockDiagramSource, options);
        expect(secondRender.fromCache).toBe(true);
      });

      it('should throw error for unsupported diagram type', async () => {
        const invalidSource: DiagramSource = {
          type: 'unsupported' as DiagramType,
          code: 'invalid',
          data: null
        };

        await expect(
          diagramService.renderDiagram(invalidSource)
        ).rejects.toThrow('Unsupported diagram type: unsupported');
      });
    });

    describe('renderMermaid', () => {
      it('should render valid Mermaid code', async () => {
        const code = 'graph TD; A-->B; B-->C; C-->D;';
        const options: MermaidRenderOptions = {
          theme: 'default',
          responsive: true,
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true
          }
        };

        const rendered = await diagramService.renderMermaid(code, options);

        expect(rendered).toBeDefined();
        expect(rendered.format).toBe('svg');
        expect(rendered.content).toBeDefined();
        expect(rendered.source.type).toBe('mermaid');
        expect(rendered.source.code).toBe(code);
        expect(rendered.metadata.hash).toBeDefined();
        expect(rendered.metadata.dimensions).toBeDefined();
      });

      it('should handle different Mermaid themes', async () => {
        const code = 'graph LR; A-->B;';
        const themes: MermaidRenderOptions['theme'][] = ['default', 'forest', 'dark', 'neutral'];

        for (const theme of themes) {
          const options: MermaidRenderOptions = { theme };
          const rendered = await diagramService.renderMermaid(code, options);

          expect(rendered).toBeDefined();
          expect(rendered.format).toBe('svg');
        }
      });

      it('should throw error for invalid Mermaid syntax', async () => {
        const invalidCode = 'invalid mermaid syntax {{{';

        await expect(
          diagramService.renderMermaid(invalidCode)
        ).rejects.toThrow('Mermaid syntax error');
      });

      it('should handle sequence diagram options', async () => {
        const code = 'sequenceDiagram; A->>B: Hello; B->>A: Hi;';
        const options: MermaidRenderOptions = {
          sequence: {
            diagramMarginX: 50,
            diagramMarginY: 10,
            actorMargin: 50,
            width: 150,
            height: 65
          }
        };

        const rendered = await diagramService.renderMermaid(code, options);

        expect(rendered).toBeDefined();
        expect(rendered.format).toBe('svg');
      });
    });

    describe('renderASCII', () => {
      it('should render ASCII box diagram', async () => {
        const data = {
          nodes: ['Node A', 'Node B', 'Node C'],
          connections: [['Node A', 'Node B'], ['Node B', 'Node C']]
        };
        const type: ASCIIType = { type: 'box' };
        const options: ASCIIRenderOptions = {
          style: 'double',
          padding: 2,
          alignment: 'center'
        };

        const rendered = await diagramService.renderASCII(data, type, options);

        expect(rendered).toBeDefined();
        expect(rendered.format).toBe('text');
        expect(rendered.content).toBeDefined();
        expect(typeof rendered.content).toBe('string');
        expect(rendered.source.type).toBe('ascii');
      });

      it('should render ASCII tree diagram', async () => {
        const data = {
          root: 'Root',
          children: [
            { name: 'Child 1', children: [{ name: 'Grandchild 1' }] },
            { name: 'Child 2' }
          ]
        };
        const type: ASCIIType = { type: 'tree' };

        const rendered = await diagramService.renderASCII(data, type);

        expect(rendered).toBeDefined();
        expect(rendered.format).toBe('text');
        expect(rendered.content).toContain('Root');
        expect(rendered.content).toContain('Child 1');
        expect(rendered.content).toContain('Child 2');
      });

      it('should handle different ASCII styles', async () => {
        const data = { nodes: ['A', 'B'] };
        const type: ASCIIType = { type: 'box' };
        const styles: ASCIIRenderOptions['style'][] = ['simple', 'double', 'rounded', 'thick'];

        for (const style of styles) {
          const options: ASCIIRenderOptions = { style };
          const rendered = await diagramService.renderASCII(data, type, options);

          expect(rendered).toBeDefined();
          expect(rendered.format).toBe('text');
        }
      });
    });

    describe('renderCustom', () => {
      it('should render custom diagram type', async () => {
        const type = 'plantuml';
        const data = '@startuml\nA -> B: Test\n@enduml';
        const options: CustomRenderOptions = {
          renderer: 'plantuml-server',
          config: { format: 'svg' }
        };

        const rendered = await diagramService.renderCustom(type, data, options);

        expect(rendered).toBeDefined();
        expect(rendered.format).toBeDefined();
        expect(rendered.content).toBeDefined();
        expect(rendered.source.type).toBe(type);
        expect(rendered.source.data).toBe(data);
      });

      it('should handle custom renderer plugins', async () => {
        const type = 'graphviz';
        const data = 'digraph G { A -> B; }';
        const options: CustomRenderOptions = {
          renderer: 'graphviz',
          plugins: ['svg-plugin', 'layout-plugin']
        };

        const rendered = await diagramService.renderCustom(type, data, options);

        expect(rendered).toBeDefined();
      });
    });
  });

  describe('Diagram Management', () => {
    describe('createDiagram', () => {
      it('should create a new diagram', async () => {
        const request: CreateDiagramRequest = {
          title: 'New Test Diagram',
          description: 'A new test diagram',
          type: 'mermaid' as DiagramType,
          source: mockDiagramSource,
          position: {
            x: 100,
            y: 100,
            width: 500,
            height: 400,
            z: 1
          },
          metadata: {
            category: 'flowchart',
            tags: ['new', 'test'],
            author: 'user1',
            version: '1.0.0'
          }
        };

        const diagram = await diagramService.createDiagram(request);

        expect(diagram).toBeDefined();
        expect(diagram.id).toBeDefined();
        expect(diagram.title).toBe(request.title);
        expect(diagram.description).toBe(request.description);
        expect(diagram.type).toBe(request.type);
        expect(diagram.source).toEqual(request.source);
        expect(diagram.position).toEqual(request.position);
        expect(diagram.metadata.category).toBe(request.metadata?.category);
        expect(diagram.metadata.tags).toEqual(request.metadata?.tags);
      });

      it('should create diagram with minimal data', async () => {
        const request: CreateDiagramRequest = {
          title: 'Minimal Diagram',
          type: 'mermaid' as DiagramType,
          source: mockDiagramSource
        };

        const diagram = await diagramService.createDiagram(request);

        expect(diagram).toBeDefined();
        expect(diagram.title).toBe(request.title);
        expect(diagram.type).toBe(request.type);
        expect(diagram.position).toBeDefined(); // 应该有默认位置
        expect(diagram.settings).toBeDefined(); // 应该有默认设置
      });
    });

    describe('getDiagram', () => {
      it('should get an existing diagram', async () => {
        const createRequest: CreateDiagramRequest = {
          title: 'Test Diagram',
          type: 'mermaid' as DiagramType,
          source: mockDiagramSource
        };

        const createdDiagram = await diagramService.createDiagram(createRequest);
        const diagram = await diagramService.getDiagram(createdDiagram.id);

        expect(diagram).toBeDefined();
        expect(diagram!.id).toBe(createdDiagram.id);
        expect(diagram!.title).toBe(createRequest.title);
      });

      it('should return null for non-existent diagram', async () => {
        const diagram = await diagramService.getDiagram('non-existent-id');

        expect(diagram).toBeNull();
      });
    });

    describe('updateDiagram', () => {
      it('should update diagram properties', async () => {
        const createRequest: CreateDiagramRequest = {
          title: 'Original Title',
          type: 'mermaid' as DiagramType,
          source: mockDiagramSource
        };

        const createdDiagram = await diagramService.createDiagram(createRequest);

        const updateRequest: UpdateDiagramRequest = {
          title: 'Updated Title',
          description: 'Updated description',
          position: {
            x: 200,
            y: 200,
            width: 600,
            height: 500,
            z: 2
          }
        };

        const updatedDiagram = await diagramService.updateDiagram(
          createdDiagram.id,
          updateRequest
        );

        expect(updatedDiagram.title).toBe(updateRequest.title);
        expect(updatedDiagram.description).toBe(updateRequest.description);
        expect(updatedDiagram.position).toEqual(updateRequest.position);
        expect(updatedDiagram.metadata.updated).toBeDefined();
      });

      it('should update diagram source', async () => {
        const createRequest: CreateDiagramRequest = {
          title: 'Test Diagram',
          type: 'mermaid' as DiagramType,
          source: mockDiagramSource
        };

        const createdDiagram = await diagramService.createDiagram(createRequest);

        const newSource: DiagramSource = {
          type: 'mermaid' as DiagramType,
          code: 'graph LR; X-->Y; Y-->Z;',
          data: null
        };

        const updateRequest: UpdateDiagramRequest = {
          source: newSource
        };

        const updatedDiagram = await diagramService.updateDiagram(
          createdDiagram.id,
          updateRequest
        );

        expect(updatedDiagram.source).toEqual(newSource);
        expect(updatedDiagram.renderStatus).toBe('pending'); // 应该重新渲染
      });

      it('should throw error for non-existent diagram', async () => {
        const updateRequest: UpdateDiagramRequest = {
          title: 'Non-existent Update'
        };

        await expect(
          diagramService.updateDiagram('non-existent-id', updateRequest)
        ).rejects.toThrow('Diagram not found: non-existent-id');
      });
    });

    describe('deleteDiagram', () => {
      it('should delete an existing diagram', async () => {
        const createRequest: CreateDiagramRequest = {
          title: 'To Delete',
          type: 'mermaid' as DiagramType,
          source: mockDiagramSource
        };

        const createdDiagram = await diagramService.createDiagram(createRequest);
        const result = await diagramService.deleteDiagram(createdDiagram.id);

        expect(result).toBe(true);

        // 验证图表已删除
        const deletedDiagram = await diagramService.getDiagram(createdDiagram.id);
        expect(deletedDiagram).toBeNull();
      });

      it('should return false for non-existent diagram', async () => {
        const result = await diagramService.deleteDiagram('non-existent-id');

        expect(result).toBe(false);
      });
    });

    describe('listDiagrams', () => {
      beforeEach(async () => {
        // 创建测试数据
        await diagramService.createDiagram({
          title: 'Diagram 1',
          type: 'mermaid' as DiagramType,
          source: mockDiagramSource,
          metadata: { category: 'flowchart', tags: ['test'], author: 'user1' }
        });

        await diagramService.createDiagram({
          title: 'Diagram 2',
          type: 'ascii' as DiagramType,
          source: { type: 'ascii' as DiagramType, code: '', data: {} },
          metadata: { category: 'tree', tags: ['example'], author: 'user2' }
        });

        await diagramService.createDiagram({
          title: 'Diagram 3',
          type: 'mermaid' as DiagramType,
          source: mockDiagramSource,
          metadata: { category: 'sequence', tags: ['test', 'sequence'], author: 'user1' }
        });
      });

      it('should list all diagrams without filter', async () => {
        const diagrams = await diagramService.listDiagrams();

        expect(diagrams).toHaveLength(3);
        expect(diagrams.map(d => d.title)).toEqual(['Diagram 1', 'Diagram 2', 'Diagram 3']);
      });

      it('should filter by type', async () => {
        const filter: DiagramFilter = { type: ['mermaid'] };
        const diagrams = await diagramService.listDiagrams(filter);

        expect(diagrams).toHaveLength(2);
        expect(diagrams.every(d => d.type === 'mermaid')).toBe(true);
      });

      it('should filter by category', async () => {
        const filter: DiagramFilter = { category: 'flowchart' };
        const diagrams = await diagramService.listDiagrams(filter);

        expect(diagrams).toHaveLength(1);
        expect(diagrams[0].metadata.category).toBe('flowchart');
      });

      it('should filter by tags', async () => {
        const filter: DiagramFilter = { tags: ['test'] };
        const diagrams = await diagramService.listDiagrams(filter);

        expect(diagrams).toHaveLength(2);
        expect(diagrams.every(d => d.metadata.tags.includes('test'))).toBe(true);
      });

      it('should filter by author', async () => {
        const filter: DiagramFilter = { author: 'user1' };
        const diagrams = await diagramService.listDiagrams(filter);

        expect(diagrams).toHaveLength(2);
        expect(diagrams.every(d => d.metadata.author === 'user1')).toBe(true);
      });

      it('should sort by title', async () => {
        const filter: DiagramFilter = { sortBy: 'title', sortOrder: 'asc' };
        const diagrams = await diagramService.listDiagrams(filter);

        expect(diagrams.map(d => d.title)).toEqual(['Diagram 1', 'Diagram 2', 'Diagram 3']);
      });

      it('should apply pagination', async () => {
        const filter: DiagramFilter = { limit: 2, offset: 1 };
        const diagrams = await diagramService.listDiagrams(filter);

        expect(diagrams).toHaveLength(2);
      });
    });
  });

  describe('Format Conversion', () => {
    let testDiagram: DiagramComponent;

    beforeEach(async () => {
      const createRequest: CreateDiagramRequest = {
        title: 'Test Conversion',
        type: 'mermaid' as DiagramType,
        source: mockDiagramSource
      };

      testDiagram = await diagramService.createDiagram(createRequest);
    });

    describe('exportDiagram', () => {
      it('should export diagram as SVG', async () => {
        const format: ExportFormat = {
          type: 'svg',
          scale: 1.0,
          backgroundColor: 'white',
          includeMetadata: true
        };

        const result = await diagramService.exportDiagram(testDiagram.id, format);

        expect(result).toBeDefined();
        expect(result.format).toBe('svg');
        expect(result.data).toBeDefined();
        expect(result.filename).toBeDefined();
        expect(result.size).toBeGreaterThan(0);
        expect(result.metadata).toBeDefined();
      });

      it('should export diagram as PNG', async () => {
        const format: ExportFormat = {
          type: 'png',
          quality: 90,
          scale: 2.0
        };

        const result = await diagramService.exportDiagram(testDiagram.id, format);

        expect(result.format).toBe('png');
        expect(result.data).toBeDefined();
        expect(result.metadata?.quality).toBe(90);
      });

      it('should export diagram source', async () => {
        const format: ExportFormat = {
          type: 'source',
          includeMetadata: true
        };

        const result = await diagramService.exportDiagram(testDiagram.id, format);

        expect(result.format).toBe('source');
        expect(typeof result.data).toBe('string');
        expect(result.data).toContain(mockDiagramSource.code);
      });
    });

    describe('importDiagram', () => {
      it('should import diagram from text', async () => {
        const source: ImportSource = {
          type: 'text',
          data: 'graph TD; Import-->Test;',
          format: 'mermaid' as DiagramType,
          options: {
            autoDetectFormat: false,
            validateSyntax: true,
            extractMetadata: false
          }
        };

        const diagram = await diagramService.importDiagram(source);

        expect(diagram).toBeDefined();
        expect(diagram.source.code).toBe(source.data);
        expect(diagram.type).toBe('mermaid');
      });

      it('should auto-detect diagram format', async () => {
        const source: ImportSource = {
          type: 'text',
          data: 'sequenceDiagram\nA->>B: Message',
          options: {
            autoDetectFormat: true,
            validateSyntax: true
          }
        };

        const diagram = await diagramService.importDiagram(source);

        expect(diagram).toBeDefined();
        expect(diagram.type).toBe('mermaid'); // 应该自动检测为 mermaid
      });

      it('should validate syntax during import', async () => {
        const source: ImportSource = {
          type: 'text',
          data: 'invalid syntax {{{',
          format: 'mermaid' as DiagramType,
          options: {
            validateSyntax: true
          }
        };

        await expect(
          diagramService.importDiagram(source)
        ).rejects.toThrow('Invalid diagram syntax');
      });
    });

    describe('convertFormat', () => {
      it('should convert Mermaid to ASCII', async () => {
        const convertedDiagram = await diagramService.convertFormat(
          testDiagram.id,
          'ascii' as DiagramType
        );

        expect(convertedDiagram).toBeDefined();
        expect(convertedDiagram.type).toBe('ascii');
        expect(convertedDiagram.source.type).toBe('ascii');
        expect(convertedDiagram.id).not.toBe(testDiagram.id); // 应该是新的图表
      });

      it('should preserve metadata during conversion', async () => {
        const convertedDiagram = await diagramService.convertFormat(
          testDiagram.id,
          'plantuml' as DiagramType
        );

        expect(convertedDiagram.title).toBe(testDiagram.title);
        expect(convertedDiagram.description).toBe(testDiagram.description);
        expect(convertedDiagram.metadata.author).toBe(testDiagram.metadata.author);
      });
    });
  });

  describe('Caching and Performance', () => {
    let testDiagram: DiagramComponent;

    beforeEach(async () => {
      const createRequest: CreateDiagramRequest = {
        title: 'Cache Test',
        type: 'mermaid' as DiagramType,
        source: mockDiagramSource
      };

      testDiagram = await diagramService.createDiagram(createRequest);
    });

    describe('cacheDiagram', () => {
      it('should cache diagram successfully', async () => {
        const strategy: CacheStrategy = 'memory';
        const result = await diagramService.cacheDiagram(testDiagram.id, strategy);

        expect(result).toBe(true);
      });

      it('should handle different cache strategies', async () => {
        const strategies: CacheStrategy[] = ['memory', 'disk', 'hybrid', 'none'];

        for (const strategy of strategies) {
          const result = await diagramService.cacheDiagram(testDiagram.id, strategy);
          expect(typeof result).toBe('boolean');
        }
      });
    });

    describe('clearCache', () => {
      it('should clear all cache when no filter provided', async () => {
        const clearedCount = await diagramService.clearCache();

        expect(typeof clearedCount).toBe('number');
        expect(clearedCount).toBeGreaterThanOrEqual(0);
      });

      it('should clear cache with filter', async () => {
        const filter: CacheFilter = {
          type: ['mermaid'],
          olderThan: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
          status: 'valid'
        };

        const clearedCount = await diagramService.clearCache(filter);

        expect(typeof clearedCount).toBe('number');
      });
    });

    describe('preloadDiagrams', () => {
      it('should preload multiple diagrams', async () => {
        const diagramIds = [testDiagram.id];
        const result = await diagramService.preloadDiagrams(diagramIds);

        expect(result).toBeDefined();
        expect(result.requested).toBe(1);
        expect(result.successful).toBeGreaterThanOrEqual(0);
        expect(result.failed).toBeGreaterThanOrEqual(0);
        expect(result.successful + result.failed).toBe(result.requested);
        expect(Array.isArray(result.errors)).toBe(true);
        expect(typeof result.totalTime).toBe('number');
      });
    });

    describe('optimizeRendering', () => {
      it('should optimize rendering performance', async () => {
        const options: OptimizationOptions = {
          enableCaching: true,
          compressionLevel: 6,
          parallel: true,
          maxConcurrency: 4,
          timeout: 5000
        };

        const result = await diagramService.optimizeRendering(options);

        expect(result).toBeDefined();
        expect(typeof result.renderTimeImprovement).toBe('number');
        expect(typeof result.cacheSizeReduction).toBe('number');
        expect(typeof result.memoryUsageReduction).toBe('number');
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(Array.isArray(result.applied)).toBe(true);
      });
    });
  });

  describe('Validation and Analysis', () => {
    describe('validateDiagramSyntax', () => {
      it('should validate valid Mermaid syntax', async () => {
        const validSource: DiagramSource = {
          type: 'mermaid' as DiagramType,
          code: 'graph TD; A-->B; B-->C;',
          data: null
        };

        const result = await diagramService.validateDiagramSyntax(validSource);

        expect(result).toBeDefined();
        expect(result.isValid).toBe(true);
        expect(Array.isArray(result.errors)).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
        expect(Array.isArray(result.suggestions)).toBe(true);
      });

      it('should detect syntax errors', async () => {
        const invalidSource: DiagramSource = {
          type: 'mermaid' as DiagramType,
          code: 'invalid syntax {{{ -->',
          data: null
        };

        const result = await diagramService.validateDiagramSyntax(invalidSource);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);

        result.errors.forEach(error => {
          expect(typeof error.message).toBe('string');
          expect(['error', 'warning']).toContain(error.severity);
        });
      });

      it('should provide suggestions for improvement', async () => {
        const source: DiagramSource = {
          type: 'mermaid' as DiagramType,
          code: 'graph TD; A-->B;', // Simple diagram that could be improved
          data: null
        };

        const result = await diagramService.validateDiagramSyntax(source);

        expect(result.suggestions).toBeDefined();
        result.suggestions.forEach(suggestion => {
          expect(['syntax', 'style', 'performance', 'accessibility']).toContain(suggestion.type);
          expect(['low', 'medium', 'high']).toContain(suggestion.impact);
          expect(typeof suggestion.message).toBe('string');
        });
      });
    });

    describe('analyzeDiagramComplexity', () => {
      it('should analyze diagram complexity', async () => {
        const complexSource: DiagramSource = {
          type: 'mermaid' as DiagramType,
          code: 'graph TD; A-->B; B-->C; C-->D; D-->E; E-->F; A-->F; B-->E;',
          data: null
        };

        const analysis = await diagramService.analyzeDiagramComplexity(complexSource);

        expect(analysis).toBeDefined();
        expect(typeof analysis.score).toBe('number');
        expect(analysis.score).toBeGreaterThanOrEqual(0);
        expect(analysis.score).toBeLessThanOrEqual(100);
        expect(['simple', 'moderate', 'complex', 'very_complex']).toContain(analysis.level);

        expect(analysis.metrics).toBeDefined();
        expect(typeof analysis.metrics.nodeCount).toBe('number');
        expect(typeof analysis.metrics.edgeCount).toBe('number');
        expect(typeof analysis.metrics.depth).toBe('number');
        expect(typeof analysis.metrics.cycleCount).toBe('number');
        expect(typeof analysis.metrics.branchingFactor).toBe('number');

        expect(analysis.renderingEstimate).toBeDefined();
        expect(typeof analysis.renderingEstimate.timeMs).toBe('number');
        expect(typeof analysis.renderingEstimate.memoryMb).toBe('number');
        expect(typeof analysis.renderingEstimate.diskSpaceMb).toBe('number');

        expect(Array.isArray(analysis.recommendations)).toBe(true);
      });
    });

    describe('suggestOptimizations', () => {
      let testDiagram: DiagramComponent;

      beforeEach(async () => {
        const createRequest: CreateDiagramRequest = {
          title: 'Optimization Test',
          type: 'mermaid' as DiagramType,
          source: {
            type: 'mermaid' as DiagramType,
            code: 'graph TD; A-->B; B-->C; C-->D; D-->A; A-->C; B-->D;',
            data: null
          }
        };

        testDiagram = await diagramService.createDiagram(createRequest);
      });

      it('should suggest diagram optimizations', async () => {
        const suggestions = await diagramService.suggestOptimizations(testDiagram.id);

        expect(Array.isArray(suggestions)).toBe(true);

        suggestions.forEach(suggestion => {
          expect(['performance', 'visual', 'accessibility', 'maintainability'])
            .toContain(suggestion.type);
          expect(typeof suggestion.title).toBe('string');
          expect(typeof suggestion.description).toBe('string');
          expect(['low', 'medium', 'high']).toContain(suggestion.impact);
          expect(['easy', 'medium', 'hard']).toContain(suggestion.difficulty);
        });
      });
    });
  });

  describe('Interactive Features', () => {
    let testDiagram: DiagramComponent;

    beforeEach(async () => {
      const createRequest: CreateDiagramRequest = {
        title: 'Interactive Test',
        type: 'mermaid' as DiagramType,
        source: mockDiagramSource
      };

      testDiagram = await diagramService.createDiagram(createRequest);
    });

    describe('generateInteractiveElements', () => {
      it('should generate interactive elements', async () => {
        const config: InteractivityConfig = {
          enableClicks: true,
          enableHovers: true,
          enableZoom: true,
          enablePan: true,
          clickHandlers: {
            'node-a': { action: 'navigate', target: '/node-a' },
            'node-b': { action: 'tooltip', data: 'Node B info' }
          },
          hoverHandlers: {
            'node-a': { showTooltip: true, tooltipContent: 'Node A' }
          }
        };

        const interactive = await diagramService.generateInteractiveElements(
          testDiagram.id,
          config
        );

        expect(interactive).toBeDefined();
        expect(interactive.diagram).toBeDefined();
        expect(Array.isArray(interactive.interactiveElements)).toBe(true);
        expect(Array.isArray(interactive.eventHandlers)).toBe(true);
        expect(interactive.configuration).toBeDefined();
      });
    });

    describe('handleDiagramClick', () => {
      it('should handle diagram click events', async () => {
        const clickData: ClickData = {
          elementId: 'node-a',
          elementType: 'node',
          position: { x: 100, y: 150 },
          modifiers: { ctrl: false, shift: false, alt: false }
        };

        const response = await diagramService.handleDiagramClick(
          testDiagram.id,
          clickData
        );

        expect(response).toBeDefined();
        expect(['none', 'navigate', 'select', 'expand', 'collapse', 'edit'])
          .toContain(response.action);
        expect(typeof response.updateDiagram).toBe('boolean');
      });

      it('should handle click with modifiers', async () => {
        const clickData: ClickData = {
          elementId: 'node-b',
          elementType: 'node',
          position: { x: 200, y: 250 },
          modifiers: { ctrl: true, shift: false, alt: false }
        };

        const response = await diagramService.handleDiagramClick(
          testDiagram.id,
          clickData
        );

        expect(response).toBeDefined();
      });
    });

    describe('updateDiagramState', () => {
      it('should update diagram state', async () => {
        const state: DiagramState = {
          selectedElements: ['node-a', 'node-b'],
          expandedNodes: ['node-a'],
          hiddenElements: [],
          viewportTransform: { x: 10, y: 20, scale: 1.5 },
          customData: { theme: 'dark', showLabels: true }
        };

        const result = await diagramService.updateDiagramState(testDiagram.id, state);

        expect(result).toBe(true);
      });
    });
  });

  describe('Batch Operations', () => {
    describe('renderMultipleDiagrams', () => {
      it('should render multiple diagrams', async () => {
        const sources: DiagramSource[] = [
          {
            type: 'mermaid' as DiagramType,
            code: 'graph TD; A1-->B1;',
            data: null
          },
          {
            type: 'mermaid' as DiagramType,
            code: 'graph LR; A2-->B2;',
            data: null
          },
          {
            type: 'ascii' as DiagramType,
            code: '',
            data: { nodes: ['X', 'Y'] }
          }
        ];

        const options: BatchRenderOptions = {
          parallel: true,
          maxConcurrency: 2,
          timeout: 5000,
          cacheResults: true
        };

        const result = await diagramService.renderMultipleDiagrams(sources, options);

        expect(result).toBeDefined();
        expect(Array.isArray(result.successful)).toBe(true);
        expect(Array.isArray(result.failed)).toBe(true);
        expect(result.statistics).toBeDefined();
        expect(typeof result.statistics.totalTime).toBe('number');
        expect(typeof result.statistics.averageTime).toBe('number');
        expect(typeof result.statistics.cacheHits).toBe('number');
        expect(typeof result.statistics.cacheMisses).toBe('number');
      });

      it('should handle batch rendering failures gracefully', async () => {
        const sources: DiagramSource[] = [
          {
            type: 'mermaid' as DiagramType,
            code: 'graph TD; A-->B;',
            data: null
          },
          {
            type: 'mermaid' as DiagramType,
            code: 'invalid syntax {{{',
            data: null
          }
        ];

        const result = await diagramService.renderMultipleDiagrams(sources);

        expect(result.successful.length + result.failed.length).toBe(sources.length);

        result.failed.forEach(failure => {
          expect(failure.source).toBeDefined();
          expect(typeof failure.error).toBe('string');
        });
      });
    });

    describe('generateDiagramsFromTemplate', () => {
      it('should generate diagrams from template', async () => {
        const template: DiagramTemplate = {
          id: 'flowchart-template',
          name: 'Basic Flowchart',
          description: 'Simple flowchart template',
          type: 'mermaid' as DiagramType,
          template: 'graph TD; {{start}}-->{{process}}; {{process}}-->{{end}};',
          schema: {
            properties: {
              start: { type: 'string', required: true, description: 'Start node label' },
              process: { type: 'string', required: true, description: 'Process node label' },
              end: { type: 'string', required: true, description: 'End node label' }
            }
          }
        };

        const data = [
          { start: 'Begin', process: 'Process A', end: 'Complete' },
          { start: 'Start', process: 'Process B', end: 'Finish' }
        ];

        const diagrams = await diagramService.generateDiagramsFromTemplate(template, data);

        expect(diagrams).toHaveLength(2);

        diagrams.forEach((diagram, index) => {
          expect(diagram.type).toBe('mermaid');
          expect(diagram.source.code).toContain(data[index].start);
          expect(diagram.source.code).toContain(data[index].process);
          expect(diagram.source.code).toContain(data[index].end);
        });
      });
    });
  });

  describe('Private Helper Methods (tested through public interfaces)', () => {
    it('should generate cache keys correctly', async () => {
      const source: DiagramSource = {
        type: 'mermaid' as DiagramType,
        code: 'graph TD; A-->B;',
        data: null
      };

      // 多次渲染相同内容应该使用缓存
      const firstRender = await diagramService.renderDiagram(source);
      const secondRender = await diagramService.renderDiagram(source);

      expect(secondRender.fromCache).toBe(true);
    });

    it('should calculate diagram hashes correctly', async () => {
      const source1: DiagramSource = {
        type: 'mermaid' as DiagramType,
        code: 'graph TD; A-->B;',
        data: null
      };

      const source2: DiagramSource = {
        type: 'mermaid' as DiagramType,
        code: 'graph TD; A-->B;', // 相同内容
        data: null
      };

      const render1 = await diagramService.renderDiagram(source1);
      const render2 = await diagramService.renderDiagram(source2);

      expect(render1.metadata.hash).toBe(render2.metadata.hash);
    });

    it('should extract SVG dimensions correctly', async () => {
      const rendered = await diagramService.renderMermaid('graph TD; A-->B;');

      expect(rendered.metadata.dimensions).toBeDefined();
      expect(typeof rendered.metadata.dimensions.width).toBe('number');
      expect(typeof rendered.metadata.dimensions.height).toBe('number');
      expect(rendered.metadata.dimensions.width).toBeGreaterThan(0);
      expect(rendered.metadata.dimensions.height).toBeGreaterThan(0);
    });

    it('should prepare Mermaid config correctly', async () => {
      const options: MermaidRenderOptions = {
        theme: 'dark',
        themeVariables: { primaryColor: '#ff0000' },
        flowchart: { useMaxWidth: true, htmlLabels: false }
      };

      const rendered = await diagramService.renderMermaid('graph TD; A-->B;', options);

      expect(rendered).toBeDefined();
      expect(rendered.settings.theme).toBe('dark');
    });
  });
});