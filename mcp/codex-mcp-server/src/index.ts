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
  type ListToolsResult
} from '@modelcontextprotocol/sdk/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve job.sh path
function resolveJobSh(): string {
  const fromEnv = process.env.CODEX_JOB_SH;
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  // Prefer repo root job.sh when run within codex-father
  const candidate = path.resolve(process.cwd(), 'job.sh');
  if (fs.existsSync(candidate)) return candidate;
  // Else, relative to this package when installed
  const rel = path.resolve(__dirname, '../../..', 'job.sh');
  if (fs.existsSync(rel)) return rel;
  return candidate; // default fallback
}

const JOB_SH = resolveJobSh();

function run(cmd: string, args: string[], input?: string): Promise<{ code: number; stdout: string; stderr: string }>{
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => (out += d.toString()));
    child.stderr.on('data', (d: Buffer) => (err += d.toString()));
    child.on('close', (code: number | null) => resolve({ code: code ?? -1, stdout: out, stderr: err }));
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

function toolsSpec(): ListToolsResult {
  return {
    tools: [
      {
        name: 'codex.start',
        description: 'Start a non-blocking codex run; returns jobId immediately.',
        inputSchema: {
          type: 'object',
          properties: {
            args: { type: 'array', items: { type: 'string' } },
            tag: { type: 'string' },
            cwd: { type: 'string' }
          },
          additionalProperties: false
        }
      },
      {
        name: 'codex.status',
        description: 'Get job status (from runs/<jobId>/state.json).',
        inputSchema: {
          type: 'object',
          properties: { jobId: { type: 'string' } },
          required: ['jobId'],
          additionalProperties: false
        }
      },
      {
        name: 'codex.stop',
        description: 'Stop a running job by id.',
        inputSchema: {
          type: 'object',
          properties: { jobId: { type: 'string' }, force: { type: 'boolean' } },
          required: ['jobId'],
          additionalProperties: false
        }
      },
      {
        name: 'codex.list',
        description: 'List known jobs (runs/*).',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false }
      },
      {
        name: 'codex.logs',
        description: 'Read job log (bytes or lines mode).',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
            mode: { type: 'string', enum: ['bytes', 'lines'] },
            // bytes
            offset: { type: 'integer' },
            limit: { type: 'integer' },
            // lines
            offsetLines: { type: 'integer' },
            limitLines: { type: 'integer' },
            tailLines: { type: 'integer' },
            grep: { type: 'string' }
          },
          required: ['jobId'],
          additionalProperties: false
        }
      }
    ]
  };
}

async function handleCall(req: CallToolRequest) {
  const name = req.params.name;
  const p = (req.params.arguments ?? {}) as any;
  try {
    switch (name) {
      case 'codex.start': {
        const args: string[] = Array.isArray(p.args) ? p.args.map(String) : [];
        const pass: string[] = ['start', '--json'];
        if (p.tag) pass.push('--tag', String(p.tag));
        if (p.cwd) pass.push('--cwd', String(p.cwd));
        pass.push(...args);
        const { code, stdout, stderr } = await run(JOB_SH, pass);
        if (code !== 0) throw new Error(`start failed rc=${code} ${stderr}`);
        return { content: [{ type: 'text', text: stdout.trim() }] };
      }
      case 'codex.status': {
        const jobId = String(p.jobId || '');
        if (!jobId) throw new Error('Missing jobId');
        const { code, stdout, stderr } = await run(JOB_SH, ['status', jobId, '--json']);
        if (code !== 0) throw new Error(`status failed rc=${code} ${stderr}`);
        return { content: [{ type: 'text', text: stdout.trim() }] };
      }
      case 'codex.stop': {
        const jobId = String(p.jobId || '');
        const force = !!p.force;
        if (!jobId) throw new Error('Missing jobId');
        const pass = ['stop', jobId];
        if (force) pass.push('--force');
        const { code, stdout, stderr } = await run(JOB_SH, pass);
        if (code !== 0) throw new Error(`stop failed rc=${code} ${stderr}`);
        return { content: [{ type: 'text', text: stdout.trim() }] };
      }
      case 'codex.list': {
        const { code, stdout, stderr } = await run(JOB_SH, ['list', '--json']);
        if (code !== 0) throw new Error(`list failed rc=${code} ${stderr}`);
        return { content: [{ type: 'text', text: stdout.trim() }] };
      }
      case 'codex.logs': {
        const jobId = String(p.jobId || '');
        if (!jobId) throw new Error('Missing jobId');
        const runsDir = path.resolve(path.dirname(JOB_SH), 'runs');
        const logFile = path.join(runsDir, jobId, 'job.log');
        if (!fs.existsSync(logFile)) throw new Error(`log not found: ${logFile}`);
        const mode = (p.mode || 'bytes') as 'bytes' | 'lines';
        if (mode === 'lines') {
          const grepRe = typeof p.grep === 'string' ? p.grep : '';
          let lines = fs.readFileSync(logFile, 'utf8').split(/\r?\n/);
          if (grepRe) {
            let re: RegExp;
            try { re = new RegExp(grepRe); } catch { re = /.*/; }
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
        // bytes mode
        const stat = fs.statSync(logFile);
        const size = stat.size;
        let offset = Math.max(0, Number.isFinite(p.offset) ? Number(p.offset) : 0);
        const limit = Math.max(1, Number.isFinite(p.limit) ? Number(p.limit) : 4096);
        if (offset >= size) {
          return { content: [{ type: 'text', text: JSON.stringify({ chunk: '', nextOffset: offset, eof: true, size }) }] };
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
        return { content: [{ type: 'text', text: JSON.stringify({ chunk, nextOffset, eof, size }) }] };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (e: any) {
    return { content: [{ type: 'text', text: `ERROR: ${e?.message || String(e)}` }], isError: true };
  }
}

async function main() {
  const server = new Server({
    name: 'codex-father-mcp',
    version: '0.1.0'
  }, {
    capabilities: { tools: {} }
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => toolsSpec());
  server.setRequestHandler(CallToolRequestSchema, async (req) => handleCall(req));

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  // Non-throwing to avoid breaking stdio
  process.stderr.write(`[codex-mcp] fatal: ${err?.stack || err}\n`);
  process.exit(1);
});
