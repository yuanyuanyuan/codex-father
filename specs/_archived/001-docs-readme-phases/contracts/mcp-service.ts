/**
 * MCP Service Contract
 * 定义 Codex Father MCP 服务器的接口规范
 */

// ============================================================================
// MCP 协议基础接口
// ============================================================================

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: Record<string, any>;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPCapabilities {
  tools?: ToolsCapability;
  resources?: ResourcesCapability;
  prompts?: PromptsCapability;
  logging?: LoggingCapability;
}

export interface ToolsCapability {
  listChanged?: boolean;
}

export interface ResourcesCapability {
  subscribe?: boolean;
  listChanged?: boolean;
}

export interface PromptsCapability {
  listChanged?: boolean;
}

export interface LoggingCapability {
  levels?: LogLevel[];
}

// ============================================================================
// MCP 服务器接口
// ============================================================================

export interface MCPServer {
  start(config: MCPServerConfig): Promise<void>;
  stop(): Promise<void>;
  getStatus(): MCPServerStatus;
  listTools(): Promise<MCPTool[]>;
  callTool(name: string, arguments?: Record<string, any>): Promise<MCPToolResult>;
  listResources(): Promise<MCPResource[]>;
  readResource(uri: string): Promise<MCPResourceContent>;
  listPrompts(): Promise<MCPPrompt[]>;
  getPrompt(name: string, arguments?: Record<string, any>): Promise<MCPPromptResult>;
}

export interface MCPServerConfig {
  name: string;
  version: string;
  port?: number;
  host?: string;
  logLevel: LogLevel;
  capabilities: MCPCapabilities;
  tools: MCPToolDefinition[];
  resources: MCPResourceDefinition[];
  prompts: MCPPromptDefinition[];
}

export interface MCPServerStatus {
  running: boolean;
  pid?: number;
  port?: number;
  uptime: number;
  connections: number;
  lastError?: string;
  metrics: MCPMetrics;
}

export interface MCPMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  memoryUsage: number;
  activeTasks: number;
}

// ============================================================================
// MCP 工具接口
// ============================================================================

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
}

export interface MCPToolDefinition extends MCPTool {
  handler: MCPToolHandler;
  category: string;
  version: string;
  deprecated?: boolean;
  examples?: MCPToolExample[];
}

export interface MCPToolHandler {
  (arguments: Record<string, any>, context: MCPToolContext): Promise<MCPToolResult>;
}

export interface MCPToolContext {
  requestId: string;
  clientInfo: MCPClientInfo;
  serverInfo: MCPServerInfo;
  logger: MCPLogger;
  workingDirectory: string;
  permissions: MCPPermissions;
}

export interface MCPToolResult {
  content: MCPContent[];
  isError?: boolean;
}

export interface MCPContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  annotations?: MCPAnnotation[];
}

export interface MCPAnnotation {
  type: string;
  text: string;
  confidence?: number;
}

export interface MCPToolExample {
  name: string;
  description: string;
  arguments: Record<string, any>;
  expectedResult: any;
}

// ============================================================================
// Codex Father 特定工具
// ============================================================================

/**
 * 任务管理工具
 */
export interface TaskManagementTools {
  createTask: MCPToolDefinition;
  listTasks: MCPToolDefinition;
  getTaskStatus: MCPToolDefinition;
  cancelTask: MCPToolDefinition;
  retryTask: MCPToolDefinition;
  getTaskLogs: MCPToolDefinition;
}

/**
 * 配置管理工具
 */
export interface ConfigManagementTools {
  getConfig: MCPToolDefinition;
  setConfig: MCPToolDefinition;
  listConfigs: MCPToolDefinition;
  validateConfig: MCPToolDefinition;
  reloadConfig: MCPToolDefinition;
}

/**
 * 文件系统工具
 */
export interface FileSystemTools {
  readFile: MCPToolDefinition;
  writeFile: MCPToolDefinition;
  listDirectory: MCPToolDefinition;
  createDirectory: MCPToolDefinition;
  deleteFile: MCPToolDefinition;
  copyFile: MCPToolDefinition;
  moveFile: MCPToolDefinition;
}

/**
 * Git 操作工具
 */
export interface GitOperationTools {
  gitStatus: MCPToolDefinition;
  gitCommit: MCPToolDefinition;
  gitBranch: MCPToolDefinition;
  gitMerge: MCPToolDefinition;
  gitPush: MCPToolDefinition;
  gitPull: MCPToolDefinition;
  createPR: MCPToolDefinition;
}

/**
 * 容器管理工具
 */
export interface ContainerManagementTools {
  buildContainer: MCPToolDefinition;
  runContainer: MCPToolDefinition;
  stopContainer: MCPToolDefinition;
  listContainers: MCPToolDefinition;
  containerLogs: MCPToolDefinition;
  containerExec: MCPToolDefinition;
}

// ============================================================================
// MCP 资源接口
// ============================================================================

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  annotations?: MCPAnnotation[];
}

export interface MCPResourceDefinition extends MCPResource {
  handler: MCPResourceHandler;
  category: string;
  cacheable: boolean;
  permissions: string[];
}

export interface MCPResourceHandler {
  (uri: string, context: MCPResourceContext): Promise<MCPResourceContent>;
}

export interface MCPResourceContext {
  requestId: string;
  clientInfo: MCPClientInfo;
  permissions: MCPPermissions;
  cachePolicy: CachePolicy;
}

export interface MCPResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: Uint8Array;
  annotations?: MCPAnnotation[];
}

// ============================================================================
// MCP 提示接口
// ============================================================================

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptDefinition extends MCPPrompt {
  handler: MCPPromptHandler;
  category: string;
  examples?: MCPPromptExample[];
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPPromptHandler {
  (
    name: string,
    arguments: Record<string, any>,
    context: MCPPromptContext
  ): Promise<MCPPromptResult>;
}

export interface MCPPromptContext {
  requestId: string;
  clientInfo: MCPClientInfo;
  serverInfo: MCPServerInfo;
}

export interface MCPPromptResult {
  description?: string;
  messages: MCPPromptMessage[];
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: MCPContent;
}

export interface MCPPromptExample {
  name: string;
  description: string;
  arguments: Record<string, any>;
  expectedMessages: MCPPromptMessage[];
}

// ============================================================================
// 辅助接口
// ============================================================================

export interface MCPClientInfo {
  name: string;
  version: string;
  capabilities: MCPCapabilities;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  capabilities: MCPCapabilities;
}

export interface MCPPermissions {
  readFileSystem: boolean;
  writeFileSystem: boolean;
  executeCommands: boolean;
  networkAccess: boolean;
  containerAccess: boolean;
  gitAccess: boolean;
}

export interface MCPLogger {
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: Error, data?: any): void;
}

export interface CachePolicy {
  enabled: boolean;
  ttl: number; // seconds
  maxSize: number; // bytes
  strategy: 'lru' | 'fifo' | 'lfu';
}

export type LogLevel =
  | 'debug'
  | 'info'
  | 'notice'
  | 'warning'
  | 'error'
  | 'critical'
  | 'alert'
  | 'emergency';

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  enum?: any[];
  description?: string;
  examples?: any[];
  default?: any;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  pattern?: string;
  format?: string;
}

// ============================================================================
// 错误代码
// ============================================================================

export const MCP_ERROR_CODES = {
  // 标准 JSON-RPC 错误
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // MCP 特定错误
  TOOL_NOT_FOUND: -32000,
  TOOL_EXECUTION_ERROR: -32001,
  RESOURCE_NOT_FOUND: -32002,
  RESOURCE_ACCESS_DENIED: -32003,
  PROMPT_NOT_FOUND: -32004,
  CAPABILITY_NOT_SUPPORTED: -32005,

  // Codex Father 特定错误
  TASK_QUEUE_FULL: -33001,
  CONFIG_VALIDATION_FAILED: -33002,
  SANDBOX_VIOLATION: -33003,
  CONTAINER_ERROR: -33004,
  GIT_OPERATION_FAILED: -33005,
} as const;

// ============================================================================
// 性能监控
// ============================================================================

export interface MCPPerformanceMetrics {
  requestsPerSecond: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  totalRequestsHandled: number;
}

export interface MCPPerformanceThresholds {
  maxResponseTime: number; // milliseconds
  maxMemoryUsage: number; // bytes
  maxCpuUsage: number; // percentage
  maxConnections: number;
  maxErrorRate: number; // percentage
}
