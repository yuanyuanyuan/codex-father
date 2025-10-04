import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { EventLogger } from '../../session/event-logger.js';

describe('Audit JSONL contract (T038)', () => {
  const modulePath: string = '../state-manager.js';
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'audit-jsonl-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('appends events with required fields and sequential seq numbers', async () => {
    const { StateManager } = await import(modulePath);

    const logger = new EventLogger({ logDir: tempDir, asyncWrite: false, validateEvents: false });
    const stateManager = new StateManager({
      orchestrationId: 'orc_jsonl',
      eventLogger: logger,
    } as any);

    await stateManager.emitEvent({
      event: 'task_started',
      taskId: 't-audit-1',
      role: 'developer',
      data: { summary: '开始执行任务' },
    });

    await stateManager.emitEvent({
      event: 'task_completed',
      taskId: 't-audit-1',
      role: 'developer',
      data: { durationMs: 120000 },
    });

    const content = await readFile(join(tempDir, 'events.jsonl'), 'utf8');
    const lines = content.trim().split('\n');

    expect(lines).toHaveLength(2);

    const events = lines.map((line) => JSON.parse(line));
    for (const event of events) {
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('event');
      expect(event.orchestrationId).toBe('orc_jsonl');
      expect(event).toHaveProperty('seq');
      expect(event.seq).toBeGreaterThanOrEqual(1);
    }

    expect(events[1].seq).toBe(events[0].seq + 1);
    expect(events[1].event).toBe('task_completed');
  });
});
