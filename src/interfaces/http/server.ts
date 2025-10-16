import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { WebSocketManager } from './websocket.js';
import { TaskRunner } from '../../core/TaskRunner.js';
import { TaskController } from './controllers.js';

export class HTTPServer {
  private app: Express;
  private server: any;
  private wsServer: WebSocketServer;
  private wsManager: WebSocketManager;
  private taskController: TaskController;
  private runner: TaskRunner;

  constructor(runner: TaskRunner) {
    this.runner = runner;
    this.app = express();
    this.server = createServer(this.app);
    this.wsManager = new WebSocketManager();
    this.taskController = new TaskController(runner, this.wsManager);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || '*',
        credentials: false,
      })
    );

    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });

    // Error handling middleware
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('HTTP Error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/healthz', (req: Request, res: Response) => {
      const status = this.runner.getStatus();
      res.json({
        status: 'healthy',
        version: '2.0.0',
        uptime: process.uptime(),
        tasks: {
          running: status.running,
          pending: status.pending,
          completed: status.completed,
        },
      });
    });

    // API version 1 routes
    const v1Router = express.Router();

    // Task routes
    v1Router.post('/tasks', this.taskController.submitTask.bind(this.taskController));
    v1Router.get('/tasks/:id', this.taskController.getTask.bind(this.taskController));
    v1Router.get('/tasks', this.taskController.listTasks.bind(this.taskController));
    v1Router.post('/tasks/:id/reply', this.taskController.replyTask.bind(this.taskController));
    v1Router.delete('/tasks/:id', this.taskController.cancelTask.bind(this.taskController));

    // Apply v1 routes
    this.app.use('/api/v1', v1Router);

    // Root API info
    this.app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'Codex Father API',
        version: '2.0.0',
        endpoints: {
          health: '/healthz',
          tasks: '/api/v1/tasks',
          websocket: '/ws',
        },
        documentation: '/api/docs',
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${req.method} ${req.originalUrl} not found`,
        },
      });
    });
  }

  private setupWebSocket(): void {
    this.wsServer = new WebSocketServer({
      server: this.server,
      path: '/ws',
    });

    this.wsServer.on('connection', (ws, req) => {
      console.log(`WebSocket client connected from ${req.socket.remoteAddress}`);
      this.wsManager.handleConnection(ws, req);
    });

    this.wsServer.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  async start(port: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`🌐 HTTP Server running on port ${port}`);
          console.log(`📡 WebSocket server available at ws://localhost:${port}/ws`);
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wsServer.close();
      this.server.close(() => {
        console.log('HTTP Server stopped');
        resolve();
      });
    });
  }

  getApp(): Express {
    return this.app;
  }

  getWebSocketManager(): WebSocketManager {
    return this.wsManager;
  }
}
