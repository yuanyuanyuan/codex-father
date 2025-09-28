/**
 * Mermaid 图表渲染性能基准测试
 *
 * 测试范围：
 * - 简单图表渲染性能 (< 200ms)
 * - 中等复杂度图表渲染性能 (< 500ms)
 * - 复杂图表渲染性能监控
 * - 批量图表渲染性能
 * - 内存使用优化验证
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { DefaultDiagramService } from '../../src/services/diagram-service.js';
import type { DiagramConfig, DiagramFormat } from '../../src/models/diagram-component.js';

describe('Mermaid Rendering Performance', () => {
  let diagramService: DefaultDiagramService;
  let memoryBaseline: number;

  beforeEach(() => {
    diagramService = new DefaultDiagramService();
    memoryBaseline = process.memoryUsage().heapUsed;
  });

  afterEach(() => {
    // 检查内存增长
    const memoryAfter = process.memoryUsage().heapUsed;
    const memoryDelta = memoryAfter - memoryBaseline;

    // 单个测试的内存增长不应超过 50MB
    expect(memoryDelta).toBeLessThan(50 * 1024 * 1024);
  });

  describe('Simple Diagram Rendering', () => {
    it('should render simple flowchart under 200ms', async () => {
      const simpleDiagram = `
        flowchart TD
          A[Start] --> B[Process]
          B --> C{Decision}
          C -->|Yes| D[Action 1]
          C -->|No| E[Action 2]
          D --> F[End]
          E --> F
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        theme: 'default',
        format: 'svg' as DiagramFormat,
        width: 800,
        height: 600
      };

      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const result = await diagramService.renderDiagram(simpleDiagram, config);
        const end = performance.now();

        expect(result.success).toBe(true);
        expect(result.output).toBeDefined();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // 简单图表平均渲染时间应该小于 200ms
      expect(averageTime).toBeLessThan(200);
      expect(maxTime).toBeLessThan(400);

      console.log(`Simple flowchart rendering - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });

    it('should render simple sequence diagram under 200ms', async () => {
      const sequenceDiagram = `
        sequenceDiagram
          participant U as User
          participant A as API
          participant D as Database

          U->>A: Login Request
          A->>D: Query User
          D-->>A: User Data
          A-->>U: Auth Token

          U->>A: Get Profile
          A->>D: Query Profile
          D-->>A: Profile Data
          A-->>U: Profile Response
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        theme: 'default',
        format: 'svg' as DiagramFormat,
        width: 800,
        height: 600
      };

      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        const result = await diagramService.renderDiagram(sequenceDiagram, config);
        const end = performance.now();

        expect(result.success).toBe(true);
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      expect(averageTime).toBeLessThan(200);
      console.log(`Simple sequence diagram rendering - Average: ${averageTime.toFixed(2)}ms`);
    });

    it('should render simple class diagram under 200ms', async () => {
      const classDiagram = `
        classDiagram
          class User {
            +String name
            +String email
            +login()
            +logout()
          }

          class Profile {
            +String bio
            +Date created
            +update()
          }

          class Settings {
            +Boolean notifications
            +String theme
            +save()
          }

          User ||--|| Profile
          User ||--|| Settings
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        theme: 'default',
        format: 'svg' as DiagramFormat,
        width: 800,
        height: 600
      };

      const start = performance.now();
      const result = await diagramService.renderDiagram(classDiagram, config);
      const end = performance.now();

      const renderTime = end - start;

      expect(result.success).toBe(true);
      expect(renderTime).toBeLessThan(200);

      console.log(`Simple class diagram rendering - Time: ${renderTime.toFixed(2)}ms`);
    });
  });

  describe('Medium Complexity Diagram Rendering', () => {
    it('should render medium flowchart under 500ms', async () => {
      const mediumFlowchart = `
        flowchart TD
          A[用户登录] --> B{验证凭据}
          B -->|成功| C[获取用户信息]
          B -->|失败| D[显示错误信息]
          C --> E[检查权限]
          E -->|管理员| F[显示管理面板]
          E -->|普通用户| G[显示用户面板]
          E -->|访客| H[显示有限功能]

          F --> I[用户管理]
          F --> J[系统设置]
          F --> K[数据分析]

          G --> L[个人资料]
          G --> M[我的文档]
          G --> N[消息中心]

          H --> O[公开内容]
          H --> P[注册页面]

          I --> Q{操作类型}
          Q -->|创建| R[创建用户]
          Q -->|编辑| S[编辑用户]
          Q -->|删除| T[删除用户]

          L --> U[编辑资料]
          L --> V[修改密码]
          M --> W[创建文档]
          M --> X[编辑文档]
          M --> Y[分享文档]

          D --> Z[返回登录页]
          R --> AA[发送欢迎邮件]
          S --> BB[记录操作日志]
          T --> CC[备份用户数据]

          subgraph "安全验证"
            DD[两步验证]
            EE[验证码检查]
            FF[安全问题]
          end

          B --> DD
          DD --> EE
          EE --> FF
          FF --> C
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        theme: 'default',
        format: 'svg' as DiagramFormat,
        width: 1200,
        height: 800
      };

      const times: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const result = await diagramService.renderDiagram(mediumFlowchart, config);
        const end = performance.now();

        expect(result.success).toBe(true);
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      // 中等复杂度图表平均渲染时间应该小于 500ms
      expect(averageTime).toBeLessThan(500);
      expect(maxTime).toBeLessThan(1000);

      console.log(`Medium flowchart rendering - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);
    });

    it('should render medium sequence diagram under 500ms', async () => {
      const mediumSequence = `
        sequenceDiagram
          participant Client as 客户端
          participant Gateway as API网关
          participant Auth as 认证服务
          participant User as 用户服务
          participant Profile as 档案服务
          participant Notification as 通知服务
          participant DB as 数据库
          participant Cache as 缓存
          participant Queue as 消息队列

          Client->>Gateway: 登录请求
          Gateway->>Auth: 验证凭据
          Auth->>DB: 查询用户
          DB-->>Auth: 用户信息
          Auth->>Cache: 缓存会话
          Auth-->>Gateway: 认证token
          Gateway-->>Client: 登录成功

          Client->>Gateway: 获取用户档案
          Gateway->>Auth: 验证token
          Auth->>Cache: 检查会话
          Cache-->>Auth: 会话有效
          Auth-->>Gateway: 验证通过
          Gateway->>Profile: 请求档案
          Profile->>DB: 查询档案
          DB-->>Profile: 档案数据
          Profile->>Cache: 缓存档案
          Profile-->>Gateway: 档案信息
          Gateway-->>Client: 返回档案

          Client->>Gateway: 更新档案
          Gateway->>Auth: 验证权限
          Auth-->>Gateway: 权限确认
          Gateway->>Profile: 更新请求
          Profile->>DB: 更新数据
          DB-->>Profile: 更新完成
          Profile->>Queue: 发送更新事件
          Queue->>Notification: 通知事件
          Notification->>Client: 推送通知
          Profile-->>Gateway: 更新成功
          Gateway-->>Client: 确认更新

          Note over Client,Queue: 异步处理流程
          Queue->>User: 更新用户状态
          User->>DB: 记录操作日志
          Queue->>Cache: 刷新相关缓存
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        theme: 'default',
        format: 'svg' as DiagramFormat,
        width: 1200,
        height: 1000
      };

      const times: number[] = [];

      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        const result = await diagramService.renderDiagram(mediumSequence, config);
        const end = performance.now();

        expect(result.success).toBe(true);
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;

      expect(averageTime).toBeLessThan(500);
      console.log(`Medium sequence diagram rendering - Average: ${averageTime.toFixed(2)}ms`);
    });

    it('should render complex class diagram under 500ms', async () => {
      const complexClassDiagram = `
        classDiagram
          class AbstractUser {
            <<abstract>>
            #String id
            #String email
            #Date createdAt
            +authenticate()*
            +getPermissions()*
          }

          class RegularUser {
            +String firstName
            +String lastName
            +UserProfile profile
            +authenticate()
            +getPermissions()
            +updateProfile()
          }

          class AdminUser {
            +String department
            +List~Permission~ adminPermissions
            +authenticate()
            +getPermissions()
            +manageUsers()
            +systemConfig()
          }

          class UserProfile {
            +String bio
            +String avatar
            +List~SocialLink~ socialLinks
            +UserSettings settings
            +update()
            +validate()
          }

          class UserSettings {
            +Boolean notifications
            +String theme
            +String language
            +PrivacySettings privacy
            +save()
            +reset()
          }

          class PrivacySettings {
            +Boolean profileVisible
            +Boolean emailVisible
            +Boolean activityVisible
            +update()
          }

          class Permission {
            +String name
            +String resource
            +String action
            +validate()
          }

          class SocialLink {
            +String platform
            +String url
            +Boolean verified
            +verify()
          }

          class Document {
            +String title
            +String content
            +DocumentStatus status
            +List~Tag~ tags
            +create()
            +update()
            +publish()
            +archive()
          }

          class Tag {
            +String name
            +String color
            +String description
          }

          class DocumentStatus {
            <<enumeration>>
            DRAFT
            REVIEW
            PUBLISHED
            ARCHIVED
          }

          AbstractUser <|-- RegularUser
          AbstractUser <|-- AdminUser
          RegularUser ||--|| UserProfile
          UserProfile ||--|| UserSettings
          UserSettings ||--|| PrivacySettings
          UserProfile ||--o{ SocialLink
          AdminUser ||--o{ Permission
          RegularUser ||--o{ Document
          Document ||--o{ Tag
          Document ||--|| DocumentStatus

          class UserRepository {
            +findById(String id)
            +findByEmail(String email)
            +save(User user)
            +delete(String id)
          }

          class DocumentRepository {
            +findByUser(String userId)
            +findByStatus(DocumentStatus status)
            +save(Document doc)
            +search(String query)
          }

          class AuthenticationService {
            -UserRepository userRepo
            +login(String email, String password)
            +logout(String token)
            +validateToken(String token)
          }

          class DocumentService {
            -DocumentRepository docRepo
            -PermissionService permService
            +createDocument(Document doc)
            +updateDocument(String id, Document doc)
            +publishDocument(String id)
          }

          UserRepository ..> AbstractUser : uses
          DocumentRepository ..> Document : uses
          AuthenticationService ..> UserRepository : depends
          DocumentService ..> DocumentRepository : depends
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        theme: 'default',
        format: 'svg' as DiagramFormat,
        width: 1400,
        height: 1200
      };

      const start = performance.now();
      const result = await diagramService.renderDiagram(complexClassDiagram, config);
      const end = performance.now();

      const renderTime = end - start;

      expect(result.success).toBe(true);
      expect(renderTime).toBeLessThan(500);

      console.log(`Complex class diagram rendering - Time: ${renderTime.toFixed(2)}ms`);
    });
  });

  describe('Large Scale Diagram Rendering', () => {
    it('should handle large diagram rendering with monitoring', async () => {
      const largeDiagram = `
        graph TB
          subgraph "前端层"
            A1[React App]
            A2[Vue App]
            A3[Mobile App]
            A4[Admin Panel]
          end

          subgraph "API 网关层"
            B1[Main Gateway]
            B2[Admin Gateway]
            B3[Mobile Gateway]
          end

          subgraph "微服务层"
            C1[用户服务]
            C2[认证服务]
            C3[档案服务]
            C4[文档服务]
            C5[通知服务]
            C6[搜索服务]
            C7[分析服务]
            C8[报告服务]
            C9[配置服务]
            C10[监控服务]
          end

          subgraph "数据存储层"
            D1[(主数据库)]
            D2[(用户数据库)]
            D3[(文档数据库)]
            D4[(搜索引擎)]
            D5[(缓存集群)]
            D6[(文件存储)]
          end

          subgraph "消息队列"
            E1[用户队列]
            E2[通知队列]
            E3[分析队列]
            E4[报告队列]
          end

          subgraph "外部服务"
            F1[邮件服务]
            F2[短信服务]
            F3[支付服务]
            F4[CDN服务]
            F5[监控服务]
          end

          A1 --> B1
          A2 --> B1
          A3 --> B3
          A4 --> B2

          B1 --> C1
          B1 --> C2
          B1 --> C3
          B1 --> C4
          B1 --> C6
          B2 --> C1
          B2 --> C7
          B2 --> C8
          B2 --> C9
          B3 --> C1
          B3 --> C2
          B3 --> C4
          B3 --> C5

          C1 --> D1
          C1 --> D2
          C1 --> D5
          C2 --> D2
          C2 --> D5
          C3 --> D2
          C3 --> D5
          C4 --> D3
          C4 --> D5
          C4 --> D6
          C6 --> D4
          C7 --> D1
          C7 --> D3
          C8 --> D1
          C9 --> D1
          C10 --> D1

          C1 --> E1
          C5 --> E2
          C7 --> E3
          C8 --> E4

          C5 --> F1
          C5 --> F2
          C4 --> F4
          C10 --> F5

          E2 --> C5
          E3 --> C7
          E4 --> C8
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        theme: 'default',
        format: 'svg' as DiagramFormat,
        width: 1600,
        height: 1400
      };

      const start = performance.now();
      const result = await diagramService.renderDiagram(largeDiagram, config);
      const end = performance.now();

      const renderTime = end - start;

      expect(result.success).toBe(true);
      // 大型图表渲染时间可能较长，但应该在合理范围内
      expect(renderTime).toBeLessThan(2000); // 2秒内

      console.log(`Large diagram rendering - Time: ${renderTime.toFixed(2)}ms`);
    });

    it('should handle state diagram rendering efficiently', async () => {
      const stateDiagram = `
        stateDiagram-v2
          [*] --> Idle
          Idle --> Loading : 开始加载
          Loading --> Success : 加载成功
          Loading --> Error : 加载失败
          Success --> Idle : 重置
          Error --> Idle : 重试
          Error --> Retry : 自动重试
          Retry --> Loading : 重新加载

          state Loading {
            [*] --> FetchingData
            FetchingData --> ProcessingData
            ProcessingData --> ValidatingData
            ValidatingData --> [*]
          }

          state Success {
            [*] --> DisplayingData
            DisplayingData --> CachingData
            CachingData --> [*]
          }

          state Error {
            [*] --> LoggingError
            LoggingError --> ShowingMessage
            ShowingMessage --> [*]
          }

          state Retry {
            [*] --> WaitingDelay
            WaitingDelay --> CheckingNetwork
            CheckingNetwork --> [*]
          }
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        theme: 'default',
        format: 'svg' as DiagramFormat,
        width: 1000,
        height: 800
      };

      const start = performance.now();
      const result = await diagramService.renderDiagram(stateDiagram, config);
      const end = performance.now();

      const renderTime = end - start;

      expect(result.success).toBe(true);
      expect(renderTime).toBeLessThan(600);

      console.log(`State diagram rendering - Time: ${renderTime.toFixed(2)}ms`);
    });
  });

  describe('Batch Rendering Performance', () => {
    it('should handle multiple diagrams efficiently', async () => {
      const diagrams = [
        {
          content: 'flowchart TD\n  A --> B\n  B --> C',
          config: { type: 'mermaid', format: 'svg' as DiagramFormat }
        },
        {
          content: 'sequenceDiagram\n  A->>B: Message\n  B-->>A: Response',
          config: { type: 'mermaid', format: 'svg' as DiagramFormat }
        },
        {
          content: 'classDiagram\n  class A {\n    +method()\n  }',
          config: { type: 'mermaid', format: 'svg' as DiagramFormat }
        },
        {
          content: 'graph LR\n  X --> Y\n  Y --> Z',
          config: { type: 'mermaid', format: 'svg' as DiagramFormat }
        },
        {
          content: 'pie title 数据分布\n  "A" : 45\n  "B" : 30\n  "C" : 25',
          config: { type: 'mermaid', format: 'svg' as DiagramFormat }
        }
      ];

      const start = performance.now();

      const renderPromises = diagrams.map(({ content, config }) =>
        diagramService.renderDiagram(content, config)
      );

      const results = await Promise.all(renderPromises);
      const end = performance.now();

      const totalTime = end - start;
      const averageTime = totalTime / diagrams.length;

      expect(results).toHaveLength(diagrams.length);
      expect(results.every(result => result.success)).toBe(true);
      expect(averageTime).toBeLessThan(300); // 平均每个图表 300ms

      console.log(`Batch rendering - Total: ${totalTime.toFixed(2)}ms, Average: ${averageTime.toFixed(2)}ms`);
    });

    it('should handle concurrent rendering', async () => {
      const diagram = `
        flowchart TD
          A[开始] --> B{条件}
          B -->|是| C[动作1]
          B -->|否| D[动作2]
          C --> E[结束]
          D --> E
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        theme: 'default',
        format: 'svg' as DiagramFormat,
        width: 800,
        height: 600
      };

      const concurrentCount = 5;
      const start = performance.now();

      const promises = Array.from({ length: concurrentCount }, () =>
        diagramService.renderDiagram(diagram, config)
      );

      const results = await Promise.all(promises);
      const end = performance.now();

      const totalTime = end - start;
      const averageTime = totalTime / concurrentCount;

      expect(results).toHaveLength(concurrentCount);
      expect(results.every(result => result.success)).toBe(true);
      expect(averageTime).toBeLessThan(400); // 并发渲染平均时间

      console.log(`Concurrent rendering - Total: ${totalTime.toFixed(2)}ms, Average: ${averageTime.toFixed(2)}ms`);
    });
  });

  describe('Format-Specific Performance', () => {
    it('should render SVG efficiently', async () => {
      const diagram = `
        graph TD
          A[SVG测试] --> B[渲染]
          B --> C[验证]
          C --> D[完成]
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        format: 'svg' as DiagramFormat,
        width: 800,
        height: 600
      };

      const start = performance.now();
      const result = await diagramService.renderDiagram(diagram, config);
      const end = performance.now();

      const renderTime = end - start;

      expect(result.success).toBe(true);
      expect(result.format).toBe('svg');
      expect(renderTime).toBeLessThan(300);

      console.log(`SVG rendering - Time: ${renderTime.toFixed(2)}ms`);
    });

    it('should render PNG efficiently', async () => {
      const diagram = `
        sequenceDiagram
          A->>B: PNG测试
          B-->>A: 渲染完成
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        format: 'png' as DiagramFormat,
        width: 800,
        height: 600
      };

      const start = performance.now();
      const result = await diagramService.renderDiagram(diagram, config);
      const end = performance.now();

      const renderTime = end - start;

      expect(result.success).toBe(true);
      expect(result.format).toBe('png');
      expect(renderTime).toBeLessThan(400); // PNG渲染可能稍慢

      console.log(`PNG rendering - Time: ${renderTime.toFixed(2)}ms`);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should manage memory efficiently during rendering', async () => {
      const initialMemory = process.memoryUsage();

      // 渲染多个中等复杂度图表
      const complexDiagram = `
        graph TB
          subgraph "子图1"
            A1 --> A2 --> A3
          end
          subgraph "子图2"
            B1 --> B2 --> B3
          end
          subgraph "子图3"
            C1 --> C2 --> C3
          end
          A3 --> B1
          B3 --> C1
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        format: 'svg' as DiagramFormat,
        width: 1000,
        height: 800
      };

      for (let i = 0; i < 20; i++) {
        await diagramService.renderDiagram(complexDiagram, config);
      }

      const finalMemory = process.memoryUsage();
      const memoryDelta = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryMB = memoryDelta / (1024 * 1024);

      // 内存增长应该合理
      expect(memoryMB).toBeLessThan(100);

      console.log(`Memory usage after 20 renderings: ${memoryMB.toFixed(2)}MB`);
    });

    it('should handle rendering failures gracefully', async () => {
      const invalidDiagram = `
        flowchart TD
          A -->
          --> C
          Invalid syntax here
      `;

      const config: DiagramConfig = {
        type: 'mermaid',
        format: 'svg' as DiagramFormat
      };

      const start = performance.now();
      const result = await diagramService.renderDiagram(invalidDiagram, config);
      const end = performance.now();

      const renderTime = end - start;

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(renderTime).toBeLessThan(100); // 失败应该快速返回

      console.log(`Error handling - Time: ${renderTime.toFixed(2)}ms`);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet all performance requirements', async () => {
      const benchmarks = {
        simpleFlowchart: { limit: 200, type: 'simple' },
        mediumComplexity: { limit: 500, type: 'medium' },
        largeScale: { limit: 2000, type: 'large' }
      };

      const results: Record<string, number> = {};

      // 简单流程图基准
      const simpleStart = performance.now();
      await diagramService.renderDiagram(
        'flowchart TD\n  A --> B --> C',
        { type: 'mermaid', format: 'svg' as DiagramFormat }
      );
      results.simpleFlowchart = performance.now() - simpleStart;

      // 中等复杂度基准
      const mediumStart = performance.now();
      await diagramService.renderDiagram(`
        flowchart TD
          A[开始] --> B{检查条件}
          B -->|是| C[执行操作1]
          B -->|否| D[执行操作2]
          C --> E[处理结果1]
          D --> F[处理结果2]
          E --> G[合并结果]
          F --> G
          G --> H[验证]
          H --> I{验证通过?}
          I -->|是| J[完成]
          I -->|否| K[错误处理]
          K --> B
      `, { type: 'mermaid', format: 'svg' as DiagramFormat });
      results.mediumComplexity = performance.now() - mediumStart;

      // 验证基准
      for (const [benchmark, config] of Object.entries(benchmarks)) {
        const time = results[benchmark];
        expect(time).toBeLessThan(config.limit);
        console.log(`${benchmark}: ${time.toFixed(2)}ms (limit: ${config.limit}ms)`);
      }
    });
  });
});