# 进程管理器 (`process`)

该目录包含用于管理 `codex-father` 的子进程（特别是 Codex CLI）的生命周期的代码。

## 文件结构

- `manager.ts`: 实现了进程管理器，负责启动、停止和监控子进程。
- `tests/`: 包含 `process` 模块的单元测试。
