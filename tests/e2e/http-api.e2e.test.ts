/**
 * HTTP API E2E 测试
 * 覆盖关键的任务提交流程、错误处理与限流逻辑
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { HTTPServer } from '../../src/interfaces/http/server.js';
import { TaskRunner } from '../../src/core/TaskRunner.js';

describe('HTTP API E2E', () => {
  let runner: TaskRunner;
  let server: HTTPServer;
  let originalRateLimit: string | undefined;

  const getApp = () => server.getApp();

  beforeEach(() => {
    originalRateLimit = process.env.HTTP_RATE_LIMIT_MAX;
    process.env.HTTP_RATE_LIMIT_MAX = '5';
    runner = new TaskRunner(2);
    server = new HTTPServer(runner);
  });

  afterEach(async () => {
    if (originalRateLimit) {
      process.env.HTTP_RATE_LIMIT_MAX = originalRateLimit;
    } else {
      delete process.env.HTTP_RATE_LIMIT_MAX;
    }
    await runner.cleanup();
  });

  it('应该成功提交 prompt 任务并返回请求元数据', async () => {
    const response = await request(getApp())
      .post('/tasks')
      .send({
        prompt: 'Generate release notes',
        environment: 'nodejs',
        files: ['docs/changelog.md'],
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.taskId).toMatch(/^task-\d+-\w+$/);
    expect(response.body.status).toBe('started');
    expect(response.body.requestId).toMatch(/^req-/);
    expect(new Date(response.body.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('应该拒绝非法环境类型并返回统一错误格式', async () => {
    const response = await request(getApp())
      .post('/tasks')
      .send({
        prompt: 'Invalid environment',
        environment: 'ruby',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(response.body.error.message).toBe('Invalid request parameters');
    expect(response.body.requestId).toBe(response.body.error.requestId);
    expect(response.body.timestamp).toBe(response.body.error.timestamp);
  });

  it('应该阻止危险命令', async () => {
    const response = await request(getApp())
      .post('/tasks')
      .send({
        command: 'rm -rf /tmp/data',
        environment: 'shell',
      })
      .expect(400);

    expect(response.body.error.code).toBe('SECURITY_VIOLATION');
  });

  it('应该在任务完成后返回执行结果', async () => {
    const submit = await request(getApp())
      .post('/tasks')
      .send({
        id: 'status-check-task',
        prompt: 'Summarize sprint progress',
        environment: 'nodejs',
      })
      .expect(201);

    expect(submit.body.taskId).toBe('status-check-task');

    await new Promise((resolve) => setTimeout(resolve, 300));

    const status = await request(getApp()).get('/tasks/status-check-task').expect(200);

    expect(status.body.success).toBe(true);
    expect(status.body.status).toBe('completed');
    expect(status.body.result).toBeDefined();
    expect(status.body.requestId).toMatch(/^req-/);
  });

  it('应该在任务不存在时返回 404', async () => {
    const response = await request(getApp()).get('/tasks/non-existent-task').expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('TASK_NOT_FOUND');
    expect(response.body.requestId).toBe(response.body.error.requestId);
  });

  it('应该应用限流策略', async () => {
    const requests = Array.from({ length: 12 }, () =>
      request(getApp()).get('/tasks/non-existent').unset('Accept')
    );

    const responses = await Promise.allSettled(requests);
    const fulfilled = responses
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as any).value);

    const rateLimited = fulfilled.filter((res) => res.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);

    const sample = rateLimited[0];
    expect(sample.body.error.code).toBe('RATE_LIMITED');
    expect(sample.body.requestId).toBeDefined();
  });
});
