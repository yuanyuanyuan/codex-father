import { Session, ApprovalMode, SandboxPolicy } from '../lib/types.js';
export interface SessionConfig {
    conversationId: string;
    sessionName: string;
    jobId: string;
    createdAt: string;
    rolloutRef: string;
    processId?: number;
    config: {
        model: string;
        cwd: string;
        approvalPolicy: ApprovalMode;
        sandboxPolicy: SandboxPolicy;
        timeout: number;
    };
}
export interface ConfigPersisterConfig {
    sessionDir: string;
    configFileName?: string;
    validateConfig?: boolean;
    atomicWrite?: boolean;
}
export declare class ConfigPersister {
    private configFilePath;
    private config;
    constructor(config: ConfigPersisterConfig);
    saveConfig(session: Session): Promise<void>;
    loadConfig(): Promise<Session>;
    configExists(): Promise<boolean>;
    deleteConfig(): Promise<void>;
    updateRolloutRef(rolloutPath: string): Promise<void>;
    getConfigFilePath(): string;
    private atomicWriteFile;
    private ensureSessionDirExists;
    private inferSessionStatus;
}
export declare function createConfigPersister(config: ConfigPersisterConfig): ConfigPersister;
export declare function saveRolloutRef(sessionDir: string, rolloutPath: string): Promise<void>;
export declare function loadRolloutRef(sessionDir: string): Promise<string>;
