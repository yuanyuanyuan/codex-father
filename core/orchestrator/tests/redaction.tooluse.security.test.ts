import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { EventLogger } from '../../session/event-logger.js';

describe('Redaction for tool_use summaries (T052)', () => {
  const modulePath: string = '../state-manager.js';
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'redaction-tu-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('masks secrets in mixed key/value and free-form summaries', async () => {
    const { StateManager } = await import(modulePath);

    const logger = new EventLogger({ logDir: tempDir, asyncWrite: false, validateEvents: false });
    const stateManager = new StateManager({
      orchestrationId: 'orc_tu',
      eventLogger: logger,
      redactionPatterns: [
        /password/i,
        /token/i,
        /api[-_]?key/i,
        /authorization/i,
        /sk-[a-z0-9-_]{8,}/i,
      ],
    } as any);

    await stateManager.emitEvent({
      event: 'tool_use',
      taskId: 't-secure-2',
      data: {
        argsSummary:
          'curl -H "Authorization: Bearer sk-abcDEF123456" -d "password=superSecret&token=xyz"; apiKey: "my-key"',
      },
    });

    const content = await readFile(join(tempDir, 'events.jsonl'), 'utf8');
    const parsed = JSON.parse(content.trim());

    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toMatch(/superSecret|sk-abcDEF123456|xyz|my-key/i);
    expect((parsed.data?.argsSummary as string).includes('[REDACTED]')).toBe(true);
  });
});
