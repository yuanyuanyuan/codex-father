结论概要

- 已覆盖所有失败会话与异常片段，定位明确可重现的原因与改进方向。
- 归纳出多次出现的“参数重复/配置解析错误”“路径误用”“上下文超限”“流式中断”“模块未构建”等高频问题。
- 正常完成的会话中出现“临时流断线自动重试”“路径探测纠正”“审批策略自动归一化”等曲折过程。

错误与异常

- 重复参数导致 CLI 失败 - 证据:
  .codex-father/sessions/exec-20251003_164252-mcp-run-test/job.log:67 - 现象: 同时出现 --ask-for-approval
  never 与 --ask-for-approval
  on-request，被解析为重复。- 原因: 上层脚本与内部规范化同时注入同一参数，未去重。- 规避: 在 start.sh 合成参数时做去重与优先级裁决；传入 Codex 前统一“单一来源”的审批策略。
- 配置覆盖语法错误
  - 证据: .codex-father/sessions/exec-20251003_164304-mcp-run-test/job.log:64
  - 现象: “Invalid override (missing '='): .mcp.json”
  - 原因: 误用 -c/覆盖语法，传入文件路径而非 key=value。
  - 规避: 统一使用 --config .mcp.json；如需 -c，强制校验格式并报人类可读提示。
- 路径误用（文件不存在）- 证据:
  .codex-father/sessions/cdx-20251003_205041-phase-3.3-core-implementation/
  job.log:625 - 现象:
  sed 访问 core/orchestrator/orchestrate-command.ts 失败。- 原因: 实际文件在 core/cli/commands/orchestrate-command.ts，模块布局认知偏差。- 规避: 读前校验 test
  -f，或维护路径映射表；rg 先定位再读写。
- 模块未构建（Node ESM 解析失败）- 证据:
  .codex-father/sessions/cdx-20251003_200054-phase-3.2-t005-t010/job.log:906 - 现象:
  Error [ERR_MODULE_NOT_FOUND]: ... core/cli/parser.js - 原因:
  TypeScript 未构建，JS 产物缺失；或在 eval 场景用到构建产物路径。- 规避: 引入“预构建门禁”：运行前若找不到 dist/JS 产物，则执行 npm
  run build；或测试态用 ts-node/tsx。
- Redaction 白名单正则不合法
  - 证据:
    .codex-father/sessions/cdx-20251003_191024-phase-3.1-setup/job.log:892,905
  - 现象: “Skipping invalid regex pattern ... Unterminated character class”
  - 原因: 外部/配置中混入无效正则。
  - 规避: 载入前逐条 TryCompile，失败给出用户态修复建议并忽略该条；记录警告但不中断。
- 上下文超限（会话失败）- 证据:
  .codex-father/sessions/cdx-20251003_200054-phase-3.2-t005-t010/ state.json:4,
  .codex-father/sessions/cdx-20251003_191024-phase-3.1-setup/state.json:4 - 现象:
  state=failed, classification=context_overflow，tokens_used 分别达 257,328 /
  210,804。- 原因: 读取/拼接内容过大，未做预算切分。- 规避: 执行前做 Token 预算与分块读；启用摘要/采样策略，分阶段执行并回写中间状态。
- 早期参数错误/非零退出（无详细正文）- 证据:
  .codex-father/sessions/cdx-20251003_202928/job.log:1, .codex-father/sessions/
  cdx-20251003_202842-phase-3.2-t031-t043-v2/job.log:1,
  .codex-father/sessions/cdx-
  20251003_202313-phase-3.2-t031-t043/job.log:1 - 现象: Trap 捕获 Exit Code:
  2，早期失败。- 原因: 多为参数合成/校验阶段失败（与上两类相符）。- 规避: 在 Codex 调用前打印“最终参数快照”与规则校验，发现异常立即纠正或回退默认值。

成功但过程曲折

- 流式连接中断自动重试后成功
  - 证据: .codex-father/sessions/cdx-20251003_195007-phase-3.1-t004/job.log:1507
  - 现象: 传输体解码异常导致流断开，随后 5 次以内重试并完成任务，最终 exit_code
    0。
  - 改进:
    SSE/WebSocket 增强指数退避与断点续传；幂等事件消费，保证重复送达不影响结果。
- 路径纠正后继续推进 - 证据: 先报错 .codex-father/sessions/cdx-20251003_205041-phase-3.3-core-
  implementation/job.log:625，后正确打开 .codex-father/sessions/cdx-20251003_205041-phase-
  3.3-core-implementation/job.log:...（随后访问 core/cli/commands/orchestrate-command.ts）- 现象: 首次读错路径，迅速切换到正确路径继续实现。- 改进: 读文件一律“rg
  → 确认 → 读”，减少蒙写蒙读。
- 审批策略自动归一化避免只读降级 - 证据: 多个会话头部提示“已设置审批策略为 on-request（可写沙箱需要审批以避免只读降级）”，如 .codex-father/sessions/cdx-20251003_203126/job.log:6 附近 - 现象: 成功会话中策略被自动切换并保持一致性；失败会话是“自动归一化+手动指定”叠加导致重复。- 改进: 归一化前先检查是否已有同类参数，采用“最后写入 wins”并去重。

隐藏风险与改进

- 参数归一化冲突
  - 风险: “默认+用户+内部归一化”多源写入，易重复或互斥。
  - 改进: 单一真相源（SSOT）策略：先合并、再去重、最后落参；提供最终生效参数快照。
- 构建工序与运行时耦合 - 风险: 测试/执行时直接依赖构建产物路径，遇到“未构建/路径漂移”即失败。- 改进: 增加 Preflight：若无 dist 则自动 npm
  run build；开发态用 tsx 执行 TS 源；CI 中显式 job 划分（build→test→run）。
- 内容注入过载 - 风险: 指令拼接、文档大段读入、测试样例堆叠造成 Token 爆表。- 改进:
  Token 预算器（粗估+余量）；分块读（rg/局部 sed）；摘要化长文；阶段化输出（多任务拆分）。
- 外部工具/服务可靠性
  - 风险: npx -y
    @pimzino/spec-workflow-mcp@latest 需网络；流式中断需要健壮恢复。
  - 改进: 本地缓存或预安装；健康检查与超时；失败后降级到离线模式/跳过非关键工具。
- Redaction 配置健壮性 - 风险: 非法正则导致噪声与潜在中断。- 改进: 启动时对所有正则 TryCompile；给出定位明确的修复建议；在仪表盘/日志中标注忽略项。
- 审批策略与沙箱模式组合 - 风险:
  never 与 workspace-write 组合在某些路径触发只读降级或权限矛盾。- 改进: 组合矩阵校验，自动选择“on-request”作为兼容策略；若用户强制 never 则回退为“只读+解释原因”。
- 事件流与幂等
  - 风险: 流中断、重复事件导致状态紊乱。
  - 改进: 事件带递增 id 与去重缓存；消费者持久化 lastEventId，实现断点续传。
- 日志噪声与效能
  - 风险: 过多“succeeded in Xms”、大段文档镜像到日志，掩盖异常。
  - 改进: 日志分级与采样；异常窗口前后上下文定长截取；提供“错误索引”区块。

建议落地清单

- 参数层面 - 合并去重器：对 --ask-for-approval/--sandbox/--config 做“最后写入 wins”去重；输出最终快照。- 校验器：拒收 -c 非 key=value 的用法，提示改用 --config。
- 文件操作
  - 统一“定位→校验→读写”模式；先 rg 带 -n 定位路径，再 test
    -f，最后执行 sed/cat。
- 运行时与构建 - 增加 Preflight：node -e
  "require('./core/cli/parser.js')" 失败则自动构建或切换 tsx 执行。
- 内容与上下文 -
  Token 预算：基于 rough 字符估算，超过阈值走摘要/分页策略；日志仅输出摘要与跳转线索。
- 通信与流
  - SSE/WebSocket 客户端：指数退避、断点续传；事件幂等消费与去重队列。
- 配置健壮性
  - Redaction 模式：加载时校验，非法规则旁路且明确记录；拒绝中断主流程。

如需，我可以把上述改进点落到仓库的 start.sh/核心 CLI 层，加入参数归一化去重、预构建门禁与正则校验的最小实现，并补充对应的单元测试。

- 浮浮酱已系统梳理失败与成功会话，定位高频问题：参数重复与配置误用、路径误判、未构建导致的模块找不到、上下文超限、流式中断、正则规则不合法等。多数可在启动阶段通过“参数与环境预检”一次性规避，属于KISS/YAGNI取向的高收益修复喵～
- 正常完成的任务也存在“中途断流自动重试”“路径误读后再纠正”“审批策略自动归一”这类曲折过程，说明系统具备一定自愈能力，但缺少明确的前置防线与幂等治理。

失败与异常（证据/原因/建议）

- 重复审批参数导致 CLI 失败 - 证据:
  .codex-father/sessions/exec-20251003_164252-mcp-run-test/job.log:67, exec-
  20251003164552.-untagged/job.log:66 - 原因: 上层与内部归一化同时注入 --ask-for-approval，未去重。- 建议: 启动脚本参数归一化，最后写入优先，强制去重并输出“最终参数快照”。
- 配置覆盖语法误用
  - 证据: .codex-father/sessions/exec-20251003_164304-mcp-run-test/job.log:64
  - 原因: 用 -c 传文件路径，缺少 key=value。
  - 建议: 对 -c 强校验，失败提示改用 --config
    .mcp.json；自动纠错或中止并给出修复文案。
- 路径误读（文件不存在）- 证据:
  .codex-father/sessions/cdx-20251003_205041-phase-3.3-core-implementation/
  job.log:625 - 原因: 误将 orchestrate-command.ts 放在 core/orchestrator/，实际在 core/cli/
  commands/。- 建议: 统一“rg → test -f → 读写”的读前校验流程；维护常用路径映射。
- 模块未构建（ESM 产物缺失）- 证据:
  .codex-father/sessions/cdx-20251003_200054-phase-3.2-t005-t010/job.log:906 - 原因: 直接依赖 parser.js 等构建产物，未先 npm
  run
  build。- 建议: 运行前 Preflight：检查 dist/JS 产物；缺失则自动构建或用 tsx 直跑 TS（可配置）。
- 上下文超限（会话失败）- 证据:
  cdx-20251003_200054-phase-3.2-t005-t010/state.json:4, cdx-20251003_191024-
  phase-3.1-setup/state.json:4 - 原因: 大量文档/日志拼接进上下文，缺少预算与分块。- 建议:
  Token 预算器+分块读取+摘要策略；严格限制一次性输入规模。
- 流式断连
  - 证据: cdx-20251003_195007-phase-3.1-t004/job.log:1507
  - 原因: 传输体解码失败/网络瞬断。
  - 建议: 指数退避、lastEventId 断点续传、事件去重幂等。
- Redaction 白名单正则不合法
  - 证据: cdx-20251003_191024-phase-3.1-setup/job.log:892,905
  - 原因: 非法字符类导致正则异常。
  - 建议: 加载时 TryCompile，非法项旁路并输出可读修复建议，不中断主流程。

成功但过程曲折（优化点）

- 断流后重试成功：仍应实现幂等与断点续传，降低二次失败风险。
- 首次路径读错后纠正：在读前引入路径探测与存在性校验，可一次到位。
- 审批策略自动归一：应在归一化前去重，避免“自动归一+显式传参”叠加冲突。

是否需要做（优先级判断）

- 必做（P0，高收益低风险）
  - 参数归一化去重与最终快照输出
  - 覆盖语法强校验/自动纠错（-c 与 --config）
  - Preflight 构建门禁（缺产物→构建/tsx）
  - Token 预算与分块/摘要
  - Redaction 正则校验旁路
- 应做（P1，中收益）
  - 流式幂等与断点续传（lastEventId + 去重缓存）
  - 常用路径映射与读前探测
- 可做（P2，增强）
  - 日志降噪与“错误索引”区块
  - 审批/沙箱组合矩阵校验与自愈策略

完整方案（怎么做）

- 参数归一化与快照 - 变更: start.sh,
  lib/common.sh - 做法: 聚合所有来源参数→去重（同名 flag 仅保留最后一个）→输出“Final
  Args:”快照→再调用 Codex。- 验证: 新增脚本测试覆盖“重复 ask-for-approval 被消解”；保持现有 tests/
  smoke_start_args_forwarding.sh 通过。
- 覆盖语法与配置校验 - 变更: start.sh,
  core/cli/config-loader.ts - 做法: 拦截 -c 非 key=value，提示改用 --config；config-loader 对 redaction/whitelist 正则 TryCompile，失败项记录到警告集合。- 验证: 添加单测：非法正则被忽略且给出 diagnostics；错误覆盖立即报错并带修复指引。
- Preflight 构建门禁 - 变更:
  start.sh - 做法: 检查 core/cli/parser.js 或 dist/\*\*；缺失则执行 npm run
  build（失败则提示“构建失败，改用 tsx/或手动安装依赖”）；可通过 --no-build 跳过。- 验证:
  e2e 启动时无 dist 也能自动构建或给出明确动作建议；复现 ERR_MODULE_NOT_FOUND 消失。
- Token 预算与读取策略 - 变更:
  start.sh（拼接指令前），必要时在 orchestrator 消费层添加“长文自动摘要”钩子 - 做法: 估算 tokens≈字符数/4；超过阈值则切分/只读 Top-N/使用锚点提取；对长 Markdown输出摘要段。- 验证: 复现 context_overflow 场景转为“降级执行+摘要”，state 由 failed→completed。
- 流式幂等与断点续传
  - 变更: core/session/event-logger.ts, 事件消费处
  - 做法: 事件附带自增 eventId，落地 lastEventId；重连带上标头/查询；消费端按 id 去重。
  - 验证: 人为注入断流（模拟）后事件序列完整且无重复副作用。
- 路径探测与映射 - 变更: 涉及文件读取的辅助工具（shell/TS层）- 做法: 统一先 rg
  -n 或 glob 定位，再 test -f；为常见文件维护候选列表，如 core/cli/
  commands/orchestrate-command.ts。- 验证: 复现“sed: can't read ...”不再出现。
- 日志与可观测性（可选）
  - 变更: 运行日志生成
  - 做法: 增加“错误索引”与“参数快照”区块；对海量成功日志进行采样输出。
  - 验证: 故障定位时间缩短，日志体积可控。

测试与验收

- Bash 脚本测试
  - 新增：参数去重、-c 校验、无 dist 自动构建（或明确失败文案）
- TS 单测
  - config-loader 非法正则旁路与诊断
  - 事件流幂等：重复事件不产生副作用；断点续传恢复
- E2E
  - 重放本次失败样例：三类失败均转为成功或给出清晰可操作错误
  - 关注 exit_code=0 与汇总信息（包含 successRate / 无 patch_failed）

风险与回滚

- 风险: 自动构建可能受网络/依赖影响
  - 缓解: 增加 --no-build 与清晰提示；优先 tsx（如可用）
- 风险: 参数去重误伤真实需求
  - 缓解: 最终快照+日志；允许 --strict-args 强制报错模式
- 风险: 流式改造触及现有消费者
  - 缓解: feature flag 渐进启用，回滚简单（关闭幂等/断点续传即可）

实施顺序（两阶段）

- Phase 1（P0，1–2 天）
  - 参数归一化与最终快照（start.sh, lib/common.sh）
  - 覆盖/配置校验（start.sh, core/cli/config-loader.ts）
  - Preflight 构建门禁（start.sh）
  - Redaction 正则 TryCompile 旁路（config-loader）
  - 基础测试（Bash/TS）
- Phase 2（P1，2–4 天）
  - Token 预算与分块/摘要
  - 事件流幂等与断点续传（event-logger.ts）
  - 路径探测与映射辅助
  - E2E 回归与日志降噪
