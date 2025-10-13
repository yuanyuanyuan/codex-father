type ParamMeta = {
  name: string;
  required: boolean;
  description: string;
  values?: string[];
};

type GuideContentChunk = {
  type: 'text';
  text: string;
};

type SamplePayload = {
  content: GuideContentChunk[];
  isError?: boolean;
};

export type GuideMeta = {
  tagline: string;
  scenario: string;
  params: ParamMeta[];
  exampleArgs?: Record<string, unknown>;
  sampleReturn: SamplePayload;
  sampleError?: SamplePayload;
  aliases?: string[];
  tips?: string[];
  returnsJsonString?: boolean;
};

export const canonicalOrder = [
  'codex.version',
  'codex.help',
  'codex.exec',
  'codex.start',
  'codex.resume',
  'codex.reply',
  'codex.message',
  'codex.status',
  'codex.logs',
  'codex.stop',
  'codex.list',
  'codex.clean',
  'codex.metrics',
] as const;

export const guideContent: Record<(typeof canonicalOrder)[number], GuideMeta> = {
  'codex.version': {
    tagline: '查询 Codex Father（核心与 MCP）的版本信息',
    scenario: '需要快速确认当前运行版本、Node 版本与平台时。',
    params: [],
    sampleReturn: {
      content: [
        {
          type: 'text',
          text: 'codex-father v1.7.0\n@starkdev020/codex-father-mcp-server v3.1.1\nNode v18.x on linux x64',
        },
      ],
    },
    tips: [
      '返回的 structuredContent 中包含 mcpName/mcpVersion/coreName/coreVersion/node/platform 等字段，便于程序化消费。',
      '该工具不依赖本机 codex CLI 是否可用，可在轻量环境中直接调用。',
    ],
  },
  'codex.help': {
    tagline: '快速浏览 Codex Father 的 MCP 工具清单与示例',
    scenario: '不确定有哪些工具或需要确认调用/返回格式时。',
    params: [
      { name: 'tool', required: false, description: '指定单个工具查看详情。' },
      {
        name: 'format',
        required: false,
        description: '控制输出格式。',
        values: ['markdown', 'json'],
      },
    ],
    exampleArgs: { tool: 'codex.exec', format: 'markdown' },
    sampleReturn: {
      content: [{ type: 'text', text: '# Codex Father 工具指南\n\n...' }],
    },
    aliases: ['codex_help'],
  },
  'codex.message': {
    tagline: '跨 job 发送协作消息（轻量 mailbox）',
    scenario: '在多个 Codex 任务之间传递简短提示、交接信息或定位线索。',
    params: [
      { name: 'to', required: true, description: '目标 jobId（接收方）。' },
      { name: 'message', required: true, description: '要发送的文本消息。' },
      { name: 'from', required: false, description: '发送者标识（可填来源 jobId 或任意标注）。' },
      {
        name: 'channel',
        required: false,
        description: '消息类别。',
        values: ['default', 'info', 'note', 'alert'],
      },
      { name: 'cwd', required: false, description: '自定义 job.sh 查找目录。' },
    ],
    exampleArgs: {
      to: 'cdx-20251001_120000-demo',
      message: 'UserService 重构完成，接口在 types/user.ts:45',
    },
    sampleReturn: {
      content: [
        {
          type: 'text',
          text: '{"delivered":true,"to":"cdx-20251001_120000-demo","mailbox":"/repo/.codex-father/sessions/.../mailbox.jsonl"}',
        },
      ],
    },
    aliases: ['codex_message', 'codex_send_message', 'codex.send_message'],
    tips: [
      '消息会追加到目标 job 目录的 mailbox.jsonl，可由人或工具消费。',
      '搭配 codex.status/codex.logs 可快速定位接收方上下文。',
      '此机制不做强一致保证，适合轻量提示与人工协作，不适合关键业务流程。',
    ],
    returnsJsonString: true,
  },
  'codex.exec': {
    tagline: '同步执行 Codex CLI，任务完成后立即返回结果摘要',
    scenario: '需要一次性跑完整个任务，并立刻拿到执行产物与日志路径时。',
    params: [
      { name: 'args', required: true, description: '传递给 Codex CLI 的原始参数数组。' },
      {
        name: 'sandbox',
        required: false,
        description: '运行时沙箱模式。',
        values: ['read-only', 'workspace-write', 'danger-full-access'],
      },
      {
        name: 'approvalPolicy',
        required: false,
        description: '命令执行时的审批策略。',
        values: ['on-request', 'never', 'on-failure', 'untrusted'],
      },
      { name: 'tag', required: false, description: '给当前执行打标签，便于在日志中区分。' },
      { name: 'cwd', required: false, description: '指定执行目录，默认取当前工作目录。' },
    ],
    exampleArgs: { args: ['--task', '检查单元测试缺口'], sandbox: 'workspace-write' },
    sampleReturn: {
      content: [
        {
          type: 'text',
          text: '{"runId":"exec-20251006_152842-untagged","exitCode":0,"logFile":"/repo/.codex-father/sessions/exec-20251006_152842-untagged/job.log"}',
        },
      ],
    },
    sampleError: {
      content: [
        {
          type: 'text',
          text: '{"code":"CLI_NON_ZERO_EXIT","message":"命令 start.sh 以退出码 1 结束。"}',
        },
      ],
      isError: true,
    },
    aliases: ['codex_exec'],
    tips: [
      '运行前请确保 args 内包含 --task 或 -f/--file/--docs 等受支持的输入选项；--notes/--files 等自定义开关会被 CLI 视为未知参数并立即退出 (exit 2)。',
      '返回体包含日志路径，可用 codex.logs 查看详情；日志目录以 runId 命名，日志头与 meta 中的时间均对齐该 runId。',
      '建议使用 tag 参数便于 list/stop 检索。',
      '模型参数：可用 args 形式（例如 ["--model","gpt-5-codex high"] 或 ["--model","gpt-5-codex","high"])，也可用 codexConfig（{"model":"gpt-5-codex","model_reasoning_effort":"high"}）。',
      '联网：入参传 network=true，服务器将注入 --codex-config sandbox_workspace_write.network_access=true；meta 的 effective_network_access 会回填运行时真实状态。',
      '结构化指令：与 codex.start 一样，可在 args 中追加 "--instructions <file> --task <id>"，CLI 会校验 schema 并通过 CODEX_STRUCTURED_* 环境变量透出给 shell。',
      '补丁模式：patchMode=true 将注入 policy-note，限制仅输出补丁（patch/diff）；如需正常执行请移除该选项。',
      '审批与沙箱：workspace-write + never 会被规范化为 on-failure（日志含 [arg-normalize] 提示）；若需人工审批请显式传 on-request，或设置 ALLOW_NEVER_WITH_WRITABLE_SANDBOX=1 保留 never。',
      '上下文体积预检：默认 INPUT_TOKEN_LIMIT=32000；超过将立即失败 (exit 2)，classification=context_overflow。建议拆分任务或仅传摘要；必要时可临时提高上限。',
      '错误分类语义：input_error（参数/用法错误）、context_overflow（输入超限）、user_cancelled（停止场景）、normal（完成）。可用于被动通知触发。',
      '注意：orchestrate 是独立子命令（codex-father orchestrate ... 或 node dist/core/cli/start.ts orchestrate ...）。',
      '示例（无预设）：{"name":"codex.exec","arguments":{"args":["--task","检查覆盖率","--context-grep","(README|CHANGELOG)"]}}',
    ],
    returnsJsonString: true,
  },
  'codex.start': {
    tagline: '异步启动长时间 Codex 任务并返回 jobId',
    scenario: '预期任务耗时较长，想在后台运行并随时跟踪进度时。',
    params: [
      { name: 'args', required: true, description: '传递给 Codex CLI 的参数数组。' },
      { name: 'tag', required: false, description: '自定义任务标签，用于后续查询。' },
      {
        name: 'sandbox',
        required: false,
        description: '运行沙箱模式。',
        values: ['read-only', 'workspace-write', 'danger-full-access'],
      },
      {
        name: 'approvalPolicy',
        required: false,
        description: '审批策略。',
        values: ['on-request', 'never', 'on-failure', 'untrusted'],
      },
      { name: 'cwd', required: false, description: '指定执行目录。' },
    ],
    exampleArgs: { args: ['--task', '升级依赖'], tag: 'release' },
    sampleReturn: {
      content: [{ type: 'text', text: '{"jobId":"cdx-20240313_090000-release","logFile":"..."}' }],
    },
    sampleError: {
      content: [
        {
          type: 'text',
          text: '❌ 未知参数: --notes\n提示：请使用 --task <text> 或 -f/--file/--docs 提供任务描述，移除未受支持的自定义开关。',
        },
      ],
      isError: true,
    },
    aliases: ['codex_start'],
    tips: [
      '传参时务必提供 --task（或 -f/--file/--docs 等输入参数）描述任务；若直接传长文本或使用未支持的 --notes/--files，将触发 start.sh 的未知参数校验并以退出码 2 提前结束。',
      '结合 codex.status / codex.logs 查看进度。',
      'tag 可帮助团队区分同一批任务。',
      '结构化指令：准备 JSON/YAML/XML 后，可在 args 中追加 "--instructions <file> --task <id>"，CLI 会校验 schema 并通过 CODEX_STRUCTURED_* 环境变量注入给 start.sh。',
      '模型与推理力度写法同 codex.exec，支持 "<model> high" 或通过 codexConfig 显式设置。',
      '需要联网时传 network=true；effective_network_access 将在 meta 中反映真实状态。',
      'patchMode=true 仅输出补丁；如需实际写入请勿开启。',
      '可写沙箱在未显式允许时会把 never 归一为 on-failure；若需要交互审批请传 approvalPolicy="on-request"，要保留 never 可设置 ALLOW_NEVER_WITH_WRITABLE_SANDBOX=1。',
      '上下文体积预检：默认 INPUT_TOKEN_LIMIT=32000；超过将立即失败 (exit 2)，classification=context_overflow。建议拆分任务或仅传摘要；必要时可临时提高上限。',
      '预设功能已移除：不再支持 --preset；请显式传递所需参数。',
      '注意：orchestrate 是独立子命令（codex-father orchestrate ... 或 node dist/core/cli/start.ts orchestrate ...）。',
      '示例：{"name":"codex.start","arguments":{"args":["--task","修复 T003：补齐迁移脚本并通过测试","--context-head","200"],"tag":"t003"}}',
    ],
    returnsJsonString: true,
  },
  'codex.resume': {
    tagline: '基于历史任务参数重新启动 Codex 作业',
    scenario: 'codex-father 或客户端重启后，需要沿用原任务配置继续执行。',
    params: [
      { name: 'jobId', required: true, description: '来源任务 ID，会从 state.json 读取原始参数。' },
      { name: 'args', required: false, description: '附加 start.sh 参数，追加在原参数之后。' },
      { name: 'tag', required: false, description: '覆盖新任务标签；默认沿用原任务记录的 tag。' },
      { name: 'cwd', required: false, description: '覆盖执行目录；默认沿用原任务记录的 cwd。' },
      {
        name: 'strategy',
        required: false,
        description:
          '恢复策略：full-restart | from-last-checkpoint | from-step（默认 from-last-checkpoint）。',
      },
      {
        name: 'resumeFrom/resumeFromStep',
        required: false,
        description: '从第几步恢复（当 strategy=from-step 时必填）。',
      },
      { name: 'skipCompleted', required: false, description: '增量恢复：跳过已完成步骤。' },
      {
        name: 'reuseArtifacts',
        required: false,
        description: '复用已完成步骤产出物（默认 true）。',
      },
    ],
    exampleArgs: {
      jobId: 'cdx-20251001_120000-demo',
      strategy: 'from-last-checkpoint',
      resumeFrom: 7,
      skipCompleted: true,
      tag: 'resume-retry',
    },
    sampleReturn: {
      content: [
        {
          type: 'text',
          text: '{"jobId":"cdx-20251006_160000-rerun","resumedFrom":"cdx-20251001_120000-demo"}',
        },
      ],
    },
    aliases: ['codex_resume'],
    tips: [
      'resume 会读取 sessions/<jobId>/state.json 的 args；若文件缺失或格式无效会直接报错。',
      '可通过 args 追加新的 flag（如 --dry-run），start.sh 将按最后出现的值生效。',
      '返回体带有 resumedFrom 字段以及 log/meta 路径，便于重新挂载日志跟踪。',
    ],
    returnsJsonString: true,
  },
  'codex.reply': {
    tagline: '在既有任务基础上追加一条用户回复并继续执行',
    scenario: '多轮协作中，想对上一次 Codex 结果“接着说”，兼容 Codex 原生 codex-reply 语义。',
    params: [
      { name: 'jobId', required: true, description: '来源任务 ID（sessions/<jobId>）。' },
      {
        name: 'message',
        required: false,
        description: '回复内容（与 messageFile 至少提供一个）。',
      },
      { name: 'messageFile', required: false, description: '从文件读取回复内容的路径。' },
      {
        name: 'role',
        required: false,
        description: '回复片段的角色标注（默认 user）。',
        values: ['user', 'system'],
      },
      {
        name: 'position',
        required: false,
        description: '将回复放在指令的顶部或底部。',
        values: ['append', 'prepend'],
      },
      { name: 'tag', required: false, description: '新任务标签；默认沿用/追加 -reply 标识。' },
      { name: 'cwd', required: false, description: '覆盖执行目录；默认沿用 job 记录的 cwd。' },
      { name: 'args', required: false, description: '追加 start.sh 参数（如 --dry-run）。' },
    ],
    exampleArgs: {
      jobId: 'cdx-20251001_120000-demo',
      message: '继续，把步骤 3 自动化。',
      position: 'append',
      tag: 'followup',
    },
    sampleReturn: {
      content: [
        {
          type: 'text',
          text: '{"jobId":"cdx-20251013_103000-followup","repliedTo":"cdx-20251001_120000-demo"}',
        },
      ],
    },
    aliases: ['codex_reply'],
    tips: [
      '内部通过 job.sh resume 复用历史参数，并以 PREPEND_CONTENT/APPEND_CONTENT 注入回复文本。',
      '大文本可用 messageFile 传路径（避免环境变量长度限制）；两者并存时会先拼接 file 再拼接 message。',
      '默认：role=user，position=append。若 role=system 且未显式传 position，将隐式采用 prepend（更像“全局约束”）。',
    ],
    returnsJsonString: true,
  },
  'codex.status': {
    tagline: '查询后台任务状态并获取运行摘要',
    scenario: '掌握任务当前阶段、退出码、分类以及写入文件位置。',
    params: [
      { name: 'jobId', required: true, description: '任务 ID。' },
      { name: 'cwd', required: false, description: '自定义 job.sh 查找目录。' },
    ],
    exampleArgs: { jobId: 'cdx-20240313_090000-release' },
    sampleReturn: {
      content: [
        {
          type: 'text',
          text: '{"id":"cdx-20240313_090000-release","state":"running","effectiveSandbox":"workspace-write"}',
        },
      ],
    },
    aliases: ['codex_status'],
    tips: [
      'status 会刷新 state.json 并补全 classification/tokens。',
      '返回体包含有效 sandbox/network/approval，便于客户端展示。',
    ],
    returnsJsonString: true,
  },
  'codex.logs': {
    tagline: '查看或流式输出任务日志',
    scenario: '排查执行详情、定位报错、检索 Codex 输出片段。',
    params: [
      { name: 'jobId', required: true, description: '任务 ID。' },
      {
        name: 'mode',
        required: false,
        description: '读取模式：bytes 或 lines。',
        values: ['bytes', 'lines'],
      },
      { name: 'tailLines', required: false, description: '按行模式下返回末尾 N 行。' },
      { name: 'offset', required: false, description: '按字节模式下的读取偏移量。' },
      { name: 'limit', required: false, description: '按字节模式下一次返回的最大字节数。' },
      {
        name: 'view',
        required: false,
        description: '预设视图：result-only 仅显示 codex 输出，debug 保留完整日志。',
        values: ['default', 'result-only', 'debug'],
      },
    ],
    exampleArgs: {
      jobId: 'job-20240313-abcdef',
      mode: 'lines',
      tailLines: 50,
      view: 'result-only',
    },
    sampleReturn: {
      content: [
        {
          type: 'text',
          text: '{"lines":["[INFO] Task started"],"totalLines":128,"view":"default"}',
        },
      ],
    },
    aliases: ['codex_logs'],
    tips: [
      '按字节模式可实现断点续读。',
      '设置 view 为 "result-only" 可聚焦生成内容。',
      '当日志不存在时会在错误 details.searched 中列出已尝试的路径，可直接复制进行验证。',
    ],
    returnsJsonString: true,
  },
  'codex.stop': {
    tagline: '优雅或强制终止指定 jobId 的后台任务',
    scenario: '任务已无继续必要或状态异常，需要尽快中止。',
    params: [
      { name: 'jobId', required: true, description: '要终止的任务 ID。' },
      {
        name: 'force',
        required: false,
        description: '是否强制终止，默认尝试优雅关闭。',
        values: ['true', 'false'],
      },
      { name: 'cwd', required: false, description: '指定 job.sh 所在目录。' },
    ],
    exampleArgs: { jobId: 'job-20240313-abcdef', force: true },
    sampleReturn: {
      content: [
        {
          type: 'text',
          text: '{"jobId":"job-20240313-abcdef","previousState":"running","newState":"stopped"}',
        },
      ],
    },
    aliases: ['codex_stop'],
    tips: ['建议先使用 codex.status 确认任务状态后再决定是否 force。'],
    returnsJsonString: true,
  },
  'codex.list': {
    tagline: '列出当前所有后台 Codex 任务及状态',
    scenario: '需要总览近期任务、查找 jobId 或确认是否仍有任务在跑。',
    params: [
      { name: 'cwd', required: false, description: '自定义 job.sh 查找目录。' },
      {
        name: 'state',
        required: false,
        description: '按状态过滤，可多次传入例如 ["running","stopped"]。',
      },
      { name: 'tagContains', required: false, description: '按子串匹配 tag，便于筛选同一批任务。' },
      { name: 'limit', required: false, description: '限制返回条数，默认返回全部。' },
      { name: 'offset', required: false, description: '跳过前 N 条，用于分页。' },
    ],
    exampleArgs: { limit: 20 },
    sampleReturn: {
      content: [
        {
          type: 'text',
          text: '[{"id":"cdx-20240313_101010-refactor","state":"running","tag":"refactor-login"}]',
        },
      ],
    },
    aliases: ['codex_list'],
    tips: [
      '最小调用：{}（空参数）或 {"limit":20} 均可立即返回任务列表。',
      '结合 state/tagContains/limit 可快速筛选关键任务。',
    ],
    returnsJsonString: true,
  },
  'codex.clean': {
    tagline: '按条件批量清理历史任务目录',
    scenario: '释放磁盘或仅保留近期有效任务时。',
    params: [
      {
        name: 'states',
        required: false,
        description: '仅清理这些状态的任务（如 completed/failed）。',
      },
      { name: 'olderThanHours', required: false, description: '仅清理早于指定小时数的任务。' },
      { name: 'limit', required: false, description: '最多删除多少个任务。' },
      { name: 'dryRun', required: false, description: '设为 true 时仅预览，不实际删除。' },
      { name: 'cwd', required: false, description: '自定义 job.sh 查找目录。' },
    ],
    exampleArgs: { states: ['completed', 'failed'], olderThanHours: 72, limit: 20 },
    sampleReturn: {
      content: [
        { type: 'text', text: '{"deleted":["cdx-20240301_123000-demo"],"kept":[],"dryRun":false}' },
      ],
    },
    aliases: ['codex_clean'],
    tips: ['清理前可先 dryRun 查看影响范围。', '失败或长时间 idle 的任务通常可以清理。'],
    returnsJsonString: true,
  },
  'codex.metrics': {
    tagline: '统计任务状态、耗时与资源使用',
    scenario: '构建自定义 dashboard 或了解近期运行概况。',
    params: [
      { name: 'states', required: false, description: '仅统计这些状态的任务。' },
      { name: 'cwd', required: false, description: '自定义 job.sh 查找目录。' },
    ],
    exampleArgs: { states: ['running', 'failed'] },
    sampleReturn: {
      content: [
        { type: 'text', text: '{"total":12,"byState":{"running":2,"completed":8,"failed":2}}' },
      ],
    },
    aliases: ['codex_metrics'],
    tips: ['结合 clean/list，可定期评估任务健康度。'],
    returnsJsonString: true,
  },
};

export const faqItems = [
  {
    question: 'codex.exec 和 codex.start 有什么区别？',
    answer:
      'codex.exec 会等待任务执行完毕后返回结果；codex.start 会立即返回 jobId，后续可用 status/logs 跟踪。',
  },
  {
    question: '出现 400 Unsupported model 怎么办？',
    answer:
      '请确认模型名受后端支持；未受支持时元数据会显示 classification=config_error 与 reason=Unsupported or invalid model。若需设置推理力度，使用 ["--model","<model> high"]、["--model","<model>","high"]，或 codexConfig:{"model":"<model>","model_reasoning_effort":"high"}。',
  },
  {
    question: '为什么 meta 里 effective_network_access 是 restricted？',
    answer:
      '默认网络受限。若需要联网，请在 MCP 入参设置 network=true（服务器会注入 --codex-config sandbox_workspace_write.network_access=true）。运行时日志显示 network access enabled 时，元数据会回填为 enabled。',
  },
  {
    question: '为什么指令里看到 policy-note？如何关闭补丁模式？',
    answer:
      '当启用 patchMode=true 或 CLI 传入 --patch-mode 时，会注入 policy-note 要求仅输出补丁。若要关闭，请去掉 patchMode/--patch-mode。',
  },
];

export const advancedNotes = [
  'codex.exec 默认启用 workspace-write 沙箱并在必要时自动补审批策略。',
  'codex.logs 支持 bytes 与 lines 两种模式，可结合 grep、view 精准过滤。',
  'codex.clean 支持 dry-run，建议在批量删除前先预览影响。',
  '通过环境变量 CODEX_MCP_NAME_STYLE / CODEX_MCP_TOOL_PREFIX 可导出下划线别名或统一前缀，方便部分客户端显示。',
  '模型与推理力度：支持 "<model> minimal|low|medium|high" 及 codexConfig 显式设置；不支持的模型会被归类为 config_error。',
  '网络：入参 network=true 可显式开网，元数据按运行日志回填 enabled/restricted。',
  '补丁模式：patchMode=true 会注入 policy-note，仅输出 patch/diff；关闭补丁模式即可恢复常规执行。',
];

// 首次使用者的统一“避坑提示”，便于 IDE 从 codex.help JSON 中直接读取
export const onboardingTips: string[] = [
  '模型与推理力度：args 用法 ["--model","<model> high"] 或 ["--model","<model>","high"]；或 codexConfig {"model":"<model>","model_reasoning_effort":"high"}。',
  '联网：MCP 入参设置 network=true；运行日志显示 network access enabled 时，元数据 effective_network_access 会回填为 enabled。',
  '补丁模式：patchMode=true 注入 policy-note，仅输出 patch/diff；移除该选项即可恢复常规执行。',
  '审批与沙箱：workspace-write + never 会被规范化为 on-failure（日志含 [arg-normalize] 提示）；若需人工审批请显式传 on-request，或设置 ALLOW_NEVER_WITH_WRITABLE_SANDBOX=1 保留 never。',
  '输入体积预检：默认 INPUT_TOKEN_LIMIT=32000；超限直接失败 (context_overflow)。建议仅传摘要或拆分任务。',
  '预设已移除：不再支持 --preset；请显式传递所需参数。',
];
