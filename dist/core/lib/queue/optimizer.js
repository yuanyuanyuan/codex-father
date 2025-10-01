import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ensureQueueStructure } from './tools.js';
export class QueueOptimizer {
    base;
    constructor(queuePath) {
        this.base = ensureQueueStructure(queuePath).base;
    }
    async optimize() {
        const indexed = await this.optimizeIndex();
        const { count, saved } = await this.pruneArchived(0);
        return { indexed, prunedArchives: count, savingsBytes: saved };
    }
    async optimizeIndex() {
        let count = 0;
        const walk = (dir) => {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const e of entries) {
                const p = join(dir, e.name);
                if (e.isDirectory()) {
                    walk(p);
                }
                else if (p.endsWith('.json')) {
                    count += 1;
                }
            }
        };
        walk(this.base);
        return count;
    }
    async pruneArchived(olderThanDays) {
        const archived = join(this.base, 'archived');
        let count = 0;
        let saved = 0;
        try {
            const entries = readdirSync(archived, { withFileTypes: true });
            const cutoff = Date.now() - Math.max(olderThanDays, 0) * 24 * 60 * 60 * 1000;
            for (const e of entries) {
                if (e.isFile()) {
                    const p = join(archived, e.name);
                    const st = statSync(p);
                    if (st.mtimeMs < cutoff) {
                        count += 1;
                        saved += st.size;
                    }
                }
            }
        }
        catch { }
        return { count, saved };
    }
}
