#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveJobSh(): string {
  const fromEnv = process.env.CODEX_JOB_SH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const candidate = path.resolve(process.cwd(), 'job.sh');
  if (fs.existsSync(candidate)) return candidate;
  const rel = path.resolve(__dirname, '../../..', 'job.sh');
  if (fs.existsSync(rel)) return rel;
  return candidate;
}

const JOB_SH = resolveJobSh();

function resolveStartSh(): string {
  const fromEnv = process.env.CODEX_START_SH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const candidate = path.resolve(process.cwd(), 'start.sh');
  if (fs.existsSync(candidate)) return candidate;
  const rel = path.resolve(__dirname, '../../..', 'start.sh');
  if (fs.existsSync(rel)) return rel;
  return candidate;
}

const START_SH = resolveStartSh();

function run(
  cmd: string,
  args: string[],
  input?: string
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('close', (code: number | null) =>
      resolve({ code: code ?? -1, stdout: out, stderr: err })
    );
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

function toolsSpec(): ListToolsResult {
  return {
    tools: [
      {
        name: 'codex.exec',
        description: 'Run a synchronous codex execution; returns when finished.',
        inputSchema: {
          type: 'object',
          properties: {
            args: { type: 'array', items: { type: 'string' } },
            tag: { type: 'string' },
            cwd: { type: 'string' },
            approvalPolicy: {
              type: 'string',
              enum: ['untrusted', 'on-failure', 'on-request', 'never'],
            },
            sandbox: {
              type: 'string',
              enum: ['read-only', 'workspace-write', 'danger-full-access'],
            },
            network: { type: 'boolean' },
            fullAuto: { type: 'boolean' },
            dangerouslyBypass: { type: 'boolean' },
            profile: { type: 'string' },
            codexConfig: { type: 'object', additionalProperties: true },
            preset: { type: 'string' },
            carryContext: { type: 'boolean' },
            compressContext: { type: 'boolean' },
            contextHead: { type: 'integer' },
            patchMode: { type: 'boolean' },
            requireChangeIn: { type: 'array', items: { type: 'string' } },
            requireGitCommit: { type: 'boolean' },
            autoCommitOnDone: { type: 'boolean' },
            autoCommitMessage: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'codex.start',
        description: 'Start a non-blocking codex run; returns jobId immediately.',
        inputSchema: {
          type: 'object',
          properties: {
            args: { type: 'array', items: { type: 'string' } },
            tag: { type: 'string' },
            cwd: { type: 'string' },
            approvalPolicy: {
              type: 'string',
              enum: ['untrusted', 'on-failure', 'on-request', 'never'],
            },
            sandbox: {
              type: 'string',
              enum: ['read-only', 'workspace-write', 'danger-full-access'],
            },
            network: { type: 'boolean' },
            fullAuto: { type: 'boolean' },
            dangerouslyBypass: { type: 'boolean' },
            profile: { type: 'string' },
            codexConfig: { type: 'object', additionalProperties: true },
            preset: { type: 'string' },
            carryContext: { type: 'boolean' },
            compressContext: { type: 'boolean' },
            contextHead: { type: 'integer' },
            patchMode: { type: 'boolean' },
            requireChangeIn: { type: 'array', items: { type: 'string' } },
            requireGitCommit: { type: 'boolean' },
            autoCommitOnDone: { type: 'boolean' },
            autoCommitMessage: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      {
        name: 'codex.status',
        description: 'Get job status (from runs/<jobId>/state.json).',
        inputSchema: {
          type: 'object',
          properties: { jobId: { type: 'string' } },
          required: ['jobId'],
          additionalProperties: false,
        },
      },
      {
        name: 'codex.stop',
        description: 'Stop a running job by id.',
        inputSchema: {
          type: 'object',
          properties: { jobId: { type: 'string' }, force: { type: 'boolean' } },
          required: ['jobId'],
          additionalProperties: false,
        },
      },
      {
        name: 'codex.list',
        description: 'List known jobs (runs/*).',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      },
      {
        name: 'codex.logs',
        description: 'Read job log (bytes or lines mode).',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            mode: { type: 'string', enum: ['bytes', 'lines'] },
            offset: { type: 'integer' },
            limit: { type: 'integer' },
            offsetLines: { type: 'integer' },
            limitLines: { type: 'integer' },
            tailLines: { type: 'integer' },
            grep: { type: 'string' },
          },
          required: ['jobId'],
          additionalProperties: false,
        },
      },
    ],
  };
}

function toTomlValue(v: any): string {
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (v === null || v === undefined) return '""';
  const s = String(v).replace(/\\/g, '\\\\').replace(/\"/g, '\\"');
  return `"${s}"`;
}

function applyConvenienceOptions(args: string[], p: any) {
  const hasSandbox = args.includes('--sandbox');
  const hasBypassArg = args.includes('--dangerously-bypass-approvals-and-sandbox');
  if (p?.sandbox && typeof p.sandbox === 'string') {
    args.push('--sandbox', p.sandbox);
  } else if (!hasSandbox && !hasBypassArg) {
    args.push('--sandbox', 'workspace-write');
  }
  if (p?.dangerouslyBypass) {
    args.push('--dangerously-bypass-approvals-and-sandbox');
  }
  if ((p?.dangerouslyBypass || hasBypassArg) && !args.includes('--sandbox')) {
    args.push('--sandbox', 'danger-full-access');
  }
  const bypassActive = !!p?.dangerouslyBypass || hasBypassArg;
  if (p?.approvalPolicy && typeof p.approvalPolicy === 'string') {
    if (!bypassActive) args.push('--ask-for-approval', p.approvalPolicy);
  }
  if (p?.fullAuto && !bypassActive) args.push('--full-auto');
  if (p?.profile && typeof p.profile === 'string') {
    args.push('--profile', p.profile);
  }
  if (p?.network) {
    args.push('--codex-config', 'sandbox_workspace_write.network_access=true');
  }
  if (p?.codexConfig && typeof p.codexConfig === 'object') {
    for (const [k, v] of Object.entries(p.codexConfig)) {
      args.push('--codex-config', `${k}=${toTomlValue(v)}`);
    }
  }
  if (p?.preset) args.push('--preset', String(p.preset));
  if (p?.carryContext === false) args.push('--no-carry-context');
  if (p?.compressContext === false) args.push('--no-compress-context');
  if (Number.isFinite(p?.contextHead)) args.push('--context-head', String(p.contextHead));
  if (p?.patchMode) args.push('--patch-mode');
  if (Array.isArray(p?.requireChangeIn)) {
    for (const g of p.requireChangeIn) args.push('--require-change-in', String(g));
  }
  if (p?.requireGitCommit) args.push('--require-git-commit');
  if (p?.autoCommitOnDone) args.push('--auto-commit-on-done');
  if (p?.autoCommitMessage) args.push('--auto-commit-message', String(p.autoCommitMessage));
}

async function handleCall(req: CallToolRequest) {
  const name = req.params.name;
  const p = (req.params.arguments ?? {}) as any;
  try {
    switch (name) {
      case 'codex.exec': {
        const args: string[] = Array.isArray(p.args) ? p.args.map(String) : [];
        applyConvenienceOptions(args, p);
        const tag = p.tag ? String(p.tag) : '';
        const cwd = p.cwd ? String(p.cwd) : '';
        const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
        const safeTag = tag
          ? tag.replace(/[^A-Za-z0-9_.-]/g, '-').replace(/^-+|-+$/g, '')
          : 'untagged';
        const baseDir = cwd || process.cwd();
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
          const child = spawn(START_SH, pass, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env,
            cwd: cwd || undefined,
          });
          child.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
          child.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
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
          if (entries.length) lastMessageFile = path.join(runDir, entries[0]);
        } catch {}
        let exitCode = code;
        try {
          if (fs.existsSync(logFile)) {
            const text = fs.readFileSync(logFile, 'utf8');
            const matches = text.match(/Exit Code:\s*(-?\d+)/g);
            if (matches && matches.length > 0) {
              const last = matches[matches.length - 1];
              const m = last.match(/Exit Code:\s*(-?\d+)/);
              if (m) exitCode = Number(m[1]);
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
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ ...payload, processExit: code, error: stderr.trim() }),
              },
            ],
            isError: true,
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify({ ...payload, processExit: code }) }],
        };
      }
      case 'codex.start': {
        const args: string[] = Array.isArray(p.args) ? p.args.map(String) : [];
        applyConvenienceOptions(args, p);
        const isStub = !!process.env.CODEX_START_SH;
        if (isStub) {
          let outPath = '';
          for (let i = 0; i < args.length - 1; i++) {
            if (args[i] === '--log-file') {
              outPath = String(args[i + 1]);
              break;
            }
          }
          const directArgs = outPath ? [outPath, ...args] : args;
          const { code, stdout, stderr } = await run(START_SH, directArgs);
          if (code !== 0) throw new Error(`start(stub) failed rc=${code} ${stderr}`);
          return { content: [{ type: 'text', text: (stdout || '').trim() }] };
        } else {
          const pass: string[] = ['start', '--json'];
          if (p.tag) pass.push('--tag', String(p.tag));
          if (p.cwd) pass.push('--cwd', String(p.cwd));
          pass.push(...args);
          const { code, stdout, stderr } = await run(JOB_SH, pass);
          if (code !== 0) throw new Error(`start failed rc=${code} ${stderr}`);
          return { content: [{ type: 'text', text: stdout.trim() }] };
        }
      }
      case 'codex.status': {
        const jobId = String(p.jobId || '');
        if (!jobId) throw new Error('Missing jobId');
        const pass = ['status', jobId, '--json'] as string[];
        const base = p.cwd ? String(p.cwd) : path.dirname(JOB_SH);
        if (base) pass.push('--cwd', base);
        const { code, stdout, stderr } = await run(JOB_SH, pass);
        if (code !== 0) throw new Error(`status failed rc=${code} ${stderr}`);
        return { content: [{ type: 'text', text: stdout.trim() }] };
      }
      case 'codex.stop': {
        const jobId = String(p.jobId || '');
        const force = !!p.force;
        if (!jobId) throw new Error('Missing jobId');
        const pass = ['stop', jobId];
        if (force) pass.push('--force');
        const base = p.cwd ? String(p.cwd) : path.dirname(JOB_SH);
        if (base) pass.push('--cwd', base);
        const { code, stdout, stderr } = await run(JOB_SH, pass);
        if (code !== 0) throw new Error(`stop failed rc=${code} ${stderr}`);
        return { content: [{ type: 'text', text: stdout.trim() }] };
      }
      case 'codex.list': {
        const pass = ['list', '--json'] as string[];
        const base = p.cwd ? String(p.cwd) : path.dirname(JOB_SH);
        if (base) pass.push('--cwd', base);
        const { code, stdout, stderr } = await run(JOB_SH, pass);
        if (code !== 0) throw new Error(`list failed rc=${code} ${stderr}`);
        return { content: [{ type: 'text', text: stdout.trim() }] };
      }
      case 'codex.logs': {
        const jobId = String(p.jobId || '');
        if (!jobId) throw new Error('Missing jobId');
        const baseDir = p.cwd ? String(p.cwd) : path.dirname(JOB_SH);
        const sessionsRoot = path.resolve(baseDir, '.codex-father', 'sessions');
        const logFile = path.join(sessionsRoot, jobId, 'job.log');
        if (!fs.existsSync(logFile)) throw new Error(`log not found: ${logFile}`);
        const mode = (p.mode || 'bytes') as 'bytes' | 'lines';
        if (mode === 'lines') {
          const grepRe = typeof p.grep === 'string' ? p.grep : '';
          let lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/);
          if (grepRe) {
            let re: RegExp;
            try {
              re = new RegExp(grepRe);
            } catch {
              re = /.*/;
            }
            lines = lines.filter((l: string) => re.test(l));
          }
          const total = lines.length;
          if (typeof p.tailLines === 'number' && p.tailLines > 0) {
            lines = lines.slice(-p.tailLines);
          } else {
            const offset = Math.max(0, Number.isFinite(p.offsetLines) ? Number(p.offsetLines) : 0);
            const limit = Math.max(1, Number.isFinite(p.limitLines) ? Number(p.limitLines) : 200);
            lines = lines.slice(offset, offset + limit);
          }
          const payload = { lines, totalLines: total };
          return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
        }
        const stat = fs.statSync(logFile);
        const size = stat.size;
        let offset = Math.max(0, Number.isFinite(p.offset) ? Number(p.offset) : 0);
        const limit = Math.max(1, Number.isFinite(p.limit) ? Number(p.limit) : 4096);
        if (offset >= size) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ chunk: '', nextOffset: offset, eof: true, size }),
              },
            ],
          };
        }
        const remain = size - offset;
        const count = Math.min(limit, remain);
        const fd = fs.openSync(logFile, 'r');
        const buf = Buffer.allocUnsafe(count);
        fs.readSync(fd, buf, 0, count, offset);
        fs.closeSync(fd);
        const chunk = buf.toString('utf8');
        const nextOffset = offset + count;
        const eof = nextOffset >= size;
        return {
          content: [{ type: 'text', text: JSON.stringify({ chunk, nextOffset, eof, size }) }],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (e: any) {
    return {
      content: [{ type: 'text', text: `ERROR: ${e?.message || String(e)}` }],
      isError: true,
    };
  }
}

async function main() {
  const server = new Server(
    { name: 'codex-father-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => toolsSpec());
  server.setRequestHandler(CallToolRequestSchema, async (req) => handleCall(req));
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`[codex-mcp] fatal: ${err?.stack || err}\n`);
  process.exit(1);
});
