import { Event, EventType } from '../lib/types.js';
export interface EventLoggerConfig {
    logDir: string;
    logFileName?: string;
    autoFlush?: boolean;
    validateEvents?: boolean;
}
export interface LogEventOptions {
    skipValidation?: boolean;
}
export declare class EventLogger {
    private logFilePath;
    private config;
    private writeLock;
    constructor(config: EventLoggerConfig);
    logEvent(event: Omit<Event, 'eventId' | 'timestamp'>, options?: LogEventOptions): Promise<string>;
    logEvents(events: Omit<Event, 'eventId' | 'timestamp'>[]): Promise<string[]>;
    readAllEvents(): Promise<Event[]>;
    filterEventsByType(eventType: EventType): Promise<Event[]>;
    filterEventsByJobId(jobId: string): Promise<Event[]>;
    getEventCount(): Promise<number>;
    clearLogs(): Promise<void>;
    private writeEventToFile;
    private ensureLogDirExists;
    getLogFilePath(): string;
}
export declare function createEventLogger(config: EventLoggerConfig): EventLogger;
