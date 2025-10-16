# Codex Father 2.0 测试套件

## 📋 测试概览

本测试套件为 Codex Father
2.0 提供全面的测试覆盖，包括 E2E 测试、集成测试、单元测试和性能测试。

### 🎯 测试目标

- **功能完整性**: 验证所有功能模块按规格要求正常工作
- **性能指标**: 确保系统满足性能要求（50个并发任务、响应时间等）
- **安全合规**: 验证安全策略和权限控制正确执行
- **用户体验**: 确保MCP工具、HTTP API、CLI界面友好可靠

## 📁 测试结构

```
tests/
├── e2e/                          # 端到端测试
│   ├── mcp-toolkit.e2e.test.ts   # MCP六件套工具测试
│   ├── concurrency-engine.e2e.test.ts # 并发引擎测试
│   ├── http-api.e2e.test.ts      # HTTP API测试
│   └── setup.e2e.ts              # E2E测试环境设置
├── unit/                         # 单元测试
│   ├── core/                     # 核心模块测试
│   │   └── TaskRunner.unit.test.ts
│   ├── mcp/                      # MCP模块测试
│   │   └── MCPServer.unit.test.ts
│   └── http/                     # HTTP模块测试
│       └── HTTPServer.unit.test.ts
├── integration/                  # 集成测试（现有）
├── contract/                     # 契约测试（现有）
├── helpers/                      # 测试工具
│   ├── mcp-client.ts            # MCP客户端测试工具
│   └── test-utils.ts            # 通用测试工具
├── config/                       # 测试配置
│   └── vitest.e2e.config.ts     # E2E测试配置
├── scripts/                      # 测试脚本
│   └── run-e2e-tests.ts         # E2E测试运行器
└── README.md                     # 本文档
```

## 🚀 快速开始

### 运行所有测试

```bash
# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行E2E测试
npm run test:e2e

# 运行所有测试
npm run test:run
```

### 运行特定测试

```bash
# 运行MCP工具测试
npm run test e2e/mcp-toolkit.e2e.test.ts

# 运行并发引擎测试
npm run test e2e/concurrency-engine.e2e.test.ts

# 运行HTTP API测试
npm run test e2e/http-api.e2e.test.ts

# 运行单元测试
npm run test unit/core/TaskRunner.unit.test.ts
```

### 使用E2E测试运行器

```bash
# 检查测试环境
tsx tests/scripts/run-e2e-tests.ts check

# 准备测试环境
tsx tests/scripts/run-e2e-tests.ts prepare

# 运行E2E测试
tsx tests/scripts/run-e2e-tests.ts run

# 运行带覆盖率的E2E测试
tsx tests/scripts/run-e2e-tests.ts run --coverage --verbose

# 监视模式
tsx tests/scripts/run-e2e-tests.ts run --watch
```

## 📊 测试覆盖

### MCP 工具集测试 (P1)

| 工具           | 功能         | 覆盖场景                                            |
| -------------- | ------------ | --------------------------------------------------- |
| `codex_exec`   | 任务提交执行 | ✅ 基本执行、自定义ID、依赖关系、参数验证、环境支持 |
| `codex_status` | 状态查询     | ✅ 运行状态、结果包含、不存在任务、参数验证         |
| `codex_logs`   | 日志获取     | ✅ 日志检索、行数限制、分页、实时更新               |
| `codex_reply`  | 上下文追加   | ✅ 消息追加、文件附加、安全验证、任务状态检查       |
| `codex_list`   | 任务列表     | ✅ 列表获取、状态过滤、分页、排序、数量限制         |
| `codex_cancel` | 任务取消     | ✅ 任务取消、不存在任务、已完成任务、异常处理       |

### 并发引擎测试 (P1)

| 功能       | 测试场景                              | 覆盖状态 |
| ---------- | ------------------------------------- | -------- |
| 并发执行   | ✅ 多任务并发、槽位限制、队列管理     | 完全覆盖 |
| 优先级调度 | ✅ 优先级排序、公平调度、同优先级处理 | 完全覆盖 |
| 依赖管理   | ✅ 单依赖、复杂依赖链、失败依赖       | 完全覆盖 |
| 错误处理   | ✅ 超时处理、执行失败、资源释放       | 完全覆盖 |
| 性能测试   | ✅ 50任务负载、状态查询性能、资源管理 | 完全覆盖 |

### HTTP API 测试 (P2)

| 端点                     | 功能       | 测试场景                                    |
| ------------------------ | ---------- | ------------------------------------------- |
| `POST /tasks`            | 任务提交   | ✅ 创建任务、参数验证、安全检查、错误处理   |
| `GET /tasks/{id}`        | 状态查询   | ✅ 状态获取、结果包含、不存在任务           |
| `GET /tasks`             | 任务列表   | ✅ 列表获取、过滤、分页、排序、限制验证     |
| `POST /tasks/{id}/reply` | 上下文追加 | ✅ 消息追加、文件验证、安全检查             |
| `DELETE /tasks/{id}`     | 任务取消   | ✅ 任务取消、状态验证、异常处理             |
| `GET /healthz`           | 健康检查   | ✅ 状态报告、统计信息、版本信息             |
| `WebSocket`              | 实时通信   | ✅ 连接管理、消息广播、状态推送、客户端管理 |

## 🔧 配置选项

### 环境变量

| 变量名                           | 描述         | 默认值                  |
| -------------------------------- | ------------ | ----------------------- |
| `CODEX_FATHER_TEST_MODE`         | 测试模式标识 | `e2e`                   |
| `CODEX_FATHER_DATA_DIR`          | 测试数据目录 | `/tmp/codex-father-e2e` |
| `CODEX_FATHER_LOG_LEVEL`         | 日志级别     | `debug`                 |
| `CODEX_FATHER_DISABLE_TELEMETRY` | 禁用遥测     | `true`                  |

### Vitest 配置

- **E2E测试**: `tests/config/vitest.e2e.config.ts`
- **单元测试**: 使用根目录 `vitest.config.ts`
- **Orchestrator测试**: `vitest.orchestrator.config.ts`

## 📈 性能基准

### 并发性能

- **目标**: 支持50个并发任务
- **成功率**: >99%
- **平均响应时间**: <100ms
- **系统启动时间**: <50ms
- **内存占用**: <20MB

### API性能

- **HTTP响应时间**: <50ms
- **WebSocket延迟**: <10ms
- **并发请求处理**: 支持100并发请求
- **限流触发**: 合理的限流保护

## 🛡️ 安全测试

### 命令验证

- ✅ 危险命令检测 (`rm -rf /`, `sudo`, 等)
- ✅ 路径遍历攻击防护 (`../../../etc/passwd`)
- ✅ 命令注入防护
- ✅ 文件访问权限验证

### 权限控制

- ✅ 网络访问禁用
- ✅ 文件系统访问限制
- ✅ 环境变量过滤
- ✅ 资源使用限制

## 📝 测试报告

测试完成后，报告将生成在以下位置：

- **测试结果**: `test-results/`
- **覆盖率报告**: `coverage/`
- **E2E报告**: `test-results/e2e-report-<timestamp>.md`

### 报告内容

1. **测试概览**: 总数、成功数、失败数、成功率
2. **性能指标**: 响应时间、并发能力、资源使用
3. **错误分析**: 失败原因、错误分布、修复建议
4. **覆盖率分析**: 代码覆盖率、模块覆盖详情

## 🚨 故障排除

### 常见问题

1. **端口冲突**

   ```bash
   # 查找占用端口的进程
   lsof -i :3000
   # 或使用不同端口
   PORT=3001 npm run test:e2e
   ```

2. **权限问题**

   ```bash
   # 确保有权限访问临时目录
   sudo chown -R $USER:$USER /tmp/codex-father-e2e
   ```

3. **内存不足**

   ```bash
   # 增加交换空间或减少并发数
   export CODEX_FATHER_MAX_CONCURRENCY=5
   ```

4. **依赖问题**
   ```bash
   # 重新安装依赖
   npm ci
   # 或清理缓存
   npm run clean:caches
   ```

### 调试模式

```bash
# 启用详细日志
DEBUG=codex-father:* npm run test:e2e

# 单独运行失败的测试
npm run test -- --reporter=verbose e2e/mcp-toolkit.e2e.test.ts

# 保留测试数据
export CODEX_FATHER_SKIP_CLEANUP=true
npm run test:e2e
```

## 🔄 CI/CD 集成

### GitHub Actions

```yaml
- name: Run E2E Tests
  run: |
    npm run test:e2e
    npm run test:coverage
  env:
    NODE_ENV: test
    CODEX_FATHER_TEST_MODE: ci
```

### 本地预检查

```bash
# 完整测试检查
npm run check:all

# 快速检查
npm run check:all:fast
```

## 📚 最佳实践

1. **测试隔离**: 每个测试用例独立运行，不依赖其他测试状态
2. **清理资源**: 测试后及时清理临时文件和进程
3. **合理超时**: 根据测试复杂度设置适当的超时时间
4. **错误处理**: 提供清晰的错误信息和调试指引
5. **性能监控**: 关注测试执行时间，避免性能回归

## 🤝 贡献指南

添加新测试时，请遵循以下规范：

1. **命名规范**: `*.e2e.test.ts` (E2E), `*.unit.test.ts` (单元)
2. **测试描述**: 使用清晰的 `describe` 和 `it` 描述
3. **断言验证**: 提供有意义的断言和错误信息
4. **Mock使用**: 适当使用Mock隔离外部依赖
5. **文档更新**: 更新相关文档和覆盖率目标

---

_测试套件版本: 1.0.0_  
_最后更新: 2024-01-01_  
_维护者: Codex Father 测试团队_
