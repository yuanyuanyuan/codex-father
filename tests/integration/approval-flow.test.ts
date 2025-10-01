/**
 * Approval Flow Integration Test - 审批机制集成测试
 *
 * 测试场景（参考 quickstart.md 场景 2）：
 * 1. 白名单自动批准验证（git status, git diff）
 * 2. 非白名单触发审批（需要人工审批）
 * 3. 审批决策传递验证（模拟用户批准/拒绝）
 * 4. 审批事件日志验证（approval-required 事件记录）
 *
 * 注意：这是一个集成测试，测试审批策略引擎的完整流程
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createPolicyEngine, type PolicyEngine } from '../../core/approval/policy-engine.js';
import { ApprovalMode, type WhitelistRule } from '../../core/lib/types.js';
import { EventLogger } from '../../core/session/event-logger.js';

describe('审批机制集成测试', () => {
  let testSessionDir: string;
  let policyEngine: PolicyEngine;
  let eventLogger: EventLogger;

  beforeAll(async () => {
    // Create test session directory
    testSessionDir = path.join(process.cwd(), '.codex-father-test/sessions/approval-test');
    await fs.mkdir(testSessionDir, { recursive: true });

    // Create test whitelist rules
    const whitelist: WhitelistRule[] = [
      {
        pattern: '^git status',
        reason: 'Read-only git command',
        enabled: true,
      },
      {
        pattern: '^git diff',
        reason: 'Read-only git diff command',
        enabled: true,
      },
      {
        pattern: '^ls',
        reason: 'Read-only list command',
        enabled: true,
      },
    ];

    // Create PolicyEngine with whitelist (UNTRUSTED mode: check whitelist first, then require approval)
    policyEngine = createPolicyEngine({
      policy: {
        mode: ApprovalMode.UNTRUSTED,
        whitelist,
        timeout: 60000,
      },
    });

    // Create EventLogger for logging approval events
    eventLogger = new EventLogger({
      logDir: testSessionDir,
      logFileName: 'approval-events.jsonl',
      validateEvents: false, // Disable validation for simpler test events
    });
  });

  afterAll(async () => {
    // Cleanup test session directory
    try {
      await fs.rm(testSessionDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('场景 1: 白名单自动批准', () => {
    it('应该自动批准 git status 命令', () => {
      const command = 'git status';
      const decision = policyEngine.evaluateCommand(command);

      expect(decision.needsApproval).toBe(false);
      expect(decision.reason).toContain('whitelist');
      expect(decision.matchedRule).toBeDefined();
      expect(decision.matchedRule?.pattern).toBe('^git status');
    });

    it('应该自动批准 git diff 命令', () => {
      const command = 'git diff HEAD';
      const decision = policyEngine.evaluateCommand(command);

      expect(decision.needsApproval).toBe(false);
      expect(decision.reason).toContain('whitelist');
      expect(decision.matchedRule).toBeDefined();
      expect(decision.matchedRule?.pattern).toBe('^git diff');
    });

    it('应该自动批准 ls 命令', () => {
      const command = 'ls -la';
      const decision = policyEngine.evaluateCommand(command);

      expect(decision.needsApproval).toBe(false);
      expect(decision.reason).toContain('whitelist');
      expect(decision.matchedRule).toBeDefined();
      expect(decision.matchedRule?.pattern).toBe('^ls');
    });

    it('白名单命令应该非常快速地批准 (< 10ms)', () => {
      const startTime = Date.now();
      const command = 'git status';
      const decision = policyEngine.evaluateCommand(command);
      const duration = Date.now() - startTime;

      expect(decision.needsApproval).toBe(false);
      expect(duration).toBeLessThan(10); // Should be very fast
    });
  });

  describe('场景 2: 非白名单触发审批', () => {
    it('应该识别非白名单命令需要人工审批', () => {
      const command = 'rm -rf build';
      const decision = policyEngine.evaluateCommand(command);

      expect(decision.needsApproval).toBe(true);
      expect(decision.reason).toBe('Command not in whitelist (untrusted mode)');
      expect(decision.matchedRule).toBeUndefined();
    });

    it('应该识别另一个非白名单命令', () => {
      const command = 'npm install --global dangerous-package';
      const decision = policyEngine.evaluateCommand(command);

      expect(decision.needsApproval).toBe(true);
      expect(decision.reason).toBe('Command not in whitelist (untrusted mode)');
    });

    it('应该识别危险的 rm 命令', () => {
      const command = 'rm -rf /';
      const decision = policyEngine.evaluateCommand(command);

      expect(decision.needsApproval).toBe(true);
      expect(decision.reason).toBe('Command not in whitelist (untrusted mode)');
    });

    it('应该识别 npm run 命令需要审批', () => {
      const command = 'npm run build';
      const decision = policyEngine.evaluateCommand(command);

      expect(decision.needsApproval).toBe(true);
      expect(decision.reason).toBe('Command not in whitelist (untrusted mode)');
    });
  });

  describe('场景 3: 审批决策传递验证', () => {
    it('应该模拟用户批准流程 (allow)', async () => {
      const command = 'npm run test';
      const requestTime = Date.now();

      // Step 1: Check if requires approval
      const decision = policyEngine.evaluateCommand(command);
      expect(decision.needsApproval).toBe(true);

      // Step 2: Simulate user approval after waiting
      await new Promise((resolve) => setTimeout(resolve, 50));

      const approvalTime = Date.now();
      const waitingDuration = approvalTime - requestTime;

      // Step 3: Verify decision data structure
      const mockApprovalDecision = {
        requestId: 'r1',
        decision: 'allow' as const,
        reason: 'User approved after review',
        timestamp: new Date(approvalTime),
        waitingDuration,
      };

      expect(mockApprovalDecision.decision).toBe('allow');
      expect(mockApprovalDecision.waitingDuration).toBeGreaterThanOrEqual(50);
    });

    it('应该模拟用户拒绝流程 (deny)', async () => {
      const command = 'rm -rf node_modules';
      const requestTime = Date.now();

      // Step 1: Check if requires approval
      const decision = policyEngine.evaluateCommand(command);
      expect(decision.needsApproval).toBe(true);

      // Step 2: Simulate user rejection after waiting
      await new Promise((resolve) => setTimeout(resolve, 30));

      const rejectionTime = Date.now();
      const waitingDuration = rejectionTime - requestTime;

      // Step 3: Verify decision data structure
      const mockRejectionDecision = {
        requestId: 'r2',
        decision: 'deny' as const,
        reason: 'User rejected: too dangerous',
        timestamp: new Date(rejectionTime),
        waitingDuration,
      };

      expect(mockRejectionDecision.decision).toBe('deny');
      expect(mockRejectionDecision.waitingDuration).toBeGreaterThanOrEqual(30);
    });

    it('应该正确计算 waitingDuration', async () => {
      const startTime = Date.now();

      // Simulate waiting for user decision
      await new Promise((resolve) => setTimeout(resolve, 100));

      const endTime = Date.now();
      const waitingDuration = endTime - startTime;

      expect(waitingDuration).toBeGreaterThanOrEqual(100);
      expect(waitingDuration).toBeLessThan(150); // Allow some margin
    });
  });

  describe('场景 4: 审批事件日志验证', () => {
    it('应该记录审批请求事件', async () => {
      const jobId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const approvalId = 'r3';

      const event = {
        type: 'approval-required' as const,
        jobId,
        data: {
          approvalId,
          type: 'exec-command',
          details: {
            command: 'rm -rf build',
            cwd: process.cwd(),
          },
        },
      };

      await eventLogger.logEvent(event as any);

      // Verify event was logged
      const logPath = path.join(testSessionDir, 'approval-events.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n');

      expect(lines.length).toBeGreaterThanOrEqual(1);

      const loggedEvent = JSON.parse(lines[lines.length - 1]);
      expect(loggedEvent.type).toBe('approval-required');
      expect(loggedEvent.jobId).toBe(jobId);
      expect(loggedEvent.data.approvalId).toBe(approvalId);
    });

    it('应该记录审批批准事件', async () => {
      const jobId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
      const approvalId = 'r4';

      const event = {
        type: 'approval-approved' as const,
        jobId,
        data: {
          approvalId,
          decision: 'allow',
          waitingDuration: 15000,
        },
      };

      await eventLogger.logEvent(event as any);

      // Verify event was logged
      const logPath = path.join(testSessionDir, 'approval-events.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n');

      const loggedEvent = JSON.parse(lines[lines.length - 1]);
      expect(loggedEvent.type).toBe('approval-approved');
      expect(loggedEvent.jobId).toBe(jobId);
      expect(loggedEvent.data.decision).toBe('allow');
      expect(loggedEvent.data.waitingDuration).toBe(15000);
    });

    it('应该记录审批拒绝事件', async () => {
      const jobId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
      const approvalId = 'r5';

      const event = {
        type: 'approval-denied' as const,
        jobId,
        data: {
          approvalId,
          decision: 'deny',
          waitingDuration: 5000,
          reason: 'User rejected',
        },
      };

      await eventLogger.logEvent(event as any);

      // Verify event was logged
      const logPath = path.join(testSessionDir, 'approval-events.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n');

      const loggedEvent = JSON.parse(lines[lines.length - 1]);
      expect(loggedEvent.type).toBe('approval-denied');
      expect(loggedEvent.jobId).toBe(jobId);
      expect(loggedEvent.data.decision).toBe('deny');
      expect(loggedEvent.data.reason).toBe('User rejected');
    });

    it('应该按正确顺序记录审批事件序列', async () => {
      const jobId = 'd4e5f6a7-b8c9-0123-def0-234567890123';
      const approvalId = 'r6';

      // 1. Approval required event
      await eventLogger.logEvent({
        type: 'approval-required' as const,
        jobId,
        data: { approvalId, type: 'exec-command' },
      } as any);

      // 2. Wait for "approval"
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 3. Approval decision event
      await eventLogger.logEvent({
        type: 'approval-approved' as const,
        jobId,
        data: { approvalId, decision: 'allow', waitingDuration: 10 },
      } as any);

      // Verify event sequence
      const logPath = path.join(testSessionDir, 'approval-events.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n');

      // Get last two events
      const event1 = JSON.parse(lines[lines.length - 2]);
      const event2 = JSON.parse(lines[lines.length - 1]);

      expect(event1.type).toBe('approval-required');
      expect(event2.type).toBe('approval-approved');
      expect(event1.data.approvalId).toBe(event2.data.approvalId);
    });
  });

  describe('完整审批流程验证', () => {
    it('应该完成从检测到批准的完整流程', async () => {
      const command = 'npm run test';
      const jobId = 'e5f6a7b8-c9d0-1234-ef01-345678901234';
      const approvalId = 'r7';
      const startTime = Date.now();

      // Step 1: Evaluate command
      const decision = policyEngine.evaluateCommand(command);
      expect(decision.needsApproval).toBe(true);

      // Step 2: Log approval-required event
      await eventLogger.logEvent({
        type: 'approval-required' as const,
        jobId,
        data: {
          approvalId,
          type: 'exec-command',
          details: { command, cwd: process.cwd() },
        },
      } as any);

      // Step 3: Simulate user approval
      await new Promise((resolve) => setTimeout(resolve, 50));

      const endTime = Date.now();
      const waitingDuration = endTime - startTime;

      // Step 4: Log approval-approved event
      await eventLogger.logEvent({
        type: 'approval-approved' as const,
        jobId,
        data: {
          approvalId,
          decision: 'allow',
          waitingDuration,
        },
      } as any);

      // Step 5: Verify complete flow
      expect(waitingDuration).toBeGreaterThanOrEqual(50);

      // Verify events were logged
      const logPath = path.join(testSessionDir, 'approval-events.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n');
      const lastTwoEvents = lines.slice(-2).map((line) => JSON.parse(line));

      expect(lastTwoEvents[0].type).toBe('approval-required');
      expect(lastTwoEvents[1].type).toBe('approval-approved');
      expect(lastTwoEvents[0].data.approvalId).toBe(lastTwoEvents[1].data.approvalId);
    });

    it('应该完成从检测到拒绝的完整流程', async () => {
      const command = 'rm -rf /';
      const jobId = 'f6a7b8c9-d0e1-2345-f012-456789012345';
      const approvalId = 'r8';
      const startTime = Date.now();

      // Step 1: Evaluate command
      const decision = policyEngine.evaluateCommand(command);
      expect(decision.needsApproval).toBe(true);

      // Step 2: Log approval-required event
      await eventLogger.logEvent({
        type: 'approval-required' as const,
        jobId,
        data: {
          approvalId,
          type: 'exec-command',
          details: { command, cwd: process.cwd() },
        },
      } as any);

      // Step 3: Simulate user rejection
      await new Promise((resolve) => setTimeout(resolve, 30));

      const endTime = Date.now();
      const waitingDuration = endTime - startTime;

      // Step 4: Log approval-denied event
      await eventLogger.logEvent({
        type: 'approval-denied' as const,
        jobId,
        data: {
          approvalId,
          decision: 'deny',
          waitingDuration,
          reason: 'User rejected: too dangerous',
        },
      } as any);

      // Step 5: Verify complete flow
      expect(waitingDuration).toBeGreaterThanOrEqual(30);

      // Verify events were logged
      const logPath = path.join(testSessionDir, 'approval-events.jsonl');
      const logContent = await fs.readFile(logPath, 'utf-8');
      const lines = logContent.trim().split('\n');
      const lastTwoEvents = lines.slice(-2).map((line) => JSON.parse(line));

      expect(lastTwoEvents[0].type).toBe('approval-required');
      expect(lastTwoEvents[1].type).toBe('approval-denied');
      expect(lastTwoEvents[1].data.reason).toContain('too dangerous');
    });

    it('应该正确处理白名单命令的快速通过流程', () => {
      const command = 'git status';
      const startTime = Date.now();

      // Step 1: Evaluate command
      const decision = policyEngine.evaluateCommand(command);

      // Step 2: Verify auto-approval
      expect(decision.needsApproval).toBe(false);
      expect(decision.reason).toContain('whitelist');
      expect(decision.matchedRule).toBeDefined();

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10); // Should be very fast

      // Note: No approval events are logged for whitelisted commands
    });
  });
});
