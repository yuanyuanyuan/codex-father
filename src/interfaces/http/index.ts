import { TaskRunner } from '../core/TaskRunner.js';
import { HTTPServer } from './http/server.js';
import { SecurityManager } from './http/security-manager.js';

async function main(): Promise<void> {
  try {
    const port = parseInt(process.env.PORT || '3000');
    const maxConcurrency = parseInt(process.env.MAX_CONCURRENCY || '10');

    console.log('🚀 Codex Father HTTP Server starting...');
    console.log(`📡 Port: ${port}`);
    console.log(`🔄 Max Concurrency: ${maxConcurrency}`);

    // Initialize security manager
    const securityManager = new SecurityManager([process.cwd()]);

    // Initialize task runner
    const runner = new TaskRunner(maxConcurrency);

    // Initialize and start HTTP server
    const server = new HTTPServer(runner);

    // Graceful shutdown handlers
    const gracefulShutdown = (signal: string) => {
      console.log(`\n${signal} received, shutting down gracefully...`);
      server
        .stop()
        .then(() => {
          console.log('✅ Server stopped successfully');
          process.exit(0);
        })
        .catch((error) => {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        });
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

    // Start server
    await server.start(port);

    console.log(`✅ HTTP Server ready!`);
    console.log(`📖 API Documentation: http://localhost:${port}/api`);
    console.log(`🔍 Health Check: http://localhost:${port}/healthz`);
    console.log(`🌐 WebSocket: ws://localhost:${port}/ws`);
  } catch (error) {
    console.error('❌ Failed to start HTTP server:', error);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
