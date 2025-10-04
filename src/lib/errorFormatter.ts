export interface ErrorContext {
  endpoint?: string;
  method?: string;
  version?: string;
  statusCode?: number;
  requestId?: string;
  // 允许扩展
  [key: string]: any;
}

export interface ErrorSuggestion {
  action: string;
  description: string;
  link?: string;
}

export interface ErrorResponse {
  code: string | number;
  message: string;
  context: ErrorContext;
  suggestions: ErrorSuggestion[];
}

const HTTP_STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

function buildHttpMessage(
  statusCode: number,
  endpoint: string,
  method: string,
  codexVersion?: string,
  rawError?: string
): string {
  const text = HTTP_STATUS_TEXT[statusCode] || (rawError ? String(rawError) : 'HTTP Error');
  const base = `HTTP ${statusCode} ${text} on ${method} ${endpoint}`;
  const withVer = codexVersion ? `${base} (Codex ${codexVersion})` : base;
  // 针对典型错误追加提示
  if (statusCode === 405) {
    return `${withVer}. This usually indicates a wire_api mismatch.`;
  }
  return withVer;
}

function buildHttpSuggestions(statusCode: number): ErrorSuggestion[] {
  if (statusCode === 405) {
    return [
      {
        action: 'check_wire_api',
        description: "If using gpt-5-codex, ensure wire_api='responses' (not 'chat')",
        link: 'specs/008-ultrathink-codex-0/research.md#6',
      },
      {
        action: 'verify_model_config',
        description: 'Check model_providers.<id>.wire_api in ~/.codex/config.toml',
      },
    ];
  }
  if (statusCode === 404) {
    return [
      {
        action: 'verify_endpoint',
        description: 'Check the endpoint path and API version segment (e.g., /v1/conversations)',
      },
      {
        action: 'check_docs',
        description: 'Consult API/docs to confirm the correct route and method',
      },
    ];
  }
  if (statusCode >= 500) {
    return [
      { action: 'retry_later', description: 'Retry after a short delay; may be transient' },
      { action: 'check_service_status', description: 'Check upstream service or provider status' },
      { action: 'enable_debug_logs', description: 'Enable debug logs to capture full response' },
    ];
  }
  // 通用建议
  return [{ action: 'check_request', description: 'Verify request payload, headers and auth' }];
}

export function formatHttpError(
  statusCode: number,
  endpoint: string,
  method: string,
  rawError: string,
  codexVersion?: string
): ErrorResponse {
  const context: ErrorContext = {
    endpoint,
    method,
    version: codexVersion,
    statusCode,
  };

  const message = buildHttpMessage(statusCode, endpoint, method, codexVersion, rawError);
  const suggestions = buildHttpSuggestions(statusCode);

  return {
    code: statusCode,
    message,
    context,
    suggestions,
  };
}

function ensureCurrentVersionInMessage(message: string, codexVersion?: string): string {
  if (!codexVersion) {
    return message;
  }
  if (/current:\s*\d+\.\d+\.\d+/.test(message)) {
    return message;
  }
  return `${message} (current: ${codexVersion})`;
}

function buildJsonRpcSuggestions(
  code: number,
  message: string,
  mcpMethod: string,
  data?: any
): ErrorSuggestion[] {
  switch (code) {
    case -32602: {
      // 尝试从消息中提取参数名（如: "Invalid params: 'profile' requires Codex >= 0.44"）
      const m = message.match(/'([^']+)'/);
      const param = m?.[1] || 'parameter';
      return [
        { action: 'upgrade_codex', description: 'Upgrade Codex to version 0.44 or later' },
        { action: 'remove_parameter', description: `Remove '${param}' parameter from the request` },
      ];
    }
    case -32601:
      return [
        { action: 'check_method_name', description: 'Verify MCP method name and availability' },
        {
          action: 'upgrade_codex',
          description: 'Upgrade Codex if the method requires newer version',
        },
      ];
    case -32600:
      return [
        {
          action: 'validate_request',
          description: 'Validate JSON-RPC request structure and required fields',
        },
        { action: 'check_mcp_schema', description: 'Refer to MCP contracts for valid schema' },
      ];
    default:
      return [
        {
          action: 'check_logs',
          description: 'Check logs for detailed diagnostics and steps to reproduce',
        },
      ];
  }
}

export function formatJsonRpcError(
  code: number,
  message: string,
  mcpMethod: string,
  data?: any,
  codexVersion?: string
): ErrorResponse {
  const context: ErrorContext = {
    method: mcpMethod,
    version: codexVersion,
  };
  if (data && typeof data === 'object' && data.requestId) {
    context.requestId = String(data.requestId);
  }

  const fullMessage = ensureCurrentVersionInMessage(message, codexVersion) + ` in ${mcpMethod}`;
  const suggestions = buildJsonRpcSuggestions(code, message, mcpMethod, data);

  return {
    code,
    message: fullMessage,
    context,
    suggestions,
  };
}

export default {
  formatHttpError,
  formatJsonRpcError,
};
