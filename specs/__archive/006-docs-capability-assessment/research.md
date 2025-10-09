# Phase 0 Research — Multi-Agent Parallel Task Orchestration

本研究总结了本特性在 Codex
Father 现有技术栈上的关键技术取舍（Decision）、理由（Rationale）与备选方案（Alternatives）。

## 1) LLM 通道与网络策略

- Decision: 编排器进程禁网；LLM 仅通过 Codex CLI 内部通道（`codex exec`）调用
- Rationale: 与 NFR-001 对齐，降低安全面；统一提示词与审计，由 CLI 负责
- Alternatives:
  - 直接 HTTP/SDK 调用模型（Rejected：破坏禁网基线、扩散凭据管理）
  - MCP 长连统一工具路由（Deferred：后续演进选项，当前优先 `exec`）

## 2) 并发与调度实现

- Decision: 复用 `core/lib/queue/*`（scheduler/retry/config/basic-executor）
- Rationale: 避免引入 `p-queue/p-limit`；与现有监控、重试策略一致（DRY/YAGNI）
- Alternatives:
  - `p-queue`（Rejected：功能重叠、引入新抽象）
  - 自研轻量并发器（Rejected：重复造轮子，测试成本高）

## 3) 补丁应用与写冲突协调

- Decision: SWW（单写者窗口）+ 两阶段写；`git apply` 优先，失败回退到 `native`
- Rationale: 精确控制写入时序；`git apply`
  具备良好冲突检测；native 兼容无 git 环境场景
- Alternatives:
  - 直接在主工作区写文件（Rejected：高风险，难以回退/审计）
  - 仅使用 `native`（Rejected：缺少 git 生态的冲突提示）

## 4) 快速校验策略

- Decision: 快速校验为强制步骤；缺失校验工具时判失败并阻塞写入
- Rationale: 将错误尽早暴露，减少坏补丁进入主工作区
- Alternatives:
  - 允许跳过（Rejected：破坏稳定性）
  - 延迟到批量验证（Rejected：错误聚集、定位困难）

## 5) 资源监控与自动降并发

- Decision: 优先使用 Node 内置指标（`os.loadavg()`、`os.totalmem/freemem`、`process.memoryUsage`）
- Rationale: 零额外依赖，足以驱动粗粒度的升降并发
- Alternatives:
  - `systeminformation`（Deferred：若内置指标不足以定位瓶颈再引入）

## 6) 可观测性与审计

- Decision: 对外 Stream-JSON（对齐
  `docs/schemas/stream-json-event.schema.json`），对内 JSONL 审计（`EventLogger`）
- Rationale: 统一格式、可追溯；与现有工具链兼容
- Alternatives: 新增事件总线（Rejected：超出当前范围）

## 7) 配置与安全

- Decision: 统一 `ConfigLoader`（文件→环境→CLI 覆盖）；角色声明
  `allowedTools/permission-mode/sandbox`
- Rationale: 一致性与最小惊讶；明确安全边界
- Alternatives: 临时环境变量散落管理（Rejected：不可维护）

## 8) ID 生成与依赖对齐

- Decision: 使用 `uuid` 生成事件/会话/任务 ID（与 `EventLogger` 保持一致）
- Rationale: 通用、稳定；已有使用场景
- Alternatives: 自增序列/时间戳拼接（Rejected：冲突风险、可读性差）
