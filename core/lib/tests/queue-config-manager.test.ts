import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { QueueConfigManager } from '../queue/config-manager.js';

describe('QueueConfigManager (T069 config manager)', () => {
  let base: string;
  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'queue-cfg-'));
  });
  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('creates, loads, updates and validates configuration', () => {
    const cm = new QueueConfigManager(base);
    const cfg = cm.load();
    expect(typeof cfg.baseDirectory).toBe('string');
    const next = cm.update({ maxConcurrentTasks: cfg.maxConcurrentTasks + 1 });
    expect(next.maxConcurrentTasks).toBe(cfg.maxConcurrentTasks + 1);
    const val = cm.validate();
    expect(val.valid).toBe(true);
  });
});
