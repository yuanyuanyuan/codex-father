/**
 * HTTP Server 单元测试
 * 聚焦请求校验、错误响应和中间件行为
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { HTTPServer } from '../../../src/interfaces/http/server.js';

describe('HTTPServer', () => {
  let server: HTTPServer;
  let app: any;
  let mockRunner: any;
  let originalRateLimit: string | undefined;

  beforeEach(() => {
    originalRateLimit = process.env.HTTP_RATE_LIMIT_MAX;
    process.env.HTTP_RATE_LIMIT_MAX = '3';

    mockRunner = {
      run: vi.fn().mockResolvedValue('task-123'),
      getStatus: vi.fn().mockReturnValue({
        running: 0,
        pending: 0,
        completed: 0,
        maxConcurrency: 10,
      }),
      getResult: vi.fn(),
      cancel: vi.fn().mockResolvedValue(true),
    };

    server = new HTTPServer(mockRunner);
    app = server.getApp();
  });

  afterEach(() => {
    if (originalRateLimit) {
      process.env.HTTP_RATE_LIMIT_MAX = originalRateLimit;
    } else {
      delete process.env.HTTP_RATE_LIMIT_MAX;
    }
    vi.clearAllMocks();
  });

  it('应该设置 CORS 头', async () => {
    const response = await request(app).options('/tasks').expect(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
  });

  it('应该成功创建任务并返回统一响应', async () => {
    const response = await request(app)
      .post('/tasks')
      .send({
        prompt: 'Build release notes',
        environment: 'nodejs',
      })
      .expect(201);

    expect(mockRunner.run).toHaveBeenCalled();
    expect(response.body.success).toBe(true);
    expect(response.body.taskId).toBeDefined();
    expect(response.body.requestId).toMatch(/^req-/);
    expect(response.body.timestamp).toBeDefined();
  });

  it('应该拒绝无效环境类型', async () => {
    const response = await request(app)
      .post('/tasks')
      .send({
        prompt: 'Invalid env',
        environment: 'rust',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(response.body.requestId).toBe(response.body.error.requestId);
  });

  it('应该检测危险命令', async () => {
    const response = await request(app)
      .post('/tasks')
      .send({
        command: 'rm -rf /etc/passwd',
        environment: 'shell',
      })
      .expect(400);

    expect(response.body.error.code).toBe('SECURITY_VIOLATION');
  });

  it('应该返回任务结果', async () => {
    const now = new Date();
    mockRunner.getResult.mockReturnValue({
      success: true,
      result: { message: 'done' },
      startTime: now,
      endTime: now,
      duration: 10,
    });

    const response = await request(app).get('/tasks/task-123').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.result).toEqual({ message: 'done' });
  });

  it('应该处理不存在的任务', async () => {
    mockRunner.getResult.mockReturnValue(undefined);

    const response = await request(app).get('/tasks/unknown-task').expect(404);

    expect(response.body.error.code).toBe('TASK_NOT_FOUND');
    expect(response.body.requestId).toBeDefined();
  });

  it('应该成功取消任务', async () => {
    const response = await request(app).delete('/tasks/task-123').expect(200);

    expect(mockRunner.cancel).toHaveBeenCalledWith('task-123');
    expect(response.body.success).toBe(true);
  });

  it('应该在任务不可取消时返回 404', async () => {
    mockRunner.cancel.mockResolvedValueOnce(false);

    const response = await request(app).delete('/tasks/missing-task').expect(404);

    expect(response.body.error.code).toBe('TASK_NOT_FOUND');
  });

  it('应该返回 404 fallback 响应', async () => {
    const response = await request(app).get('/unknown-route').expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.requestId).toBeDefined();
  });

  it('应该对超大请求体返回 413', async () => {
    const response = await request(app)
      .post('/tasks')
      .send({
        prompt: 'x'.repeat(200_000),
        environment: 'nodejs',
      })
      .expect(413);

    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('应该触发限流', async () => {
    const agent = request.agent(app);
    const responses = [];

    for (let i = 0; i < 12; i++) {
      const res = await agent.get('/tasks/non-existent');
      responses.push(res);
    }

    const limited = responses.filter((res) => res.status === 429);
    expect(limited.length).toBeGreaterThan(0);
    expect(limited[0].body.error.code).toBe('RATE_LIMITED');
  });

  it('应该处理无效 JSON', async () => {
    const response = await request(app)
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('invalid json')
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
  });
});
