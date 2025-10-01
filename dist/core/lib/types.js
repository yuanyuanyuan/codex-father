import { z } from 'zod';
export var JobStatus;
(function (JobStatus) {
    JobStatus["PENDING"] = "pending";
    JobStatus["RUNNING"] = "running";
    JobStatus["COMPLETED"] = "completed";
    JobStatus["FAILED"] = "failed";
    JobStatus["CANCELLED"] = "cancelled";
    JobStatus["TIMEOUT"] = "timeout";
})(JobStatus || (JobStatus = {}));
export var ApprovalMode;
(function (ApprovalMode) {
    ApprovalMode["UNTRUSTED"] = "untrusted";
    ApprovalMode["ON_REQUEST"] = "on-request";
    ApprovalMode["ON_FAILURE"] = "on-failure";
    ApprovalMode["NEVER"] = "never";
})(ApprovalMode || (ApprovalMode = {}));
export var SandboxPolicy;
(function (SandboxPolicy) {
    SandboxPolicy["READ_ONLY"] = "read-only";
    SandboxPolicy["WORKSPACE_WRITE"] = "workspace-write";
    SandboxPolicy["DANGER_FULL_ACCESS"] = "danger-full-access";
})(SandboxPolicy || (SandboxPolicy = {}));
export const ErrorDetailsSchema = z.object({
    code: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    context: z.record(z.unknown()).optional(),
});
export const JobMetricsSchema = z.object({
    startTime: z.date().optional(),
    endTime: z.date().optional(),
    duration: z.number().positive().optional(),
    approvalCount: z.number().int().min(0),
    approvalDuration: z.number().min(0),
});
export const JobSchema = z.object({
    jobId: z.string().uuid(),
    requestId: z.string().min(1),
    conversationId: z.string().uuid().optional(),
    status: z.nativeEnum(JobStatus),
    createdAt: z.date(),
    updatedAt: z.date(),
    input: z.object({
        prompt: z.string().min(1),
        model: z.string().optional(),
        cwd: z.string().optional(),
        approvalPolicy: z.nativeEnum(ApprovalMode).optional(),
        sandboxPolicy: z.nativeEnum(SandboxPolicy).optional(),
        timeout: z.number().positive().optional(),
    }),
    output: z
        .object({
        result: z.string().optional(),
        error: ErrorDetailsSchema.optional(),
        metrics: JobMetricsSchema,
    })
        .optional(),
});
export var SessionStatus;
(function (SessionStatus) {
    SessionStatus["INITIALIZING"] = "initializing";
    SessionStatus["ACTIVE"] = "active";
    SessionStatus["IDLE"] = "idle";
    SessionStatus["RECOVERING"] = "recovering";
    SessionStatus["TERMINATED"] = "terminated";
})(SessionStatus || (SessionStatus = {}));
export const SessionSchema = z.object({
    conversationId: z.string().uuid(),
    sessionName: z.string().min(1),
    jobId: z.string().uuid(),
    createdAt: z.date(),
    sessionDir: z.string().min(1),
    rolloutRef: z.string().min(1),
    processId: z.number().int().positive().optional(),
    status: z.nativeEnum(SessionStatus),
    config: z.object({
        model: z.string(),
        cwd: z.string(),
        approvalPolicy: z.nativeEnum(ApprovalMode),
        sandboxPolicy: z.nativeEnum(SandboxPolicy),
        timeout: z.number().positive(),
    }),
});
export var ApprovalType;
(function (ApprovalType) {
    ApprovalType["EXEC_COMMAND"] = "exec-command";
    ApprovalType["APPLY_PATCH"] = "apply-patch";
})(ApprovalType || (ApprovalType = {}));
export var ApprovalStatus;
(function (ApprovalStatus) {
    ApprovalStatus["PENDING"] = "pending";
    ApprovalStatus["APPROVED"] = "approved";
    ApprovalStatus["DENIED"] = "denied";
    ApprovalStatus["AUTO_APPROVED"] = "auto-approved";
})(ApprovalStatus || (ApprovalStatus = {}));
export var ApprovalDecision;
(function (ApprovalDecision) {
    ApprovalDecision["ALLOW"] = "allow";
    ApprovalDecision["DENY"] = "deny";
})(ApprovalDecision || (ApprovalDecision = {}));
export var FileChangeType;
(function (FileChangeType) {
    FileChangeType["CREATE"] = "create";
    FileChangeType["MODIFY"] = "modify";
    FileChangeType["DELETE"] = "delete";
})(FileChangeType || (FileChangeType = {}));
export const FileChangeSchema = z.object({
    path: z.string(),
    type: z.nativeEnum(FileChangeType),
    contentPreview: z.string().optional(),
    diff: z.string().optional(),
});
export const ExecCommandApprovalSchema = z.object({
    command: z.string().min(1),
    cwd: z.string(),
    reason: z.string().optional(),
});
export const ApplyPatchApprovalSchema = z.object({
    fileChanges: z.array(FileChangeSchema).min(1),
    reason: z.string().optional(),
    grantRoot: z.boolean().optional(),
});
export const ApprovalRequestSchema = z.object({
    requestId: z.string().uuid(),
    jobId: z.string().uuid(),
    type: z.nativeEnum(ApprovalType),
    createdAt: z.date(),
    resolvedAt: z.date().optional(),
    status: z.nativeEnum(ApprovalStatus),
    details: z.union([ExecCommandApprovalSchema, ApplyPatchApprovalSchema]),
    decision: z.nativeEnum(ApprovalDecision).optional(),
    decisionReason: z.string().optional(),
    waitingDuration: z.number().min(0).optional(),
});
export const WhitelistRuleSchema = z.object({
    pattern: z.string().min(1),
    reason: z.string(),
    enabled: z.boolean(),
});
export const ApprovalPolicySchema = z.object({
    mode: z.nativeEnum(ApprovalMode),
    whitelist: z.array(WhitelistRuleSchema),
    timeout: z.number().positive().optional(),
    autoApprovePatterns: z.array(z.instanceof(RegExp)).optional(),
});
export var EventType;
(function (EventType) {
    EventType["JOB_CREATED"] = "job-created";
    EventType["JOB_STARTED"] = "job-started";
    EventType["JOB_COMPLETED"] = "job-completed";
    EventType["JOB_FAILED"] = "job-failed";
    EventType["JOB_CANCELLED"] = "job-cancelled";
    EventType["JOB_TIMEOUT"] = "job-timeout";
    EventType["SESSION_CREATED"] = "session-created";
    EventType["SESSION_ACTIVE"] = "session-active";
    EventType["SESSION_IDLE"] = "session-idle";
    EventType["SESSION_RECOVERING"] = "session-recovering";
    EventType["SESSION_TERMINATED"] = "session-terminated";
    EventType["PROCESS_STARTED"] = "process-started";
    EventType["PROCESS_CRASHED"] = "process-crashed";
    EventType["PROCESS_RESTARTED"] = "process-restarted";
    EventType["APPROVAL_REQUESTED"] = "approval-requested";
    EventType["APPROVAL_APPROVED"] = "approval-approved";
    EventType["APPROVAL_DENIED"] = "approval-denied";
    EventType["APPROVAL_AUTO_APPROVED"] = "approval-auto-approved";
    EventType["CODEX_TASK_STARTED"] = "codex-task-started";
    EventType["CODEX_AGENT_MESSAGE"] = "codex-agent-message";
    EventType["CODEX_TASK_COMPLETE"] = "codex-task-complete";
    EventType["CODEX_TASK_ERROR"] = "codex-task-error";
})(EventType || (EventType = {}));
export const EventSchema = z.object({
    eventId: z.string().uuid(),
    timestamp: z.date(),
    jobId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    type: z.nativeEnum(EventType),
    data: z.record(z.unknown()),
});
export var ToolResultStatus;
(function (ToolResultStatus) {
    ToolResultStatus["ACCEPTED"] = "accepted";
    ToolResultStatus["REJECTED"] = "rejected";
})(ToolResultStatus || (ToolResultStatus = {}));
export var MCPEventType;
(function (MCPEventType) {
    MCPEventType["TASK_STARTED"] = "task-started";
    MCPEventType["AGENT_MESSAGE"] = "agent-message";
    MCPEventType["TASK_COMPLETE"] = "task-complete";
    MCPEventType["TASK_ERROR"] = "task-error";
    MCPEventType["APPROVAL_REQUIRED"] = "approval-required";
})(MCPEventType || (MCPEventType = {}));
export const ToolResultSchema = z.object({
    status: z.nativeEnum(ToolResultStatus),
    jobId: z.string().uuid().optional(),
    conversationId: z.string().uuid().optional(),
    message: z.string(),
    error: ErrorDetailsSchema.optional(),
});
export const MCPNotificationSchema = z.object({
    method: z.literal('codex-father/progress'),
    params: z.object({
        jobId: z.string().uuid(),
        eventType: z.nativeEnum(MCPEventType),
        eventData: z.record(z.unknown()),
        timestamp: z.date(),
    }),
});
export var SingleProcessStatus;
(function (SingleProcessStatus) {
    SingleProcessStatus["STARTING"] = "starting";
    SingleProcessStatus["READY"] = "ready";
    SingleProcessStatus["RESTARTING"] = "restarting";
    SingleProcessStatus["STOPPED"] = "stopped";
})(SingleProcessStatus || (SingleProcessStatus = {}));
export var ProcessStatus;
(function (ProcessStatus) {
    ProcessStatus["IDLE"] = "idle";
    ProcessStatus["BUSY"] = "busy";
    ProcessStatus["CRASHED"] = "crashed";
})(ProcessStatus || (ProcessStatus = {}));
export const MetricsSummarySchema = z.object({
    periodStart: z.date(),
    periodEnd: z.date(),
    totalJobs: z.number().int().min(0),
    completedJobs: z.number().int().min(0),
    failedJobs: z.number().int().min(0),
    cancelledJobs: z.number().int().min(0),
    timeoutJobs: z.number().int().min(0),
    avgJobDuration: z.number().min(0),
    p50JobDuration: z.number().min(0),
    p95JobDuration: z.number().min(0),
    p99JobDuration: z.number().min(0),
    totalApprovals: z.number().int().min(0),
    autoApprovedCount: z.number().int().min(0),
    manualApprovedCount: z.number().int().min(0),
    deniedCount: z.number().int().min(0),
    avgApprovalDuration: z.number().min(0),
    processRestarts: z.number().int().min(0),
    sessionRecoveries: z.number().int().min(0),
    errorDistribution: z.record(z.number().int().min(0)),
});
export function parseJob(data) {
    return JobSchema.parse(data);
}
export function parseSession(data) {
    return SessionSchema.parse(data);
}
export function parseApprovalRequest(data) {
    return ApprovalRequestSchema.parse(data);
}
export function parseEvent(data) {
    return EventSchema.parse(data);
}
export function isValidJobStatusTransition(from, to) {
    const validTransitions = {
        [JobStatus.PENDING]: [JobStatus.RUNNING, JobStatus.CANCELLED],
        [JobStatus.RUNNING]: [
            JobStatus.COMPLETED,
            JobStatus.FAILED,
            JobStatus.CANCELLED,
            JobStatus.TIMEOUT,
        ],
        [JobStatus.COMPLETED]: [],
        [JobStatus.FAILED]: [],
        [JobStatus.CANCELLED]: [],
        [JobStatus.TIMEOUT]: [],
    };
    return validTransitions[from]?.includes(to) ?? false;
}
export function isValidSessionStatusTransition(from, to) {
    const validTransitions = {
        [SessionStatus.INITIALIZING]: [SessionStatus.ACTIVE, SessionStatus.TERMINATED],
        [SessionStatus.ACTIVE]: [
            SessionStatus.IDLE,
            SessionStatus.RECOVERING,
            SessionStatus.TERMINATED,
        ],
        [SessionStatus.IDLE]: [SessionStatus.ACTIVE, SessionStatus.TERMINATED],
        [SessionStatus.RECOVERING]: [SessionStatus.ACTIVE, SessionStatus.TERMINATED],
        [SessionStatus.TERMINATED]: [],
    };
    return validTransitions[from]?.includes(to) ?? false;
}
export function getDefaultWhitelist() {
    return [
        {
            pattern: '^git status',
            reason: 'Read-only git command',
            enabled: true,
        },
        {
            pattern: '^git diff',
            reason: 'Read-only git command',
            enabled: true,
        },
        {
            pattern: '^git log',
            reason: 'Read-only git command',
            enabled: true,
        },
        {
            pattern: '^ls ',
            reason: 'Read-only file listing',
            enabled: true,
        },
        {
            pattern: '^cat ',
            reason: 'Read-only file viewing',
            enabled: true,
        },
        {
            pattern: '^npm install$',
            reason: 'Dependency installation (HIGH RISK: can run arbitrary postinstall scripts)',
            enabled: false,
        },
    ];
}
export const TASK_QUEUE_ERROR_CODES = {
    QUEUE_FULL: 'TQ001',
    QUEUE_CORRUPTED: 'TQ002',
    QUEUE_LOCKED: 'TQ003',
    QUEUE_NOT_INITIALIZED: 'TQ004',
    TASK_NOT_FOUND: 'TQ101',
    TASK_INVALID_STATUS: 'TQ102',
    TASK_TIMEOUT: 'TQ103',
    TASK_CANCELLED: 'TQ104',
    TASK_RETRY_EXHAUSTED: 'TQ105',
    PERMISSION_DENIED: 'TQ201',
    DISK_SPACE_FULL: 'TQ202',
    FILE_CORRUPTED: 'TQ203',
    DIRECTORY_NOT_FOUND: 'TQ204',
    EXECUTOR_NOT_FOUND: 'TQ301',
    EXECUTOR_OVERLOADED: 'TQ302',
    EXECUTOR_FAILED: 'TQ303',
};
export class TaskQueueError extends Error {
    code;
    taskId;
    details;
    constructor(message, code, taskId, details) {
        super(message);
        this.code = code;
        this.taskId = taskId;
        this.details = details;
        this.name = 'TaskQueueError';
    }
}
export class CodexError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'CodexError';
    }
}
