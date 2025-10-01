import { ApprovalMode, ApprovalPolicy, WhitelistRule } from '../lib/types.js';
export interface ApprovalDecision {
    needsApproval: boolean;
    reason: string;
    matchedRule?: WhitelistRule;
}
export interface PolicyEngineConfig {
    policy: ApprovalPolicy;
    strictMode?: boolean;
}
export declare class PolicyEngine {
    private policy;
    private strictMode;
    private whitelistPatterns;
    constructor(config: PolicyEngineConfig);
    evaluateCommand(command: string, options?: {
        isCodexRequest?: boolean;
        isFailed?: boolean;
    }): ApprovalDecision;
    evaluateCommands(commands: string[], options?: {
        isCodexRequest?: boolean;
        isFailed?: boolean;
    }): ApprovalDecision[];
    private matchWhitelist;
    private compileWhitelist;
    private getDefaultReason;
    updatePolicy(policy: ApprovalPolicy): void;
    addWhitelistRule(rule: WhitelistRule): void;
    removeWhitelistRule(pattern: string): boolean;
    getPolicy(): ApprovalPolicy;
    getTimeout(): number | undefined;
}
export declare function createPolicyEngine(config: PolicyEngineConfig): PolicyEngine;
export declare function createDefaultPolicyEngine(mode?: ApprovalMode): PolicyEngine;
