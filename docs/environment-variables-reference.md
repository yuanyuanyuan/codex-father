# Codex Father 环境变量参考

本文档从“源码实现”的角度，汇总 codex-father 当前支持并在运行期实际读取的环境变量，包含作用、默认值、可选值与来源位置（代码文件:行）。如需机器可读版本，见
`docs/environment-variables.json` 与 `docs/environment-variables.csv`。

## 使用范围与分组

- MCP 服务器（TypeScript）：由 `mcp/codex-mcp-server` 读取
- Shell 运行器：`start.sh` 与 `job.sh`
- CLI/Node 内核：TypeScript/Node 层（日志、错误边界、脚本包装器等）
- MCP 启动脚本：`mcp/server.sh`
- 外部影响变量：由操作系统/构建环境注入，被 codex-father 读取

## 变量清单

### MCP 服务器（TypeScript）

- `CODEX_JOB_SH`
  - 作用：覆盖 `job.sh` 路径，管理 start/status/stop/list 等异步作业
  - 默认：优先使用
    `<repo-root>/.codex-father/job.sh`（MCP 启动时自动同步内置脚本），若手动提供
    `CODEX_JOB_SH` 或顶层 `job.sh` 可覆盖
  - 取值：任意可执行路径
  - 来源：mcp/codex-mcp-server/src/index.ts:19

- `CODEX_START_SH`
  - 作用：覆盖 `start.sh` 路径；若设置，则 `codex.start` 走“stub”直调 `start.sh`
    分支
  - 默认：优先使用
    `<repo-root>/.codex-father/start.sh`（由 MCP 自动落地并保持更新），若显式指定或顶层存在
    `start.sh` 则覆盖
  - 取值：任意可执行路径
  - 来源：mcp/codex-mcp-server/src/index.ts:37（stub 检测见 937）

- `CODEX_VERSION_OVERRIDE`
  - 作用：覆盖 Codex CLI 版本检测（严格模式下用于 0.44-only 选项校验）
  - 默认：未设置时调用 `codex --version` 解析
  - 取值：语义化版本（如 `0.44.0`）
  - 来源：mcp/codex-mcp-server/src/index.ts:107

- `CODEX_MCP_NAME_STYLE`
  - 作用：工具名展示策略，`underscore-only` 或 `dot-only`
  - 默认：不限制（同时包含点号与下划线别名）
  - 取值：`underscore-only` | `dot-only`
  - 来源：mcp/codex-mcp-server/src/index.ts:218

- `CODEX_MCP_TOOL_PREFIX`
  - 作用：为工具增加前缀别名（同时生成点号及下划线两套别名）
  - 默认：未设置
  - 取值：任意非空字符串（会做去重）
  - 来源：mcp/codex-mcp-server/src/index.ts:219

- `CODEX_MCP_HIDE_ORIGINAL`
  - 作用：隐藏原始 `codex.*`/`codex_*`，仅保留带前缀的别名
  - 默认：`false`
  - 取值：`true`/`1` 启用；`false`/`0` 关闭
  - 来源：mcp/codex-mcp-server/src/index.ts:221

### Shell 运行器：start.sh / job.sh

- `CODEX_LOG_DIR`
  - 作用：日志/会话根目录
  - 默认：`<script-dir>/.codex-father/sessions`
  - 来源：start.sh:28

- `CODEX_LOG_FILE`
  - 作用：直接指定日志文件完整路径（优先级最高）
  - 默认：未设置则根据会话规则计算
  - 来源：start.sh:29

- `CODEX_LOG_TAG`
  - 作用：运行标签，参与会话目录/文件命名
  - 默认：空字符串
  - 来源：start.sh:30

- `CODEX_LOG_SUBDIRS`
  - 作用：是否使用“每次运行一个子目录（1）/扁平日志（0）”
  - 默认：`1`
  - 来源：start.sh:31

- `CODEX_LOG_AGGREGATE`
  - 作用：是否写入聚合摘要（文本/JSONL）
  - 默认：`1`
  - 来源：start.sh:32

- `CODEX_LOG_AGGREGATE_FILE`
  - 作用：聚合文本路径
  - 默认：`<session-dir>/aggregate.txt`
  - 来源：start.sh:38

- `CODEX_LOG_AGGREGATE_JSONL_FILE`
  - 作用：聚合 JSONL 路径
  - 默认：`<session-dir>/aggregate.jsonl`
  - 来源：start.sh:39

- `CODEX_ECHO_INSTRUCTIONS`
  - 作用：在日志中回显合成后的指令
  - 默认：`1`
  - 来源：start.sh:34

- `CODEX_ECHO_INSTRUCTIONS_LIMIT`
  - 作用：回显的最大行数（`0` 表示不限制）
  - 默认：`0`
  - 来源：start.sh:36

- `CODEX_STRUCTURED_INSTRUCTIONS_FILE`
  - 作用：保存经 CLI 归一化后的结构化指令 JSON（位于 `.codex-father/instructions/`）
  - 默认：无
  - 来源：core/cli/legacy-compatibility.ts:64

- `CODEX_STRUCTURED_INSTRUCTIONS_SOURCE`
  - 作用：记录原始结构化指令文件的绝对路径
  - 默认：无
  - 来源：core/cli/legacy-compatibility.ts:65

- `CODEX_STRUCTURED_INSTRUCTIONS_FORMAT`
  - 作用：标识原始指令文件的格式（json/yaml/xml）
  - 默认：无
  - 来源：core/cli/legacy-compatibility.ts:66

- `CODEX_STRUCTURED_INSTRUCTIONS_ID`
  - 作用：结构化指令文件中的顶层 `id`
  - 默认：无
  - 来源：core/cli/legacy-compatibility.ts:67

- `CODEX_STRUCTURED_INSTRUCTIONS_VERSION`
  - 作用：结构化指令文件中的 `version`
  - 默认：无
  - 来源：core/cli/legacy-compatibility.ts:68

- `CODEX_STRUCTURED_TASK_ID`
  - 作用：当执行结构化指令时，指示选择的任务 ID
  - 默认：无
  - 来源：core/cli/legacy-compatibility.ts:71

- `REDACT_ENABLE`
  - 作用：启用日志脱敏（默认规则 + 自定义模式）
  - 默认：`0`
  - 来源：start.sh:42

- `REDACT_REPLACEMENT`
  - 作用：脱敏替换占位符
  - 默认：`***REDACTED***`
  - 来源：start.sh:55

- `CODEX_SESSION_DIR`
  - 作用：显式指定会话目录；日志为 `<dir>/job.log`
  - 默认：未设置则按 `CODEX_SESSIONS_ROOT` 计算
  - 来源：start.sh:807（job.sh 会向子进程注入同名变量）

- `CODEX_SESSIONS_ROOT`
  - 作用：在未指定 `CODEX_SESSION_DIR` 时用于创建会话子目录
  - 默认：`CODEX_LOG_DIR`
  - 来源：start.sh:811

- `INSTRUCTIONS`
  - 作用：当未提供任何 -f/-c 覆盖/叠加时，作为基底指令内容
  - 默认：未设置则用默认文件或内置默认文案
  - 来源：start.sh:914

- `ON_CONTEXT_OVERFLOW_MAX_RETRIES`
  - 作用：上下文溢出时的额外重试次数（迭代模式）
  - 默认：`2`
  - 来源：start.sh:583

- `CODEX_START_SH`
  - 作用：在 job.sh 中覆盖 `start.sh` 路径
  - 默认：`<repo-root>/start.sh`
  - 来源：job.sh:9

### CLI/Node 内核

- `NODE_ENV`
  - 作用：控制 CLI 入口选择、日志级别、错误边界策略
  - 取值：`development` | `production` | `test`
  - 默认：`development`
  - 来源：bin/codex-father:35；core/cli/start.ts:36

- `DEBUG`
  - 作用：开发/调试时输出额外栈与细节
  - 默认：未设置
  - 来源：bin/codex-father:82

- `CODEX_VERBOSE`
  - 作用：显示更多警告/错误边界细节
  - 默认：未设置
  - 来源：core/cli/start.ts:36；core/cli/config-loader.ts:522

- `CODEX_JSON`
  - 作用：错误边界以 JSON 输出
  - 默认：未设置
  - 来源：core/cli/start.ts:37

- `ENABLE_LOGGING`
  - 作用：测试环境下是否仍输出日志（默认静默）
  - 默认：未设置（当 `NODE_ENV=test` 时静默）
  - 来源：core/cli/logger-setup.ts:234

- `CODEX_SCRIPT_TIMEOUT`
  - 作用：脚本包装器的默认超时（毫秒）
  - 默认：未设置（按脚本类型取默认）
  - 来源：core/cli/scripts.ts:152

- `CODEX_ENV`
  - 作用：作为任务元数据中的环境标记（回退到 `NODE_ENV`）
  - 默认：`NODE_ENV` 或 `development`
  - 来源：core/lib/queue/task-definition.ts:26

- `EDITOR`
  - 作用：PRD 命令默认编辑器
  - 默认：`vim`
  - 来源：src/cli/prd-commands.ts:103

### MCP 启动脚本

- `MCP_TS_SERVER`
  - 作用：覆盖 TS 版 MCP 服务器入口（用于 `mcp/server.sh`）
  - 默认：`mcp/codex-mcp-server/dist/index.js`
  - 来源：mcp/server.sh:6

### 外部影响变量（非 codex-father 专用）

- `HOME` / `USERPROFILE`
  - 作用：定位默认指令文件（`$HOME/.codex/instructions.md`）与用户目录
  - 来源：start.sh:11；core/cli/config-loader.ts:125

- `APP_VERSION` / `BUILD_DATE`
  - 作用：在环境探测中显示版本/构建日期（用于信息展示）
  - 来源：src/lib/utils.ts:1062；src/lib/utils.ts:1063

## 机器可读导出

- JSON：`docs/environment-variables.json`
- CSV：`docs/environment-variables.csv`

二者字段包含：`name`、`description`、`type`、`components`、`default`、`allowed`、`sources`。
