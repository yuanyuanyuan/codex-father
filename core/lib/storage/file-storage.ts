import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export class FileLock {
  constructor(private lockPath: string) {}
  release(): void {
    if (existsSync(this.lockPath)) unlinkSync(this.lockPath);
  }
}

export class FileStorage {
  constructor(private baseDir: string) {}

  private ensureDir(path: string) {
    const dir = dirname(path);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  resolvePath(path: string): string {
    return resolve(this.baseDir, path);
  }

  readJSON<T = any>(path: string): T {
    const abs = this.resolvePath(path);
    const data = readFileSync(abs, 'utf8');
    return JSON.parse(data) as T;
  }

  writeJSON(path: string, data: any): void {
    const abs = this.resolvePath(path);
    this.ensureDir(abs);
    const tmp = `${abs}.tmp.${process.pid}`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    renameSync(tmp, abs); // atomic on same filesystem
  }

  acquireLock(path: string, timeoutMs = 5000): FileLock {
    const abs = this.resolvePath(`${path}.lock`);
    this.ensureDir(abs);
    const start = Date.now();
    while (existsSync(abs)) {
      if (Date.now() - start > timeoutMs) throw new Error(`Timeout acquiring lock: ${abs}`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
    writeFileSync(abs, String(process.pid), 'utf8');
    return new FileLock(abs);
  }

  size(path: string): number {
    const abs = this.resolvePath(path);
    return statSync(abs).size;
  }

  backup(path: string, destDir = '.backups'): string {
    const abs = this.resolvePath(path);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const out = this.resolvePath(`${destDir}/${path}.${ts}.bak`);
    this.ensureDir(out);
    const data = readFileSync(abs);
    writeFileSync(out, data);
    return out;
  }
}

