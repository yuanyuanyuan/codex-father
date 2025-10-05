import type { ToolResult } from '../handlers/types.js';
import type { RunResult } from '../utils/childProcess.js';

export type CliErrorPayload = {
  code: string;
  message: string;
  hint?: string;
  example?: Record<string, unknown>;
  details?: Record<string, unknown>;
};

export function createErrorResult({
  code,
  message,
  hint,
  example,
  details,
}: CliErrorPayload): ToolResult {
  const payload: Record<string, unknown> = { code, message };
  if (hint) {
    payload.hint = hint;
  }
  if (example) {
    payload.example = example;
  }
  if (details && Object.keys(details).length) {
    payload.details = details;
  }
  const textLines = [message];
  if (hint) {
    textLines.push(`提示：${hint}`);
  }
  return {
    content: [{ type: 'text', text: textLines.join('\n') }],
    structuredContent: { error: payload },
    isError: true,
  };
}

export function errorFromException(error: unknown, hint?: string): ToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return createErrorResult({ code: 'CLI_RUNTIME_ERROR', message, hint });
}

export function createCliExitError(
  command: string,
  result: RunResult,
  hint?: string,
  extraDetails?: Record<string, unknown>
): ToolResult {
  const details: Record<string, unknown> = {
    command,
    exitCode: result.code,
  };
  if (result.stderr.trim()) {
    details.stderr = result.stderr.trim();
  }
  if (result.stdout.trim()) {
    details.stdout = result.stdout.trim();
  }
  if (extraDetails) {
    Object.assign(details, extraDetails);
  }
  return createErrorResult({
    code: 'CLI_NON_ZERO_EXIT',
    message: `命令 ${command} 以退出码 ${result.code} 结束。`,
    hint,
    details,
  });
}
