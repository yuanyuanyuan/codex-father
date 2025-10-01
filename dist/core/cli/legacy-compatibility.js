import { LegacyScriptRunner } from './scripts.js';
export function adaptScriptResult(scriptResult) {
    return {
        success: scriptResult.success,
        message: scriptResult.success ? 'Command executed successfully' : 'Command failed',
        data: {
            stdout: scriptResult.stdout,
            stderr: scriptResult.stderr,
            duration: scriptResult.duration,
        },
        errors: scriptResult.success ? [] : [scriptResult.stderr || 'Unknown error'],
        warnings: scriptResult.stderr && scriptResult.success ? [scriptResult.stderr] : [],
        executionTime: scriptResult.duration,
    };
}
export class LegacyCommandHandler {
    static async handleStart(context) {
        try {
            const result = await LegacyScriptRunner.start(context.args, {
                workingDirectory: context.workingDirectory,
                captureOutput: !context.verbose,
            });
            return adaptScriptResult(result);
        }
        catch (error) {
            return {
                success: false,
                message: 'Failed to execute start command',
                errors: [error instanceof Error ? error.message : String(error)],
                executionTime: 0,
            };
        }
    }
    static async handleJob(context) {
        try {
            const result = await LegacyScriptRunner.job(context.args, {
                workingDirectory: context.workingDirectory,
                captureOutput: !context.verbose,
            });
            return adaptScriptResult(result);
        }
        catch (error) {
            return {
                success: false,
                message: 'Failed to execute job command',
                errors: [error instanceof Error ? error.message : String(error)],
                executionTime: 0,
            };
        }
    }
    static async handleTest(context) {
        try {
            const result = await LegacyScriptRunner.runTests(context.args, {
                workingDirectory: context.workingDirectory,
                captureOutput: !context.verbose,
            });
            return adaptScriptResult(result);
        }
        catch (error) {
            return {
                success: false,
                message: 'Failed to execute test command',
                errors: [error instanceof Error ? error.message : String(error)],
                executionTime: 0,
            };
        }
    }
}
export function shouldUseLegacyHandler(command) {
    const legacyCommands = new Set(['start', 'job', 'test', 'run-tests']);
    return legacyCommands.has(command);
}
export async function routeLegacyCommand(command, context) {
    if (!shouldUseLegacyHandler(command)) {
        return null;
    }
    switch (command) {
        case 'start':
            return LegacyCommandHandler.handleStart(context);
        case 'job':
            return LegacyCommandHandler.handleJob(context);
        case 'test':
        case 'run-tests':
            return LegacyCommandHandler.handleTest(context);
        default:
            return null;
    }
}
export async function createLegacyLinks() {
    console.log('Legacy scripts maintained in original locations for compatibility');
}
export async function validateLegacyScripts() {
    const { getScriptStatus } = await import('./scripts.js');
    const status = await getScriptStatus();
    const missing = [];
    const issues = [];
    for (const [name, info] of Object.entries(status)) {
        if (!info.exists) {
            missing.push(name);
        }
        else if (!info.executable) {
            issues.push(`Script ${name} exists but is not executable`);
        }
    }
    return {
        valid: missing.length === 0 && issues.length === 0,
        missing,
        issues,
    };
}
