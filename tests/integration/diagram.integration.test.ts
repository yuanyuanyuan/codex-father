/**
 * T010: 图表渲染集成测试
 *
 * 测试Mermaid图表的渲染、处理和集成功能
 * 对应quickstart.md中的架构图添加场景和性能基准中的图表渲染要求
 *
 * 这个测试在TDD的Red阶段会失败，因为图表渲染系统尚未实现
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { execSync } from 'child_process'
import { tmpdir } from 'os'
import { join } from 'path'
import { rmSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'

describe('PRD图表渲染集成测试', () => {
  let testDir: string
  let configPath: string
  let diagramsDir: string

  beforeEach(() => {
    testDir = join(tmpdir(), `prd-diagram-test-${Date.now()}`)
    mkdirSync(testDir, { recursive: true })
    configPath = join(testDir, 'prd-config.yaml')
    diagramsDir = join(testDir, 'diagrams')

    process.env.CODEX_FATHER_HOME = testDir
    process.env.PRD_CONFIG_PATH = configPath
    process.env.PRD_DIAGRAMS_DIR = diagramsDir

    // 初始化基本配置
    execSync('prd config init', { cwd: testDir, env: process.env })
    execSync('prd config set user.name "图表测试员"', { cwd: testDir, env: process.env })
    execSync('prd config set user.role "architect"', { cwd: testDir, env: process.env })
    execSync('prd config set diagram.service true', { cwd: testDir, env: process.env })
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  test('Mermaid图表嵌入和渲染', async () => {
    // 创建包含架构图的PRD
    const createOutput = execSync(
      'prd create --title "微服务架构设计" --template technical --description "包含完整Mermaid图表的架构PRD"',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )

    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 添加系统架构图
    const architectureDiagram = `
## 3. 系统架构

### 3.1 整体架构

\`\`\`mermaid
graph TB
    A[客户端应用] --> B[API网关]
    B --> C[认证服务]
    B --> D[用户服务]
    B --> E[订单服务]
    B --> F[支付服务]

    C --> G[用户数据库]
    D --> G
    E --> H[订单数据库]
    F --> I[支付数据库]

    B --> J[消息队列]
    J --> K[通知服务]
    J --> L[日志服务]

    style A fill:#e1f5fe
    style B fill:#f3e5f5
    style C fill:#e8f5e8
    style D fill:#e8f5e8
    style E fill:#e8f5e8
    style F fill:#e8f5e8
\`\`\`

### 3.2 数据流图

\`\`\`mermaid
sequenceDiagram
    participant U as 用户
    participant A as 客户端
    participant G as API网关
    participant Auth as 认证服务
    participant Order as 订单服务
    participant Pay as 支付服务

    U->>A: 提交订单
    A->>G: POST /orders
    G->>Auth: 验证token
    Auth-->>G: 认证成功
    G->>Order: 创建订单
    Order-->>G: 订单ID
    G->>Pay: 发起支付
    Pay-->>G: 支付确认
    G-->>A: 订单成功
    A-->>U: 显示结果
\`\`\`
`

    const editArchOutput = execSync(
      `prd edit ${prdId} --section architecture --content "${architectureDiagram.replace(/"/g, '\\"')}"`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )

    expect(editArchOutput).toContain('Section updated successfully')

    // 验证图表内容正确嵌入
    const prdContent = execSync(`prd show ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(prdContent).toContain('```mermaid')
    expect(prdContent).toContain('graph TB')
    expect(prdContent).toContain('sequenceDiagram')
    expect(prdContent).toContain('客户端应用')
    expect(prdContent).toContain('API网关')
    expect(prdContent).toContain('认证服务')

    // 渲染图表为图片
    const renderOutput = execSync(`prd diagram render ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(renderOutput).toContain('Diagrams rendered successfully')
    expect(renderOutput).toMatch(/2 diagrams found/)
    expect(renderOutput).toMatch(/architecture-.*\.svg/)
    expect(renderOutput).toMatch(/architecture-.*\.png/)

    // 验证生成的图片文件
    const diagramFiles = execSync(`ls ${diagramsDir}/${prdId}/`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(diagramFiles).toContain('.svg')
    expect(diagramFiles).toContain('.png')
  })

  test('不同类型Mermaid图表支持', async () => {
    const createOutput = execSync(
      'prd create --title "图表类型测试" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 流程图 (Flowchart)
    const flowchartContent = `
### 用户注册流程

\`\`\`mermaid
flowchart TD
    A[用户访问注册页] --> B{输入验证}
    B -->|有效| C[发送验证码]
    B -->|无效| D[显示错误信息]
    C --> E{验证码确认}
    E -->|正确| F[创建账户]
    E -->|错误| G[重新输入]
    F --> H[注册成功]
    D --> A
    G --> E
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section workflow --content "${flowchartContent.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 时序图 (Sequence Diagram)
    const sequenceContent = `
### API调用时序

\`\`\`mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant LB as Load Balancer
    participant API as API Server
    participant DB as Database
    participant Cache as Redis Cache

    C->>LB: HTTP Request
    LB->>API: Forward Request
    API->>Cache: Check Cache
    alt Cache Hit
        Cache-->>API: Return Cached Data
    else Cache Miss
        API->>DB: Query Database
        DB-->>API: Return Data
        API->>Cache: Update Cache
    end
    API-->>LB: HTTP Response
    LB-->>C: Return Response
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section api --content "${sequenceContent.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 类图 (Class Diagram)
    const classContent = `
### 数据模型设计

\`\`\`mermaid
classDiagram
    class User {
        +String id
        +String email
        +String name
        +Date createdAt
        +authenticate()
        +updateProfile()
    }

    class Order {
        +String id
        +String userId
        +Decimal amount
        +OrderStatus status
        +Date createdAt
        +calculate()
        +updateStatus()
    }

    class Product {
        +String id
        +String name
        +String description
        +Decimal price
        +Integer stock
        +updateStock()
    }

    User ||--o{ Order : places
    Order ||--o{ OrderItem : contains
    Product ||--o{ OrderItem : includes

    class OrderItem {
        +String orderId
        +String productId
        +Integer quantity
        +Decimal price
    }
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section data-model --content "${classContent.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 甘特图 (Gantt Chart)
    const ganttContent = `
### 项目时间计划

\`\`\`mermaid
gantt
    title 微服务开发计划
    dateFormat  YYYY-MM-DD
    section 设计阶段
    需求分析           :done,    req, 2025-01-01, 2025-01-15
    架构设计           :done,    arch, after req, 10d
    API设计            :active,  api, after arch, 5d

    section 开发阶段
    认证服务           :dev1, after api, 15d
    用户服务           :dev2, after api, 12d
    订单服务           :dev3, after dev1, 10d
    支付服务           :dev4, after dev2, 8d

    section 测试阶段
    单元测试           :test1, after dev1, 5d
    集成测试           :test2, after dev3, 7d
    性能测试           :test3, after test2, 3d

    section 部署阶段
    生产部署           :deploy, after test3, 2d
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section timeline --content "${ganttContent.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 验证所有图表类型都被正确识别
    const prdContent = execSync(`prd show ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(prdContent).toContain('flowchart TD')
    expect(prdContent).toContain('sequenceDiagram')
    expect(prdContent).toContain('classDiagram')
    expect(prdContent).toContain('gantt')

    // 渲染所有图表
    const renderAllOutput = execSync(`prd diagram render ${prdId} --all`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(renderAllOutput).toContain('4 diagrams found')
    expect(renderAllOutput).toContain('flowchart')
    expect(renderAllOutput).toContain('sequence')
    expect(renderAllOutput).toContain('class')
    expect(renderAllOutput).toContain('gantt')
  })

  test('图表渲染配置和自定义', async () => {
    // 配置图表渲染选项
    execSync('prd config set diagram.format "svg,png"', { cwd: testDir, env: process.env })
    execSync('prd config set diagram.theme "dark"', { cwd: testDir, env: process.env })
    execSync('prd config set diagram.width 1200', { cwd: testDir, env: process.env })
    execSync('prd config set diagram.height 800', { cwd: testDir, env: process.env })

    const createOutput = execSync(
      'prd create --title "图表配置测试" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 添加带主题配置的图表
    const themedDiagram = `
### 系统架构 (深色主题)

\`\`\`mermaid
%%{init: {"theme": "dark", "themeVariables": {"primaryColor": "#ff6b6b"}}}%%
graph LR
    A[前端应用] --> B[负载均衡器]
    B --> C[Web服务器]
    B --> D[Web服务器]
    C --> E[数据库主节点]
    D --> F[数据库从节点]
    E --> F

    style A fill:#4ecdc4,stroke:#26a69a,stroke-width:3px
    style B fill:#45b7d1,stroke:#2196f3,stroke-width:3px
    style C fill:#96ceb4,stroke:#4caf50,stroke-width:3px
    style D fill:#96ceb4,stroke:#4caf50,stroke-width:3px
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section architecture --content "${themedDiagram.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 验证配置生效
    const renderOutput = execSync(`prd diagram render ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(renderOutput).toContain('Theme: dark')
    expect(renderOutput).toContain('Format: svg,png')
    expect(renderOutput).toContain('Size: 1200x800')

    // 测试自定义渲染参数
    const customRenderOutput = execSync(
      `prd diagram render ${prdId} --format pdf --theme light --width 800`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )

    expect(customRenderOutput).toContain('Theme: light')
    expect(customRenderOutput).toContain('Format: pdf')
    expect(customRenderOutput).toContain('Size: 800x800')
  })

  test('图表版本管理和差异对比', async () => {
    const createOutput = execSync(
      'prd create --title "图表版本测试" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 版本1：初始架构图
    const initialDiagram = `
### 初始架构

\`\`\`mermaid
graph TB
    A[用户] --> B[Web应用]
    B --> C[数据库]
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section architecture --content "${initialDiagram.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 版本2：添加缓存层
    const cachedDiagram = `
### 添加缓存层

\`\`\`mermaid
graph TB
    A[用户] --> B[Web应用]
    B --> C[Redis缓存]
    B --> D[数据库]
    C --> D
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section architecture --content "${cachedDiagram.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 版本3：完整微服务架构
    const microserviceDiagram = `
### 微服务架构

\`\`\`mermaid
graph TB
    A[用户] --> B[API网关]
    B --> C[用户服务]
    B --> D[订单服务]
    B --> E[支付服务]
    C --> F[用户数据库]
    D --> G[订单数据库]
    E --> H[支付数据库]
    B --> I[Redis缓存]
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section architecture --content "${microserviceDiagram.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 对比不同版本的图表
    const diagramDiffOutput = execSync(
      `prd diagram diff ${prdId} --from 1 --to 3`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )

    expect(diagramDiffOutput).toContain('Diagram Changes')
    expect(diagramDiffOutput).toContain('+ Redis缓存')
    expect(diagramDiffOutput).toContain('+ API网关')
    expect(diagramDiffOutput).toContain('+ 用户服务')
    expect(diagramDiffOutput).toContain('+ 订单服务')
    expect(diagramDiffOutput).toContain('+ 支付服务')

    // 查看特定版本的图表
    const version1Diagram = execSync(`prd diagram show ${prdId} --version 1`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(version1Diagram).toContain('用户] --> B[Web应用')
    expect(version1Diagram).not.toContain('Redis缓存')
    expect(version1Diagram).not.toContain('API网关')

    // 渲染特定版本的图表
    const renderVersionOutput = execSync(
      `prd diagram render ${prdId} --version 2`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )

    expect(renderVersionOutput).toContain('Rendering version 2')
    expect(renderVersionOutput).toContain('1 diagram rendered')
  })

  test('图表导出和格式转换', async () => {
    const createOutput = execSync(
      'prd create --title "图表导出测试" --template business',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 添加业务流程图
    const businessFlow = `
### 业务流程

\`\`\`mermaid
flowchart LR
    A[客户需求] --> B[需求分析]
    B --> C[方案设计]
    C --> D[开发实施]
    D --> E[测试验证]
    E --> F[上线部署]
    F --> G[运营维护]

    B --> H{需求变更}
    H -->|是| I[重新分析]
    H -->|否| C
    I --> C
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section workflow --content "${businessFlow.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 导出为多种格式
    const exportSvgOutput = execSync(
      `prd diagram export ${prdId} --format svg --output ${testDir}/business-flow.svg`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )

    expect(exportSvgOutput).toContain('Diagram exported successfully')
    expect(existsSync(join(testDir, 'business-flow.svg'))).toBe(true)

    const exportPngOutput = execSync(
      `prd diagram export ${prdId} --format png --output ${testDir}/business-flow.png`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )

    expect(exportPngOutput).toContain('Diagram exported successfully')
    expect(existsSync(join(testDir, 'business-flow.png'))).toBe(true)

    const exportPdfOutput = execSync(
      `prd diagram export ${prdId} --format pdf --output ${testDir}/business-flow.pdf`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )

    expect(exportPdfOutput).toContain('Diagram exported successfully')
    expect(existsSync(join(testDir, 'business-flow.pdf'))).toBe(true)

    // 批量导出所有图表
    const exportAllOutput = execSync(
      `prd diagram export ${prdId} --all --format "svg,png" --output ${testDir}/diagrams/`,
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )

    expect(exportAllOutput).toContain('All diagrams exported')
    expect(exportAllOutput).toContain('1 diagram found')

    // 验证导出的文件
    const exportedFiles = execSync(`ls ${testDir}/diagrams/`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(exportedFiles).toContain('.svg')
    expect(exportedFiles).toContain('.png')
  })

  test('图表渲染性能和错误处理', async () => {
    const createOutput = execSync(
      'prd create --title "图表性能测试" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    // 添加复杂的大型图表
    const complexDiagram = `
### 复杂系统架构

\`\`\`mermaid
graph TB
    ${Array.from({ length: 50 }, (_, i) =>
      `A${i}[服务${i}] --> B${i}[数据库${i}]`
    ).join('\n    ')}

    ${Array.from({ length: 20 }, (_, i) =>
      `A${i} --> A${i + 1}`
    ).join('\n    ')}
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section architecture --content "${complexDiagram.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 测试渲染性能 (< 3秒)
    const renderStartTime = Date.now()
    const renderOutput = execSync(`prd diagram render ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    const renderTime = Date.now() - renderStartTime

    expect(renderTime).toBeLessThan(3000) // < 3秒
    expect(renderOutput).toContain('Diagrams rendered successfully')

    // 测试无效Mermaid语法的错误处理
    const invalidDiagram = `
### 错误的图表语法

\`\`\`mermaid
invalid syntax here
this should fail
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section invalid --content "${invalidDiagram.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    const renderInvalidOutput = execSync(`prd diagram render ${prdId} --continue-on-error`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(renderInvalidOutput).toContain('1 diagram failed')
    expect(renderInvalidOutput).toContain('1 diagram succeeded')
    expect(renderInvalidOutput).toContain('Invalid mermaid syntax')

    // 测试不存在PRD的错误处理
    expect(() => {
      execSync('prd diagram render nonexistent-prd', {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/PRD not found/)

    // 测试不支持的图表格式
    expect(() => {
      execSync(`prd diagram export ${prdId} --format xyz`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Unsupported format/)
  })

  test('图表服务状态和配置检查', async () => {
    // 检查图表服务状态
    const serviceStatusOutput = execSync('prd diagram status', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(serviceStatusOutput).toContain('Diagram Service Status')
    expect(serviceStatusOutput).toContain('Service: Running')
    expect(serviceStatusOutput).toContain('Mermaid Version:')
    expect(serviceStatusOutput).toContain('Supported Formats:')

    // 检查图表配置
    const configStatusOutput = execSync('prd config show --key diagram', {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(configStatusOutput).toContain('diagram.service: true')
    expect(configStatusOutput).toContain('diagram.theme:')
    expect(configStatusOutput).toContain('diagram.format:')

    // 测试图表服务禁用情况
    execSync('prd config set diagram.service false', { cwd: testDir, env: process.env })

    const createOutput = execSync(
      'prd create --title "无图表服务测试" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    const diagramContent = `
### 测试图表

\`\`\`mermaid
graph LR
    A --> B
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section test --content "${diagramContent.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 尝试渲染应该提示服务未启用
    expect(() => {
      execSync(`prd diagram render ${prdId}`, {
        cwd: testDir,
        env: process.env
      })
    }).toThrow(/Diagram service is not enabled/)

    // 重新启用服务
    execSync('prd config set diagram.service true', { cwd: testDir, env: process.env })

    // 现在应该能正常渲染
    const enabledRenderOutput = execSync(`prd diagram render ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(enabledRenderOutput).toContain('Diagrams rendered successfully')
  })

  test('图表在不同输出格式中的显示', async () => {
    const createOutput = execSync(
      'prd create --title "格式显示测试" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    const simpleDiagram = `
### 简单流程

\`\`\`mermaid
graph LR
    A[开始] --> B[处理]
    B --> C[结束]
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section flow --content "${simpleDiagram.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 普通文本格式（应显示原始Mermaid代码）
    const textOutput = execSync(`prd show ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(textOutput).toContain('```mermaid')
    expect(textOutput).toContain('graph LR')
    expect(textOutput).toContain('A[开始] --> B[处理]')

    // Markdown格式（应保留Mermaid代码块）
    const markdownOutput = execSync(`prd show ${prdId} --format markdown`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(markdownOutput).toContain('```mermaid')
    expect(markdownOutput).toContain('graph LR')

    // HTML格式（应包含渲染的图表或占位符）
    const htmlOutput = execSync(`prd show ${prdId} --format html`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(htmlOutput).toContain('<div class="mermaid">')
    expect(htmlOutput).toContain('graph LR')

    // JSON格式（应包含图表元数据）
    const jsonOutput = execSync(`prd show ${prdId} --format json`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    const jsonData = JSON.parse(jsonOutput)
    expect(jsonData.diagrams).toBeDefined()
    expect(jsonData.diagrams.length).toBe(1)
    expect(jsonData.diagrams[0].type).toBe('mermaid')
    expect(jsonData.diagrams[0].section).toBe('flow')
  })

  test('图表缓存和优化', async () => {
    const createOutput = execSync(
      'prd create --title "缓存测试" --template technical',
      { cwd: testDir, encoding: 'utf8', env: process.env }
    )
    const prdId = createOutput.match(/ID: (\w+-\w+)/)![1]

    const cacheDiagram = `
### 缓存架构

\`\`\`mermaid
graph TB
    A[客户端] --> B[CDN]
    B --> C[负载均衡]
    C --> D[Web服务器]
    D --> E[应用缓存]
    D --> F[数据库]
\`\`\`
`

    execSync(
      `prd edit ${prdId} --section cache --content "${cacheDiagram.replace(/"/g, '\\"')}"`,
      { cwd: testDir, env: process.env }
    )

    // 首次渲染（缓存生成）
    const firstRenderTime = Date.now()
    execSync(`prd diagram render ${prdId}`, { cwd: testDir, env: process.env })
    const firstTime = Date.now() - firstRenderTime

    // 第二次渲染（应使用缓存，更快）
    const secondRenderTime = Date.now()
    const cachedRenderOutput = execSync(`prd diagram render ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })
    const secondTime = Date.now() - secondRenderTime

    expect(cachedRenderOutput).toContain('Using cached diagram')
    expect(secondTime).toBeLessThan(firstTime) // 缓存渲染应该更快

    // 清除缓存
    const clearCacheOutput = execSync(`prd diagram cache clear ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(clearCacheOutput).toContain('Cache cleared')

    // 缓存清除后再次渲染
    const afterClearRenderOutput = execSync(`prd diagram render ${prdId}`, {
      cwd: testDir,
      encoding: 'utf8',
      env: process.env
    })

    expect(afterClearRenderOutput).not.toContain('Using cached diagram')
    expect(afterClearRenderOutput).toContain('Diagrams rendered successfully')
  })
})