import { BasicQueueOperations } from './basic-operations.js';
import { ensureQueueStructure } from './tools.js';
export class RetryManager {
    ops;
    constructor(options = {}) {
        const dir = ensureQueueStructure(options.queuePath).base;
        this.ops = new BasicQueueOperations({ queuePath: dir });
    }
    async scheduleRetryIfEligible(taskId) {
        return this.ops.retryTask(taskId);
    }
    async sweepFailedAndTimeout() {
        const failed = await this.ops.listTasks('failed');
        const timeouts = await this.ops.listTasks('timeout');
        let scheduled = 0;
        for (const t of [...failed, ...timeouts]) {
            const r = await this.ops.retryTask(t.id);
            if (r.retryScheduled) {
                scheduled += 1;
            }
        }
        return { checked: failed.length + timeouts.length, scheduled };
    }
    async nextRetryDelayPreview(task) {
        const attempts = task.attempts;
        const baseDelay = Math.max(task.retryPolicy?.baseDelay ?? 1000, 0);
        const maxDelay = Math.max(task.retryPolicy?.maxDelay ?? baseDelay, baseDelay);
        const strategy = task.retryPolicy?.backoffStrategy ?? 'exponential';
        let delay = baseDelay;
        switch (strategy) {
            case 'fixed':
                delay = baseDelay;
                break;
            case 'linear':
                delay = baseDelay * (attempts + 1);
                break;
            default:
                delay = baseDelay * Math.pow(2, attempts);
                break;
        }
        return Math.min(delay, maxDelay);
    }
}
