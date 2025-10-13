import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type UserMcpConfig = {
  projectRoot?: string;
  jobSh?: string;
  startSh?: string;
  ignoreMcpStartFailures?: boolean;
  forceSkipBase?: boolean;
};

// Minimal TOML reader for a single section and simple key = value pairs
function parseMinimalTomlSection(content: string, sectionNames: string[]): Record<string, string> {
  const lines = content.split(/\r?\n/);
  let inSection = false;
  const out: Record<string, string> = {};
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      const sec = line.slice(1, -1).trim();
      inSection = sectionNames.includes(sec);
      continue;
    }
    if (!inSection) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.slice(1, -1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function readUserMcpConfig(): UserMcpConfig | null {
  const file = path.join(os.homedir(), '.codex', 'config.toml');
  if (!fs.existsSync(file)) return null;
  try {
    const content = fs.readFileSync(file, 'utf8');
    const kv = parseMinimalTomlSection(content, [
      'codex_father',
      'codex-father',
      'codex_father.mcp',
    ]);
    const toBool = (s?: string): boolean | undefined => {
      if (!s) return undefined;
      const v = s.toLowerCase();
      if (v === 'true' || v === '1' || v === 'yes') return true;
      if (v === 'false' || v === '0' || v === 'no') return false;
      return undefined;
    };
    return {
      projectRoot: kv['project_root'] || kv['projectRoot'],
      jobSh: kv['job_sh'] || kv['jobSh'],
      startSh: kv['start_sh'] || kv['startSh'],
      ignoreMcpStartFailures: toBool(kv['ignore_mcp_start_failures']),
      forceSkipBase: toBool(kv['force_skip_base']),
    };
  } catch {
    return null;
  }
}

export function applyUserMcpConfigToEnv(): void {
  const cfg = readUserMcpConfig();
  if (!cfg) return;
  if (cfg.projectRoot && !process.env.CODEX_MCP_PROJECT_ROOT) {
    process.env.CODEX_MCP_PROJECT_ROOT = cfg.projectRoot;
  }
  if (cfg.jobSh && !process.env.CODEX_JOB_SH) {
    process.env.CODEX_JOB_SH = cfg.jobSh;
  }
  if (cfg.startSh && !process.env.CODEX_START_SH) {
    process.env.CODEX_START_SH = cfg.startSh;
  }
  if (cfg.ignoreMcpStartFailures !== undefined && !process.env.CODEX_IGNORE_MCP_START_FAILURES) {
    process.env.CODEX_IGNORE_MCP_START_FAILURES = cfg.ignoreMcpStartFailures ? '1' : '0';
  }
  if (cfg.forceSkipBase !== undefined && !process.env.FORCE_SKIP_BASE) {
    process.env.FORCE_SKIP_BASE = cfg.forceSkipBase ? '1' : '0';
  }
}
