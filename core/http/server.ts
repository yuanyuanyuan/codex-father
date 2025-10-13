import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PROJECT_NAME, PROJECT_VERSION } from '../lib/version.js';

type ServerOptions = {
  host?: string;
  port?: number;
  sessionsRoot?: string;
  repoRoot?: string;
};

type ErrorBody = { code: string; message: string; hint?: string };

function error(res: Response, status: number, body: ErrorBody): void {
  res.status(status).json(body);
}

function coalesce<T>(...vals: Array<T | undefined | null>): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null) {
      return v as T;
    }
  }
  return undefined;
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
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  return path.join(repoRoot, '.codex-father', 'sessions');
}

function findSessionDir(base: string, jobId: string): string | null {
  const p = path.join(base, jobId);
  return fs.existsSync(p) ? p : null;
}

async function readJsonSafe<T = unknown>(file: string): Promise<T | null> {
  try {
    const buf = await fsp.readFile(file, 'utf-8');
    return JSON.parse(buf) as T;
  } catch {
    return null;
  }
}

async function readJsonlArray(file: string): Promise<unknown[]> {
  try {
    const buf = await fsp.readFile(file, 'utf-8');
    return buf
      .split(/\r?\n/g)
      .filter((l) => l.trim().length > 0)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((x) => x !== null);
  } catch {
    return [];
  }
}

export async function startHttpServer(
  opts: ServerOptions = {}
): Promise<{ close: () => Promise<void> }> {
  const host = opts.host ?? process.env.CODEX_HTTP_HOST ?? '0.0.0.0';
  const port = Number(opts.port ?? process.env.CODEX_HTTP_PORT ?? 7070);
  const repoRoot = opts.repoRoot ?? process.cwd();
  const sessionsRoot = resolveSessionsRoot(
    repoRoot,
    opts.sessionsRoot ?? process.env.CODEX_SESSIONS_ROOT ?? undefined
  )!;

  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
  app.get('/healthz', (_req, res) =>
    res.json({ status: 'ok', name: PROJECT_NAME, version: PROJECT_VERSION })
  );

  // GET /api/v1/version
  app.get('/api/v1/version', (_req, res) => {
    res.json({
      name: PROJECT_NAME,
      version: PROJECT_VERSION,
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      env: process.env.NODE_ENV ?? 'development',
    });
  });

  // GET /api/v1/jobs/:id/status
  app.get('/api/v1/jobs/:id/status', async (req, res) => {
    const jobId = String(req.params.id);
    const dir = findSessionDir(sessionsRoot, jobId);
    if (!dir) {
      return error(res, 404, {
        code: 'not_found',
        message: `Session not found: ${jobId}`,
        hint: `Check sessions root: ${sessionsRoot}`,
      });
    }
    const statePath = path.join(dir, 'state.json');
    const state = await readJsonSafe(statePath);
    if (!state) {
      return error(res, 404, { code: 'not_found', message: 'state.json missing', hint: statePath });
    }
    res.json(state);
  });

  // GET /api/v1/jobs/:id/checkpoints
  app.get('/api/v1/jobs/:id/checkpoints', async (req, res) => {
    const jobId = String(req.params.id);
    const dir = findSessionDir(sessionsRoot, jobId);
    if (!dir) {
      return error(res, 404, { code: 'not_found', message: `Session not found: ${jobId}` });
    }
    const cps = await readJsonlArray(path.join(dir, 'checkpoints.jsonl'));
    res.json(cps);
  });

  // GET /api/v1/jobs/:id/events (SSE)
  app.get('/api/v1/jobs/:id/events', async (req: Request, res: Response) => {
    const jobId = String(req.params.id);
    const dir = findSessionDir(sessionsRoot, jobId);
    if (!dir) {
      return error(res, 404, { code: 'not_found', message: `Session not found: ${jobId}` });
    }
    const eventsFile = path.join(dir, 'events.jsonl');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const fromSeq = Number(coalesce(req.query.fromSeq as string | undefined, '0')) || 0;
    let lastSeq = fromSeq > 0 ? fromSeq - 1 : 0;

    const send = (e: any): void => {
      if (!e || typeof e !== 'object') {
        return;
      }
      const seq = typeof (e as any).seq === 'number' ? (e as any).seq : 0;
      if (seq <= lastSeq) {
        return; // dedupe
      }
      lastSeq = seq;
      const evt = typeof (e as any).event === 'string' ? (e as any).event : 'message';
      res.write(`event: ${evt}\n`);
      res.write(`data: ${JSON.stringify(e)}\n\n`);
    };

    // Initial replay
    const history = await readJsonlArray(eventsFile);
    for (const e of history as any[]) {
      if (fromSeq === 0 || (typeof (e as any).seq === 'number' && (e as any).seq >= fromSeq)) {
        send(e);
      }
    }

    // Heartbeat
    const hb = setInterval(() => {
      res.write(`event: heartbeat\n`);
      res.write(`data: {"ts": "${new Date().toISOString()}"}\n\n`);
    }, 15_000);

    // Tail file using fs.watch fallback
    let closed = false;
    let watching: fs.FSWatcher | null = null;
    const onChange = async (): Promise<void> => {
      if (closed) {
        return;
      }
      try {
        const arr = await readJsonlArray(eventsFile);
        for (const e of arr as any[]) {
          send(e);
        }
      } catch {
        // ignore
      }
    };
    try {
      watching = fs.watch(dir, (event, filename) => {
        if (filename === 'events.jsonl' || event === 'change') {
          onChange();
        }
      });
    } catch {
      // fallback: poll
      const poll = setInterval(onChange, 2000);
      res.on('close', () => clearInterval(poll));
    }

    res.on('close', () => {
      closed = true;
      clearInterval(hb);
      if (watching) {
        watching.close();
      }
    });
  });

  return new Promise<{ close: () => Promise<void> }>((resolve) => {
    const server = app.listen(port, host, () => {
      // eslint-disable-next-line no-console
      console.log(`[http] listening on http://${host}:${port} (sessions=${sessionsRoot})`);
      resolve({
        close: async () =>
          await new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}
