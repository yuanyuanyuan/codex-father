# 编排器 (`orchestrator`)

该目录包含用于管理和协调 `codex-father`
核心流程的组件。它负责任务调度、状态管理、资源监控和进程协调。

## 文件结构

- `patch-applier.ts`: 应用代码补丁到工作区。
- `process-orchestrator.ts`: 核心编排器，负责管理整个流程的生命周期。
- `quick-validate.ts`: 提供快速验证功能。
- `resource-monitor.ts`: 监控系统资源使用情况。
- `state-manager.ts`: 管理应用程序的全局状态。
- `sww-coordinator.ts`: 协调 "sandboxed work-within-work" 流程。
- `task-scheduler.ts`: 调度和管理任务执行。
- `types.ts`: 定义了 `orchestrator` 模块中使用的 TypeScript 类型。
- `tests/`: 包含 `orchestrator` 模块的单元测试。
