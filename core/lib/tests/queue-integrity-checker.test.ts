import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { QueueIntegrityChecker } from '../queue/integrity-checker.js';

const REQUIRED_DIRS = [
  'pending/tasks',
  'pending/metadata',
  'scheduled/tasks',
  'scheduled/metadata',
  'running/tasks',
  'running/metadata',
  'retrying/tasks',
  'retrying/metadata',
  'completed/tasks',
  'completed/metadata',
  'failed/tasks',
  'failed/metadata',
  'timeout/tasks',
  'timeout/metadata',
  'cancelled/tasks',
  'cancelled/metadata',
  'locks',
  'logs',
  'tmp',
];

describe('QueueIntegrityChecker (T066 integrity)', () => {
  let base: string;
  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'integrity-'));
    for (const d of REQUIRED_DIRS) mkdirSync(join(base, d), { recursive: true });
  });
  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('detects invalid JSON and orphaned metadata', async () => {
    // write an invalid json task in pending
    writeFileSync(join(base, 'pending/tasks', 'bad.json'), '{not json', 'utf8');
    // write metadata without task in failed
    writeFileSync(
      join(base, 'failed/metadata', 'orphan.json'),
      JSON.stringify({ id: 'x' }),
      'utf8'
    );

    const checker = new QueueIntegrityChecker(base);
    const res = await checker.check();
    expect(res.valid).toBe(false);
    const types = res.issues.map((i) => i.type);
    expect(types).toEqual(expect.arrayContaining(['invalid_json', 'orphaned_file']));
  });
});
