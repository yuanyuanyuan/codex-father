## [Unreleased]

暂无变更条目。准备发布前，请将本次改动整理到下方对应版本章节，避免从
[Unreleased] 自动生成发布说明。

## [3.1.1](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v3.1.0...mcp-v3.1.1) (2025-10-12)

### Fixes

- runtime/common: 忽略“未使用的 MCP 客户端启动超时”（如
  `MCP client for  \\`context7\\` failed to start: request timed out`），避免误将整次运行判为
  `network_error`；如需保留旧行为，可设置 `CODEX_IGNORE_MCP_START_FAILURES=0`。
- runtime/common: 统一在每轮执行后补齐 `last.txt` 末尾换行，减少解析噪音；将
  `CONTROL: DONE/CONTINUE` 的识别改为“整行匹配”，避免句中提及误判。

### Chore

- assets: 同步更新 `assets/runtime/lib/common.sh`
  与主库逻辑，保持运行时行为一致。

## [3.0.2](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v3.0.1...mcp-v3.0.2) (2025-10-12)

### Fixes

- runtime/common: 忽略“未使用的 MCP 客户端启动超时”（如
  `MCP client for  \\`context7\\` failed to start: request timed out`），避免误将整次运行判为
  `network_error`；如需保留旧行为，可设置 `CODEX_IGNORE_MCP_START_FAILURES=0`。
- runtime/common: 统一在每轮执行后补齐 `last.txt` 末尾换行，减少解析噪音（如
  `with no line terminators`）。
- runtime/common: 将 `CONTROL: DONE/CONTINUE`
  的识别改为“整行匹配”，避免在句子中提及该短语时被误判为控制信号。

### Chore

- assets: 同步更新 `assets/runtime/lib/common.sh`
  与主库逻辑，保持运行时行为一致。

## [3.1.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v3.0.1...mcp-v3.1.0) (2025-10-12)

### Features

- diagnostics/bridge-layer:
  `list-sessions`、`get-latest-session`、`read-session-artifacts`
  现默认遵循会话根目录环境变量：优先 `CODEX_SESSIONS_ROOT`（兼容
  `CODEX_SESSIONS_HOME`），未设置时回退至
  `.codex-father/sessions`。统一路径解析以便与 CLI、Shell 运行器一致。

### Docs

- User Manual（中/英）补充“日志摘要（v1.7 新增）/Log Summary”与多会话统计示例；
- 解释如何通过 `CODEX_ECHO_INSTRUCTIONS` 与 `CODEX_ECHO_INSTRUCTIONS_LIMIT`
  控制合成指令全文回显；
- README（中/英）与 Troubleshooting 文档加入 `scripts/validate-session.sh`
  的健康检查示例；
- 明确推荐通过 `CODEX_SESSIONS_ROOT` 配置新根目录，历史
  `.codex-father-sessions/` 可用软链兼容。

### Notes

- 本次改动不改变 MCP 工具的入参与返回契约，属于可观测性与路径一致性的改进；
- 建议客户端在“会话浏览”场景下使用 `list-sessions` 与 `get-latest-session`
  并尊重服务器返回的 `sessionRoot` 字段。

## [3.0.1](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v3.0.0...mcp-v3.0.1) (2025-10-12)

### Docs

- 统一文档配置口径：prod（生产）统一使用
  `npx @starkdev020/codex-father-mcp-server --transport=ndjson`；preview（本地调试）使用本地源码
  `node .../dist/index.js --transport=ndjson`。更新了中英文的 README、Installation、Configuration、Manual、Quick
  Start。

### Notes

- 仅文档与示例更新，不涉及运行时代码行为变更。

## [3.0.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v2.2.0...mcp-v3.0.0) (2025-10-10)

### Features

- **runtime:** 补丁模式默认将 diff 落盘并在日志中仅输出预览，支持新的
  `--patch-output`/`--patch-preview-lines`/`--no-patch-preview`/
  `--no-patch-artifact` CLI 透传，元数据包含补丁哈希与行数。

### Docs

- **help:** `codex.help` 增加补丁控量、日志降噪（`--no-echo-instructions`、
  `--no-carry-context`、`view=result-only` 等）提示。

### Fixes

- **runtime:** 可写沙箱 + `never` 组合默认改为归一到
  `on-failure`，避免无人值守健康检查被判定 `approval_required`；需要保留 `never`
  时可设置 `ALLOW_NEVER_WITH_WRITABLE_SANDBOX=1`。
- **exec/runtime:** `runId`
  目录名时间戳改为使用系统本地时区（`exec-YYYYMMDDHHmmss-<tag>`），并在 CLI 展示时附带本地偏移而非固定
  `Z`。

## [2.2.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v2.1.0...mcp-v2.2.0) (2025-10-09)

此版本已发布，但未整理专属变更条目。详见 GitHub
Release 页面或上方 compare 链接以获得差异列表。

## [2.1.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v2.0.0...mcp-v2.1.0) (2025-10-08)

此版本已发布，但未整理专属变更条目。详见 GitHub
Release 页面或上方 compare 链接以获得差异列表。

## [2.0.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.6.0...mcp-v2.0.0) (2025-10-08)

### Breaking Changes

- **contracts:**
  调整部分 CLI/MCP 诊断与报告摘要的字段与默认行为，以对齐新的指标与别名规则（详见文档与契约测试）。

### Features

- **diagnostics:**
  增强诊断工具（strict 参数校验、错误码映射、grep-events 支持 ignoreCase/regex），并补 Playbook 与端到端示例。

### Fixes

- **release/ci:**
  稳定包含 Orchestrator 定向测试与配置检测；修复一处 JSON 摘要别名契约（`failedTasks`）。

### Internal

- **lint:** 将 `vitest.config.ts` 与 `vitest.orchestrator.config.ts` 纳入 ESLint
  TS 项目，消除 CI 噪音。
- **tests:** 增强 JSON 输出契约的覆盖率与零任务边界校验。

## [1.6.1](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.6.0...mcp-v1.6.1) (2025-10-08)

### Fixes

- **release/ci:**
  稳定包含 Orchestrator 定向测试与配置检测；修复一处 JSON 摘要别名契约（`failedTasks`）。

### Docs

- **mcp:**
  补充诊断工具用法与常见路径（tools/list、tools/call 端到端示例与 Playbook 参考）。

### Internal

- **lint:** 将 `vitest.config.ts` 与 `vitest.orchestrator.config.ts` 纳入 ESLint
  TS 项目，消除 CI 噪音。
- **tests:** 增强 JSON 输出契约的覆盖率与零任务边界校验。

## [1.6.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.5.0...mcp-v1.6.0) (2025-10-06)

### Features

- **runtime:** 默认禁用系统 fallback，启动时自动将内置 `job.sh`/`start.sh`
  及依赖落地到 `.codex-father/`，缺失时直接报错。
- **runtime:** 自动同步 `job.d/`、`start.d/`、`lib/`
  下的运行时脚本，检测手动修改后保留用户版本并给出警告。

### Docs

- 更新环境变量参考、发行说明与 README，说明新的内置脚本托管策略及错误提示。

# [1.5.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.4.3...mcp-v1.5.0) (2025-10-05)

### Features

- **mcp:** guard handshake and add fallback runtime
  ([190dafe](https://github.com/yuanyuanyuan/codex-father/commit/190dafee6644b8e3e528bb419e4348f6b86783a8))

## [1.5.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.4.3...mcp-v1.5.0) (2025-10-05)

### Features

- **protocol:** initialize 请求缺少 `protocolVersion` 时直接返回
  `InvalidParams`，并在握手完成前阻断 tools 请求，避免客户端误继续调用。
- **runtime:** 当仓库缺少 `start.sh`/`job.sh` 时启用内置 fallback
  runtime，仍可处理 codex.exec/start/status/logs/list/stop/clean/metrics。
- **errors:** 统一工具错误载荷，将结构化 JSON 暴露在
  `structuredContent.error`，同时保留人类可读摘要。

### Tests

- 新增 `mcp_initialize_guard_e2e.sh`
  覆盖握手校验，`mcp_fallback_exec_start.sh` + `mcp_fallback_e2e.js`
  覆盖 fallback 模式执行路径。

## [1.4.3](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.4.2...mcp-v1.4.3) (2025-10-05)

### Bug Fixes

- **release:**
  prepublish 阶段强制全量编译 ([c79b402](https://github.com/yuanyuanyuan/codex-father/commit/c79b402e5130d20d60af0f2548c9581e92d5682c))

## [1.4.2](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.4.1...mcp-v1.4.2) (2025-10-05)

### Bug Fixes

- **release:** prepublish 阶段强制全量编译并校验 dist，避免增量缓存缺少 env.js
  ([7ab7138](https://github.com/yuanyuanyuan/codex-father/commit/7ab7138c24e6d9d467b3a864b29804414edb4f35))

## [1.4.1](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.4.0...mcp-v1.4.1) (2025-10-05)

### Bug Fixes

- **mcp:**
  发布前校验 dist 构建产物 ([7525b5d](https://github.com/yuanyuanyuan/codex-father/commit/7525b5d295b4dee4cf4d38d476cdf0b083134e1f))

# [1.4.1](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.4.0...mcp-v1.4.1) (2025-10-05)

### Bug Fixes

- **release:**
  发布前重新构建并校验 dist 构建产物，修复缺失 env.js 导致的 npx 崩溃

# [1.3.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.2.0...mcp-v1.3.0) (2025-10-05)

### Bug Fixes

- **cli:**
  start.sh 增强模型旗标兼容性 ([1059129](https://github.com/yuanyuanyuan/codex-father/commit/1059129569653eff6d4691e65465e7918e077040))

### Features

- Add detailed analysis and recommendations for compatibility with Codex
  versions 0.42 and 0.44
  ([2a1cdf1](https://github.com/yuanyuanyuan/codex-father/commit/2a1cdf111b9a598b47a77d3e64bd7354c3614877))

# [1.2.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.1.10...mcp-v1.2.0) (2025-10-04)

### Bug Fixes

- **mcp:**
  修复服务器启动时序问题 ([39bea23](https://github.com/yuanyuanyuan/codex-father/commit/39bea23269a7cba92ebfe71fcb53380eddf261fc))
- **start.sh:**
  修复 Bash 正则表达式语法错误 ([c4db5e0](https://github.com/yuanyuanyuan/codex-father/commit/c4db5e0c4fca5ff6f0efb76f58c1e1df399196b5))
- **start:**
  统一可写沙箱审批降级逻辑 ([5273104](https://github.com/yuanyuanyuan/codex-father/commit/52731044b7fe256f5d4919b97e556bf41cd91915))

### Features

- **008:** 完成 Phase 3.2 - 基础设施层 (T023-T030)
  ([62e1ffe](https://github.com/yuanyuanyuan/codex-father/commit/62e1ffe665d58f8986d609af920be88ed29a259a))
- **008:** 完成 Phase 3.3 T031 -
  codex/event 通知处理 ([dd0d165](https://github.com/yuanyuanyuan/codex-father/commit/dd0d165e3b0dcad902e018f8baa13c3fa84fb3e8))
- **008:**
  完成 T015-T022 - 配置与工具契约 ([bbdb111](https://github.com/yuanyuanyuan/codex-father/commit/bbdb1112ece6a55e6fb5c81d029d1c45482eb778))
- **008:**
  实现 T008-T014 - 认证方法契约与测试 ([7fd8c3c](https://github.com/yuanyuanyuan/codex-father/commit/7fd8c3c1d7a55790437bca74091c1d0b6410b59f))
- Add tasks for version detection and testing
  ([e60ea03](https://github.com/yuanyuanyuan/codex-father/commit/e60ea03df629a12d3eb5cc4da19fda40052b5b47))
- **docs:** 增加对 codex
  0.42 和 0.44 版本的兼容性说明及参数使用建议 ([9a374d0](https://github.com/yuanyuanyuan/codex-father/commit/9a374d02c15d056e2b7f46c45c877fc1d1402abd))
- **mcp:** add compatibility for Codex 0.44 with version detection, parameter
  mapping, and profile auto-fix
  ([a80a403](https://github.com/yuanyuanyuan/codex-father/commit/a80a403bcc4a80aca04a9edc98ed846166b87f1b))
- **mcp:**
  实现 applyPatchApproval 客户端处理器与集成测试 ([bd5697a](https://github.com/yuanyuanyuan/codex-father/commit/bd5697a4e5e478b29ddad54e344190d98213de40))
- **mcp:** 实现批次 3b - 工具方法 (T047-T048) φ(≧ω≦\*)♪
  ([ce2fc8b](https://github.com/yuanyuanyuan/codex-father/commit/ce2fc8b1ab4fee727f857ec9a2506e7e2f7b4d90))
- **mcp:**
  新增会话管理契约与测试 ([b21d58d](https://github.com/yuanyuanyuan/codex-father/commit/b21d58dd27430240c37d3378121c259c22affd6e))

## [1.1.8](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.1.7...mcp-v1.1.8) (2025-10-03)

### Bug Fixes

- **mcp:** switch npm scope to [@starkdev020](https://github.com/starkdev020)
  ([6f9fd99](https://github.com/yuanyuanyuan/codex-father/commit/6f9fd997dc44e27437f440efc7a7c1042408e4a1))
- update package name from [@starkdev020](https://github.com/yuanyuanyuan) to
  [@starkdev020](https://github.com/starkdev020) in various files
  ([79d2e9e](https://github.com/yuanyuanyuan/codex-father/commit/79d2e9ea6379407434c2bea6bb700762e92007eb))

## [1.1.7](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.1.6...mcp-v1.1.7) (2025-10-03)

### Bug Fixes

- update package name from [@starkdev020](https://github.com/yuanyuanyuan) to
  [@starkdev020](https://github.com/starkdev020) in various files
  ([4dc3d44](https://github.com/yuanyuanyuan/codex-father/commit/4dc3d440e077a4e7c9440f2b4d8bb1db502beac8))

## [1.1.6](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.1.5...mcp-v1.1.6) (2025-10-03)

### Bug Fixes

- update package name from [@starkdev020](https://github.com/yuanyuanyuan) to
  [@starkdev020](https://github.com/starkdev020) in various files
  ([79a9803](https://github.com/yuanyuanyuan/codex-father/commit/79a9803470b391cb24cb9101c7d2d5ef605aab82))

## [1.1.5](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.1.4...mcp-v1.1.5) (2025-10-03)

### Bug Fixes

- update package name for codex-mcp-server from
  [@starkdev020](https://github.com/yuanyuanyuan) to
  [@starkdev020](https://github.com/starkdev020) in package-lock.json
  ([c52c02d](https://github.com/yuanyuanyuan/codex-father/commit/c52c02df0656536f4de8b8a6773857d54aacaddf))

## [1.1.4](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.1.3...mcp-v1.1.4) (2025-10-03)

### Bug Fixes

- **release:** add NODE_AUTH_TOKEN and NPM_TOKEN to Debug npm identity step
  ([b08c787](https://github.com/yuanyuanyuan/codex-father/commit/b08c787c7a33ef45383bb9b18835236c540ed11b))

## [1.1.3](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.1.2...mcp-v1.1.3) (2025-10-03)

### Bug Fixes

- update package-lock.json to change package name from
  @starkdev020/codex-father-mcp-server to @starkdev020/codex-father-mcp-server
  ([7ae4817](https://github.com/yuanyuanyuan/codex-father/commit/7ae48173459d8de5e940fcaa0d5936877680de8f))

## [1.1.2](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.1.1...mcp-v1.1.2) (2025-10-03)

### Bug Fixes

- **release:** 修复 @semantic-release/exec
  publishCmd 模板变量转义，使用 判断以避免 SyntaxError
  ([33e16c9](https://github.com/yuanyuanyuan/codex-father/commit/33e16c93448e19f2d26cbeff894a24f03b8070e8))

## [1.1.1](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.1.0...mcp-v1.1.1) (2025-10-03)

### Bug Fixes

- **mcp:**
  处理子进程 error 事件以避免挂起并返回明确错误 ([bc1a6c6](https://github.com/yuanyuanyuan/codex-father/commit/bc1a6c6cc147ed2f84e5d62ec0b7cc5b6e6533c1))

# [1.1.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.0.0...mcp-v1.1.0) (2025-10-03)

### Bug Fixes

- **mcp:** add error guard in run() to avoid unresolved spawn errors
  ([7dbea2c](https://github.com/yuanyuanyuan/codex-father/commit/7dbea2cbe3375d16b282accd13e93d7f13d852e5))

### Features

- **ci:** publish to npmjs via exec (if NPM_TOKEN); keep GH Packages publish
  ([68afd0f](https://github.com/yuanyuanyuan/codex-father/commit/68afd0ff3b8f659142a54ff46c29a8d5ade5d21f))

# 1.0.0 (2025-10-03)

### Bug Fixes

- **ci:** 仅为 [@starkdev020](https://github.com/yuanyuanyuan) scope 配置 GH
  Packages，保持 npx 从 npmjs 安装 semantic-release
  ([153f6f5](https://github.com/yuanyuanyuan/codex-father/commit/153f6f5b3af58692620e393912fe479d12d1310d))
- **cli:** stabilize tsx startup path
  ([a519f72](https://github.com/yuanyuanyuan/codex-father/commit/a519f7260e2dcaf18781ca1977e884166dd320b4))
- **cli:** 校对 refer-research codex CLI 参数\n\n-
  start.sh: 新增 --approval-mode，兼容旧 --approvals → 映射为 -c
  approval_policy=<policy>\n- 文档: 用 --approval-mode /
  --codex-config 替代 --approvals；补充用法示例\n-
  mcp: 保持仅注入 --sandbox；如需审批策略请使用 --codex-config
  approval_policy=...
  ([6a24bb3](https://github.com/yuanyuanyuan/codex-father/commit/6a24bb39c1e60cc7e2ef388ef5599c8ce41c58da))
- **mcp:** 移除默认注入 --approvals 以兼容精简版 Codex
  CLI；更新文档说明 ([56fabc1](https://github.com/yuanyuanyuan/codex-father/commit/56fabc1125951c8a178e7c6ba68ee083b07cd977))
- **specs:** resolve critical specification issues and align with repository
  reality
  ([591307d](https://github.com/yuanyuanyuan/codex-father/commit/591307d0aee77ccecfac7fc5d3cc7a7ce74297e2))
- **start,common:**
  稳定 --json 输出与 classify_exit 容错 ([66f86aa](https://github.com/yuanyuanyuan/codex-father/commit/66f86aa1034a784babd00f3584ff86d3024fd694))

### Features

- add Codex JSON-RPC and MCP protocol contract tests
  ([6bc0e0f](https://github.com/yuanyuanyuan/codex-father/commit/6bc0e0fc9348e0ad40607339c25a8c679bef25ad))
- add Makefile and enhance scripts with default safety injections for MCP
  commands
  ([f2de614](https://github.com/yuanyuanyuan/codex-father/commit/f2de614f9e987a8dc8aae32bf0f0bb3651b872a6))
- **cli:** add config command
  ([b7c0adf](https://github.com/yuanyuanyuan/codex-father/commit/b7c0adf7f41555cd5df8b1bebb32f3459c05259d))
- **cli:** add secure config access handler
  ([41fce21](https://github.com/yuanyuanyuan/codex-father/commit/41fce212ff5f344f7988c68f593b79066ad64149))
- **cli:** add task command handler
  ([abeb4be](https://github.com/yuanyuanyuan/codex-father/commit/abeb4be9c97178dfb6cbe321382dcd021d786b65))
- **cli:** expose status performance metrics (T098)
  ([a3366f8](https://github.com/yuanyuanyuan/codex-father/commit/a3366f80f294083f8975ea8314a8b4760d9eb68f))
- **cli:** implement complete CLI core framework (T086-T091)
  ([caa9b38](https://github.com/yuanyuanyuan/codex-father/commit/caa9b38258ad0d7d8383eb2a0bf8d9dd0995f762))
- **cli:** 新增 --patch-mode 补丁模式\n\n-
  start.sh: 注入 policy-note（初始与每轮），日志标注 Patch Mode\n- docs:
  usage/readme.mcp/readme 说明补丁模式场景与示例\n\n用法：--patch-mode（可配合 --sandbox
  read-only --approvals
  never） ([a40480d](https://github.com/yuanyuanyuan/codex-father/commit/a40480df573145fd5990ce53b2bbca80c3f2e423))
- **core:** 实现数据模型/验证/存储层 T031-T045 并补充单元测试\n\n- models:
  technical-architecture, directory-architecture, code-quality,
  test-architecture, task-queue-system, configuration, security-compliance\n-
  validation: data-validator, parameter-validator\n- storage: file-storage
  (原子写入/文件锁/备份), config-storage (路径映射), log-storage (轮转)\n-
  utils: common (semver/深拷贝/clamp/路径)\n- errors: error-manager\n-
  tests: 覆盖新增模块，确保 core/lib 100% 覆盖率\n-
  specs: 更新 T031-T045 任务状态为 COMPLETED\n\n注: 忽略已知集成测试环境问题（spawn
  node
  ENOENT/uv_cwd） ([23a263d](https://github.com/yuanyuanyuan/codex-father/commit/23a263ddba93d80b8b9a4cb73aad03e10dca912b))
- **docs:** add project direction adjustment and architecture recommendations
  for MCP and exec modes
  ([87b925f](https://github.com/yuanyuanyuan/codex-father/commit/87b925f1671baa71812857aeb8e3c48b324ccb31))
- **docs:** complete MVP1 polish phase and prepare for release
  ([2effda9](https://github.com/yuanyuanyuan/codex-father/commit/2effda9de8573a4db47889b9944c82f364d4ba8d))
- Implement Codex JSON-RPC Client and Protocol Types
  ([57fe105](https://github.com/yuanyuanyuan/codex-father/commit/57fe105fc829980f7a262583de63c94bf1da22bf))
- Implement Terminal UI for approval process with user interaction
  ([1f4b760](https://github.com/yuanyuanyuan/codex-father/commit/1f4b760cf6283420181f77c776399c8753f7677d))
- **mcp): 增加 codex.exec 同步执行\n\n- docs(usage:**
  补充 instructions 覆盖/追加与启停规则\n- test: 扩充 TS
  MCP 端到端用例，覆盖 exec/start/status/logs\n- chore:
  .gitignore 忽略 runs/ 产物\n\nE2E:
  tests/mcp_ts_e2e.sh 通过 ([d31dcbc](https://github.com/yuanyuanyuan/codex-father/commit/d31dcbc944b61a1d6ea97ea05458fe78eab6ff21))
- **mcp:** add TypeScript MCP server (codex-father-mcp-server) using
  @modelcontextprotocol/sdk; docs updated with deepwiki usage
  ([52cd9ec](https://github.com/yuanyuanyuan/codex-father/commit/52cd9ec04277a6f38a46722e1a0c7aa7ecb4ad5c))
- **mcp:** 发布 GH Packages 首版\n\n- 新增 GH
  Packages 工作流（semantic-release，GITHUB_TOKEN）\n- 包名改为 scope:
  @starkdev020/codex-father-mcp-server\n-
  CLI 增强：未知参数建议、--docs 支持目录/@列表/\*\*，失败调试信息\n- 文档完善与 smoke 测试（unknown-arg
  /
  docs 成功/失败） ([698ca1f](https://github.com/yuanyuanyuan/codex-father/commit/698ca1f6f503c166e73882a31e493ad273807c58))
- **mcp:**
  支持便捷参数并改进运行兼容性 ([93cd68e](https://github.com/yuanyuanyuan/codex-father/commit/93cd68e061606c6728da1856fa4ad57f134fa9ef))
- **mcp:** 映射更多运行控制参数到 start.sh
  ([83eacac](https://github.com/yuanyuanyuan/codex-father/commit/83eacaca826b948020a286831b9931174cb14fa3))
- **models:** add template entity validation (T012)
  ([950fa79](https://github.com/yuanyuanyuan/codex-father/commit/950fa797de53f9f0f512d9b0d844b4e153b9ebda))
- **models:** add version lifecycle core (T013)
  ([dcf788f](https://github.com/yuanyuanyuan/codex-father/commit/dcf788f8f8957cede9be5ce3fc4db5be34ebe02a))
- **models:** extend review status workflow (T014)
  ([926efe4](https://github.com/yuanyuanyuan/codex-father/commit/926efe40634b9274c300dbbf1f4cf94c2d3d039c))
- **models:** implement prd draft core (T011)
  ([d0bde90](https://github.com/yuanyuanyuan/codex-father/commit/d0bde90070e54e9438f0b2495912547fa9ff3b78))
- **phase1:** implement foundational TypeScript infrastructure for phase 1
  ([cfded17](https://github.com/yuanyuanyuan/codex-father/commit/cfded17e8b902650d92a00095a2181bb2bbff1cb))
- **queue:** add filesystem queue contract tests (T015)
  ([8123f9f](https://github.com/yuanyuanyuan/codex-father/commit/8123f9fc155ace2eb0eac65831b855ce4c933ede))
- **queue:** add statistics collector contract tests
  ([4d650d5](https://github.com/yuanyuanyuan/codex-father/commit/4d650d5b2fbeb2896c2af793a954de1e29f08304))
- **queue:** add task filter contract support
  ([10e9ce4](https://github.com/yuanyuanyuan/codex-father/commit/10e9ce4469eda01e43e57122078cc9761dc38271))
- **queue:** deliver event emitter contract tests (T016)
  ([5eb7aa3](https://github.com/yuanyuanyuan/codex-father/commit/5eb7aa39e59cd78d11eeb03e315ef0f267476b58))
- **queue:** implement basic task queue system (T092-T096)
  ([bbd6616](https://github.com/yuanyuanyuan/codex-father/commit/bbd6616266962b1081e351538dea1151d03fb84f))
- **queue:** implement operation result contracts
  ([990e621](https://github.com/yuanyuanyuan/codex-father/commit/990e621385a27da07a4cd358686ef3bdb8823923))
- **queue:** implement task executor contract metrics (T014)
  ([26d7f50](https://github.com/yuanyuanyuan/codex-father/commit/26d7f50e49d248a29a57c63cf8a0db7802d87568))
- **queue:** support task definition contract (T010)
  ([1f1c742](https://github.com/yuanyuanyuan/codex-father/commit/1f1c742cbe46bd3408c8175ed27f7392b673c952))
- **queue:**
  T066-T080 队列系统增强 ([e4b169e](https://github.com/yuanyuanyuan/codex-father/commit/e4b169e702fb679f189da3196581992b6e324a7e))
- **spec:** add Codex Father MCP Integration specification
  ([6888bf7](https://github.com/yuanyuanyuan/codex-father/commit/6888bf73064cdc01b96166ff384e9d9bc03df16f))
- **specs,core,docs,tests:**
  引入“006 文档能力评估”，整理文档结构并补充测试 ([19bf4d8](https://github.com/yuanyuanyuan/codex-father/commit/19bf4d81a629d78537feebd3c7566828c1566d52))
- **storage:**
  将会话与日志改为按项目根存放于 .codex-father/sessions/<job-id>/\n\n-
  start.sh: 支持 CODEX_SESSION_DIR / 默认会话目录，聚合落入会话文件夹\n-
  job.sh: 以
  <cwd>/.codex-father/sessions 为根；status/logs/stop/list 支持 --cwd\n- mcp
  server: codex.exec 在会话根创建目录；logs/status/stop/list 支持 cwd\n-
  docs: 更新 usage 与 MCP README，readme.mcp.md 路径说明\n- tests:
  E2E 传递 cwd，验证通过 ([f5aaff5](https://github.com/yuanyuanyuan/codex-father/commit/f5aaff5c88ce83deaba5842d98e449c606e861ab))
- **tests:** add integration tests for approval flow and MVP1 single process
  ([8e7d8fd](https://github.com/yuanyuanyuan/codex-father/commit/8e7d8fdddcfce21aa1bbed43ebd5c531f66d6ee0))
- **tests:** add manual acceptance test results and performance benchmarks
  ([45a08e0](https://github.com/yuanyuanyuan/codex-father/commit/45a08e0aa8f706a705145c2f6a09a24ac900d5df))
- **tests:** complete T097 - Phase 1 integration test suite
  ([2971e93](https://github.com/yuanyuanyuan/codex-father/commit/2971e93abc961590472444c12279aa2e62215314))
- update project structure and documentation for session management
  ([143765f](https://github.com/yuanyuanyuan/codex-father/commit/143765fc9bb7d842bad02080384dfa1a91dc342f))
- Update tasks documentation and add manual test report
  ([fed6c66](https://github.com/yuanyuanyuan/codex-father/commit/fed6c661fb5e901b8e6028ad76e3de0a0fda1ecf))

### BREAKING CHANGES

- **queue:** 引入新的队列管理入口与结构，需按新命令使用

# 1.0.0 (2025-10-03)

## [Unreleased]

### Features

- **mcp:** add `codex.help` discovery tool (lists all tools with example
  payloads; supports markdown/json).
- **mcp:** add underscore aliases for all tools: `codex_exec`, `codex_start`,
  `codex_status`, `codex_logs`, `codex_stop`, `codex_list`, `codex_help`.

### Tests

- add lightweight alias e2e: `tests/mcp_aliases_e2e.sh` (verifies `tools/list`
  contains `codex_start`, and `tools/call` for `codex_status`/`codex_logs`).

## [1.4.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.3.0...mcp-v1.4.0) (2025-10-05)

### Features

- cli: add `--help`/`--version` and startup banner; default NDJSON transport;
  support `--transport=content-length`
- tools: add `codex.clean` and `codex.metrics`; enhance `codex.logs` with `view`
  param

### Fixes

- transport: improve Content-Length framing error handling and diagnostics

### Docs

- usage: clarify binary name `codex-mcp-server` and update installation examples

---

## [1.3.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.2.0...mcp-v1.3.0) (2025-10-05)

### Features

- tools: add underscore aliases for all `codex.*` tools (e.g. `codex_exec`)
- naming: support `CODEX_MCP_NAME_STYLE=underscore-only|dot-only`
- naming: support `CODEX_MCP_TOOL_PREFIX` and `CODEX_MCP_HIDE_ORIGINAL`
- docs: add `codex.help` discovery tool with examples

---

## [1.2.0](https://github.com/yuanyuanyuan/codex-father/compare/mcp-v1.1.8...mcp-v1.2.0) (2025-10-04)

### Features

- compat: detect Codex CLI version; gate incompatible cli flags and config keys;
  return `CODEX_VERSION_INCOMPATIBLE` with details

### Fixes

- errors: unify JSON error payloads and hints; fast-fail when codex binary
  missing

---
