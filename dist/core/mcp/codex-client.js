import { EventEmitter } from 'events';
import * as readline from 'readline';
import { isJSONRPCResponse, isJSONRPCNotification, } from './protocol/types.js';
export class CodexClient extends EventEmitter {
    stdin;
    stdout;
    rl;
    pendingRequests;
    nextId;
    timeout;
    debug;
    closed;
    constructor(config) {
        super();
        this.stdin = config.stdin;
        this.stdout = config.stdout;
        this.timeout = config.timeout ?? 30000;
        this.debug = config.debug ?? false;
        this.pendingRequests = new Map();
        this.nextId = 1;
        this.closed = false;
        this.rl = readline.createInterface({
            input: this.stdout,
            crlfDelay: Infinity,
        });
        this.rl.on('line', (line) => {
            this.handleLine(line);
        });
        this.rl.on('close', () => {
            this.handleClose();
        });
    }
    async newConversation(params) {
        const result = await this.request('newConversation', params);
        return result;
    }
    async sendUserMessage(params) {
        const result = await this.request('sendUserMessage', params);
        return result;
    }
    async request(method, params) {
        if (this.closed) {
            throw new Error('CodexClient is closed');
        }
        const id = this.nextId++;
        const request = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method} (id: ${id})`));
            }, this.timeout);
            this.pendingRequests.set(id, {
                resolve: resolve,
                reject,
                timer,
            });
            const line = JSON.stringify(request);
            if (this.debug) {
                console.log('[CodexClient] Sending request:', line);
            }
            this.stdin.write(line + '\n');
        });
    }
    notify(method, params) {
        if (this.closed) {
            throw new Error('CodexClient is closed');
        }
        const notification = {
            jsonrpc: '2.0',
            method,
            params,
        };
        const line = JSON.stringify(notification);
        if (this.debug) {
            console.log('[CodexClient] Sending notification:', line);
        }
        this.stdin.write(line + '\n');
    }
    close() {
        if (this.closed) {
            return;
        }
        this.closed = true;
        const pendingEntries = Array.from(this.pendingRequests.entries());
        for (const [id, pending] of pendingEntries) {
            clearTimeout(pending.timer);
            pending.reject(new Error(`CodexClient closed (request id: ${id})`));
        }
        this.pendingRequests.clear();
        this.rl.close();
        this.emit('close');
    }
    isClosed() {
        return this.closed;
    }
    handleLine(line) {
        if (this.debug) {
            console.log('[CodexClient] Received line:', line);
        }
        try {
            const message = JSON.parse(line);
            if (isJSONRPCResponse(message)) {
                this.handleResponse(message);
                return;
            }
            if (isJSONRPCNotification(message)) {
                this.handleNotification(message);
                return;
            }
            if (this.debug) {
                console.warn('[CodexClient] Unknown message type:', message);
            }
        }
        catch (error) {
            console.error('[CodexClient] Failed to parse line:', line, error);
            this.emit('error', new Error(`Failed to parse JSON: ${line}`));
        }
    }
    handleResponse(response) {
        const pending = this.pendingRequests.get(response.id);
        if (!pending) {
            if (this.debug) {
                console.warn('[CodexClient] Received response for unknown id:', response.id);
            }
            return;
        }
        clearTimeout(pending.timer);
        this.pendingRequests.delete(response.id);
        if (response.error) {
            pending.reject(new Error(`JSON-RPC error (code: ${response.error.code}): ${response.error.message}`));
            return;
        }
        pending.resolve(response.result);
    }
    handleNotification(notification) {
        this.emit('notification', notification);
        this.emit(notification.method, notification.params);
    }
    handleClose() {
        if (!this.closed) {
            this.close();
        }
    }
}
export function createCodexClient(config) {
    return new CodexClient(config);
}
