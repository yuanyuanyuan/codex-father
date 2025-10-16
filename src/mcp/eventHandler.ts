import { JSONRPCRequest, JSONRPCResponse } from '../interfaces/json-rpc';

export interface CodexEvent {
  type: string;
  data: Record<string, any>;
  timestamp?: string;
}

export interface ParsedCodexEvent extends CodexEvent {
  id: string;
  source: string;
  version: string;
}

let notificationSink: ((event: JSONRPCResponse) => void) | null = null;

export function setNotificationSink(sink: ((event: JSONRPCResponse) => void) | null): void {
  notificationSink = sink;
}

export function parseCodexEvent(rawEvent: any): ParsedCodexEvent {
  if (!rawEvent || typeof rawEvent !== 'object') {
    throw new Error('Invalid codex event: must be an object');
  }

  if (!rawEvent.type || typeof rawEvent.type !== 'string') {
    throw new Error('Invalid codex event: type is required and must be a string');
  }

  // Support both flat format {type, ...data} and wrapped format {type, data}
  const data = rawEvent.data && typeof rawEvent.data === 'object' 
    ? rawEvent.data 
    : { ...rawEvent };
  delete data.type;
  delete data.timestamp;

  return {
    id: generateEventId(),
    type: rawEvent.type,
    data: data,
    source: 'codex-father',
    version: '1.0.0',
    timestamp: rawEvent.timestamp || new Date().toISOString(),
  };
}

export function emitMcpNotification(event: ParsedCodexEvent): void {
  if (!notificationSink) {
    console.warn('No notification sink set, event will be lost:', event);
    return;
  }

  const notification: JSONRPCResponse = {
    jsonrpc: '2.0',
    method: 'codex/event',
    params: event,
  };

  notificationSink(notification);
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createCodexEventHandler(
  eventType: string,
  handler: (event: ParsedCodexEvent) => void | Promise<void>
): (rawEvent: any) => Promise<void> {
  return async (rawEvent: any) => {
    try {
      const parsedEvent = parseCodexEvent(rawEvent);

      if (parsedEvent.type !== eventType) {
        return;
      }

      await handler(parsedEvent);
    } catch (error) {
      console.error(`Error handling codex event ${eventType}:`, error);
    }
  };
}
