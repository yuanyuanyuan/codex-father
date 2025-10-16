import { TaskRunner } from '../core/TaskRunner.js';
import { MCPServer } from './mcp/server.js';
import { SecurityManager } from './mcp/security-manager.js';
import { SessionManager } from './mcp/session-manager.js';

async function main(): Promise<void> {
  try {
    // Initialize security manager
    const securityManager = new SecurityManager([process.cwd()]);

    // Initialize session manager
    const sessionManager = new SessionManager();

    // Initialize task runner with security constraints
    const runner = new TaskRunner(10); // Default 10 concurrent tasks

    // Initialize and start MCP server
    const server = new MCPServer(runner);

    console.log('🚀 Codex Father MCP Server starting...');
    console.log('📡 Listening for MCP connections via stdio...');

    await server.start();
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down Codex Father MCP Server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down Codex Father MCP Server...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
