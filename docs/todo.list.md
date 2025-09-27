不要作为项目内容！！

记录一下想法:

将当前仓库合并其他仓库的能力,并且补充deep wiki的功能

另外一个spec的mcp 仓库就可以在里面增加一个功能,集成deepwiki来生成最佳的spec,随时生成即可, 






现在我的目标是需要有查询参考代码仓库的能力,所以我




1. 使用mcp工具deepwiki 来随时查询https://github.com/modelcontextprotocol/typescript-sdk 的内容,将当前仓库的MCP server部分进行改造,改造成使用typescript-sdk来完成MCP server开发,并发布npm 服务器.


```
{
	"servers": {
		"sequentialthinking": {
			"command": "npx",
			"args": [
				"-y",
				"@modelcontextprotocol/server-sequential-thinking"
			],
			"type": "stdio"
		},
		"deepwiki": {
			"url": "https://mcp.deepwiki.com/sse",
			"type": "http"
		},
	},
	"inputs": []
}
```


















```

### agency-ai-solutions/openai-codex-mcp
该仓库用 JSON-RPC 封装 OpenAI Codex CLI，提供 write_code、explain_code、debug_code 等专用方法与模型选择，降低提示工程复杂度并直连 Claude Code。内置一键脚本与 Claude CLI/界面两种注册方式，便于本地起服与工具接入。[2]

- 需要“任务导向”方法（写代码/解释/调试）以减少自定义 prompt 的团队协作场景。[2]
- 在 Claude Code 内按需切换 o 系列与 GPT 系列模型完成不同难度任务。[2]
- 偏好 Python 环境、以本地服务暴露 JSON-RPC 的内网集成方案。[2]

### tomascupr/codexMCP
以 FastMCP 封装 Codex CLI，提供流式输出、按调用拉起 CLI 的后端与精简工具集（code_generate/review_code/describe_codebase），并支持模板化与迭代反馈回路。在找不到 CLI 时自动回退至 OpenAI API，支持缓存、重试与可配置默认模型等工程特性。[3]

- 需要实时 token 流回显与稳定集成（每次调用独立进程）的开发环境。[3]
- 面向代码生成、代码评审和代码解释三大高频任务的统一 API 接入。[3]
- 需要模板驱动生成与迭代式优化，以适配团队规范与产线需求。[3]
- 无法安装 CLI 时以 OpenAI SDK 回退维持可用性的韧性部署。[3]

### kky42/codex-as-mcp
将 Codex CLI 转换为 MCP，提供安全模式（只读）与可写模式切换，要求 Codex CLI ≥ v0.25.0 以启用 --sandbox，支持用 uvx 一键运行与通过 Claude CLI 快速添加。提供 codex_execute 与 codex_review 两个核心工具，并采用顺序执行保证安全与一致性。[4]

- 在 Claude Code、Cursor 等 IDE/代理中快速启用 Codex，且需要权限分级（只读/可写）控制。[4]
- 要求 CLI 沙箱与顺序执行以降低并发副作用和环境风险的团队规范场景。[4]
- 偏好零配置命令行拉起（uvx）与通过 .mcp.json 或 claude mcp add 的脚手架化集成。[4]

### ymichael/open-codex
为 OpenAI Codex CLI 的社区分支，强化多提供商支持（OpenAI、Gemini、OpenRouter、Ollama、xAI），面向终端内的“聊天驱动开发”并提供安全沙箱、审批模式与 CI 非交互运行。强调零配置上手、项目文档合并、可选全自动/半自动写改与跨平台沙箱策略说明。[5]

- 偏好纯 CLI 工作流，需在终端内读写/运行代码并与版本控制结合的开发者体验。[5]
- 需要在多模型/多提供商间切换以平衡智能、成本与可用性的场景。[5]
- 在 CI/CD 中以安静模式与非交互方式批处理重构、测试或文档更新任务。[5]

### 选型建议
需要 Claude Code 内任务化方法与最少 prompt 负担选 agency-ai-solutions/openai-codex-mcp；追求工程可观测性（流式、缓存、回退、模板）的服务化集成选 tomascupr/codexMCP；看重权限/沙箱与一键启用则选 kky42/codex-as-mcp；若以命令行为主并需多提供商与 CI 适配，则选 open-codex。[2][4][5][3]


```