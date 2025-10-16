import request from 'supertest';
import { HTTPServer } from '../server.js';
import { TaskRunner } from '../../core/TaskRunner.js';

describe('HTTP API Integration', () => {
  let server: HTTPServer;
  let runner: TaskRunner;

  beforeAll(async () => {
    runner = new TaskRunner(2);
    server = new HTTPServer(runner);
    await server.start(0); // Use random available port
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Health Check', () => {
    test('GET /healthz should return health status', async () => {
      const response = await request(server.getApp()).get('/healthz').expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('tasks');
    });
  });

  describe('Task Submission', () => {
    test('POST /api/v1/tasks with prompt should create task', async () => {
      const taskData = {
        prompt: 'Create a test file',
        priority: 'high',
      };

      const response = await request(server.getApp())
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('taskId');
      expect(response.body.status).toBe('started');
      expect(response.body.taskId).toMatch(/^task-\d+-\w+$/);
    });

    test('POST /api/v1/tasks with command should create task', async () => {
      const taskData = {
        command: 'echo "test"',
        environment: 'shell',
      };

      const response = await request(server.getApp())
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('taskId');
    });

    test('POST /api/v1/tasks without prompt or command should return 400', async () => {
      const taskData = {
        priority: 'high',
      };

      const response = await request(server.getApp())
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('POST /api/v1/tasks with invalid data should return 400', async () => {
      const taskData = {
        prompt: 123, // Should be string
        environment: 'invalid', // Invalid enum value
      };

      const response = await request(server.getApp())
        .post('/api/v1/tasks')
        .send(taskData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Task Status', () => {
    test('GET /api/v1/tasks/:id for existing task should return status', async () => {
      // First create a task
      const createResponse = await request(server.getApp())
        .post('/api/v1/tasks')
        .send({ prompt: 'Test task for status check', taskId: 'status-test-task' })
        .expect(201);

      const taskId = createResponse.body.taskId;

      // Wait a bit for task to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Then get status
      const statusResponse = await request(server.getApp())
        .get(`/api/v1/tasks/${taskId}`)
        .expect(200);

      expect(statusResponse.body).toHaveProperty('taskId', taskId);
      expect(statusResponse.body).toHaveProperty('status');
      expect(statusResponse.body).toHaveProperty('startTime');
      expect(statusResponse.body).toHaveProperty('duration');
    });

    test('GET /api/v1/tasks/:id for non-existent task should return 404', async () => {
      const response = await request(server.getApp())
        .get('/api/v1/tasks/non-existent-task')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TASK_NOT_FOUND');
    });
  });

  describe('Task List', () => {
    test('GET /api/v1/tasks should return task list', async () => {
      const response = await request(server.getApp()).get('/api/v1/tasks').expect(200);

      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('status');
      expect(Array.isArray(response.body.tasks)).toBe(true);
    });

    test('GET /api/v1/tasks with query parameters should work', async () => {
      const response = await request(server.getApp())
        .get('/api/v1/tasks?limit=5&orderBy=createdAt&order=desc')
        .expect(200);

      expect(response.body).toHaveProperty('tasks');
      expect(response.body).toHaveProperty('total');
    });
  });

  describe('Task Reply', () => {
    test('POST /api/v1/tasks/:id/reply should work for existing task', async () => {
      // Create a task first
      const createResponse = await request(server.getApp())
        .post('/api/v1/tasks')
        .send({ prompt: 'Test task for reply', taskId: 'reply-test-task' })
        .expect(201);

      const taskId = createResponse.body.taskId;

      // Then reply to it
      const replyResponse = await request(server.getApp())
        .post(`/api/v1/tasks/${taskId}/reply`)
        .send({ message: 'Continue with this context' })
        .expect(200);

      expect(replyResponse.body.success).toBe(true);
      expect(replyResponse.body).toHaveProperty('message');
      expect(replyResponse.body.taskId).toBe(taskId);
    });

    test('POST /api/v1/tasks/:id/reply for non-existent task should return 404', async () => {
      const response = await request(server.getApp())
        .post('/api/v1/tasks/non-existent-task/reply')
        .send({ message: 'Test reply' })
        .expect(404);

      expect(response.body.error.code).toBe('TASK_NOT_FOUND');
    });
  });

  describe('Task Cancel', () => {
    test('DELETE /api/v1/tasks/:id should cancel task', async () => {
      // Create a long-running task
      const createResponse = await request(server.getApp())
        .post('/api/v1/tasks')
        .send({
          command: 'sleep 10',
          taskId: 'cancel-test-task',
        })
        .expect(201);

      const taskId = createResponse.body.taskId;

      // Cancel it immediately
      const cancelResponse = await request(server.getApp())
        .delete(`/api/v1/tasks/${taskId}`)
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.message).toContain('cancelled');
    });

    test('DELETE /api/v1/tasks/:id for non-existent task should return 404', async () => {
      const response = await request(server.getApp())
        .delete('/api/v1/tasks/non-existent-task')
        .expect(404);

      expect(response.body.error.code).toBe('TASK_NOT_RUNNING');
    });
  });

  describe('API Info', () => {
    test('GET /api should return API information', async () => {
      const response = await request(server.getApp()).get('/api').expect(200);

      expect(response.body).toHaveProperty('name', 'Codex Father API');
      expect(response.body).toHaveProperty('version', '2.0.0');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body.endpoints).toHaveProperty('health');
      expect(response.body.endpoints).toHaveProperty('tasks');
      expect(response.body.endpoints).toHaveProperty('websocket');
    });
  });

  describe('Error Handling', () => {
    test('Invalid endpoints should return 404', async () => {
      const response = await request(server.getApp()).get('/invalid-endpoint').expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    test('Invalid methods should return 404', async () => {
      const response = await request(server.getApp()).patch('/api/v1/tasks').expect(404);

      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
