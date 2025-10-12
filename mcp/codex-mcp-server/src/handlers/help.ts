import { toolsSpec } from '../tools/spec.js';
import {
  guideContent,
  canonicalOrder,
  faqItems,
  advancedNotes,
  onboardingTips,
  type GuideMeta,
} from '../tools/help/content.js';
import { formatJson } from '../utils/format.js';
import { normalizeToolName } from '../utils/toolNames.js';
import type { ToolResult } from './types.js';
import { createErrorResult } from '../errors/cli.js';

type GuideCard = {
  name: (typeof canonicalOrder)[number];
  spec: ReturnType<typeof toolsSpec>['tools'][number];
  meta: GuideMeta;
  example: { name: string; arguments: Record<string, unknown> };
  returnsJsonString: boolean;
};

type ParamMeta = GuideMeta['params'][number];

const schemaParamHints: Record<string, string> = {
  approvalPolicy: '字符串，控制审批策略（像选择“人工把关”还是“自动放行”）。',
  sandbox: '字符串，指定沙箱级别，类似操作系统的权限模式。',
  network:
    '布尔值，true 表示临时打开联网开关，会自动注入 sandbox_workspace_write.network_access=true。',
  fullAuto: '布尔值，true 时相当于开启“自动驾驶” (--full-auto)。',
  dangerouslyBypass:
    '布尔值，true 时注入 --dangerously-bypass-approvals-and-sandbox，等同于拆掉安全保险。',
  profile: '字符串，切换 Codex CLI profile（例如 preview/prod）。',
  codexConfig: '对象，每个键值对都会转成 --codex-config key=value，好比给命令额外加调味包。',
  preset: '预设名称（sprint/analysis/secure/fast），像一键切换不同“套餐”。',
  carryContext: '布尔值，false 会追加 --no-carry-context，等同于“重新开新的对话页”。',
  compressContext: '布尔值，false 会追加 --no-compress-context，保留完整上下文。',
  contextHead: '整数，传给 --context-head，用来限制保留的历史 Token 数量。',
  patchMode: '布尔值，true 跑在“只输出补丁”模式。',
  requireChangeIn: '字符串数组，对应多次 --require-change-in，像列出必须修改的目录白名单。',
  requireGitCommit: '布尔值，true 表示强制生成 Git commit。',
  autoCommitOnDone: '布尔值，true 表示任务成功后自动 git commit。',
  autoCommitMessage: '字符串，自定义自动提交信息模板。',
  offset: '整数，按字节模式读取日志时的起始偏移量。',
  limit: '整数，按字节模式一次读取的最大字节数。',
  offsetLines: '整数，按行模式读取日志时跳过前多少行。',
  limitLines: '整数，按行模式读取日志时最多返回多少行。',
  grep: '字符串，等价于日志里的 grep 过滤器。',
  view: '字符串视图模式（default/result-only/debug），类似切换“不同镜头角度”。',
  state: '字符串数组，过滤指定状态（running/completed/failed 等）。',
  tagContains: '字符串，模糊匹配任务标签，相当于快速搜索货架标签。',
  olderThanHours: '数字，清理早于该小时数的任务，像定期打扫旧档案。',
  dryRun: '布尔值，true 时只是演练预览，不实际清理。',
  states: '字符串数组，限定统计或清理范围；例如只看 completed/failed。',
  cwd: '字符串，覆盖默认工作目录。',
  args: '字符串数组，按顺序传递给 start.sh，就像原生 CLI 参数列表。',
  tag: '字符串，为任务打标签，便于后续查询。',
  jobId: '字符串，指定要查询或操作的任务 ID。',
};

function toTypeLabel(schema: Record<string, unknown>): string {
  const rawType = schema.type;
  if (Array.isArray(rawType)) {
    return rawType.join(' | ');
  }
  if (rawType === 'array' && typeof schema.items === 'object' && schema.items) {
    const item = schema.items as Record<string, unknown>;
    const itemType = toTypeLabel(item) || (typeof item.type === 'string' ? item.type : 'unknown');
    return `array<${itemType}>`;
  }
  if (typeof rawType === 'string') {
    return rawType;
  }
  return '';
}

function enumValues(schema: Record<string, unknown>): string[] | undefined {
  if (Array.isArray(schema.enum) && schema.enum.length) {
    return schema.enum.map((value) => String(value));
  }
  if (schema.type === 'array' && typeof schema.items === 'object' && schema.items) {
    const item = schema.items as Record<string, unknown>;
    if (Array.isArray(item.enum) && item.enum.length) {
      return item.enum.map((value) => String(value));
    }
  }
  return undefined;
}

function schemaParamMeta(
  name: string,
  schema: Record<string, unknown>,
  required: boolean
): ParamMeta {
  const hint =
    schemaParamHints[name] ||
    (typeof schema.description === 'string' ? schema.description : undefined);
  const typeLabel = toTypeLabel(schema);
  let description = hint || (typeLabel ? `类型：${typeLabel}` : '参见 JSON Schema 描述。');
  if (!hint && typeLabel && !description.includes(typeLabel)) {
    description = `${description}（类型：${typeLabel}）`;
  }
  if (hint && typeLabel && !hint.includes(typeLabel)) {
    description = `${hint}（类型：${typeLabel}）`;
  }
  const values = enumValues(schema);
  return { name, required, description, ...(values ? { values } : {}) };
}

function mergeParamMeta(card: GuideCard): ParamMeta[] {
  const manual = card.meta.params ?? [];
  const manualMap = new Map<string, ParamMeta>();
  for (const param of manual) {
    manualMap.set(param.name, param);
  }

  const result: ParamMeta[] = [...manual];
  const schema = card.spec.inputSchema;
  if (schema && schema.type === 'object' && typeof schema.properties === 'object') {
    const requiredList = Array.isArray(schema.required)
      ? new Set(schema.required.map((v) => String(v)))
      : new Set<string>();
    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      if (manualMap.has(key) || typeof value !== 'object' || value === null) {
        continue;
      }
      result.push(schemaParamMeta(key, value as Record<string, unknown>, requiredList.has(key)));
    }
  }
  return result;
}

function buildToolSection(card: GuideCard, heading: string): string[] {
  const lines: string[] = [];
  lines.push(heading, '');
  lines.push(`- **一句话**：${card.meta.tagline}`);
  lines.push(`- **使用场景**：${card.meta.scenario}`);
  const params = mergeParamMeta(card);
  if (params.length) {
    lines.push('| 参数 | 必填 | 说明 |');
    lines.push('| --- | --- | --- |');
    for (const p of params) {
      const required = p.required ? '是' : '否';
      const valueNote = p.values?.length ? `<br>可选值：${p.values.join(' / ')}` : '';
      lines.push(`| ${p.name} | ${required} | ${p.description}${valueNote} |`);
    }
    lines.push('');
  }
  if (card.meta.exampleArgs) {
    lines.push('- **调用示例**：');
    lines.push('```json');
    lines.push(JSON.stringify(card.meta.exampleArgs, null, 2));
    lines.push('```');
  }
  if (card.meta.sampleReturn) {
    lines.push('- **返回示例**：');
    lines.push('```json');
    lines.push(
      JSON.stringify(card.meta.sampleReturn.content?.[0]?.text ?? card.meta.sampleReturn, null, 2)
    );
    lines.push('```');
  }
  if (card.returnsJsonString) {
    lines.push('- **返回值**：结果内容以 JSON 字符串形式提供，请在客户端再解析一次。');
  }
  if (card.meta.sampleError) {
    lines.push('- **错误示例**：');
    lines.push('```json');
    lines.push(
      JSON.stringify(card.meta.sampleError.content?.[0]?.text ?? card.meta.sampleError, null, 2)
    );
    lines.push('```');
  }
  if (card.meta.tips?.length) {
    lines.push('- **小贴士**：');
    for (const tip of card.meta.tips) {
      lines.push(`  - ${tip}`);
    }
  }
  if (card.meta.aliases?.length) {
    lines.push(`- **别名**：${card.meta.aliases.join(', ')}`);
  }
  lines.push('');
  return lines;
}

export function handleHelp(params: Record<string, unknown>): ToolResult {
  const rawFormat = typeof params.format === 'string' ? params.format.toLowerCase() : 'markdown';
  if (rawFormat && rawFormat !== 'markdown' && rawFormat !== 'json') {
    return createErrorResult({
      code: 'INVALID_ARGUMENT',
      message: `format=${params.format} 不受支持，允许值：markdown 或 json。`,
      hint: '省略 format 默认返回 Markdown；如需结构化数据请设置为 "json"。',
      example: { name: 'codex.help', arguments: { format: 'json' } },
    });
  }
  const fmt = (rawFormat || 'markdown') as 'markdown' | 'json';
  const wantedRaw = typeof params.tool === 'string' ? String(params.tool) : '';
  const wantedNormalized = wantedRaw ? normalizeToolName(wantedRaw) : '';
  const spec = toolsSpec();

  const guides = canonicalOrder
    .map((name) => {
      const specTool = spec.tools.find((t) => normalizeToolName(t.name) === name);
      const meta = guideContent[name];
      if (!specTool || !meta) {
        return null;
      }
      return {
        name,
        spec: specTool,
        meta,
        example: { name, arguments: meta.exampleArgs ?? {} },
        returnsJsonString: Boolean(meta.returnsJsonString),
      } satisfies GuideCard;
    })
    .filter(Boolean) as GuideCard[];

  const filteredGuides = wantedNormalized
    ? guides.filter((g) => g.name === wantedNormalized)
    : guides;

  const quickCall = { name: 'codex.help', arguments: wantedRaw ? { tool: wantedRaw } : {} };

  type QuickScenario = {
    title: string;
    description: string;
    calls: Array<{ name: string; arguments: Record<string, unknown>; note?: string }>;
  };

  const quickScenarios: QuickScenario[] = [
    {
      title: '执行一次性任务',
      description:
        '使用 `codex.exec` 同步完成任务并立即获取日志与退出码，适合 lint / 单元测试等快速校验。',
      calls: [
        {
          name: 'codex.exec',
          arguments: { args: ['--task', 'npm run lint'], sandbox: 'workspace-write', tag: 'lint' },
          note: '返回体含日志路径，可配合 codex.logs 查看详情。',
        },
      ],
    },
    {
      title: '巡检当前任务',
      description: '通过 `codex.list` 快速查看正在运行或最近完成的任务，随后可跟进具体 jobId。',
      calls: [
        {
          name: 'codex.list',
          arguments: { limit: 20 },
          note: 'limit 省略时返回全部任务，建议指定较小数值提升客户端体验。',
        },
        {
          name: 'codex.status',
          arguments: { jobId: '<jobId>' },
          note: '从列表复制 jobId 后即可查看详细状态。',
        },
      ],
    },
    {
      title: '后台启动并持续跟踪',
      description:
        '先用 `codex.start` 启动长任务，再循环调用 `codex.status` 与 `codex.logs` 监控进度。',
      calls: [
        {
          name: 'codex.start',
          arguments: { args: ['--task', 'Run regression suite'], tag: 'regression' },
          note: '记录返回的 jobId，供后续查询使用。',
        },
        {
          name: 'codex.status',
          arguments: { jobId: '<jobId>' },
          note: '状态 JSON 包含有效的 sandbox / 审批策略，可向用户展示。',
        },
        {
          name: 'codex.logs',
          arguments: { jobId: '<jobId>', mode: 'lines', tailLines: 80, view: 'result-only' },
          note: 'view 设为 result-only 可聚焦模型输出。',
        },
      ],
    },
    {
      title: '清理旧会话并生成指标',
      description: '先 dry-run 检查将被删除的运行目录，再执行清理并查看整体指标。',
      calls: [
        {
          name: 'codex.clean',
          arguments: { dryRun: true, olderThanHours: 24, states: ['completed', 'failed'] },
          note: '确认无误后，把 dryRun 设为 false 执行实际清理。',
        },
        {
          name: 'codex.metrics',
          arguments: {},
          note: '输出状态分布与 tokens 总计，可用于自定义仪表板。',
        },
      ],
    },
  ];

  if (fmt === 'json') {
    const jsonPayload: Record<string, unknown> = {
      intro: 'codex_help 用于快速了解 Codex Father 提供的 MCP 工具、使用场景与示例。',
      quickStart: {
        example: quickCall,
        note: '默认返回 Markdown；将 format 设置为 "json" 可获得此结构。工具在客户端通常显示为 mcp__<server-id>__<tool>，其中 <server-id> 等于 MCP 配置中的键名（例如 codex-father-prod）。',
        scenarios: quickScenarios.map((scenario) => ({
          title: scenario.title,
          description: scenario.description,
          calls: scenario.calls,
        })),
      },
      onboardingTips,
      tools: filteredGuides.map((g) => ({
        name: g.name,
        description: g.meta.tagline,
        usage: g.meta.scenario,
        params: g.meta.params,
        example: g.example,
        returnExample: g.meta.sampleReturn,
        aliases: g.meta.aliases ?? [],
        tips: g.meta.tips ?? [],
        schema: g.spec.inputSchema,
        returnFormat: g.returnsJsonString ? 'json-string' : 'text',
        ...(g.meta.sampleError ? { errorExample: g.meta.sampleError } : {}),
      })),
      advanced: advancedNotes,
    };
    if (faqItems.length) {
      jsonPayload.faq = faqItems;
    }
    return { content: [{ type: 'text', text: formatJson(jsonPayload) }] };
  }

  const md: string[] = [];
  md.push('# Codex Father 工具指南', '');
  md.push('codex_help 用来在一个地方了解所有核心工具、适用场景与调用示例。', '');
  md.push('## 快速开始', '', '最简调用：', '```json', JSON.stringify(quickCall, null, 2), '```');
  md.push('返回值包含所有工具与示例，设置 `format: "json"` 可得到结构化结果。', '');
  md.push(
    '命名提示：在大多数客户端中，工具名称会呈现为 `mcp__<server-id>__<tool>`；其中 `<server-id>` 就是你在 MCP 配置里填写的键名（例如 `codex-father-prod`）。',
    ''
  );
  if (quickScenarios.length) {
    md.push('## 快速上手场景', '');
    for (const scenario of quickScenarios) {
      md.push(`### ${scenario.title}`, '', scenario.description, '');
      for (const call of scenario.calls) {
        md.push(`- 调用 \`${call.name}\``);
        md.push('```json');
        md.push(JSON.stringify({ name: call.name, arguments: call.arguments }, null, 2));
        md.push('```');
        if (call.note) {
          md.push(`> ${call.note}`);
        }
        md.push('');
      }
    }
  }
  md.push('## 核心工具速览', '');
  for (const g of filteredGuides) {
    md.push(`- \`${g.name}\` — ${g.meta.tagline}`);
  }
  md.push('');
  md.push('## 详细说明', '');
  for (const g of filteredGuides) {
    md.push(...buildToolSection(g, `### ${g.name}`));
  }
  if (faqItems.length) {
    md.push('## 常见问题', '');
    for (const faq of faqItems) {
      md.push(`- **Q**：${faq.question}`, `  **A**：${faq.answer}`);
    }
    md.push('');
  }
  if (advancedNotes.length) {
    md.push('## 进阶指南', '');
    for (const note of advancedNotes) {
      md.push(`- ${note}`);
    }
  }

  return { content: [{ type: 'text', text: md.join('\n') }] };
}
