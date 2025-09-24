# AGENTS 指南（codex-command 目录）

本文件约束与指导 codex-command 目录的自动化/半自动化改造与使用。其作用域覆盖 `codex-command/` 目录及其子目录。

目标与背景：`codex-command/start.sh` 是一个围绕 Codex CLI 的“指令编排与运行胶水脚本”，提供文本/文件聚合、迭代运行、日志与元数据记录、敏感信息脱敏、以及对 Codex CLI 的安全透传参数。请保持其为“薄封装、可复盘、默认安全”。

## 1. 设计约束（必须遵守）
- 薄封装原则：不得引入复杂运行时或非必要依赖（仅依赖 Bash、核心 GNU 工具、git）。
- 默认安全：
  - 保持 `set -euo pipefail` 与严格错误处理；
  - `--redact` 与默认脱敏模式应工作可靠，不得回退或降低覆盖面；
  - 对 Codex CLI 的危险直通选项（如 `--dangerously-bypass-approvals-and-sandbox`）必须在 README 中高亮风险，默认不启用。
- 稳定产物：以下产物命名与语义不可破坏（如需修改，先更新 README 并在 PR 说明风险）：
  - 日志：`codex-command/logs/.../codex-*.log`
  - 指令快照：`*.instructions.md` 与分轮次 `*.r<N>.instructions.md`
  - 末条消息：`*.r<N>.last.txt`
  - 运行元数据：`*.meta.json` 与分轮次 `*.r<N>.meta.json`
  - 根部汇总：`codex_run_recording.txt`、`codex_run_recording.jsonl`
- 指令分段标记保持一致：`<instructions-section type=...>` 包含 `base|file|text|prepend-*|append-*|policy-note` 等，不得随意更名，以便后续工具解析。
- STDIN 约束：命令行中 `'-'` 仅允许出现一次（`-f` 或 `-F` 之一）；保持现有检测与报错语义。
- 目录作用域：本目录与“关键词检索 + 数据插件”路径相互独立；任何改动不得影响 `schemas/`、`keywords/`、`packages/spec-cli/` 的数据契约与输出格式。

## 2. 代码风格与结构
- 语言：Bash（>= 5）；保持文件头 `#!/bin/bash` 或 `#!/usr/bin/env bash` 一致性。
- 顶部开关：保留 `set -euo pipefail`；错误信息一律输出到 stderr。
- 模块化：
  - 公共函数放在 `lib/common.sh`；预设策略放在 `lib/presets.sh`；避免在 `start.sh` 内重复实现。
  - 如需新增功能，优先增量扩展现有函数；新增函数需有清晰职责与前后条件。
- 可移植性：避免非必要的 GNU-only 特性；当前脚本使用 `sed -E`、`grep -E`、`awk`、`tee`、`compgen -G` 等，新增命令需评估在主流 Linux/macOS 的可用性。
- 消息与用法：保持中文帮助文案与现有语气；调整/新增参数时同步更新 `usage()` 与 README。

## 3. 日志与脱敏
- 默认日志目录：`codex-command/logs`；支持通过 `--log-dir` 与 `--log-file` 覆写。
- 标签与分层：`--tag` 与 `--log-subdirs/--flat-logs` 需保持语义与路径稳定，便于批量检索。
- 指令回显：`--echo-instructions/--no-echo-instructions` 与 `--echo-limit` 必须按预期工作；避免大体量日志失控。
- 脱敏：
  - 默认正则集合见 `start.sh` 中 `REDACT_PATTERNS_DEFAULT`；可通过 `--redact` 启用、`--redact-pattern` 追加模式。
  - 任何改动需确保不出现“误脱敏导致上下文失真”或“欠脱敏导致泄露”。

## 4. 迭代运行与退出分类
- 迭代控制：`--repeat-until`、`--max-runs`、`--sleep-seconds`、`--no-carry-context`、`--no-compress-context`、`--context-head`、`--context-grep` 行为不可破坏；预设 `sprint|analysis|secure|fast` 通过 `lib/presets.sh` 维护。
- 历史上下文压缩：默认启用关键行抽取；仅在明确需要时才放宽或关闭。
- 退出分类：`classify_exit()` 的分类字符串（如 `done|continue|context_overflow|approval_required|sandbox_denied|network_error|auth_error|rate_limited|tool_error|error|normal`）为后续分析脚本的依赖，不得更名或删除。

## 5. 与 Codex CLI 的参数透传
- 支持的直通项包括：`--sandbox`、`--approvals`、`--profile`、`--full-auto`、`--dangerously-bypass-approvals-and-sandbox`、`--config`（以 `--codex-config` 暴露）、`--codex-arg`。
- 新增直通项需评估安全性与兼容性，并更新 README 的“直通参数”章节。

## 6. 测试与验证（建议）
- 快速验证：
  - `./codex-command/start.sh --help`
  - `./codex-command/start.sh --task "hello" --dry-run`
  - `echo "inline" | ./codex-command/start.sh -F - --task "ok" --dry-run`
  - `./codex-command/start.sh --preset sprint --task "ok" --dry-run`
- 行为检查：
  - STDIN 仅一次；`-f`/`--docs` 通配符展开；
  - 日志、指令快照、元数据文件按预期落盘；
  - `--redact` 生效且不破坏语义；
  - 退出分类写入 `*.meta.json` 与根部 `*.jsonl`。
- 质量工具：推荐本地运行 `shellcheck`（如可用）；保持无新告警或合理抑制说明。

## 7. PR 自检清单（codex-command 专用）
- [ ] 是否引入了非必要依赖或破坏默认产物命名？
- [ ] 新/改参数是否同步更新了 `usage()` 与 README？
- [ ] 日志与指令分段标记是否保持兼容？
- [ ] 脱敏规则是否更稳健且可配置？
- [ ] 本地通过 `--dry-run` 与常见路径验收？
- [ ] 未影响仓库“关键词检索 + 数据插件”的数据契约与 CLI 输出？

如与明确用户指令冲突，以用户指令优先并在 PR 说明中标注差异与风险。

