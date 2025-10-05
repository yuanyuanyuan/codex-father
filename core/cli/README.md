# CLI (`cli`)

该目录包含了 `codex-father` 命令行界面（CLI）的实现。它使用了 `commander.js`
库来解析参数、定义命令和处理用户输入。

## 目录结构

- `commands/`: 定义了所有可用的 CLI 命令。
- `handlers/`: 包含了命令的具体处理逻辑。
- `tests/`: 包含了 CLI 相关的测试。
- `config-loader.ts`: 负责加载和解析 CLI 的配置。
- `error-boundary.ts`: 提供了一个错误边界，用于捕获和处理 CLI 中的异常。
- `legacy-compatibility.ts`: 包含了用于兼容旧版 CLI 的代码。
- `logger-setup.ts`: 负责初始化和配置日志记录器。
- `parser.ts`: 实现了 CLI 的参数解析器。
- `queue-cli-bridge.ts`: 在 CLI 和任务队列之间提供了一个桥接层。
- `scripts.ts`: 包含了一些辅助脚本。
- `start.ts`: CLI 的主入口点。
