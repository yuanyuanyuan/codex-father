import process from 'node:process';

import { createErrorResult } from '../errors/cli.js';
import type { ToolResult } from '../handlers/types.js';
import type { RunResult } from './childProcess.js';
import { run } from './childProcess.js';

let cachedCodexVersion: string | null = null;

export function normalizeSemver(v: string): string | null {
  const m = v.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) {
    return null;
  }
  return `${m[1]}.${m[2]}.${m[3] ?? '0'}`;
}

export function cmpSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number(n));
  const pb = b.split('.').map((n) => Number(n));
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) {
      return da - db;
    }
  }
  return 0;
}

export async function detectCodexVersion(): Promise<string> {
  if (cachedCodexVersion) {
    return cachedCodexVersion;
  }
  const override = process.env.CODEX_VERSION_OVERRIDE;
  if (override) {
    const normalized = normalizeSemver(override);
    if (!normalized) {
      throw new Error(`Invalid CODEX_VERSION_OVERRIDE: ${override}`);
    }
    cachedCodexVersion = normalized;
    return cachedCodexVersion;
  }
  const result: RunResult = await run('codex', ['--version']);
  if (result.code !== 0) {
    throw new Error(
      `Failed to detect Codex version: ${result.stderr || result.stdout || `exit=${result.code}`}`
    );
  }
  const out = (result.stdout || result.stderr).trim();
  const match = out.match(/(\d+\.\d+(?:\.\d+)?)/);
  if (!match) {
    throw new Error(`Unable to parse Codex version from output: ${out}`);
  }
  const normalized = normalizeSemver(match[1]!);
  if (!normalized) {
    throw new Error(`Invalid semantic version detected: ${match[1]}`);
  }
  cachedCodexVersion = normalized;
  return cachedCodexVersion;
}

export function listIncompatibleCliParams(
  p: Record<string, unknown> | undefined,
  version: string,
  rawArgs: string[]
): string[] {
  const incompatible: string[] = [];
  if (!p) {
    p = {};
  }
  if (p.profile && cmpSemver(version, '0.44.0') < 0) {
    incompatible.push('profile');
  }
  if ((p as any).fullAuto && cmpSemver(version, '0.44.0') < 0) {
    incompatible.push('fullAuto');
  }
  if ((p as any).dangerouslyBypass && cmpSemver(version, '0.44.0') < 0) {
    incompatible.push('dangerouslyBypass');
  }

  const args = Array.isArray(rawArgs) ? rawArgs.map(String) : [];
  const hasFlag = (flag: string) => args.includes(flag);
  if (hasFlag('--profile') && cmpSemver(version, '0.44.0') < 0) {
    incompatible.push('cli.--profile');
  }
  if (hasFlag('--full-auto') && cmpSemver(version, '0.44.0') < 0) {
    incompatible.push('cli.--full-auto');
  }
  if (hasFlag('--dangerously-bypass-approvals-and-sandbox') && cmpSemver(version, '0.44.0') < 0) {
    incompatible.push('cli.--dangerously-bypass-approvals-and-sandbox');
  }
  return incompatible;
}

export function listIncompatibleConfigKeys(
  cfg: Record<string, unknown> | undefined,
  version: string
): string[] {
  if (!cfg || typeof cfg !== 'object') {
    return [];
  }
  const keys = Object.keys(cfg);
  const vlt = cmpSemver(version, '0.44.0') < 0;
  const v44Only = new Set([
    'model_reasoning_effort',
    'model_reasoning_summary',
    'model_supports_reasoning_summaries',
    'model_verbosity',
    'profile',
  ]);
  const hit: string[] = [];
  if (vlt) {
    for (const k of keys) {
      if (v44Only.has(k)) {
        hit.push(k);
      }
    }
  }
  return hit;
}

export function buildIncompatErrorResult(
  currentVersion: string,
  cliParams: string[],
  cfgKeys: string[]
): ToolResult {
  const details: Record<string, unknown> = { currentVersion };
  if (cliParams.length) {
    details.cli = cliParams;
  }
  if (cfgKeys.length) {
    details.config = cfgKeys;
  }
  const hint = '移除上述参数或将 Codex 升级到 >= 0.44.0。';
  return createErrorResult({
    code: 'CODEX_VERSION_INCOMPATIBLE',
    message: `Codex ${currentVersion} 不支持所请求的高级参数`,
    hint,
    details,
  });
}
