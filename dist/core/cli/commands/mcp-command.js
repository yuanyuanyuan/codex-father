import { createMCPServer } from '../../mcp/server.js';
let mcpServerInstance = null;
export function registerMCPCommand(parser) {
    parser.registerCommand('mcp', 'Start and manage MCP (Model Context Protocol) server', async (context) => {
        const started = Date.now();
        try {
            const options = {
                debug: context.options.debug === true || context.options.debug === 'true',
            };
            if (context.options.serverName) {
                options.serverName = context.options.serverName;
            }
            if (context.options.serverVersion) {
                options.serverVersion = context.options.serverVersion;
            }
            if (context.options.codexCommand) {
                options.codexCommand = context.options.codexCommand;
            }
            if (context.options.codexArgs) {
                options.codexArgs = context.options.codexArgs;
            }
            if (context.options.cwd) {
                options.cwd = context.options.cwd;
            }
            if (context.options.healthCheckInterval) {
                options.healthCheckInterval = Number(context.options.healthCheckInterval);
            }
            if (context.options.maxRestartAttempts) {
                options.maxRestartAttempts = Number(context.options.maxRestartAttempts);
            }
            if (context.options.restartDelay) {
                options.restartDelay = Number(context.options.restartDelay);
            }
            if (context.options.timeout) {
                options.timeout = Number(context.options.timeout);
            }
            if (!context.json) {
                console.log('🚀 Starting MCP Server...\n');
                console.log('╭─────────────────────────────────────────────────────╮');
                console.log('│  Model Context Protocol (MCP) Server               │');
                console.log('│  Codex Father MCP Integration                       │');
                console.log('╰─────────────────────────────────────────────────────╯\n');
                if (options.debug) {
                    console.log('🐛 Debug mode: ENABLED');
                    console.log(`📁 Working directory: ${options.cwd || process.cwd()}`);
                    console.log(`⏱️  Timeout: ${options.timeout || 30000}ms, Health check: ${options.healthCheckInterval || 30000}ms`);
                    console.log('');
                }
            }
            const serverConfig = {};
            if (options.serverName) {
                serverConfig.serverName = options.serverName;
            }
            if (options.serverVersion) {
                serverConfig.serverVersion = options.serverVersion;
            }
            if (options.debug !== undefined) {
                serverConfig.debug = options.debug;
            }
            const server = createMCPServer(serverConfig);
            mcpServerInstance = server;
            setupGracefulShutdown(server, context);
            await server.start();
            const serverInfo = server.getServerInfo();
            if (!context.json) {
                console.log('✅ MCP Server started successfully!\n');
                console.log(`📦 Server: ${serverInfo.name} v${serverInfo.version}`);
                console.log('🔌 Transport: stdio (line-delimited JSON)');
                console.log('📡 Protocol: MCP 2024-11-05');
                console.log('🛠️  Capabilities: tools, notifications');
                console.log('\n💡 Server is running. Press Ctrl+C to stop.');
                console.log('─────────────────────────────────────────────────────\n');
            }
            const result = {
                success: true,
                message: `MCP Server started: ${serverInfo.name} v${serverInfo.version}`,
                data: context.json
                    ? {
                        serverName: serverInfo.name,
                        serverVersion: serverInfo.version,
                        transport: 'stdio',
                        protocol: 'MCP 2024-11-05',
                        capabilities: ['tools', 'notifications'],
                    }
                    : undefined,
                executionTime: Date.now() - started,
            };
            if (context.json) {
                console.log(JSON.stringify(result, null, 2));
            }
            await keepServerAlive();
            return result;
        }
        catch (error) {
            const errorMessage = error.message || 'Unknown error';
            const executionTime = Date.now() - started;
            if (!context.json) {
                console.error('\n❌ Failed to start MCP Server\n');
                console.error(`🔴 Error: ${errorMessage}\n`);
            }
            return {
                success: false,
                message: 'Failed to start MCP Server',
                errors: [errorMessage],
                executionTime,
            };
        }
    }, {
        arguments: [],
        options: [
            { flags: '--debug', description: 'Enable debug logging' },
            { flags: '--server-name <name>', description: 'Server name (default: codex-father)' },
            {
                flags: '--server-version <version>',
                description: 'Server version (default: 1.0.0-mvp1)',
            },
            {
                flags: '--codex-command <command>',
                description: 'Codex command path (default: codex)',
            },
            {
                flags: '--codex-args <args>',
                description: 'Codex command arguments, comma-separated (default: mcp)',
            },
            { flags: '--cwd <path>', description: 'Working directory (default: current directory)' },
            {
                flags: '--health-check-interval <ms>',
                description: 'Health check interval in milliseconds (default: 30000)',
            },
            {
                flags: '--max-restart-attempts <n>',
                description: 'Maximum restart attempts (default: 3)',
            },
            {
                flags: '--restart-delay <ms>',
                description: 'Restart delay in milliseconds (default: 1000)',
            },
            {
                flags: '--timeout <ms>',
                description: 'Request timeout in milliseconds (default: 30000)',
            },
        ],
    });
}
function setupGracefulShutdown(server, context) {
    const handleShutdown = async (signal) => {
        if (!context.json) {
            console.log(`\n\n🛑 Received ${signal}, shutting down gracefully...\n`);
        }
        try {
            await server.stop();
            if (!context.json) {
                console.log('✅ MCP Server stopped successfully.\n');
            }
            process.exit(0);
        }
        catch (error) {
            if (!context.json) {
                console.error(`❌ Error during shutdown: ${error.message}\n`);
            }
            process.exit(1);
        }
    };
    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('uncaughtException', async (error) => {
        if (!context.json) {
            console.error(`\n❌ Uncaught Exception: ${error.message}\n`);
            console.error(error.stack);
        }
        try {
            await server.stop();
        }
        catch (stopError) {
        }
        process.exit(1);
    });
    process.on('unhandledRejection', async (reason) => {
        if (!context.json) {
            console.error(`\n❌ Unhandled Rejection: ${reason}\n`);
        }
        try {
            await server.stop();
        }
        catch (stopError) {
        }
        process.exit(1);
    });
}
async function keepServerAlive() {
    return new Promise(() => {
    });
}
export function getMCPServerInstance() {
    return mcpServerInstance;
}
export function clearMCPServerInstance() {
    mcpServerInstance = null;
}
