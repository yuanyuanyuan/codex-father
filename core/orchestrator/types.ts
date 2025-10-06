import { z } from 'zod';

const NonEmptyStringSchema = z.string().min(1, 'string must not be empty');
const TaskIdSchema = NonEmptyStringSchema.regex(/^t[-_]/, 'task id must start with t_/t-');
const AgentIdSchema = NonEmptyStringSchema.regex(/^agent_/, 'agent id must start with agent_');
const OrchestrationIdSchema = NonEmptyStringSchema.regex(
  /^orc_/,
  'orchestration id must start with orc_'
);
const PatchIdSchema = NonEmptyStringSchema.regex(/^patch_/, 'patch id must start with patch_');
const IsoDateTimeSchema = z.string().datetime({ offset: true });
const PositiveIntegerSchema = z.number().int().positive();
const NonNegativeIntegerSchema = z.number().int().nonnegative();
const PercentageSchema = z.number().min(0).max(1);
const ApprovalPolicySchema = z.enum(['never', 'on-request', 'on-failure', 'untrusted']);
const SandboxModeSchema = z.enum(['read-only', 'workspace-write', 'danger-full-access']);

export const TaskOutputSchema = z
  .object({
    type: z.enum(['file', 'patch', 'log']),
    path: NonEmptyStringSchema,
    description: z.string().optional(),
  })
  .strict();

export const TaskStatusSchema = z.enum([
  'pending',
  'waiting',
  'running',
  'completed',
  'failed',
  'timeout',
]);

export const TaskSchema = z
  .object({
    id: TaskIdSchema,
    title: z.string().optional(),
    description: NonEmptyStringSchema,
    role: z.enum(['developer', 'reviewer', 'tester']).or(NonEmptyStringSchema),
    mutation: z.boolean().optional(),
    roleMatchMethod: z.enum(['rule', 'llm']),
    roleMatchDetails: NonEmptyStringSchema,
    status: TaskStatusSchema,
    dependencies: z.array(NonEmptyStringSchema).default([]),
    priority: z.number().int().min(0).default(0),
    timeout: PositiveIntegerSchema,
    createdAt: IsoDateTimeSchema,
    startedAt: IsoDateTimeSchema.optional(),
    completedAt: IsoDateTimeSchema.optional(),
    agentId: NonEmptyStringSchema.optional(),
    outputs: z.array(TaskOutputSchema).default([]),
    error: z.string().optional(),
    attempts: z.number().int().min(0).optional(),
  })
  .strict();

export type Task = z.infer<typeof TaskSchema>;

export const AgentStatusSchema = z.enum(['idle', 'busy', 'crashed', 'terminated']);

export const ResourceUsageSchema = z
  .object({
    cpu: PercentageSchema,
    memory: z.number().nonnegative(),
  })
  .strict();

export const AgentSchema = z
  .object({
    id: AgentIdSchema,
    role: NonEmptyStringSchema,
    status: AgentStatusSchema,
    processId: PositiveIntegerSchema,
    currentTask: TaskIdSchema.optional(),
    startedAt: IsoDateTimeSchema,
    lastActivityAt: IsoDateTimeSchema,
    workDir: NonEmptyStringSchema,
    sessionDir: NonEmptyStringSchema,
    resourceUsage: ResourceUsageSchema.optional(),
  })
  .strict();

export type Agent = z.infer<typeof AgentSchema>;

export const RoleConfigurationSchema = z
  .object({
    allowedTools: z.array(NonEmptyStringSchema).min(1, 'allowedTools must not be empty'),
    permissionMode: ApprovalPolicySchema,
    sandbox: SandboxModeSchema,
    baseInstructions: NonEmptyStringSchema.optional(),
  })
  .strict();

export type RoleConfiguration = z.infer<typeof RoleConfigurationSchema>;

export const RolesConfigurationSchema = z.record(NonEmptyStringSchema, RoleConfigurationSchema);

export type RolesConfiguration = z.infer<typeof RolesConfigurationSchema>;

const DefaultRoleConfigurations: RolesConfiguration = {
  developer: {
    allowedTools: ['read_file', 'write_file', 'run_tests'],
    permissionMode: 'never',
    sandbox: 'workspace-write',
  },
  reviewer: {
    allowedTools: ['read_file'],
    permissionMode: 'never',
    sandbox: 'workspace-write',
  },
  tester: {
    allowedTools: ['read_file', 'run_tests'],
    permissionMode: 'never',
    sandbox: 'workspace-write',
  },
};

export const PatchStatusSchema = z.enum(['pending', 'applying', 'applied', 'failed']);

export const PatchSchema = z
  .object({
    id: PatchIdSchema,
    taskId: TaskIdSchema,
    sequence: NonNegativeIntegerSchema,
    filePath: NonEmptyStringSchema,
    targetFiles: z.array(NonEmptyStringSchema).min(1),
    status: PatchStatusSchema,
    createdAt: IsoDateTimeSchema,
    appliedAt: IsoDateTimeSchema.optional(),
    error: z.string().optional(),
  })
  .strict();

export type Patch = z.infer<typeof PatchSchema>;

export const RetryPolicySchema = z
  .object({
    maxAttempts: PositiveIntegerSchema,
    backoff: z.enum(['exponential', 'fixed']),
    initialDelayMs: NonNegativeIntegerSchema,
    maxDelayMs: NonNegativeIntegerSchema,
  })
  .strict();

export const ResourceMonitorConfigSchema = z
  .object({
    cpuThreshold: PercentageSchema.optional(),
    memoryThreshold: z.number().nonnegative().optional(),
    adjustMinIntervalMs: PositiveIntegerSchema.optional(),
  })
  .strict();

export const QuickValidateConfigSchema = z
  .object({
    steps: z.array(NonEmptyStringSchema),
    failOnMissing: z.boolean().optional(),
  })
  .strict();

export const OrchestrationConfigSchema = z
  .object({
    maxConcurrency: z.number().int().min(1).max(10),
    taskTimeout: PositiveIntegerSchema,
    outputFormat: z.enum(['json', 'stream-json']),
    successRateThreshold: PercentageSchema,
    retryPolicy: RetryPolicySchema.optional(),
    resourceMonitor: ResourceMonitorConfigSchema.optional(),
    quickValidate: QuickValidateConfigSchema.optional(),
    applyPatchStrategy: z.enum(['git', 'native']).optional(),
    applyPatchFallbackOnFailure: z.boolean().optional(),
    mode: z.enum(['manual', 'llm']).optional(),
    roles: RolesConfigurationSchema.default(DefaultRoleConfigurations),
    codexCommand: NonEmptyStringSchema.default('codex'),
  })
  .strict();

export type OrchestratorConfig = z.infer<typeof OrchestrationConfigSchema>;

export const OrchestrationStatusSchema = z.enum([
  'initializing',
  'running',
  'completed',
  'failed',
  'cancelled',
]);

export const OrchestrationSchema = z
  .object({
    id: OrchestrationIdSchema,
    requirement: NonEmptyStringSchema,
    tasks: z.array(TaskSchema),
    status: OrchestrationStatusSchema,
    createdAt: IsoDateTimeSchema,
    completedAt: IsoDateTimeSchema.optional(),
    successRateThreshold: PercentageSchema,
    config: OrchestrationConfigSchema,
  })
  .strict();

export type Orchestration = z.infer<typeof OrchestrationSchema>;

export interface TaskScheduleResult {
  readonly scheduledTasks: readonly Task[];
  readonly throttled: boolean;
}

export interface QuickValidateResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface PatchProposal {
  readonly id: string;
  readonly targetFiles: readonly string[];
  readonly summary?: string;
}

export interface PatchApplyResult {
  readonly success: boolean;
  readonly errorMessage?: string;
}

export interface OrchestratorStateSnapshot {
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly updatedAt: number;
}

export interface ResourceSnapshot {
  readonly cpuUsage: number;
  readonly memoryUsage: number;
  readonly timestamp: number;
}

export interface OrchestratorContext {
  readonly config: OrchestratorConfig;
  readonly tasks: readonly Task[];
}

export type TaskDefinition = Task;

export function createDefaultOrchestratorConfig(): OrchestratorConfig {
  const cloneDefaultRoles = (): RolesConfiguration =>
    Object.fromEntries(
      Object.entries(DefaultRoleConfigurations).map(([role, config]) => [
        role,
        {
          ...config,
          allowedTools: [...config.allowedTools],
        },
      ])
    );

  return {
    maxConcurrency: 10,
    taskTimeout: 30 * 60 * 1000,
    outputFormat: 'stream-json',
    successRateThreshold: 0.9,
    roles: cloneDefaultRoles(),
    codexCommand: 'codex',
  } satisfies OrchestratorConfig;
}
