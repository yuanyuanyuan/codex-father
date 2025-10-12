import * as path from 'node:path';

/**
 * 获取会话根目录
 * 优先级：CODEX_SESSIONS_ROOT > CODEX_SESSIONS_HOME > 默认 .codex-father/sessions
 */
export function getSessionsRoot(): string {
  const envRoot = (process.env.CODEX_SESSIONS_ROOT || process.env.CODEX_SESSIONS_HOME || '').trim();
  if (envRoot) {
    return envRoot.endsWith('/') ? envRoot.slice(0, -1) : envRoot;
  }
  return path.resolve('.codex-father', 'sessions');
}

/**
 * 解析会话目录
 */
export function resolveSessionDir(sessionId: string): string {
  return path.join(getSessionsRoot(), sessionId);
}

/**
 * 解析 events.jsonl 路径
 */
export function resolveEventsPath(sessionId: string): string {
  return path.join(resolveSessionDir(sessionId), 'events.jsonl');
}

/**
 * 解析补丁清单路径
 */
export function resolvePatchesManifestPath(sessionId: string): string {
  return path.join(resolveSessionDir(sessionId), 'patches', 'manifest.jsonl');
}
