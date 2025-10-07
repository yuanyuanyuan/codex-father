# Repository Guidelines

## 项目结构与模块组织

- `start.sh`/`start.d/`：组合 CLI 步骤；`start.d/*.sh`
  为分层子任务，加载顺序按数字前缀。
- `job.sh`/`job.d/`：异步作业入口，写入
  `.codex-father/sessions/<run-id>/`；`job.d/*.sh` 管理状态、日志、清理。
- `mcp/codex-mcp-server/`：TypeScript MCP 服务器，源码在 `src/`，测试在
  `tests/`，构建产物输出到 `dist/`。
- `core/` 与 `lib/`：`core/cli` 提供 Node CLI，`lib/` 存放 Bash 公共脚本与预设。
- `docs/`、`specs/`、`tests/`：分别存放文档、设计规范与端到端脚本；生成资产写入
  `.codex-father/` 临时目录。
- `.codex-father/state.json`
  持久化最近一次执行环境（有效沙箱、网络、审批），供 CLI 状态与 metrics 读取。

## 构建、测试与开发命令

- `npm run build`：清理并编译 TypeScript（输出 `dist/`）。
- `npm run typecheck`、`npm run lint:check`：静态检查；提交前建议
  `npm run check:all`。
- `npm run test` 或 `npm run test:coverage`：运行 Vitest 单测与覆盖率。
- `./start.sh --task "demo" --dry-run`：本地验证交互式 CLI。
- `./job.sh start --task "demo" --dry-run --json`：演练异步作业流程并查看结构化状态。
- `npm run mcp:build`：构建 MCP Server；需要时使用 `npm run mcp:dev` 热更新。
- `npm run dev`：监听 `core/cli/start.ts` 入口，快速迭代 CLI 交互逻辑。

## 代码风格与命名约定

- TypeScript 采用 2 空格缩进，遵循 ESLint + Prettier（运行
  `npm run lint`、`npm run format`）。
- Bash 模块固定 `#!/usr/bin/env bash` 与 `set -euo pipefail`，函数放置在
  `lib/common.sh` 或 `lib/*.sh` 中复用。
- 命名遵循 kebab-case 的脚本、lowerCamelCase 的 TS 函数、SCREAMING_SNAKE_CASE 的常量；错误载荷统一
  `{ code, message, hint }`。
- TypeScript 模块优先使用 `@/` 别名导入核心库，Bash 子模块遵循 `NN_name.sh`
  排序以保持加载顺序稳定。

## 测试规范

- 新增功能需具备 Vitest 单测或集成测试，命名 `*.test.ts` 并与源文件同目录或
  `tests/` 下。
- Bash 变更至少通过 `bash -n <file>` 与可选 `shellcheck`；关键路径补充
  `tests/*.sh` 烟雾脚本。
- CI 期望零警告并保持现有覆盖率水平；覆盖率下滑需在 PR 描述中说明原因与补救计划。
- CLI 集成回归可执行 `./job.sh metrics --json` 与
  `./job.sh clean --dry-run --json` 检查结构化字段是否完整。

## Gates 与 Events

- 质量 Gates：在 `core/lib/models/code-quality.ts`
  中定义阈值校验（`metric`、`operator`、`threshold`、`required`）。当
  `required=true` 且校验失败，记录到失败清单并用于摘要输出。
- Stream-JSON 事件（stdout）：与 `docs/schemas/stream-json-event.schema.json`
  一致，包含 `start`、`task_scheduled`、`task_started`、`tool_use`、
  `task_completed`、`task_failed`、`patch_applied`、`patch_failed`、
  `concurrency_reduced`、`concurrency_increased`、`resource_exhausted`、
  `cancel_requested`、`orchestration_completed`、`orchestration_failed`。
- JSONL 审计事件（仅文件）：追加到
  `.codex-father/sessions/<run-id>/events.jsonl`，含过程性审计信息：`understanding_validated`/`understanding_failed`、
  `decomposition_failed`、`manual_intervention_requested`、
  `task_retry_scheduled` 等。它们不进入 stdout 流，亦不改变 stdout 两行约束。
- 事件写入：`core/orchestrator/state-manager.ts` 统一写入 JSONL；CLI 侧
  `core/cli/commands/logs-command.ts` 提供 `logs` 查看能力。
- 最佳实践：
  - 追加式写入，避免覆盖；扩展字段放入 `data`，保留 `eventId`、`timestamp`。
  - 回归查看：`codex-father logs --session <id>` 或用 `jq -c` 读取 JSONL。

### 执行 Gate 顺序

1. 人工干预（Manual Intervention，可配）：
   - 若 `enabled=true & requireAck=true` 且未确认，写入 JSONL
     `manual_intervention_requested` 并终止（随后 `orchestration_failed`）。
   - 认可（ack=true）时继续后续步骤。
2. 理解校验（Understanding Check，可配）：
   - 通过：写入 `understanding_validated`（JSONL）。
   - 失败：写入 `understanding_failed` →
     `orchestration_failed`（JSONL），阻断执行。
3. 任务分解（Task Decomposer）：
   - 失败：写入 `decomposition_failed` →
     `orchestration_failed`（JSONL），阻断调度。

### SWW 事件映射

- SWW 成功：发出 `tool_use`（补丁摘要）与 `patch_applied`（stream-json）。
- SWW 失败：发出 `task_failed{reason=patch_failed}` 与
  `patch_failed`（stream-json）。
- 资源联动：压力上升/下降分别发
  `concurrency_reduced`/`concurrency_increased`（stream-json）。

### Stdout 契约

- CLI `orchestrate` 的 stdout 仅输出两行摘要：`start` 与
  `orchestration_completed` （或
  `orchestration_failed`），其余详细事件写入 JSONL 审计文件。

## 提交与 PR 指南

- 使用 Conventional
  Commits（示例：`feat(job): 增强 metrics 输出`）；中英文皆可但需语义清晰。
- 提交前附带关键命令输出（typecheck、lint、test 或相关脚本）。
- PR 描述需涵盖变更背景、实现要点、测试结果以及对文档/脚本的影响；链接关联 issue，并在涉及 CLI 行为时补充示例或截图。
- 公共行为调整需同步更新 `CHANGELOG.md` 与相关 `docs/`/`specs/`
  章节，确保发布记载与使用指引一致。

## 安全与配置提示

- 默认沙箱为 `workspace-write`，审批策略默认为
  `never`；变更默认行为需在文档与 CLI 提示中同步更新。
- 敏感日志应留在 `.codex-father/sessions/` 并使用 `codex.clean`
  命令维护历史状态；避免将 `.tsbuildinfo*` 或会话产物提交至版本库。
- 配置敏感凭证时使用 `CODEX_` 前缀的环境变量并在 `config/`
  中提供模板文件，禁止硬编码密钥或令牌。
