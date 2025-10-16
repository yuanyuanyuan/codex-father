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

export function formatHttpError(
  error: Error | string,
  context: HttpErrorContext,
  suggestions?: string[]
): {
  error: string;
  code: string;
  context: HttpErrorContext;
  suggestions: string[];
  requestId: string;
} {
  const errorMessage = error instanceof Error ? error.message : error;
  const requestId = context.requestId || `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const defaultSuggestions = [
    'Check your request parameters',
    'Verify your authentication credentials',
    'Try again later',
  ];

  return {
    error: errorMessage,
    code: getErrorCode(context.statusCode),
    context,
    suggestions: suggestions || defaultSuggestions,
    requestId,
  };
}

export function formatJsonRpcError(
  error: Error | string,
  context: JsonRpcErrorContext,
  code?: number,
  suggestions?: string[]
): {
  error: string;
  code: number;
  context: JsonRpcErrorContext;
  suggestions: string[];
  requestId?: string;
} {
  const errorMessage = error instanceof Error ? error.message : error;
  const errorCode = code || -32603; // Internal error

  const defaultSuggestions = [
    'Check your method parameters',
    'Verify the method name is correct',
    'Check your connection',
  ];

  return {
    error: errorMessage,
    code: errorCode,
    context,
    suggestions: suggestions || defaultSuggestions,
    requestId: context.requestId,
  };
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
