import type { CLIParser } from '../parser.js';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { LegacyScriptRunner } from '../scripts.js';

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

export function registerBulkCommands(parser: CLIParser): void {
  // bulk:status
  parser.registerCommand(
    'bulk:status',
    '批量查询多个 Job 状态',
    async (ctx) => {
      const ids = (ctx.options.jobs as string[] | undefined) ?? ctx.args;
      if (!ids || ids.length === 0) {
        throw new Error('请通过 --jobs <id1> --jobs <id2> 或位置参数提供 jobId 列表');
      }
      const repoRoot = (ctx.options.repoRoot as string) || process.cwd();
      const sessions = resolveSessionsRoot(repoRoot, ctx.options.sessions as string | undefined);
      const out: Array<{ jobId: string; status: unknown; error?: string }> = [];
      for (const id of ids) {
        const p = path.join(sessions, id, 'state.json');
        const data = await readJsonSafe(p);
        if (data) {
          out.push({ jobId: id, status: data });
        } else {
          out.push({ jobId: id, status: null, error: `state.json not found: ${p}` });
        }
      }
      return { success: true, data: out, executionTime: 0 };
    },
    {
      arguments: [
        { name: 'jobIds...', description: 'Job ID 列表（位置参数，可多个）', required: false },
      ],
      options: [
        { flags: '--jobs <id...>', description: 'Job ID 列表（可多次传递）' },
        { flags: '--sessions <path>', description: 'sessions 根目录（可选）' },
        { flags: '--repo-root <path>', description: '仓库根目录（默认 CWD）' },
      ],
      usage: 'bulk:status [jobId ...] --jobs <id...>',
    }
  );

  // bulk:stop (preview by default; --execute to perform)
  parser.registerCommand(
    'bulk:stop',
    '批量停止多个 Job（默认预演，--execute 才执行）',
    async (ctx) => {
      const ids = (ctx.options.jobs as string[] | undefined) ?? ctx.args;
      if (!ids || ids.length === 0) {
        throw new Error('请通过 --jobs <id1> --jobs <id2> 或位置参数提供 jobId 列表');
      }
      const repoRoot = (ctx.options.repoRoot as string) || process.cwd();
      const sessions = resolveSessionsRoot(repoRoot, ctx.options.sessions as string | undefined);
      const force = Boolean(ctx.options.force);
      const execute = Boolean(ctx.options.execute);

      const preview: Array<{ jobId: string; state?: string; eligible: boolean; reason?: string }> =
        [];
      const stopped: string[] = [];
      const failed: Array<{ jobId: string; error: string }> = [];

      for (const id of ids) {
        const statePath = path.join(sessions, id, 'state.json');
        let stateObj: any = null;
        try {
          // Use job.sh status --json to refresh state (read‑only)
          const r = await LegacyScriptRunner.job(['status', id, '--json']);
          stateObj = JSON.parse(r.stdout || '{}');
          if (!stateObj || typeof stateObj.state !== 'string') {
            // Fallback to filesystem snapshot when stdout is empty or malformed
            stateObj = await readJsonSafe(statePath);
          }
        } catch {
          stateObj = await readJsonSafe(statePath);
        }
        const st = stateObj?.state as string | undefined;
        const eligible = st === 'running';
        if (!execute) {
          const item: { jobId: string; state?: string; eligible: boolean; reason?: string } = {
            jobId: id,
            eligible,
          };
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
          executionTime: 0,
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
            retry: {
              suggested: failed.length > 0 ? 'retry_failed_only' : 'none',
              cooldownSeconds: 5,
            },
            rollback: { supported: false, mode: 'none' },
          },
        },
        executionTime: 0,
      };
    },
    {
      arguments: [
        { name: 'jobIds...', description: 'Job ID 列表（位置参数，可多个）', required: false },
      ],
      options: [
        { flags: '--jobs <id...>', description: 'Job ID 列表（可多次传递）' },
        { flags: '--execute', description: '执行停止（默认只预演）' },
        { flags: '--force', description: '强制停止（SIGKILL）' },
        { flags: '--sessions <path>', description: 'sessions 根目录（可选）' },
        { flags: '--repo-root <path>', description: '仓库根目录（默认 CWD）' },
      ],
      usage: 'bulk:stop [jobId ...] --jobs <id...> [--execute] [--force]',
    }
  );

  // bulk:resume (preview by default; --execute to perform)
  parser.registerCommand(
    'bulk:resume',
    '批量恢复多个 Job（默认预演，--execute 才执行）',
    async (ctx) => {
      const ids = (ctx.options.jobs as string[] | undefined) ?? ctx.args;
      if (!ids || ids.length === 0) {
        throw new Error('请通过 --jobs <id1> --jobs <id2> 或位置参数提供 jobId 列表');
      }
      const repoRoot = (ctx.options.repoRoot as string) || process.cwd();
      const sessions = resolveSessionsRoot(repoRoot, ctx.options.sessions as string | undefined);
      const execute = Boolean(ctx.options.execute);
      const resumeFromCLI = ctx.options.resumeFrom as string | undefined;
      const skipCompleted = Boolean(ctx.options.skipCompleted);

      const preview: Array<{
        jobId: string;
        state?: string;
        resumeFrom?: number | null;
        eligible: boolean;
        reason?: string;
      }> = [];
      const resumed: string[] = [];
      const failed: Array<{ jobId: string; error: string }> = [];

      for (const id of ids) {
        const statePath = path.join(sessions, id, 'state.json');
        let stateObj: any = null;
        try {
          const r = await LegacyScriptRunner.job(['status', id, '--json']);
          stateObj = JSON.parse(r.stdout || '{}');
          if (!stateObj || typeof stateObj.state !== 'string') {
            stateObj = await readJsonSafe(statePath);
          }
        } catch {
          stateObj = await readJsonSafe(statePath);
        }
        const st = stateObj?.state as string | undefined;
        const resumeFromState =
          typeof stateObj?.resume_from === 'number' ? (stateObj.resume_from as number) : null;
        const chosenResume = resumeFromCLI ? Number(resumeFromCLI) : resumeFromState;
        const eligible = st !== 'running';

        if (!execute) {
          const item: {
            jobId: string;
            state?: string;
            resumeFrom?: number | null;
            eligible: boolean;
            reason?: string;
          } = {
            jobId: id,
            eligible,
            resumeFrom: chosenResume ?? null,
          };
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
          if (resumeFromCLI) {
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
        return {
          success: true,
          data: {
            dryRun: true,
            preview,
            resumeFrom: resumeFromCLI ? Number(resumeFromCLI) : undefined,
            skipCompleted,
            advice: {
              retry: { suggested: 'none', cooldownSeconds: 0 },
              rollback: { supported: false, mode: 'none' },
            },
          },
          executionTime: 0,
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
            retry: {
              suggested: failed.length > 0 ? 'retry_failed_only' : 'none',
              cooldownSeconds: 5,
            },
            rollback: { supported: false, mode: 'none' },
          },
        },
        executionTime: 0,
      };
    },
    {
      arguments: [
        { name: 'jobIds...', description: 'Job ID 列表（位置参数，可多个）', required: false },
      ],
      options: [
        { flags: '--jobs <id...>', description: 'Job ID 列表（可多次传递）' },
        { flags: '--execute', description: '执行恢复（默认只预演）' },
        { flags: '--resume-from <n>', description: '指定从第 n 步恢复（默认按状态建议）' },
        { flags: '--skip-completed', description: '跳过已完成步骤（增量恢复）' },
        { flags: '--sessions <path>', description: 'sessions 根目录（可选）' },
        { flags: '--repo-root <path>', description: '仓库根目录（默认 CWD）' },
      ],
      usage:
        'bulk:resume [jobId ...] --jobs <id...> [--execute] [--resume-from <n>] [--skip-completed]',
    }
  );
}
