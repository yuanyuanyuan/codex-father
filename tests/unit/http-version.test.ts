import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startHttpServer } from '../../core/http/server.js';

const ROOT_PKG = await import('../../package.json', {
  with: { type: 'json' },
}).then((m: any) => m.default ?? m);

describe('HTTP /api/v1/version (T-HTTP-VERSION)', () => {
  let close: () => Promise<void>;

  beforeAll(async () => {
    const srv = await startHttpServer({ host: '127.0.0.1', port: 7089, repoRoot: process.cwd() });
    close = srv.close;
  });

  afterAll(async () => {
    await close?.();
  });

  it('returns project version and runtime info', async () => {
    const res = await fetch('http://127.0.0.1:7089/api/v1/version');
    expect(res.ok).toBe(true);
    const json = (await res.json()) as any;
    expect(json).toHaveProperty('name');
    expect(json).toHaveProperty('version');
    expect(json.version).toBe(ROOT_PKG.version);
    expect(json).toHaveProperty('node');
  });
});
