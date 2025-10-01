import { ErrorBoundary, withErrorBoundary, createError } from './error-boundary.js';
import { LoggerManager, setupDevelopmentLogging } from './logger-setup.js';
import { getConfig } from './config-loader.js';
import { parser } from './parser.js';
import { LegacyCommandHandler } from './legacy-compatibility.js';
import { registerTaskCommand } from './commands/task-command.js';
import { registerConfigCommand } from './commands/config-command.js';
import { registerQueueCommand } from './commands/queue-command.js';
import { registerMCPCommand } from './commands/mcp-command.js';
class CodexFatherCLI {
    initialized = false;
    async initialize() {
        if (this.initialized) {
            return;
        }
        await withErrorBoundary(async () => {
            ErrorBoundary.setup({
                verbose: process.env.NODE_ENV === 'development' || process.env.CODEX_VERBOSE === 'true',
                json: process.env.CODEX_JSON === 'true',
                exitOnError: process.env.NODE_ENV !== 'test',
            });
            const config = await getConfig();
            await LoggerManager.initialize(config.logging);
            if (process.env.NODE_ENV === 'development') {
                setupDevelopmentLogging();
            }
            this.registerLegacyCommands();
            this.registerModernCommands();
            this.initialized = true;
        }, { operation: 'CLI initialization' });
    }
    registerLegacyCommands() {
        parser.registerCommand('start', 'Execute start.sh script with TypeScript wrapper', async (context) => {
            return await LegacyCommandHandler.handleStart(context);
        }, {
            aliases: [],
            arguments: [
                { name: 'args', description: 'Arguments to pass to start.sh', required: false },
            ],
            options: [
                { flags: '--timeout <ms>', description: 'Execution timeout in milliseconds' },
                { flags: '--capture', description: 'Capture script output', defaultValue: true },
            ],
        });
        parser.registerCommand('job', 'Execute job.sh script with TypeScript wrapper', async (context) => {
            return await LegacyCommandHandler.handleJob(context);
        }, {
            aliases: [],
            arguments: [{ name: 'args', description: 'Arguments to pass to job.sh', required: false }],
            options: [
                { flags: '--timeout <ms>', description: 'Execution timeout in milliseconds' },
                { flags: '--capture', description: 'Capture script output', defaultValue: true },
            ],
        });
        parser.registerCommand('test', 'Execute test scripts with TypeScript wrapper', async (context) => {
            return await LegacyCommandHandler.handleTest(context);
        }, {
            aliases: ['run-tests'],
            arguments: [
                { name: 'args', description: 'Arguments to pass to test script', required: false },
            ],
            options: [
                { flags: '--timeout <ms>', description: 'Execution timeout in milliseconds' },
                { flags: '--capture', description: 'Capture script output', defaultValue: true },
            ],
        });
    }
    registerModernCommands() {
        registerTaskCommand(parser);
        registerConfigCommand(parser);
        registerQueueCommand(parser);
        registerMCPCommand(parser);
        parser.registerCommand('status', 'Show system status and health check', async (context) => {
            return await this.handleStatusCommand(context);
        }, {
            options: [{ flags: '--detailed', description: 'Show detailed status information' }],
        });
    }
    async handleStatusCommand(context) {
        const startTime = Date.now();
        const initialMemory = process.memoryUsage();
        try {
            const config = await getConfig();
            const { validateLegacyScripts } = await import('./legacy-compatibility.js');
            const scriptValidation = await validateLegacyScripts();
            const finalMemory = process.memoryUsage();
            const executionTime = Date.now() - startTime;
            const formatMemorySnapshot = (snapshot) => {
                const rss = snapshot.rss;
                const heapTotal = snapshot.heapTotal;
                const heapUsed = snapshot.heapUsed;
                const external = snapshot.external ?? 0;
                const arrayBuffers = snapshot.arrayBuffers ?? 0;
                const sharedArrayBuffers = snapshot.sharedArrayBuffers ?? 0;
                return {
                    rssBytes: rss,
                    heapTotalBytes: heapTotal,
                    heapUsedBytes: heapUsed,
                    externalBytes: external,
                    arrayBuffersBytes: arrayBuffers,
                    sharedArrayBuffersBytes: sharedArrayBuffers,
                    rssMB: Number((rss / 1024 / 1024).toFixed(2)),
                    heapUsedMB: Number((heapUsed / 1024 / 1024).toFixed(2)),
                };
            };
            const memoryUsage = {
                initial: formatMemorySnapshot(initialMemory),
                final: formatMemorySnapshot(finalMemory),
                peak: formatMemorySnapshot({
                    rss: Math.max(initialMemory.rss, finalMemory.rss),
                    heapTotal: Math.max(initialMemory.heapTotal, finalMemory.heapTotal),
                    heapUsed: Math.max(initialMemory.heapUsed, finalMemory.heapUsed),
                    external: Math.max(initialMemory.external ?? 0, finalMemory.external ?? 0),
                    arrayBuffers: Math.max(initialMemory.arrayBuffers ?? 0, finalMemory.arrayBuffers ?? 0),
                    sharedArrayBuffers: Math.max(initialMemory.sharedArrayBuffers ?? 0, finalMemory.sharedArrayBuffers ?? 0),
                }),
                delta: {
                    rssBytes: finalMemory.rss - initialMemory.rss,
                    heapUsedBytes: finalMemory.heapUsed - initialMemory.heapUsed,
                    rssMB: Number(((finalMemory.rss - initialMemory.rss) / 1024 / 1024).toFixed(2)),
                    heapUsedMB: Number(((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)),
                },
            };
            const statusData = {
                environment: config.environment,
                nodeVersion: process.version,
                platform: `${process.platform} ${process.arch}`,
                workingDirectory: process.cwd(),
                configLoaded: true,
                loggingInitialized: LoggerManager.isInitialized(),
                legacyScripts: {
                    valid: scriptValidation.valid,
                    missing: scriptValidation.missing,
                    issues: scriptValidation.issues,
                },
                phase: {
                    current: 'Phase 1 - Non-interactive CLI',
                    completed: ['Project structure', 'TypeScript setup', 'CLI framework'],
                    pending: ['Task queue system', 'Git automation', 'Container integration'],
                },
                performance: {
                    executionTimeMs: executionTime,
                    uptimeSeconds: Number(process.uptime().toFixed(3)),
                    memoryUsage,
                },
            };
            if (context.json) {
                return {
                    success: true,
                    data: statusData,
                    executionTime,
                };
            }
            const messages = [
                '🚀 Codex Father CLI Status',
                '',
                `📦 Environment: ${statusData.environment}`,
                `⚙️  Node.js: ${statusData.nodeVersion}`,
                `💻 Platform: ${statusData.platform}`,
                `📁 Working Directory: ${statusData.workingDirectory}`,
                '',
                `✅ Configuration: ${statusData.configLoaded ? 'Loaded' : 'Not loaded'}`,
                `✅ Logging: ${statusData.loggingInitialized ? 'Initialized' : 'Not initialized'}`,
                '',
                '📜 Legacy Scripts:',
                `   Status: ${statusData.legacyScripts.valid ? '✅ Valid' : '❌ Issues found'}`,
            ];
            if (statusData.legacyScripts.missing.length > 0) {
                messages.push(`   Missing: ${statusData.legacyScripts.missing.join(', ')}`);
            }
            if (statusData.legacyScripts.issues.length > 0) {
                messages.push(`   Issues: ${statusData.legacyScripts.issues.join(', ')}`);
            }
            messages.push('');
            messages.push('🏗️ Implementation Progress:');
            messages.push(`   Current: ${statusData.phase.current}`);
            messages.push(`   Completed: ${statusData.phase.completed.join(', ')}`);
            messages.push(`   Pending: ${statusData.phase.pending.join(', ')}`);
            messages.push('');
            messages.push('⏱️ Performance Metrics:');
            messages.push(`   Execution Time: ${executionTime}ms`);
            messages.push(`   Uptime: ${statusData.performance.uptimeSeconds}s`);
            messages.push(`   RSS Memory: ${statusData.performance.memoryUsage.final.rssMB} MB`);
            messages.push(`   Heap Used: ${statusData.performance.memoryUsage.final.heapUsedMB} MB`);
            return {
                success: true,
                message: messages.join('\n'),
                data: context.options.detailed ? statusData : undefined,
                executionTime,
            };
        }
        catch (error) {
            const cause = error instanceof Error ? error : new Error(String(error));
            throw createError.internal('Failed to get status information', { error: cause.message });
        }
    }
    async start(argv) {
        await withErrorBoundary(async () => {
            await this.initialize();
            await parser.parse(argv);
        }, { operation: 'CLI startup' });
    }
}
export default async function startCLI(argv) {
    const cli = new CodexFatherCLI();
    await cli.start(argv);
}
if (import.meta.url === `file://${process.argv[1]}`) {
    startCLI().catch((error) => {
        console.error('Failed to start CLI:', error);
        process.exit(1);
    });
}
