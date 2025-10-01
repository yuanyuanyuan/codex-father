import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync, appendFileSync, } from 'node:fs';
import { dirname, resolve } from 'node:path';
export class LogStorage {
    baseDir;
    constructor(baseDir = 'logs') {
        this.baseDir = baseDir;
    }
    ensureDir(path) {
        const dir = dirname(path);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }
    filePath(category, name = 'latest.log') {
        return resolve(this.baseDir, category, name);
    }
    append(category, line) {
        const p = this.filePath(category);
        this.ensureDir(p);
        appendFileSync(p, line + '\n', 'utf8');
    }
    rotate(category, opts) {
        const p = this.filePath(category);
        if (!existsSync(p)) {
            return;
        }
        const size = statSync(p).size;
        if (size < opts.maxSizeBytes) {
            return;
        }
        for (let i = opts.keep - 1; i >= 1; i--) {
            const src = this.filePath(category, `latest.${i}.log`);
            const dst = this.filePath(category, `latest.${i + 1}.log`);
            if (existsSync(src)) {
                renameSync(src, dst);
            }
        }
        const first = this.filePath(category, 'latest.1.log');
        this.ensureDir(first);
        writeFileSync(first, readFileSync(p));
        writeFileSync(p, '');
    }
}
