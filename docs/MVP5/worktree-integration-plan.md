# Git Worktree 功能集成方案（codex-father）

> 目标：在不引入 UI 的前提下，为 codex-father 提供一套安全、可测试、可编排的 git
> worktree 能力，用于隔离多任务/多特性开发与运行环境，并与现有队列、会话与审计体系良好对接。

## 1. 背景与目标

- 背景
  - 项目在 `docs/MVP4/prd.draft.md:8` 已明确“使用 git
    worktree 管理不同任务的文件变更”。
  - 现有工程重心是 CLI + 队列 + MCP/会话编排；暂无 UI 需求。
- 目标
  - 提供一套面向 CLI 的 worktree 管理能力：列举、创建、从远端分支派生、归档/移除、状态快速刷新、分支查询、会话附着。
  - 安全默认值：工作区可写（workspace-write）、干跑（--dry-run）优先、单写者窗口（SWW）、两阶段写入 + 快速验证（quick
    validate）。
  - 稳定的 CLI 合同与结构化 JSON 输出，便于 E2E 与上层编排（队列/自动化脚本）。
- 非目标
  - 不构建 UI（React/Provider 等）。
  - 不引入额外第三方依赖（除非必要），优先 Node 内置 + git 原生命令。

## 2. 架构设计

### 2.1 模块结构

- `core/worktree/worktree-service.ts`
  - 纯服务层，封装对 `git` 命令的调用与输出解析。
  - 提供只读查询与写操作（写操作均走两阶段写入 + 校验）。
- `core/worktree/worktree-store.ts`
  - 轻量外部状态容器（可选）：`get()/subscribe()`，便于之后与事件流对接。
  - 当前阶段可不强依赖，无 UI 时以服务直接返回为主。
- `core/cli/commands/worktree-command.ts`
  - 命令注册与参数解析（复用 `core/cli/parser.ts` 契约）。
  - 统一人类可读与 `--json` 输出，承接 `--dry-run/--cwd/--log-level`。
- 轻量持久化
  - `.codex-father/worktrees.json`：记录 feature →
    path、project 列表、创建/归档时间戳、可选工具偏好。
  - `.codex-father/worktree.lock`：互斥文件，确保单写者窗口（SWW）。

### 2.2 关键原则（与项目指南对齐）

- 安全默认值与审计
  - 与 orchestrator 的安全默认值一致（参考 specs/006-\*）：默认 sandbox 为
    `workspace-write`，审批 `on-request`。
  - 写操作：两阶段写入（先生成计划/补丁，再应用）+ 快速验证；无法验证则回滚并标记失败。
  - 日志与审计：关键写入在 `.codex-father/queue/logs/` 复用队列日志或独立
    `worktree-*.log`。
- 依赖最小化
  - 使用 `child_process` 执行 `git`；避免新依赖（DRY/YAGNI）。
- KISS/DRY/SOLID
  - Service 单一职责；CLI 仅做参数与输出适配；策略（排序/提示）拆分为纯函数便于复用与测试。

## 3. 数据模型

- `WorktreeInfo`
  - `feature: string`、`project: string`、`path: string`、`isWorkspace?: boolean`、`lastCommitTs?: number`。
- `BranchInfo`
  - `name: string`、`ahead: number`、`behind: number`、`commit: string`。
- `Result<T>`
  - 成功：`{ success: true; data: T }`
  - 失败：`{ success: false; error: string; code?: string }`
- 稳定排序策略（用于 list/status）
  - 先按 `lastCommitTs` 降序，其次 `project`、最后 `feature`
    升序（与 UI 版思路一致，便于对比/可测试）。

## 4. CLI 合同（contracts）

命令均挂载在 `worktree`
子命令下，继承全局选项：`--cwd`、`--dry-run`、`--json`、`--verbose`、`--log-level`。

- `codex-father worktree list [--limit <N>] [--offset <K>] [--json]`
  - 描述：列举本地 worktree（解析 `git worktree list --porcelain`），稳定排序。
  - 输出（json）：`{ total, items: WorktreeInfo[] }`。
- `codex-father worktree branches --project <path> [--remote <name>] [--json]`
  - 描述：列远端分支（基于 `git ls-remote` 或 `git for-each-ref`）。
  - 输出（json）：`{ remote, branches: BranchInfo[] }`。
- `codex-father worktree status [--recent <N>]`
  - 描述：快速刷新最近 N 个工作树的状态（提交时间、分支游标等）。
  - 输出：人类可读或
    `{ items: Array<{ path; branch; lastCommitTs; clean: boolean }> }`。
- `codex-father worktree create --feature <name> --project <path> [--branch <remote/branch>] [--dir <baseDir>] [--dry-run]`
  - 描述：从当前 HEAD 或指定远端分支派生工作树到 `<baseDir>/<feature>`。
  - 写策略：
    1. 生成执行计划（待执行 git 命令与目标路径检查）
    2. 执行 `git worktree add` 等命令
    3. 快速验证：`git rev-parse`、路径存在、HEAD/branch 对齐
    4. 写入/更新 `.codex-father/worktrees.json`
  - 输出（json）：`{ success, path, created: true }`；`--dry-run` 时
    `created: false` 且返回计划。
- `codex-father worktree archive --feature <name> [--dest <archiveDir>] [--keep] [--dry-run]`
  - 描述：将对应工作树目录移动至归档目录（默认
    `.codex-father/archives/<name>-<ts>`）；`--keep`
    表示仅移动目录与元数据，保留 git worktree 引用（否则执行
    `git worktree remove`）。
  - 写策略：移动/移除 → 验证 → 更新元数据；失败回滚。
  - 输出（json）：`{ success, archivedPath }`。
- `codex-father worktree attach-session --feature <name> [--tool <codex|none>] [--json]`
  - 描述：基于该 worktree 路径启动/附着 codex 会话（复用现有 session/queue 设施）。
  - 输出：`{ status: 'success' | 'no_config' | 'not_found', conversationId? }`。

错误码建议：

- `WT_NOT_FOUND`、`WT_EXISTS`、`WT_LOCKED`、`WT_INVALID_BRANCH`、`WT_VALIDATE_FAILED`、`WT_ARCHIVE_FAILED`。

## 5. WorktreeService 能力清单

- 查询类
  - `list(): Promise<WorktreeInfo[]>`
  - `getRemoteBranches(projectPath: string, remote = 'origin'): Promise<BranchInfo[]>`
  - `quickStatus(paths: string[], limit?: number): Promise<Array<{ path; branch; lastCommitTs; clean: boolean }>>`
- 写入类（两阶段 + 校验 + 锁）
  - `createFeature(projectPath: string, featureName: string, opts?: { baseDir?: string }): Promise<Result<{ path: string }>>`
  - `createFromBranch(projectPath: string, remoteBranch: string, featureName: string, opts?: { baseDir?: string }): Promise<Result<{ path: string }>>`
  - `archiveFeature(featureName: string, opts?: { destDir?: string; keep?: boolean }): Promise<Result<{ archivedPath: string }>>`
- 工具/策略（纯函数）
  - `sortWorktrees(items: WorktreeInfo[]): WorktreeInfo[]`
  - `shouldPromptForTool(available: string[], sessionExists: boolean, worktreeTool?: 'codex' | 'none' | null): boolean`

实现要点：

- 解析 `git worktree list --porcelain`，按段聚合 path/branch 等字段。
- 远端分支：优先 `git for-each-ref --format=... refs/remotes/<remote>/`，必要时
  `git ls-remote --heads`。
- 快速验证：`git -C <path> rev-parse --abbrev-ref HEAD`，`git -C <path> status --porcelain`
  解析是否 clean。

## 6. 安全与合规

- 单写者窗口（SWW）
  - 获取
    `.codex-father/worktree.lock`（包含持锁 PID/时间戳）；持锁超时可提示手动清理或强制夺锁（默认不自动夺锁）。
- 两阶段写入 + 快速验证
  - Phase 1（规划）：生成将执行的命令与变更（可在 `--dry-run` 下输出）。
  - Phase 2（应用）：串行执行命令；若任一步失败，停止并回滚（能回滚的操作）。
  - Quick
    Validate：路径存在、分支/HEAD 校验、git 输出检查；缺工具则标记失败而非继续。
- 审批策略与 Sandbox
  - 继承全局 `--approvals on-request` 与
    `--sandbox workspace-write`；危险操作（删除目录、强制移除 worktree）应请求明确确认或仅在
    `--json --force` 下继续。
- 工程规范
  - 不引入新依赖；路径处理用 `path`
    模块，跨平台分隔符兼容；stderr 打印错误信息。

## 7. 文件与目录约定

- 代码
  - `core/worktree/worktree-service.ts`、`core/worktree/worktree-store.ts`
  - `core/cli/commands/worktree-command.ts`
- 产物
  - `.codex-father/worktrees.json`：工作树元数据（非必需，首版可仅依赖 git 实况，随后增量引入）。
  - `.codex-father/worktree.lock`：互斥锁文件。
  - `logs/worktree-*.log`（或复用队列日志）。

## 8. 实现计划（分阶段）

- Phase 1：只读能力（低风险上线）
  - 实现 `list/branches/status --recent`，解析/排序/结构化输出。
  - 单测覆盖解析与排序、空仓库/裸仓库边界。
- Phase 2：创建/归档（写路径 + 锁）
  - `create/archvie`，实现锁、两阶段写入、快速验证、`--dry-run`。
  - 元数据文件 `worktrees.json` 与基础回滚策略。
- Phase 3：会话对接
  - `attach-session` 调用现有 session/queue，`cwd` 指向 worktree 路径。
  - 返回联合字面量结果：`success | no_config | not_found`。
- Phase 4：测试与文档
  - CLI 合同测试、事件/日志写入验证、失败路径与回滚单测。
  - 简要 Quickstart 与常见问题（FAQ）。
- Phase 5：工作空间（可选）
  - 引入 `isWorkspace` 概念，支持多项目聚合与批量归档/刷新。

## 9. 测试计划

- 单元测试
  - 解析器：`git worktree list --porcelain` 模拟输出 → `WorktreeInfo[]`。
  - 排序/提示策略：边界（相同时间戳、缺 `lastCommitTs`）。
  - 快速验证：clean/dirty 状态、HEAD 分支不一致。
- 合同测试（CLI）
  - `list/branches/status/create/archive/attach-session` 在 `--json`
    下的字段契约。
- E2E（可选）
  - 在临时仓库初始化分支/远端（使用本地裸仓库）→ 全链路运行。

## 10. 兼容性与性能

- 兼容性
  - 仅依赖 git 与 Node.js（>=18）；Windows/macOS/Linux 支持。
- 性能
  - 查询类命令 O(工作树数量)；`status --recent N` 控制扫描规模。
  - 写操作串行、短命令，快速验证只做必要检查。

## 11. 风险与缓解

- 风险：`git worktree remove` 误删
  - 缓解：默认归档移动；非强制删除；需要显式 `--force` 才真正移除。
- 风险：并发写入引发状态错乱
  - 缓解：互斥锁 + 单写者窗口；失败即退出，不忙等。
- 风险：远端状态不可用
  - 缓解：网络访问失败时回退到本地 refs；友好错误信息与重试建议。

## 12. 与现有系统的对接点

- CLI 注册与输出
  - 复用 `core/cli/parser.ts` 注册模型与输出风格；遵守
    `--json/--verbose/--dry-run` 语义。
- 队列/审计与事件
  - 可将写操作封装为队列任务，产生日志在 `.codex-father/queue/logs/`。
  - 重要写操作输出事件，格式对齐
    `docs/schemas/stream-json-event.schema.json`（后续迭代）。
- 依赖对齐
  - 若引入 `uuid`，需在 `package.json` 声明（参考 Feature 006 要求）。首版可使用
    `crypto.randomUUID()`。

## 13. Quickstart（示例）

```bash
# 列举（JSON 输出）
codex-father worktree list --json --limit 20

# 查看远端分支
codex-father worktree branches --project ./repoA --remote origin --json

# 创建 feature 工作树（演练）
codex-father worktree create --feature feat-xyz --project ./repoA --branch origin/feature/xyz --dry-run

# 实际创建
codex-father worktree create --feature feat-xyz --project ./repoA --branch origin/feature/xyz

# 归档（移动到 .codex-father/archives）
codex-father worktree archive --feature feat-xyz

# 附着会话
codex-father worktree attach-session --feature feat-xyz --tool codex --json
```

---

附录 A：Git 命令备忘

- `git worktree list --porcelain`
- `git worktree add <path> <branch|commit>`
- `git worktree remove <path>`
- `git -C <path> rev-parse --abbrev-ref HEAD`
- `git -C <path> status --porcelain`
- `git for-each-ref --format=... refs/remotes/<remote>/`

附录 B：错误码示例

- `WT_NOT_FOUND`、`WT_EXISTS`、`WT_LOCKED`、`WT_INVALID_BRANCH`、`WT_VALIDATE_FAILED`、`WT_ARCHIVE_FAILED`

附录 C：返回契约片段

- `attach-session`：`{ status: 'success' | 'no_config' | 'not_found', conversationId?: string }`
- `create`：`{ success: boolean, path?: string, plan?: string[] }`
- `list`：`{ total: number, items: WorktreeInfo[] }`

> 本方案遵循 KISS/DRY/YAGNI 与单一职责原则：复杂性下沉到 Service；CLI 仅做合同与输出；写操作统一走 SWW + 快速验证，保证安全与可审计。
