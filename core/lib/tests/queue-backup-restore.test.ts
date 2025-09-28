import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { QueueBackupManager } from '../queue/backup-restore.js';

const REQUIRED_DIRS = [
  'pending/tasks',
  'pending/metadata',
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

describe('QueueBackupManager (T067 backup/restore)', () => {
  let base: string;
  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'backup-'));
    for (const d of REQUIRED_DIRS) mkdirSync(join(base, d), { recursive: true });
    writeFileSync(
      join(base, 'pending/tasks', 'a.json'),
      JSON.stringify({ id: 'a', status: 'pending' }),
      'utf8'
    );
  });
  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('creates manifest manifest for queue backup', async () => {
    const mgr = new QueueBackupManager(base);
    const manifest = join(base, 'backup.manifest.json');
    const b = await mgr.createBackup(manifest);
    expect(b.success).toBe(true);
    expect(existsSync(manifest)).toBe(true);
  });
});
