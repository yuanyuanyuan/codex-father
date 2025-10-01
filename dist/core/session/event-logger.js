import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EventSchema } from '../lib/types.js';
export class EventLogger {
    logFilePath;
    config;
    writeLock = Promise.resolve();
    constructor(config) {
        this.config = {
            logDir: config.logDir,
            logFileName: config.logFileName || 'events.jsonl',
            autoFlush: config.autoFlush ?? true,
            validateEvents: config.validateEvents ?? true,
        };
        this.logFilePath = path.join(this.config.logDir, this.config.logFileName);
    }
    async logEvent(event, options) {
        const fullEvent = {
            eventId: uuidv4(),
            timestamp: new Date(),
            ...event,
        };
        if (this.config.validateEvents && !options?.skipValidation) {
            const result = EventSchema.safeParse(fullEvent);
            if (!result.success) {
                throw new Error(`Invalid event format: ${JSON.stringify(result.error.errors)}`);
            }
        }
        this.writeLock = this.writeLock.then(async () => {
            await this.writeEventToFile(fullEvent);
        });
        await this.writeLock;
        return fullEvent.eventId;
    }
    async logEvents(events) {
        const eventIds = [];
        for (const event of events) {
            const eventId = await this.logEvent(event, { skipValidation: false });
            eventIds.push(eventId);
        }
        return eventIds;
    }
    async readAllEvents() {
        try {
            const content = await fs.readFile(this.logFilePath, 'utf-8');
            const lines = content
                .trim()
                .split('\n')
                .filter((line) => line.length > 0);
            return lines.map((line) => {
                const parsed = JSON.parse(line);
                return {
                    ...parsed,
                    timestamp: new Date(parsed.timestamp),
                    ...(parsed.createdAt && { createdAt: new Date(parsed.createdAt) }),
                    ...(parsed.resolvedAt && { resolvedAt: new Date(parsed.resolvedAt) }),
                };
            });
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }
    async filterEventsByType(eventType) {
        const allEvents = await this.readAllEvents();
        return allEvents.filter((event) => event.type === eventType);
    }
    async filterEventsByJobId(jobId) {
        const allEvents = await this.readAllEvents();
        return allEvents.filter((event) => event.jobId === jobId);
    }
    async getEventCount() {
        try {
            const content = await fs.readFile(this.logFilePath, 'utf-8');
            const lines = content
                .trim()
                .split('\n')
                .filter((line) => line.length > 0);
            return lines.length;
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                return 0;
            }
            throw error;
        }
    }
    async clearLogs() {
        try {
            await fs.unlink(this.logFilePath);
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
    async writeEventToFile(event) {
        await this.ensureLogDirExists();
        const jsonLine = JSON.stringify(event, (_key, value) => {
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        });
        await fs.appendFile(this.logFilePath, jsonLine + '\n', 'utf-8');
    }
    async ensureLogDirExists() {
        try {
            await fs.mkdir(this.config.logDir, { recursive: true });
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    getLogFilePath() {
        return this.logFilePath;
    }
}
export function createEventLogger(config) {
    return new EventLogger(config);
}
