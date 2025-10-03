# OpenAI Codex 研究索引（Code Map）

本文档索引并梳理 `refer-research/openai-codex` 的代码与文档结构，提供代码地图、目录树与架构关系图，便于后续检索、学习与维护。

## 快速导航
- 项目总览：`refer-research/openai-codex/README.md`
- Rust 实现概览：`refer-research/openai-codex/codex-rs/README.md`
- 关键文档目录：`refer-research/openai-codex/docs`
- Node/包装入口：`refer-research/openai-codex/codex-cli/bin/codex.js`

## 顶层目录结构（简要）
```
openai-codex/
├─ README.md                 # 项目说明与文档入口
├─ AGENTS.md                 # Agent 协作/贡献与测试约定（Rust 侧重要）
├─ docs/                     # 官方文档集合（配置/认证/沙箱/FAQ/高级）
├─ codex-cli/                # Node 包装层（统一入口，分发平台二进制）
│  ├─ bin/codex.js           # Node 入口，分发到平台二进制 codex
│  └─ vendor/                # 平台二进制与 PATH 扩展（发布时存在）
├─ codex-rs/                 # Rust 工作区（核心实现）
│  ├─ Cargo.toml             # 工作区成员与依赖集合
│  ├─ cli/                   # 多子命令 CLI（统一入口：codex）
│  ├─ tui/                   # 全屏 TUI 交互界面
│  ├─ exec/                  # 非交互/自动化执行（codex exec）
│  ├─ core/                  # 业务核心（协议/任务/策略/模板等）
│  ├─ login/                 # 登录/鉴权能力
│  ├─ linux-sandbox/         # Linux 沙箱（Landlock/seccomp）
│  ├─ execpolicy/            # 执行策略/权限模型
│  ├─ file-search/           # 工作区文件搜索
│  ├─ apply-patch/           # 打补丁/差异应用
│  ├─ git-tooling/           # Git 工具集
│  ├─ mcp-client/            # MCP 客户端实现
│  ├─ mcp-server/            # MCP 服务端（实验）
│  ├─ mcp-types/             # MCP 协议类型/Schema
│  ├─ protocol/              # Codex 自身协议定义
│  ├─ protocol-ts/           # 协议到 TS 相关支持
│  ├─ chatgpt/               # ChatGPT 侧集成
│  ├─ ollama/                # 本地 LLM（Ollama）支持
│  ├─ ansi-escape/           # TUI ANSI 转义相关
│  └─ utils/readiness/       # 就绪探针/健康检查
└─ .github/                  # CI/发布相关
```

## 文档索引（docs/）
- 入门与安装
  - getting-started.md：快速开始、示例用法、配置引导
  - install.md：系统要求、构建与安装
- 配置与账号
  - config.md：完整 `~/.codex/config.toml` 配置项
  - authentication.md：登录方式（ChatGPT 计划或 API Key）与迁移
  - prompts.md：提示词/输入相关
- 安全与沙箱
  - sandbox.md：Codex 沙箱与审批机制
  - platform-sandboxing.md：平台层沙箱说明
  - zdr.md：Zero Data Retention 说明
- 高级与贡献
  - advanced.md：非交互/CI、追踪、MCP 客户端/服务端
  - contributing.md：贡献指南
  - release_management.md：发布管理
  - open-source-fund.md：开源基金

## 内部文档索引（docs/ 与 codex-rs/docs/）
- openai-codex/docs
  - `refer-research/openai-codex/docs/getting-started.md`：入门、CLI 用法与示例
  - `refer-research/openai-codex/docs/install.md`：安装与构建、系统要求
  - `refer-research/openai-codex/docs/config.md`：配置项与优先级、`-c key=value`
  - `refer-research/openai-codex/docs/authentication.md`：认证；ChatGPT 登录与 API Key 方案
  - `refer-research/openai-codex/docs/sandbox.md`：沙箱与审批模式
  - `refer-research/openai-codex/docs/platform-sandboxing.md`：各平台沙箱机制（Seatbelt、Landlock/seccomp）
  - `refer-research/openai-codex/docs/advanced.md`：非交互/CI、Tracing/Verbose、MCP
  - `refer-research/openai-codex/docs/prompts.md`：自定义提示存放与使用
  - `refer-research/openai-codex/docs/faq.md`：常见问题
  - `refer-research/openai-codex/docs/experimental.md`：实验性说明
  - `refer-research/openai-codex/docs/release_management.md`：发布管理
  - `refer-research/openai-codex/docs/open-source-fund.md`：开源基金计划
  - `refer-research/openai-codex/docs/zdr.md`：ZDR 零数据保留
  - `refer-research/openai-codex/docs/license.md`：License 说明
  - `refer-research/openai-codex/docs/CLA.md`：贡献者许可协议（CLA）

- codex-rs/docs
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md`：[实验] Codex MCP 接口（JSON‑RPC API，`codex mcp`）
  - `refer-research/openai-codex/codex-rs/docs/protocol_v1.md`：协议 v1 概览与术语，对应 core 中协议实现

## 内部文档锚点目录（按主题）
- 认证 Authentication
  - `refer-research/openai-codex/docs/authentication.md:1`（Authentication）
  - `refer-research/openai-codex/docs/authentication.md:3`（Usage-based billing alternative: API key）
  - `refer-research/openai-codex/docs/authentication.md:13`（Migrating to ChatGPT login）
  - `refer-research/openai-codex/docs/authentication.md:21`（Connecting on a "Headless" Machine）
  - `refer-research/openai-codex/docs/authentication.md:25`（Authenticate locally and copy credentials）
  - `refer-research/openai-codex/docs/authentication.md:51`（Connecting through VPS or remote）

- 配置 Config
  - `refer-research/openai-codex/docs/config.md:1`（Config）
  - `refer-research/openai-codex/docs/config.md:15`（model）
  - `refer-research/openai-codex/docs/config.md:23`（model_providers）
  - `refer-research/openai-codex/docs/config.md:64`（Azure model provider example）
  - `refer-research/openai-codex/docs/config.md:86`（Per-provider network tuning）
  - `refer-research/openai-codex/docs/config.md:118`（model_provider）
  - `refer-research/openai-codex/docs/config.md:328`（Approval presets）
  - `refer-research/openai-codex/docs/config.md:338`（mcp_servers）
  - `refer-research/openai-codex/docs/config.md:395`（shell_environment_policy）
  - `refer-research/openai-codex/docs/config.md:437`（notify）
  - `refer-research/openai-codex/docs/config.md:517`（history）
  - `refer-research/openai-codex/docs/config.md:528`（file_opener）
  - `refer-research/openai-codex/docs/config.md:544`（hide_agent_reasoning）
  - `refer-research/openai-codex/docs/config.md:554`（show_raw_agent_reasoning）
  - `refer-research/openai-codex/docs/config.md:569`（model_context_window）
  - `refer-research/openai-codex/docs/config.md:575`（model_max_output_tokens）
  - `refer-research/openai-codex/docs/config.md:579`（project_doc_max_bytes）
  - `refer-research/openai-codex/docs/config.md:583`（tui）
  - `refer-research/openai-codex/docs/config.md:604`（Config reference）

- 沙箱与审批
  - `refer-research/openai-codex/docs/sandbox.md:1`（Sandbox & approvals）
  - `refer-research/openai-codex/docs/sandbox.md:3`（Approval modes）
  - `refer-research/openai-codex/docs/sandbox.md:22`（Run without any approvals?）
  - `refer-research/openai-codex/docs/sandbox.md:26`（Common combinations）
  - `refer-research/openai-codex/docs/sandbox.md:66`（Experimenting with the Codex Sandbox）
  - `refer-research/openai-codex/docs/sandbox.md:78`（Platform sandboxing details）
  - `refer-research/openai-codex/docs/platform-sandboxing.md:1`（Platform sandboxing details）

- 入门与使用
  - `refer-research/openai-codex/docs/getting-started.md:1`（Getting started）
  - `refer-research/openai-codex/docs/getting-started.md:3`（CLI usage）
  - `refer-research/openai-codex/docs/getting-started.md:13`（Resuming interactive sessions）
  - `refer-research/openai-codex/docs/getting-started.md:32`（Running with a prompt as input）
  - `refer-research/openai-codex/docs/getting-started.md:48`（Example prompts）
  - `refer-research/openai-codex/docs/getting-started.md:62`（Memory with AGENTS.md）
  - `refer-research/openai-codex/docs/getting-started.md:72`（Tips & shortcuts）

- 安装与构建
  - `refer-research/openai-codex/docs/install.md:1`（Install & build）
  - `refer-research/openai-codex/docs/install.md:3`（System requirements）
  - `refer-research/openai-codex/docs/install.md:11`（DotSlash）
  - `refer-research/openai-codex/docs/install.md:15`（Build from source）

- 高级用法
  - `refer-research/openai-codex/docs/advanced.md:1`（Advanced）
  - `refer-research/openai-codex/docs/advanced.md:3`（Non-interactive / CI mode）
  - `refer-research/openai-codex/docs/advanced.md:49`（Tracing / verbose logging）
  - `refer-research/openai-codex/docs/advanced.md:63`（Model Context Protocol (MCP)）
  - `refer-research/openai-codex/docs/advanced.md:75`（Using Codex as an MCP Server）

- 提示词管理
  - `refer-research/openai-codex/docs/prompts.md:1`（Custom Prompts）

- FAQ
  - `refer-research/openai-codex/docs/faq.md:1`（FAQ）
  - `refer-research/openai-codex/docs/faq.md:3`（2021 Codex 关系）
  - `refer-research/openai-codex/docs/faq.md:7`（支持的模型）
  - `refer-research/openai-codex/docs/faq.md:13`（o3/o4-mini 不工作原因）
  - `refer-research/openai-codex/docs/faq.md:17`（禁止编辑文件）

- 发布与开源
  - `refer-research/openai-codex/docs/release_management.md:1`（Release Management）
  - `refer-research/openai-codex/docs/release_management.md:31`（Publishing to npm）
  - `refer-research/openai-codex/docs/release_management.md:35`（Publishing to Homebrew）
  - `refer-research/openai-codex/docs/open-source-fund.md:1`（Codex open source fund）
  - `refer-research/openai-codex/docs/contributing.md:1`（Contributing）
  - `refer-research/openai-codex/docs/contributing.md:11`（Development workflow）
  - `refer-research/openai-codex/docs/contributing.md:17`（High-impact changes）
  - `refer-research/openai-codex/docs/contributing.md:24`（Open a PR）
  - `refer-research/openai-codex/docs/contributing.md:31`（Review process）
  - `refer-research/openai-codex/docs/contributing.md:44`（Getting help）
  - `refer-research/openai-codex/docs/contributing.md:73`（Releasing `codex`）
  - `refer-research/openai-codex/docs/contributing.md:92`（Security & responsible AI）

- 法务与政策
  - `refer-research/openai-codex/docs/license.md:1`（License）
  - `refer-research/openai-codex/docs/CLA.md:1`（Individual Contributor License Agreement）
  - `refer-research/openai-codex/docs/CLA.md:12`（1. Definitions）
  - `refer-research/openai-codex/docs/CLA.md:19`（2. Copyright License）
  - `refer-research/openai-codex/docs/CLA.md:26`（3. Patent License）
  - `refer-research/openai-codex/docs/CLA.md:37`（4. Representations）
  - `refer-research/openai-codex/docs/CLA.md:45`（5. Miscellany）

- 其他
  - `refer-research/openai-codex/docs/experimental.md:1`（Experimental technology disclaimer）
  - `refer-research/openai-codex/docs/zdr.md:1`（Zero data retention (ZDR) usage）

- 协议与 MCP（codex-rs/docs）
  - `refer-research/openai-codex/codex-rs/docs/protocol_v1.md:7`（Entities）
  - `refer-research/openai-codex/codex-rs/docs/protocol_v1.md:49`（Interface）
  - `refer-research/openai-codex/codex-rs/docs/protocol_v1.md:80`（Transport）
  - `refer-research/openai-codex/codex-rs/docs/protocol_v1.md:86`（Example Flows）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:9`（Overview）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:34`（Starting the server）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:48`（Conversations）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:74`（Event stream）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:83`（Approvals）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:92`（Auth helpers）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:100`（Example: start and send a message）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:141`（Compatibility and stability）

### 内部文档锚点目录（H2–H4 细化）
- Authentication（认证）
  - `refer-research/openai-codex/docs/authentication.md:3`（Usage-based billing: API key）
  - `refer-research/openai-codex/docs/authentication.md:13`（Migrating to ChatGPT login）
  - `refer-research/openai-codex/docs/authentication.md:21`（Headless 连接）
  - `refer-research/openai-codex/docs/authentication.md:25`（本地认证并拷贝到 headless）
  - `refer-research/openai-codex/docs/authentication.md:51`（VPS/远程连接）

- Config（配置）
  - `refer-research/openai-codex/docs/config.md:18`（model）
  - `refer-research/openai-codex/docs/config.md:26`（model_providers）
  - `refer-research/openai-codex/docs/config.md:87`（Azure provider 示例）
  - `refer-research/openai-codex/docs/config.md:103`（按提供方网络调优）
  - `refer-research/openai-codex/docs/config.md:120`（request_max_retries）
  - `refer-research/openai-codex/docs/config.md:124`（stream_max_retries）
  - `refer-research/openai-codex/docs/config.md:128`（stream_idle_timeout_ms）
  - `refer-research/openai-codex/docs/config.md:132`（model_provider）
  - `refer-research/openai-codex/docs/config.md:145`（approval_policy）
  - `refer-research/openai-codex/docs/config.md:182`（profiles）
  - `refer-research/openai-codex/docs/config.md:227`（model_reasoning_effort）
  - `refer-research/openai-codex/docs/config.md:238`（model_reasoning_summary）
  - `refer-research/openai-codex/docs/config.md:252`（model_verbosity）
  - `refer-research/openai-codex/docs/config.md:271`（model_supports_reasoning_summaries）
  - `refer-research/openai-codex/docs/config.md:279`（sandbox_mode）
  - `refer-research/openai-codex/docs/config.md:328`（Approval presets）
  - `refer-research/openai-codex/docs/config.md:338`（mcp_servers）
  - `refer-research/openai-codex/docs/config.md:395`（shell_environment_policy）
  - `refer-research/openai-codex/docs/config.md:437`（notify）
  - `refer-research/openai-codex/docs/config.md:517`（history）
  - `refer-research/openai-codex/docs/config.md:528`（file_opener）
  - `refer-research/openai-codex/docs/config.md:544`（hide_agent_reasoning）
  - `refer-research/openai-codex/docs/config.md:554`（show_raw_agent_reasoning）
  - `refer-research/openai-codex/docs/config.md:569`（model_context_window）
  - `refer-research/openai-codex/docs/config.md:575`（model_max_output_tokens）
  - `refer-research/openai-codex/docs/config.md:579`（project_doc_max_bytes）
  - `refer-research/openai-codex/docs/config.md:583`（tui）
  - `refer-research/openai-codex/docs/config.md:604`（Config reference）

- Sandbox（沙箱与审批）
  - `refer-research/openai-codex/docs/sandbox.md:1`（Sandbox & approvals）
  - `refer-research/openai-codex/docs/sandbox.md:3`（Approval modes）
  - `refer-research/openai-codex/docs/sandbox.md:11`（Defaults and recommendations）
  - `refer-research/openai-codex/docs/sandbox.md:22`（无审批运行）
  - `refer-research/openai-codex/docs/sandbox.md:26`（常见组合）
  - `refer-research/openai-codex/docs/sandbox.md:38`（config.toml 微调）
  - `refer-research/openai-codex/docs/sandbox.md:66`（沙箱实验）
  - `refer-research/openai-codex/docs/sandbox.md:78`（平台沙箱细节）
  - `refer-research/openai-codex/docs/platform-sandboxing.md:1`（平台沙箱细节）

- Getting started / 使用
  - `refer-research/openai-codex/docs/getting-started.md:1`（Getting started）
  - `refer-research/openai-codex/docs/getting-started.md:3`（CLI usage）
  - `refer-research/openai-codex/docs/getting-started.md:13`（Resuming interactive sessions）
  - `refer-research/openai-codex/docs/getting-started.md:32`（Prompt 输入）
  - `refer-research/openai-codex/docs/getting-started.md:48`（示例 prompts）
  - `refer-research/openai-codex/docs/getting-started.md:62`（AGENTS.md 记忆）
  - `refer-research/openai-codex/docs/getting-started.md:72`（Tips & shortcuts）
  - `refer-research/openai-codex/docs/getting-started.md:74`（@ 文件搜索）
  - `refer-research/openai-codex/docs/getting-started.md:78`（图片输入）
  - `refer-research/openai-codex/docs/getting-started.md:87`（Esc–Esc 编辑上一条）
  - `refer-research/openai-codex/docs/getting-started.md:93`（Shell completions）
  - `refer-research/openai-codex/docs/getting-started.md:103`（--cd/-C）

- Install & build（安装与构建）
  - `refer-research/openai-codex/docs/install.md:1`（Install & build）
  - `refer-research/openai-codex/docs/install.md:3`（System requirements）
  - `refer-research/openai-codex/docs/install.md:11`（DotSlash）
  - `refer-research/openai-codex/docs/install.md:15`（Build from source）

- Advanced（高级）
  - `refer-research/openai-codex/docs/advanced.md:1`（Advanced）
  - `refer-research/openai-codex/docs/advanced.md:3`（CI / 非交互）
  - `refer-research/openai-codex/docs/advanced.md:15`（恢复非交互会话）
  - `refer-research/openai-codex/docs/advanced.md:49`（Tracing / verbose）
  - `refer-research/openai-codex/docs/advanced.md:63`（MCP 客户端）
  - `refer-research/openai-codex/docs/advanced.md:75`（作为 MCP 服务端）
  - `refer-research/openai-codex/docs/advanced.md:79`（MCP Server Quickstart）
  - `refer-research/openai-codex/docs/advanced.md:110`（Trying it Out）

- Prompts（提示词）
  - `refer-research/openai-codex/docs/prompts.md:1`（Custom Prompts）

- FAQ
  - `refer-research/openai-codex/docs/faq.md:1`（FAQ）
  - `refer-research/openai-codex/docs/faq.md:3`（2021 Codex 关系）
  - `refer-research/openai-codex/docs/faq.md:7`（支持的模型）
  - `refer-research/openai-codex/docs/faq.md:13`（o3/o4-mini 不工作）
  - `refer-research/openai-codex/docs/faq.md:17`（禁止编辑文件）
  - `refer-research/openai-codex/docs/faq.md:21`（Windows 支持）

- 发布/贡献/基金
  - `refer-research/openai-codex/docs/release_management.md:31`（Publishing to npm）
  - `refer-research/openai-codex/docs/release_management.md:35`（Publishing to Homebrew）
  - `refer-research/openai-codex/docs/open-source-fund.md:1`（Open source fund）
  - `refer-research/openai-codex/docs/contributing.md:11`（Development workflow）
  - `refer-research/openai-codex/docs/contributing.md:17`（High-impact changes）
  - `refer-research/openai-codex/docs/contributing.md:24`（Open a PR）
  - `refer-research/openai-codex/docs/contributing.md:31`（Review process）
  - `refer-research/openai-codex/docs/contributing.md:38`（Community values）
  - `refer-research/openai-codex/docs/contributing.md:44`（Getting help）
  - `refer-research/openai-codex/docs/contributing.md:50`（CLA）
  - `refer-research/openai-codex/docs/contributing.md:65`（Quick fixes）
  - `refer-research/openai-codex/docs/contributing.md:73`（Releasing `codex`）
  - `refer-research/openai-codex/docs/contributing.md:92`（Security & responsible AI）

- 法务/政策
  - `refer-research/openai-codex/docs/license.md:1`（License）
  - `refer-research/openai-codex/docs/CLA.md:12`（Definitions）
  - `refer-research/openai-codex/docs/CLA.md:19`（Copyright License）
  - `refer-research/openai-codex/docs/CLA.md:26`（Patent License）
  - `refer-research/openai-codex/docs/CLA.md:37`（Representations）
  - `refer-research/openai-codex/docs/CLA.md:45`（Miscellany）

- 其他
  - `refer-research/openai-codex/docs/experimental.md:1`（Experimental）
  - `refer-research/openai-codex/docs/zdr.md:1`（ZDR）

- 协议与 MCP（codex-rs/docs）
  - `refer-research/openai-codex/codex-rs/docs/protocol_v1.md:7`（Entities）
  - `refer-research/openai-codex/codex-rs/docs/protocol_v1.md:49`（Interface）
  - `refer-research/openai-codex/codex-rs/docs/protocol_v1.md:80`（Transport）
  - `refer-research/openai-codex/codex-rs/docs/protocol_v1.md:86`（Example Flows）
  - `refer-research/openai-codex/codex-rs/docs/protocol_v1.md:90`（Basic UI Flow）
  - `refer-research/openai-codex/codex-rs/docs/protocol_v1.md:131`（Task Interrupt）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:9`（Overview）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:34`（Starting the server）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:48`（Conversations）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:74`（Event stream）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:83`（Approvals）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:92`（Auth helpers）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:100`（Example）
  - `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:141`（Compatibility）

## 代码模块索引（codex-rs/ Cargo workspace）
工作区成员参考 `refer-research/openai-codex/codex-rs/Cargo.toml`：

- cli：统一命令入口（`codex`）。转发到 `tui/exec/login/mcp/...` 子命令
- tui：Ratatui 全屏交互界面（主交互体验）
- exec：非交互/自动化（`codex exec`）与 Linux 沙箱的 arg0 分流
- core：核心业务（协议、对话/任务循环、模板与策略等）
- login：登录/登出/状态（ChatGPT 或 API Key）
- linux-sandbox：Landlock + seccomp（进程隔离/权限裁剪）
- execpolicy：执行策略与权限模型
- file-search：工作区文件搜索（`@` 快速定位）
- apply-patch：补丁生成与应用
- git-tooling：Git 操作封装
- mcp-client：MCP 客户端能力
- mcp-server：MCP 服务端能力（实验），可配合 MCP Inspector
- mcp-types：MCP 类型定义与 schema
- protocol：Codex 协议流与类型
- protocol-ts：协议到 TypeScript 的支持层
- chatgpt：与 ChatGPT 服务的集成
- ollama：本地 LLM（Ollama）集成
- ansi-escape：TUI ANSI/样式相关
- utils/readiness：健康/就绪探针

常见入口文件：
- `refer-research/openai-codex/codex-rs/cli/src/main.rs`：多工具入口，含 `exec/login/mcp/apply/completion/debug` 等子命令
- `refer-research/openai-codex/codex-rs/tui/src/main.rs`：TUI 主入口
- `refer-research/openai-codex/codex-rs/exec/src/main.rs`：非交互执行入口
- `refer-research/openai-codex/codex-cli/bin/codex.js`：Node 包装，按平台分发二进制

## 交互与运行方式（摘要）
- 交互式：`codex`（TUI）
- 非交互：`codex exec "PROMPT"` 或从 stdin 读取
- MCP：按 `docs/config.md#mcp_servers` 在 `~/.codex/config.toml` 中配置客户端；`codex mcp` 可作为 MCP 服务端（实验）
- 沙箱：`--sandbox` 支持 `read-only/workspace-write/danger-full-access`

## 架构关系图（Mermaid）
```mermaid
graph TD
  subgraph Packaging
    NPM["codex-cli (Node)"] --> BIN["平台二进制 codex"]
  end

  subgraph CLI
    CLI["codex-rs/cli"] --> TUI["tui (交互)"]
    CLI --> EXEC["exec (非交互)"]
    CLI --> LOGIN["login"]
    CLI --> MCPCLI["mcp-client/server"]
    CLI --> APPLY["apply-patch"]
    CLI --> PROTO["protocol / protocol-ts"]
  end

  subgraph Core
    CORE["core (业务核心)"] --> FS["file-search"]
    CORE --> GIT["git-tooling"]
    CORE --> POL["execpolicy"]
    CORE --> ANSI["ansi-escape/TUI 样式"]
  end

  subgraph Sandbox
    LINUX["linux-sandbox (Landlock/seccomp)"]
  end

  subgraph Integrations
    CHATGPT["chatgpt"]
    OLLAMA["ollama"]
    MCP["mcp-types"]
  end

  TUI --> CORE
  EXEC --> CORE
  CORE --> LINUX
  CORE --> CHATGPT
  CORE --> OLLAMA
  MCPCLI --> MCP
```

## 快速检索（ripgrep 示例）
- 查找工作区成员：`rg "members\s*=\s*\[" -n refer-research/openai-codex/codex-rs/Cargo.toml`
- 查找 CLI 子命令定义：`rg "derive\(.*Subcommand\)" -n refer-research/openai-codex/codex-rs`
- 查找 MCP 使用：`rg "\bMCP\b|model context protocol" -n refer-research/openai-codex`
- 查找配置项：`rg "\bconfig\b|config.toml|CliConfigOverrides" -n refer-research/openai-codex`
- 查找沙箱代码：`rg "landlock|seccomp|sandbox" -n refer-research/openai-codex/codex-rs`

## 维护建议
- 当 Rust 工作区成员（crate）增减或重命名时，更新本文件的“代码模块索引”与“目录结构”。
- 当新增文档（docs/）时，补充“文档索引”。
- 架构图基于当前代码推断，若出现跨 crate 依赖变更或职责调整，请同步更新。

（本索引基于仓库快照自动梳理，若与最新源码有偏差，请以源码为准。）

## 核心模块（core/src）目录细览
```
core/
├─ lib.rs                     # 对外导出/重导出入口
├─ codex.rs                   # 会话/事件主循环，Codex/Session/TurnContext
├─ exec.rs                    # 本地命令执行与沙箱调度（Seatbelt/Landlock）
├─ parse_command.rs           # 解析模型生成的命令文本
├─ openai_tools.rs            # OpenAI 工具集定义/参数
├─ client.rs, default_client.rs, chat_completions.rs, client_common.rs
├─ model_family.rs, openai_model_info.rs, model_provider_info.rs
├─ conversation_manager.rs    # ConversationManager 管理会话生命周期
├─ conversation_history.rs, message_history.rs, event_mapping.rs
├─ safety.rs, is_safe_command.rs
├─ seatbelt.rs, landlock.rs, spawn.rs, shell.rs, terminal.rs
├─ apply_patch.rs, tool_apply_patch.rs, tool_apply_patch.lark
├─ token_data.rs
├─ config.rs, config_types.rs, config_edit.rs, config_profile.rs, flags.rs
├─ util.rs, user_instructions.rs, environment_context.rs, project_doc.rs
├─ review_format.rs, plan_tool.rs, user_notification.rs, turn_diff_tracker.rs
├─ codex/compact.rs           # 对话压缩/摘要
├─ seatbelt_base_policy.sbpl  # macOS Seatbelt 策略模板
├─ unified_exec/
│  ├─ mod.rs, errors.rs       # 统一的执行会话管理（与 exec_command 配合）
├─ exec_command/
│  ├─ mod.rs, exec_command_params.rs, responses_api.rs
│  ├─ exec_command_session.rs, session_id.rs, session_manager.rs
├─ rollout/
│  ├─ mod.rs, policy.rs, recorder.rs, list.rs, tests.rs
└─ truncate.rs, mcp_connection_manager.rs, mcp_tool_call.rs
```

## 各 crate 关键类型/入口与常见调用

以下条目便于快速定位，路径均可点击打开（行号为起始行）：

- 核心 core
  - `Codex` 会话接口：`refer-research/openai-codex/codex-rs/core/src/codex.rs:144`
  - `Codex::spawn` 初始化会话：`refer-research/openai-codex/codex-rs/core/src/codex.rs:170`
  - `Codex::submit/next_event`：`refer-research/openai-codex/codex-rs/core/src/codex.rs:225`, `refer-research/openai-codex/codex-rs/core/src/codex.rs:245`
  - `Session` 会话状态机：`refer-research/openai-codex/codex-rs/core/src/codex.rs:270`
  - `ConversationManager` 与新会话：`refer-research/openai-codex/codex-rs/core/src/conversation_manager.rs:35`, `refer-research/openai-codex/codex-rs/core/src/conversation_manager.rs:41`
  - 执行管线（Exec）：`SandboxType`、`process_exec_tool_call`、`ExecToolCallOutput` 等：`refer-research/openai-codex/codex-rs/core/src/exec.rs:65`, `refer-research/openai-codex/codex-rs/core/src/exec.rs:82`, `refer-research/openai-codex/codex-rs/core/src/exec.rs:253`
  - 协议重导出：`refer-research/openai-codex/codex-rs/core/src/lib.rs:85`（`pub use codex_protocol::protocol`）

- 协议 protocol
  - `Op` 提交操作：`refer-research/openai-codex/codex-rs/protocol/src/protocol.rs:54`
  - `AskForApproval` 审批策略：`refer-research/openai-codex/codex-rs/protocol/src/protocol.rs:186`
  - `SandboxPolicy` 沙箱策略：`refer-research/openai-codex/codex-rs/protocol/src/protocol.rs:213`
  - `Event`/`EventMsg` 事件总线：`refer-research/openai-codex/codex-rs/protocol/src/protocol.rs:412`, `refer-research/openai-codex/codex-rs/protocol/src/protocol.rs:424`
  - 审批事件：`ExecApprovalRequestEvent`、`ApplyPatchApprovalRequestEvent`：`refer-research/openai-codex/codex-rs/protocol/src/protocol.rs:1096`, `refer-research/openai-codex/codex-rs/protocol/src/protocol.rs:1109`

- CLI（多工具入口）
  - `MultitoolCli`/`Subcommand`：`refer-research/openai-codex/codex-rs/cli/src/main.rs:42`, `refer-research/openai-codex/codex-rs/cli/src/main.rs:53`
  - `main()`：`refer-research/openai-codex/codex-rs/cli/src/main.rs:197`

- TUI（交互界面）
  - `run_main(cli, sandbox_exe)`：`refer-research/openai-codex/codex-rs/tui/src/lib.rs:86`
  - `main()`：`refer-research/openai-codex/codex-rs/tui/src/main.rs:16`

- 非交互 exec
  - `run_main(cli, sandbox_exe)`：`refer-research/openai-codex/codex-rs/exec/src/lib.rs:39`
  - `main()`：`refer-research/openai-codex/codex-rs/exec/src/main.rs:27`

- 登录 login
  - 登录服务：`ServerOptions`、`LoginServer`、`run_login_server`：`refer-research/openai-codex/codex-rs/login/src/server.rs:33`, `refer-research/openai-codex/codex-rs/login/src/server.rs:55`, `refer-research/openai-codex/codex-rs/login/src/server.rs:89`

- Linux 沙箱
  - `run_main()` 入口：`refer-research/openai-codex/codex-rs/linux-sandbox/src/lib.rs:7`

- MCP 客户端/服务端
  - `McpClient`、`new_stdio_client()`：`refer-research/openai-codex/codex-rs/mcp-client/src/mcp_client.rs:63`, `refer-research/openai-codex/codex-rs/mcp-client/src/mcp_client.rs:85`
  - MCP 服务端入口与处理器：`refer-research/openai-codex/codex-rs/mcp-server/src/main.rs:1`, `refer-research/openai-codex/codex-rs/mcp-server/src/message_processor.rs:1`

- apply-patch（补丁）
  - 指令/类型：`ApplyPatchAction`、`MaybeApplyPatchVerified`、`ApplyPatchError`：`refer-research/openai-codex/codex-rs/apply-patch/src/lib.rs:160`, `refer-research/openai-codex/codex-rs/apply-patch/src/lib.rs:143`, `refer-research/openai-codex/codex-rs/apply-patch/src/lib.rs:35`

- arg0（多执行体分发）
  - `arg0_dispatch_or_else`、别名：`codex-linux-sandbox`、`apply_patch`：`refer-research/openai-codex/codex-rs/arg0/src/lib.rs:35`, `refer-research/openai-codex/codex-rs/arg0/src/lib.rs:10`, `refer-research/openai-codex/codex-rs/arg0/src/lib.rs:11`

### 常见调用链（概览）
- 交互式（TUI）
  - `codex-rs/cli` 解析子命令 → `tui::run_main` 加载配置/模型/审批策略 → 构建 `ConversationManager` 并创建会话 → `Codex::spawn` 返回 `{codex, conversation_id}` → 前端事件循环消费 `Event` 渲染 UI。
- 非交互（exec）
  - `exec::run_main` 读取 prompt 与输出 schema → 加载配置并设置 `AskForApproval::Never` → 会话创建与事件处理器（人读/JSON 模式）→ 直到 `TaskCompleteEvent`。
- 命令执行（Exec 工具调用）
  - 模型输出工具调用 → `core/exec.rs::process_exec_tool_call` → 根据平台选择 `Seatbelt`/`Landlock` 或无沙箱 → `spawn_*` 子进程 → 流式聚合输出并发出 `ExecCommand*` 事件 → 需要审批时发出 `ExecApprovalRequestEvent`。
- 补丁应用（apply_patch）
  - 模型产出补丁（工具或 heredoc）→ `apply-patch` 解析与验证 → `ApplyPatchApprovalRequestEvent` → 批准后生成并应用文件改动，随后触发 `TurnDiffEvent`/`PatchApply*` 事件。
- MCP（工具扩展）
  - `McpClient::new_stdio_client` 启动外部 MCP Server → `initialize`/`listTools` → 工具调用 `callTool` → `core` 中 `mcp_tool_call` 处理结果并转为 `Event`。
