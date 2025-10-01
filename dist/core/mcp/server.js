import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createProcessManager } from '../process/manager.js';
import { createSessionManager } from '../session/session-manager.js';
import { createBridgeLayer } from './bridge-layer.js';
import { createEventMapper } from './event-mapper.js';
export class MCPServer {
    server;
    transport;
    processManager;
    sessionManager;
    bridgeLayer;
    eventMapper;
    config;
    constructor(config = {}) {
        this.config = {
            serverName: config.serverName || 'codex-father',
            serverVersion: config.serverVersion || '1.0.0-mvp1',
            debug: config.debug || false,
        };
        this.server = new Server({
            name: this.config.serverName,
            version: this.config.serverVersion,
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.transport = new StdioServerTransport();
        this.processManager = createProcessManager({
            debug: this.config.debug,
        });
        this.sessionManager = createSessionManager({
            processManager: this.processManager,
        });
        this.bridgeLayer = createBridgeLayer({
            sessionManager: this.sessionManager,
        });
        this.eventMapper = createEventMapper({
            debug: this.config.debug,
        });
        this.registerHandlers();
    }
    async start() {
        if (this.config.debug) {
            console.log('[MCPServer] Starting...');
        }
        await this.processManager.start();
        await this.server.connect(this.transport);
        if (this.config.debug) {
            console.log(`[MCPServer] Started: ${this.config.serverName} v${this.config.serverVersion}`);
        }
    }
    async stop() {
        if (this.config.debug) {
            console.log('[MCPServer] Stopping...');
        }
        await this.sessionManager.cleanup();
        await this.server.close();
        if (this.config.debug) {
            console.log('[MCPServer] Stopped');
        }
    }
    registerHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            if (this.config.debug) {
                console.log('[MCPServer] Handling tools/list');
            }
            const tools = this.bridgeLayer.getTools();
            return {
                tools,
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (this.config.debug) {
                console.log('[MCPServer] Handling tools/call:', request.params.name);
            }
            const { name, arguments: args } = request.params;
            try {
                const result = await this.bridgeLayer.callTool(name, args || {});
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2),
                        },
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify({
                                error: {
                                    message: error.message,
                                    name: error.name,
                                },
                            }, null, 2),
                        },
                    ],
                    isError: true,
                };
            }
        });
        const codexClient = this.processManager.getClient();
        codexClient.on('notification', (notification) => {
            if (this.config.debug) {
                console.log('[MCPServer] Received Codex notification:', notification.method);
            }
            const jobId = 'placeholder-job-id';
            const mcpNotification = this.eventMapper.mapEvent({
                eventId: notification.params?.eventId || 'unknown',
                timestamp: new Date(),
                jobId,
                type: notification.params?.type || 'unknown',
                data: notification.params || {},
            }, jobId);
            this.server.notification({
                method: mcpNotification.method,
                params: mcpNotification.params,
            });
        });
        if (this.config.debug) {
            console.log('[MCPServer] Handlers registered');
        }
    }
    getServerInfo() {
        return {
            name: this.config.serverName,
            version: this.config.serverVersion,
        };
    }
}
export function createMCPServer(config) {
    return new MCPServer(config);
}
export async function startMCPServer(config) {
    const server = createMCPServer(config);
    await server.start();
    return server;
}
