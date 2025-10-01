import { performance } from 'perf_hooks';
import { BasicQueueOperations } from './basic-operations.js';
export const BUILT_IN_TASK_TYPES = {
    SHELL_COMMAND: 'shell:command',
    FILE_OPERATION: 'file:operation',
    HTTP_REQUEST: 'http:request',
    DATA_PROCESSING: 'data:processing',
    VALIDATION: 'validation:check',
    NOTIFICATION: 'notification:send',
};
export class BasicTaskExecutor {
    queueOps;
    taskHandlers = new Map();
    executionLog = [];
    maxLogSize = 1000;
    maxConcurrency;
    resourceDefaults;
    collectMemoryUsage;
    constructor(queuePathOrOptions, options = {}) {
        const resolved = this.resolveOptions(queuePathOrOptions, options);
        const queueConfig = resolved.queuePath ? { queuePath: resolved.queuePath } : {};
        this.queueOps = new BasicQueueOperations(queueConfig);
        this.maxConcurrency = resolved.maxConcurrency ?? 1;
        this.resourceDefaults = {
            memory: resolved.resourceDefaults?.memory ?? 32 * 1024 * 1024,
            cpu: resolved.resourceDefaults?.cpu ?? 50,
            disk: resolved.resourceDefaults?.disk ?? 16 * 1024 * 1024,
        };
        this.collectMemoryUsage = resolved.collectMemoryUsage ?? true;
        this.registerBuiltInHandlers();
    }
    registerTaskHandler(taskType, handler) {
        this.taskHandlers.set(taskType, handler);
    }
    unregisterTaskHandler(taskType) {
        return this.taskHandlers.delete(taskType);
    }
    getRegisteredTaskTypes() {
        return Array.from(this.taskHandlers.keys());
    }
    async executeTask(taskId, options = {}) {
        const defaultOptions = {
            timeout: 30000,
            retryCount: 0,
            logExecution: true,
            ...options,
        };
        const task = await this.queueOps.getTask(taskId);
        if (!task) {
            throw new Error(`Task not found: ${taskId}`);
        }
        if (task.status !== 'processing' && task.status !== 'pending') {
            throw new Error(`Task ${taskId} is not in executable state. Current status: ${task.status}`);
        }
        const context = {
            task,
            attempt: defaultOptions.retryCount || 0,
            startTime: new Date(),
            options: defaultOptions,
        };
        return this.executeTaskWithContext(context);
    }
    async executeNextTask(options = {}) {
        const task = await this.queueOps.dequeueTask();
        if (!task) {
            return null;
        }
        return this.executeTask(task.id, options);
    }
    async executeTasks(taskIds, options = {}) {
        const results = [];
        for (const taskId of taskIds) {
            try {
                const result = await this.executeTask(taskId, options);
                results.push(result);
            }
            catch (error) {
                const errorResult = {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    executionTime: 0,
                    retryCount: 0,
                    startTime: new Date(),
                    endTime: new Date(),
                };
                results.push(errorResult);
            }
        }
        return results;
    }
    getExecutionLog() {
        return [...this.executionLog];
    }
    clearExecutionLog() {
        this.executionLog = [];
    }
    getExecutionStats() {
        const total = this.executionLog.length;
        const successful = this.executionLog.filter((r) => r.success).length;
        const avgTime = total > 0 ? this.executionLog.reduce((sum, r) => sum + r.executionTime, 0) / total : 0;
        return {
            totalExecutions: total,
            successCount: successful,
            failureCount: total - successful,
            averageExecutionTime: avgTime,
            successRate: total > 0 ? successful / total : 0,
        };
    }
    canHandle(taskType) {
        return this.taskHandlers.has(taskType);
    }
    getCapabilities() {
        const stats = this.getExecutionStats();
        return {
            supportedTypes: this.getRegisteredTaskTypes(),
            maxConcurrency: this.maxConcurrency,
            averageExecutionTime: stats.averageExecutionTime,
            resourceRequirements: { ...this.resourceDefaults },
        };
    }
    async executeTaskWithContext(context) {
        const { task, options } = context;
        const measurementStart = performance.now();
        const waitTimeFromContext = this.calculateWaitTimeFromContext(task, context.startTime);
        await this.queueOps.updateTaskStatus(task.id, 'processing');
        const handler = this.taskHandlers.get(task.type);
        if (!handler) {
            throw new Error(`No handler registered for task type: ${task.type}`);
        }
        const processingSnapshot = await this.queueOps.getTask(task.id);
        const attemptNumber = processingSnapshot?.attempts ?? context.attempt + 1;
        const startedAt = this.ensureDate(processingSnapshot?.startedAt) ?? context.startTime;
        const effectiveWait = waitTimeFromContext ?? this.calculateWaitTime(processingSnapshot, startedAt);
        const handlerStart = performance.now();
        try {
            const result = options.timeout
                ? await this.executeWithTimeout(handler, task.payload, options.timeout)
                : await handler(task.payload);
            const handlerEnd = performance.now();
            const metrics = {
                durationMs: Math.max(handlerEnd - measurementStart, 0),
                handlerLatencyMs: Math.max(handlerEnd - handlerStart, 0),
                ...(effectiveWait !== undefined ? { waitTimeMs: effectiveWait } : {}),
                ...(this.collectMemoryUsage ? { memoryUsage: process.memoryUsage() } : {}),
            };
            await this.queueOps.updateTaskStatus(task.id, 'completed', result);
            const executionResult = {
                success: true,
                result,
                executionTime: metrics.durationMs,
                retryCount: attemptNumber,
                startTime: context.startTime,
                endTime: new Date(),
                metrics,
            };
            if (options.logExecution) {
                this.addToExecutionLog(executionResult);
            }
            return executionResult;
        }
        catch (error) {
            const handlerEnd = performance.now();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await this.queueOps.updateTaskStatus(task.id, 'failed', undefined, errorMessage);
            const metrics = {
                durationMs: Math.max(handlerEnd - measurementStart, 0),
                handlerLatencyMs: Math.max(handlerEnd - handlerStart, 0),
                ...(effectiveWait !== undefined ? { waitTimeMs: effectiveWait } : {}),
                ...(this.collectMemoryUsage ? { memoryUsage: process.memoryUsage() } : {}),
            };
            const executionResult = {
                success: false,
                error: errorMessage,
                executionTime: metrics.durationMs,
                retryCount: attemptNumber,
                startTime: context.startTime,
                endTime: new Date(),
                metrics,
            };
            if (options.logExecution) {
                this.addToExecutionLog(executionResult);
            }
            return executionResult;
        }
    }
    async executeWithTimeout(handler, payload, timeout) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error(`Task execution timed out after ${timeout}ms`));
            }, timeout);
            Promise.resolve(handler(payload))
                .then((result) => {
                clearTimeout(timeoutId);
                resolve(result);
            })
                .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
        });
    }
    addToExecutionLog(result) {
        this.executionLog.push(result);
        if (this.executionLog.length > this.maxLogSize) {
            this.executionLog = this.executionLog.slice(-this.maxLogSize);
        }
    }
    resolveOptions(queuePathOrOptions, options = {}) {
        if (typeof queuePathOrOptions === 'string') {
            return {
                ...options,
                queuePath: queuePathOrOptions,
            };
        }
        if (queuePathOrOptions) {
            return { ...queuePathOrOptions };
        }
        return { ...options };
    }
    calculateWaitTime(task, startedAt) {
        if (!task) {
            return undefined;
        }
        const createdAt = this.ensureDate(task.createdAt);
        if (!createdAt) {
            return undefined;
        }
        return Math.max(startedAt.getTime() - createdAt.getTime(), 0);
    }
    calculateWaitTimeFromContext(task, startedAt) {
        const createdAt = this.ensureDate(task.createdAt);
        if (!createdAt) {
            return undefined;
        }
        return Math.max(startedAt.getTime() - createdAt.getTime(), 0);
    }
    ensureDate(value) {
        if (!value) {
            return undefined;
        }
        if (value instanceof Date) {
            return value;
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return undefined;
        }
        return parsed;
    }
    registerBuiltInHandlers() {
        this.registerTaskHandler(BUILT_IN_TASK_TYPES.SHELL_COMMAND, async (payload) => {
            const { command, args = [] } = payload;
            if (!command) {
                throw new Error('Shell command is required');
            }
            return {
                command,
                args,
                output: `Mock execution of: ${command} ${args.join(' ')}`,
                exitCode: 0,
                executedAt: new Date().toISOString(),
            };
        });
        this.registerTaskHandler(BUILT_IN_TASK_TYPES.FILE_OPERATION, async (payload) => {
            const { operation, path, content } = payload;
            if (!operation || !path) {
                throw new Error('File operation and path are required');
            }
            return {
                operation,
                path,
                success: true,
                timestamp: new Date().toISOString(),
                message: `Mock ${operation} operation on ${path}`,
                ...(content !== undefined ? { contentSnapshot: content } : {}),
            };
        });
        this.registerTaskHandler(BUILT_IN_TASK_TYPES.HTTP_REQUEST, async (payload) => {
            const { method = 'GET', url, headers = {}, body } = payload;
            if (!url) {
                throw new Error('URL is required for HTTP request');
            }
            return {
                method,
                url,
                status: 200,
                statusText: 'OK',
                data: `Mock response from ${method} ${url}`,
                headers: { 'content-type': 'application/json' },
                requestHeaders: headers,
                body,
                timestamp: new Date().toISOString(),
            };
        });
        this.registerTaskHandler(BUILT_IN_TASK_TYPES.DATA_PROCESSING, async (payload) => {
            const { data, operation, options } = payload;
            if (!data || !operation) {
                throw new Error('Data and operation are required');
            }
            return {
                operation,
                originalSize: Array.isArray(data) ? data.length : 1,
                processedData: `Processed data with operation: ${operation}`,
                timestamp: new Date().toISOString(),
                ...(options ? { optionsUsed: options } : {}),
            };
        });
        this.registerTaskHandler(BUILT_IN_TASK_TYPES.VALIDATION, async (payload) => {
            const { data, rules = [], strict = false } = payload;
            if (!data) {
                throw new Error('Data is required for validation');
            }
            return {
                valid: true,
                data,
                appliedRules: rules,
                errors: [],
                warnings: [],
                strict,
                timestamp: new Date().toISOString(),
            };
        });
        this.registerTaskHandler(BUILT_IN_TASK_TYPES.NOTIFICATION, async (payload) => {
            const { type, recipient, message, options = {} } = payload;
            if (!type || !recipient || !message) {
                throw new Error('Type, recipient, and message are required for notification');
            }
            return {
                type,
                recipient,
                message,
                sent: true,
                messageId: `msg_${Date.now()}`,
                timestamp: new Date().toISOString(),
                options,
            };
        });
    }
}
