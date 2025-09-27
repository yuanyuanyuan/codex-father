import type {
  QueueEvent,
  QueueEventData,
  QueueEventEmitter,
  QueueEventListener,
} from '../types.js';

const globalStructuredClone: ((value: unknown) => any) | undefined =
  typeof (globalThis as Record<string, any>).structuredClone === 'function'
    ? (globalThis as Record<string, any>).structuredClone.bind(globalThis)
    : undefined;

function cloneDetails<T>(details: T): T {
  if (globalStructuredClone) {
    return globalStructuredClone(details);
  }
  try {
    return JSON.parse(JSON.stringify(details));
  } catch {
    return details;
  }
}

function normalizeTimestamp(value: QueueEventData['timestamp'] | Date | string | number | undefined): Date {
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

export class QueueEventEmitterImpl implements QueueEventEmitter {
  private readonly listeners: Map<QueueEvent, Set<QueueEventListener>> = new Map();

  on(event: QueueEvent, listener: QueueEventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: QueueEvent, listener: QueueEventListener): void {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  emit(event: QueueEvent, data: Partial<QueueEventData> = {}): void {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.size === 0) {
      return;
    }

    const basePayload: QueueEventData = {
      event,
      timestamp: normalizeTimestamp(data.timestamp),
      taskId: data.taskId,
      details: cloneDetails(data.details ?? {}),
    };

    for (const listener of Array.from(listeners)) {
      try {
        const payloadForListener: QueueEventData = {
          event: basePayload.event,
          timestamp: basePayload.timestamp,
          taskId: basePayload.taskId,
          details: cloneDetails(basePayload.details),
        };
        listener(payloadForListener);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`Queue event listener for ${event} threw error:`, error);
      }
    }
  }
}
