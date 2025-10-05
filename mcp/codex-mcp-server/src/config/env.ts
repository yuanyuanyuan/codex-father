import type { LogLevel } from '../logger.js';
import { isValidLogLevel } from '../logger.js';

export type TransportKind = 'ndjson' | 'content-length';

export type ParsedEnv = {
  logLevel: LogLevel;
  nameStyle: string;
  toolPrefix: string;
  hideOriginal: boolean;
  maxConcurrentJobs: number | null;
  approvalPolicy: string;
  warnings: string[];
};

export type ParsedCli = {
  transport: TransportKind;
  showHelp: boolean;
  showVersion: boolean;
  unknownArgs: string[];
};

const SUPPORTED_NAME_STYLES = new Set(['', 'underscore-only', 'dot-only']);
const SUPPORTED_TRANSPORTS: (TransportKind | 'stdio')[] = ['ndjson', 'content-length', 'stdio'];
const SUPPORTED_APPROVAL_POLICIES = new Set(['untrusted', 'on-failure', 'on-request', 'never']);

function parseLogLevel(raw: string | undefined, warnings: string[]): LogLevel {
  if (!raw) {
    return 'info';
  }
  const normalized = raw.toLowerCase();
  if (isValidLogLevel(normalized)) {
    return normalized;
  }
  warnings.push(`未知 LOG_LEVEL 值：${raw}，已回退为 info。`);
  return 'info';
}

export function parseEnv(): ParsedEnv {
  const warnings: string[] = [];
  const logLevel = parseLogLevel(process.env.LOG_LEVEL, warnings);

  const rawStyle = String(process.env.CODEX_MCP_NAME_STYLE || '').toLowerCase();
  const normalizedStyle = SUPPORTED_NAME_STYLES.has(rawStyle) ? rawStyle : '';
  if (rawStyle && !SUPPORTED_NAME_STYLES.has(rawStyle)) {
    warnings.push(
      `CODEX_MCP_NAME_STYLE=${rawStyle} 不受支持，已回退为默认（同时保留点号和下划线）。`
    );
  }

  const toolPrefix = String(process.env.CODEX_MCP_TOOL_PREFIX || '').trim();
  const hideOriginalRaw = String(process.env.CODEX_MCP_HIDE_ORIGINAL || '').toLowerCase();
  const hideOriginal = hideOriginalRaw === '1' || hideOriginalRaw === 'true';

  const maxConcurrentRaw = process.env.MAX_CONCURRENT_JOBS;
  let maxConcurrentJobs: number | null = null;
  if (maxConcurrentRaw) {
    const parsed = Number(maxConcurrentRaw);
    if (Number.isInteger(parsed) && parsed > 0) {
      maxConcurrentJobs = parsed;
    } else {
      warnings.push(`MAX_CONCURRENT_JOBS=${maxConcurrentRaw} 不是正整数，已忽略。`);
    }
  }

  const approvalPolicyRaw = String(process.env.APPROVAL_POLICY || '').trim();
  if (approvalPolicyRaw && !SUPPORTED_APPROVAL_POLICIES.has(approvalPolicyRaw)) {
    warnings.push(
      `APPROVAL_POLICY=${approvalPolicyRaw} 未知，允许值：${Array.from(SUPPORTED_APPROVAL_POLICIES).join(' | ')}。`
    );
  }

  return {
    logLevel,
    nameStyle: normalizedStyle,
    toolPrefix,
    hideOriginal,
    maxConcurrentJobs,
    approvalPolicy: approvalPolicyRaw,
    warnings,
  };
}

export function parseCliArgs(argv: string[]): ParsedCli {
  // 默认使用 NDJSON（与当前 @modelcontextprotocol/sdk 的 stdio 实现一致）
  let transport: TransportKind = 'ndjson';
  let showHelp = false;
  let showVersion = false;
  const unknownArgs: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      showHelp = true;
      continue;
    }
    if (token === '--version' || token === '-V') {
      showVersion = true;
      continue;
    }
    if (token.startsWith('--transport')) {
      let value: string | undefined;
      if (token.includes('=')) {
        value = token.split('=')[1];
      } else {
        value = argv[i + 1];
        if (value) {
          i += 1;
        }
      }
      if (!value) {
        unknownArgs.push('--transport (缺少值)');
        continue;
      }
      const normalized = value.toLowerCase();
      if ((SUPPORTED_TRANSPORTS as string[]).includes(normalized)) {
        if (normalized === 'stdio') {
          // 为向后兼容保留别名：stdio ≈ ndjson（当前 SDK 行为）
          transport = 'ndjson';
        } else {
          transport = normalized as TransportKind;
        }
      } else {
        unknownArgs.push(`--transport=${value}`);
      }
      continue;
    }
    unknownArgs.push(token);
  }

  return { transport, showHelp, showVersion, unknownArgs };
}
