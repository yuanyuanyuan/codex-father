# MCP v1.6.0

发布日期：2025-10-06

## ✨ 变更摘要

### Features
- 默认禁用系统 fallback，内置 `job.sh` / `start.sh` 及依赖随包自动落地到 `.codex-father/`，缺失时直接报错并提示修复，避免误用系统脚本。
- 启动时自动同步 runtime 资产（`job.d/`、`start.d/`、`lib/`），若检测到手动修改会保留用户版本并输出警告。

### Docs
- 更新环境变量参考、发行说明与 README，强调 `.codex-father` 托管策略与新的错误提示流程。

## ✅ 验证建议
- 在已有 `.codex-father` 副本的项目中升级至 v1.6.0，启动 `codex-mcp-server`，确认控制台提示同步脚本并落地新版本。
- 手动修改 `.codex-father/job.d/00_bootstrap.sh` 后再次启动，验证日志出现“已手动修改的脚本未被覆盖”告警。

## ⏭ 后续
- 评估是否需要为手动修改的脚本提供三路合并或备份策略。

