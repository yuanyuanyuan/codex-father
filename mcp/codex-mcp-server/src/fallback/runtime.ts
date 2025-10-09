import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type { ToolResult } from '../handlers/types.js';
import { createErrorResult } from '../errors/cli.js';
import { formatJson } from '../utils/format.js';
import type { RunResult } from '../utils/childProcess.js';
import { run } from '../utils/childProcess.js';
import { CliLogger } from '../logger.js';
import { applyConvenienceOptions } from '../handlers/options.js';

const DEFAULT_EXEC_PREFIX = 'exec';
const DEFAULT_JOB_PREFIX = 'job';

function sanitizeTag(raw: unknown): string {
  if (!raw || typeof raw !== 'string') {
    return 'untagged';
  }
  const cleaned = raw
    .trim()
    .replace(/[^A-Za-z0-9_.-]/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'untagged';
}

function timestampSegment(): string {
  // 使用系统本地时区，返回 YYYYMMDDHHmmSS（14 位）
  const d = new Date();
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return (
    String(d.getFullYear()) +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds())
  );
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function shellQuote(value: string): string {
  if (!value.length) {
    return "''";
  }
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

type Invocation = {
  shellCommand: string;
  display: string;
  cwd: string;
  tag: string;
};

type JobState = 'running' | 'succeeded' | 'failed' | 'stopped';

type FallbackJob = {
  id: string;
  command: string;
  cwd: string;
  tag: string;
  createdAt: number;
  updatedAt: number;
  runDir: string;
  logFile: string;
  metaFile: string;
  child: ChildProcess | null;
  state: JobState;
  exitCode: number | null;
  forced: boolean;
};

type CleanOptions = {
  states: string[];
  olderThanHours?: number;
  limit?: number;
  dryRun: boolean;
};

type MetricsOptions = {
  states: string[];
};

type ListOptions = {
  states: string[];
  tagContains?: string;
  limit?: number;
  offset?: number;
};

type ResolveOptions = {
  toolName: 'codex.exec' | 'codex.start';
};

type CommandResolution = Invocation | ToolResult;

type StatusPayload = {
  jobId: string;
  status: JobState;
  exitCode: number | null;
  command: string;
  cwd: string;
  tag: string;
  startedAt: string;
  finishedAt?: string;
  forced: boolean;
  logFile: string;
};

export class FallbackRuntime {
  readonly supportsSyncExec = true;
  readonly supportsJobs = true;

  private readonly jobs = new Map<string, FallbackJob>();

  constructor(
    private readonly projectRoot: string,
    private readonly logger: CliLogger
  ) {}

  async exec(params: Record<string, unknown>): Promise<ToolResult> {
    const resolution = this.resolveInvocation(params, { toolName: 'codex.exec' });
    if (!this.isInvocation(resolution)) {
      return resolution;
    }
    const { shellCommand, display, cwd, tag } = resolution;
    const runId = `${DEFAULT_EXEC_PREFIX}-${timestampSegment()}-${tag}`;
    const runDir = this.prepareRunDir(cwd, runId);
    const logFile = path.join(runDir, 'job.log');
    const metaFile = path.join(runDir, 'meta.json');

    const startedAt = new Date();
    const result = await this.runShell(shellCommand, cwd);
    const finishedAt = new Date();

    const meta = {
      runId,
      command: shellCommand,
      display,
      cwd,
      exitCode: result.code,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      tag,
      stdoutBytes: Buffer.byteLength(result.stdout, 'utf8'),
      stderrBytes: Buffer.byteLength(result.stderr, 'utf8'),
    } satisfies Record<string, unknown>;
    this.writeMeta(metaFile, meta);
    this.writeExecLog(logFile, shellCommand, startedAt, finishedAt, result);

    const payload = {
      runId,
      exitCode: result.code,
      command: shellCommand,
      cwd,
      logFile,
      metaFile,
      tag,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
    } satisfies Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: formatJson(payload),
        },
      ],
      structuredContent: payload,
      isError: result.code !== 0,
    };
  }

  async start(params: Record<string, unknown>): Promise<ToolResult> {
    const resolution = this.resolveInvocation(params, { toolName: 'codex.start' });
    if (!this.isInvocation(resolution)) {
      return resolution;
    }
    const { shellCommand, display, cwd, tag } = resolution;
    const jobId = `${DEFAULT_JOB_PREFIX}-${timestampSegment()}-${tag}`;
    const runDir = this.prepareRunDir(cwd, jobId);
    const logFile = path.join(runDir, 'job.log');
    const metaFile = path.join(runDir, 'meta.json');

    const child = spawn('bash', ['-lc', shellCommand], {
      cwd,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const job: FallbackJob = {
      id: jobId,
      command: shellCommand,
      cwd,
      tag,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      runDir,
      logFile,
      metaFile,
      child,
      state: 'running',
      exitCode: null,
      forced: false,
    };

    this.jobs.set(jobId, job);

    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    logStream.write(`# Fallback codex.start\n`);
    logStream.write(`Command: ${display}\n`);
    logStream.write(`StartedAt: ${new Date(job.createdAt).toISOString()}\n`);
    logStream.write(`CWD: ${cwd}\n`);
    logStream.write(`JobId: ${jobId}\n`);
    logStream.write('\n');

    child.stdout.on('data', (chunk: Buffer) => {
      logStream.write(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      logStream.write(chunk);
    });
    child.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`fallback job ${jobId} spawn error: ${message}`);
      job.state = 'failed';
      job.exitCode = -1;
      job.updatedAt = Date.now();
      logStream.write(`\n[fallback] spawn error: ${message}\n`);
      logStream.end();
      this.writeMeta(job.metaFile, this.buildJobMeta(job));
    });
    child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      job.exitCode = code ?? null;
      job.state =
        signal === 'SIGTERM' || signal === 'SIGKILL'
          ? 'stopped'
          : code === 0
            ? 'succeeded'
            : 'failed';
      job.updatedAt = Date.now();
      logStream.write(
        `\n[fallback] process exited with code=${code ?? 'null'} signal=${signal ?? 'null'}\n`
      );
      logStream.end();
      this.writeMeta(job.metaFile, this.buildJobMeta(job));
    });

    this.writeMeta(job.metaFile, this.buildJobMeta(job));

    const payload = {
      jobId,
      command: shellCommand,
      cwd,
      logFile,
      metaFile,
      tag,
      startedAt: new Date(job.createdAt).toISOString(),
      message: 'Fallback job started.',
    } satisfies Record<string, unknown>;

    return {
      content: [
        {
          type: 'text',
          text: formatJson(payload),
        },
      ],
      structuredContent: payload,
    };
  }

  status(jobId: string): ToolResult {
    const job = this.jobs.get(jobId);
    if (!job) {
      return createErrorResult({
        code: 'FALLBACK_JOB_NOT_FOUND',
        message: `未找到 fallback 任务：${jobId}`,
        hint: '请确认 jobId 是否由 fallback 模式创建。',
        details: { jobId },
      });
    }
    const payload = this.buildJobStatus(job);
    return {
      content: [{ type: 'text', text: formatJson(payload) }],
      structuredContent: payload,
    };
  }

  stop(jobId: string, force: boolean): ToolResult {
    const job = this.jobs.get(jobId);
    if (!job) {
      return createErrorResult({
        code: 'FALLBACK_JOB_NOT_FOUND',
        message: `未找到 fallback 任务：${jobId}`,
        hint: '请确认 jobId 是否正确。',
        details: { jobId },
      });
    }
    if (job.state !== 'running' || !job.child) {
      return createErrorResult({
        code: 'FALLBACK_JOB_NOT_RUNNING',
        message: `任务 ${jobId} 当前状态为 ${job.state}，无法终止。`,
        hint: '仅运行中的任务可终止。',
        details: { jobId, state: job.state },
      });
    }

    const signal: NodeJS.Signals = force ? 'SIGKILL' : 'SIGTERM';
    job.forced = force;
    job.child.kill(signal);
    const payload = {
      jobId,
      signal,
      forced: force,
      message: '终止信号已发送。',
    } satisfies Record<string, unknown>;
    return {
      content: [{ type: 'text', text: formatJson(payload) }],
      structuredContent: payload,
    };
  }

  list(options: ListOptions): ToolResult {
    const { states, tagContains, limit, offset } = options;
    const normalizedStates = states.length ? new Set(states.map((s) => s.toLowerCase())) : null;
    const normalizedTag = tagContains?.toLowerCase();

    const sorted = Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
    const filtered = sorted.filter((job) => {
      if (normalizedStates && !normalizedStates.has(job.state)) {
        return false;
      }
      if (normalizedTag && !job.tag.toLowerCase().includes(normalizedTag)) {
        return false;
      }
      return true;
    });
    const startIndex = offset && offset > 0 ? offset : 0;
    const endIndex = limit && limit > 0 ? startIndex + limit : undefined;
    const slice = filtered.slice(startIndex, endIndex);

    const jobs = slice.map((job) => this.buildJobStatus(job));
    const payload = {
      total: filtered.length,
      returned: jobs.length,
      jobs,
    } satisfies Record<string, unknown>;

    return {
      content: [{ type: 'text', text: formatJson(payload) }],
      structuredContent: payload,
    };
  }

  clean(options: CleanOptions): ToolResult {
    const { states, olderThanHours, limit, dryRun } = options;
    const filterStates = states.length ? new Set(states.map((s) => s.toLowerCase())) : null;
    const now = Date.now();
    const thresholdMs = olderThanHours !== undefined ? olderThanHours * 60 * 60 * 1000 : null;

    const candidates = Array.from(this.jobs.values()).filter((job) => {
      if (job.state === 'running') {
        return false;
      }
      if (filterStates && !filterStates.has(job.state)) {
        return false;
      }
      if (thresholdMs !== null) {
        const age = now - job.updatedAt;
        if (age < thresholdMs) {
          return false;
        }
      }
      return true;
    });

    const limited = limit && limit > 0 ? candidates.slice(0, limit) : candidates;
    const removed: string[] = [];
    if (!dryRun) {
      for (const job of limited) {
        removed.push(job.id);
        this.jobs.delete(job.id);
        try {
          fs.rmSync(job.runDir, { recursive: true, force: true });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`清理 fallback 任务 ${job.id} 时出错：${message}`);
        }
      }
    }

    const payload = {
      dryRun,
      considered: candidates.length,
      removed: dryRun ? [] : removed,
      wouldRemove: dryRun ? limited.map((j) => j.id) : undefined,
      states,
      olderThanHours,
      limit,
    } satisfies Record<string, unknown>;

    return {
      content: [{ type: 'text', text: formatJson(payload) }],
      structuredContent: payload,
    };
  }

  metrics(options: MetricsOptions): ToolResult {
    const { states } = options;
    const filterStates = states.length ? new Set(states.map((s) => s.toLowerCase())) : null;
    const counters: Record<JobState, number> = {
      running: 0,
      succeeded: 0,
      failed: 0,
      stopped: 0,
    };

    for (const job of this.jobs.values()) {
      if (filterStates && !filterStates.has(job.state)) {
        continue;
      }
      counters[job.state] += 1;
    }

    const payload = {
      total: Object.values(counters).reduce((acc, cur) => acc + cur, 0),
      byState: counters,
    } satisfies Record<string, unknown>;

    return {
      content: [{ type: 'text', text: formatJson(payload) }],
      structuredContent: payload,
    };
  }

  private resolveInvocation(
    params: Record<string, unknown>,
    options: ResolveOptions
  ): CommandResolution {
    const cwd =
      typeof params.cwd === 'string' && params.cwd.trim()
        ? path.resolve(params.cwd)
        : this.projectRoot;

    const tag = sanitizeTag(params.tag);
    const args: string[] = Array.isArray(params.args)
      ? (params.args as unknown[]).map((v) => String(v))
      : [];
    applyConvenienceOptions(args, params);

    const baseCommand = this.pickBaseCommand(options.toolName, args);

    const command =
      typeof params.command === 'string' && params.command.trim()
        ? params.command.trim()
        : baseCommand;

    if (!command) {
      return createErrorResult({
        code: 'FALLBACK_COMMAND_REQUIRED',
        message: `fallback 模式下 ${options.toolName} 需要提供 command 字段或 args。`,
        hint: '例如 { "command": "echo hello" } 或指定 args 数组转为 codex CLI 参数。',
      });
    }

    const invocation: Invocation = {
      shellCommand: command,
      display: command,
      cwd,
      tag,
    };

    return invocation;
  }

  private pickBaseCommand(toolName: ResolveOptions['toolName'], args: string[]): string {
    if (!args.length) {
      return '';
    }
    const quoted = args.map(shellQuote).join(' ');
    if (toolName === 'codex.exec') {
      return `codex exec ${quoted}`.trim();
    }
    const hasJson = args.some((arg) => arg === '--json');
    const joined = hasJson ? quoted : `--json ${quoted}`.trim();
    return `codex start ${joined}`.trim();
  }

  private isInvocation(resolution: CommandResolution): resolution is Invocation {
    return (resolution as Invocation).shellCommand !== undefined;
  }

  private prepareRunDir(base: string, runId: string): string {
    const sessionsRoot = path.resolve(base, '.codex-father', 'sessions');
    ensureDir(sessionsRoot);
    const runDir = path.join(sessionsRoot, runId);
    ensureDir(runDir);
    return runDir;
  }

  private writeMeta(pathname: string, meta: Record<string, unknown>): void {
    try {
      fs.writeFileSync(pathname, JSON.stringify(meta, null, 2), 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`写入 fallback 元数据失败：${message}`);
    }
  }

  private writeExecLog(
    filepath: string,
    shellCommand: string,
    startedAt: Date,
    finishedAt: Date,
    result: RunResult
  ): void {
    const lines = [
      '# Fallback codex.exec',
      `Command: ${shellCommand}`,
      `StartedAt: ${startedAt.toISOString()}`,
      `FinishedAt: ${finishedAt.toISOString()}`,
      `ExitCode: ${result.code}`,
      '',
    ];
    if (result.stdout.trim()) {
      lines.push('--- STDOUT ---', result.stdout.trim(), '');
    }
    if (result.stderr.trim()) {
      lines.push('--- STDERR ---', result.stderr.trim(), '');
    }
    try {
      fs.writeFileSync(filepath, lines.join('\n'), 'utf8');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`写入 fallback exec 日志失败：${message}`);
    }
  }

  private runShell(command: string, cwd: string): Promise<RunResult> {
    return run('bash', ['-lc', command], undefined, { cwd });
  }

  private buildJobMeta(job: FallbackJob): Record<string, unknown> {
    return {
      jobId: job.id,
      command: job.command,
      cwd: job.cwd,
      tag: job.tag,
      status: job.state,
      exitCode: job.exitCode,
      forced: job.forced,
      createdAt: new Date(job.createdAt).toISOString(),
      updatedAt: new Date(job.updatedAt).toISOString(),
      logFile: job.logFile,
    } satisfies Record<string, unknown>;
  }

  private buildJobStatus(job: FallbackJob): StatusPayload {
    const payload: StatusPayload = {
      jobId: job.id,
      status: job.state,
      exitCode: job.exitCode,
      command: job.command,
      cwd: job.cwd,
      tag: job.tag,
      startedAt: new Date(job.createdAt).toISOString(),
      forced: job.forced,
      logFile: job.logFile,
    };
    if (job.state !== 'running') {
      payload.finishedAt = new Date(job.updatedAt).toISOString();
    }
    return payload;
  }
}
