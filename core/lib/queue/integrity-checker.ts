import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  CorruptionIssue,
  IntegrityCheckResult,
  QueueStatusDirectory,
  Task,
} from '../types.js';
import { ensureQueueStructure, readJSONSafe } from './tools.js';

const STATUS_DIRS: QueueStatusDirectory[] = [
  'pending',
  'scheduled',
  'processing',
  'retrying',
  'completed',
  'failed',
  'timeout',
  'cancelled',
];

export class QueueIntegrityChecker {
  constructor(private readonly queuePath?: string) {}

  async check(): Promise<IntegrityCheckResult> {
    const structure = ensureQueueStructure(this.queuePath);
    const issues: CorruptionIssue[] = [];
    let checkedFiles = 0;
    let orphanedFiles = 0;

    // Verify directories exist (ensureQueueStructure already created them)
    for (const dir of structure.all) {
      if (!existsSync(dir)) {
        issues.push(this.issue('missing_file', 'medium', dir, `Missing directory ${dir}`, true));
      }
    }

    // Validate task JSONs and status consistency, and metadata pairs
    for (const status of STATUS_DIRS) {
      const dirName = status === 'processing' ? 'running' : status;
      const tasksDir = join(structure.base, dirName, 'tasks');
      const metaDir = join(structure.base, dirName, 'metadata');
      const taskFiles = existsSync(tasksDir)
        ? readdirSync(tasksDir).filter((f) => f.endsWith('.json'))
        : [];
      const metaFiles = existsSync(metaDir)
        ? readdirSync(metaDir).filter((f) => f.endsWith('.json'))
        : [];

      for (const f of taskFiles) {
        checkedFiles += 1;
        const fp = join(tasksDir, f);
        const parsed = readJSONSafe<Task>(fp);
        if (!parsed.ok) {
          issues.push(
            this.issue('invalid_json', 'high', fp, parsed.error || 'invalid_json', false)
          );
          continue;
        }
        const t = parsed.value;
        if (t.status !== status) {
          issues.push(
            this.issue(
              'inconsistent_status',
              'medium',
              fp,
              `Task status ${t.status} != dir ${status}`,
              false
            )
          );
        }
        const metaPath = join(metaDir, f);
        if (!existsSync(metaPath)) {
          issues.push(this.issue('orphaned_file', 'low', fp, 'Task file without metadata', true));
          orphanedFiles += 1;
        }
      }

      for (const f of metaFiles) {
        checkedFiles += 1;
        const taskPath = join(tasksDir, f);
        if (!existsSync(taskPath)) {
          const fp = join(metaDir, f);
          issues.push(this.issue('orphaned_file', 'low', fp, 'Metadata without task file', true));
          orphanedFiles += 1;
        }
      }
    }

    const valid = issues.length === 0;
    return {
      valid,
      issues,
      recommendations: issues.map((i) => i.recommendation),
      checkedFiles,
      corruptedFiles: issues.length,
      orphanedFiles,
      summary: valid ? 'Queue storage is healthy.' : `Detected ${issues.length} issue(s).`,
    };
  }

  private issue(
    type: CorruptionIssue['type'],
    severity: CorruptionIssue['severity'],
    path: string,
    description: string,
    fixable: boolean
  ): CorruptionIssue {
    return {
      type,
      severity,
      path,
      description,
      autoFixable: fixable,
      recommendation: fixable
        ? 'Run repair to fix automatically.'
        : 'Investigate and repair manually.',
    };
  }
}
