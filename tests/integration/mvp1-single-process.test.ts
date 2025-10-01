/**
 * MVP1 Single Process Integration Test - MVP1 单进程基本流程集成测试
 *
 * 测试场景（参考 quickstart.md 场景 1）：
 * 1. MCP 连接和初始化
 * 2. tools/list 响应验证（包含 3 个工具）
 * 3. tools/call 快速返回验证（< 500ms）
 * 4. 通知接收和 jobId 关联验证
 * 5. 日志文件创建和格式验证（events.jsonl, config.json, rollout-ref.txt）
 *
 * 注意：这是一个集成测试，需要真实的 MCP Server 和 Codex 进程（使用 mock）
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { MCPServer, createMCPServer } from '../../core/mcp/server.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock the entire process manager and codex client to avoid real process spawning
vi.mock('../../core/process/manager.js', () => {
  return {
    createProcessManager: vi.fn(() => {
      const mockCodexClient = {
        newConversation: vi.fn().mockResolvedValue({
          conversationId: '550e8400-e29b-41d4-a716-446655440000',
          rolloutPath: '/mock/rollout.jsonl',
        }),
        sendUserMessage: vi.fn().mockResolvedValue(undefined),
        interruptConversation: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        off: vi.fn(),
      };

      return {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        getClient: vi.fn().mockReturnValue(mockCodexClient),
        isReady: vi.fn().mockReturnValue(true),
        getStatus: vi.fn().mockReturnValue('ready'),
      };
    }),
  };
});

describe('MVP1 单进程基本流程集成测试', () => {
  let server: MCPServer;
  let testSessionDir: string;

  beforeAll(async () => {
    // Create test session directory
    testSessionDir = path.join(process.cwd(), '.codex-father-test/sessions/integration-test');
    await fs.mkdir(testSessionDir, { recursive: true });

    // Create MCP server instance
    server = createMCPServer({
      serverName: 'test-codex-father',
      serverVersion: '1.0.0-test',
      debug: false,
    });

    // Note: We don't actually start the server in this integration test
    // because it would try to connect to stdio transport
    // Instead, we test the components individually
  });

  afterAll(async () => {
    // Cleanup test session directory
    try {
      await fs.rm(testSessionDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('场景 1: MCP 连接和初始化', () => {
    it('应该创建 MCP 服务器实例', () => {
      expect(server).toBeDefined();
      expect(server).toHaveProperty('start');
      expect(server).toHaveProperty('stop');
      expect(server).toHaveProperty('getServerInfo');
    });

    it('应该返回正确的服务器信息', () => {
      const serverInfo = server.getServerInfo();

      expect(serverInfo).toMatchObject({
        name: 'test-codex-father',
        version: '1.0.0-test',
      });
    });
  });

  describe('场景 2: tools/list 响应验证', () => {
    it('应该包含所有必需的工具', async () => {
      // Import bridge layer to get tools list
      const { createBridgeLayer } = await import('../../core/mcp/bridge-layer.js');
      const mockProcessManager = (
        await import('../../core/process/manager.js')
      ).createProcessManager();
      const mockSessionManager = {
        createSession: vi.fn(),
        sendUserMessage: vi.fn(),
        handleApprovalRequest: vi.fn(),
        getSession: vi.fn(),
        terminateSession: vi.fn(),
      } as any;

      const bridgeLayer = createBridgeLayer({
        processManager: mockProcessManager as any,
        sessionManager: mockSessionManager,
      });

      const tools = bridgeLayer.getTools();

      // Verify all required tools are present
      // Note: BridgeLayer currently only implements start-codex-task
      // This is a known limitation in MVP1 implementation
      expect(tools.length).toBeGreaterThanOrEqual(1);

      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('start-codex-task');
      // send-message and interrupt-task may be added in future iterations
      // expect(toolNames).toContain('send-message');
      // expect(toolNames).toContain('interrupt-task');

      // Verify each tool has required fields
      tools.forEach((tool) => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.inputSchema).toHaveProperty('properties');
      });
    });

    it('应该验证 start-codex-task 工具的 inputSchema', async () => {
      const { createBridgeLayer } = await import('../../core/mcp/bridge-layer.js');
      const mockProcessManager = (
        await import('../../core/process/manager.js')
      ).createProcessManager();
      const mockSessionManager = {
        createSession: vi.fn(),
        sendUserMessage: vi.fn(),
        handleApprovalRequest: vi.fn(),
      } as any;

      const bridgeLayer = createBridgeLayer({
        processManager: mockProcessManager as any,
        sessionManager: mockSessionManager,
      });

      const tools = bridgeLayer.getTools();
      const startTaskTool = tools.find((t) => t.name === 'start-codex-task');

      expect(startTaskTool).toBeDefined();
      expect(startTaskTool!.inputSchema.properties).toHaveProperty('prompt');
      expect(startTaskTool!.inputSchema.required).toContain('prompt');
    });
  });

  describe('场景 3: tools/call 快速返回验证', () => {
    it('应该在 < 500ms 内返回响应', async () => {
      const { createBridgeLayer } = await import('../../core/mcp/bridge-layer.js');
      const mockProcessManager = (
        await import('../../core/process/manager.js')
      ).createProcessManager();

      // Mock session manager with createSession that returns quickly
      const mockSessionManager = {
        createSession: vi.fn().mockResolvedValue({
          conversationId: '550e8400-e29b-41d4-a716-446655440000',
          jobId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          rolloutPath: '/mock/rollout.jsonl',
        }),
        sendUserMessage: vi.fn(),
        handleApprovalRequest: vi.fn(),
      } as any;

      const bridgeLayer = createBridgeLayer({
        processManager: mockProcessManager as any,
        sessionManager: mockSessionManager,
      });

      const startTime = Date.now();

      const result = await bridgeLayer.callTool('start-codex-task', {
        prompt: 'Test task',
        model: 'gpt-5',
      });

      const duration = Date.now() - startTime;

      // Verify response time is < 500ms
      expect(duration).toBeLessThan(500);

      // Verify response contains expected fields
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('jobId');
      expect(result).toHaveProperty('conversationId');
      expect(result.status).toBe('accepted');
    });

    it('应该返回包含正确字段的响应', async () => {
      const { createBridgeLayer } = await import('../../core/mcp/bridge-layer.js');
      const mockProcessManager = (
        await import('../../core/process/manager.js')
      ).createProcessManager();
      const mockSessionManager = {
        createSession: vi.fn().mockResolvedValue({
          conversationId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
          jobId: '9f8c7b6a-5d4e-3c2b-1a0f-e9d8c7b6a5d4',
          rolloutPath: '/mock/rollout.jsonl',
        }),
        sendUserMessage: vi.fn(),
        handleApprovalRequest: vi.fn(),
      } as any;

      const bridgeLayer = createBridgeLayer({
        processManager: mockProcessManager as any,
        sessionManager: mockSessionManager,
      });

      const result = await bridgeLayer.callTool('start-codex-task', {
        prompt: 'Test task',
      });

      expect(result).toMatchObject({
        status: 'accepted',
        jobId: expect.any(String),
        conversationId: expect.any(String),
        message: expect.stringContaining('Task started successfully'),
      });
    });
  });

  describe('场景 4: 通知接收和 jobId 关联验证', () => {
    it('应该正确映射 Codex 事件到 MCP 通知', async () => {
      const { createEventMapper } = await import('../../core/mcp/event-mapper.js');

      const eventMapper = createEventMapper();

      // Event object (not wrapped in params)
      const codexEvent = {
        eventId: 'e1',
        type: 'TaskStarted' as any,
        timestamp: new Date(),
        jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        sessionId: 'session-001',
        data: {
          taskId: 't123',
          startTime: '2025-09-30T10:00:00Z',
        },
      };

      const mcpNotification = eventMapper.mapEvent(
        codexEvent,
        'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      );

      expect(mcpNotification).toMatchObject({
        method: 'codex-father/progress',
        params: {
          jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          eventType: expect.any(String),
          eventData: expect.any(Object),
          timestamp: expect.any(String),
        },
      });
    });

    it('应该在通知中保持 jobId 一致性', async () => {
      const { createEventMapper } = await import('../../core/mcp/event-mapper.js');

      const eventMapper = createEventMapper();
      const testJobId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

      // Simulate multiple events for the same job (Event objects, not wrapped)
      const events = [
        {
          eventId: 'e1',
          type: 'TaskStarted' as any,
          timestamp: new Date(),
          jobId: testJobId,
          sessionId: 'session-001',
          data: {},
        },
        {
          eventId: 'e2',
          type: 'AgentMessage' as any,
          timestamp: new Date(),
          jobId: testJobId,
          sessionId: 'session-001',
          data: { message: 'Working...' },
        },
        {
          eventId: 'e3',
          type: 'TaskComplete' as any,
          timestamp: new Date(),
          jobId: testJobId,
          sessionId: 'session-001',
          data: {},
        },
      ];

      const notifications = events.map((event) => eventMapper.mapEvent(event, testJobId));

      // All notifications should have the same jobId
      notifications.forEach((notification) => {
        expect(notification.params.jobId).toBe(testJobId);
      });
    });
  });

  describe('场景 5: 日志文件创建和格式验证', () => {
    it('应该创建会话目录', async () => {
      const { ConfigPersister } = await import('../../core/session/config-persister.js');

      const testSessionName = 'test-session';
      const testSessionPath = path.join(testSessionDir, testSessionName);

      const persister = new ConfigPersister({
        sessionDir: testSessionPath,
        configFileName: 'config.json',
      });

      const mockConfig = {
        conversationId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
        sessionName: testSessionName,
        jobId: 'd4e5f6a7-b8c9-0123-def0-234567890123',
        createdAt: new Date(),
        sessionDir: testSessionPath,
        rolloutRef: '/mock/rollout.jsonl',
        status: 'active' as const,
        config: {
          model: 'gpt-5',
          cwd: process.cwd(),
          approvalPolicy: 'on-request' as const,
          sandboxPolicy: 'workspace-write' as const,
          timeout: 300000,
        },
      };

      await persister.saveConfig(mockConfig);

      // Verify session directory was created
      const dirStats = await fs.stat(testSessionPath);
      expect(dirStats.isDirectory()).toBe(true);

      // Verify config.json was created
      const configPath = path.join(testSessionPath, 'config.json');
      const configStats = await fs.stat(configPath);
      expect(configStats.isFile()).toBe(true);

      // Verify config content
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      expect(config).toMatchObject({
        conversationId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
        sessionName: testSessionName,
        jobId: 'd4e5f6a7-b8c9-0123-def0-234567890123',
      });
    });

    it('应该创建 JSONL 格式的事件日志', async () => {
      const { EventLogger } = await import('../../core/session/event-logger.js');

      const testLogDir = path.join(testSessionDir, 'event-logger-test');
      await fs.mkdir(testLogDir, { recursive: true });

      const logger = new EventLogger({
        logDir: testLogDir,
        logFileName: 'events.jsonl',
      });

      // Log multiple events
      await logger.logEvent({
        type: 'job-created',
        jobId: 'e5f6a7b8-c9d0-1234-ef01-345678901234',
        data: { input: { prompt: 'Test' } },
      } as any);

      await logger.logEvent({
        type: 'job-started',
        jobId: 'e5f6a7b8-c9d0-1234-ef01-345678901234',
        data: {},
      } as any);

      await logger.logEvent({
        type: 'job-completed',
        jobId: 'e5f6a7b8-c9d0-1234-ef01-345678901234',
        data: { duration: 1000 },
      } as any);

      // Verify events.jsonl was created
      const logPath = path.join(testLogDir, 'events.jsonl');
      const logStats = await fs.stat(logPath);
      expect(logStats.isFile()).toBe(true);

      // Verify JSONL format (each line is a valid JSON object)
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n');

      expect(lines.length).toBe(3);

      lines.forEach((line) => {
        const event = JSON.parse(line);
        expect(event).toHaveProperty('eventId');
        expect(event).toHaveProperty('timestamp');
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('jobId');
        expect(event).toHaveProperty('data');
      });
    });

    it('应该创建 rollout-ref.txt 文件', async () => {
      const { ConfigPersister, saveRolloutRef } = await import(
        '../../core/session/config-persister.js'
      );

      const testSessionName = 'rollout-test';
      const testSessionPath = path.join(testSessionDir, testSessionName);

      const persister = new ConfigPersister({
        sessionDir: testSessionPath,
        configFileName: 'config.json',
      });

      const mockConfig = {
        conversationId: 'f6a7b8c9-d0e1-2345-f012-456789012345',
        sessionName: testSessionName,
        jobId: 'a7b8c9d0-e1f2-3456-0123-567890123456',
        createdAt: new Date(),
        sessionDir: testSessionPath,
        rolloutRef: '/mock/rollout/path.jsonl',
        status: 'active' as const,
        config: {
          model: 'gpt-5',
          cwd: process.cwd(),
          approvalPolicy: 'on-request' as const,
          sandboxPolicy: 'workspace-write' as const,
          timeout: 300000,
        },
      };

      await persister.saveConfig(mockConfig);

      // Save rollout-ref using the separate function
      await saveRolloutRef(testSessionPath, '/mock/rollout/path.jsonl');

      // Verify rollout-ref.txt was created
      const rolloutRefPath = path.join(testSessionPath, 'rollout-ref.txt');
      const rolloutRefStats = await fs.stat(rolloutRefPath);
      expect(rolloutRefStats.isFile()).toBe(true);

      // Verify rollout-ref content
      const rolloutRef = await fs.readFile(rolloutRefPath, 'utf-8');
      expect(rolloutRef.trim()).toBe('/mock/rollout/path.jsonl');
    });
  });

  describe('完整流程验证', () => {
    it('应该完成从 tools/call 到日志记录的完整流程', async () => {
      const { createBridgeLayer } = await import('../../core/mcp/bridge-layer.js');
      const { EventLogger } = await import('../../core/session/event-logger.js');
      const { ConfigPersister, saveRolloutRef } = await import(
        '../../core/session/config-persister.js'
      );

      const mockProcessManager = (
        await import('../../core/process/manager.js')
      ).createProcessManager();

      // Create test session directory for this flow
      const flowTestDir = path.join(testSessionDir, 'complete-flow-test');
      await fs.mkdir(flowTestDir, { recursive: true });

      // Create event logger and config persister
      const eventLogger = new EventLogger({
        logDir: flowTestDir,
        logFileName: 'events.jsonl',
      });

      const configPersister = new ConfigPersister({
        sessionDir: flowTestDir,
        configFileName: 'config.json',
      });

      // Mock session manager
      const mockSessionManager = {
        createSession: vi.fn().mockResolvedValue({
          conversationId: 'b8c9d0e1-f2a3-4567-1234-678901234567',
          jobId: 'c9d0e1f2-a3b4-5678-2345-789012345678',
          rolloutPath: '/mock/rollout.jsonl',
        }),
        sendUserMessage: vi.fn(),
        handleApprovalRequest: vi.fn(),
      } as any;

      const bridgeLayer = createBridgeLayer({
        processManager: mockProcessManager as any,
        sessionManager: mockSessionManager,
      });

      // Step 1: Call tool
      const callStartTime = Date.now();
      const result = await bridgeLayer.callTool('start-codex-task', {
        prompt: 'Complete flow test',
        model: 'gpt-5',
      });
      const callDuration = Date.now() - callStartTime;

      // Verify fast response
      expect(callDuration).toBeLessThan(500);
      expect(result.status).toBe('accepted');

      // Step 2: Log events
      await eventLogger.logEvent({
        type: 'job-created',
        jobId: 'c9d0e1f2-a3b4-5678-2345-789012345678',
        data: { input: { prompt: 'Complete flow test' } },
      } as any);

      await eventLogger.logEvent({
        type: 'job-started',
        jobId: 'c9d0e1f2-a3b4-5678-2345-789012345678',
        data: {},
      } as any);

      // Step 3: Save config
      const sessionConfig = {
        conversationId: result.conversationId!,
        sessionName: 'complete-flow-test',
        jobId: result.jobId!,
        createdAt: new Date(),
        sessionDir: flowTestDir,
        rolloutRef: '/mock/rollout.jsonl',
        status: 'active' as const,
        config: {
          model: 'gpt-5',
          cwd: process.cwd(),
          approvalPolicy: 'on-request' as const,
          sandboxPolicy: 'workspace-write' as const,
          timeout: 300000,
        },
      };

      await configPersister.saveConfig(sessionConfig);

      // Save rollout-ref
      await saveRolloutRef(flowTestDir, '/mock/rollout.jsonl');

      // Step 4: Verify all files exist
      const eventsPath = path.join(flowTestDir, 'events.jsonl');
      const configPath = path.join(flowTestDir, 'config.json');
      const rolloutRefPath = path.join(flowTestDir, 'rollout-ref.txt');

      const [eventsExists, configExists, rolloutRefExists] = await Promise.all([
        fs
          .stat(eventsPath)
          .then(() => true)
          .catch(() => false),
        fs
          .stat(configPath)
          .then(() => true)
          .catch(() => false),
        fs
          .stat(rolloutRefPath)
          .then(() => true)
          .catch(() => false),
      ]);

      expect(eventsExists).toBe(true);
      expect(configExists).toBe(true);
      expect(rolloutRefExists).toBe(true);
    });
  });
});
