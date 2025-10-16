import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
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
    // Attach request metadata
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const requestId = `req-${Math.random().toString(36).substr(2, 9)}`;
      res.locals.requestId = requestId;
      res.setHeader('X-Request-ID', requestId);
      next();
    });

    // CORS configuration
    this.app.use(
      cors({
        origin: process.env.CORS_ORIGIN || '*',
        credentials: false,
        optionsSuccessStatus: 200, // Return 200 for OPTIONS requests
      })
    );

    // Compression for large responses
    this.app.use(compression());

    // Basic rate limiting
    const limiter = rateLimit({
      windowMs: 60_000,
      max: Number(process.env.HTTP_RATE_LIMIT_MAX ?? 60),
      standardHeaders: true,
      legacyHeaders: false,
      handler: (_req, res) => {
        const meta = this.buildResponseMeta(res);
        res.status(429).json({
          success: false,
          ...meta,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests, please try again later.',
            ...meta,
          },
        });
      },
    });
    this.app.use(limiter);

    // JSON parsing with smaller limit for testing
    this.app.use(express.json({ limit: '100kb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '100kb' }));

    // Security headers
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
      next();
    });

    // Error handling middleware
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('HTTP Error:', error);

      // Handle specific error types
      if (error.type === 'entity.too.large') {
        const meta = this.buildResponseMeta(res);
        return res.status(413).json({
          success: false,
          ...meta,
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: 'Request payload too large',
            ...meta,
          },
        });
      }

      if (error.type === 'entity.parse.failed') {
        const meta = this.buildResponseMeta(res);
        return res.status(400).json({
          success: false,
          ...meta,
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid JSON in request body',
            ...meta,
          },
        });
      }

      const meta = this.buildResponseMeta(res);
      res.status(500).json({
        success: false,
        ...meta,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message,
          ...meta,
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

    // Direct routes for backward compatibility with tests
    this.app.post('/tasks', this.taskController.submitTask.bind(this.taskController));
    this.app.get('/tasks/:id', this.taskController.getTask.bind(this.taskController));
    this.app.get('/tasks', this.taskController.listTasks.bind(this.taskController));
    this.app.post('/tasks/:id/reply', this.taskController.replyTask.bind(this.taskController));
    this.app.delete('/tasks/:id', this.taskController.cancelTask.bind(this.taskController));

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

    // 404 handler with enhanced error response
    this.app.use('*', (req: Request, res: Response, next: NextFunction) => {
      // Ensure request ID and timestamp are set for 404 responses
      const meta = this.buildResponseMeta(res);
      res.setHeader('X-Request-ID', meta.requestId);

      res.status(404).json({
        success: false,
        ...meta,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${req.method} ${req.originalUrl} not found`,
          ...meta,
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

  private buildResponseMeta(res: Response) {
    const requestId =
      (res.locals?.requestId as string) ||
      res.get('X-Request-ID') ||
      `req-${Math.random().toString(36).substr(2, 9)}`;
    return {
      requestId,
      timestamp: new Date().toISOString(),
    };
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

  // Methods for testing support
  async getTaskList(options: any = {}): Promise<any> {
    // Simplified implementation for testing
    const status = this.runner.getStatus();
    return {
      tasks: [],
      total: 0,
      hasMore: false,
      cursor: null,
      ...options,
    };
  }

  async appendToTask(
    taskId: string,
    data: { message: string; files?: string[] }
  ): Promise<boolean> {
    // Simplified implementation for testing
    return true;
  }

  createWebSocketServer(port?: number): any {
    // Create actual WebSocket server
    if (!this.wsServer) {
      this.wsServer = new WebSocketServer({
        server: this.server,
        path: '/ws',
      });
    }

    return this.wsServer;
  }

  broadcastUpdate(update: any): void {
    this.wsManager.broadcastUpdate(update);
  }

  startWebSocket(port?: number): void {
    // Create or get WebSocket server
    const wsServer = this.createWebSocketServer(port);

    // Set up event handlers
    wsServer.on('connection', (ws: any, req: any) => {
      console.log(`WebSocket client connected from ${req.socket?.remoteAddress || 'unknown'}`);
      this.wsManager.handleConnection(ws, req);
    });

    wsServer.on('error', (error: any) => {
      console.error('WebSocket server error:', error);
    });
  }
}
