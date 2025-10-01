import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { BasicQueueOperations } from './basic-operations.js';
const STATUS_DIRECTORIES = [
    'pending',
    'scheduled',
    'processing',
    'retrying',
    'completed',
    'failed',
    'timeout',
    'cancelled',
];
const ADDITIONAL_DIRECTORIES = ['logs', 'index', 'locks', 'tmp', 'archived'];
export class FileSystemQueue {
    queueOps;
    queuePath;
    constructor(queuePath, queueOps) {
        this.queuePath = queuePath;
        this.queueOps = queueOps;
    }
    static async initialize(options = {}) {
        const queuePath = resolve(options.queuePath ?? join(process.cwd(), '.codex-father/queue'));
        ensureBaseStructure(queuePath);
        const queueConfig = {
            queuePath,
            ...(typeof options.lockTimeout === 'number' ? { lockTimeout: options.lockTimeout } : {}),
            ...(typeof options.maxRetries === 'number' ? { maxRetries: options.maxRetries } : {}),
        };
        const queueOps = new BasicQueueOperations(queueConfig);
        return new FileSystemQueue(queuePath, queueOps);
    }
    getDirectoryStructure() {
        const base = this.queuePath;
        const statuses = STATUS_DIRECTORIES.reduce((acc, status) => {
            const directoryName = statusToDirectoryName(status);
            acc[status] = join(base, directoryName);
            return acc;
        }, {});
        const tasks = STATUS_DIRECTORIES.reduce((acc, status) => {
            const directoryName = statusToDirectoryName(status);
            acc[status] = join(base, directoryName, 'tasks');
            return acc;
        }, {});
        const metadata = STATUS_DIRECTORIES.reduce((acc, status) => {
            const directoryName = statusToDirectoryName(status);
            acc[status] = join(base, directoryName, 'metadata');
            return acc;
        }, {});
        const additional = ADDITIONAL_DIRECTORIES.reduce((acc, dir) => {
            acc[dir] = join(base, dir);
            return acc;
        }, {});
        const all = [
            base,
            ...Object.values(statuses),
            ...Object.values(tasks),
            ...Object.values(metadata),
            ...Object.values(additional),
        ];
        return {
            base,
            statuses,
            tasks,
            metadata,
            logs: additional.logs,
            index: additional.index,
            locks: additional.locks,
            tmp: additional.tmp,
            archived: additional.archived,
            all,
        };
    }
    async enqueue(task) {
        return this.queueOps.enqueueTask(task);
    }
    async dequeue() {
        return this.queueOps.dequeueTask();
    }
    async getTask(taskId) {
        return this.queueOps.getTask(taskId);
    }
    async updateTaskStatus(taskId, status, result, error) {
        await this.queueOps.updateTaskStatus(taskId, status, result, error);
    }
    async listTasks(filter) {
        return this.queueOps.listTasks(filter);
    }
    async cancelTask(taskId, reason) {
        return this.queueOps.cancelTask(taskId, reason);
    }
    async retryTask(taskId) {
        return this.queueOps.retryTask(taskId);
    }
    async purgeCompletedTasks() {
        return {
            totalPurged: 0,
            tasksRemaining: 0,
            diskSpaceFreed: 0,
        };
    }
    async getQueueStats() {
        return this.queueOps.getQueueStats();
    }
    async shutdown() {
    }
    async validateIntegrity() {
        const structure = this.getDirectoryStructure();
        const issues = [];
        const counts = {
            checkedFiles: structure.all.length,
            corruptedFiles: 0,
            orphanedFiles: 0,
        };
        for (const path of structure.all) {
            if (!existsSync(path)) {
                issues.push(createMissingDirectoryIssue(path));
            }
        }
        counts.corruptedFiles = issues.length;
        const recommendations = issues.map((issue) => issue.recommendation);
        const valid = issues.length === 0;
        return {
            valid,
            issues,
            recommendations,
            checkedFiles: counts.checkedFiles,
            corruptedFiles: counts.corruptedFiles,
            orphanedFiles: counts.orphanedFiles,
            summary: valid
                ? 'Queue directory is healthy.'
                : `Queue directory has ${issues.length} issue(s).`,
        };
    }
    async repairCorruption(issues) {
        let fixed = 0;
        for (const issue of issues) {
            if (!issue.autoFixable) {
                continue;
            }
            if (issue.type === 'missing_file') {
                ensureDirectory(issue.path);
                fixed += 1;
            }
        }
        return {
            repaired: fixed === issues.length,
            issuesFixed: fixed,
            issuesRemaining: issues.length - fixed,
            backupCreated: false,
            summary: fixed > 0 ? 'Missing directories recreated.' : 'No issues were repaired.',
        };
    }
    async backup(destinationPath) {
        const startedAt = Date.now();
        const { fileCount, totalSize } = scanDirectory(this.queuePath);
        const manifest = {
            generatedAt: new Date(startedAt).toISOString(),
            fileCount,
            totalSize,
            source: this.queuePath,
        };
        const resolvedPath = resolve(destinationPath);
        ensureDirectory(dirname(resolvedPath));
        writeFileSync(resolvedPath, JSON.stringify(manifest, null, 2), 'utf8');
        const duration = Date.now() - startedAt;
        return {
            success: true,
            backupPath: resolvedPath,
            fileCount,
            totalSize,
            duration,
            compression: 1,
        };
    }
    async restore(backupPath) {
        return {
            success: false,
            restoredFiles: 0,
            skippedFiles: 0,
            errors: ['restore_not_implemented', backupPath],
            duration: 0,
        };
    }
    async migrate(newVersion) {
        return {
            success: false,
            fromVersion: 'unknown',
            toVersion: newVersion,
            migratedTasks: 0,
            backupPath: '',
            duration: 0,
            warnings: ['migration_not_implemented'],
        };
    }
}
function ensureBaseStructure(path) {
    if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
    for (const status of STATUS_DIRECTORIES) {
        const directoryName = statusToDirectoryName(status);
        ensureDirectory(join(path, directoryName, 'tasks'));
        ensureDirectory(join(path, directoryName, 'metadata'));
    }
    for (const dir of ADDITIONAL_DIRECTORIES) {
        ensureDirectory(join(path, dir));
    }
}
function ensureDirectory(path) {
    if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
    }
}
function statusToDirectoryName(status) {
    if (status === 'processing') {
        return 'running';
    }
    if (status === 'retrying') {
        return 'retrying';
    }
    return status;
}
function createMissingDirectoryIssue(path) {
    return {
        type: 'missing_file',
        severity: 'medium',
        path,
        description: `Required queue directory is missing: ${path}`,
        autoFixable: true,
        recommendation: 'Recreate the directory structure using repairCorruption.',
    };
}
function scanDirectory(path) {
    let fileCount = 0;
    let totalSize = 0;
    if (!existsSync(path)) {
        return { fileCount, totalSize };
    }
    const entries = readdirSync(path, { withFileTypes: true });
    for (const entry of entries) {
        const entryPath = join(path, entry.name);
        if (entry.isDirectory()) {
            const nested = scanDirectory(entryPath);
            fileCount += nested.fileCount;
            totalSize += nested.totalSize;
        }
        else {
            fileCount += 1;
            totalSize += statSync(entryPath).size;
        }
    }
    return { fileCount, totalSize };
}
