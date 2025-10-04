# 任务队列系统 (`queue`)

该目录实现了 `codex-father`
的异步任务队列系统。它负责管理任务的生命周期，包括创建、调度、执行和状态跟踪。

## 文件结构

- `api.ts`: 定义了任务队列的公共 API。
- `backup-restore.ts`: 提供了队列的备份和恢复功能。
- `basic-executor.ts`: 一个基本的任务执行器。
- `basic-operations.ts`: 实现了基本的队列操作。
- `config-manager.ts`: 管理队列的配置。
- `config.ts`: 定义了队列的配置类型。
- `errors.ts`: 定义了与队列相关的自定义错误。
- `events.ts`: 定义了队列事件。
- `factory.ts`: 一个用于创建队列实例的工厂。
- `filesystem-queue.ts`: 一个基于文件系统的队列实现。
- `integrity-checker.ts`: 检查队列数据的完整性。
- `monitor.ts`: 监控队列的状态。
- `optimizer.ts`: 优化队列性能。
- `retry-manager.ts`: 管理任务的重试逻辑。
- `scheduler.ts`: 任务调度器。
- `statistics.ts`: 收集和提供队列的统计信息。
- `status-query.ts`: 查询任务和队列的状态。
- `task-definition.ts`: 定义了任务的数据结构。
- `tools.ts`: 提供了与队列相关的工具。
