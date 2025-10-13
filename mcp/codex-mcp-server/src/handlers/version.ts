import type { ToolResult } from './types.js';

// 读取本包与工作区根的信息
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function readPkgSafe(path: string): { name?: string; version?: string } {
  try {
    return require(path) as { name?: string; version?: string };
  } catch {
    return {};
  }
}

export async function handleVersion(): Promise<ToolResult> {
  const serverPkg = readPkgSafe('../../package.json');
  // 工作区根 package.json（向上两级：mcp/codex-mcp-server → repo root）
  const rootPkg = readPkgSafe('../../../package.json');

  const data = {
    mcpName: serverPkg.name ?? 'codex-father-mcp',
    mcpVersion: serverPkg.version ?? 'unknown',
    coreName: rootPkg.name ?? 'codex-father',
    coreVersion: rootPkg.version ?? 'unknown',
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    pid: process.pid,
  } as const;

  const text =
    `${data.mcpName} v${data.mcpVersion}\n` +
    `${data.coreName} v${data.coreVersion}\n` +
    `Node ${data.node} on ${data.platform}`;

  return {
    content: [{ type: 'text', text }],
    structuredContent: data as unknown as Record<string, unknown>,
  };
}
