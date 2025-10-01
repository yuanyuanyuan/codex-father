import { EventType } from '../lib/types.js';
import { MCPProgressEventType, createJSONRPCNotification, } from './protocol/types.js';
export class EventMapper {
    config;
    constructor(config) {
        this.config = {
            includeRawEvent: config?.includeRawEvent ?? false,
            debug: config?.debug ?? false,
        };
    }
    mapEvent(event, jobId) {
        if (this.config.debug) {
            console.log(`[EventMapper] Mapping event type: ${event.type}`);
        }
        const params = this.createProgressParams(event, jobId);
        return createJSONRPCNotification('codex-father/progress', params);
    }
    mapEvents(events, jobId) {
        return events.map((event) => this.mapEvent(event, jobId));
    }
    createProgressParams(event, jobId) {
        const baseParams = {
            jobId,
            eventType: this.mapEventType(event.type),
            eventData: this.extractEventData(event),
            timestamp: event.timestamp.toISOString(),
        };
        if (this.config.includeRawEvent) {
            baseParams.eventData._raw = event;
        }
        return baseParams;
    }
    mapEventType(eventType) {
        switch (eventType) {
            case EventType.JOB_CREATED:
            case EventType.JOB_STARTED:
                return MCPProgressEventType.TASK_STARTED;
            case EventType.JOB_COMPLETED:
                return MCPProgressEventType.TASK_COMPLETE;
            case EventType.JOB_FAILED:
            case EventType.JOB_TIMEOUT:
                return MCPProgressEventType.TASK_ERROR;
            case EventType.JOB_CANCELLED:
                return MCPProgressEventType.TASK_COMPLETE;
            case EventType.SESSION_CREATED:
            case EventType.SESSION_ACTIVE:
                return MCPProgressEventType.TASK_STARTED;
            case EventType.SESSION_IDLE:
            case EventType.SESSION_RECOVERING:
                return MCPProgressEventType.AGENT_MESSAGE;
            case EventType.SESSION_TERMINATED:
                return MCPProgressEventType.TASK_COMPLETE;
            case EventType.PROCESS_STARTED:
            case EventType.PROCESS_RESTARTED:
                return MCPProgressEventType.TASK_STARTED;
            case EventType.PROCESS_CRASHED:
                return MCPProgressEventType.TASK_ERROR;
            case EventType.APPROVAL_REQUESTED:
                return MCPProgressEventType.APPROVAL_REQUIRED;
            case EventType.APPROVAL_APPROVED:
            case EventType.APPROVAL_DENIED:
            case EventType.APPROVAL_AUTO_APPROVED:
                return MCPProgressEventType.AGENT_MESSAGE;
            case EventType.CODEX_TASK_STARTED:
                return MCPProgressEventType.TASK_STARTED;
            case EventType.CODEX_AGENT_MESSAGE:
                return MCPProgressEventType.AGENT_MESSAGE;
            case EventType.CODEX_TASK_COMPLETE:
                return MCPProgressEventType.TASK_COMPLETE;
            case EventType.CODEX_TASK_ERROR:
                return MCPProgressEventType.TASK_ERROR;
            default:
                if (this.config.debug) {
                    console.warn(`[EventMapper] Unknown event type: ${eventType}, defaulting to agent-message`);
                }
                return MCPProgressEventType.AGENT_MESSAGE;
        }
    }
    extractEventData(event) {
        const baseData = {
            eventId: event.eventId,
            eventType: event.type,
            timestamp: event.timestamp.toISOString(),
            jobId: event.jobId,
            sessionId: event.sessionId,
        };
        if (event.data && typeof event.data === 'object') {
            Object.assign(baseData, event.data);
        }
        return baseData;
    }
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config,
        };
    }
    getConfig() {
        return { ...this.config };
    }
}
export function createEventMapper(config) {
    return new EventMapper(config);
}
export function mapEvent(event, jobId) {
    const mapper = createEventMapper();
    return mapper.mapEvent(event, jobId);
}
