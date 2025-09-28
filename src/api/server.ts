/**
 * PRD API 服务器
 * 提供完整的 REST API 接口，支持草稿管理、版本控制、审查工作流等功能
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { randomUUID } from 'crypto';
import type { PRDUserConfig } from '../cli/prd-commands.js';
import { FileSystemDocumentService } from '../services/document-service.js';
import { DefaultTemplateService } from '../services/template-service.js';
import { DefaultPermissionService } from '../services/permission-service.js';
import { DefaultVersionService } from '../services/version-service.js';
import { DefaultDiagramService } from '../services/diagram-service.js';

// 导入路由
import { createDraftRoutes } from './routes/drafts.js';
import { createVersionRoutes } from './routes/versions.js';
import { createReviewRoutes } from './routes/reviews.js';
import { createTemplateRoutes } from './routes/templates.js';
import { createUserRoutes } from './routes/users.js';

/**
 * API 服务器配置接口
 */
export interface APIServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  security: {
    helmet: boolean;
    compression: boolean;
  };
  workingDirectory: string;
  userConfig?: PRDUserConfig;
}

/**
 * 默认服务器配置
 */
const DEFAULT_CONFIG: APIServerConfig = {
  port: 3000,
  host: '0.0.0.0',
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 限制每个IP每15分钟最多100次请求
  },
  security: {
    helmet: true,
    compression: true,
  },
  workingDirectory: process.cwd(),
};

/**
 * 增强的请求接口
 */
export interface PRDRequest extends Request {
  requestId: string;
  user?: {
    id: string;
    role: string;
    permissions: string[];
  };
  services?: {
    documentService: FileSystemDocumentService;
    templateService: DefaultTemplateService;
    permissionService: DefaultPermissionService;
    versionService: DefaultVersionService;
    diagramService: DefaultDiagramService;
  };
}

/**
 * API 响应接口
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    version: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * PRD API 服务器类
 */
export class PRDAPIServer {
  private app: Application;
  private config: APIServerConfig;
  private services: {
    documentService: FileSystemDocumentService;
    templateService: DefaultTemplateService;
    permissionService: DefaultPermissionService;
    versionService: DefaultVersionService;
    diagramService: DefaultDiagramService;
  };

  constructor(config: Partial<APIServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.app = express();

    // 初始化服务
    this.services = {
      documentService: new FileSystemDocumentService(this.config.workingDirectory),
      templateService: new DefaultTemplateService(),
      permissionService: new DefaultPermissionService(),
      versionService: new DefaultVersionService(),
      diagramService: new DefaultDiagramService(),
    };

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    // 安全相关中间件
    if (this.config.security.helmet) {
      this.app.use(helmet());
    }

    // 压缩响应
    if (this.config.security.compression) {
      this.app.use(compression());
    }

    // CORS 配置
    this.app.use(cors(this.config.cors));

    // 请求限制
    const limiter = rateLimit(this.config.rateLimit);
    this.app.use(limiter);

    // 解析 JSON 和 URL 编码数据
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // 请求 ID 中间件
    this.app.use((req: PRDRequest, res: Response, next: NextFunction) => {
      req.requestId = randomUUID();
      res.setHeader('X-Request-ID', req.requestId);
      next();
    });

    // 服务注入中间件
    this.app.use((req: PRDRequest, res: Response, next: NextFunction) => {
      req.services = this.services;
      next();
    });

    // 用户认证中间件（简化版）
    this.app.use((req: PRDRequest, res: Response, next: NextFunction) => {
      // 这里应该实现真正的认证逻辑
      // 目前使用简化的模拟用户
      req.user = {
        id: (req.headers['x-user-id'] as string) || 'default-user',
        role: (req.headers['x-user-role'] as string) || 'developer',
        permissions: ['read', 'write', 'review'],
      };
      next();
    });

    // 请求日志中间件
    this.app.use((req: PRDRequest, res: Response, next: NextFunction) => {
      const start = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(
          `[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms) [${req.requestId}]`
        );
      });

      next();
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 健康检查端点
    this.app.get('/health', (req: PRDRequest, res: Response) => {
      this.sendResponse(res, {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          uptime: process.uptime(),
        },
      });
    });

    // API 信息端点
    this.app.get('/api/info', (req: PRDRequest, res: Response) => {
      this.sendResponse(res, {
        success: true,
        data: {
          name: 'PRD API Server',
          version: '1.0.0',
          description: 'Product Requirements Document management API',
          endpoints: {
            drafts: '/api/drafts',
            versions: '/api/drafts/{id}/versions',
            reviews: '/api/drafts/{id}/reviews',
            templates: '/api/templates',
            users: '/api/users',
          },
        },
      });
    });

    // 注册业务路由
    this.app.use('/api/drafts', createDraftRoutes());
    this.app.use('/api/drafts', createVersionRoutes());
    this.app.use('/api/drafts', createReviewRoutes());
    this.app.use('/api/templates', createTemplateRoutes());
    this.app.use('/api/users', createUserRoutes());

    // 404 处理
    this.app.use('*', (req: PRDRequest, res: Response) => {
      this.sendError(res, 404, 'NOT_FOUND', `端点不存在: ${req.method} ${req.path}`);
    });
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    // 全局错误处理中间件
    this.app.use((error: Error, req: PRDRequest, res: Response, next: NextFunction) => {
      console.error(`[${new Date().toISOString()}] Error in ${req.method} ${req.path}:`, error);

      if (res.headersSent) {
        return next(error);
      }

      // 根据错误类型返回不同的状态码
      let statusCode = 500;
      let errorCode = 'INTERNAL_ERROR';

      if (error.name === 'ValidationError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
      } else if (error.name === 'UnauthorizedError') {
        statusCode = 401;
        errorCode = 'UNAUTHORIZED';
      } else if (error.name === 'ForbiddenError') {
        statusCode = 403;
        errorCode = 'FORBIDDEN';
      } else if (error.name === 'NotFoundError') {
        statusCode = 404;
        errorCode = 'NOT_FOUND';
      } else if (error.name === 'ConflictError') {
        statusCode = 409;
        errorCode = 'CONFLICT';
      }

      this.sendError(res, statusCode, errorCode, error.message, {
        requestId: req.requestId,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    });
  }

  /**
   * 发送成功响应
   */
  sendResponse<T>(
    res: Response,
    data: Omit<APIResponse<T>, 'meta'>,
    statusCode: number = 200
  ): void {
    const response: APIResponse<T> = {
      ...data,
      meta: {
        requestId: res.getHeader('X-Request-ID') as string,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        ...data.meta,
      },
    };

    res.status(statusCode).json(response);
  }

  /**
   * 发送错误响应
   */
  sendError(
    res: Response,
    statusCode: number,
    errorCode: string,
    message: string,
    details?: any
  ): void {
    const response: APIResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        details,
      },
      meta: {
        requestId: res.getHeader('X-Request-ID') as string,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      },
    };

    res.status(statusCode).json(response);
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(this.config.port, this.config.host, () => {
          console.log(`PRD API Server started at http://${this.config.host}:${this.config.port}`);
          console.log(`Health check: http://${this.config.host}:${this.config.port}/health`);
          console.log(`API info: http://${this.config.host}:${this.config.port}/api/info`);
          resolve();
        });

        server.on('error', (error) => {
          console.error('Failed to start server:', error);
          reject(error);
        });

        // 优雅关闭处理
        process.on('SIGTERM', () => {
          console.log('Received SIGTERM, shutting down gracefully...');
          server.close(() => {
            console.log('Server closed');
            process.exit(0);
          });
        });

        process.on('SIGINT', () => {
          console.log('Received SIGINT, shutting down gracefully...');
          server.close(() => {
            console.log('Server closed');
            process.exit(0);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 获取 Express 应用实例
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * 获取服务实例
   */
  getServices() {
    return this.services;
  }
}

/**
 * 创建 API 服务器实例
 */
export function createAPIServer(config?: Partial<APIServerConfig>): PRDAPIServer {
  return new PRDAPIServer(config);
}

/**
 * 辅助函数：从请求中提取分页参数
 */
export function extractPaginationParams(req: Request): {
  page: number;
  limit: number;
  offset: number;
} {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * 辅助函数：创建分页元数据
 */
export function createPaginationMeta(
  page: number,
  limit: number,
  total: number
): {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
} {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
