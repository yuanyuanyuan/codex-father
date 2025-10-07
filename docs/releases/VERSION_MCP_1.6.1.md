# Codex Father MCP v1.6.1

Date: 2025-10-07

本版本聚焦于“被动通知”的可靠性与可观测性改进，修复早期错误/超限场景下状态不落盘或误判的问题，并完善文档与 `codex.help` 提示。

## ✨ 重点改进

- 稳定会话状态写入：
  - 异步启动前即写入初始 `state.json`（`state=running`），避免早退时目录缺失导致状态无法更新。
  - 失败/停止 Trap 在缺失 `state.json` 时会自建骨架再落盘，确保任何异常都有状态可读。
- 退出码识别更稳健：
  - Trap 总是追加独立行 `Exit Code: <N>`，状态归纳器无需依赖上下文即可解析退出码。
- 明确的状态/分类语义：
  - 停止（SIGTERM/SIGKILL）场景强制归类 `classification=user_cancelled`。
  - 参数/用法错误统一归类 `input_error`（优先于网络/工具错误）。
  - 上下文超限统一归类 `context_overflow`（日志包含 `[input-check]` 提示）。
- 预设严格校验：
  - `--preset` 仅允许 `sprint|analysis|secure|fast`，未知预设直接失败并提示修正（`input_error`）。
- 文档与帮助：
  - README 与故障排除新增“输入体积预检”“预设严格校验”“状态/分类语义（便于被动通知）”。
  - `codex.help` 增加上下文超限与预设校验相关的避坑提示。

## 🧪 验证要点（建议脚本）

```bash
# 未知预设 → failed + input_error
./job.sh start --task "demo" --preset default --tag t-unknown --json

# 上下文超限 → failed + context_overflow
yes A | head -c 220000 > .codex-father/testdata/big.md
./job.sh start --task ctx --docs .codex-father/testdata/big.md --tag t-overflow --json

# 正常完成（dry-run）→ completed + normal
./job.sh start --tag t-dry --preset analysis --dry-run --task noop --json

# 停止场景 → stopped + user_cancelled
jid=$(./job.sh start --task noop --tag t-stop --json | jq -r .jobId)
./job.sh stop "$jid" --json
```

## 🔄 升级指南

无需额外操作；升级后即可获得更稳定的状态落盘与更精确的分类。建议调用方：

- 仅基于 `state`（`completed/failed/stopped`）与 `classification` 触发被动通知；
- 对“监听/汇总”类任务，尽量传 `state.json + aggregate.txt` 或 `*.last.txt` 摘要，避免整份 `job.log` 导致超限。

## 📚 相关文档

- [RELEASE_NOTES.md](RELEASE_NOTES.md)
- README 增补（输入体积预检/预设校验/状态语义）
- docs/user/troubleshooting.md 新增“被动通知未收到”章节

