import { z } from 'zod';
export declare enum JobStatus {
    PENDING = "pending",
    RUNNING = "running",
    COMPLETED = "completed",
    FAILED = "failed",
    CANCELLED = "cancelled",
    TIMEOUT = "timeout"
}
export interface JobMetrics {
    startTime?: Date;
    endTime?: Date;
    duration?: number;
    approvalCount: number;
    approvalDuration: number;
}
export interface ErrorDetails {
    code: string;
    message: string;
    stack?: string;
    context?: Record<string, unknown>;
}
export declare enum ApprovalMode {
    UNTRUSTED = "untrusted",
    ON_REQUEST = "on-request",
    ON_FAILURE = "on-failure",
    NEVER = "never"
}
export declare enum SandboxPolicy {
    READ_ONLY = "read-only",
    WORKSPACE_WRITE = "workspace-write",
    DANGER_FULL_ACCESS = "danger-full-access"
}
export interface Job {
    jobId: string;
    requestId: string;
    conversationId?: string;
    status: JobStatus;
    createdAt: Date;
    updatedAt: Date;
    input: {
        prompt: string;
        model?: string;
        cwd?: string;
        approvalPolicy?: ApprovalMode;
        sandboxPolicy?: SandboxPolicy;
        timeout?: number;
    };
    output?: {
        result?: string;
        error?: ErrorDetails;
        metrics: JobMetrics;
    };
}
export declare const ErrorDetailsSchema: z.ZodObject<{
    code: z.ZodString;
    message: z.ZodString;
    stack: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    code: string;
    message: string;
    stack?: string | undefined;
    context?: Record<string, unknown> | undefined;
}, {
    code: string;
    message: string;
    stack?: string | undefined;
    context?: Record<string, unknown> | undefined;
}>;
export declare const JobMetricsSchema: z.ZodObject<{
    startTime: z.ZodOptional<z.ZodDate>;
    endTime: z.ZodOptional<z.ZodDate>;
    duration: z.ZodOptional<z.ZodNumber>;
    approvalCount: z.ZodNumber;
    approvalDuration: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    approvalCount: number;
    approvalDuration: number;
    startTime?: Date | undefined;
    endTime?: Date | undefined;
    duration?: number | undefined;
}, {
    approvalCount: number;
    approvalDuration: number;
    startTime?: Date | undefined;
    endTime?: Date | undefined;
    duration?: number | undefined;
}>;
export declare const JobSchema: z.ZodObject<{
    jobId: z.ZodString;
    requestId: z.ZodString;
    conversationId: z.ZodOptional<z.ZodString>;
    status: z.ZodNativeEnum<typeof JobStatus>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
    input: z.ZodObject<{
        prompt: z.ZodString;
        model: z.ZodOptional<z.ZodString>;
        cwd: z.ZodOptional<z.ZodString>;
        approvalPolicy: z.ZodOptional<z.ZodNativeEnum<typeof ApprovalMode>>;
        sandboxPolicy: z.ZodOptional<z.ZodNativeEnum<typeof SandboxPolicy>>;
        timeout: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        prompt: string;
        timeout?: number | undefined;
        model?: string | undefined;
        cwd?: string | undefined;
        approvalPolicy?: ApprovalMode | undefined;
        sandboxPolicy?: SandboxPolicy | undefined;
    }, {
        prompt: string;
        timeout?: number | undefined;
        model?: string | undefined;
        cwd?: string | undefined;
        approvalPolicy?: ApprovalMode | undefined;
        sandboxPolicy?: SandboxPolicy | undefined;
    }>;
    output: z.ZodOptional<z.ZodObject<{
        result: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodObject<{
            code: z.ZodString;
            message: z.ZodString;
            stack: z.ZodOptional<z.ZodString>;
            context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, "strip", z.ZodTypeAny, {
            code: string;
            message: string;
            stack?: string | undefined;
            context?: Record<string, unknown> | undefined;
        }, {
            code: string;
            message: string;
            stack?: string | undefined;
            context?: Record<string, unknown> | undefined;
        }>>;
        metrics: z.ZodObject<{
            startTime: z.ZodOptional<z.ZodDate>;
            endTime: z.ZodOptional<z.ZodDate>;
            duration: z.ZodOptional<z.ZodNumber>;
            approvalCount: z.ZodNumber;
            approvalDuration: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            approvalCount: number;
            approvalDuration: number;
            startTime?: Date | undefined;
            endTime?: Date | undefined;
            duration?: number | undefined;
        }, {
            approvalCount: number;
            approvalDuration: number;
            startTime?: Date | undefined;
            endTime?: Date | undefined;
            duration?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        metrics: {
            approvalCount: number;
            approvalDuration: number;
            startTime?: Date | undefined;
            endTime?: Date | undefined;
            duration?: number | undefined;
        };
        result?: string | undefined;
        error?: {
            code: string;
            message: string;
            stack?: string | undefined;
            context?: Record<string, unknown> | undefined;
        } | undefined;
    }, {
        metrics: {
            approvalCount: number;
            approvalDuration: number;
            startTime?: Date | undefined;
            endTime?: Date | undefined;
            duration?: number | undefined;
        };
        result?: string | undefined;
        error?: {
            code: string;
            message: string;
            stack?: string | undefined;
            context?: Record<string, unknown> | undefined;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: JobStatus;
    createdAt: Date;
    updatedAt: Date;
    jobId: string;
    requestId: string;
    input: {
        prompt: string;
        timeout?: number | undefined;
        model?: string | undefined;
        cwd?: string | undefined;
        approvalPolicy?: ApprovalMode | undefined;
        sandboxPolicy?: SandboxPolicy | undefined;
    };
    conversationId?: string | undefined;
    output?: {
        metrics: {
            approvalCount: number;
            approvalDuration: number;
            startTime?: Date | undefined;
            endTime?: Date | undefined;
            duration?: number | undefined;
        };
        result?: string | undefined;
        error?: {
            code: string;
            message: string;
            stack?: string | undefined;
            context?: Record<string, unknown> | undefined;
        } | undefined;
    } | undefined;
}, {
    status: JobStatus;
    createdAt: Date;
    updatedAt: Date;
    jobId: string;
    requestId: string;
    input: {
        prompt: string;
        timeout?: number | undefined;
        model?: string | undefined;
        cwd?: string | undefined;
        approvalPolicy?: ApprovalMode | undefined;
        sandboxPolicy?: SandboxPolicy | undefined;
    };
    conversationId?: string | undefined;
    output?: {
        metrics: {
            approvalCount: number;
            approvalDuration: number;
            startTime?: Date | undefined;
            endTime?: Date | undefined;
            duration?: number | undefined;
        };
        result?: string | undefined;
        error?: {
            code: string;
            message: string;
            stack?: string | undefined;
            context?: Record<string, unknown> | undefined;
        } | undefined;
    } | undefined;
}>;
export declare enum SessionStatus {
    INITIALIZING = "initializing",
    ACTIVE = "active",
    IDLE = "idle",
    RECOVERING = "recovering",
    TERMINATED = "terminated"
}
export interface Session {
    conversationId: string;
    sessionName: string;
    jobId: string;
    createdAt: Date;
    sessionDir: string;
    rolloutRef: string;
    processId?: number;
    status: SessionStatus;
    config: {
        model: string;
        cwd: string;
        approvalPolicy: ApprovalMode;
        sandboxPolicy: SandboxPolicy;
        timeout: number;
    };
}
export declare const SessionSchema: z.ZodObject<{
    conversationId: z.ZodString;
    sessionName: z.ZodString;
    jobId: z.ZodString;
    createdAt: z.ZodDate;
    sessionDir: z.ZodString;
    rolloutRef: z.ZodString;
    processId: z.ZodOptional<z.ZodNumber>;
    status: z.ZodNativeEnum<typeof SessionStatus>;
    config: z.ZodObject<{
        model: z.ZodString;
        cwd: z.ZodString;
        approvalPolicy: z.ZodNativeEnum<typeof ApprovalMode>;
        sandboxPolicy: z.ZodNativeEnum<typeof SandboxPolicy>;
        timeout: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        timeout: number;
        model: string;
        cwd: string;
        approvalPolicy: ApprovalMode;
        sandboxPolicy: SandboxPolicy;
    }, {
        timeout: number;
        model: string;
        cwd: string;
        approvalPolicy: ApprovalMode;
        sandboxPolicy: SandboxPolicy;
    }>;
}, "strip", z.ZodTypeAny, {
    status: SessionStatus;
    createdAt: Date;
    jobId: string;
    conversationId: string;
    sessionName: string;
    sessionDir: string;
    rolloutRef: string;
    config: {
        timeout: number;
        model: string;
        cwd: string;
        approvalPolicy: ApprovalMode;
        sandboxPolicy: SandboxPolicy;
    };
    processId?: number | undefined;
}, {
    status: SessionStatus;
    createdAt: Date;
    jobId: string;
    conversationId: string;
    sessionName: string;
    sessionDir: string;
    rolloutRef: string;
    config: {
        timeout: number;
        model: string;
        cwd: string;
        approvalPolicy: ApprovalMode;
        sandboxPolicy: SandboxPolicy;
    };
    processId?: number | undefined;
}>;
export declare enum ApprovalType {
    EXEC_COMMAND = "exec-command",
    APPLY_PATCH = "apply-patch"
}
export declare enum ApprovalStatus {
    PENDING = "pending",
    APPROVED = "approved",
    DENIED = "denied",
    AUTO_APPROVED = "auto-approved"
}
export declare enum ApprovalDecision {
    ALLOW = "allow",
    DENY = "deny"
}
export declare enum FileChangeType {
    CREATE = "create",
    MODIFY = "modify",
    DELETE = "delete"
}
export interface FileChange {
    path: string;
    type: FileChangeType;
    contentPreview?: string;
    diff?: string;
}
export interface ExecCommandApproval {
    command: string;
    cwd: string;
    reason?: string;
}
export interface ApplyPatchApproval {
    fileChanges: FileChange[];
    reason?: string;
    grantRoot?: boolean;
}
export interface ApprovalRequest {
    requestId: string;
    jobId: string;
    type: ApprovalType;
    createdAt: Date;
    resolvedAt?: Date;
    status: ApprovalStatus;
    details: ExecCommandApproval | ApplyPatchApproval;
    decision?: ApprovalDecision;
    decisionReason?: string;
    waitingDuration?: number;
}
export declare const FileChangeSchema: z.ZodObject<{
    path: z.ZodString;
    type: z.ZodNativeEnum<typeof FileChangeType>;
    contentPreview: z.ZodOptional<z.ZodString>;
    diff: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: FileChangeType;
    path: string;
    contentPreview?: string | undefined;
    diff?: string | undefined;
}, {
    type: FileChangeType;
    path: string;
    contentPreview?: string | undefined;
    diff?: string | undefined;
}>;
export declare const ExecCommandApprovalSchema: z.ZodObject<{
    command: z.ZodString;
    cwd: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cwd: string;
    command: string;
    reason?: string | undefined;
}, {
    cwd: string;
    command: string;
    reason?: string | undefined;
}>;
export declare const ApplyPatchApprovalSchema: z.ZodObject<{
    fileChanges: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        type: z.ZodNativeEnum<typeof FileChangeType>;
        contentPreview: z.ZodOptional<z.ZodString>;
        diff: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: FileChangeType;
        path: string;
        contentPreview?: string | undefined;
        diff?: string | undefined;
    }, {
        type: FileChangeType;
        path: string;
        contentPreview?: string | undefined;
        diff?: string | undefined;
    }>, "many">;
    reason: z.ZodOptional<z.ZodString>;
    grantRoot: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    fileChanges: {
        type: FileChangeType;
        path: string;
        contentPreview?: string | undefined;
        diff?: string | undefined;
    }[];
    reason?: string | undefined;
    grantRoot?: boolean | undefined;
}, {
    fileChanges: {
        type: FileChangeType;
        path: string;
        contentPreview?: string | undefined;
        diff?: string | undefined;
    }[];
    reason?: string | undefined;
    grantRoot?: boolean | undefined;
}>;
export declare const ApprovalRequestSchema: z.ZodObject<{
    requestId: z.ZodString;
    jobId: z.ZodString;
    type: z.ZodNativeEnum<typeof ApprovalType>;
    createdAt: z.ZodDate;
    resolvedAt: z.ZodOptional<z.ZodDate>;
    status: z.ZodNativeEnum<typeof ApprovalStatus>;
    details: z.ZodUnion<[z.ZodObject<{
        command: z.ZodString;
        cwd: z.ZodString;
        reason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        cwd: string;
        command: string;
        reason?: string | undefined;
    }, {
        cwd: string;
        command: string;
        reason?: string | undefined;
    }>, z.ZodObject<{
        fileChanges: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            type: z.ZodNativeEnum<typeof FileChangeType>;
            contentPreview: z.ZodOptional<z.ZodString>;
            diff: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: FileChangeType;
            path: string;
            contentPreview?: string | undefined;
            diff?: string | undefined;
        }, {
            type: FileChangeType;
            path: string;
            contentPreview?: string | undefined;
            diff?: string | undefined;
        }>, "many">;
        reason: z.ZodOptional<z.ZodString>;
        grantRoot: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        fileChanges: {
            type: FileChangeType;
            path: string;
            contentPreview?: string | undefined;
            diff?: string | undefined;
        }[];
        reason?: string | undefined;
        grantRoot?: boolean | undefined;
    }, {
        fileChanges: {
            type: FileChangeType;
            path: string;
            contentPreview?: string | undefined;
            diff?: string | undefined;
        }[];
        reason?: string | undefined;
        grantRoot?: boolean | undefined;
    }>]>;
    decision: z.ZodOptional<z.ZodNativeEnum<typeof ApprovalDecision>>;
    decisionReason: z.ZodOptional<z.ZodString>;
    waitingDuration: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type: ApprovalType;
    status: ApprovalStatus;
    createdAt: Date;
    jobId: string;
    requestId: string;
    details: {
        cwd: string;
        command: string;
        reason?: string | undefined;
    } | {
        fileChanges: {
            type: FileChangeType;
            path: string;
            contentPreview?: string | undefined;
            diff?: string | undefined;
        }[];
        reason?: string | undefined;
        grantRoot?: boolean | undefined;
    };
    resolvedAt?: Date | undefined;
    decision?: ApprovalDecision | undefined;
    decisionReason?: string | undefined;
    waitingDuration?: number | undefined;
}, {
    type: ApprovalType;
    status: ApprovalStatus;
    createdAt: Date;
    jobId: string;
    requestId: string;
    details: {
        cwd: string;
        command: string;
        reason?: string | undefined;
    } | {
        fileChanges: {
            type: FileChangeType;
            path: string;
            contentPreview?: string | undefined;
            diff?: string | undefined;
        }[];
        reason?: string | undefined;
        grantRoot?: boolean | undefined;
    };
    resolvedAt?: Date | undefined;
    decision?: ApprovalDecision | undefined;
    decisionReason?: string | undefined;
    waitingDuration?: number | undefined;
}>;
export interface WhitelistRule {
    pattern: string;
    reason: string;
    enabled: boolean;
}
export interface ApprovalPolicy {
    mode: ApprovalMode;
    whitelist: WhitelistRule[];
    timeout?: number;
    autoApprovePatterns?: RegExp[];
}
export declare const WhitelistRuleSchema: z.ZodObject<{
    pattern: z.ZodString;
    reason: z.ZodString;
    enabled: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    reason: string;
    pattern: string;
    enabled: boolean;
}, {
    reason: string;
    pattern: string;
    enabled: boolean;
}>;
export declare const ApprovalPolicySchema: z.ZodObject<{
    mode: z.ZodNativeEnum<typeof ApprovalMode>;
    whitelist: z.ZodArray<z.ZodObject<{
        pattern: z.ZodString;
        reason: z.ZodString;
        enabled: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        reason: string;
        pattern: string;
        enabled: boolean;
    }, {
        reason: string;
        pattern: string;
        enabled: boolean;
    }>, "many">;
    timeout: z.ZodOptional<z.ZodNumber>;
    autoApprovePatterns: z.ZodOptional<z.ZodArray<z.ZodType<RegExp, z.ZodTypeDef, RegExp>, "many">>;
}, "strip", z.ZodTypeAny, {
    mode: ApprovalMode;
    whitelist: {
        reason: string;
        pattern: string;
        enabled: boolean;
    }[];
    timeout?: number | undefined;
    autoApprovePatterns?: RegExp[] | undefined;
}, {
    mode: ApprovalMode;
    whitelist: {
        reason: string;
        pattern: string;
        enabled: boolean;
    }[];
    timeout?: number | undefined;
    autoApprovePatterns?: RegExp[] | undefined;
}>;
export declare enum EventType {
    JOB_CREATED = "job-created",
    JOB_STARTED = "job-started",
    JOB_COMPLETED = "job-completed",
    JOB_FAILED = "job-failed",
    JOB_CANCELLED = "job-cancelled",
    JOB_TIMEOUT = "job-timeout",
    SESSION_CREATED = "session-created",
    SESSION_ACTIVE = "session-active",
    SESSION_IDLE = "session-idle",
    SESSION_RECOVERING = "session-recovering",
    SESSION_TERMINATED = "session-terminated",
    PROCESS_STARTED = "process-started",
    PROCESS_CRASHED = "process-crashed",
    PROCESS_RESTARTED = "process-restarted",
    APPROVAL_REQUESTED = "approval-requested",
    APPROVAL_APPROVED = "approval-approved",
    APPROVAL_DENIED = "approval-denied",
    APPROVAL_AUTO_APPROVED = "approval-auto-approved",
    CODEX_TASK_STARTED = "codex-task-started",
    CODEX_AGENT_MESSAGE = "codex-agent-message",
    CODEX_TASK_COMPLETE = "codex-task-complete",
    CODEX_TASK_ERROR = "codex-task-error"
}
export interface Event {
    eventId: string;
    timestamp: Date;
    jobId?: string;
    sessionId?: string;
    type: EventType;
    data: Record<string, unknown>;
}
export declare const EventSchema: z.ZodObject<{
    eventId: z.ZodString;
    timestamp: z.ZodDate;
    jobId: z.ZodOptional<z.ZodString>;
    sessionId: z.ZodOptional<z.ZodString>;
    type: z.ZodNativeEnum<typeof EventType>;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: EventType;
    eventId: string;
    timestamp: Date;
    data: Record<string, unknown>;
    jobId?: string | undefined;
    sessionId?: string | undefined;
}, {
    type: EventType;
    eventId: string;
    timestamp: Date;
    data: Record<string, unknown>;
    jobId?: string | undefined;
    sessionId?: string | undefined;
}>;
export declare enum ToolResultStatus {
    ACCEPTED = "accepted",
    REJECTED = "rejected"
}
export interface ToolResult {
    status: ToolResultStatus;
    jobId?: string;
    conversationId?: string;
    message: string;
    error?: ErrorDetails;
}
export declare enum MCPEventType {
    TASK_STARTED = "task-started",
    AGENT_MESSAGE = "agent-message",
    TASK_COMPLETE = "task-complete",
    TASK_ERROR = "task-error",
    APPROVAL_REQUIRED = "approval-required"
}
export interface MCPNotification {
    method: 'codex-father/progress';
    params: {
        jobId: string;
        eventType: MCPEventType;
        eventData: Record<string, unknown>;
        timestamp: Date;
    };
}
export declare const ToolResultSchema: z.ZodObject<{
    status: z.ZodNativeEnum<typeof ToolResultStatus>;
    jobId: z.ZodOptional<z.ZodString>;
    conversationId: z.ZodOptional<z.ZodString>;
    message: z.ZodString;
    error: z.ZodOptional<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
        stack: z.ZodOptional<z.ZodString>;
        context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        code: string;
        message: string;
        stack?: string | undefined;
        context?: Record<string, unknown> | undefined;
    }, {
        code: string;
        message: string;
        stack?: string | undefined;
        context?: Record<string, unknown> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: ToolResultStatus;
    message: string;
    error?: {
        code: string;
        message: string;
        stack?: string | undefined;
        context?: Record<string, unknown> | undefined;
    } | undefined;
    jobId?: string | undefined;
    conversationId?: string | undefined;
}, {
    status: ToolResultStatus;
    message: string;
    error?: {
        code: string;
        message: string;
        stack?: string | undefined;
        context?: Record<string, unknown> | undefined;
    } | undefined;
    jobId?: string | undefined;
    conversationId?: string | undefined;
}>;
export declare const MCPNotificationSchema: z.ZodObject<{
    method: z.ZodLiteral<"codex-father/progress">;
    params: z.ZodObject<{
        jobId: z.ZodString;
        eventType: z.ZodNativeEnum<typeof MCPEventType>;
        eventData: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        timestamp: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        jobId: string;
        timestamp: Date;
        eventType: MCPEventType;
        eventData: Record<string, unknown>;
    }, {
        jobId: string;
        timestamp: Date;
        eventType: MCPEventType;
        eventData: Record<string, unknown>;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        jobId: string;
        timestamp: Date;
        eventType: MCPEventType;
        eventData: Record<string, unknown>;
    };
    method: "codex-father/progress";
}, {
    params: {
        jobId: string;
        timestamp: Date;
        eventType: MCPEventType;
        eventData: Record<string, unknown>;
    };
    method: "codex-father/progress";
}>;
export declare enum SingleProcessStatus {
    STARTING = "starting",
    READY = "ready",
    RESTARTING = "restarting",
    STOPPED = "stopped"
}
export declare enum ProcessStatus {
    IDLE = "idle",
    BUSY = "busy",
    CRASHED = "crashed"
}
export interface MetricsSummary {
    periodStart: Date;
    periodEnd: Date;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    cancelledJobs: number;
    timeoutJobs: number;
    avgJobDuration: number;
    p50JobDuration: number;
    p95JobDuration: number;
    p99JobDuration: number;
    totalApprovals: number;
    autoApprovedCount: number;
    manualApprovedCount: number;
    deniedCount: number;
    avgApprovalDuration: number;
    processRestarts: number;
    sessionRecoveries: number;
    errorDistribution: Record<string, number>;
}
export declare const MetricsSummarySchema: z.ZodObject<{
    periodStart: z.ZodDate;
    periodEnd: z.ZodDate;
    totalJobs: z.ZodNumber;
    completedJobs: z.ZodNumber;
    failedJobs: z.ZodNumber;
    cancelledJobs: z.ZodNumber;
    timeoutJobs: z.ZodNumber;
    avgJobDuration: z.ZodNumber;
    p50JobDuration: z.ZodNumber;
    p95JobDuration: z.ZodNumber;
    p99JobDuration: z.ZodNumber;
    totalApprovals: z.ZodNumber;
    autoApprovedCount: z.ZodNumber;
    manualApprovedCount: z.ZodNumber;
    deniedCount: z.ZodNumber;
    avgApprovalDuration: z.ZodNumber;
    processRestarts: z.ZodNumber;
    sessionRecoveries: z.ZodNumber;
    errorDistribution: z.ZodRecord<z.ZodString, z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    periodStart: Date;
    periodEnd: Date;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    cancelledJobs: number;
    timeoutJobs: number;
    avgJobDuration: number;
    p50JobDuration: number;
    p95JobDuration: number;
    p99JobDuration: number;
    totalApprovals: number;
    autoApprovedCount: number;
    manualApprovedCount: number;
    deniedCount: number;
    avgApprovalDuration: number;
    processRestarts: number;
    sessionRecoveries: number;
    errorDistribution: Record<string, number>;
}, {
    periodStart: Date;
    periodEnd: Date;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    cancelledJobs: number;
    timeoutJobs: number;
    avgJobDuration: number;
    p50JobDuration: number;
    p95JobDuration: number;
    p99JobDuration: number;
    totalApprovals: number;
    autoApprovedCount: number;
    manualApprovedCount: number;
    deniedCount: number;
    avgApprovalDuration: number;
    processRestarts: number;
    sessionRecoveries: number;
    errorDistribution: Record<string, number>;
}>;
export declare function parseJob(data: unknown): z.infer<typeof JobSchema>;
export declare function parseSession(data: unknown): z.infer<typeof SessionSchema>;
export declare function parseApprovalRequest(data: unknown): z.infer<typeof ApprovalRequestSchema>;
export declare function parseEvent(data: unknown): z.infer<typeof EventSchema>;
export declare function isValidJobStatusTransition(from: JobStatus, to: JobStatus): boolean;
export declare function isValidSessionStatusTransition(from: SessionStatus, to: SessionStatus): boolean;
export interface CommandContext {
    args: string[];
    options: Record<string, unknown>;
    verbose: boolean;
    dryRun: boolean;
    json: boolean;
    workingDirectory: string;
    configPath: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
}
export interface CommandResult {
    success: boolean;
    message?: string;
    data?: unknown;
    errors?: string[];
    warnings?: string[];
    executionTime: number;
}
export declare function getDefaultWhitelist(): WhitelistRule[];
export interface LogOutput {
    type: 'console' | 'file' | 'syslog';
    path?: string;
    rotation?: boolean;
    maxSize?: string;
}
export interface LoggingConfig {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'text' | 'json';
    outputs: LogOutput[];
}
export interface PerformanceConfig {
    maxExecutionTime: number;
    maxMemoryUsage: number;
    enableProfiling: boolean;
}
export interface SecurityConfig {
    sandboxMode: 'readonly' | 'workspace-write' | 'full';
    auditLogging: boolean;
    redactSensitiveData: boolean;
}
export interface ProjectConfig {
    version: string;
    environment: 'development' | 'testing' | 'production';
    logging: LoggingConfig;
    performance: PerformanceConfig;
    security: SecurityConfig;
}
export type TaskStatus = 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'retrying' | 'cancelled' | 'timeout';
export interface TaskRetryPolicy {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffStrategy: 'linear' | 'exponential' | 'fixed';
    retryableErrors?: string[];
}
export interface TaskMetadata {
    source: string;
    userId?: string;
    sessionId?: string;
    correlationId?: string;
    tags: string[];
    environment: string;
    version: string;
}
export interface TaskDefinition {
    type: string;
    priority: number;
    payload: Record<string, unknown>;
    scheduledAt?: Date;
    timeout?: number;
    retryPolicy?: TaskRetryPolicy;
    metadata?: TaskMetadata;
}
export interface Task {
    id: string;
    type: string;
    priority: number;
    payload: Record<string, unknown>;
    status: TaskStatus;
    createdAt: Date;
    updatedAt: Date;
    scheduledAt?: Date;
    startedAt?: Date;
    completedAt?: Date;
    attempts: number;
    maxAttempts: number;
    lastError?: string;
    result?: unknown;
    error?: string;
    metadata: TaskMetadata;
    timeout: number;
    retryPolicy: TaskRetryPolicy;
}
export interface EnqueueResult {
    taskId: string;
    queuePosition?: number;
    estimatedStartTime?: Date;
    scheduledAt?: Date;
}
export interface CancelResult {
    taskId: string;
    cancelled: boolean;
    reason?: string;
    wasRunning: boolean;
}
export interface RetryResult {
    taskId: string;
    retryScheduled: boolean;
    nextAttemptAt?: Date;
    attemptNumber: number;
    reason?: string;
}
export interface QueueProcessingCapacity {
    maxConcurrent: number;
    currentlyProcessing: number;
    availableSlots: number;
}
export interface QueuePerformanceMetrics {
    throughputPerHour: number;
    averageWaitTime: number;
    successRate: number;
    retryRate: number;
}
export interface QueueStorageMetrics {
    diskUsage: number;
    fileCount: number;
    oldestTask?: Date;
    newestTask?: Date;
}
export interface QueueStatistics {
    totalTasks: number;
    tasksByStatus: Record<TaskStatus, number>;
    tasksByType: Record<string, number>;
    tasksByPriority: Record<number, number>;
    averageProcessingTime: number;
    queueDepth: number;
    processingCapacity: QueueProcessingCapacity;
    performance: QueuePerformanceMetrics;
    storage: QueueStorageMetrics;
}
export type QueueStatusDirectory = 'pending' | 'scheduled' | 'processing' | 'retrying' | 'completed' | 'failed' | 'timeout' | 'cancelled';
export interface QueueDirectoryStructure {
    base: string;
    statuses: Record<QueueStatusDirectory, string>;
    tasks: Record<QueueStatusDirectory, string>;
    metadata: Record<QueueStatusDirectory, string>;
    logs: string;
    index: string;
    locks: string;
    tmp: string;
    archived: string;
    all: string[];
}
export interface CorruptionIssue {
    type: 'missing_file' | 'invalid_json' | 'inconsistent_status' | 'orphaned_file' | 'permission_error';
    severity: 'low' | 'medium' | 'high' | 'critical';
    path: string;
    description: string;
    autoFixable: boolean;
    recommendation: string;
}
export interface IntegrityCheckResult {
    valid: boolean;
    issues: CorruptionIssue[];
    recommendations: string[];
    checkedFiles: number;
    corruptedFiles: number;
    orphanedFiles: number;
    summary: string;
}
export interface RepairResult {
    repaired: boolean;
    issuesFixed: number;
    issuesRemaining: number;
    backupCreated: boolean;
    backupPath?: string;
    summary: string;
}
export interface BackupResult {
    success: boolean;
    backupPath: string;
    fileCount: number;
    totalSize: number;
    duration: number;
    compression: number;
}
export interface RestoreResult {
    success: boolean;
    restoredFiles: number;
    skippedFiles: number;
    errors: string[];
    duration: number;
}
export interface MigrationResult {
    success: boolean;
    fromVersion: string;
    toVersion: string;
    migratedTasks: number;
    backupPath: string;
    duration: number;
    warnings: string[];
}
export type QueueEvent = 'task_enqueued' | 'task_started' | 'task_completed' | 'task_failed' | 'task_cancelled' | 'task_retrying' | 'queue_full' | 'queue_empty' | 'executor_started' | 'executor_stopped' | 'corruption_detected' | 'performance_warning';
export interface QueueEventData {
    event: QueueEvent;
    timestamp: Date;
    taskId?: string;
    details: Record<string, unknown>;
}
export type QueueEventListener = (data: QueueEventData) => void;
export interface QueueEventEmitter {
    on(event: QueueEvent, listener: QueueEventListener): void;
    off(event: QueueEvent, listener: QueueEventListener): void;
    emit(event: QueueEvent, data: Partial<QueueEventData>): void;
}
export declare const TASK_QUEUE_ERROR_CODES: {
    readonly QUEUE_FULL: "TQ001";
    readonly QUEUE_CORRUPTED: "TQ002";
    readonly QUEUE_LOCKED: "TQ003";
    readonly QUEUE_NOT_INITIALIZED: "TQ004";
    readonly TASK_NOT_FOUND: "TQ101";
    readonly TASK_INVALID_STATUS: "TQ102";
    readonly TASK_TIMEOUT: "TQ103";
    readonly TASK_CANCELLED: "TQ104";
    readonly TASK_RETRY_EXHAUSTED: "TQ105";
    readonly PERMISSION_DENIED: "TQ201";
    readonly DISK_SPACE_FULL: "TQ202";
    readonly FILE_CORRUPTED: "TQ203";
    readonly DIRECTORY_NOT_FOUND: "TQ204";
    readonly EXECUTOR_NOT_FOUND: "TQ301";
    readonly EXECUTOR_OVERLOADED: "TQ302";
    readonly EXECUTOR_FAILED: "TQ303";
};
export type TaskQueueErrorCode = (typeof TASK_QUEUE_ERROR_CODES)[keyof typeof TASK_QUEUE_ERROR_CODES];
export declare class TaskQueueError extends Error {
    readonly code: TaskQueueErrorCode;
    readonly taskId?: string | undefined;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, code: TaskQueueErrorCode, taskId?: string | undefined, details?: Record<string, unknown> | undefined);
}
export interface ValidationError {
    field: string;
    message: string;
    code: string;
}
export interface ValidationWarning {
    field: string;
    message: string;
    suggestion?: string;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export declare class CodexError extends Error {
    readonly code: string;
    readonly details?: Record<string, unknown> | undefined;
    constructor(message: string, code: string, details?: Record<string, unknown> | undefined);
}
export interface QueueMonitoringConfig {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    metricsInterval: number;
    alertThresholds: {
        queueDepth: number;
        failureRate: number;
        averageWaitTime: number;
        diskUsage: number;
    };
}
export interface QueuePerformanceConfig {
    batchSize: number;
    processingInterval: number;
    indexingEnabled: boolean;
    compressionEnabled: boolean;
    cacheSize: number;
    optimizationLevel: 'none' | 'basic' | 'aggressive';
}
export interface QueueConfiguration {
    baseDirectory: string;
    maxConcurrentTasks: number;
    maxQueueSize: number;
    defaultTimeout: number;
    defaultRetryPolicy: TaskRetryPolicy;
    cleanupInterval: number;
    archiveCompletedTasks: boolean;
    archiveAfterDays: number;
    monitoring: QueueMonitoringConfig;
    performance: QueuePerformanceConfig;
}
