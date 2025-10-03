import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { FileSystemQueue } from '../queue/filesystem-queue.js';

const REQUIRED_DIR_SEGMENTS = [
  ['pending', 'tasks'],
  ['pending', 'metadata'],
  ['scheduled', 'tasks'],
  ['scheduled', 'metadata'],
  ['running', 'tasks'],
  ['running', 'metadata'],
  ['retrying', 'tasks'],
  ['retrying', 'metadata'],
  ['completed', 'tasks'],
  ['completed', 'metadata'],
  ['failed', 'tasks'],
  ['failed', 'metadata'],
  ['timeout', 'tasks'],
  ['timeout', 'metadata'],
  ['cancelled', 'tasks'],
  ['cancelled', 'metadata'],
  ['locks'],
  ['logs'],
  ['tmp'],
];

describe('FileSystemQueue Contract (T015)', () => {
  let queuePath: string;
  let queue: FileSystemQueue;

  beforeEach(async () => {
    queuePath = mkdtempSync(join(tmpdir(), 'filesystem-queue-'));
    queue = await FileSystemQueue.initialize({ queuePath });
  });

  afterEach(() => {
    rmSync(queuePath, { recursive: true, force: true });
  });

  it('creates expected directory structure', () => {
    const structure = queue.getDirectoryStructure();

    expect(structure.base).toBe(queuePath);
    for (const segments of REQUIRED_DIR_SEGMENTS) {
      const directory = join(queuePath, ...segments);
      expect(structure.all).toContain(directory);
      expect(existsSync(directory)).toBe(true);
    }
  });

  it('validates integrity for a clean queue', async () => {
    const result = await queue.validateIntegrity();

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.checkedFiles).toBeGreaterThanOrEqual(REQUIRED_DIR_SEGMENTS.length);
    expect(result.corruptedFiles).toBe(0);
    expect(result.recommendations).toEqual([]);
    expect(result.summary).toContain('healthy');
  });

  it('detects missing directories and repairs them', async () => {
    const structure = queue.getDirectoryStructure();
    const pendingTasks = join(structure.base, 'pending', 'tasks');
    rmSync(pendingTasks, { recursive: true, force: true });

    const integrity = await queue.validateIntegrity();

    expect(integrity.valid).toBe(false);
    expect(integrity.issues).toHaveLength(1);
    const issue = integrity.issues[0];
    expect(issue.type).toBe('missing_file');
    expect(issue.path).toBe(pendingTasks);
    expect(issue.autoFixable).toBe(true);

    const repair = await queue.repairCorruption(integrity.issues);
    expect(repair.repaired).toBe(true);
    expect(repair.issuesFixed).toBe(1);
    expect(repair.summary).toContain('recreated');

    expect(existsSync(pendingTasks)).toBe(true);
    const postCheck = await queue.validateIntegrity();
    expect(postCheck.valid).toBe(true);
    expect(postCheck.issues).toHaveLength(0);
  });
});
