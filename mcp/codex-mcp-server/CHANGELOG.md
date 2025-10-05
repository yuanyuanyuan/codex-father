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
