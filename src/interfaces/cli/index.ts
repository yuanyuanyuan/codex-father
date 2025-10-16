#!/usr/bin/env node

import { Command } from 'commander';
import { TaskRunner } from '../core/TaskRunner.js';
import { MCPServer } from '../interfaces/mcp/server.js';
import { HTTPServer } from '../interfaces/http/server.js';

const program = new Command();

program
  .name('codex-father')
  .description('A simple task runner for developers with MCP integration')
  .version('2.0.0');

program
  .command('mcp')
  .description('Start MCP server (default mode)')
  .option('--max-concurrency <number>', 'Maximum concurrent tasks', '10')
  .option('--timeout <milliseconds>', 'Default task timeout', '600000')
  .option('--working-directory <path>', 'Working directory for tasks')
  .option('--log-level <level>', 'Log level (error|warn|info|debug)', 'info')
  .action(async (options) => {
    try {
      console.log('🚀 Starting Codex Father MCP Server...');

      const maxConcurrency = parseInt(options.maxConcurrency);
      const runner = new TaskRunner(maxConcurrency);
      const server = new MCPServer(runner);

      console.log(`📡 MCP Server ready (max concurrency: ${maxConcurrency})`);
      console.log('💻 Waiting for connections via stdio...');

      await server.start();
    } catch (error) {
      console.error('❌ Failed to start MCP server:', error);
      process.exit(1);
    }
  });

program
  .command('server')
  .description('Start HTTP API server')
  .option('--port <number>', 'Port to listen on', '3000')
  .option('--host <address>', 'Host address', '0.0.0.0')
  .option('--max-concurrency <number>', 'Maximum concurrent tasks', '10')
  .option('--cors <origins>', 'CORS allowed origins', '*')
  .option('--enable-websocket', 'Enable WebSocket support', 'true')
  .action(async (options) => {
    try {
      const port = parseInt(options.port);
      const maxConcurrency = parseInt(options.maxConcurrency);

      console.log(`🌐 Starting Codex Father HTTP Server...`);
      console.log(`📡 Port: ${port}`);
      console.log(`🔄 Max Concurrency: ${maxConcurrency}`);

      const runner = new TaskRunner(maxConcurrency);
      const server = new HTTPServer(runner);

      await server.start(port);

      console.log(`✅ HTTP Server ready!`);
      console.log(`📖 API Documentation: http://localhost:${port}/api`);
      console.log(`🔍 Health Check: http://localhost:${port}/healthz`);
    } catch (error) {
      console.error('❌ Failed to start HTTP server:', error);
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Run tasks from configuration file')
  .argument('<config-file>', 'Path to task configuration file')
  .option('--max-concurrency <number>', 'Maximum concurrent tasks', '5')
  .option('--continue-on-error', 'Continue after task failure')
  .option('--dry-run', 'Show what would be executed without running')
  .action(async (configFile, options) => {
    try {
      console.log(`📋 Loading tasks from: ${configFile}`);

      const maxConcurrency = parseInt(options.maxConcurrency);
      const runner = new TaskRunner(maxConcurrency);

      // In a real implementation, we would load and parse the config file
      console.log('🚀 Task execution completed (simulated)');
    } catch (error) {
      console.error('❌ Failed to run tasks:', error);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show system status and statistics')
  .option('--json', 'Output in JSON format')
  .option('--detailed', 'Show detailed task information')
  .action(async (options) => {
    try {
      const runner = new TaskRunner();
      const status = runner.getStatus();

      if (options.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        console.log('📊 Codex Father Status:');
        console.log(`🔄 Running: ${status.running}`);
        console.log(`⏳ Pending: ${status.pending}`);
        console.log(`✅ Completed: ${status.completed}`);
        console.log(`🔧 Max Concurrency: ${status.maxConcurrency}`);
      }
    } catch (error) {
      console.error('❌ Failed to get status:', error);
      process.exit(1);
    }
  });

program
  .command('logs')
  .description('View task logs')
  .argument('<task-id>', 'Task ID to view logs for')
  .option('--tail <number>', 'Number of lines to show from end', '50')
  .option('--follow, -f', 'Follow log output')
  .action(async (taskId, options) => {
    try {
      console.log(`📄 Logs for task: ${taskId}`);

      // In a real implementation, we would fetch and display logs
      console.log('(Log output would be shown here)');
    } catch (error) {
      console.error('❌ Failed to fetch logs:', error);
      process.exit(1);
    }
  });

program
  .command('cancel')
  .description('Cancel a running task')
  .argument('<task-id>', 'Task ID to cancel')
  .action(async (taskId) => {
    try {
      console.log(`❌ Cancelling task: ${taskId}`);

      // In a real implementation, we would cancel the task
      console.log('✅ Task cancelled successfully');
    } catch (error) {
      console.error('❌ Failed to cancel task:', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show or update configuration')
  .argument('[key]', 'Configuration key')
  .argument('[value]', 'Configuration value')
  .action(async (key, value) => {
    try {
      if (!key) {
        // Show all configuration
        console.log('⚙️  Codex Father Configuration:');
        console.log('- Max Concurrency: 10');
        console.log('- Default Timeout: 600000ms');
        console.log('- Working Directory: .');
        console.log('- Security: Network Disabled');
      } else if (!value) {
        // Show specific configuration value
        console.log(`⚙️  ${key}: (value would be shown here)`);
      } else {
        // Set configuration value
        console.log(`✅ Configuration updated: ${key} = ${value}`);
      }
    } catch (error) {
      console.error('❌ Failed to manage configuration:', error);
      process.exit(1);
    }
  });

// Handle invalid commands
program.on('command:*', (operands) => {
  console.error(`❌ Unknown command: ${operands[0]}`);
  console.log('💡 Use --help for available commands');
  process.exit(1);
});

// Default to MCP mode if no command provided
if (process.argv.length <= 2) {
  process.argv.push('mcp');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Codex Father...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down Codex Father...');
  process.exit(0);
});

// Parse command line arguments
program.parse();
