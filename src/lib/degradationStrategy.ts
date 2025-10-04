import { type CodexConfig } from './configSchema';
import { getIncompatibleParams, getParamMinVersion, isParamSupported } from './parameterMapping';
import { formatJsonRpcError } from './errorFormatter';

export interface CliCheckResult {
  compatible: boolean;
  incompatibleParams: string[];
  errorMessage?: string;
}

export interface ConfigFilterResult {
  filteredConfig: CodexConfig;
  warnings: string[];
  filtered: string[];
}

export interface McpValidationResult {
  valid: boolean;
  error?: {
    code: number; // JSON-RPC error code
    message: string;
    data?: any;
  };
}

function normalizeVersion(v: string): string {
  // Ensure semantic form X.Y.Z
  const m = v.match(/^(\d+)\.(\d+)(?:\.(\d+))?$/);
  if (!m) {
    return v;
  }
  return `${m[1]}.${m[2]}.${m[3] ?? '0'}`;
}

/**
 * CLI 层：检查 CLI 参数的版本兼容性
 */
export function checkCliParams(
  cliParams: Record<string, any>,
  codexVersion: string
): CliCheckResult {
  const version = normalizeVersion(codexVersion);
  const incompatible = new Set(
    getIncompatibleParams(version)
      .filter((n) => n.startsWith('cli.'))
      .map((n) => n.slice(4))
  );

  const found = Object.keys(cliParams || {}).filter((k) => incompatible.has(k));

  if (found.length > 0) {
    return {
      compatible: false,
      incompatibleParams: found,
      errorMessage: `Parameters [${found.join(', ')}] require Codex >= 0.44, current version is ${version}`,
    };
  }

  return { compatible: true, incompatibleParams: [] };
}

/**
 * 配置层：过滤不兼容的配置参数
 */
export function filterConfig(config: CodexConfig, codexVersion: string): ConfigFilterResult {
  const version = normalizeVersion(codexVersion);
  const filteredConfig: any = { ...(config as any) };
  const filtered: string[] = [];
  const warnings: string[] = [];

  const incompatibleConfigParams = new Set(
    getIncompatibleParams(version)
      .filter((n) => n.startsWith('config.'))
      .map((n) => n.slice(7))
  );

  for (const param of incompatibleConfigParams) {
    if (Object.prototype.hasOwnProperty.call(filteredConfig, param)) {
      delete filteredConfig[param];
      filtered.push(param);
      warnings.push(`Parameter '${param}' removed (requires Codex >= 0.44)`);
    }
  }

  return { filteredConfig, warnings, filtered };
}

/**
 * MCP 层：验证 MCP 方法参数
 */
export function validateMcpParams(
  mcpMethod: string,
  params: Record<string, any>,
  codexVersion: string
): McpValidationResult {
  const version = normalizeVersion(codexVersion);

  const keys = Object.keys(params || {});
  for (const key of keys) {
    const minVersion = getParamMinVersion(key);
    if (!minVersion) {
      // 未知参数不在映射表，跳过版本判断
      continue;
    }
    if (!isParamSupported(key, version)) {
      // 构造基础错误消息
      const baseMessage = `Invalid params: '${key}' requires Codex >= ${minVersion}`;
      // 使用统一错误格式化（包含 current 版本和方法名）
      const formatted = formatJsonRpcError(
        -32602,
        baseMessage,
        mcpMethod,
        { param: key, currentVersion: version, minVersion },
        version
      );
      return {
        valid: false,
        error: {
          code: -32602,
          message: formatted.message,
          data: { param: key, currentVersion: version, minVersion },
        },
      };
    }
  }

  return { valid: true };
}
