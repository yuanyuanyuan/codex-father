import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { BasicQueueOperations } from '../../lib/queue/basic-operations.js';
const REQUIRED_QUEUE_DIRS = [
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
export function registerTaskCommand(parser) {
    parser.registerCommand('task', 'Manage Codex Father task queue', async (context) => {
        const queuePath = ensureQueueStructure(context.workingDirectory);
        const queueOps = new BasicQueueOperations({ queuePath });
        const action = context.args[0];
        const taskId = context.args[1];
        const startedAt = Date.now();
        try {
            switch (action) {
                case 'create':
                    return await handleCreate(queueOps, context, startedAt);
                case 'list':
                    return await handleList(queueOps, context, startedAt);
                case 'status':
                    return await handleStatus(queueOps, context, taskId, startedAt);
                case 'cancel':
                    return await handleCancel(queueOps, context, taskId, startedAt);
                case 'retry':
                    return await handleRetry(queueOps, context, taskId, startedAt);
                case 'logs':
                    return handleLogs(context, taskId, startedAt);
                case 'stats':
                case 'statistics':
                    return await handleStats(queueOps, context, startedAt);
                default:
                    return {
                        success: false,
                        message: `Unknown task action: ${action ?? ''}`.trim(),
                        errors: ['Supported actions: create, list, status, cancel, retry, logs, stats'],
                        executionTime: Date.now() - startedAt,
                    };
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: 'Task command failed',
                errors: [message],
                executionTime: Date.now() - startedAt,
            };
        }
    }, {
        arguments: [
            {
                name: 'action',
                description: 'Task action (create|list|status|cancel|retry|logs|stats)',
                required: true,
            },
            { name: 'id', description: 'Task identifier for targeted actions', required: false },
        ],
        options: [
            { flags: '--type <type>', description: 'Task type when creating a task' },
            { flags: '--payload <payload>', description: 'Task payload as JSON string' },
            { flags: '--priority <priority>', description: 'Priority value (higher runs first)' },
            { flags: '--scheduled-at <timestamp>', description: 'Schedule time in ISO format' },
            { flags: '--status <status...>', description: 'Filter task list by status' },
            { flags: '--types <types...>', description: 'Filter task list by type' },
            { flags: '--limit <limit>', description: 'Limit number of listed tasks' },
            { flags: '--format <format>', description: 'Output format for list (table|json|list)' },
            { flags: '--reason <reason>', description: 'Cancellation or retry reason' },
        ],
    });
}
function ensureQueueStructure(workingDirectory) {
    const basePath = join(workingDirectory, '.codex-father', 'queue');
    if (!existsSync(basePath)) {
        mkdirSync(basePath, { recursive: true });
    }
    for (const relative of REQUIRED_QUEUE_DIRS) {
        const dirPath = join(basePath, relative);
        if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
        }
    }
    const metadataFile = join(basePath, 'queue.info.json');
    if (!existsSync(metadataFile)) {
        const info = {
            id: randomUUID(),
            createdAt: new Date().toISOString(),
            description: 'Codex Father local task queue',
        };
        writeFileSync(metadataFile, JSON.stringify(info, null, 2), 'utf8');
    }
    return basePath;
}
async function handleCreate(queueOps, context, startedAt) {
    const { type, payload, priority, scheduledAt } = context.options;
    if (!type) {
        return {
            success: false,
            message: 'Missing required option: --type',
            errors: ['Task creation requires a --type option'],
            executionTime: Date.now() - startedAt,
        };
    }
    let parsedPayload = {};
    if (payload) {
        try {
            parsedPayload = JSON.parse(payload);
        }
        catch (error) {
            return {
                success: false,
                message: 'Invalid JSON payload',
                errors: ['Payload must be valid JSON'],
                executionTime: Date.now() - startedAt,
            };
        }
    }
    const definition = {
        type,
        priority: toInteger(priority, 5),
        payload: parsedPayload,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    };
    const enqueueResult = await queueOps.enqueueTask(definition);
    const data = {
        taskId: enqueueResult.taskId,
        queuePosition: enqueueResult.queuePosition ?? null,
        estimatedStartTime: enqueueResult.estimatedStartTime?.toISOString(),
        scheduledAt: enqueueResult.scheduledAt?.toISOString(),
    };
    if (context.json) {
        return {
            success: true,
            data,
            executionTime: Date.now() - startedAt,
        };
    }
    return {
        success: true,
        message: `Task ${data.taskId} queued successfully`,
        data: context.verbose ? data : undefined,
        executionTime: Date.now() - startedAt,
    };
}
async function handleList(queueOps, context, startedAt) {
    const options = context.options;
    const statuses = Array.isArray(options.status) ? options.status : undefined;
    const tasks = await queueOps.listTasks();
    const filtered = statuses && statuses.length ? tasks.filter((task) => statuses.includes(task.status)) : tasks;
    if (context.json) {
        return {
            success: true,
            data: { total: filtered.length, tasks: filtered },
            executionTime: Date.now() - startedAt,
        };
    }
    if (filtered.length === 0) {
        return {
            success: true,
            message: 'No tasks in queue',
            executionTime: Date.now() - startedAt,
        };
    }
    const lines = filtered.map((task) => {
        const createdAt = new Date(task.createdAt).toISOString();
        return `${task.id} [${task.status}] ${task.type} (${createdAt})`;
    });
    return {
        success: true,
        message: lines.join('\n'),
        executionTime: Date.now() - startedAt,
    };
}
async function handleStatus(queueOps, context, taskId, startedAt) {
    if (!taskId) {
        return {
            success: false,
            message: 'Task ID is required',
            errors: ['Provide a task id, e.g. codex-father task status <id>'],
            executionTime: Date.now() - startedAt,
        };
    }
    const task = await queueOps.getTask(taskId);
    if (!task) {
        return {
            success: false,
            message: `Task not found: ${taskId}`,
            errors: ['No task with given id'],
            executionTime: Date.now() - startedAt,
        };
    }
    if (context.json) {
        return {
            success: true,
            data: task,
            executionTime: Date.now() - startedAt,
        };
    }
    const lines = [
        `Task: ${task.id}`,
        `Status: ${task.status}`,
        `Type: ${task.type}`,
        `Created: ${task.createdAt}`,
        task.updatedAt ? `Updated: ${task.updatedAt}` : null,
        task.result ? `Result: ${JSON.stringify(task.result)}` : null,
        task.lastError ? `Last Error: ${task.lastError}` : null,
    ].filter(Boolean);
    return {
        success: true,
        message: lines.join('\n'),
        executionTime: Date.now() - startedAt,
    };
}
async function handleCancel(queueOps, context, taskId, startedAt) {
    if (!taskId) {
        return {
            success: false,
            message: 'Task ID is required for cancel action',
            errors: ['Provide a task id to cancel'],
            executionTime: Date.now() - startedAt,
        };
    }
    const { reason } = context.options;
    const result = await queueOps.cancelTask(taskId, reason);
    if (!result.cancelled) {
        return {
            success: false,
            message: `Unable to cancel task ${taskId}`,
            errors: [result.reason ?? 'Unknown reason'],
            executionTime: Date.now() - startedAt,
        };
    }
    if (context.json) {
        return {
            success: true,
            data: result,
            executionTime: Date.now() - startedAt,
        };
    }
    return {
        success: true,
        message: `Task ${taskId} cancelled`,
        executionTime: Date.now() - startedAt,
    };
}
async function handleRetry(queueOps, context, taskId, startedAt) {
    if (!taskId) {
        return {
            success: false,
            message: 'Task ID is required for retry action',
            errors: ['Provide a task id to retry'],
            executionTime: Date.now() - startedAt,
        };
    }
    const result = await queueOps.retryTask(taskId);
    if (!result.retryScheduled) {
        return {
            success: false,
            message: `Unable to schedule retry for ${taskId}`,
            errors: [result.reason ?? 'Retry scheduling failed'],
            executionTime: Date.now() - startedAt,
        };
    }
    if (context.json) {
        return {
            success: true,
            data: {
                ...result,
                nextAttemptAt: result.nextAttemptAt?.toISOString(),
            },
            executionTime: Date.now() - startedAt,
        };
    }
    return {
        success: true,
        message: `Retry scheduled for ${taskId}`,
        executionTime: Date.now() - startedAt,
    };
}
async function handleStats(queueOps, context, startedAt) {
    const stats = await queueOps.getQueueStats();
    if (context.json) {
        return {
            success: true,
            data: stats,
            executionTime: Date.now() - startedAt,
        };
    }
    const lines = Object.entries(stats)
        .map(([status, count]) => `${status}: ${count}`)
        .join('\n');
    return {
        success: true,
        message: lines,
        executionTime: Date.now() - startedAt,
    };
}
function handleLogs(context, taskId, startedAt) {
    if (!taskId) {
        return {
            success: false,
            message: 'Task ID is required for logs action',
            errors: ['Provide a task id to inspect logs'],
            executionTime: Date.now() - startedAt,
        };
    }
    const logPath = join(context.workingDirectory, '.codex-father', 'queue', 'logs', `${taskId}.log`);
    return {
        success: true,
        message: `Logs stored at ${logPath}`,
        executionTime: Date.now() - startedAt,
    };
}
function toInteger(value, fallback) {
    if (value === undefined || value === null) {
        return fallback;
    }
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}
