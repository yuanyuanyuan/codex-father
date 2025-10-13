import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { LegacyScriptRunner } from '../cli/scripts.js';

export type BulkStatusItem = { jobId: string; status: unknown | null; error?: string };
export type BulkStatusResult = { success: true; data: BulkStatusItem[]; executionTime: number };

export type BulkStopPreviewItem = {
  jobId: string;
  state?: string;
  eligible: boolean;
  reason?: string;
};

export type BulkStopResult = {
  success: true;
  data:
    | {
        dryRun: true;
        force: boolean;
        preview: BulkStopPreviewItem[];
        advice: {
          retry: { suggested: string; cooldownSeconds: number };
          rollback: { supported: boolean; mode: string };
        };
      }
    | {
        dryRun: false;
        force: boolean;
        stopped: string[];
        failed: Array<{ jobId: string; error: string }>;
        summary: { total: number; stopped: number; failed: number };
        advice: {
          retry: { suggested: string; cooldownSeconds: number };
          rollback: { supported: boolean; mode: string };
        };
      };
  executionTime: number;
};

export type BulkResumePreviewItem = {
  jobId: string;
  state?: string;
  resumeFrom?: number | null;
  eligible: boolean;
  reason?: string;
};

export type BulkResumeResult = {
  success: true;
  data:
    | {
        dryRun: true;
        preview: BulkResumePreviewItem[];
        resumeFrom?: number;
        skipCompleted: boolean;
        advice: {
          retry: { suggested: string; cooldownSeconds: number };
          rollback: { supported: boolean; mode: string };
        };
      }
    | {
        dryRun: false;
        resumed: string[];
        failed: Array<{ jobId: string; error: string }>;
        summary: { total: number; resumed: number; failed: number };
        advice: {
          retry: { suggested: string; cooldownSeconds: number };
          rollback: { supported: boolean; mode: string };
        };
      };
  executionTime: number;
};

export interface BulkCommonOptions {
  sessions?: string; // explicit sessions root
  repoRoot?: string; // repo root to auto resolve sessions
}

export interface BulkStatusParams extends BulkCommonOptions {
  jobIds: string[];
  refresh?: boolean; // use job.sh status --json to refresh before reading
}

export interface BulkStopParams extends BulkCommonOptions {
  jobIds: string[];
  execute?: boolean;
  force?: boolean;
  refresh?: boolean; // refresh status via job.sh before reading
}

export interface BulkResumeParams extends BulkCommonOptions {
  jobIds: string[];
  execute?: boolean;
  resumeFrom?: number; // override suggested resume_from
  skipCompleted?: boolean;
  refresh?: boolean; // refresh status via job.sh before reading
}

function resolveSessionsRoot(repoRoot: string, explicit?: string): string {
  if (explicit && fs.existsSync(explicit)) {
    return explicit;
  }
  const candidates = [
    path.join(repoRoot, '.codex-father', 'sessions'),
    path.join(repoRoot, '.codex-father-sessions'),
    path.join(process.cwd(), '.codex-father-sessions'),
    path.join(process.cwd(), '.codex-father', 'sessions'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return path.join(repoRoot, '.codex-father', 'sessions');
}

async function readJsonSafe<T = unknown>(file: string): Promise<T | null> {
  try {
    const buf = await fsp.readFile(file, 'utf-8');
    return JSON.parse(buf) as T;
  } catch {
    return null;
  }
}

export async function codex_bulk_status(params: BulkStatusParams): Promise<BulkStatusResult> {
  const started = Date.now();
  const ids = params.jobIds;
  const repoRoot = params.repoRoot || process.cwd();
  const sessions = resolveSessionsRoot(repoRoot, params.sessions);

  const out: BulkStatusItem[] = [];
  for (const id of ids) {
    const p = path.join(sessions, id, 'state.json');
    let data: any = null;
    if (params.refresh) {
      try {
        const r = await LegacyScriptRunner.job(['status', id, '--json']);
        data = JSON.parse(r.stdout || '{}');
      } catch {
        // fallthrough to fs read
      }
    }
    if (!data) {
      data = await readJsonSafe(p);
    }
    if (data) {
      out.push({ jobId: id, status: data });
    } else {
      out.push({ jobId: id, status: null, error: `state.json not found: ${p}` });
    }
  }
  return { success: true, data: out, executionTime: Date.now() - started };
}

export async function codex_bulk_stop(params: BulkStopParams): Promise<BulkStopResult> {
  const started = Date.now();
  const ids = params.jobIds;
  const repoRoot = params.repoRoot || process.cwd();
  const sessions = resolveSessionsRoot(repoRoot, params.sessions);
  const force = Boolean(params.force);
  const execute = Boolean(params.execute);

  const preview: BulkStopPreviewItem[] = [];
  const stopped: string[] = [];
  const failed: Array<{ jobId: string; error: string }> = [];

  for (const id of ids) {
    const statePath = path.join(sessions, id, 'state.json');
    let stateObj: any = null;
    if (params.refresh) {
      try {
        const r = await LegacyScriptRunner.job(['status', id, '--json']);
        stateObj = JSON.parse(r.stdout || '{}');
      } catch {
        // fallthrough
      }
    }
    if (!stateObj) {
      stateObj = await readJsonSafe(statePath);
    }
    const st = stateObj?.state as string | undefined;
    const eligible = st === 'running';

    if (!execute) {
      const item: BulkStopPreviewItem = { jobId: id, eligible };
      if (st) {
        item.state = st;
      }
      if (!eligible) {
        item.reason = 'not_running';
      }
      preview.push(item);
      continue;
    }

    if (!eligible) {
      failed.push({ jobId: id, error: 'not_running' });
      continue;
    }

    try {
      const args = ['stop', id, '--json'];
      if (force) {
        args.push('--force');
      }
      const r = await LegacyScriptRunner.job(args);
      if (r.success) {
        stopped.push(id);
      } else {
        failed.push({ jobId: id, error: r.stderr || `exit ${r.exitCode}` });
      }
    } catch (e: any) {
      failed.push({ jobId: id, error: e?.message || 'unknown_error' });
    }
  }

  if (!execute) {
    return {
      success: true,
      data: {
        dryRun: true,
        force,
        preview,
        advice: {
          retry: { suggested: 'none', cooldownSeconds: 0 },
          rollback: { supported: false, mode: 'none' },
        },
      },
      executionTime: Date.now() - started,
    };
  }

  return {
    success: true,
    data: {
      dryRun: false,
      force,
      stopped,
      failed,
      summary: { total: ids.length, stopped: stopped.length, failed: failed.length },
      advice: {
        retry: { suggested: failed.length > 0 ? 'retry_failed_only' : 'none', cooldownSeconds: 5 },
        rollback: { supported: false, mode: 'none' },
      },
    },
    executionTime: Date.now() - started,
  };
}

export async function codex_bulk_resume(params: BulkResumeParams): Promise<BulkResumeResult> {
  const started = Date.now();
  const ids = params.jobIds;
  const repoRoot = params.repoRoot || process.cwd();
  const sessions = resolveSessionsRoot(repoRoot, params.sessions);
  const execute = Boolean(params.execute);
  const resumeFromCLI = params.resumeFrom;
  const skipCompleted = Boolean(params.skipCompleted);

  const preview: BulkResumePreviewItem[] = [];
  const resumed: string[] = [];
  const failed: Array<{ jobId: string; error: string }> = [];

  for (const id of ids) {
    const statePath = path.join(sessions, id, 'state.json');
    let stateObj: any = null;
    if (params.refresh) {
      try {
        const r = await LegacyScriptRunner.job(['status', id, '--json']);
        stateObj = JSON.parse(r.stdout || '{}');
      } catch {
        // fallthrough
      }
    }
    if (!stateObj) {
      stateObj = await readJsonSafe(statePath);
    }
    const st = stateObj?.state as string | undefined;
    const resumeFromState =
      typeof stateObj?.resume_from === 'number' ? (stateObj.resume_from as number) : null;
    const chosenResume = resumeFromCLI ?? resumeFromState ?? null;
    const eligible = st !== 'running';

    if (!execute) {
      const item: BulkResumePreviewItem = { jobId: id, eligible, resumeFrom: chosenResume };
      if (st) {
        item.state = st;
      }
      if (!eligible) {
        item.reason = 'running';
      }
      preview.push(item);
      continue;
    }

    if (!eligible) {
      failed.push({ jobId: id, error: 'running' });
      continue;
    }

    try {
      const args = ['resume', id, '--json'];
      if (chosenResume !== null && chosenResume !== undefined) {
        args.push('--resume-from', String(chosenResume));
      }
      if (skipCompleted) {
        args.push('--skip-completed');
      }
      const r = await LegacyScriptRunner.job(args);
      if (r.success) {
        resumed.push(id);
      } else {
        failed.push({ jobId: id, error: r.stderr || `exit ${r.exitCode}` });
      }
    } catch (e: any) {
      failed.push({ jobId: id, error: e?.message || 'unknown_error' });
    }
  }

  if (!execute) {
    const base: any = {
      dryRun: true,
      preview,
      skipCompleted,
      advice: {
        retry: { suggested: 'none', cooldownSeconds: 0 },
        rollback: { supported: false, mode: 'none' },
      },
    };
    if (resumeFromCLI !== undefined) {
      (base as any).resumeFrom = resumeFromCLI;
    }
    return {
      success: true,
      data: base,
      executionTime: Date.now() - started,
    };
  }

  return {
    success: true,
    data: {
      dryRun: false,
      resumed,
      failed,
      summary: { total: ids.length, resumed: resumed.length, failed: failed.length },
      advice: {
        retry: { suggested: failed.length > 0 ? 'retry_failed_only' : 'none', cooldownSeconds: 5 },
        rollback: { supported: false, mode: 'none' },
      },
    },
    executionTime: Date.now() - started,
  };
}

export default {
  codex_bulk_status,
  codex_bulk_stop,
  codex_bulk_resume,
};
