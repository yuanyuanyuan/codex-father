import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { QueueDirectoryStructure, QueueStatusDirectory } from '../types.js';

const STATUS_DIRECTORIES: QueueStatusDirectory[] = [
  'pending',
  'scheduled',
  'processing',
  'retrying',
  'completed',
  'failed',
  'timeout',
  'cancelled',
];

const EXTRA_DIRS = ['logs', 'index', 'locks', 'tmp', 'archived'] as const;

export function resolveQueuePath(base?: string): string {
  return resolve(base ?? join(process.cwd(), '.codex-father/queue'));
}

export function ensureQueueStructure(basePath?: string): QueueDirectoryStructure {
  const base = resolveQueuePath(basePath);
  if (!existsSync(base)) {
    mkdirSync(base, { recursive: true });
  }

  const statuses = STATUS_DIRECTORIES.reduce<Record<QueueStatusDirectory, string>>((acc, s) => {
    acc[s] = join(base, s === 'processing' ? 'running' : s);
    return acc;
  }, {} as any);

  const tasks = STATUS_DIRECTORIES.reduce<Record<QueueStatusDirectory, string>>((acc, s) => {
    acc[s] = join(statuses[s], 'tasks');
    if (!existsSync(acc[s])) mkdirSync(acc[s], { recursive: true });
    return acc;
  }, {} as any);

  const metadata = STATUS_DIRECTORIES.reduce<Record<QueueStatusDirectory, string>>((acc, s) => {
    acc[s] = join(statuses[s], 'metadata');
    if (!existsSync(acc[s])) mkdirSync(acc[s], { recursive: true });
    return acc;
  }, {} as any);

  const extras = EXTRA_DIRS.reduce<Record<(typeof EXTRA_DIRS)[number], string>>((acc, d) => {
    const p = join(base, d);
    if (!existsSync(p)) mkdirSync(p, { recursive: true });
    acc[d] = p;
    return acc;
  }, {} as any);

  const all = [base, ...Object.values(statuses), ...Object.values(tasks), ...Object.values(metadata), ...Object.values(extras)];

  return {
    base,
    statuses,
    tasks,
    metadata,
    logs: extras.logs,
    index: extras.index,
    locks: extras.locks,
    tmp: extras.tmp,
    archived: extras.archived,
    all,
  };
}

export function readJSONSafe<T = any>(path: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const raw = readFileSync(path, 'utf8');
    return { ok: true, value: JSON.parse(raw) };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'read_failed' };
  }
}

export function now(): Date {
  return new Date();
}

export function toIso(d?: Date): string | undefined {
  return d ? new Date(d).toISOString() : undefined;
}

