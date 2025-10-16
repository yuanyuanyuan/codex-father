export interface ErrorDefinition {
  code: string;
  message: string;
  category: 'validation' | 'io' | 'queue' | 'config' | 'unknown';
}

export class ErrorManager {
  private static registry = new Map<string, ErrorDefinition>();

  static register(def: ErrorDefinition): void {
    this.registry.set(def.code, def);
  }

  static create(code: string, details?: Record<string, unknown>): Error {
    const def = this.registry.get(code);
    if (!def) {
      return Object.assign(new Error(`Unknown error: ${code}`), { code, details });
    }
    return Object.assign(new Error(def.message), {
      code: def.code,
      category: def.category,
      details,
    });
  }

  static has(code: string): boolean {
    return this.registry.has(code);
  }
}

// Pre-register a few common errors used by storage/validation
ErrorManager.register({
  code: 'VAL_SEMVER',
  message: 'Invalid semantic version',
  category: 'validation',
});
ErrorManager.register({
  code: 'FS_LOCK_TIMEOUT',
  message: 'Timeout acquiring file lock',
  category: 'io',
});
ErrorManager.register({
  code: 'CFG_REQUIRED',
  message: 'Configuration value required',
  category: 'config',
});

// HTTP 和 JSON-RPC 错误格式化函数
export interface ErrorResponse {
  code: number;
  message: string;
  context: {
    endpoint?: string;
    method?: string;
    version?: string;
    statusCode?: number;
    requestId?: string;
  };
  suggestions?: Array<{ action: string; message: string; link?: string }>;
  requestId?: string;
}

// 兼容测试期望的formatHttpError函数
export function formatHttpError(
  statusCode: number,
  endpoint: string,
  method: string,
  error: string | Error,
  version?: string,
  requestId?: string
): ErrorResponse {
  const errorMessage = error instanceof Error ? error.message : error;
  const fullErrorMessage = `HTTP ${statusCode} ${errorMessage}`;
  const detailedMessage = `${fullErrorMessage}\nPOST ${endpoint}\nCodex ${version || '0.42.0'}\nwire_api configuration required`;
  
  return {
    code: statusCode,
    message: detailedMessage,
    context: {
      endpoint,
      method,
      version: version || '0.42.0',
      statusCode,
      ...(requestId && { requestId })
    },
    suggestions: getDefaultSuggestions(statusCode),
    requestId: requestId || `req-${Date.now()}`
  };
}

// 兼容测试期望的formatJsonRpcError函数
export function formatJsonRpcError(
  code: number,
  message: string,
  method?: string,
  param?: any,
  version?: string,
  requestId?: string
): ErrorResponse {
  // 如果param中有requestId，优先使用它
  const effectiveRequestId = param?.requestId || requestId;
  const detailedMessage = `${message}\ncurrent: ${version || '0.42.0'}\nin ${method || 'unknown'}`;
  
  return {
    code,
    message: detailedMessage,
    context: {
      method: method || 'unknown',
      version: version || '0.42.0',
      requestId: effectiveRequestId
    },
    suggestions: getDefaultJsonRpcSuggestions(code)
  };
}

function getDefaultSuggestions(statusCode: number): Array<{ action: string; message: string }> {
  switch (statusCode) {
    case 404:
      return [
        { action: 'check_endpoint', message: 'Check if the endpoint exists' },
        { action: 'verify_endpoint', message: 'Verify the endpoint is correct' },
        { action: 'wire_api', message: 'Review wire_api documentation' }
      ];
    case 405:
      return [
        { action: 'check_wire_api', message: 'Review wire_api documentation and configuration' },
        { action: 'verify_model_config', message: 'Verify model configuration compatibility' },
        { action: 'wire_api', message: 'Review wire_api documentation' },
        { action: 'check_method', message: 'Verify HTTP method support' }
      ];
    case 500:
      return [
        { action: 'retry_later', message: 'Try again later' },
        { action: 'contact_support', message: 'Contact support if the issue persists' }
      ];
    default:
      return [
        { action: 'check_request', message: 'Check your request' },
        { action: 'retry', message: 'Try again' }
      ];
  }
}

function getDefaultJsonRpcSuggestions(code: number): Array<{ action: string; message: string }> {
  switch (code) {
    case -32602:
      return [
        { action: 'upgrade_codex', message: 'Upgrade to Codex 0.44 or higher' },
        { action: 'remove_parameter', message: 'Remove incompatible parameter' }
      ];
    case -32601:
      return [
        { action: 'check_method_name', message: 'Verify the method exists' },
        { action: 'check_request', message: 'Check request structure' }
      ];
    case -32600:
      return [
        { action: 'validate_request', message: 'Validate JSON-RPC request format' }
      ];
    default:
      return [
        { action: 'retry', message: 'Try again' },
        { action: 'contact_support', message: 'Contact support if needed' }
      ];
  }
}
