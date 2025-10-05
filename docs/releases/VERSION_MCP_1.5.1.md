# MCP v1.5.1

发布日期：2025-10-06

## 🛠 变更摘要

### Bug Fixes

- 内置 runtime 安装器会在包版本变更或脚本缺失时刷新 `.codex-father` 下的
  `job.sh` / `start.sh` 及依赖，避免继续使用旧副本。

### Docs

- 更新环境变量参考与发行说明，记录自动落地脚本策略以及缺失时的显式报错提示。

## ✅ 验证建议

- 在已有 `.codex-father/job.sh` 副本的项目中升级至 v1.5.1，启动
  `codex-mcp-server`，确认控制台提示已同步新脚本，且 `job.sh` / `start.sh`
  文件时间戳刷新。
- 手动修改 `.codex-father/job.d/00_bootstrap.sh`
  再次启动，验证日志出现“已手动修改的脚本未被覆盖”警告。

## ⏭ 后续

- 评估是否需要为手动修改的脚本提供三路合并或备份策略。
