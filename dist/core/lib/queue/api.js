import { BasicQueueOperations } from './basic-operations.js';
import { BasicTaskExecutor } from './basic-executor.js';
import { ensureQueueStructure } from './tools.js';
export class TaskQueueAPI {
    ops;
    executor;
    constructor(queuePath) {
        const dir = ensureQueueStructure(queuePath).base;
        this.ops = new BasicQueueOperations({ queuePath: dir });
        this.executor = new BasicTaskExecutor(dir);
    }
    enqueue(def) {
        return this.ops.enqueueTask({
            type: def.type,
            priority: def.priority ?? 5,
            payload: def.payload ?? {},
        });
    }
    getTask(id) {
        return this.ops.getTask(id);
    }
    list(status) {
        return this.ops.listTasks(status);
    }
    cancel(id, reason) {
        return this.ops.cancelTask(id, reason);
    }
    retry(id) {
        return this.ops.retryTask(id);
    }
    stats() {
        return this.ops.getQueueStats();
    }
    execute(id, options) {
        return this.executor.executeTask(id, options);
    }
}
