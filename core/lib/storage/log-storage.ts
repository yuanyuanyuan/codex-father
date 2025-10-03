import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

export interface LogRotateOptions {
  maxSizeBytes: number;
  keep: number; // number of rotated files to keep
}

export class LogStorage {
  constructor(private baseDir = 'logs') {}

  private ensureDir(path: string) {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private filePath(category: 'audit' | 'tasks' | 'system', name = 'latest.log'): string {
    return resolve(this.baseDir, category, name);
  }

  append(category: 'audit' | 'tasks' | 'system', line: string): void {
    const p = this.filePath(category);
    this.ensureDir(p);
    appendFileSync(p, line + '\n', 'utf8');
  }

  rotate(category: 'audit' | 'tasks' | 'system', opts: LogRotateOptions): void {
    const p = this.filePath(category);
    if (!existsSync(p)) {
      return;
    }
    const size = statSync(p).size;
    if (size < opts.maxSizeBytes) {
      return;
    }

    // rotate: latest.log -> latest.1.log ...
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
