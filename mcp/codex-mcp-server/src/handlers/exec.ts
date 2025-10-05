import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { createCliExitError } from '../errors/cli.js';
import { formatJson } from '../utils/format.js';
import { applyConvenienceOptions } from './options.js';
import type { HandlerContext, ToolResult } from './types.js';
import { ensureStartSh } from './utils.js';

export async function handleExec(
  params: Record<string, unknown>,
  ctx: HandlerContext
): Promise<ToolResult> {
  const startMissing = ensureStartSh(ctx, 'codex.exec', {
    args: ['--task', 'npm run lint'],
    tag: 'lint',
  });
  if (startMissing) {
    return startMissing;
  }
  const args: string[] = Array.isArray(params.args) ? params.args.map(String) : [];
  applyConvenienceOptions(args, params);
  const tag = params.tag ? String(params.tag) : '';
  const cwd = params.cwd ? String(params.cwd) : '';
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const safeTag = tag ? tag.replace(/[^A-Za-z0-9_.-]/g, '-').replace(/^-+|-+$/g, '') : 'untagged';
  const baseDir = cwd || ctx.projectRoot;
  const sessionsRoot = path.resolve(baseDir, '.codex-father', 'sessions');
  const runId = `exec-${ts}-${safeTag}`;
  const runDir = path.join(sessionsRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });
  const logFile = path.join(runDir, 'job.log');
  const aggTxt = path.join(runDir, 'aggregate.txt');
  const aggJsonl = path.join(runDir, 'aggregate.jsonl');
  const pass = ['--log-file', logFile, '--flat-logs', ...args];
  const env = {
    ...process.env,
    CODEX_SESSION_DIR: runDir,
    CODEX_LOG_FILE: logFile,
    CODEX_LOG_AGGREGATE: '1',
    CODEX_LOG_AGGREGATE_FILE: aggTxt,
    CODEX_LOG_AGGREGATE_JSONL_FILE: aggJsonl,
    CODEX_LOG_SUBDIRS: '0',
  } as NodeJS.ProcessEnv;

  let code = 0;
  let stdout = '';
  let stderr = '';
  await new Promise<void>((resolve) => {
    const child = spawn(ctx.startSh, pass, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
      cwd: cwd || undefined,
    });
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      stderr += stderr ? `\n${message}` : message;
      code = -1;
      resolve();
    });
    child.on('close', (c: number | null) => {
      code = c ?? -1;
      resolve();
    });
  });

  const instrFile = logFile.replace(/\.log$/, '.instructions.md');
  const metaFile = logFile.replace(/\.log$/, '.meta.json');
  let lastMessageFile = '';
  try {
    const entries = fs.readdirSync(runDir).filter((f) => /\.last\.txt$/.test(f));
    entries.sort(
      (a, b) =>
        fs.statSync(path.join(runDir, b)).mtimeMs - fs.statSync(path.join(runDir, a)).mtimeMs
    );
    if (entries.length) {
      lastMessageFile = path.join(runDir, entries[0]);
    }
  } catch {}

  let exitCode = code;
  try {
    if (fs.existsSync(logFile)) {
      const text = fs.readFileSync(logFile, 'utf8');
      const matches = text.match(/Exit Code:\s*(-?\d+)/g);
      if (matches && matches.length > 0) {
        const last = matches[matches.length - 1];
        const m = last.match(/Exit Code:\s*(-?\d+)/);
        if (m) {
          exitCode = Number(m[1]);
        }
      }
    }
  } catch {}

  const payload = {
    runId,
    exitCode,
    cwd: cwd || process.cwd(),
    logFile,
    instructionsFile: instrFile,
    metaFile,
    lastMessageFile,
    tag: safeTag,
  };

  if (code !== 0 && !fs.existsSync(logFile)) {
    return createCliExitError(
      `${ctx.startSh} ${pass.join(' ')}`,
      { code, stdout, stderr },
      undefined,
      {
        runDir,
      }
    );
  }

  if (code !== 0) {
    return {
      content: [
        {
          type: 'text',
          text: formatJson({ ...payload, processExit: code, stdout, stderr }),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: formatJson({ ...payload, processExit: code }) }],
  };
}
