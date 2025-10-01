import inquirer from 'inquirer';
export class TerminalUI {
    config;
    constructor(config) {
        this.config = {
            showTimestamp: config?.showTimestamp ?? true,
            showCwd: config?.showCwd ?? true,
            ...(typeof config?.timeout === 'number' ? { timeout: config.timeout } : {}),
        };
    }
    async promptApproval(request) {
        console.log('\n╭─────────────────────────────────────────────────────╮');
        console.log('│  🔐 Approval Required - 需要审批                    │');
        console.log('╰─────────────────────────────────────────────────────╯\n');
        console.log(`📋 Request ID: ${request.requestId}`);
        if (this.config.showTimestamp) {
            console.log(`⏰ Timestamp:   ${request.createdAt.toLocaleString('zh-CN', {
                timeZone: 'Asia/Shanghai',
            })}`);
        }
        if (request.type === 'exec-command') {
            const details = request.details;
            if (this.config.showCwd && details.cwd) {
                console.log(`📁 Working Dir: ${details.cwd}`);
            }
            console.log(`\n💻 Command:\n   ${details.command}\n`);
            if (details.reason) {
                console.log(`📝 Reason: ${details.reason}\n`);
            }
        }
        else if (request.type === 'apply-patch') {
            const details = request.details;
            console.log(`\n📝 File Changes (${details.fileChanges.length}):\n`);
            for (const change of details.fileChanges.slice(0, 5)) {
                console.log(`   [${change.type}] ${change.path}`);
            }
            if (details.fileChanges.length > 5) {
                console.log(`   ... and ${details.fileChanges.length - 5} more files\n`);
            }
            else {
                console.log('');
            }
        }
        const answer = await this.collectDecisionWithTimeout(request);
        return answer;
    }
    async promptBatchApproval(requests) {
        const decisions = [];
        for (const request of requests) {
            const decision = await this.promptApproval(request);
            decisions.push(decision);
            if (decision === 'deny') {
                const { continueProcessing } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'continueProcessing',
                        message: 'Continue processing remaining approvals?',
                        default: false,
                    },
                ]);
                if (!continueProcessing) {
                    break;
                }
            }
        }
        return decisions;
    }
    async collectDecisionWithTimeout(_request) {
        if (typeof this.config.timeout !== 'number') {
            return this.collectDecision();
        }
        return Promise.race([
            this.collectDecision(),
            this.createTimeoutPromise(this.config.timeout),
        ]);
    }
    async collectDecision() {
        const { decision } = await inquirer.prompt([
            {
                type: 'list',
                name: 'decision',
                message: 'What would you like to do?',
                choices: [
                    {
                        name: '✅ Approve - 批准此次操作',
                        value: 'allow',
                        short: 'Approve',
                    },
                    {
                        name: '❌ Deny - 拒绝此次操作',
                        value: 'deny',
                        short: 'Deny',
                    },
                    {
                        name: '⏭️  Whitelist - 批准并添加到白名单',
                        value: 'whitelist',
                        short: 'Whitelist',
                    },
                ],
                default: 'deny',
            },
        ]);
        this.displayDecisionResult(decision);
        return decision;
    }
    createTimeoutPromise(timeout) {
        return new Promise((_, reject) => {
            setTimeout(() => {
                console.log(`\n⏱️  Approval timeout (${timeout}ms) - 自动拒绝\n`);
                reject(new Error(`Approval timeout after ${timeout}ms`));
            }, timeout);
        });
    }
    displayDecisionResult(decision) {
        console.log('');
        switch (decision) {
            case 'allow':
                console.log('✅ Decision: Approved - 已批准');
                break;
            case 'deny':
                console.log('❌ Decision: Denied - 已拒绝');
                break;
            case 'whitelist':
                console.log('⏭️  Decision: Whitelisted - 已添加到白名单');
                break;
        }
        console.log('');
    }
    updateConfig(config) {
        this.config = {
            ...this.config,
            ...config,
        };
    }
    getConfig() {
        return { ...this.config };
    }
}
export function createTerminalUI(config) {
    return new TerminalUI(config);
}
export async function promptApproval(request) {
    const ui = createTerminalUI();
    return ui.promptApproval(request);
}
