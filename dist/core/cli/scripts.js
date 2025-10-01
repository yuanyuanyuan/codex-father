import { resolve, dirname } from 'path';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
function findProjectRoot() {
    let currentDir = process.cwd();
    while (currentDir !== dirname(currentDir)) {
        if (existsSync(resolve(currentDir, 'package.json')) ||
            existsSync(resolve(currentDir, '.git'))) {
            return currentDir;
        }
        currentDir = dirname(currentDir);
    }
    return process.cwd();
}
const PROJECT_ROOT = findProjectRoot();
export const LEGACY_SCRIPTS = {
    start: resolve(PROJECT_ROOT, 'start.sh'),
    job: resolve(PROJECT_ROOT, 'job.sh'),
    runTests: resolve(PROJECT_ROOT, 'run_tests.sh'),
    common: resolve(PROJECT_ROOT, 'lib/common.sh'),
    presets: resolve(PROJECT_ROOT, 'lib/presets.sh'),
    updateAgentContext: resolve(PROJECT_ROOT, '.specify/scripts/bash/update-agent-context.sh'),
    checkPrerequisites: resolve(PROJECT_ROOT, '.specify/scripts/bash/check-prerequisites.sh'),
    createNewFeature: resolve(PROJECT_ROOT, '.specify/scripts/bash/create-new-feature.sh'),
};
const DEFAULT_TIMEOUTS = {
    start: 600000,
    job: 1800000,
    runTests: 900000,
    default: 600000,
};
function getScriptTimeout(scriptPath, customTimeout) {
    if (customTimeout !== undefined) {
        return customTimeout;
    }
    const envTimeout = process.env.CODEX_SCRIPT_TIMEOUT;
    if (envTimeout && !isNaN(Number(envTimeout))) {
        return Number(envTimeout);
    }
    if (scriptPath.includes('start.sh')) {
        return DEFAULT_TIMEOUTS.start;
    }
    if (scriptPath.includes('job.sh')) {
        return DEFAULT_TIMEOUTS.job;
    }
    if (scriptPath.includes('test')) {
        return DEFAULT_TIMEOUTS.runTests;
    }
    return DEFAULT_TIMEOUTS.default;
}
export async function executeScript(scriptPath, args = [], options = {}) {
    const startTime = Date.now();
    const { timeout = getScriptTimeout(scriptPath, options.timeout), captureOutput = true, workingDirectory = PROJECT_ROOT, ...spawnOptions } = options;
    return new Promise((resolve, reject) => {
        const child = spawn('bash', [scriptPath, ...args], {
            ...spawnOptions,
            cwd: workingDirectory,
            stdio: captureOutput ? 'pipe' : 'inherit',
        });
        let stdout = '';
        let stderr = '';
        if (captureOutput) {
            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
        }
        const timeoutId = setTimeout(() => {
            child.kill('SIGTERM');
            reject(new Error(`Script execution timed out after ${timeout}ms`));
        }, timeout);
        child.on('close', (code) => {
            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            resolve({
                success: code === 0,
                exitCode: code || 0,
                stdout,
                stderr,
                duration,
            });
        });
        child.on('error', (error) => {
            clearTimeout(timeoutId);
            reject(error);
        });
    });
}
export class LegacyScriptRunner {
    static async start(args = [], options) {
        return executeScript(LEGACY_SCRIPTS.start, args, options);
    }
    static async job(args = [], options) {
        return executeScript(LEGACY_SCRIPTS.job, args, options);
    }
    static async runTests(args = [], options) {
        return executeScript(LEGACY_SCRIPTS.runTests, args, options);
    }
    static async updateAgentContext(agent = 'claude', options) {
        return executeScript(LEGACY_SCRIPTS.updateAgentContext, [agent], options);
    }
    static async checkPrerequisites(flags = ['--json'], options) {
        return executeScript(LEGACY_SCRIPTS.checkPrerequisites, flags, options);
    }
    static async createNewFeature(featureName, options) {
        return executeScript(LEGACY_SCRIPTS.createNewFeature, [featureName], options);
    }
}
export const MIGRATION_STATUS = {
    migrated: new Set([]),
    planned: new Set(['start.sh', 'job.sh', 'lib/common.sh', 'lib/presets.sh']),
    keepAsShell: new Set([
        'run_tests.sh',
        '.specify/scripts/bash/update-agent-context.sh',
        '.specify/scripts/bash/check-prerequisites.sh',
        '.specify/scripts/bash/create-new-feature.sh',
    ]),
};
export async function checkScriptStatus(scriptPath) {
    try {
        const { access, constants } = await import('fs/promises');
        let exists = true;
        try {
            await access(scriptPath, constants.F_OK);
        }
        catch {
            exists = false;
        }
        let executable = false;
        if (exists) {
            try {
                await access(scriptPath, constants.X_OK);
                executable = true;
            }
            catch {
                executable = false;
            }
        }
        return { exists, executable };
    }
    catch {
        return { exists: false, executable: false };
    }
}
export async function validateScript(scriptPath) {
    const { exists, executable } = await checkScriptStatus(scriptPath);
    return exists && executable;
}
export async function getScriptStatus() {
    const status = {};
    for (const [name, path] of Object.entries(LEGACY_SCRIPTS)) {
        const { exists, executable } = await checkScriptStatus(path);
        const relativePath = path.replace(PROJECT_ROOT + '/', '');
        let migrationStatus = 'unknown';
        if (MIGRATION_STATUS.migrated.has(relativePath)) {
            migrationStatus = 'migrated';
        }
        else if (MIGRATION_STATUS.planned.has(relativePath)) {
            migrationStatus = 'planned';
        }
        else if (MIGRATION_STATUS.keepAsShell.has(relativePath)) {
            migrationStatus = 'keepAsShell';
        }
        status[name] = {
            path,
            exists,
            executable,
            migrationStatus,
        };
    }
    return status;
}
