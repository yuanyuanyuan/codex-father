import { Event } from '../lib/types.js';
import { MCPProgressNotification } from './protocol/types.js';
export interface EventMapperConfig {
    includeRawEvent?: boolean;
    debug?: boolean;
}
export declare class EventMapper {
    private config;
    constructor(config?: EventMapperConfig);
    mapEvent(event: Event, jobId: string): MCPProgressNotification;
    mapEvents(events: Event[], jobId: string): MCPProgressNotification[];
    private createProgressParams;
    private mapEventType;
    private extractEventData;
    updateConfig(config: Partial<EventMapperConfig>): void;
    getConfig(): EventMapperConfig;
}
export declare function createEventMapper(config?: EventMapperConfig): EventMapper;
export declare function mapEvent(event: Event, jobId: string): MCPProgressNotification;
