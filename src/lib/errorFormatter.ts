export interface HttpErrorContext {
  endpoint: string;
  method: string;
  version: string;
  statusCode: number;
  requestId?: string;
}

export interface JsonRpcErrorContext {
  method: string;
  version: string;
  requestId?: string;
}

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
  suggestions?: string[];
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
  
  return {
    code: statusCode,
    message: errorMessage,
    context: {
      endpoint,
      method,
      version: version || '0.42.0',
      statusCode,
      requestId
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
  version?: string,
  requestId?: string
): ErrorResponse {
  return {
    code,
    message,
    context: {
      method: method || 'unknown',
      version: version || '0.42.0',
      requestId
    },
    suggestions: getDefaultJsonRpcSuggestions(code)
  };
}

function getDefaultSuggestions(statusCode: number): string[] {
  switch (statusCode) {
    case 404:
      return ['Check if the endpoint exists', 'Verify the URL is correct'];
    case 405:
      return ['Check if the HTTP method is allowed', 'Verify the endpoint supports this method'];
    case 500:
      return ['Try again later', 'Contact support if the issue persists'];
    default:
      return ['Check your request', 'Try again'];
  }
}

function getDefaultJsonRpcSuggestions(code: number): string[] {
  switch (code) {
    case -32602:
      return ['Check your parameters', 'Verify parameter types'];
    case -32601:
      return ['Check method name', 'Verify the method exists'];
    case -32600:
      return ['Check request format', 'Verify JSON-RPC structure'];
    default:
      return ['Try again', 'Contact support'];
  }
}

function getErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 405:
      return 'METHOD_NOT_ALLOWED';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 429:
      return 'RATE_LIMITED';
    case 500:
      return 'INTERNAL_ERROR';
    case 502:
      return 'BAD_GATEWAY';
    case 503:
      return 'SERVICE_UNAVAILABLE';
    default:
      return 'UNKNOWN_ERROR';
  }
}