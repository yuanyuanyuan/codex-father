import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createQueueConfiguration, validateQueueConfiguration } from './config.js';
import { ensureQueueStructure } from './tools.js';
export class QueueConfigManager {
    base;
    configFile;
    constructor(queuePath, fileName = 'queue.config.json') {
        this.base = ensureQueueStructure(queuePath).base;
        this.configFile = resolve(join(this.base, fileName));
    }
    load() {
        if (!existsSync(this.configFile)) {
            const cfg = createQueueConfiguration({ baseDirectory: this.base });
            this.save(cfg);
            return cfg;
        }
        const raw = readFileSync(this.configFile, 'utf8');
        const parsed = JSON.parse(raw);
        const validated = createQueueConfiguration(parsed);
        return validated;
    }
    update(overrides) {
        const current = this.load();
        const next = createQueueConfiguration({ ...current, ...overrides });
        this.save(next);
        return next;
    }
    validate(config) {
        const cfg = config ?? this.load();
        return validateQueueConfiguration(cfg);
    }
    save(cfg) {
        mkdirSync(dirname(this.configFile), { recursive: true });
        writeFileSync(this.configFile, JSON.stringify(cfg, null, 2), 'utf8');
    }
}
