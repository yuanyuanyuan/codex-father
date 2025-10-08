import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { EventLogger } from '../../session/event-logger.js';

describe('Redaction pipeline security contract (T039)', () => {
  const modulePath: string = '../state-manager.js';
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'redaction-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('removes sensitive values before events are persisted', async () => {
    const { StateManager } = await import(modulePath);

    const logger = new EventLogger({ logDir: tempDir, asyncWrite: false, validateEvents: false });
    const stateManager = new StateManager({
      orchestrationId: 'orc_redact',
      eventLogger: logger,
      redactionPatterns: [/sk-[a-z0-9]{5,}/i, /password/i],
    } as any);

    await stateManager.emitEvent({
      event: 'tool_use',
      taskId: 't-secure',
      data: {
        argsSummary: 'POST /login password=superSecret',
        apiKey: 'sk-12345ABCDE',
        processEnv: { OPENAI_API_KEY: 'sk-abc0987654321' },
        env: ['CODEX_API_KEY=sk-xyz'],
        environmentSnapshot: { CODEX_SECRET: 'superSecretValue' },
      },
    });

    const content = await readFile(join(tempDir, 'events.jsonl'), 'utf8');
    const parsed = JSON.parse(content.trim());

    const serialized = JSON.stringify(parsed);
    expect(serialized).not.toContain('superSecret');
    expect(serialized).not.toContain('sk-12345ABCDE');
    expect(serialized).not.toContain('sk-abc0987654321');
    expect(serialized).not.toContain('superSecretValue');
    expect(serialized).toContain('[REDACTED]');
    expect(parsed.data?.apiKey).toBe('[REDACTED]');
    expect(parsed.data?.processEnv).toBe('[REDACTED]');
    expect(parsed.data?.env).toEqual(['[REDACTED]']);
    expect(parsed.data?.environmentSnapshot).toBe('[REDACTED]');
    expect((parsed.data?.argsSummary as string) ?? '').toContain('[REDACTED]');
  });
});
