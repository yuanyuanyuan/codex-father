# 共享库 (`lib`)

该目录是 `src` 模块的共享库，提供了用于产品需求文档 (PRD) 和其他 `src`
模块功能的通用功能。

## 文件结构

- `configSchema.ts`: 定义了配置的 schema。
- `configValidator.ts`: 提供了配置验证功能。
- `degradationStrategy.ts`: 实现了服务降级策略。
- `errorFormatter.ts`: 格式化错误输出。
- `file-manager.ts`: 管理文件操作。
- `index.ts`: 模块的主入口点。
- `markdown-parser.ts`: 解析 Markdown 文件。
- `modelWireApiMapping.ts`: 实现了模型和 API 之间的数据映射。
- `parameterMapping.ts`: 实现了参数映射。
- `profileManager.ts`: 管理用户配置文件。
- `utils.ts`: 提供了一系列通用工具函数。
- `versionDetector.ts`: 检测版本信息。
