import { ApprovalRequest } from '../lib/types.js';
export type ApprovalDecision = 'allow' | 'deny' | 'whitelist';
export interface TerminalUIConfig {
    showTimestamp?: boolean;
    showCwd?: boolean;
    timeout?: number;
}
export declare class TerminalUI {
    private config;
    constructor(config?: TerminalUIConfig);
    promptApproval(request: ApprovalRequest): Promise<ApprovalDecision>;
    promptBatchApproval(requests: ApprovalRequest[]): Promise<ApprovalDecision[]>;
    private collectDecisionWithTimeout;
    private collectDecision;
    private createTimeoutPromise;
    private displayDecisionResult;
    updateConfig(config: Partial<TerminalUIConfig>): void;
    getConfig(): TerminalUIConfig;
}
export declare function createTerminalUI(config?: TerminalUIConfig): TerminalUI;
export declare function promptApproval(request: ApprovalRequest): Promise<ApprovalDecision>;
