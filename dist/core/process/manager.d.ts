/// <reference types="node" resolution-mode="require"/>
import { EventEmitter } from 'events';
import { CodexClient } from '../mcp/codex-client.js';
export declare enum ProcessManagerStatus {
    STOPPED = "stopped",
    STARTING = "starting",
    READY = "ready",
    RESTARTING = "restarting"
}
export interface ProcessManagerConfig {
    codexCommand?: string;
    codexArgs?: string[];
    cwd?: string;
    healthCheckInterval?: number;
    maxRestartAttempts?: number;
    restartDelay?: number;
    timeout?: number;
    debug?: boolean;
}
export declare class SingleProcessManager extends EventEmitter {
    private config;
    private status;
    private process;
    private client;
    private healthCheckTimer;
    private restartAttempts;
    constructor(config?: ProcessManagerConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    restart(): Promise<void>;
    getClient(): CodexClient;
    isReady(): boolean;
    getStatus(): ProcessManagerStatus;
    getPid(): number | undefined;
    private spawnProcess;
    private startHealthCheck;
    private stopHealthCheck;
    private performHealthCheck;
}
export declare function createProcessManager(config?: ProcessManagerConfig): SingleProcessManager;
