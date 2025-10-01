import { ApprovalMode, getDefaultWhitelist } from '../lib/types.js';
export class PolicyEngine {
    policy;
    strictMode;
    whitelistPatterns;
    constructor(config) {
        this.policy = config.policy;
        this.strictMode = config.strictMode ?? true;
        this.whitelistPatterns = this.compileWhitelist(this.policy.whitelist);
    }
    evaluateCommand(command, options) {
        const isCodexRequest = options?.isCodexRequest ?? false;
        const isFailed = options?.isFailed ?? false;
        switch (this.policy.mode) {
            case ApprovalMode.NEVER:
                return {
                    needsApproval: false,
                    reason: 'Approval mode is NEVER (all commands auto-approved)',
                };
            case ApprovalMode.ON_FAILURE:
                if (!isFailed) {
                    return {
                        needsApproval: false,
                        reason: 'Approval mode is ON_FAILURE, and command has not failed',
                    };
                }
                break;
            case ApprovalMode.ON_REQUEST:
                if (!isCodexRequest) {
                    return {
                        needsApproval: false,
                        reason: 'Approval mode is ON_REQUEST, and Codex did not request approval',
                    };
                }
                break;
            case ApprovalMode.UNTRUSTED:
                break;
            default:
                if (this.strictMode) {
                    return {
                        needsApproval: true,
                        reason: `Unknown approval mode: ${this.policy.mode} (strict mode enabled)`,
                    };
                }
                return {
                    needsApproval: false,
                    reason: `Unknown approval mode: ${this.policy.mode} (strict mode disabled)`,
                };
        }
        const matchedRule = this.matchWhitelist(command);
        if (matchedRule) {
            return {
                needsApproval: false,
                reason: `Matched whitelist rule: ${matchedRule.reason}`,
                matchedRule,
            };
        }
        if (this.policy.autoApprovePatterns) {
            for (const pattern of this.policy.autoApprovePatterns) {
                if (pattern.test(command)) {
                    return {
                        needsApproval: false,
                        reason: `Matched auto-approve pattern: ${pattern.source}`,
                    };
                }
            }
        }
        return {
            needsApproval: true,
            reason: this.getDefaultReason(),
        };
    }
    evaluateCommands(commands, options) {
        return commands.map((command) => this.evaluateCommand(command, options));
    }
    matchWhitelist(command) {
        for (const { rule, regex } of this.whitelistPatterns) {
            if (rule.enabled && regex.test(command)) {
                return rule;
            }
        }
        return undefined;
    }
    compileWhitelist(whitelist) {
        const compiled = [];
        for (const rule of whitelist) {
            try {
                const regex = new RegExp(rule.pattern);
                compiled.push({ rule, regex });
            }
            catch (error) {
                if (this.strictMode) {
                    throw new Error(`Invalid regex pattern in whitelist: "${rule.pattern}" - ${error.message}`);
                }
                console.warn(`Skipping invalid regex pattern in whitelist: "${rule.pattern}"`, error);
            }
        }
        return compiled;
    }
    getDefaultReason() {
        switch (this.policy.mode) {
            case ApprovalMode.UNTRUSTED:
                return 'Command not in whitelist (untrusted mode)';
            case ApprovalMode.ON_REQUEST:
                return 'Codex requested approval for this command';
            case ApprovalMode.ON_FAILURE:
                return 'Command failed and requires approval to retry';
            default:
                return 'Command requires approval';
        }
    }
    updatePolicy(policy) {
        this.policy = policy;
        this.whitelistPatterns = this.compileWhitelist(policy.whitelist);
    }
    addWhitelistRule(rule) {
        this.policy.whitelist.push(rule);
        this.whitelistPatterns = this.compileWhitelist(this.policy.whitelist);
    }
    removeWhitelistRule(pattern) {
        const initialLength = this.policy.whitelist.length;
        this.policy.whitelist = this.policy.whitelist.filter((rule) => rule.pattern !== pattern);
        if (this.policy.whitelist.length < initialLength) {
            this.whitelistPatterns = this.compileWhitelist(this.policy.whitelist);
            return true;
        }
        return false;
    }
    getPolicy() {
        return { ...this.policy };
    }
    getTimeout() {
        return this.policy.timeout;
    }
}
export function createPolicyEngine(config) {
    return new PolicyEngine(config);
}
export function createDefaultPolicyEngine(mode = ApprovalMode.ON_REQUEST) {
    return new PolicyEngine({
        policy: {
            mode,
            whitelist: getDefaultWhitelist(),
        },
        strictMode: true,
    });
}
