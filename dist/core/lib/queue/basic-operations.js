import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { createTaskFromDefinition } from './task-definition.js';
const STATUS_DIR_MAP = {
    pending: 'pending',
    scheduled: 'scheduled',
    processing: 'running',
    completed: 'completed',
    failed: 'failed',
    retrying: 'retrying',
    cancelled: 'cancelled',
    timeout: 'timeout',
};
export class BasicQueueOperations {
    config;
    constructor(config = {}) {
        this.config = {
            queuePath: resolve(process.cwd(), '.codex-father/queue'),
            lockTimeout: 30000,
            maxRetries: 3,
            ...config,
        };
        this.ensureQueueStructure();
    }
    ensureQueueStructure() {
        const basePath = this.config.queuePath;
        if (!existsSync(basePath)) {
            throw new Error(`Queue directory does not exist: ${basePath}`);
        }
        const requiredDirs = [
            'pending/tasks',
            'pending/metadata',
            'scheduled/tasks',
            'scheduled/metadata',
            'running/tasks',
            'running/metadata',
            'retrying/tasks',
            'retrying/metadata',
            'completed/tasks',
            'completed/metadata',
            'failed/tasks',
            'failed/metadata',
            'timeout/tasks',
            'timeout/metadata',
            'cancelled/tasks',
            'cancelled/metadata',
            'locks',
            'logs',
            'tmp',
        ];
        for (const dir of requiredDirs) {
            const dirPath = join(basePath, dir);
            if (!existsSync(dirPath)) {
                mkdirSync(dirPath, { recursive: true });
            }
        }
    }
    async enqueueTask(definition) {
        const createdAt = new Date();
        const task = createTaskFromDefinition(definition, { now: createdAt });
        const taskPath = this.getTaskPath(task.id, task.status);
        const metadataPath = this.getMetadataPath(task.id, task.status);
        try {
            writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf8');
            const metadata = {
                taskId: task.id,
                priority: task.priority,
                attempts: task.attempts,
                maxAttempts: task.maxAttempts,
                retryPolicy: task.retryPolicy,
                timeout: task.timeout,
                scheduledAt: task.scheduledAt,
                createdAt: task.createdAt,
                queuedAt: createdAt,
                status: task.status,
                metadata: task.metadata,
            };
            writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');
            const queuePosition = task.status === 'pending' ? this.countTasks('pending') : undefined;
            const estimatedStartTime = task.status === 'scheduled'
                ? (task.scheduledAt ?? new Date(createdAt.getTime()))
                : new Date(createdAt.getTime());
            const enqueueResult = {
                taskId: task.id,
                estimatedStartTime,
                ...(queuePosition !== undefined ? { queuePosition } : {}),
                ...(task.scheduledAt ? { scheduledAt: task.scheduledAt } : {}),
            };
            return enqueueResult;
        }
        catch (error) {
            throw new Error(`Failed to enqueue task: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async dequeueTask() {
        const pendingDir = join(this.config.queuePath, 'pending/tasks');
        try {
            const files = readdirSync(pendingDir);
            if (files.length === 0) {
                return null;
            }
            const taskFile = files.find((f) => f.endsWith('.json'));
            if (!taskFile) {
                return null;
            }
            const taskId = taskFile.replace('.json', '');
            const task = await this.getTask(taskId);
            if (task && task.status === 'pending') {
                await this.updateTaskStatus(taskId, 'processing');
                return task;
            }
            return null;
        }
        catch (error) {
            console.error('Error dequeuing task:', error);
            return null;
        }
    }
    async getTask(taskId) {
        for (const status of Object.keys(STATUS_DIR_MAP)) {
            const taskPath = this.getTaskPath(taskId, status);
            if (existsSync(taskPath)) {
                try {
                    const taskData = readFileSync(taskPath, 'utf8');
                    const task = JSON.parse(taskData);
                    return task;
                }
                catch (error) {
                    console.error(`Error reading task ${taskId}:`, error);
                    return null;
                }
            }
        }
        return null;
    }
    async cancelTask(taskId, reason) {
        const task = await this.getTask(taskId);
        if (!task) {
            return {
                taskId,
                cancelled: false,
                wasRunning: false,
                ...(reason ? { reason } : {}),
            };
        }
        const wasRunning = task.status === 'processing';
        const cancellableStatuses = ['pending', 'scheduled', 'processing', 'retrying'];
        if (!cancellableStatuses.includes(task.status)) {
            return {
                taskId,
                cancelled: false,
                wasRunning,
                ...(reason ? { reason } : {}),
            };
        }
        const updated = await this.updateTaskStatus(taskId, 'cancelled');
        return {
            taskId,
            cancelled: updated,
            wasRunning,
            ...(reason ? { reason } : {}),
        };
    }
    async retryTask(taskId) {
        const task = await this.getTask(taskId);
        if (!task) {
            return {
                taskId,
                retryScheduled: false,
                attemptNumber: 0,
                reason: 'task_not_found',
            };
        }
        const attemptsSoFar = task.attempts;
        const maxAttempts = task.retryPolicy?.maxAttempts ?? 0;
        if (attemptsSoFar >= maxAttempts) {
            return {
                taskId,
                retryScheduled: false,
                attemptNumber: attemptsSoFar,
                reason: 'max_attempts_reached',
            };
        }
        const delayMs = this.calculateRetryDelay(task);
        const nextAttemptAt = new Date(Date.now() + delayMs);
        const updated = await this.updateTaskStatus(taskId, 'retrying', undefined, undefined, {
            scheduledAt: nextAttemptAt,
        });
        return {
            taskId,
            retryScheduled: updated,
            nextAttemptAt,
            attemptNumber: attemptsSoFar + 1,
            ...(updated ? {} : { reason: 'update_failed' }),
        };
    }
    async updateTaskStatus(taskId, newStatus, result, error, updates) {
        const currentTask = await this.getTask(taskId);
        if (!currentTask) {
            return false;
        }
        const oldStatus = currentTask.status;
        try {
            const now = new Date();
            currentTask.status = newStatus;
            currentTask.updatedAt = now;
            if (newStatus === 'processing') {
                currentTask.startedAt = now;
                currentTask.attempts += 1;
            }
            if (newStatus === 'completed') {
                currentTask.completedAt = now;
            }
            if (result !== undefined) {
                currentTask.result = result;
            }
            if (error !== undefined) {
                currentTask.error = error;
                currentTask.lastError = error;
            }
            if (updates) {
                Object.assign(currentTask, updates);
            }
            const oldTaskPath = this.getTaskPath(taskId, oldStatus);
            const newTaskPath = this.getTaskPath(taskId, newStatus);
            const oldMetadataPath = this.getMetadataPath(taskId, oldStatus);
            const newMetadataPath = this.getMetadataPath(taskId, newStatus);
            writeFileSync(newTaskPath, JSON.stringify(currentTask, null, 2), 'utf8');
            if (existsSync(oldMetadataPath)) {
                const metadata = JSON.parse(readFileSync(oldMetadataPath, 'utf8'));
                metadata.updatedAt = now;
                metadata.status = newStatus;
                metadata.attempts = currentTask.attempts;
                metadata.lastError = currentTask.lastError;
                metadata.result = currentTask.result;
                if (updates?.scheduledAt) {
                    metadata.scheduledAt = updates.scheduledAt;
                }
                writeFileSync(newMetadataPath, JSON.stringify(metadata, null, 2), 'utf8');
                unlinkSync(oldMetadataPath);
            }
            if (existsSync(oldTaskPath)) {
                unlinkSync(oldTaskPath);
            }
            return true;
        }
        catch (error) {
            console.error(`Error updating task status for ${taskId}:`, error);
            return false;
        }
    }
    getTaskPath(taskId, status) {
        const statusDir = STATUS_DIR_MAP[status];
        if (!statusDir) {
            throw new Error(`Unsupported task status directory mapping: ${status}`);
        }
        return join(this.config.queuePath, statusDir, 'tasks', `${taskId}.json`);
    }
    getMetadataPath(taskId, status) {
        const statusDir = STATUS_DIR_MAP[status];
        if (!statusDir) {
            throw new Error(`Unsupported task status directory mapping: ${status}`);
        }
        return join(this.config.queuePath, statusDir, 'metadata', `${taskId}.json`);
    }
    calculateRetryDelay(task) {
        const policy = task.retryPolicy;
        const baseDelay = Math.max(policy?.baseDelay ?? 1000, 0);
        const maxDelay = Math.max(policy?.maxDelay ?? baseDelay, baseDelay);
        const attemptIndex = Math.max(task.attempts, 0);
        const strategy = policy?.backoffStrategy ?? 'exponential';
        let delay = baseDelay;
        switch (strategy) {
            case 'fixed':
                delay = baseDelay;
                break;
            case 'linear':
                delay = baseDelay * (attemptIndex + 1);
                break;
            case 'exponential':
            default:
                delay = baseDelay * Math.pow(2, attemptIndex);
                break;
        }
        if (policy?.retryableErrors && policy.retryableErrors.length > 0) {
            if (task.lastError && !policy.retryableErrors.includes(task.lastError)) {
                delay = baseDelay;
            }
        }
        return Math.min(delay, maxDelay);
    }
    countTasks(status) {
        const statusDir = STATUS_DIR_MAP[status];
        const tasksDir = join(this.config.queuePath, statusDir, 'tasks');
        try {
            const files = readdirSync(tasksDir);
            return files.filter((file) => file.endsWith('.json')).length;
        }
        catch {
            return 0;
        }
    }
    async getQueueStats() {
        const stats = {
            pending: 0,
            scheduled: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            retrying: 0,
            cancelled: 0,
            timeout: 0,
        };
        for (const status of Object.keys(STATUS_DIR_MAP)) {
            const statusDir = STATUS_DIR_MAP[status];
            const tasksDir = join(this.config.queuePath, statusDir, 'tasks');
            try {
                if (existsSync(tasksDir)) {
                    const files = readdirSync(tasksDir);
                    stats[status] = files.filter((f) => f.endsWith('.json')).length;
                }
            }
            catch (error) {
                console.error(`Error reading ${status} tasks directory:`, error);
            }
        }
        return stats;
    }
    async listTasks(status) {
        const tasks = [];
        const statusesToCheck = status ? [status] : Object.keys(STATUS_DIR_MAP);
        for (const taskStatus of statusesToCheck) {
            const statusDir = STATUS_DIR_MAP[taskStatus];
            const tasksDir = join(this.config.queuePath, statusDir, 'tasks');
            try {
                if (existsSync(tasksDir)) {
                    const files = readdirSync(tasksDir);
                    for (const file of files) {
                        if (file.endsWith('.json')) {
                            const taskPath = join(tasksDir, file);
                            const taskData = readFileSync(taskPath, 'utf8');
                            const task = JSON.parse(taskData);
                            tasks.push(task);
                        }
                    }
                }
            }
            catch (error) {
                console.error(`Error reading tasks in ${taskStatus} status:`, error);
            }
        }
        return tasks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
}
