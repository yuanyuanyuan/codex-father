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

function buildToolSection(card: GuideCard, heading: string): string[] {
  const lines: string[] = [];
  lines.push(heading, '');
  lines.push(`- **一句话**：${card.meta.tagline}`);
  lines.push(`- **使用场景**：${card.meta.scenario}`);
  if (card.meta.params.length) {
    lines.push('| 参数 | 必填 | 说明 |');
    lines.push('| --- | --- | --- |');
    for (const p of card.meta.params) {
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
        note: '默认返回 Markdown；将 format 设置为 "json" 可获得此结构。',
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
