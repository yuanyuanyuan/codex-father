import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { BackupResult, RestoreResult } from '../types.js';
import { ensureQueueStructure } from './tools.js';

export class QueueBackupManager {
  private readonly base: string;

  constructor(queuePath?: string) {
    this.base = ensureQueueStructure(queuePath).base;
  }

  async createBackup(manifestPath: string): Promise<BackupResult> {
    const started = Date.now();
    const { fileCount, totalSize } = this.scan(this.base);
    const manifest = {
      version: 1,
      generatedAt: new Date(started).toISOString(),
      source: this.base,
      fileCount,
      totalSize,
    };
    const dest = resolve(manifestPath);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, JSON.stringify(manifest, null, 2), 'utf8');
    return {
      success: true,
      backupPath: dest,
      fileCount,
      totalSize,
      duration: Date.now() - started,
      compression: 1,
    };
  }

  async restoreFromBackup(manifestPath: string, targetDir?: string): Promise<RestoreResult> {
    const started = Date.now();
    try {
      const raw = JSON.parse(readFileSync(resolve(manifestPath), 'utf8')) as { source: string };
      const src = resolve(raw.source);
      const dest = resolve(targetDir ?? this.base);
      mkdirSync(dest, { recursive: true });
      let restoredFiles = 0;
      let skippedFiles = 0;
      const copy = (dir: string, rel = ''): void => {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          const p = join(dir, e.name);
          const r = join(rel, e.name);
          const d = join(dest, r);
          if (e.isDirectory()) {
            mkdirSync(d, { recursive: true });
            copy(p, r);
          } else {
            try {
              copyFileSync(p, d);
              restoredFiles += 1;
            } catch {
              skippedFiles += 1;
            }
          }
        }
      };
      if (existsSync(src)) {
        copy(src);
      }
      return {
        success: true,
        restoredFiles,
        skippedFiles,
        errors: [],
        duration: Date.now() - started,
      };
    } catch (err: unknown) {
      return {
        success: false,
        restoredFiles: 0,
        skippedFiles: 0,
        errors: [err instanceof Error ? err.message : String(err)],
        duration: Date.now() - started,
      };
    }
  }

  private scan(dir: string): { fileCount: number; totalSize: number } {
    if (!existsSync(dir)) {
      return { fileCount: 0, totalSize: 0 };
    }
    let fileCount = 0;
    let totalSize = 0;
    const walk = (p: string): void => {
      const entries = readdirSync(p, { withFileTypes: true });
      for (const e of entries) {
        const fp = join(p, e.name);
        if (e.isDirectory()) {
          walk(fp);
        } else {
          fileCount += 1;
          totalSize += statSync(fp).size;
        }
      }
    };
    walk(dir);
    return { fileCount, totalSize };
  }
}
