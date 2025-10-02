# T038 - 代码审查范围与检查清单

> **任务目标**：审查所有新增代码的可读性和可维护性，确保符合 SOLID 原则和项目 constitution

## 📂 审查范围

### 核心模块（Core Modules）

#### 1. MCP 协议层 (`core/mcp/`)

```
core/mcp/
├── server.ts              # MCP 服务器主入口
├── bridge-layer.ts        # MCP ↔ Codex 桥接层
├── codex-client.ts        # Codex JSON-RPC 客户端
├── event-mapper.ts        # 事件映射器 [性能关键]
└── protocol/              # 协议类型定义
    └── types.ts
```

**审查重点**：

- MCP 协议实现正确性
- 错误处理完整性
- 事件映射性能优化

#### 2. 进程管理 (`core/process/`)

```
core/process/
└── manager.ts             # 单进程管理器
```

**审查重点**：

- 进程生命周期管理
- 健康检查逻辑
- 重启机制可靠性

#### 3. 会话管理 (`core/session/`)

```
core/session/
├── session-manager.ts     # 会话管理器
├── event-logger.ts        # 事件日志记录器 [性能关键]
└── config-persister.ts    # 配置持久化器
```

**审查重点**：

- 会话状态管理
- 日志写入性能
- 文件 I/O 错误处理

#### 4. 审批系统 (`core/approval/`)

```
core/approval/
├── policy-engine.ts       # 审批策略引擎
└── terminal-ui.ts         # 终端交互 UI
```

**审查重点**：

- 策略匹配逻辑
- 用户交互体验
- 安全性（防止策略绕过）

#### 5. CLI 命令 (`core/cli/commands/`)

```
core/cli/commands/
└── mcp-command.ts         # MCP 服务器启动命令
```

**审查重点**：

- 命令参数验证
- 优雅关闭处理
- 错误提示友好性

---

## 🔍 SOLID 原则检查

### S - 单一职责原则 (Single Responsibility)

**检查清单**：

- [ ] 每个类/模块是否只有一个改变的理由？
- [ ] 是否存在"上帝类"（God Class）？
- [ ] 职责是否清晰划分？

**重点审查**：

- `bridge-layer.ts` - 是否混合了太多职责？
- `session-manager.ts` - 是否承担了过多协调工作？

**验证方法**：

```bash
# 检查文件行数（过大可能违反 SRP）
wc -l core/mcp/bridge-layer.ts
wc -l core/session/session-manager.ts
```

---

### O - 开闭原则 (Open/Closed)

**检查清单**：

- [ ] 新增功能是否需要修改现有代码？
- [ ] 是否使用了接口/抽象类来扩展？
- [ ] 策略模式是否正确应用？

**重点审查**：

- `policy-engine.ts` - 新增审批策略是否需要修改引擎代码？
- `event-mapper.ts` - 新增事件类型是否需要修改映射逻辑？

**验证方法**：

```typescript
// 检查是否使用接口定义扩展点
grep -r "interface.*Strategy\|interface.*Policy" core/
```

---

### L - 里氏替换原则 (Liskov Substitution)

**检查清单**：

- [ ] 子类型是否可以替换父类型？
- [ ] 是否违反了父类契约？
- [ ] 是否有不必要的类型断言？

**重点审查**：

- 继承关系是否合理
- 接口实现是否正确

**验证方法**：

```bash
# 检查类型断言数量（过多可能违反 LSP）
grep -r "as \|<.*>" core/ | wc -l
```

---

### I - 接口隔离原则 (Interface Segregation)

**检查清单**：

- [ ] 接口是否过大（"胖接口"）？
- [ ] 客户端是否被迫依赖不使用的方法？
- [ ] 接口是否按职责拆分？

**重点审查**：

- `core/lib/types.ts` - 接口定义是否合理？
- MCP 工具接口是否过于复杂？

**验证方法**：

```typescript
// 检查接口方法数量
grep -A 20 "interface.*{" core/lib/types.ts
```

---

### D - 依赖倒置原则 (Dependency Inversion)

**检查清单**：

- [ ] 高层模块是否依赖抽象而非具体实现？
- [ ] 是否使用了依赖注入？
- [ ] 是否存在硬编码的依赖？

**重点审查**：

- `bridge-layer.ts` - 是否直接依赖 `CodexClient` 实现？
- `session-manager.ts` - 依赖注入是否正确？

**验证方法**：

```bash
# 检查构造函数注入
grep -r "constructor(" core/ | grep -v "test"
```

---

## 🎯 性能关键路径审查

### 1. 事件映射器 (`core/mcp/event-mapper.ts`)

**性能指标**：

- ✅ 事件映射延迟 < 100ms
- ✅ 无内存泄漏

**审查要点**：

- [ ] 是否有不必要的对象拷贝？
- [ ] 映射逻辑是否高效？
- [ ] 是否缓存了重复计算？

**验证方法**：

```bash
# 运行性能基准测试
npm run benchmark
```

### 2. 事件日志记录器 (`core/session/event-logger.ts`)

**性能指标**：

- ✅ 日志写入不阻塞主流程
- ✅ 流式写入，避免内存缓存

**审查要点**：

- [ ] 是否使用了异步 I/O？
- [ ] 是否有日志写入队列？
- [ ] 是否正确处理了写入失败？

**验证方法**：

```typescript
// 检查是否使用 async/await
grep -A 10 "logEvent" core/session/event-logger.ts
```

### 3. MCP 工具调用 (`core/mcp/bridge-layer.ts`)

**性能指标**：

- ✅ tools/call 响应时间 < 500ms

**审查要点**：

- [ ] 是否快速返回 Job ID？
- [ ] 是否异步执行实际任务？
- [ ] 是否有超时控制？

**验证方法**：

```bash
# 检查契约测试中的性能验证
grep -A 5 "500ms" tests/contract/mcp-tools-call.test.ts
```

---

## 📝 代码质量检查

### 1. 类型安全

**检查清单**：

- [ ] 是否避免使用 `any` 类型？
- [ ] 是否使用了 Zod 验证运行时类型？
- [ ] 是否有完整的类型注解？

**验证方法**：

```bash
# 检查 any 使用数量
grep -r ": any\|<any>" core/ | wc -l

# 运行类型检查
npm run typecheck
```

### 2. 错误处理

**检查清单**：

- [ ] 是否有完整的 try-catch？
- [ ] 错误消息是否清晰？
- [ ] 是否正确传播错误？

**重点审查**：

- `codex-client.ts` - 进程错误处理
- `terminal-ui.ts` - 用户输入错误处理

**验证方法**：

```bash
# 检查错误处理覆盖率
grep -r "try\|catch\|throw" core/ | wc -l
```

### 3. 测试覆盖率

**检查清单**：

- [ ] 是否有对应的单元测试？
- [ ] 是否有集成测试？
- [ ] 边界情况是否测试？

**验证方法**：

```bash
# 运行测试覆盖率报告
npm run test:coverage
```

### 4. 代码复用

**检查清单**：

- [ ] 是否有重复代码？
- [ ] 是否提取了公共逻辑？
- [ ] 是否遵循 DRY 原则？

**验证结果**：

```bash
# 已执行 T035 检查
# ✅ 重复代码率: 3.2%（< 5% 达标）
npx jscpd core/
```

---

## 🛡️ 安全性审查

### 1. 命令注入防护

**检查要点**：

- [ ] 审批策略是否可被绕过？
- [ ] 命令参数是否正确转义？
- [ ] 是否验证了文件路径？

**重点审查**：

- `policy-engine.ts` - 白名单正则是否安全？
- `codex-client.ts` - 命令构建是否安全？

### 2. 敏感信息保护

**检查要点**：

- [ ] 日志是否脱敏？
- [ ] 环境变量是否安全处理？
- [ ] 凭证是否加密存储？

**重点审查**：

- `event-logger.ts` - 日志脱敏逻辑
- `config-persister.ts` - 配置文件权限

---

## 📚 文档完整性

### 代码注释

**检查清单**：

- [ ] 公共 API 是否有 JSDoc？
- [ ] 复杂逻辑是否有注释？
- [ ] 魔法数字是否有解释？

**验证方法**：

```bash
# 检查 JSDoc 覆盖率
grep -r "/**" core/ | wc -l
```

### README 和文档

**检查清单**：

- [ ] `README.md` 是否更新？
- [ ] `docs/mcp-integration.md` 是否完整？
- [ ] API 文档是否准确？

**验证方法**：

```bash
# 检查文档是否提交
git status docs/ README.md
```

---

## 🔧 重构建议

### 1. 可能的重构点

根据审查结果，考虑以下重构：

#### 建议 1: 抽象审批策略

```typescript
// 当前实现
class PolicyEngine {
  evaluate(request: ApprovalRequest): 'allow' | 'deny' | 'require-manual' {
    // 直接在引擎中处理白名单逻辑
  }
}

// 建议改进
interface ApprovalPolicy {
  evaluate(request: ApprovalRequest): PolicyDecision;
}

class WhitelistPolicy implements ApprovalPolicy { ... }
class BlacklistPolicy implements ApprovalPolicy { ... }

class PolicyEngine {
  constructor(private policies: ApprovalPolicy[]) {}
}
```

#### 建议 2: 事件映射器优化

```typescript
// 如果发现性能瓶颈，考虑使用缓存
class EventMapper {
  private cache = new Map<string, MCPProgressNotification>();

  mapEvent(codexEvent: CodexEvent, jobId: string): MCPProgressNotification {
    const cacheKey = `${jobId}-${codexEvent.type}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    // ...映射逻辑
  }
}
```

---

## ✅ 审查检查清单

### 完整性检查

- [ ] 所有模块都已审查
- [ ] SOLID 原则符合度 > 80%
- [ ] 性能指标达标
- [ ] 类型安全完整
- [ ] 错误处理完整
- [ ] 测试覆盖率 > 80%
- [ ] 安全漏洞已修复
- [ ] 文档已更新

### 优化检查

- [ ] 性能关键路径已优化
- [ ] 代码重复率 < 5%
- [ ] 无明显技术债务
- [ ] 可维护性良好

---

## 📋 审查报告模板

完成审查后，请填写以下报告：

```markdown
## T038 代码审查报告

**审查日期**: YYYY-MM-DD **审查人员**: [姓名]

### SOLID 原则符合度

- 单一职责: [符合/部分符合/不符合]
- 开闭原则: [符合/部分符合/不符合]
- 里氏替换: [符合/部分符合/不符合]
- 接口隔离: [符合/部分符合/不符合]
- 依赖倒置: [符合/部分符合/不符合]

### 性能审查

- 事件映射器: [✅ 通过 / ❌ 需优化]
- 事件日志记录器: [✅ 通过 / ❌ 需优化]
- MCP 工具调用: [✅ 通过 / ❌ 需优化]

### 代码质量

- 类型安全: [✅ 良好 / ⚠️ 一般 / ❌ 较差]
- 错误处理: [✅ 良好 / ⚠️ 一般 / ❌ 较差]
- 测试覆盖: [百分比]%
- 代码复用: [百分比]% 重复率

### 安全性

- [ ] 无命令注入风险
- [ ] 敏感信息已脱敏
- [ ] 审批策略无绕过漏洞

### 发现的问题

1. [问题描述] - 优先级: [高/中/低]
2. [问题描述] - 优先级: [高/中/低]

### 重构建议

1. [建议描述]
2. [建议描述]

### 总体评价

- [ ] 代码质量优秀，可以发布
- [ ] 代码质量良好，建议优化后发布
- [ ] 代码质量一般，必须修复问题后发布

### 下一步行动

- [ ] 修复关键问题
- [ ] 实施重构建议
- [ ] 更新文档
- [ ] 准备发布
```

---

## 🎯 审查后行动

完成审查后：

1. ✅ 填写审查报告
2. ✅ 修复关键问题（如有）
3. ✅ 实施重构建议（可选）
4. ✅ 更新相关文档
5. ✅ 准备发布 v1.0.0

---

**审查愉快！** (๑•̀ㅂ•́)✧
