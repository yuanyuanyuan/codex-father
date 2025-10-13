import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

describe('codex-status-response example shape', () => {
  const samplePath = join(process.cwd(), 'docs/schemas/examples/status-running.json');
  const sample = JSON.parse(readFileSync(samplePath, 'utf-8'));

  it('has core fields', () => {
    expect(typeof sample.id).toBe('string');
    expect(['pending', 'running', 'done', 'failed', 'paused']).toContain(sample.state);
    expect(typeof sample.cwd).toBe('string');
    expect(typeof sample.created_at).toBe('string');
    expect(typeof sample.updated_at).toBe('string');
  });

  it('has progress block with numbers', () => {
    expect(sample.progress).toBeTruthy();
    expect(typeof sample.progress.current).toBe('number');
    expect(typeof sample.progress.total).toBe('number');
    expect(typeof sample.progress.percentage).toBe('number');
  });

  it('has checkpoints as array', () => {
    expect(Array.isArray(sample.checkpoints)).toBe(true);
    if (sample.checkpoints.length > 0) {
      const c = sample.checkpoints[0];
      expect(typeof c.step).toBe('number');
      expect(typeof c.status).toBe('string');
      expect(typeof c.timestamp).toBe('string');
    }
  });
});
