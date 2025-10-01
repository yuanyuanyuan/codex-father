/**
 * 类型定义单元测试
 *
 * 验证 core/lib/types.ts 中的类型定义和 Zod schema 是否正确工作
 */

import { describe, it, expect } from 'vitest';
import {
  // Enums
  JobStatus,
  SessionStatus,
  ApprovalMode,
  SandboxPolicy,
  ApprovalType,
  ApprovalStatus,
  ApprovalDecision,
  FileChangeType,
  EventType,
  ToolResultStatus,
  MCPEventType,
  SingleProcessStatus,
  ProcessStatus,
  // Interfaces
  Job,
  Session,
  ApprovalRequest,
  Event,
  ToolResult,
  MCPNotification,
  WhitelistRule,
  // Schemas
  JobSchema,
  SessionSchema,
  ApprovalRequestSchema,
  EventSchema,
  // Helper functions
  parseJob,
  parseSession,
  parseApprovalRequest,
  parseEvent,
  isValidJobStatusTransition,
  isValidSessionStatusTransition,
  getDefaultWhitelist,
} from '../types.js';

describe('Job 类型定义', () => {
  it('应验证 JobStatus 枚举值', () => {
    expect(JobStatus.PENDING).toBe('pending');
    expect(JobStatus.RUNNING).toBe('running');
    expect(JobStatus.COMPLETED).toBe('completed');
    expect(JobStatus.FAILED).toBe('failed');
    expect(JobStatus.CANCELLED).toBe('cancelled');
    expect(JobStatus.TIMEOUT).toBe('timeout');
  });

  it('应通过 Zod schema 验证有效的 Job 数据', () => {
    const validJob: Job = {
      jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      requestId: 'req-001',
      conversationId: 'f0e1d2c3-b4a5-9876-5432-10fedcba9876',
      status: JobStatus.PENDING,
      createdAt: new Date('2025-09-30T10:00:00Z'),
      updatedAt: new Date('2025-09-30T10:00:00Z'),
      input: {
        prompt: 'Fix the authentication bug',
        model: 'gpt-5',
        cwd: '/data/codex-father',
        approvalPolicy: ApprovalMode.ON_REQUEST,
        sandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
        timeout: 3600000,
      },
    };

    const result = JobSchema.safeParse(validJob);
    expect(result.success).toBe(true);
  });

  it('应拒绝无效的 Job 数据 (缺少必需字段)', () => {
    const invalidJob = {
      jobId: 'invalid-uuid', // 无效的 UUID
      requestId: '',
      status: 'invalid-status',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: {
        prompt: '', // 空字符串
      },
    };

    const result = JobSchema.safeParse(invalidJob);
    expect(result.success).toBe(false);
  });

  it('应验证 parseJob 辅助函数', () => {
    const validData = {
      jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      requestId: 'req-001',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      input: {
        prompt: 'Test task',
      },
    };

    expect(() => parseJob(validData)).not.toThrow();

    const invalidData = { jobId: 'invalid' };
    expect(() => parseJob(invalidData)).toThrow();
  });
});

describe('Session 类型定义', () => {
  it('应验证 SessionStatus 枚举值', () => {
    expect(SessionStatus.INITIALIZING).toBe('initializing');
    expect(SessionStatus.ACTIVE).toBe('active');
    expect(SessionStatus.IDLE).toBe('idle');
    expect(SessionStatus.RECOVERING).toBe('recovering');
    expect(SessionStatus.TERMINATED).toBe('terminated');
  });

  it('应通过 Zod schema 验证有效的 Session 数据', () => {
    const validSession: Session = {
      conversationId: 'c7b0a1d2-e3f4-5678-90ab-cdef12345678',
      sessionName: 'feature-auth-fix',
      jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      createdAt: new Date('2025-09-30T10:00:00Z'),
      sessionDir: '/data/codex-father/.codex-father/sessions/feature-auth-fix',
      rolloutRef: '/home/user/.codex/sessions/c7b0a1d2-e3f4-5678-90ab-cdef12345678.jsonl',
      status: SessionStatus.ACTIVE,
      config: {
        model: 'gpt-5',
        cwd: '/data/codex-father',
        approvalPolicy: ApprovalMode.ON_REQUEST,
        sandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
        timeout: 3600000,
      },
    };

    const result = SessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });
});

describe('ApprovalRequest 类型定义', () => {
  it('应验证 ApprovalType 枚举值', () => {
    expect(ApprovalType.EXEC_COMMAND).toBe('exec-command');
    expect(ApprovalType.APPLY_PATCH).toBe('apply-patch');
  });

  it('应验证 ApprovalStatus 枚举值', () => {
    expect(ApprovalStatus.PENDING).toBe('pending');
    expect(ApprovalStatus.APPROVED).toBe('approved');
    expect(ApprovalStatus.DENIED).toBe('denied');
    expect(ApprovalStatus.AUTO_APPROVED).toBe('auto-approved');
  });

  it('应验证 ApprovalDecision 枚举值', () => {
    expect(ApprovalDecision.ALLOW).toBe('allow');
    expect(ApprovalDecision.DENY).toBe('deny');
  });

  it('应通过 Zod schema 验证命令执行审批', () => {
    const validApproval: ApprovalRequest = {
      requestId: 'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
      jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      type: ApprovalType.EXEC_COMMAND,
      createdAt: new Date('2025-09-30T10:01:00Z'),
      status: ApprovalStatus.PENDING,
      details: {
        command: 'rm -rf build',
        cwd: '/data/codex-father',
        reason: 'Clean build artifacts',
      },
    };

    const result = ApprovalRequestSchema.safeParse(validApproval);
    if (!result.success) {
      console.log('Validation errors:', JSON.stringify(result.error.errors, null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('应通过 Zod schema 验证文件补丁审批', () => {
    const validApproval: ApprovalRequest = {
      requestId: 'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
      jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      type: ApprovalType.APPLY_PATCH,
      createdAt: new Date('2025-09-30T10:01:00Z'),
      status: ApprovalStatus.PENDING,
      details: {
        fileChanges: [
          {
            path: 'src/auth.ts',
            type: FileChangeType.MODIFY,
            diff: '+ added line\n- removed line',
          },
        ],
        reason: 'Fix authentication bug',
      },
    };

    const result = ApprovalRequestSchema.safeParse(validApproval);
    expect(result.success).toBe(true);
  });
});

describe('Event 类型定义', () => {
  it('应验证 EventType 包含所有预期的事件类型', () => {
    // 作业生命周期
    expect(EventType.JOB_CREATED).toBe('job-created');
    expect(EventType.JOB_STARTED).toBe('job-started');
    expect(EventType.JOB_COMPLETED).toBe('job-completed');
    expect(EventType.JOB_FAILED).toBe('job-failed');
    expect(EventType.JOB_CANCELLED).toBe('job-cancelled');
    expect(EventType.JOB_TIMEOUT).toBe('job-timeout');

    // 会话生命周期
    expect(EventType.SESSION_CREATED).toBe('session-created');
    expect(EventType.SESSION_ACTIVE).toBe('session-active');
    expect(EventType.SESSION_IDLE).toBe('session-idle');
    expect(EventType.SESSION_RECOVERING).toBe('session-recovering');
    expect(EventType.SESSION_TERMINATED).toBe('session-terminated');

    // 审批事件
    expect(EventType.APPROVAL_REQUESTED).toBe('approval-requested');
    expect(EventType.APPROVAL_APPROVED).toBe('approval-approved');
    expect(EventType.APPROVAL_DENIED).toBe('approval-denied');
    expect(EventType.APPROVAL_AUTO_APPROVED).toBe('approval-auto-approved');

    // Codex 事件
    expect(EventType.CODEX_TASK_STARTED).toBe('codex-task-started');
    expect(EventType.CODEX_AGENT_MESSAGE).toBe('codex-agent-message');
    expect(EventType.CODEX_TASK_COMPLETE).toBe('codex-task-complete');
    expect(EventType.CODEX_TASK_ERROR).toBe('codex-task-error');
  });

  it('应通过 Zod schema 验证有效的 Event 数据', () => {
    const validEvent: Event = {
      eventId: 'e1a2b3c4-d5e6-7890-abcd-ef1234567890',
      timestamp: new Date('2025-09-30T10:00:00Z'),
      jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      type: EventType.JOB_CREATED,
      data: {
        input: {
          prompt: 'Fix bug',
        },
      },
    };

    const result = EventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });
});

describe('状态转换验证', () => {
  it('应验证合法的 Job 状态转换', () => {
    expect(isValidJobStatusTransition(JobStatus.PENDING, JobStatus.RUNNING)).toBe(true);
    expect(isValidJobStatusTransition(JobStatus.RUNNING, JobStatus.COMPLETED)).toBe(true);
    expect(isValidJobStatusTransition(JobStatus.RUNNING, JobStatus.FAILED)).toBe(true);
    expect(isValidJobStatusTransition(JobStatus.RUNNING, JobStatus.CANCELLED)).toBe(true);
    expect(isValidJobStatusTransition(JobStatus.RUNNING, JobStatus.TIMEOUT)).toBe(true);
  });

  it('应拒绝非法的 Job 状态转换', () => {
    expect(isValidJobStatusTransition(JobStatus.COMPLETED, JobStatus.RUNNING)).toBe(false);
    expect(isValidJobStatusTransition(JobStatus.FAILED, JobStatus.PENDING)).toBe(false);
    expect(isValidJobStatusTransition(JobStatus.PENDING, JobStatus.COMPLETED)).toBe(false);
  });

  it('应验证合法的 Session 状态转换', () => {
    expect(isValidSessionStatusTransition(SessionStatus.INITIALIZING, SessionStatus.ACTIVE)).toBe(
      true
    );
    expect(isValidSessionStatusTransition(SessionStatus.ACTIVE, SessionStatus.IDLE)).toBe(true);
    expect(isValidSessionStatusTransition(SessionStatus.IDLE, SessionStatus.ACTIVE)).toBe(true);
    expect(isValidSessionStatusTransition(SessionStatus.ACTIVE, SessionStatus.TERMINATED)).toBe(
      true
    );
  });

  it('应拒绝非法的 Session 状态转换', () => {
    expect(isValidSessionStatusTransition(SessionStatus.TERMINATED, SessionStatus.ACTIVE)).toBe(
      false
    );
    expect(isValidSessionStatusTransition(SessionStatus.INITIALIZING, SessionStatus.IDLE)).toBe(
      false
    );
  });
});

describe('默认白名单规则', () => {
  it('应返回预定义的白名单规则', () => {
    const whitelist = getDefaultWhitelist();

    expect(whitelist).toBeInstanceOf(Array);
    expect(whitelist.length).toBeGreaterThan(0);

    // 验证包含常见的安全命令
    const patterns = whitelist.map((rule) => rule.pattern);
    expect(patterns).toContain('^git status');
    expect(patterns).toContain('^git diff');
    expect(patterns).toContain('^git log');
    expect(patterns).toContain('^ls ');
    expect(patterns).toContain('^cat ');
  });

  it('应默认禁用高风险命令', () => {
    const whitelist = getDefaultWhitelist();
    const npmInstall = whitelist.find((rule) => rule.pattern === '^npm install$');

    expect(npmInstall).toBeDefined();
    expect(npmInstall?.enabled).toBe(false);
    expect(npmInstall?.reason).toContain('HIGH RISK');
  });
});

describe('MCP Bridge Layer 类型', () => {
  it('应验证 ToolResultStatus 枚举值', () => {
    expect(ToolResultStatus.ACCEPTED).toBe('accepted');
    expect(ToolResultStatus.REJECTED).toBe('rejected');
  });

  it('应验证 MCPEventType 枚举值', () => {
    expect(MCPEventType.TASK_STARTED).toBe('task-started');
    expect(MCPEventType.AGENT_MESSAGE).toBe('agent-message');
    expect(MCPEventType.TASK_COMPLETE).toBe('task-complete');
    expect(MCPEventType.TASK_ERROR).toBe('task-error');
    expect(MCPEventType.APPROVAL_REQUIRED).toBe('approval-required');
  });

  it('应验证 ToolResult 接口结构', () => {
    const toolResult: ToolResult = {
      status: ToolResultStatus.ACCEPTED,
      jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      conversationId: 'c7b0a1d2-e3f4-5678-90ab-cdef12345678',
      message: 'Task queued, progress will be sent via notifications',
    };

    expect(toolResult.status).toBe('accepted');
    expect(toolResult.jobId).toBeDefined();
    expect(toolResult.message).toBeDefined();
  });

  it('应验证 MCPNotification 接口结构', () => {
    const notification: MCPNotification = {
      method: 'codex-father/progress',
      params: {
        jobId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        eventType: MCPEventType.TASK_STARTED,
        eventData: {
          taskId: 't123',
          startTime: '2025-09-30T10:00:00Z',
        },
        timestamp: new Date('2025-09-30T10:00:00Z'),
      },
    };

    expect(notification.method).toBe('codex-father/progress');
    expect(notification.params.jobId).toBeDefined();
    expect(notification.params.eventType).toBe('task-started');
  });
});

describe('Process Manager 类型', () => {
  it('应验证 SingleProcessStatus 枚举值', () => {
    expect(SingleProcessStatus.STARTING).toBe('starting');
    expect(SingleProcessStatus.READY).toBe('ready');
    expect(SingleProcessStatus.RESTARTING).toBe('restarting');
    expect(SingleProcessStatus.STOPPED).toBe('stopped');
  });

  it('应验证 ProcessStatus 枚举值', () => {
    expect(ProcessStatus.IDLE).toBe('idle');
    expect(ProcessStatus.BUSY).toBe('busy');
    expect(ProcessStatus.CRASHED).toBe('crashed');
  });
});
