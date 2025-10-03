# Feature Specification: Codex Father MCP Integration

**Feature Branch**: `003-codex-mcp-integration`
**Created**: 2025-09-30
**Status**: Draft
**Input**: 基于 docs/prd-draft.md 的 codex 二次封装需求

## 执行流程概览

```
1. 解析用户需求：codex-father 作为 codex CLI 的二次封装管理工具
2. 明确核心架构：
   - 对外：MCP 服务器（统一协议）
   - 对内：MCP客户端 + Exec执行器（双模式）
3. 定义关键功能：任务队列、会话管理、策略控制、事件日志
4. 设计数据模型：JobSpec、Session、TaskQueue
5. 规划实施路径：MCP优先 → Exec备用 → 统一治理
```

---

## ⚡ 快速指南

- ✅ 专注于 WHAT（codex 的封装管理）和 WHY（统一治理、并发控制、可观测性）
- ❌ 避免重复 codex 本身的功能
- 🎯 目标用户：需要批量/并发使用 codex 的开发团队

---

## 用户场景与测试

### 主要用户故事

作为开发团队，我们需要一个 codex 的管理层，能够：
1. 并发执行多个 codex 任务而不互相干扰
2. 统一管理任务队列、超时、取消、重试
3. 采集和归档所有任务的事件日志
4. 提供统一的 MCP 协议接口供外部工具调用

### 验收场景

1. **Given** 外部工具需要调用 codex，**When** 通过 MCP 协议发送请求，**Then** codex-father 路由到内部 codex-mcp 实例并返回结果
2. **Given** 多个并发任务，**When** 同时提交到 father，**Then** 系统在 codex-mcp 进程内多路复用，无阻塞
3. **Given** 长时间运行的任务，**When** 需要可恢复执行，**Then** 系统切换到 exec 模式并支持 resume
4. **Given** 任务执行中，**When** 需要取消，**Then** MCP 模式发送 Cancelled，exec 模式 kill 进程
5. **Given** 任务完成，**When** 查看执行记录，**Then** 所有事件、日志、元数据已归档到 `.codex-father/sessions/<job-id>/`

### 边界情况

- codex-mcp 进程崩溃如何恢复？→ 自动重启 + 失败任务重试
- exec 模式子进程僵尸如何清理？→ 父进程监控 + 超时强杀
- 并发过高导致资源耗尽？→ 全局并发限制 + 队列背压
- 网络/文件系统权限不足？→ 沙箱策略 + 审批流程

---

## 需求定义

### 功能需求

#### FR-001: MCP 服务器实现
系统必须实现标准 MCP 服务器，对外提供统一协议接口：
- 支持 tools/call 调用 codex 工具
- 接收 prompt、model、approval-policy、sandbox、cwd 等参数
- 返回 JSON-RPC 格式的结果和事件通知

#### FR-002: MCP 客户端集成
系统必须作为 MCP 客户端连接到常驻的 `codex mcp` 进程：
- 维护 requestId ↔ conversationId 映射
- 支持并发多会话（进程内多路复用）
- 处理 CancelledNotification 取消请求
- 接收并落盘 JSON-RPC Notification 事件流

#### FR-003: Exec 执行器实现
系统必须支持 `codex exec` 模式作为备用执行器：
- 按需派生独立子进程执行任务
- 使用 --json 采集事件到 events.jsonl
- 支持 resume 续写会话
- 进程级隔离（CPU/内存/cgroup 可选）

#### FR-004: 任务队列管理
系统必须实现基于文件系统的任务队列：
- 复用现有 `.codex-father/sessions/<job-id>/` 目录结构
- 支持任务状态：queued → running → succeeded/failed/aborted
- 支持优先级调度和重试机制
- 原子操作（临时文件 + rename）和锁机制（flock）

#### FR-005: 会话生命周期管理
系统必须管理完整的会话生命周期：
- 创建：生成 job-id，初始化工作目录
- 执行：选择 MCP/Exec 后端，启动任务
- 监控：心跳检测、进度追踪、超时控制
- 结束：归档日志、更新状态、清理资源

#### FR-006: 事件日志采集
系统必须统一采集和归档事件日志：
- MCP 模式：JSON-RPC Notification → events.jsonl
- Exec 模式：--json 输出 → events.jsonl
- 元数据：backend、flags、start/end时间、退出码、conversationId
- 产物规范：stdout.log、events.jsonl、.meta.json、.instructions.md

#### FR-007: 策略与安全控制
系统必须实现安全策略控制：
- 默认不启用 --yolo
- MCP 工具入参：approval-policy (on-request/on-failure/never)
- 沙箱策略：workspace-write / read-only / 容器全权限
- 网络默认禁用，白名单显式开启
- 审批流程：ElicitRequest → ExecApprovalResponse

#### FR-008: 取消与超时机制
系统必须支持任务取消和超时控制：
- MCP 模式：发送 CancelledNotification → Interrupt
- Exec 模式：软超时（SIGTERM）→ 硬超时（SIGKILL）
- 全局超时：10-20分钟可配置
- 工具超时：tool_timeout_sec 配置

#### FR-009: 并发控制与背压
系统必须实现并发控制和队列背压：
- MCP 模式：单进程多路复用，father 层统一调度
- Exec 模式：固定工作器池（按核数）
- 全局并发限制（配额管理）
- 队列积压时拒绝新请求或降级处理

#### FR-010: 观测与调试
系统必须提供观测和调试能力：
- 日志级别：RUST_LOG 控制 tracing 输出
- 健康检查：liveness、进程状态、队列深度
- 性能指标：任务耗时、资源占用、成功率
- 调试工具：沙箱验证 `codex debug seatbelt|landlock`

---

### 关键实体

#### JobSpec（任务规格）
任务提交的输入参数：
- prompt: 任务提示词
- model: 使用的模型（如 "o3"）
- profile: 配置档案
- cwd: 工作目录
- approval-policy: 审批策略
- sandbox: 沙箱策略
- config: 额外配置
- attachments: 附件文件

#### Backend（执行后端）
任务执行的后端类型：
- mcp: 使用 codex-mcp（常驻进程，多会话）
- exec: 使用 codex exec（独立进程，可恢复）

#### Session（会话）
任务执行的会话实例：
- jobId: 任务唯一标识
- backend: 执行后端类型
- conversationId: codex 会话ID（MCP模式）
- sessionId: codex 会话ID（Exec模式）
- status: 会话状态
- workdir: 工作目录路径
- startedAt / endedAt: 时间戳
- exitCode: 退出码

#### TaskQueue（任务队列）
基于文件系统的队列：
- pending/: 待执行任务
- running/: 执行中任务
- completed/: 成功任务
- failed/: 失败任务
- 锁机制：flock 防并发冲突

#### EventLog（事件日志）
任务执行的事件记录：
- events.jsonl: JSONL 格式事件流
- stdout.log: 标准输出
- .meta.json: 元数据
- .instructions.md: 任务说明

---

## 技术架构

### 系统架构图

```
外部工具 (Claude Code, etc.)
    ↓ [MCP Protocol]
┌─────────────────────────────────────┐
│     Codex Father MCP Server         │
│  ┌───────────────────────────────┐  │
│  │   Request Router & Queue      │  │
│  └───────────────────────────────┘  │
│           ↓              ↓           │
│    [MCP Mode]      [Exec Mode]      │
│         ↓              ↓             │
│  ┌─────────────┐  ┌──────────────┐ │
│  │ MCP Client  │  │ Exec Runner  │ │
│  └─────────────┘  └──────────────┘ │
└─────────────────────────────────────┘
         ↓                    ↓
  ┌─────────────┐      ┌──────────────┐
  │ codex mcp   │      │ codex exec   │
  │ (常驻进程)   │      │ (独立进程)    │
  └─────────────┘      └──────────────┘
```

### 目录结构

```
core/
├── mcp/
│   ├── server.ts           # MCP 服务器实现
│   ├── client.ts           # MCP 客户端（连接 codex-mcp）
│   └── protocol.ts         # MCP 协议类型定义
├── exec/
│   ├── runner.ts           # Exec 执行器
│   └── process-manager.ts  # 子进程管理
├── queue/
│   ├── task-queue.ts       # 任务队列
│   ├── scheduler.ts        # 调度器
│   └── file-lock.ts        # 文件锁
├── session/
│   ├── session-manager.ts  # 会话管理
│   ├── lifecycle.ts        # 生命周期
│   └── archiver.ts         # 日志归档
└── types/
    ├── job-spec.ts         # JobSpec 类型
    ├── session.ts          # Session 类型
    └── events.ts           # 事件类型
```

---

## 实施计划概要

### Phase 1: MCP 客户端集成（优先）
1. 实现 MCP 客户端连接 codex-mcp
2. 实现 requestId ↔ conversationId 映射
3. 实现事件流采集和落盘
4. 实现取消机制

### Phase 2: 任务队列系统
1. 基于文件系统实现队列
2. 实现任务调度器
3. 实现并发控制
4. 实现重试机制

### Phase 3: Exec 执行器（备用）
1. 实现 exec 子进程管理
2. 实现 --json 事件解析
3. 实现 resume 支持
4. 实现进程隔离和限制

### Phase 4: MCP 服务器对外
1. 实现标准 MCP 服务器
2. 实现路由逻辑（MCP vs Exec）
3. 实现统一的 tools/call 接口
4. 集成审批流程

### Phase 5: 观测与治理
1. 实现健康检查
2. 实现性能指标采集
3. 实现日志聚合
4. 实现管理界面（可选）

---

## 验收标准

### 基础功能
- [ ] 能够通过 MCP 协议提交 codex 任务
- [ ] MCP 模式下多个任务可并发执行
- [ ] Exec 模式下任务可独立隔离
- [ ] 任务可以取消和超时控制
- [ ] 所有任务事件和日志正确归档

### 性能要求
- [ ] 单 codex-mcp 实例支持 10+ 并发会话
- [ ] 任务提交响应时间 < 100ms
- [ ] 事件日志延迟 < 1s
- [ ] 队列吞吐量 > 100 任务/小时

### 可靠性
- [ ] codex-mcp 崩溃自动重启
- [ ] 任务失败自动重试（可配置）
- [ ] 僵尸进程清理机制
- [ ] 数据不丢失（原子写入）

### 安全性
- [ ] 默认启用沙箱策略
- [ ] 审批流程正常工作
- [ ] 网络访问默认禁用
- [ ] 敏感信息脱敏

---

## Review Checklist

- [x] 需求明确且可测试
- [x] 聚焦用户价值（统一治理 codex）
- [x] 技术方案清晰（MCP + Exec 双模式）
- [x] 与现有系统兼容（复用 sessions 目录）
- [x] 安全和性能考虑充分
- [x] 实施路径可行（分阶段）

---

## Execution Status

- [x] 用户需求分析完成
- [x] 核心概念提取
- [x] 架构设计确定
- [x] 功能需求定义
- [x] 数据模型设计
- [x] 实施计划制定
- [ ] 待进入 planning 阶段