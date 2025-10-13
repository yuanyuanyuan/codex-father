import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';

import { codex_bulk_status, codex_bulk_stop, codex_bulk_resume } from '../../core/sdk/bulk.js';
import { LegacyScriptRunner } from '../../core/cli/scripts.js';

function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cf-bulk-'));
}

async function writeJson(file: string, data: unknown) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(data), 'utf-8');
}

describe('SDK: codex_bulk_*', () => {
  let repo: string;
  let sessions: string;

  beforeEach(() => {
    repo = tmpdir();
    sessions = path.join(repo, '.codex-father', 'sessions');
    fs.mkdirSync(sessions, { recursive: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fsp.rm(repo, { recursive: true, force: true });
  });

  it('bulk status: reads existing and reports missing', async () => {
    await writeJson(path.join(sessions, 'job-a', 'state.json'), { id: 'job-a', state: 'failed' });
    const out = await codex_bulk_status({ jobIds: ['job-a', 'job-b'], repoRoot: repo });
    expect(out.success).toBe(true);
    expect(out.data.find((x) => x.jobId === 'job-a')?.status).toBeTruthy();
    expect(out.data.find((x) => x.jobId === 'job-b')?.error).toContain('state.json not found');
  });

  it('bulk stop dry-run: marks running as eligible', async () => {
    await writeJson(path.join(sessions, 'job-run', 'state.json'), {
      id: 'job-run',
      state: 'running',
    });
    await writeJson(path.join(sessions, 'job-fail', 'state.json'), {
      id: 'job-fail',
      state: 'failed',
    });
    const out = await codex_bulk_stop({ jobIds: ['job-run', 'job-fail'], repoRoot: repo });
    if (out.data.dryRun) {
      const preview = out.data.preview;
      expect(preview.find((x) => x.jobId === 'job-run')?.eligible).toBe(true);
      expect(preview.find((x) => x.jobId === 'job-fail')?.eligible).toBe(false);
    } else {
      throw new Error('expected dryRun');
    }
  });

  it('bulk resume dry-run: uses resume_from from state', async () => {
    await writeJson(path.join(sessions, 'job-fail', 'state.json'), {
      id: 'job-fail',
      state: 'failed',
      resume_from: 7,
    });
    const out = await codex_bulk_resume({ jobIds: ['job-fail'], repoRoot: repo });
    if (out.data.dryRun) {
      const preview = out.data.preview;
      expect(preview[0].resumeFrom).toBe(7);
      expect(preview[0].eligible).toBe(true);
    } else {
      throw new Error('expected dryRun');
    }
  });

  it('bulk stop execute: stops eligible and reports summary', async () => {
    await writeJson(path.join(sessions, 'job-run', 'state.json'), {
      id: 'job-run',
      state: 'running',
    });
    await writeJson(path.join(sessions, 'job-done', 'state.json'), {
      id: 'job-done',
      state: 'done',
    });

    vi.spyOn(LegacyScriptRunner, 'job').mockImplementation(async (args: string[]) => {
      const sub = args[0];
      const jobId = args[1];
      if (sub === 'status') {
        const state = jobId === 'job-run' ? 'running' : 'done';
        return {
          success: true,
          exitCode: 0,
          stdout: JSON.stringify({ id: jobId, state }),
          stderr: '',
          duration: 10,
        };
      }
      if (sub === 'stop' && jobId === 'job-run') {
        return { success: true, exitCode: 0, stdout: '{}', stderr: '', duration: 10 };
      }
      return { success: false, exitCode: 1, stdout: '', stderr: 'not_running', duration: 10 };
    });

    const out = await codex_bulk_stop({
      jobIds: ['job-run', 'job-done'],
      repoRoot: repo,
      execute: true,
    });
    if (!out.data.dryRun) {
      expect(out.data.stopped).toContain('job-run');
      expect(out.data.failed.find((x) => x.jobId === 'job-done')?.error).toBe('not_running');
      expect(out.data.summary.total).toBe(2);
    } else {
      throw new Error('expected execute');
    }
  });
});
