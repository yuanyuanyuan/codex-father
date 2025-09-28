import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { QueueConfiguration } from '../types.js';
import { createQueueConfiguration, validateQueueConfiguration } from './config.js';
import { ensureQueueStructure } from './tools.js';

export class QueueConfigManager {
  private readonly base: string;
  private readonly configFile: string;

  constructor(queuePath?: string, fileName = 'queue.config.json') {
    this.base = ensureQueueStructure(queuePath).base;
    this.configFile = resolve(join(this.base, fileName));
  }

  load(): QueueConfiguration {
    if (!existsSync(this.configFile)) {
      const cfg = createQueueConfiguration({ baseDirectory: this.base });
      this.save(cfg);
      return cfg;
    }
    const raw = readFileSync(this.configFile, 'utf8');
    const parsed = JSON.parse(raw) as QueueConfiguration;
    const validated = createQueueConfiguration(parsed);
    return validated;
  }

  update(overrides: Partial<QueueConfiguration>): QueueConfiguration {
    const current = this.load();
    const next = createQueueConfiguration({ ...current, ...overrides });
    this.save(next);
    return next;
  }

  validate(config?: QueueConfiguration): { valid: boolean; errors: string[]; warnings: string[] } {
    const cfg = config ?? this.load();
    return validateQueueConfiguration(cfg);
  }

  private save(cfg: QueueConfiguration): void {
    mkdirSync(dirname(this.configFile), { recursive: true });
    writeFileSync(this.configFile, JSON.stringify(cfg, null, 2), 'utf8');
  }
}
