import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, statSync, unlinkSync, } from 'node:fs';
import { dirname, resolve } from 'node:path';
export class FileLock {
    lockPath;
    constructor(lockPath) {
        this.lockPath = lockPath;
    }
    release() {
        if (existsSync(this.lockPath)) {
            unlinkSync(this.lockPath);
        }
    }
}
export class FileStorage {
    baseDir;
    constructor(baseDir) {
        this.baseDir = baseDir;
    }
    ensureDir(path) {
        const dir = dirname(path);
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true });
        }
    }
    resolvePath(path) {
        return resolve(this.baseDir, path);
    }
    readJSON(path) {
        const abs = this.resolvePath(path);
        const data = readFileSync(abs, 'utf8');
        return JSON.parse(data);
    }
    writeJSON(path, data) {
        const abs = this.resolvePath(path);
        this.ensureDir(abs);
        const tmp = `${abs}.tmp.${process.pid}`;
        writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
        renameSync(tmp, abs);
    }
    acquireLock(path, timeoutMs = 5000) {
        const abs = this.resolvePath(`${path}.lock`);
        this.ensureDir(abs);
        const start = Date.now();
        while (existsSync(abs)) {
            if (Date.now() - start > timeoutMs) {
                throw new Error(`Timeout acquiring lock: ${abs}`);
            }
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
        }
        writeFileSync(abs, String(process.pid), 'utf8');
        return new FileLock(abs);
    }
    size(path) {
        const abs = this.resolvePath(path);
        return statSync(abs).size;
    }
    backup(path, destDir = '.backups') {
        const abs = this.resolvePath(path);
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const out = this.resolvePath(`${destDir}/${path}.${ts}.bak`);
        this.ensureDir(out);
        const data = readFileSync(abs);
        writeFileSync(out, data);
        return out;
    }
}
