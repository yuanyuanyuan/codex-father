const globalStructuredClone = typeof globalThis.structuredClone === 'function'
    ? globalThis.structuredClone.bind(globalThis)
    : undefined;
function cloneDetails(details) {
    if (globalStructuredClone) {
        return globalStructuredClone(details);
    }
    try {
        return JSON.parse(JSON.stringify(details));
    }
    catch {
        return details;
    }
}
function normalizeTimestamp(value) {
    if (!value) {
        return new Date();
    }
    if (value instanceof Date) {
        return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return new Date();
    }
    return parsed;
}
export class QueueEventEmitterImpl {
    listeners = new Map();
    on(event, listener) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(listener);
    }
    off(event, listener) {
        const listeners = this.listeners.get(event);
        if (!listeners) {
            return;
        }
        listeners.delete(listener);
        if (listeners.size === 0) {
            this.listeners.delete(event);
        }
    }
    emit(event, data = {}) {
        const listeners = this.listeners.get(event);
        if (!listeners || listeners.size === 0) {
            return;
        }
        const basePayload = {
            event,
            timestamp: normalizeTimestamp(data.timestamp),
            details: cloneDetails(data.details ?? {}),
            ...(data.taskId ? { taskId: data.taskId } : {}),
        };
        for (const listener of Array.from(listeners)) {
            try {
                const payloadForListener = {
                    event: basePayload.event,
                    timestamp: basePayload.timestamp,
                    details: cloneDetails(basePayload.details),
                    ...(basePayload.taskId ? { taskId: basePayload.taskId } : {}),
                };
                listener(payloadForListener);
            }
            catch (error) {
                console.warn(`Queue event listener for ${event} threw error:`, error);
            }
        }
    }
}
