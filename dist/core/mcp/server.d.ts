export interface MCPServerConfig {
    serverName?: string;
    serverVersion?: string;
    debug?: boolean;
}
export declare class MCPServer {
    private server;
    private transport;
    private processManager;
    private sessionManager;
    private bridgeLayer;
    private eventMapper;
    private config;
    constructor(config?: MCPServerConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    private registerHandlers;
    getServerInfo(): {
        name: string;
        version: string;
    };
}
export declare function createMCPServer(config?: MCPServerConfig): MCPServer;
export declare function startMCPServer(config?: MCPServerConfig): Promise<MCPServer>;
