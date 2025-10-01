import type { QueueEvent, QueueEventData, QueueEventEmitter, QueueEventListener } from '../types.js';
export declare class QueueEventEmitterImpl implements QueueEventEmitter {
    private readonly listeners;
    on(event: QueueEvent, listener: QueueEventListener): void;
    off(event: QueueEvent, listener: QueueEventListener): void;
    emit(event: QueueEvent, data?: Partial<QueueEventData>): void;
}
