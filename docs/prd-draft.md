对当前项目的开发方向要调整一下，要优先实现MCP模式，然后再实现CLI模式，



下面的是具体的调整参考思路：


  - 先明确“对外协议”和“对内引擎”两层：
      - 对外协议：尽量统一为 MCP（外部生态兼容最好）。若外部不支持 MCP，再补充 HTTP/队列等网关。
      - 对内引擎：优先使用 codex MCP（单进程可并发多会话）；必要时按作业隔离用多进程 codex exec（非交互）作为后备。

  两种后端模式取舍

  - MCP 后端（推荐优先）
      - 单个进程 codex mcp 即可承载多会话并发（会话在进程内管理），无需额外队列就能吞吐多请求；外部通过 MCP tools/call codex 开
  局、codex-reply 续写。参见 refer-research/openai-codex/docs/advanced.md:75、refer-research/openai-codex/codex-rs/mcp-server/src/
  message_processor.rs:28、refer-research/openai-codex/codex-rs/mcp-server/src/codex_tool_runner.rs:1
      - 工具入参原生支持 model、approval-policy、sandbox、config 等，安全/策略按调用粒度注入即可。见 refer-research/openai-codex/codex-rs/
  mcp-server/src/codex_tool_config.rs:16
      - 连续事件以 JSON-RPC 通知推送，tools/call 的最终应答在任务完成/错误时返回（中间过程走通知）。见 refer-research/openai-codex/codex-
  rs/mcp-server/src/codex_tool_runner.rs:128
      - 适合：你要对外暴露 MCP；单实例即可高并发；希望强类型入参/事件。
  - exec 后端（作业级多进程隔离）
      - 使用 codex exec --json 做单次任务；继续同一会话用 codex exec resume <SESSION_ID>。参见 refer-research/openai-codex/codex-rs/exec/
  src/cli.rs:10、refer-research/openai-codex/docs/advanced.md:29
      - 每个作业一个子进程，天然进程级隔离，资源、崩溃、超时互不影响。适合“任务队列/可恢复”的父管控。
      - 不建议 echo "..." | codex --yolo：--yolo极不安全；且 TUI 不是为非交互管道设计。用 codex exec --json 更合适。参见 refer-research/
  openai-codex/docs/sandbox.md:34

  建议的 codex-father 架构

  - 控制面
      - 对外：实现一个 MCP 服务器（或 HTTP API），统一外部协议。若外部要求 SSE，可用 mcp-proxy/自建转发。
      - 对内：配置两种“执行器”：
          - 执行器A：常驻单例 codex mcp，在进程内多会话并发；father 作为 MCP 客户端路由请求到该进程，维护 request_id → conversationId 映射
  与取消。
          - 执行器B：按需派生 codex exec --json 子进程；father 维护作业队列与并发度。
  - 队列与并发
      - MCP 模式下单进程即可并发，多路复用在 codex mcp 内；father 仍可做“入队-调度-超时-取消”统一治理。
      - exec 模式下每个作业一个进程；设置全局并发上限、每作业 CPU/内存/cgroup 限制（可选），避免过载。
  - 生命周期与可恢复性
      - MCP 会话是进程内态，进程重启后无法 resume；适合长命进程、内存足够的场景。
      - exec 会话可通过 resume 继续，适合需要“离线恢复/重启续跑”的场景。参见 refer-research/openai-codex/docs/advanced.md:32
  - 取消/超时
      - MCP：发 CancelledNotification（MCP 语义）；codex-mcp 将转成 Interrupt 终止当前 turn。见 refer-research/openai-codex/codex-rs/mcp-
  server/src/message_processor.rs:313
      - exec：直接 kill 进程，或父侧设置“软超时→强制终止”两段式。
  - 策略与安全
      - 默认不要 --yolo。用：
          - MCP 工具入参："approval-policy":"on-request"|"on-failure"|"never"、"sandbox":"workspace-write"|"read-only"|...（每调用粒度）。
  见 refer-research/openai-codex/docs/advanced.md:87
          - exec：--sandbox workspace-write --ask-for-approval on-request 或 --full-auto；网络按需在 config.toml 启用。见 refer-research/
  openai-codex/docs/sandbox.md:36、refer-research/openai-codex/docs/config.md:404
  - 事件与日志统一
      - MCP：接收 JSON-RPC Notification（Codex 事件流）+ tools/call 最终 Response，将两者落盘为 JSONL 与元数据。
      - exec：使用 --json，逐行 JSON 事件写入 events.jsonl；同时解析 Token usage/Resume 提示等摘要。参见 refer-research/openai-codex/codex-
  rs/cli/src/main.rs:183
      - 产物规范化到 .codex-father/sessions/<job-id>/ 下：stdout.log、events.jsonl、.meta.json、.instructions.md。遵循你的仓库规范。
  - 目录与权限
      - 为每作业设置独立 cwd（工作区），便于 workspace-write 精确授权与清理。可通过 MCP cwd 或 exec 的 -C/--cd 注入。见 refer-research/
  openai-codex/codex-rs/mcp-server/src/codex_tool_config.rs:31、refer-research/openai-codex/codex-rs/tui/src/cli.rs:35
  - 超时与背压
      - MCP：startup_timeout_sec/tool_timeout_sec（配置外部 MCP 服务器用）；Codex MCP 的长任务建议外部客户端将请求/总超时调大（如 600s），
  并在 father 侧有全局超时与队列背压。见 refer-research/openai-codex/docs/config.md:372、refer-research/openai-codex/docs/advanced.md:108
      - exec：父队列设置最大运行时（如 10–20 分钟），到期软中断（向下游发取消）、再硬 kill。
  - 伸缩与隔离
      - 单实例 codex mcp 足以承担并发；若内存/CPU 成本偏高，可多实例分片（例如按租户/哈希路由），father 维护路由表。
      - exec 工作器建议固定池大小（按核数），避免进程风暴；必要时容器化并在容器内设限。
  - 统一任务模型（建议）
      - JobSpec（入参）：prompt/model/profile/cwd/approval-policy/sandbox/config/attachments
      - Backend：mcp | exec
      - Policy：retries、timeout、max_output_bytes、log_level
      - father 将 JobSpec 映射为 MCP codex 调用入参或 exec 的 CLI flags，屏蔽两后端差异。
  - 观测与调试
      - 打开 RUST_LOG：codex mcp/codex exec 均可输出 tracing 到 stderr；father 侧汇聚。见 refer-research/openai-codex/docs/advanced.md:51
      - 沙箱验证：codex debug seatbelt|landlock [--full-auto] CMD...，复现权限问题。见 refer-research/openai-codex/docs/sandbox.md:72

  具体落地建议

  - 对外优先 MCP：codex-father 本身实现为 MCP 服务器。外部统一连 father；father 内部作为 MCP 客户端，默认把请求路由到“常驻的一个 codex mcp
  实例”。这样你在父层有清晰的 request_id↔conversationId 管控、取消、监控。
  - 保留 exec 回退路径：当需要“可恢复/可审计/作业隔离”时，father 将某些任务路由到 exec 后端（独立进程），用 --json 采集事件，用 resume 续
  写。此路径非常适合“队列作业”。
  - 队列与作业目录：为每作业创建 .codex-father/sessions/<job-id>/，落盘 stdout、JSONL 事件、元数据（包含 backend、flags、开始/结束时间、退
  出码、conversationId 等），与已有 job.sh/start.sh 体系对齐。
  - 安全默认值：不启用 --yolo；MCP 工具入参默认为 approval-policy: on-request + sandbox: workspace-write；exec 默认 --sandbox workspace-
  write --ask-for-approval on-request，必要时才 --full-auto；网络默认禁用，需任务白名单显式开启。
  - 取消与健康检查：父层要支持 per-job cancel（MCP 发 Cancelled；exec 杀进程）、liveness（子进程心跳/文件更新）、超时（软硬两段式）、并发配
  额（全局/租户/模型维度）。

  示例命令片段

  - 常驻 MCP 实例（father 启动时拉起）：
      - RUST_LOG=info codex mcp
  - 通过 MCP 发起一次会话（外部/或 father 内部）：
      - tools/call name="codex" arguments={"prompt":"…","model":"o3","approval-policy":"on-request","sandbox":"workspace-write","cwd":"/
  work/foo"}
  - exec 作业：
      - 首次：codex exec --json -C /work/foo --sandbox workspace-write --ask-for-approval on-request "build X feature"
      - 续写：codex exec resume <SESSION_ID> --json "continue with Y"

  何时选哪条路径

  - 多租并发、长驻服务、生态兼容 → MCP 后端优先
  - 强隔离/可恢复/离线队列、对 MCP 生态无硬需求 → exec 后端优先
  - 也可混合：默认 MCP，特定作业（大内存/易崩/要重放）走 exec

  - MCP 后端天生支持多会话并发：每次 tools/call 都在 codex-mcp 进程内独立异步执行，互不阻塞。你可以在 codex‑father 层做配额/队列/超时/取消
  等“统一治理”。
  - 日志有两类：进程日志（stderr，受 RUST_LOG 控制）和“会话事件日志”（Codex 事件流 + 会话 rollout JSONL 文件）。建议在 father 侧做统一采
  集、按会话归档与索引。

  并发模型（MCP 端）

  - 每个 tools/call 都会被放入独立异步任务处理，不阻塞主读取循环：
      - 参考：refer-research/openai-codex/codex-rs/mcp-server/src/message_processor.rs:420 启动 tokio::spawn 承载一次 codex 会话；工具逻辑
  见 codex_tool_runner.rs:39
  - 会话标识与关联
      - MCP RequestId ↔ Codex ConversationId 由服务端维护映射，便于取消/路由后续消息：refer-research/openai-codex/codex-rs/mcp-server/src/
  message_processor.rs:46, 582
      - 初次 tools/call codex 返回 SessionConfigured 事件（含 session_id/model/rollout_path 等），之后以事件通知持续推送：refer-research/
  openai-codex/codex-rs/protocol/src/protocol.rs:1181
  - 取消/中断
      - 客户端发 CancelledNotification 即可；服务端映射到对应 conversation 并提交 Interrupt：refer-research/openai-codex/codex-rs/mcp-
  server/src/message_processor.rs:582
  - 并发上限
      - codex‑mcp 内部不主动限流；父层应通过队列/信号量控制同时运行的 tools/call 数量，或分片到多个 codex‑mcp 实例。

  交互审批（Elicit）

  - 当需要命令执行/应用补丁审批时，服务端会向客户端发 ElicitRequest，客户端需回复决策：
      - Exec 审批流程：refer-research/openai-codex/codex-rs/mcp-server/src/exec_approval.rs:1
      - Patch 审批流程类似：mcp-server/src/patch_approval.rs
  - father 作为 MCP 客户端要做的事：
      - 监听 ElicitRequest，渲染为你 UI/策略，再发回 ExecApprovalResponse/…；
      - 建议做“策略引擎”：按作业/租户/命令白名单自动批准或落到人工审批。

  事件与日志

  - 事件流（强烈建议记录）
      - codex‑mcp 会把所有 Codex 事件作为 JSON‑RPC 通知推送（method: "codex/event"），并在 params._meta.requestId 带回对应的原始 tools/
  call：refer-research/openai-codex/codex-rs/mcp-server/src/outgoing_message.rs:180, 236
      - 关键事件：SessionConfigured（含 rollout_path）、TaskStarted/TaskComplete、TokenCount、ExecCommandBegin/End/OutputDelta、
  McpToolCallBegin/End 等：refer-research/openai-codex/codex-rs/protocol/src/protocol.rs:392
      - 做法：father 把全部通知落盘 JSONL（包含时间戳/会话 id/request id/事件体），便于回放与审计。
  - 会话 rollout 文件（服务器本地生成）
      - SessionConfigured 事件里有 rollout_path，指向服务器侧的 JSONL 历史文件：refer-research/openai-codex/codex-rs/protocol/src/
  protocol.rs:1203
      - 可在会话结束后调用服务端“归档”逻辑（移动到 archived‑sessions）；见：refer-research/openai-codex/codex-rs/mcp-server/src/
  codex_message_processor.rs:795
      - father 可以选择：仅用事件流自建日志，或把 rollout_path 作为旁路取证材料（需要读服务器磁盘或通过自定义 RPC）。
  - 进程日志
      - codex‑mcp 初始化 tracing，默认输出到 stderr，RUST_LOG 控制级别：refer-research/openai-codex/codex-rs/mcp-server/src/lib.rs:22
      - father 以 supervisor 身份启动时，将 stderr 重定向到 per‑instance 日志，并做滚动与采样。

  管理建议（father 侧）

  - 并发与队列
      - 全局/租户级信号量控制并发；超过限额排队。
      - 任务状态：queued → running → completed/failed/cancelled；记录开始/结束时间、模型、策略、token 使用（来自 TokenCount 事件）。
  - 超时与取消
      - 每个 tools/call 设置总时限（如 10–20 分钟）；到时先发 Cancelled，再强制清理；统计超时率。
  - 审批策略
      - 缺省拒绝网络/越权路径；对安全命令白名单自动过；其余走 UI 审批。
      - 在调用 codex 工具时按作业粒度注入 "approval-policy"、"sandbox"、"model"、"cwd" 与 "config" 覆盖：refer-research/openai-codex/codex-
  rs/mcp-server/src/codex_tool_config.rs:16
  - 资源隔离
      - 单实例足够但吃内存/CPU 时，按租户/hash 分片到多个 codex‑mcp 实例；father 维护路由与健康检查（initialize/ping）。
  - 日志与归档
      - 统一目录：.codex-father/sessions/<job-id>/
          - events.jsonl（完整通知/事件）
          - codex-stdout.log/codex-stderr.log（进程日志）
          - tool-call.meta.json（入参、策略、cwd、模型、会话 id、请求 id）
          - 可选：复制/索引服务端 rollout JSONL（来自 SessionConfigured.rollout_path）
      - 设定 TTL/归档任务，支持按 job‑id/会话检索与回放。
  - 观测与指标
      - 按作业/租户汇总 tokens、命令执行次数/失败率、平均时延、超时/取消率，暴露 Prometheus 指标。
  - 健康检查与容错
      - 周期性 initialize/ping；异常拉起新实例并平滑接管队列。
      - 捕获 JSON 解析错误与 back‑pressure（codex‑mcp 内部通道容量 128，注意外部不要一次性洪峰推满）。

  最小落地流程（父侧作为 MCP 客户端）

  - 启动一个常驻 codex‑mcp（或实例池），RUST_LOG=info；记录其 stderr。
  - 新建作业 → 选择后端（默认 MCP）→ 生成 tools/call:
      - name="codex", arguments={"prompt":"…","model":"o3","approval-policy":"on-request","sandbox":"workspace-write","cwd":"/work/
  X","config":{"tools.web_search":false}}
  - 订阅通知流，写入 .codex-father/sessions/<job-id>/events.jsonl；遇到 ElicitRequest 走策略/人工审批并回写。
  - 任务完成收到 tools/call Response（TaskComplete 时回传文本或错误），标记作业完成；可调用“归档会话”或仅保留自建日志。
  - 外部取消 → 发送 CancelledNotification 到 codex‑mcp；超时 watchdog 统一触发。

  何时考虑 exec 后端

  - 需要“每作业独立进程隔离/可恢复（resume）/易审计”的批处理任务时，用 codex exec --json。混合模式：默认 MCP，高风险/重资源作业路由到
  exec。


  下面从并发、会话、日志/合规、审批链路、安全沙箱、资源/成本、协议与演进、可观测性/运维、失败模式等维度，指出方案里容易被忽略的点，并给出改
  进建议。

  并发与隔离

  - 单实例过载与抖动
      - codex mcp 进程内对每个 tools/call 启异步任务并发处理（见 codex-rs/mcp-server/src/message_processor.rs:420），没有内建并发上限和背
  压。若上层突发流量或事件积压，容易导致进程内存上涨、延迟抖动。
      - 建议：father 层用信号量/队列控并发（全局/租户/模型维度），必要时做“多实例分片”（按租户/哈希路由到多个 codex‑mcp）。
  - 进程级隔离与崩溃域
      - mcp 是单进程多会话，崩溃影响所有会话；而 exec 是每作业一进程，隔离更强。
      - 建议：默认走 MCP 提供吞吐；对重资源/高风险/需可恢复的任务切到 codex exec --json 路径。

  会话生命周期与取消/恢复

  - 取消语义
      - MCP 的取消需要客户端发送 CancelledNotification 并由服务端映射到 Interrupt（见 codex-rs/mcp-server/src/message_processor.rs:582）。
  若父层不实现/丢失该通知，请求会一直跑到完成或超时。
      - 建议：father 层统一实现“软取消→超时→强制终止”的三段式。
  - 恢复/重启
      - MCP 会话在内存中，进程重启无法 resume；exec 支持 resume（docs/advanced.md:32）。
      - 建议：需要“可恢复”的场景尽量走 exec；MCP 只做在线会话。

  日志、隐私与合规

  - 事件日志与rollout文件
      - MCP 会把 Codex 事件通过通知送出，且 SessionConfigured 里暴露 rollout_path（服务器本地 JSONL，见 codex-rs/protocol/src/
  protocol.rs:1181）。如果 father 不在同机，切勿“假定可读本地文件”。
      - 建议：father 端以“通知→JSONL”作为标准审计日志来源，rollout_path 仅做旁证路径，不强依赖访问。
  - 敏感信息泄漏
      - 事件里包含命令行、路径、模型输出等；审批请求会拼接命令字符串（见 codex-rs/mcp-server/src/exec_approval.rs:54）。如果命令行内含密钥/
  令牌，可能被日志持久化。
      - 建议：father 做统一脱敏（关键字/正则屏蔽），并配置 Codex 的 shell_environment_policy 最小化传递环境；不要使用 --yolo；为日志设置“红
  线”字段与DLP规则。

  背压与I/O阻塞

  - 无界通道风险
      - MCP 发送侧使用 mpsc::unbounded_channel（见 codex-rs/mcp-server/src/outgoing_message.rs:25）；若 stdout 写被阻塞而上游持续产出，内存
  会增长。
      - 建议：father 必须“持续、尽快”消费 stdout；超大输出建议分片/裁剪；必要时在父层引入“落盘队列 + 异步上传”并配额限速。

  审批链路的“必需实现”

  - 执行/补丁审批
      - codex‑mcp通过 ElicitRequest 请求审批（见 codex-rs/mcp-server/src/exec_approval.rs:65），若客户端（father）未实现响应，任务会卡住。
      - 建议：father 实现审批回路并引入策略引擎（白名单自动放行、按租户/路径/命令类型判定），并提供人工兜底。

  安全与沙箱

  - 不要使用 --yolo
      - --yolo 绕过沙箱与审批，不适合服务化多租运行。用工具入参或 config 设 approval-policy 与 sandbox 即可（advanced.md:87）。
  - 网络与可写根
      - workspace-write 默认禁用网络；是否允许网络要显式配置（docs/sandbox.md:36）。cwd/可写根建议按 job 隔离目录，避免跨任务污染。
  - 容器/宿主限制
      - Linux 上依赖 Landlock/seccomp；在某些容器环境不生效（docs/sandbox.md:85）。需评估实际宿主与容器能力，必要时“容器级沙箱 + Codex 关
  沙箱”。

  资源与成本控制

  - 速率限制与费用
      - 并发提升会线性放大 API 费用与被限流风险。建议做 provider/模型/租户级并发与速率限制，失败重试带指数退避，追踪 429/5xx 指标。
  - token预算与输出限幅
      - 管控 model_max_output_tokens、超长输出截断/分页；防止生成大补丁/超大日志导致磁盘/网络压力。

  协议与演进

  - MCP 接口仍标注 experimental
      - 入参/事件形状可能调整；codex/event 当前以通知形式发送，部分事件未专门建模（见 codex-rs/mcp-server/src/codex_tool_runner.rs:173
  的 TODO）。
      - 建议：father 端解析要“容错/向后兼容”，并建立契约测试，定期跟随上游升级。

  可观测性与运维

  - 统一观测
      - 收集指标：并发、耗时、Token 用量（TokenCount 事件）、审批命中率、超时/取消率、失败原因分布。
      - 健康检查：定期 initialize/ping；异常重启与实例替换；stderr 日志滚动与采样。
  - 归档与清理
      - 设置每会话/作业最大日志大小与 TTL；归档策略（active→archived），避免 sessions 目录无限增长（见 mcp-server archive 逻辑 codex-rs/
  mcp-server/src/codex_message_processor.rs:795）。

  失败模式

  - 一个统一的作业与会话调度/治理层：并发、超时、取消、审批策略、限速、日志/审计、指标/告警。
  - 两条后端：MCP 常驻多会话（默认）+ exec 进程隔离（补充）。
  - 明确数据/日志规范与脱敏策略，配合可观测性与归档。



## 最小MVP

   可以，这是一条“最小可行”的路径：用多个 MCP 入口分别启动多个 codex mcp 进程，按用途拆分（develop/review），即可同时满足多会话并发和分离管
  理。不过建议配套做几项小优化，避免踩坑。

  可行性与收益

  - 单进程并发：每个 codex mcp 自身就支持多会话并发（每个 tools/call 在 tokio 任务中独立执行），不用额外排队器也能跑起来。
  - 多入口分片：按用途/租户/风险级别拆成多个 MCP 服务器条目（develop、review…），实现进程级隔离、默认策略差异化、崩溃域分离，以及更清晰的运
  维边界。

  推荐配置要点

  - 独立 CODEX_HOME：为每个入口设置独立 CODEX_HOME，做到配置、登录凭据、日志/会话文件完全隔离。
      - 例：
          - "env": { "CODEX_HOME": "/srv/codex/dev", "RUST_LOG": "info" }
          - "env": { "CODEX_HOME": "/srv/codex/review", "RUST_LOG": "info" }
  - 默认策略/模型用 profile 或 -c 注入：
      - develop 偏自动化：args: ["mcp","-c","profile=\"dev\""]
      - review 偏审慎：args: ["mcp","-c","profile=\"review\""]
      - 对应在各自 CODEX_HOME/config.toml 里定义 profile（如 sandbox_mode/approval_policy/model 等）。
  - 把 command 写绝对路径，避免 GUI 客户端 PATH 问题："/usr/local/bin/codex"。
  - 工具入参仍可细化每次任务的策略
      - 调用 codex 工具时传 {"model":"o3","approval-policy":"on-request","sandbox":"workspace-write","cwd":"/work/xxx"}，覆盖 server 默认。

  示例（外部客户端 mcpServers 配置）

  - codex-1-develop：偏自动执行，写入工作区、默认禁网
      - "args": ["mcp","-c","profile=\"dev\""]
      - dev 配置（/srv/codex/dev/config.toml）：
          - sandbox_mode = "workspace-write"
          - approval_policy = "on-request"
          - [sandbox_workspace_write] network_access = false（需要网络时改 true）
  - codex-1-review：偏只读/需审批
      - "args": ["mcp","-c","profile=\"review\""]
      - review 配置（/srv/codex/review/config.toml）：
          - sandbox_mode = "read-only"
          - approval_policy = "untrusted"

  并发与隔离建议

  - 每个入口进程内部已并发；多个入口叠加并发更高，但也更吃内存/CPU。根据机器核数与负载分配每入口的目标并发（外部调用侧做限流）。
  - 如需更强隔离或可恢复作业，特定任务可改走 codex exec --json（每作业一进程），作为补充路径。

  日志与审计

  - 进程日志：用 RUST_LOG=info 输出到 stderr，外部重定向落盘（按入口独立日志文件）。
  - 会话事件：MCP 通知包含完整事件流；建议由外部客户端/网关按入口/会话落 JSONL，便于审计。
  - rollout 文件：SessionConfigured 事件里会带服务器本地 rollout_path；如需要，可在同机侧归档，但不要强依赖远程读取。

  常见坑与规避

  - 工具重名：多个入口都叫 codex，但客户端会按服务器名分组/前缀。务必给入口起唯一 id（如 codex-1-develop、codex-1-review）。
  - 登录与配置漂移：每个 CODEX_HOME 要各自 codex login 一次；配置改动要在对应目录下。
  - 不要用 --yolo：MCP 场景用工具入参或 profile 控审批/沙箱，更安全可控。
  - 网络与写权限：workspace-write 默认禁网；需要装依赖时，显式在该入口的 config.toml 打开 network_access = true，或仅对单次调用放开。

  何时只用一个 MCP 入口

  - 如果资源有限、登录/配置不想分多份，也可以只跑一个 codex mcp，用 tools 入参的 profile/model/approval-policy/sandbox/cwd 做“逻辑分区”。代
  价是日志/凭据同库、隔离度略低。

  总之，多 MCP 入口是最简单的“分片 + 并发 + 管理分离”方案。做好 CODEX_HOME 隔离、默认 profile 区分、日志各自落盘，再配上调用侧的并发与超时
  控制，就能稳定支撑你的 codex-father v0。后续如需更细的调度/审计/可恢复作业，再把 codex exec --json 加进来即可。