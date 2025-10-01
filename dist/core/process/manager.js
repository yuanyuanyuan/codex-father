import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { createCodexClient } from '../mcp/codex-client.js';
export var ProcessManagerStatus;
(function (ProcessManagerStatus) {
    ProcessManagerStatus["STOPPED"] = "stopped";
    ProcessManagerStatus["STARTING"] = "starting";
    ProcessManagerStatus["READY"] = "ready";
    ProcessManagerStatus["RESTARTING"] = "restarting";
})(ProcessManagerStatus || (ProcessManagerStatus = {}));
export class SingleProcessManager extends EventEmitter {
    config;
    status;
    process;
    client;
    healthCheckTimer;
    restartAttempts;
    constructor(config = {}) {
        super();
        this.config = {
            codexCommand: config.codexCommand || 'codex',
            codexArgs: config.codexArgs || ['mcp'],
            cwd: config.cwd || process.cwd(),
            healthCheckInterval: config.healthCheckInterval || 30000,
            maxRestartAttempts: config.maxRestartAttempts || 3,
            restartDelay: config.restartDelay || 1000,
            timeout: config.timeout || 30000,
            debug: config.debug || false,
        };
        this.status = ProcessManagerStatus.STOPPED;
        this.process = null;
        this.client = null;
        this.healthCheckTimer = null;
        this.restartAttempts = 0;
    }
    async start() {
        if (this.status !== ProcessManagerStatus.STOPPED) {
            throw new Error(`Cannot start: current status is ${this.status}`);
        }
        this.status = ProcessManagerStatus.STARTING;
        this.emit('starting');
        try {
            await this.spawnProcess();
            this.startHealthCheck();
            this.status = ProcessManagerStatus.READY;
            this.restartAttempts = 0;
            this.emit('ready');
            if (this.config.debug) {
                console.log('[ProcessManager] Started successfully');
            }
        }
        catch (error) {
            this.status = ProcessManagerStatus.STOPPED;
            this.emit('error', error);
            throw error;
        }
    }
    async stop() {
        if (this.status === ProcessManagerStatus.STOPPED) {
            return;
        }
        if (this.config.debug) {
            console.log('[ProcessManager] Stopping...');
        }
        this.stopHealthCheck();
        if (this.client) {
            this.client.close();
            this.client = null;
        }
        if (this.process) {
            this.process.kill('SIGTERM');
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    if (this.process && !this.process.killed) {
                        this.process.kill('SIGKILL');
                    }
                    resolve();
                }, 5000);
                this.process?.once('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
            this.process = null;
        }
        this.status = ProcessManagerStatus.STOPPED;
        this.emit('stopped');
        if (this.config.debug) {
            console.log('[ProcessManager] Stopped');
        }
    }
    async restart() {
        if (this.restartAttempts >= this.config.maxRestartAttempts) {
            const error = new Error(`Max restart attempts (${this.config.maxRestartAttempts}) reached`);
            this.emit('error', error);
            throw error;
        }
        this.restartAttempts++;
        this.status = ProcessManagerStatus.RESTARTING;
        this.emit('restarting', this.restartAttempts);
        if (this.config.debug) {
            console.log(`[ProcessManager] Restarting (attempt ${this.restartAttempts}/${this.config.maxRestartAttempts})...`);
        }
        await this.stop();
        await new Promise((resolve) => setTimeout(resolve, this.config.restartDelay));
        await this.start();
    }
    getClient() {
        if (!this.client) {
            throw new Error('CodexClient is not available (process not started)');
        }
        return this.client;
    }
    isReady() {
        return this.status === ProcessManagerStatus.READY && this.client !== null;
    }
    getStatus() {
        return this.status;
    }
    getPid() {
        return this.process?.pid;
    }
    async spawnProcess() {
        if (this.config.debug) {
            console.log(`[ProcessManager] Spawning: ${this.config.codexCommand} ${this.config.codexArgs.join(' ')}`);
        }
        this.process = spawn(this.config.codexCommand, this.config.codexArgs, {
            cwd: this.config.cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        if (!this.process.pid) {
            throw new Error('Failed to spawn Codex process (no PID)');
        }
        this.client = createCodexClient({
            stdin: this.process.stdin,
            stdout: this.process.stdout,
            timeout: this.config.timeout,
            debug: this.config.debug,
        });
        this.process.on('error', (error) => {
            console.error('[ProcessManager] Process error:', error);
            this.emit('process-error', error);
        });
        this.process.on('exit', (code, signal) => {
            if (this.config.debug) {
                console.log(`[ProcessManager] Process exited: code=${code}, signal=${signal}`);
            }
            this.emit('process-exit', { code, signal });
            if (this.status !== ProcessManagerStatus.STOPPED) {
                this.restart().catch((error) => {
                    console.error('[ProcessManager] Auto-restart failed:', error);
                });
            }
        });
        if (this.config.debug && this.process.stderr) {
            this.process.stderr.on('data', (data) => {
                console.error('[Codex stderr]:', data.toString());
            });
        }
        this.client.on('error', (error) => {
            console.error('[ProcessManager] Client error:', error);
            this.emit('client-error', error);
        });
        this.client.on('close', () => {
            if (this.config.debug) {
                console.log('[ProcessManager] Client closed');
            }
            this.emit('client-close');
        });
        await new Promise((resolve) => setTimeout(resolve, 1000));
        if (this.config.debug) {
            console.log(`[ProcessManager] Process spawned successfully (PID: ${this.process.pid})`);
        }
    }
    startHealthCheck() {
        if (this.healthCheckTimer) {
            return;
        }
        this.healthCheckTimer = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
        if (this.config.debug) {
            console.log(`[ProcessManager] Health check started (interval: ${this.config.healthCheckInterval}ms)`);
        }
    }
    stopHealthCheck() {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
            if (this.config.debug) {
                console.log('[ProcessManager] Health check stopped');
            }
        }
    }
    performHealthCheck() {
        if (!this.process || this.process.killed || !this.process.pid) {
            if (this.config.debug) {
                console.warn('[ProcessManager] Health check failed: process not alive');
            }
            this.restart().catch((error) => {
                console.error('[ProcessManager] Health check restart failed:', error);
            });
        }
        else {
            if (this.config.debug) {
                console.log('[ProcessManager] Health check passed');
            }
        }
    }
}
export function createProcessManager(config) {
    return new SingleProcessManager(config);
}
