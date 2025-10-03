# 项目分阶段实施总览（需求与设计索引）

本项目分三阶段推进，以下文档为每阶段的需求与设计说明，均存放于 docs/ 目录：

- 阶段一：非交互模式修复与对齐（CLI/MCP）
  - 需求：docs/requirements-stage1-non-interactive.md
  - 设计：docs/design-stage1-non-interactive.md

- 阶段二：Git 分支与 PR 自动化（CLI/MCP）
  - 需求：docs/requirements-stage2-git-pr-automation.md
  - 设计：docs/design-stage2-git-pr-automation.md

- 阶段三：DevContainer / Docker 集成与写盘类 E2E
  - 需求：docs/requirements-stage3-container-integration.md
  - 设计：docs/design-stage3-container-integration.md

相关现有文档（作为三阶段实施的基础指南，仍需与阶段文档配套阅读）：

- 非交互模式指南：docs/codex-non-interactive.md（阶段一对齐行为的权威定义，描述三类沙箱模式与 YOLO 限制）
- 使用说明：docs/usage.md（所有阶段的 CLI/MCP 通用用法与产物结构，应保持与实现同步）
- DevContainer /
  Docker：docs/devcontainer.md（阶段三容器方案与脚本说明，指导在隔离环境中运行写盘类 E2E）
