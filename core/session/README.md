# 会话管理器 (`session`)

该目录包含用于管理用户会话和记录事件日志的组件。

## 文件结构

- `config-persister.ts`: 负责持久化会话配置。
- `event-logger.ts`: 提供了一个事件记录器，用于记录会话期间发生的所有事件。
- `session-manager.ts`: 实现了会话管理器，负责创建、跟踪和管理用户会话。
- `tests/`: 包含 `session` 模块的单元测试。
