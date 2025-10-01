import { BasicQueueOperations } from './basic-operations.js';
import { BasicTaskExecutor } from './basic-executor.js';
import { ensureQueueStructure } from './tools.js';
export class TaskScheduler {
    ops;
    executor;
    intervalMs;
    maxConcurrent;
    timer = null;
    running = 0;
    constructor(options = {}) {
        const dir = ensureQueueStructure(options.queuePath).base;
        this.ops = new BasicQueueOperations({ queuePath: dir });
        this.executor = new BasicTaskExecutor(dir);
        this.intervalMs = Math.max(options.intervalMs ?? 1000, 1);
        this.maxConcurrent = Math.max(options.maxConcurrent ?? 1, 1);
    }
    start() {
        if (this.timer) {
            return;
        }
        this.timer = setInterval(() => {
            void this.tick();
        }, this.intervalMs);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.timer = null;
    }
    async tick() {
        const scheduled = await this.ops.listTasks('scheduled');
        const now = Date.now();
        for (const t of scheduled) {
            const due = t.scheduledAt ? new Date(t.scheduledAt).getTime() <= now : true;
            if (due) {
                await this.ops.updateTaskStatus(t.id, 'pending');
            }
        }
        await this.consumeDueRetrying(now);
        while (this.running < this.maxConcurrent) {
            const next = await this.ops.dequeueTask();
            if (!next) {
                break;
            }
            await this.run(next);
        }
    }
    async consumeDueRetrying(nowValue) {
        const retrying = await this.ops.listTasks('retrying');
        const due = retrying.filter((t) => t.scheduledAt && new Date(t.scheduledAt).getTime() <= nowValue);
        for (const task of due) {
            if (this.running >= this.maxConcurrent) {
                break;
            }
            await this.ops.updateTaskStatus(task.id, 'processing');
            await this.run(task);
        }
    }
    async run(task) {
        this.running += 1;
        try {
            await this.executor.executeTask(task.id);
        }
        finally {
            this.running -= 1;
        }
    }
}
