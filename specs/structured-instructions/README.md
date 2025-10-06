# Structured Instructions Quick Reference

结构化 instructions 采用 JSON/YAML/XML 描述可执行任务，CLI 会在运行前校验
schema、生成归一化 JSON，并通过 `CODEX_STRUCTURED_*` 环境变量传递给 Shell。

## 数据模型

- 顶层字段：`version`、`id`、`objective`、`tasks[]`、`vcs` 等。
- 每个 `task.steps[]` 支持：
  - `run`（字符串、字符串数组、或 `{ shell, script }` 对象）
  - `when` 条件表达式（可引用 `step:<id>.succeeded|failed`）
  - `continueOnError` / `allowExitCodes` / `errorMatchers`
  - `timeoutMs`、`retry`、`artifacts`、`env.set`

完整 Zod 定义请参考 `core/cli/instructions/schema.ts`，工程使用同一份
schema 进行校验。

## CLI 工作流程

1. 执行 `./start.sh --instructions path/to/task.json --task T032`；
2. CLI 调用 `prepareStructuredInstructions`：
   - 校验 schema 与任务 ID；
   - 写入 `.codex-father/instructions/<timestamp>-<id>.json`；
   - 设置 `CODEX_STRUCTURED_*`/`CODEX_STRUCTURED_TASK_ID` 环境变量；
3. `start.sh` 与后续 Shell 模块可使用这些环境变量加载任务并附加额外逻辑。

返回 payload 中的 `data.structuredInstructions` 会携带 source/normalized
路径，便于客户端保存或复用同一任务描述。

## 示例

- [`examples/t032.json`](examples/t032.json)
- [`examples/t032.yaml`](examples/t032.yaml)
- [`examples/t032.xml`](examples/t032.xml)

示例演示了“D1 预览数据库状态/迁移”任务，其中 `write-runbook` 步骤只在
前两步失败时执行并生成故障排查手册。

## 运行指南

```bash
./start.sh --instructions specs/structured-instructions/examples/t032.json --task T032 --dry-run
```

若任务 ID 不存在或文件解析失败，CLI 会在调用 `start.sh` 前直接报错。

## 扩展建议

- 在仓库中维护团队通用的 instructions 仓库，结合版本控制评审任务模板；
- MCP 客户端只需把 `--instructions` 与 `--task` 放进 `args` 数组即可获得
  同步体验；
- Shell 层可读取 `CODEX_STRUCTURED_*` 环境变量以实现高级编排（分支执行、
  参数扩展等）。
