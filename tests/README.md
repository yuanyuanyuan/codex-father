# Codex Father 测试套件

## 📋 测试概览

本测试套件为 Codex Father v1.7.0 提供全面的测试覆盖，包括单元测试、集成测试、E2E测试、契约测试和性能测试。

### 🎯 测试目标

- **功能完整性**: 验证所有功能模块按规格要求正常工作
- **性能指标**: 确保系统满足性能要求（并发任务处理、响应时间等）
- **安全合规**: 验证安全策略和权限控制正确执行
- **用户体验**: 确保MCP工具、HTTP API、CLI界面友好可靠
- **内存优化**: 通过分批测试解决内存溢出问题

## 📁 测试结构

```
tests/
├── e2e/                          # 端到端测试
│   ├── mcp-toolkit.e2e.test.ts   # MCP工具包测试
│   ├── concurrency-engine.e2e.test.ts # 并发引擎测试
│   ├── http-api.e2e.test.ts      # HTTP API测试
│   └── setup.e2e.ts              # E2E测试环境设置
├── unit/                         # 单元测试
│   ├── core/                     # 核心模块测试
│   │   └── TaskRunner.unit.test.ts
│   ├── mcp/                      # MCP模块测试
│   │   └── MCPServer.unit.test.ts
│   ├── http/                     # HTTP模块测试
│   │   ├── HTTPServer.unit.test.ts
│   │   └── test-utils.ts
│   ├── schemas/                  # Schema验证测试
│   │   └── status-example.test.ts
│   └── [其他单元测试文件...]     # 配置、工具类等测试
├── integration/                  # 集成测试
│   ├── basic-features.test.ts    # 基础功能测试
│   ├── mvp1-single-process.test.ts # MVP单进程测试
│   ├── bridge-happy-path.test.ts # 桥接测试
│   └── [其他集成测试...]         # 处理器、认证等测试
├── contract/                     # 契约测试
│   ├── codex-jsonrpc.test.ts     # JSON-RPC协议测试
│   ├── mcp-initialize.test.ts    # MCP初始化测试
│   ├── mcp-tools-list.test.ts    # MCP工具列表测试
│   └── [其他契约测试...]         # 认证、对话等契约测试
├── acceptance/                   # 验收测试
│   ├── quickstart-acceptance.test.ts # 快速入门验收
│   └── orchestrate-manual-path.contract.test.ts # 手动路径验收
├── benchmark/                    # 性能基准测试
│   ├── performance.bench.ts      # 性能基准
│   └── mcp-response-time.bench.ts # MCP响应时间测试
├── smoke/                        # 冒烟测试
│   ├── bulk-e2e.smoke.sh         # 批量E2E冒烟
│   └── [其他冒烟测试...]         # 状态、上下文检测
├── helpers/                      # 测试工具
│   ├── mcp-client.ts            # MCP客户端测试工具
│   └── test-utils.ts            # 通用测试工具
├── config/                       # 测试配置
│   └── vitest.e2e.config.ts     # E2E测试配置
├── scripts/                      # 测试脚本
│   └── run-e2e-tests.ts         # E2E测试运行器
├── schemas/                      # 测试Schema定义
│   ├── [各种schema.json文件...]   # API契约schema
└── README.md                     # 本文档
```

## 🚀 快速开始

### 基础测试命令

```bash
# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行E2E测试
npm run test:e2e

# 运行所有测试（一次性）
npm run test:run

# 交互式测试模式
npm run test
```

### 内存优化测试（推荐）

```bash
# 分批执行所有测试（避免内存溢出）
npm run test:batch

# 快速测试按类型
npm run test:quick unit          # 单元测试 (~2GB内存)
npm run test:quick integration   # 集成测试 (~3GB内存) 
npm run test:quick contract      # 契约测试 (~2GB内存)
npm run test:quick http          # HTTP测试 (~3GB内存)
npm run test:quick mcp           # MCP测试 (~4GB内存)
npm run test:quick e2e           # E2E测试 (~6GB内存)

# 测试管理
npm run test:clean       # 清理测试结果和覆盖率
npm run test:merge       # 合并分批测试结果
```

### 运行特定测试

```bash
# 运行特定测试文件
npm run test:run tests/unit/schemas/status-example.test.ts --no-coverage
npm run test:run tests/unit/http-version.test.ts --no-coverage

# 运行MCP工具测试
npm run test:run tests/e2e/mcp-toolkit.e2e.test.ts

# 运行并发引擎测试
npm run test:run tests/e2e/concurrency-engine.e2e.test.ts

# 运行HTTP API测试
npm run test:run tests/e2e/http-api.e2e.test.ts

# 运行核心单元测试
npm run test:run tests/unit/core/TaskRunner.unit.test.ts
```

### E2E测试运行器

```bash
# 运行E2E测试
tsx tests/scripts/run-e2e-tests.ts run

# 运行带覆盖率的E2E测试
tsx tests/scripts/run-e2e-tests.ts run --coverage --verbose

# 检查测试环境
tsx tests/scripts/run-e2e-tests.ts check
```

### 已验证可用的测试

```bash
# ✅ 确认通过的测试文件
npm run test:run tests/unit/schemas/status-example.test.ts --no-coverage
npm run test:run tests/unit/http-version.test.ts --no-coverage
npm run test:run tests/unit/http/HTTPServer.unit.test.ts --no-coverage
```

## 📊 测试覆盖

### 单元测试覆盖

| 模块 | 测试文件 | 覆盖内容 | 状态 |
|------|----------|----------|------|
| 核心模块 | `TaskRunner.unit.test.ts` | 任务执行器核心逻辑 | ✅ 已实现 |
| MCP服务器 | `MCPServer.unit.test.ts` | MCP服务器核心功能 | ✅ 已实现 |
| HTTP服务器 | `HTTPServer.unit.test.ts` | HTTP接口处理 | ✅ 部分通过 |
| Schema验证 | `status-example.test.ts` | 状态schema验证 | ✅ 已通过 |
| 配置管理 | `configSchema.test.ts` | 配置schema验证 | ✅ 已实现 |
| 错误处理 | `errorFormatter.test.ts` | 错误格式化 | ✅ 已实现 |
| 版本检测 | `versionDetector.test.ts` | 版本检测逻辑 | ✅ 已实现 |

### 集成测试覆盖

| 功能模块 | 测试文件 | 覆盖场景 | 状态 |
|----------|----------|----------|------|
| 基础功能 | `basic-features.test.ts` | 核心功能集成 | ✅ 已实现 |
| MVP单进程 | `mvp1-single-process.test.ts` | 单进程模式 | ✅ 已实现 |
| 桥接功能 | `bridge-happy-path.test.ts` | 模块间桥接 | ✅ 已实现 |
| 认证流程 | `authHandlers.test.ts` | 认证处理 | ✅ 已实现 |
| 配置验证 | `config-validation.test.ts` | 配置集成 | ✅ 已实现 |
| MCP兼容性 | `mcp-compatibility.test.ts` | MCP协议兼容 | ✅ 已实现 |

### 契约测试覆盖

| 契约类型 | 测试文件 | 覆盖协议 | 状态 |
|----------|----------|----------|------|
| JSON-RPC | `codex-jsonrpc.test.ts` | JSON-RPC协议 | ✅ 已实现 |
| MCP初始化 | `mcp-initialize.test.ts` | MCP初始化流程 | ✅ 已实现 |
| MCP工具列表 | `mcp-tools-list.test.ts` | 工具发现协议 | ✅ 已实现 |
| MCP工具调用 | `mcp-tools-call.test.ts` | 工具调用协议 | ✅ 已实现 |
| 认证状态 | `authStatusChange.contract.test.ts` | 认证状态变更 | ✅ 已实现 |
| 对话管理 | `listConversations.contract.test.ts` | 对话列表管理 | ✅ 已实现 |

### E2E测试覆盖

| 测试类型 | 测试文件 | 覆盖场景 | 内存需求 |
|----------|----------|----------|----------|
| MCP工具包 | `mcp-toolkit.e2e.test.ts` | 完整MCP工具流程 | ~6GB |
| 并发引擎 | `concurrency-engine.e2e.test.ts` | 并发任务处理 | ~6GB |
| HTTP API | `http-api.e2e.test.ts` | HTTP接口完整流程 | ~6GB |

### 性能基准测试

| 测试类型 | 测试文件 | 测试指标 | 状态 |
|----------|----------|----------|------|
| 通用性能 | `performance.bench.ts` | 综合性能基准 | ✅ 已实现 |
| MCP响应时间 | `mcp-response-time.bench.ts` | MCP工具响应时间 | ✅ 已实现 |

## 🔧 配置选项

### 环境变量

| 变量名 | 描述 | 默认值 | 说明 |
|--------|------|--------|------|
| `NODE_ENV` | 运行环境 | `test` | 测试环境标识 |
| `CODEX_FATHER_TEST_MODE` | 测试模式 | `e2e` | E2E测试模式 |
| `CODEX_FATHER_DATA_DIR` | 测试数据目录 | `/tmp/codex-father-e2e` | 临时测试数据 |
| `CODEX_FATHER_LOG_LEVEL` | 日志级别 | `debug` | 详细调试日志 |
| `CODEX_FATHER_DISABLE_TELEMETRY` | 禁用遥测 | `true` | 测试时禁用遥测 |

### 内存优化配置

| 场景 | Node.js内存限制 | 推荐命令 |
|------|-----------------|----------|
| 单元测试 | 2GB | `NODE_OPTIONS="--max-old-space-size=2048"` |
| 集成测试 | 4GB | `NODE_OPTIONS="--max-old-space-size=4096"` |
| E2E测试 | 8GB | `NODE_OPTIONS="--max-old-space-size=8192"` |
| 分批测试 | 动态调整 | `npm run test:batch` |

### Vitest 配置文件

- **主配置**: 根目录 `vitest.config.ts` - 通用测试配置
- **E2E配置**: `tests/config/vitest.e2e.config.ts` - E2E测试专用配置

## 📈 性能基准与内存管理

### 分批测试内存需求

| 批次类型 | 内存范围 | 测试内容 | 执行时间 |
|----------|----------|----------|----------|
| 🟢 低压力 | <2GB | 基础单元测试、Schema验证 | 2-5分钟 |
| 🟡 中压力 | 2-4GB | HTTP服务器、集成测试 | 5-10分钟 |
| 🔴 高压力 | >4GB | E2E测试、MCP服务器 | 10-15分钟 |

### 性能指标

| 指标类型 | 目标值 | 测试方法 |
|----------|--------|----------|
| 单元测试响应时间 | <100ms | 单个测试执行 |
| 集成测试响应时间 | <500ms | 模块间交互 |
| E2E测试响应时间 | <2000ms | 完整流程测试 |
| 并发任务处理 | 支持多任务 | 并发引擎测试 |
| 内存峰值 | <8GB (分批) | 分批执行监控 |

### 内存优化策略

```bash
# 1. 使用分批测试避免内存溢出
npm run test:batch

# 2. 按需运行特定类型测试
npm run test:quick unit    # 仅单元测试
npm run test:quick http    # 仅HTTP测试

# 3. 清理测试缓存定期清理
npm run test:clean

# 4. 监控内存使用
node --trace-gc scripts/run-batch-tests.js
```

## 🛡️ 安全与合规测试

### 命令安全验证

| 安全检查 | 测试场景 | 覆盖状态 |
|----------|----------|----------|
| 危险命令检测 | `rm -rf /`, `sudo`, `chmod 777` | ✅ 已实现 |
| 路径遍历防护 | `../../../etc/passwd` | ✅ 已实现 |
| 命令注入防护 | 参数注入攻击 | ✅ 已实现 |
| 文件访问控制 | 越权文件访问 | ✅ 已实现 |

### 权限与资源控制

| 控制类型 | 测试内容 | 实现状态 |
|----------|----------|----------|
| 网络访问限制 | 禁止外部网络连接 | ✅ 已实现 |
| 文件系统限制 | 限制访问目录范围 | ✅ 已实现 |
| 环境变量过滤 | 敏感信息保护 | ✅ 已实现 |
| 资源使用限制 | CPU、内存限制 | ✅ 已实现 |

## 📊 测试报告与结果分析

### 报告生成位置

| 报告类型 | 文件路径 | 生成时机 |
|----------|----------|----------|
| 分批测试报告 | `test-results/batch-test-report.json` | 每批次完成 |
| 合并测试报告 | `test-results/merged-test-report.json` | 所有批次完成 |
| 覆盖率报告 | `coverage/lcov-report/index.html` | 覆盖率测试 |
| E2E测试报告 | `test-results/e2e-report-<timestamp>.md` | E2E测试完成 |

### 报告解读指南

#### 分批测试报告格式
```json
{
  "timestamp": "2025-01-XX",
  "batch": "core-units",
  "summary": {
    "totalTests": 50,
    "passed": 48,
    "failed": 2,
    "successRate": "96.0%",
    "duration": "120s",
    "memoryUsed": "1.8GB"
  }
}
```

#### 合并报告格式
```json
{
  "timestamp": "2025-01-XX",
  "summary": {
    "totalBatches": 16,
    "totalTests": 1000,
    "totalPassed": 950,
    "totalFailed": 50,
    "successRate": "95.0%",
    "totalDuration": "1200s"
  },
  "coverage": {
    "lines": {"pct": "85.5"},
    "functions": {"pct": "87.2"},
    "branches": {"pct": "82.1"},
    "statements": {"pct": "86.0"}
  }
}
```

### 质量指标解读

- **成功率**: 目标 >90%，优秀 >95%
- **代码覆盖率**: 目标 >80%，优秀 >85%
- **执行时间**: 单批次 <15分钟，总计 <20分钟
- **内存使用**: 峰值 <8GB，分批有效控制溢出

## 🚨 故障排除与调试

### 常见问题及解决方案

#### 1. 内存溢出 (JavaScript heap out of memory)

**问题**: 运行测试时出现内存不足错误
```bash
JavaScript heap out of memory
```

**解决方案**:
```bash
# 方案1: 使用分批测试（推荐）
npm run test:batch

# 方案2: 增加Node.js内存限制
NODE_OPTIONS="--max-old-space-size=4096" npm run test:run

# 方案3: 仅运行低内存测试
npm run test:quick unit

# 方案4: 清理后重新运行
npm run test:clean && npm run test:quick unit
```

#### 2. 测试文件找不到

**问题**: `Cannot find module` 或文件路径错误
```bash
Error: Cannot find module 'tests/unit/xxx.test.ts'
```

**解决方案**:
```bash
# 检查文件是否存在
find tests -name "*.test.ts" | grep 具体文件名

# 使用绝对路径
npm run test:run $(pwd)/tests/unit/schemas/status-example.test.ts --no-coverage

# 检查文件权限
ls -la tests/unit/schemas/
```

#### 3. TypeScript编译错误

**问题**: 类型错误或编译失败
```bash
error TS2307: Cannot find module
```

**解决方案**:
```bash
# 重新构建项目
npm run test:clean && npm run build

# 重新安装依赖
rm -rf node_modules package-lock.json && npm install

# 仅类型检查
npm run typecheck
```

#### 4. 测试环境配置问题

**问题**: 环境变量或配置缺失

**解决方案**:
```bash
# 设置测试环境变量
export NODE_ENV=test
export CODEX_FATHER_TEST_MODE=e2e

# 检查配置文件
cat tests/config/vitest.e2e.config.ts

# 创建临时数据目录
mkdir -p /tmp/codex-father-e2e
sudo chown -R $USER:$USER /tmp/codex-father-e2e
```

#### 5. 端口冲突

**问题**: 测试服务器端口被占用

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3000
netstat -tulpn | grep :3000

# 终止占用进程
kill -9 <PID>

# 或使用不同端口
PORT=3001 npm run test:e2e
```

### 高级调试技巧

#### 启用详细日志
```bash
# Vitest详细输出
DEBUG=vitest:* npm run test:batch

# Node.js垃圾回收跟踪
node --trace-gc scripts/run-batch-tests.js

# 内存详细跟踪
node --trace-deopt scripts/run-batch-tests.js
```

#### 单独运行问题测试
```bash
# 运行特定测试文件
npm run test:run tests/unit/schemas/status-example.test.ts --verbose

# 运行特定测试用例
npm run test:run tests/unit/schemas/status-example.test.ts -t "specific test name"

# 生成覆盖率报告
npm run test:run tests/unit/schemas/status-example.test.ts --coverage
```

#### 保留测试数据进行调试
```bash
# 跳过清理保留测试数据
export CODEX_FATHER_SKIP_CLEANUP=true
npm run test:e2e

# 查看测试数据
ls -la /tmp/codex-father-e2e/
```

#### 检查测试批次状态
```bash
# 查看批次测试报告
cat test-results/batch-test-report.json | jq '.'

# 查看失败的具体批次
cat test-results/batch-test-report.json | jq '.results[] | select(.status=="failed")'

# 重新运行失败的批次
npm run test:quick <batch-name>  # 如: npm run test:quick unit
```

### 性能监控

#### 内存使用监控
```bash
# 实时监控内存使用
watch -n 2 'ps aux | grep node | grep -v grep'

# 系统内存监控
free -h

# Node.js进程内存详情
cat /proc/<node-pid>/status | grep -E "(VmRSS|VmSize)"
```

#### 测试执行时间分析
```bash
# 使用time命令测量执行时间
time npm run test:quick unit

# Vitest内置性能报告
npm run test:run --reporter=verbose
```

## 🔄 CI/CD 集成与自动化

### GitHub Actions 工作流

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run type check
        run: npm run typecheck
      
      - name: Run linting
        run: npm run lint
      
      - name: Run batch tests (memory optimized)
        run: |
          npm run test:clean
          npm run test:batch
          npm run test:merge
        env:
          NODE_ENV: test
          CODEX_FATHER_TEST_MODE: ci
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### 本地预检查工作流

```bash
# 1. 代码质量检查
npm run lint              # ESLint检查
npm run typecheck          # TypeScript类型检查
npm run format             # Prettier格式化

# 2. 构建验证
npm run test:clean && npm run build    # 清理并构建

# 3. 快速测试验证
npm run test:quick unit          # 核心单元测试
npm run test:quick integration   # 基础集成测试

# 4. 完整测试（如时间允许）
npm run test:batch && npm run test:merge
```

## 📚 测试最佳实践

### 1. 内存管理策略

```bash
# ✅ 推荐：日常开发使用快速测试
npm run test:quick unit

# ✅ 推荐：提交前使用分批测试
npm run test:batch

# ❌ 避免：一次性运行所有测试
npm run test:coverage  # 可能导致内存溢出
```

### 2. 测试隔离原则

- **独立运行**: 每个测试用例都应该能够独立运行
- **状态清理**: 测试后及时清理临时文件和进程
- **环境隔离**: 使用独立的测试环境变量和配置
- **依赖模拟**: 适当使用Mock隔离外部依赖

### 3. 性能监控原则

- **执行时间**: 单个测试 < 5秒，批次测试 < 15分钟
- **内存使用**: 监控内存峰值，及时清理
- **并发控制**: 合理设置测试并发数量
- **资源清理**: 测试完成后清理所有资源

### 4. 错误处理原则

- **清晰信息**: 提供有意义的错误消息和堆栈跟踪
- **调试指引**: 包含问题排查的具体步骤
- **状态快照**: 保存失败时的测试状态
- **断言精确**: 使用精确的断言验证预期行为

## 🤝 贡献指南

### 添加新测试的规范

1. **文件命名规范**:
   - 单元测试: `*.unit.test.ts`
   - 集成测试: `*.integration.test.ts` 或放在 `tests/integration/`
   - E2E测试: `*.e2e.test.ts`
   - 契约测试: `*.contract.test.ts`

2. **目录结构规范**:
   ```
   tests/
   ├── unit/           # 单元测试
   │   ├── core/       # 核心模块
   │   ├── http/       # HTTP模块
   │   └── mcp/        # MCP模块
   ├── integration/    # 集成测试
   ├── e2e/           # 端到端测试
   └── contract/      # 契约测试
   ```

3. **测试编写规范**:
   ```typescript
   describe('模块名称', () => {
     describe('功能名称', () => {
       it('应该正确执行特定场景', async () => {
         // Arrange - 准备测试数据
         // Act - 执行测试操作
         // Assert - 验证结果
         expect(actual).toBe(expected);
       });
     });
   });
   ```

4. **文档更新要求**:
   - 更新本文档的相关测试覆盖表格
   - 更新 `docs/test/` 目录下的相关文档
   - 添加必要的故障排除指南
   - 更新内存使用说明（如需要）

## 📖 相关文档

- **分批测试指南**: `docs/test/batch-testing-guide.md`
- **测试手册**: `docs/test/test-manual.md`
- **架构文档**: `docs/architecture/README.md`
- **API文档**: `docs/architecture/api/README.md`

---

**文档版本**: v1.7.0  
**最后更新**: 2025-01-16  
**维护团队**: Codex Father 测试团队  
**适用版本**: Codex Father v1.7.0+
