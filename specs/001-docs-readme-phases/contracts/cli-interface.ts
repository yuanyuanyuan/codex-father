/**
 * CLI Interface Contract
 * 定义 Codex Father CLI 工具的核心接口规范
 */

// ============================================================================
// CLI 命令接口
// ============================================================================

export interface CLICommand {
  name: string;
  description: string;
  options: CLIOption[];
  subcommands?: CLICommand[];
  handler: CommandHandler;
}

export interface CLIOption {
  name: string;
  alias?: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  default?: any;
  choices?: string[];
}

export interface CommandContext {
  args: string[];
  options: Record<string, any>;
  workingDirectory: string;
  configPath: string;
  verbose: boolean;
  dryRun: boolean;
  json: boolean;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  errors?: string[];
  warnings?: string[];
  executionTime: number;
}

export type CommandHandler = (context: CommandContext) => Promise<CommandResult>;

// ============================================================================
// 核心 CLI 命令规范
// ============================================================================

/**
 * 主入口命令
 * Usage: codex-father [options] <command>
 */
export interface MainCommand extends CLICommand {
  name: 'codex-father';
  globalOptions: {
    verbose: boolean;
    dryRun: boolean;
    json: boolean;
    config: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

/**
 * 任务管理命令
 * Usage: codex-father task <action> [options]
 */
export interface TaskCommand extends CLICommand {
  name: 'task';
  actions: {
    create: CreateTaskAction;
    list: ListTaskAction;
    status: StatusTaskAction;
    cancel: CancelTaskAction;
    retry: RetryTaskAction;
    logs: LogsTaskAction;
  };
}

export interface CreateTaskAction {
  name: 'create';
  parameters: {
    type: string;
    priority?: number;
    payload: Record<string, any>;
    scheduledAt?: Date;
  };
  returns: TaskCreationResult;
}

export interface TaskCreationResult {
  taskId: string;
  status: 'pending' | 'scheduled';
  queuePosition?: number;
  estimatedStartTime?: Date;
}

/**
 * 配置管理命令
 * Usage: codex-father config <action> [options]
 */
export interface ConfigCommand extends CLICommand {
  name: 'config';
  actions: {
    get: GetConfigAction;
    set: SetConfigAction;
    list: ListConfigAction;
    validate: ValidateConfigAction;
    init: InitConfigAction;
  };
}

export interface GetConfigAction {
  name: 'get';
  parameters: {
    key: string;
    environment?: string;
  };
  returns: ConfigValue;
}

export interface ConfigValue {
  key: string;
  value: any;
  source: string;
  environment: string;
  encrypted: boolean;
}

/**
 * MCP 服务器管理命令
 * Usage: codex-father mcp <action> [options]
 */
export interface MCPCommand extends CLICommand {
  name: 'mcp';
  actions: {
    start: StartMCPAction;
    stop: StopMCPAction;
    status: StatusMCPAction;
    logs: LogsMCPAction;
    tools: ToolsMCPAction;
  };
}

export interface StartMCPAction {
  name: 'start';
  parameters: {
    port?: number;
    configFile?: string;
    detached?: boolean;
  };
  returns: MCPStartResult;
}

export interface MCPStartResult {
  pid: number;
  port: number;
  status: 'starting' | 'running';
  endpoint: string;
}

// ============================================================================
// 参数验证规范
// ============================================================================

export interface ValidationRule {
  field: string;
  type: 'required' | 'format' | 'range' | 'enum' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any) => boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

// ============================================================================
// 输出格式规范
// ============================================================================

export interface HumanReadableOutput {
  title?: string;
  sections: OutputSection[];
  summary?: string;
  nextSteps?: string[];
}

export interface OutputSection {
  title: string;
  content: string | OutputTable | OutputList;
  type: 'text' | 'table' | 'list' | 'code';
}

export interface OutputTable {
  headers: string[];
  rows: string[][];
  alignment?: ('left' | 'center' | 'right')[];
}

export interface OutputList {
  items: string[];
  ordered: boolean;
  nested?: OutputList[];
}

export interface JSONOutput {
  success: boolean;
  timestamp: string;
  command: string;
  result: any;
  metadata: {
    executionTime: number;
    version: string;
    environment: string;
  };
  errors?: string[];
  warnings?: string[];
}

// ============================================================================
// 错误处理规范
// ============================================================================

export interface CLIError extends Error {
  code: string;
  exitCode: number;
  details?: Record<string, any>;
  suggestions?: string[];
}

export const ERROR_CODES = {
  // 配置错误 (1xx)
  CONFIG_NOT_FOUND: 'E101',
  CONFIG_INVALID: 'E102',
  CONFIG_PERMISSION_DENIED: 'E103',

  // 任务错误 (2xx)
  TASK_NOT_FOUND: 'E201',
  TASK_QUEUE_FULL: 'E202',
  TASK_EXECUTION_FAILED: 'E203',

  // MCP 错误 (3xx)
  MCP_SERVER_NOT_RUNNING: 'E301',
  MCP_CONNECTION_FAILED: 'E302',
  MCP_TOOL_NOT_FOUND: 'E303',

  // 系统错误 (4xx)
  INSUFFICIENT_PERMISSIONS: 'E401',
  DISK_SPACE_LOW: 'E402',
  NETWORK_ERROR: 'E403',

  // 用户错误 (5xx)
  INVALID_ARGUMENT: 'E501',
  MISSING_REQUIRED_OPTION: 'E502',
  COMMAND_NOT_FOUND: 'E503',
} as const;

// ============================================================================
// 性能监控规范
// ============================================================================

export interface PerformanceMetrics {
  commandStartTime: number;
  commandEndTime: number;
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
  fileOperations: {
    reads: number;
    writes: number;
    totalBytes: number;
  };
  networkRequests?: {
    count: number;
    totalTime: number;
  };
}

export interface PerformanceThresholds {
  maxExecutionTime: number; // milliseconds
  maxMemoryUsage: number;   // bytes
  maxFileOperations: number;
}