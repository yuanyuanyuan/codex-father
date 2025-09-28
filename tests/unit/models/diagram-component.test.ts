/**
 * T039: DiagramComponent Model Unit Tests
 *
 * Comprehensive unit tests for DiagramComponent model including validation rules,
 * diagram type handling, rendering configuration, and component lifecycle.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DiagramComponent,
  DiagramType,
  RenderingOptions,
  DiagramTheme,
  DiagramStatus,
  createDiagramComponent,
  isDiagramComponent,
  validateDiagramComponent,
  parseDiagramSource,
  validateDiagramSyntax,
  estimateRenderingComplexity
} from '../../../src/models/diagram-component';

describe('DiagramComponent Model', () => {
  let validDiagramComponent: DiagramComponent;

  beforeEach(() => {
    validDiagramComponent = {
      id: 'diagram-001',
      type: 'mermaid',
      source: `
        flowchart TD
          A[开始] --> B{决策}
          B -->|是| C[执行A]
          B -->|否| D[执行B]
          C --> E[结束]
          D --> E
      `,
      title: '业务流程图',
      description: '展示核心业务流程的决策逻辑',
      renderingOptions: {
        theme: 'default',
        format: 'svg',
        width: 800,
        height: 600,
        scale: 1.0,
        backgroundColor: '#ffffff',
        responsive: true
      },
      status: 'active',
      metadata: {
        complexity: 'medium',
        estimatedRenderTime: 150,
        lastRendered: new Date('2024-01-01T10:00:00Z'),
        renderCount: 5,
        errorCount: 0,
        tags: ['business', 'workflow', 'decision'],
        category: 'process'
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: [],
        lastValidated: new Date('2024-01-01T09:00:00Z')
      },
      performance: {
        averageRenderTime: 120,
        maxRenderTime: 200,
        minRenderTime: 80,
        cacheHitRatio: 0.75,
        lastOptimized: new Date('2024-01-01T08:00:00Z')
      },
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-01T12:00:00Z')
    };
  });

  describe('Type Guards', () => {
    it('应该正确识别有效的 DiagramComponent 对象', () => {
      expect(isDiagramComponent(validDiagramComponent)).toBe(true);
    });

    it('应该拒绝缺少必需字段的对象', () => {
      const requiredFields = [
        'id', 'type', 'source', 'title', 'description', 'status',
        'createdAt', 'updatedAt'
      ];

      requiredFields.forEach(field => {
        const invalidDiagram = { ...validDiagramComponent };
        delete (invalidDiagram as any)[field];
        expect(isDiagramComponent(invalidDiagram)).toBe(false);
      });
    });

    it('应该验证 DiagramType 枚举值', () => {
      const validTypes: DiagramType[] = [
        'mermaid', 'plantuml', 'graphviz', 'drawio', 'd3', 'chartjs'
      ];

      validTypes.forEach(type => {
        const diagram = { ...validDiagramComponent, type };
        expect(isDiagramComponent(diagram)).toBe(true);
      });

      const invalidType = { ...validDiagramComponent, type: 'invalid-type' };
      expect(isDiagramComponent(invalidType)).toBe(false);
    });

    it('应该验证 DiagramStatus 枚举值', () => {
      const validStatuses: DiagramStatus[] = [
        'active', 'inactive', 'draft', 'error', 'deprecated'
      ];

      validStatuses.forEach(status => {
        const diagram = { ...validDiagramComponent, status };
        expect(isDiagramComponent(diagram)).toBe(true);
      });

      const invalidStatus = { ...validDiagramComponent, status: 'invalid-status' };
      expect(isDiagramComponent(invalidStatus)).toBe(false);
    });

    it('应该正确处理可选字段', () => {
      // 最小图表组件
      const minimalDiagram = {
        id: 'minimal-diagram',
        type: 'mermaid' as DiagramType,
        source: 'graph TD\n  A --> B',
        title: '简单图表',
        description: '最小字段测试',
        status: 'active' as DiagramStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(isDiagramComponent(minimalDiagram)).toBe(true);

      // 带可选字段的图表
      const diagramWithOptionals = {
        ...minimalDiagram,
        renderingOptions: {
          theme: 'dark' as DiagramTheme,
          format: 'png',
          width: 1024,
          height: 768
        },
        metadata: {
          complexity: 'low',
          tags: ['simple']
        }
      };

      expect(isDiagramComponent(diagramWithOptionals)).toBe(true);
    });
  });

  describe('Diagram Source Validation', () => {
    it('应该验证 Mermaid 图表语法', () => {
      const validMermaidSources = [
        'graph TD\n  A --> B',
        'flowchart LR\n  start --> stop',
        'sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi',
        'classDiagram\n  class Animal\n  Animal : +int age\n  Animal : +String gender',
        'gitgraph\n  commit\n  branch develop\n  commit',
        'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85\n  "Rats" : 15'
      ];

      validMermaidSources.forEach(source => {
        const diagram = {
          ...validDiagramComponent,
          type: 'mermaid' as DiagramType,
          source
        };
        expect(validateDiagramComponent(diagram).valid).toBe(true);
      });

      const invalidMermaidSources = [
        '', // 空源码
        '   ', // 只有空格
        'invalid syntax',
        'graph TD\n  A ->>', // 语法错误
        'flowchart\n  missing direction'
      ];

      invalidMermaidSources.forEach(source => {
        const diagram = {
          ...validDiagramComponent,
          type: 'mermaid' as DiagramType,
          source
        };
        const result = validateDiagramComponent(diagram);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证 PlantUML 图表语法', () => {
      const validPlantUMLSources = [
        '@startuml\nAlice -> Bob: Authentication Request\n@enduml',
        '@startuml\nclass Car\nclass Driver\nCar *-- Driver : owns\n@enduml',
        '@startuml\n!define RECTANGLE class\nRECTANGLE Entity\n@enduml',
        '@startuml\nstart\n:Hello world;\nstop\n@enduml'
      ];

      validPlantUMLSources.forEach(source => {
        const diagram = {
          ...validDiagramComponent,
          type: 'plantuml' as DiagramType,
          source
        };
        expect(validateDiagramComponent(diagram).valid).toBe(true);
      });

      const invalidPlantUMLSources = [
        '@startuml\nno end tag',
        'missing start tag\n@enduml',
        '@startuml\ninvalid -> syntax\n@enduml',
        '@startuml\n@enduml' // 空内容
      ];

      invalidPlantUMLSources.forEach(source => {
        const diagram = {
          ...validDiagramComponent,
          type: 'plantuml' as DiagramType,
          source
        };
        const result = validateDiagramComponent(diagram);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证 Graphviz 图表语法', () => {
      const validGraphvizSources = [
        'digraph G {\n  A -> B;\n}',
        'graph G {\n  A -- B;\n}',
        'digraph {\n  node [shape=box];\n  A -> B -> C;\n}',
        'strict digraph {\n  A -> B;\n  B -> A;\n}'
      ];

      validGraphvizSources.forEach(source => {
        const diagram = {
          ...validDiagramComponent,
          type: 'graphviz' as DiagramType,
          source
        };
        expect(validateDiagramComponent(diagram).valid).toBe(true);
      });

      const invalidGraphvizSources = [
        'digraph {\n  A ->\n}', // 不完整的边
        'graph G {\n  A ->;\n}', // 无向图使用有向边
        'digraph\n  A -> B;\n}', // 缺少花括号
        'invalid syntax'
      ];

      invalidGraphvizSources.forEach(source => {
        const diagram = {
          ...validDiagramComponent,
          type: 'graphviz' as DiagramType,
          source
        };
        const result = validateDiagramComponent(diagram);
        expect(result.valid).toBe(false);
      });
    });

    it('应该解析图表源码元信息', () => {
      const sourceTests = [
        {
          type: 'mermaid' as DiagramType,
          source: 'flowchart TD\n  A[开始] --> B{决策}\n  B --> C[结束]',
          expectedNodes: 3,
          expectedEdges: 2,
          expectedComplexity: 'low'
        },
        {
          type: 'mermaid' as DiagramType,
          source: `
            graph TD
              ${Array.from({ length: 20 }, (_, i) => `A${i} --> B${i}`).join('\n  ')}
          `,
          expectedNodes: 40,
          expectedEdges: 20,
          expectedComplexity: 'high'
        }
      ];

      sourceTests.forEach(({ type, source, expectedNodes, expectedEdges, expectedComplexity }) => {
        const parsed = parseDiagramSource(type, source);
        expect(parsed.nodeCount).toBe(expectedNodes);
        expect(parsed.edgeCount).toBe(expectedEdges);
        expect(parsed.complexity).toBe(expectedComplexity);
      });
    });
  });

  describe('Rendering Options Validation', () => {
    it('应该验证渲染选项', () => {
      const validRenderingOptions: RenderingOptions[] = [
        {
          theme: 'default',
          format: 'svg',
          width: 800,
          height: 600
        },
        {
          theme: 'dark',
          format: 'png',
          width: 1920,
          height: 1080,
          scale: 2.0,
          backgroundColor: '#000000',
          responsive: false
        },
        {
          theme: 'neutral',
          format: 'pdf',
          width: 210, // A4 宽度（mm）
          height: 297, // A4 高度（mm）
          dpi: 300,
          quality: 'high'
        }
      ];

      validRenderingOptions.forEach(renderingOptions => {
        const diagram = { ...validDiagramComponent, renderingOptions };
        expect(validateDiagramComponent(diagram).valid).toBe(true);
      });

      const invalidRenderingOptions = [
        { theme: 'invalid-theme', format: 'svg', width: 800, height: 600 },
        { theme: 'default', format: 'invalid-format', width: 800, height: 600 },
        { theme: 'default', format: 'svg', width: 0, height: 600 }, // 零宽度
        { theme: 'default', format: 'svg', width: 800, height: -100 }, // 负高度
        { theme: 'default', format: 'svg', width: 'invalid', height: 600 }, // 非数字
        { theme: 'default', format: 'svg', width: 50000, height: 600 } // 过大尺寸
      ];

      invalidRenderingOptions.forEach(renderingOptions => {
        const diagram = { ...validDiagramComponent, renderingOptions: renderingOptions as any };
        const result = validateDiagramComponent(diagram);
        expect(result.valid).toBe(false);
      });
    });

    it('应该验证主题设置', () => {
      const validThemes: DiagramTheme[] = [
        'default', 'dark', 'neutral', 'forest', 'base'
      ];

      validThemes.forEach(theme => {
        const renderingOptions = {
          ...validDiagramComponent.renderingOptions!,
          theme
        };
        const diagram = { ...validDiagramComponent, renderingOptions };
        expect(validateDiagramComponent(diagram).valid).toBe(true);
      });

      const invalidTheme = {
        ...validDiagramComponent.renderingOptions!,
        theme: 'invalid-theme' as DiagramTheme
      };
      const diagram = { ...validDiagramComponent, renderingOptions: invalidTheme };
      expect(validateDiagramComponent(diagram).valid).toBe(false);
    });

    it('应该验证输出格式', () => {
      const validFormats = ['svg', 'png', 'jpg', 'pdf', 'html'];

      validFormats.forEach(format => {
        const renderingOptions = {
          ...validDiagramComponent.renderingOptions!,
          format
        };
        const diagram = { ...validDiagramComponent, renderingOptions };
        expect(validateDiagramComponent(diagram).valid).toBe(true);
      });

      const invalidFormat = {
        ...validDiagramComponent.renderingOptions!,
        format: 'invalid-format'
      };
      const diagram = { ...validDiagramComponent, renderingOptions: invalidFormat };
      expect(validateDiagramComponent(diagram).valid).toBe(false);
    });

    it('应该验证尺寸限制', () => {
      const sizeTests = [
        { width: 100, height: 100, shouldBeValid: true }, // 最小尺寸
        { width: 4096, height: 4096, shouldBeValid: true }, // 大尺寸
        { width: 50, height: 100, shouldBeValid: false }, // 过小宽度
        { width: 100, height: 50, shouldBeValid: false }, // 过小高度
        { width: 10000, height: 100, shouldBeValid: false }, // 过大宽度
        { width: 100, height: 10000, shouldBeValid: false } // 过大高度
      ];

      sizeTests.forEach(({ width, height, shouldBeValid }) => {
        const renderingOptions = {
          ...validDiagramComponent.renderingOptions!,
          width,
          height
        };
        const diagram = { ...validDiagramComponent, renderingOptions };
        const result = validateDiagramComponent(diagram);
        expect(result.valid).toBe(shouldBeValid);
      });
    });
  });

  describe('Diagram Complexity and Performance', () => {
    it('应该估算图表渲染复杂度', () => {
      const complexityTests = [
        {
          type: 'mermaid' as DiagramType,
          source: 'graph TD\n  A --> B',
          expectedComplexity: 'low'
        },
        {
          type: 'mermaid' as DiagramType,
          source: `
            flowchart TD
              ${Array.from({ length: 10 }, (_, i) => `A${i} --> B${i}`).join('\n  ')}
          `,
          expectedComplexity: 'medium'
        },
        {
          type: 'mermaid' as DiagramType,
          source: `
            graph TD
              ${Array.from({ length: 50 }, (_, i) => `A${i} --> B${i}`).join('\n  ')}
          `,
          expectedComplexity: 'high'
        }
      ];

      complexityTests.forEach(({ type, source, expectedComplexity }) => {
        const complexity = estimateRenderingComplexity(type, source);
        expect(complexity).toBe(expectedComplexity);
      });
    });

    it('应该验证性能元数据', () => {
      const validPerformance = [
        {
          averageRenderTime: 100,
          maxRenderTime: 200,
          minRenderTime: 50,
          cacheHitRatio: 0.8,
          lastOptimized: new Date()
        },
        {
          averageRenderTime: 1000,
          maxRenderTime: 2000,
          minRenderTime: 500,
          cacheHitRatio: 0.0, // 无缓存
          lastOptimized: undefined
        }
      ];

      validPerformance.forEach(performance => {
        const diagram = { ...validDiagramComponent, performance };
        expect(validateDiagramComponent(diagram).valid).toBe(true);
      });

      const invalidPerformance = [
        { averageRenderTime: -1 }, // 负数时间
        { averageRenderTime: 100, maxRenderTime: 50 }, // 最大时间小于平均时间
        { averageRenderTime: 200, minRenderTime: 300 }, // 最小时间大于平均时间
        { cacheHitRatio: -0.1 }, // 负缓存命中率
        { cacheHitRatio: 1.1 }, // 超过100%的缓存命中率
        { averageRenderTime: 'invalid' } // 非数字类型
      ];

      invalidPerformance.forEach(performance => {
        const diagram = {
          ...validDiagramComponent,
          performance: { ...validDiagramComponent.performance!, ...performance }
        };
        const result = validateDiagramComponent(diagram);
        expect(result.valid).toBe(false);
      });
    });

    it('应该跟踪渲染历史和统计', () => {
      const diagram = {
        ...validDiagramComponent,
        metadata: {
          ...validDiagramComponent.metadata!,
          renderCount: 100,
          errorCount: 5,
          lastRendered: new Date(),
          renderHistory: [
            { timestamp: new Date('2024-01-01T10:00:00Z'), duration: 120, success: true },
            { timestamp: new Date('2024-01-01T11:00:00Z'), duration: 150, success: true },
            { timestamp: new Date('2024-01-01T12:00:00Z'), duration: 0, success: false, error: 'Syntax error' }
          ]
        }
      };

      const result = validateDiagramComponent(diagram);
      expect(result.valid).toBe(true);

      // 验证统计数据一致性
      if (diagram.metadata.renderHistory) {
        const successCount = diagram.metadata.renderHistory.filter(h => h.success).length;
        const failureCount = diagram.metadata.renderHistory.filter(h => !h.success).length;
        expect(failureCount).toBeLessThanOrEqual(diagram.metadata.errorCount);
      }
    });
  });

  describe('Diagram Validation and Error Handling', () => {
    it('应该验证图表语法', () => {
      const syntaxTests = [
        {
          type: 'mermaid' as DiagramType,
          source: 'graph TD\n  A --> B\n  B --> C',
          expectedValid: true
        },
        {
          type: 'mermaid' as DiagramType,
          source: 'graph TD\n  A -->',
          expectedValid: false
        },
        {
          type: 'plantuml' as DiagramType,
          source: '@startuml\nAlice -> Bob\n@enduml',
          expectedValid: true
        },
        {
          type: 'plantuml' as DiagramType,
          source: '@startuml\nAlice ->\n@enduml',
          expectedValid: false
        }
      ];

      syntaxTests.forEach(({ type, source, expectedValid }) => {
        const validation = validateDiagramSyntax(type, source);
        expect(validation.isValid).toBe(expectedValid);

        if (!expectedValid) {
          expect(validation.errors.length).toBeGreaterThan(0);
        }
      });
    });

    it('应该提供详细的验证错误信息', () => {
      const invalidSource = 'graph TD\n  A --> \n  B --> C ->';
      const validation = validateDiagramSyntax('mermaid', invalidSource);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);

      validation.errors.forEach(error => {
        expect(error.line).toBeDefined();
        expect(error.message).toBeDefined();
        expect(error.severity).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(5);
      });
    });

    it('应该处理警告信息', () => {
      const diagram = {
        ...validDiagramComponent,
        validation: {
          isValid: true,
          errors: [],
          warnings: [
            {
              line: 5,
              message: '建议使用更具描述性的节点标签',
              severity: 'warning',
              suggestion: '将 A 改为更具体的名称，如 "开始流程"'
            }
          ],
          lastValidated: new Date()
        }
      };

      const result = validateDiagramComponent(diagram);
      expect(result.valid).toBe(true);

      // 验证警告不影响有效性但提供改进建议
      expect(diagram.validation.warnings.length).toBeGreaterThan(0);
      expect(diagram.validation.warnings[0].suggestion).toBeDefined();
    });

    it('应该验证错误恢复能力', () => {
      const errorHandlingTests = [
        {
          status: 'error' as DiagramStatus,
          validation: {
            isValid: false,
            errors: [
              { line: 2, message: '语法错误', severity: 'error' }
            ],
            warnings: [],
            lastValidated: new Date()
          },
          shouldBeValid: true // 错误状态下允许无效图表存在
        },
        {
          status: 'active' as DiagramStatus,
          validation: {
            isValid: false,
            errors: [
              { line: 2, message: '语法错误', severity: 'error' }
            ],
            warnings: [],
            lastValidated: new Date()
          },
          shouldBeValid: false // 活跃状态下不允许无效图表
        }
      ];

      errorHandlingTests.forEach(({ status, validation, shouldBeValid }) => {
        const diagram = { ...validDiagramComponent, status, validation };
        const result = validateDiagramComponent(diagram);
        expect(result.valid).toBe(shouldBeValid);
      });
    });
  });

  describe('Factory Methods', () => {
    it('应该创建有效的 DiagramComponent 实例', () => {
      const diagramData = {
        type: 'mermaid' as DiagramType,
        source: 'graph TD\n  A --> B',
        title: '简单流程图',
        description: '演示基本流程'
      };

      const diagram = createDiagramComponent(diagramData);

      expect(isDiagramComponent(diagram)).toBe(true);
      expect(diagram.type).toBe(diagramData.type);
      expect(diagram.source).toBe(diagramData.source);
      expect(diagram.title).toBe(diagramData.title);
      expect(diagram.description).toBe(diagramData.description);
      expect(diagram.status).toBe('active');
      expect(diagram.id).toMatch(/^diagram-\d+$/);
      expect(diagram.createdAt).toBeInstanceOf(Date);
      expect(diagram.updatedAt).toBeInstanceOf(Date);
    });

    it('应该接受可选参数覆盖默认值', () => {
      const customData = {
        type: 'plantuml' as DiagramType,
        source: '@startuml\nAlice -> Bob\n@enduml',
        title: '自定义图表',
        description: '自定义描述',
        id: 'custom-diagram-id',
        status: 'draft' as DiagramStatus,
        renderingOptions: {
          theme: 'dark' as DiagramTheme,
          format: 'png',
          width: 1024,
          height: 768
        }
      };

      const diagram = createDiagramComponent(customData);

      expect(diagram.id).toBe(customData.id);
      expect(diagram.status).toBe(customData.status);
      expect(diagram.renderingOptions).toEqual(customData.renderingOptions);
    });

    it('应该自动估算复杂度和渲染选项', () => {
      const complexSource = `
        flowchart TD
          ${Array.from({ length: 30 }, (_, i) => `A${i} --> B${i}`).join('\n  ')}
      `;

      const diagram = createDiagramComponent({
        type: 'mermaid',
        source: complexSource,
        title: '复杂图表',
        description: '高复杂度图表'
      });

      expect(diagram.metadata?.complexity).toBe('high');
      expect(diagram.metadata?.estimatedRenderTime).toBeGreaterThan(200);
    });

    it('应该生成唯一的图表 ID', () => {
      const ids = new Set();

      for (let i = 0; i < 50; i++) {
        const diagram = createDiagramComponent({
          type: 'mermaid',
          source: `graph TD\n  A${i} --> B${i}`,
          title: `图表 ${i}`,
          description: '唯一性测试'
        });

        expect(ids.has(diagram.id)).toBe(false);
        ids.add(diagram.id);
      }
    });

    it('应该验证工厂方法的输入参数', () => {
      const invalidInputs = [
        { type: 'mermaid', source: '', title: '标题', description: '描述' }, // 空源码
        { type: 'mermaid', source: 'code', title: '', description: '描述' }, // 空标题
        { type: 'mermaid', source: 'code', title: '标题', description: '' }, // 空描述
        { type: 'invalid', source: 'code', title: '标题', description: '描述' }, // 无效类型
        { source: 'code', title: '标题', description: '描述' } // 缺少类型
      ];

      invalidInputs.forEach(input => {
        expect(() => createDiagramComponent(input as any)).toThrow();
      });
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('应该处理超大图表源码', () => {
      const hugeDiagramSource = `
        graph TD
          ${Array.from({ length: 1000 }, (_, i) => `Node${i}[节点${i}] --> Node${i + 1}[节点${i + 1}]`).join('\n  ')}
      `;

      const diagram = {
        ...validDiagramComponent,
        source: hugeDiagramSource
      };

      const result = validateDiagramComponent(diagram);
      expect(result.valid).toBe(true);

      // 验证复杂度正确估算
      const complexity = estimateRenderingComplexity('mermaid', hugeDiagramSource);
      expect(complexity).toBe('very_high');
    });

    it('应该处理特殊字符和多语言内容', () => {
      const multilingualDiagram = {
        ...validDiagramComponent,
        title: 'Multi-language Diagram 多语言图表',
        description: 'Diagram with émojis 🚀 and special chars @#$%',
        source: `
          flowchart TD
            A["开始 Start 开始"] --> B{"决策 Decision 決定"}
            B -->|是 Yes はい| C["执行A Execute A 実行A"]
            B -->|否 No いいえ| D["执行B Execute B 実行B"]
            C --> E["结束 End 終了"]
            D --> E
        `
      };

      const result = validateDiagramComponent(multilingualDiagram);
      expect(result.valid).toBe(true);
    });

    it('应该处理极端渲染选项', () => {
      const extremeRenderingOptions = [
        {
          theme: 'default' as DiagramTheme,
          format: 'svg',
          width: 100, // 最小宽度
          height: 100, // 最小高度
          scale: 0.1,
          dpi: 72
        },
        {
          theme: 'dark' as DiagramTheme,
          format: 'png',
          width: 4096, // 大尺寸
          height: 4096,
          scale: 3.0,
          dpi: 300,
          quality: 'high'
        }
      ];

      extremeRenderingOptions.forEach(renderingOptions => {
        const diagram = { ...validDiagramComponent, renderingOptions };
        const result = validateDiagramComponent(diagram);
        expect(result.valid).toBe(true);
      });
    });

    it('应该处理复杂的元数据结构', () => {
      const complexMetadata = {
        complexity: 'very_high',
        estimatedRenderTime: 5000,
        lastRendered: new Date(),
        renderCount: 1000,
        errorCount: 50,
        tags: ['complex', 'performance', 'enterprise', 'critical'],
        category: 'architecture',
        subcategory: 'system-design',
        businessUnit: 'engineering',
        stakeholders: ['architect', 'developer', 'qa', 'product'],
        reviewers: ['tech-lead', 'senior-architect'],
        approvalStatus: 'approved',
        version: '2.1.0',
        dependencies: ['diagram-002', 'diagram-003'],
        relatedDiagrams: ['diagram-001', 'diagram-004', 'diagram-005'],
        customProperties: {
          priority: 'high',
          confidentiality: 'internal',
          maintenanceSchedule: 'quarterly'
        }
      };

      const diagram = {
        ...validDiagramComponent,
        metadata: complexMetadata
      };

      const result = validateDiagramComponent(diagram);
      expect(result.valid).toBe(true);
    });
  });

  describe('Performance and Memory', () => {
    it('应该高效处理图表验证', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        const diagram = {
          ...validDiagramComponent,
          id: `performance-test-${i}`
        };

        validateDiagramComponent(diagram);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 100 次验证应该在 200ms 内完成
      expect(duration).toBeLessThan(200);
    });

    it('应该高效解析图表源码', () => {
      const complexSource = `
        flowchart TD
          ${Array.from({ length: 100 }, (_, i) => `A${i} --> B${i}`).join('\n  ')}
      `;

      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        parseDiagramSource('mermaid', complexSource);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 复杂源码解析应该在合理时间内完成
      expect(duration).toBeLessThan(500);
    });

    it('应该高效估算复杂度', () => {
      const testSources = Array.from({ length: 10 }, (_, i) => `
        graph TD
          ${Array.from({ length: i * 10 }, (_, j) => `A${j} --> B${j}`).join('\n  ')}
      `);

      const startTime = Date.now();

      testSources.forEach(source => {
        estimateRenderingComplexity('mermaid', source);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 复杂度估算应该很快
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Error Handling', () => {
    it('应该提供详细的验证错误信息', () => {
      const invalidDiagram = {
        ...validDiagramComponent,
        type: 'invalid-type',
        source: '', // 空源码
        renderingOptions: {
          theme: 'invalid-theme',
          format: 'invalid-format',
          width: -100, // 负宽度
          height: 0 // 零高度
        }
      };

      const result = validateDiagramComponent(invalidDiagram);

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

    it('应该处理语法验证的异常情况', () => {
      const edgeCases = [
        { type: 'mermaid', source: null },
        { type: 'mermaid', source: undefined },
        { type: null, source: 'graph TD\n A --> B' },
        { type: undefined, source: 'graph TD\n A --> B' }
      ];

      edgeCases.forEach(({ type, source }) => {
        expect(() => validateDiagramSyntax(type as any, source as any)).not.toThrow();

        const validation = validateDiagramSyntax(type as any, source as any);
        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThan(0);
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
        expect(() => validateDiagramComponent(input as any)).not.toThrow();
        expect(() => isDiagramComponent(input as any)).not.toThrow();

        const isValid = isDiagramComponent(input as any);
        expect(isValid).toBe(false);
      });
    });

    it('应该处理渲染超时和资源限制', () => {
      const resourceLimitTests = [
        {
          metadata: {
            ...validDiagramComponent.metadata!,
            estimatedRenderTime: 30000, // 30秒
            complexity: 'very_high'
          },
          shouldTriggerWarning: true
        },
        {
          renderingOptions: {
            ...validDiagramComponent.renderingOptions!,
            width: 8192,
            height: 8192 // 非常大的尺寸
          },
          shouldTriggerWarning: true
        }
      ];

      resourceLimitTests.forEach(({ metadata, renderingOptions, shouldTriggerWarning }) => {
        const diagram = {
          ...validDiagramComponent,
          ...(metadata && { metadata }),
          ...(renderingOptions && { renderingOptions })
        };

        const result = validateDiagramComponent(diagram);

        if (shouldTriggerWarning) {
          expect(result.warnings?.length).toBeGreaterThan(0);
        }
      });
    });
  });
});