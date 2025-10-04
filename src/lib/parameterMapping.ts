export type ParameterCategory = 'mcp' | 'cli' | 'config';

export interface ParameterMapping {
  name: string;
  category: ParameterCategory;
  minVersion: string; // e.g. "0.44.0"
  maxVersion?: string; // optional upper bound
  dataSource: string; // e.g. codex_mcp_interface.md#L55
  incompatibleBehavior?: string; // description when not supported
}

// 简单语义化版本解析与比较
function parseSemver(v: string): [number, number, number] | null {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) {
    return null;
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmpSemver(a: string, b: string): number {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) {
    return NaN as unknown as number;
  }
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) {
      return pa[i] - pb[i];
    }
  }
  return 0;
}

// 参数-版本映射表（O(1) 查询）
export const PARAMETER_MAPPINGS: Record<string, ParameterMapping> = {
  // 1.1 MCP newConversation
  model: {
    name: 'model',
    category: 'mcp',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L54',
  },
  profile: {
    name: 'profile',
    category: 'mcp',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L55',
    incompatibleBehavior: "返回错误：'profile' requires Codex >= 0.44",
  },
  cwd: {
    name: 'cwd',
    category: 'mcp',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L56',
  },
  approvalPolicy: {
    name: 'approvalPolicy',
    category: 'mcp',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L57',
  },
  sandbox: {
    name: 'sandbox',
    category: 'mcp',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L58',
  },
  config: {
    name: 'config',
    category: 'mcp',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L59',
    incompatibleBehavior: '过滤 0.44 独有配置',
  },
  baseInstructions: {
    name: 'baseInstructions',
    category: 'mcp',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L60',
  },
  includePlanTool: {
    name: 'includePlanTool',
    category: 'mcp',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L61',
  },
  includeApplyPatchTool: {
    name: 'includeApplyPatchTool',
    category: 'mcp',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L61',
  },

  // 1.2 MCP sendUserMessage
  conversationId: {
    name: 'conversationId',
    category: 'mcp',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L67',
  },
  items: {
    name: 'items',
    category: 'mcp',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L134',
  },

  // 1.3 MCP sendUserTurn （使用点分前缀避免与通用键冲突）
  'sendUserTurn.conversationId': {
    name: 'sendUserTurn.conversationId',
    category: 'mcp',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68',
    incompatibleBehavior: '方法不存在（0.42）',
  },
  'sendUserTurn.cwd': {
    name: 'sendUserTurn.cwd',
    category: 'mcp',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68',
    incompatibleBehavior: '方法不存在（0.42）',
  },
  'sendUserTurn.approvalPolicy': {
    name: 'sendUserTurn.approvalPolicy',
    category: 'mcp',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68',
    incompatibleBehavior: '方法不存在（0.42）',
  },
  'sendUserTurn.sandboxPolicy': {
    name: 'sendUserTurn.sandboxPolicy',
    category: 'mcp',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68',
    incompatibleBehavior: '方法不存在（0.42）',
  },
  'sendUserTurn.model': {
    name: 'sendUserTurn.model',
    category: 'mcp',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68',
    incompatibleBehavior: '方法不存在（0.42）',
  },
  'sendUserTurn.effort': {
    name: 'sendUserTurn.effort',
    category: 'mcp',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68',
    incompatibleBehavior: '方法不存在（0.42）',
  },
  'sendUserTurn.summary': {
    name: 'sendUserTurn.summary',
    category: 'mcp',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68',
    incompatibleBehavior: '方法不存在（0.42）',
  },

  // 2. CLI 参数（以 cli.* 前缀标识）
  'cli.model': {
    name: 'cli.model',
    category: 'cli',
    minVersion: '0.42.0',
    dataSource: 'start.sh#L575',
    incompatibleBehavior: '0.42: 通过 --codex-config model=<name> 或配置文件设置',
  },
  'cli.askForApproval': {
    name: 'cli.askForApproval',
    category: 'cli',
    minVersion: '0.42.0',
    dataSource: 'start.sh#L575',
  },
  'cli.sandbox': {
    name: 'cli.sandbox',
    category: 'cli',
    minVersion: '0.42.0',
    dataSource: 'start.sh#L575',
  },
  'cli.cd': {
    name: 'cli.cd',
    category: 'cli',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/docs/getting-started.md#L103',
    incompatibleBehavior: '0.42: 需使用 --codex-arg "--cd" 手动透传',
  },
  'cli.config': {
    name: 'cli.config',
    category: 'cli',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/docs/config.md#L6',
    incompatibleBehavior: '0.44 独有键会被过滤',
  },
  'cli.image': {
    name: 'cli.image',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/exec/src/cli.rs#L13',
  },
  'cli.oss': {
    name: 'cli.oss',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/exec/src/cli.rs#L21',
  },
  'cli.profile': {
    name: 'cli.profile',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'start.sh#L589',
    incompatibleBehavior: '0.42: unknown argument --profile',
  },
  'cli.fullAuto': {
    name: 'cli.fullAuto',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/exec/src/cli.rs#L33',
  },
  'cli.dangerouslyBypassApprovalsAndSandbox': {
    name: 'cli.dangerouslyBypassApprovalsAndSandbox',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/exec/src/cli.rs#L37',
  },
  'cli.skipGitRepoCheck': {
    name: 'cli.skipGitRepoCheck',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/exec/src/cli.rs#L51',
  },
  'cli.outputSchema': {
    name: 'cli.outputSchema',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/exec/src/cli.rs#L55',
  },
  'cli.color': {
    name: 'cli.color',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/exec/src/cli.rs#L63',
  },
  'cli.json': {
    name: 'cli.json',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/exec/src/cli.rs#L67',
  },
  'cli.includePlanTool': {
    name: 'cli.includePlanTool',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/codex-rs/exec/src/cli.rs#L70',
  },
  'cli.outputLastMessage': {
    name: 'cli.outputLastMessage',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'start.sh#L1068',
  },
  'cli.exec.resume': {
    name: 'cli.exec.resume',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/docs/advanced.md#L32',
  },
  'cli.exec.resume.last': {
    name: 'cli.exec.resume.last',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/docs/advanced.md#L34',
  },
  'cli.exec.resume.sessionId': {
    name: 'cli.exec.resume.sessionId',
    category: 'cli',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/docs/advanced.md#L41',
  },

  // 3. 顶级配置选项（以 config.* 前缀标识）
  'config.model_provider': {
    name: 'config.model_provider',
    category: 'config',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/docs/config.md#L132',
  },
  'config.approval_policy': {
    name: 'config.approval_policy',
    category: 'config',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/docs/config.md#L145',
  },
  'config.sandbox_mode': {
    name: 'config.sandbox_mode',
    category: 'config',
    minVersion: '0.42.0',
    dataSource: 'refer-research/openai-codex/docs/config.md#L279',
  },
  'config.model_reasoning_effort': {
    name: 'config.model_reasoning_effort',
    category: 'config',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/docs/config.md#L227',
    incompatibleBehavior: '0.42: 警告并忽略',
  },
  'config.model_reasoning_summary': {
    name: 'config.model_reasoning_summary',
    category: 'config',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/docs/config.md#L238',
    incompatibleBehavior: '0.42: 警告并忽略',
  },
  'config.model_supports_reasoning_summaries': {
    name: 'config.model_supports_reasoning_summaries',
    category: 'config',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/docs/config.md#L271',
    incompatibleBehavior: '0.42: 警告并忽略',
  },
  'config.model_verbosity': {
    name: 'config.model_verbosity',
    category: 'config',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/docs/config.md#L252',
    incompatibleBehavior: '0.42: 警告并忽略',
  },
  'config.profile': {
    name: 'config.profile',
    category: 'config',
    minVersion: '0.44.0',
    dataSource: 'refer-research/openai-codex/docs/config.md#L182',
    incompatibleBehavior: '0.42: 警告并忽略',
  },
};

// 获取参数的最小版本要求
export function getParamMinVersion(paramName: string): string | null {
  const m = PARAMETER_MAPPINGS[paramName];
  return m ? m.minVersion : null;
}

// 检查参数是否在指定版本中支持
export function isParamSupported(paramName: string, version: string): boolean {
  const m = PARAMETER_MAPPINGS[paramName];
  if (!m) {
    return false;
  }
  if (!parseSemver(version)) {
    return false;
  }
  if (m.minVersion && parseSemver(m.minVersion) && cmpSemver(version, m.minVersion) < 0) {
    return false;
  }
  if (m.maxVersion && parseSemver(m.maxVersion) && cmpSemver(version, m.maxVersion) > 0) {
    return false;
  }
  return true;
}

// 获取不兼容的参数列表（当前版本不支持的参数）
export function getIncompatibleParams(version: string): string[] {
  const out: string[] = [];
  for (const name of Object.keys(PARAMETER_MAPPINGS)) {
    if (!isParamSupported(name, version)) {
      out.push(name);
    }
  }
  return out;
}

// 获取所有参数名称
export function getAllParamNames(): string[] {
  return Object.keys(PARAMETER_MAPPINGS);
}
