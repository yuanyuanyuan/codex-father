# Codex Father 重构实施指南

> **完整的实施步骤、代码示例和最佳实践**

## 🎯 实施总览

### 重构时间表
- **总耗时**: 7-12 天
- **参与人员**: 1-2 名开发者
- **风险等级**: 中等（有完整回滚策略）

## 📅 详细实施步骤

### 阶段 1：环境准备与清理 (1-2 天)

#### 1.1 创建工作分支
```bash
cd /data/codex-father
git checkout -b refactor/concurrent-task-manager
git checkout -b backup/orchestrator-archive  # 备份分支

# 归档当前 orchestrator 实现
git add core/orchestrator/
git commit -m "archive: 备份 orchestrator 实现用于参考"
git checkout refactor/concurrent-task-manager
```

#### 1.2 删除冗余模块
```bash
# 删除 orchestrator 目录
rm -rf core/orchestrator/

# 删除相关 CLI 命令
rm -f core/cli/commands/orchestrate-command.ts
rm -f core/cli/commands/orchestrate-command.js

# 删除测试文件
find . -name "*orchestrat*" -type f -delete
find . -name "*agent*" -type f -path "*/tests/*" -delete

# 清理导入引用
grep -r "orchestrator" core/ --include="*.ts" --exclude-dir=node_modules
```

#### 1.3 更新包依赖
```json
// package.json - 移除不需要的依赖
{
  "dependencies": {
    // 保留核心依赖
    "@modelcontextprotocol/sdk": "^1.20.0",
    "commander": "^12.1.0",
    "winston": "^3.11.0",
    // 移除 orchestrator 特定依赖
  }
}
```

### 阶段 2：核心类型系统重构 (1-2 天)

#### 2.1 创建统一类型定义
```typescript
// core/types/task-config.ts
export interface TaskConfig {
  // 核心字段
  id: string;
  type: TaskType;
  agent: AgentConfig;
  
  // 执行控制
  priority?: Priority;
  timeout?: number;
  retryPolicy?: RetryPolicy;
  
  // 并发控制
  concurrency?: ConcurrencyConfig;
  
  // 扩展字段
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type TaskType = 
  | 'development'     // 开发任务
  | 'testing'        // 测试任务  
  | 'deployment'     // 部署任务
  | 'maintenance'    // 维护任务
  | 'custom';        // 自定义任务

export type Priority = 'low' | 'normal' | 'high' | 'urgent';

export interface AgentConfig {
  type: 'external' | 'builtin';
  endpoint?: string;
  command?: string;
  options?: AgentOptions;
  capabilities?: string[];
  resourceRequirements?: ResourceRequirements;
}

export interface AgentOptions {
  timeout?: number;
  retries?: number;
  environment?: Record<string, string>;
  workingDirectory?: string;
  authentication?: AuthConfig;
}

export interface ConcurrencyConfig {
  maxParallel?: number;
  resourceLimits?: ResourceLimits;
  dependencies?: string[];
  exclusive?: boolean;  // 独占执行
}

export interface ResourceLimits {
  cpu?: number;        // CPU 百分比限制
  memory?: number;     // 内存限制 (MB)
  disk?: number;       // 磁盘 I/O 限制
  network?: number;    // 网络带宽限制
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  baseDelay: number;
  maxDelay?: number;
  retryableErrors?: string[];  // 可重试的错误类型
}
```

#### 2.2 执行结果类型
```typescript
// core/types/execution-result.ts
export interface TaskResult {
  taskId: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  executionTime: number;
  
  // 结果数据
  result?: unknown;
  error?: TaskError;
  
  // 执行元数据
  agent: AgentInfo;
  resources: ResourceUsage;
  metrics: ExecutionMetrics;
  
  // 重试信息
  attempt: number;
  retryCount: number;
}

export interface TaskError {
  code: string;
  message: string;
  category: ErrorCategory;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export type ErrorCategory = 
  | 'timeout'
  | 'resource_limit'
  | 'agent_error'
  | 'dependency_failure'
  | 'validation_error'
  | 'system_error';

export interface AgentInfo {
  id: string;
  type: string;
  version?: string;
  capabilities: string[];
  performance: AgentPerformance;
}

export interface ResourceUsage {
  cpu: number;          // CPU 使用率百分比
  memory: number;       // 内存使用量 (MB)
  disk: number;         // 磁盘 I/O (MB)
  network: number;      // 网络使用量 (MB)
  duration: number;     // 资源占用时长 (ms)
}

export interface ExecutionMetrics {
  queueWaitTime: number;     // 队列等待时间
  executionTime: number;     // 实际执行时间
  totalTime: number;         // 总耗时
  throughput?: number;       // 吞吐量
  errorRate?: number;        // 错误率
}
```

### 阶段 3：并发管理核心实现 (2-3 天)

#### 3.1 智能并发池
```typescript
// core/concurrency/concurrency-pool.ts
import { EventEmitter } from 'events';
import { TaskConfig, TaskResult } from '../types/index.js';

export interface ConcurrencyPoolOptions {
  maxConcurrency: number;
  adaptiveScaling: boolean;
  resourceThresholds: {
    cpu: number;
    memory: number;
    disk: number;
  };
  scalingPolicy: ScalingPolicy;
}

export interface ScalingPolicy {
  scaleUpThreshold: number;    // 扩容阈值
  scaleDownThreshold: number;  // 缩容阈值
  cooldownPeriod: number;      // 冷却期间 (ms)
  maxScaleStep: number;        // 最大伸缩步长
}

export class ConcurrencyPool extends EventEmitter {
  private readonly options: ConcurrencyPoolOptions;
  private currentConcurrency: number = 0;
  private maxConcurrency: number;
  private runningTasks: Map<string, RunningTask> = new Map();
  private pendingTasks: TaskConfig[] = [];
  private resourceMonitor: ResourceMonitor;
  
  constructor(options: ConcurrencyPoolOptions) {
    super();
    this.options = options;
    this.maxConcurrency = options.maxConcurrency;
    this.resourceMonitor = new ResourceMonitor();
    
    // 启动自适应调整
    if (options.adaptiveScaling) {
      this.startAdaptiveScaling();
    }
  }

  async submitTask(config: TaskConfig): Promise<string> {
    const taskId = config.id;
    
    // 验证任务配置
    this.validateTaskConfig(config);
    
    // 检查依赖关系
    if (config.concurrency?.dependencies) {
      await this.checkDependencies(config.concurrency.dependencies);
    }
    
    // 添加到队列
    this.pendingTasks.push(config);
    this.emit('task_queued', { taskId, queueLength: this.pendingTasks.length });
    
    // 尝试立即执行
    await this.processPendingTasks();
    
    return taskId;
  }

  async processPendingTasks(): Promise<void> {
    while (this.pendingTasks.length > 0 && this.canStartNewTask()) {
      const task = this.pendingTasks.shift()!;
      await this.startTask(task);
    }
  }

  private canStartNewTask(): boolean {
    if (this.currentConcurrency >= this.maxConcurrency) {
      return false;
    }
    
    // 检查资源是否充足
    const resources = this.resourceMonitor.getCurrentUsage();
    const thresholds = this.options.resourceThresholds;
    
    return (
      resources.cpu < thresholds.cpu &&
      resources.memory < thresholds.memory &&
      resources.disk < thresholds.disk
    );
  }

  private async startTask(config: TaskConfig): Promise<void> {
    const taskId = config.id;
    const startTime = new Date();
    
    this.currentConcurrency++;
    this.runningTasks.set(taskId, {
      config,
      startTime,
      agent: null, // 将在执行时分配
    });
    
    this.emit('task_started', { taskId, concurrency: this.currentConcurrency });
    
    try {
      // 选择最佳 Agent
      const agent = await this.selectAgent(config);
      this.runningTasks.get(taskId)!.agent = agent;
      
      // 执行任务
      const result = await agent.execute(config);
      
      // 处理成功结果
      await this.handleTaskCompletion(taskId, result);
      
    } catch (error) {
      // 处理失败
      await this.handleTaskFailure(taskId, error);
    }
  }

  private async selectAgent(config: TaskConfig): Promise<Agent> {
    // 根据任务类型和要求选择最佳 Agent
    const candidates = this.getAvailableAgents(config);
    
    if (candidates.length === 0) {
      throw new Error(`No available agent for task type: ${config.type}`);
    }
    
    // 负载均衡选择
    return this.loadBalancer.selectOptimal(candidates, config);
  }

  private async handleTaskCompletion(taskId: string, result: TaskResult): Promise<void> {
    const runningTask = this.runningTasks.get(taskId);
    if (!runningTask) return;
    
    this.runningTasks.delete(taskId);
    this.currentConcurrency--;
    
    this.emit('task_completed', { taskId, result, concurrency: this.currentConcurrency });
    
    // 尝试处理下一个任务
    await this.processPendingTasks();
  }

  private async handleTaskFailure(taskId: string, error: any): Promise<void> {
    const runningTask = this.runningTasks.get(taskId);
    if (!runningTask) return;
    
    const config = runningTask.config;
    
    // 检查是否可重试
    if (this.shouldRetry(config, error)) {
      await this.scheduleRetry(config);
    } else {
      this.runningTasks.delete(taskId);
      this.currentConcurrency--;
      this.emit('task_failed', { taskId, error, concurrency: this.currentConcurrency });
    }
    
    // 处理下一个任务
    await this.processPendingTasks();
  }

  private startAdaptiveScaling(): void {
    setInterval(async () => {
      await this.adjustConcurrency();
    }, 10000); // 每 10 秒调整一次
  }

  private async adjustConcurrency(): Promise<void> {
    const resources = this.resourceMonitor.getCurrentUsage();
    const thresholds = this.options.resourceThresholds;
    const policy = this.options.scalingPolicy;
    
    const resourcePressure = Math.max(
      resources.cpu / thresholds.cpu,
      resources.memory / thresholds.memory,
      resources.disk / thresholds.disk
    );
    
    if (resourcePressure > policy.scaleUpThreshold && this.maxConcurrency > 1) {
      // 缩容
      const newMax = Math.max(1, this.maxConcurrency - policy.maxScaleStep);
      this.updateMaxConcurrency(newMax);
      this.emit('concurrency_scaled_down', { old: this.maxConcurrency, new: newMax });
      
    } else if (resourcePressure < policy.scaleDownThreshold) {
      // 扩容
      const newMax = Math.min(
        this.options.maxConcurrency,
        this.maxConcurrency + policy.maxScaleStep
      );
      this.updateMaxConcurrency(newMax);
      this.emit('concurrency_scaled_up', { old: this.maxConcurrency, new: newMax });
    }
  }

  // Public API
  public getStatus(): PoolStatus {
    return {
      currentConcurrency: this.currentConcurrency,
      maxConcurrency: this.maxConcurrency,
      pendingTasks: this.pendingTasks.length,
      runningTasks: this.runningTasks.size,
      resourceUsage: this.resourceMonitor.getCurrentUsage(),
    };
  }

  public async adjustMaxConcurrency(newMax: number): Promise<void> {
    this.updateMaxConcurrency(newMax);
    await this.processPendingTasks();
  }
}

interface RunningTask {
  config: TaskConfig;
  startTime: Date;
  agent: Agent | null;
}

interface PoolStatus {
  currentConcurrency: number;
  maxConcurrency: number;
  pendingTasks: number;
  runningTasks: number;
  resourceUsage: ResourceSnapshot;
}
```

#### 3.2 增强版任务执行器
```typescript
// core/concurrency/task-executor.ts
import { TaskConfig, TaskResult, AgentConfig } from '../types/index.js';

export class EnhancedTaskExecutor {
  private agents: Map<string, Agent> = new Map();
  private executionHistory: TaskResult[] = [];
  private performanceMetrics: Map<string, AgentPerformance> = new Map();

  constructor(private readonly options: TaskExecutorOptions = {}) {
    this.setupBuiltinAgents();
  }

  // Agent 管理
  public registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
    this.performanceMetrics.set(agent.id, {
      totalTasks: 0,
      successRate: 0,
      averageExecutionTime: 0,
      resourceEfficiency: 0,
    });
  }

  public unregisterAgent(agentId: string): boolean {
    this.performanceMetrics.delete(agentId);
    return this.agents.delete(agentId);
  }

  public getRegisteredAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  // 任务执行
  public async executeTask(config: TaskConfig): Promise<TaskResult> {
    const startTime = Date.now();
    
    try {
      // 1. 验证配置
      this.validateConfig(config);
      
      // 2. 选择 Agent
      const agent = await this.selectAgent(config);
      
      // 3. 预处理
      await this.preprocessTask(config, agent);
      
      // 4. 执行任务
      const result = await this.executeWithAgent(config, agent);
      
      // 5. 后处理
      await this.postprocessTask(config, result);
      
      // 6. 更新性能指标
      this.updatePerformanceMetrics(agent.id, result);
      
      return result;
      
    } catch (error) {
      const errorResult = this.createErrorResult(config, error, startTime);
      this.executionHistory.push(errorResult);
      throw error;
    }
  }

  // 批量执行
  public async executeTasks(configs: TaskConfig[]): Promise<TaskResult[]> {
    const results: TaskResult[] = [];
    
    // 并行执行（受并发限制）
    const executeWithLimit = async (config: TaskConfig): Promise<TaskResult> => {
      return await this.executeTask(config);
    };
    
    // 使用 Promise.allSettled 确保部分失败不影响其他任务
    const promises = configs.map(executeWithLimit);
    const settled = await Promise.allSettled(promises);
    
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        // 处理失败的任务
        console.error('Task execution failed:', result.reason);
      }
    }
    
    return results;
  }

  // Agent 选择算法
  private async selectAgent(config: TaskConfig): Promise<Agent> {
    const availableAgents = this.getCapableAgents(config);
    
    if (availableAgents.length === 0) {
      throw new Error(`No capable agent found for task type: ${config.type}`);
    }
    
    // 基于性能和负载的智能选择
    return this.selectOptimalAgent(availableAgents, config);
  }

  private getCapableAgents(config: TaskConfig): Agent[] {
    return Array.from(this.agents.values()).filter(agent => {
      // 检查能力匹配
      if (!agent.capabilities.includes(config.type)) {
        return false;
      }
      
      // 检查资源要求
      if (config.agent.resourceRequirements) {
        return this.checkResourceCompatibility(agent, config.agent.resourceRequirements);
      }
      
      return true;
    });
  }

  private selectOptimalAgent(agents: Agent[], config: TaskConfig): Agent {
    // 计算每个 Agent 的评分
    const scored = agents.map(agent => {
      const performance = this.performanceMetrics.get(agent.id)!;
      const score = this.calculateAgentScore(agent, performance, config);
      return { agent, score };
    });
    
    // 按评分排序，选择最佳
    scored.sort((a, b) => b.score - a.score);
    return scored[0].agent;
  }

  private calculateAgentScore(agent: Agent, performance: AgentPerformance, config: TaskConfig): number {
    let score = 0;
    
    // 成功率权重 (40%)
    score += performance.successRate * 0.4;
    
    // 性能权重 (30%) - 执行时间越短越好
    const timeScore = Math.max(0, 1 - (performance.averageExecutionTime / 60000)); // 归一化到分钟
    score += timeScore * 0.3;
    
    // 资源效率权重 (20%)
    score += performance.resourceEfficiency * 0.2;
    
    // 负载权重 (10%) - 当前负载越低越好
    const loadScore = Math.max(0, 1 - (agent.currentLoad / agent.maxCapacity));
    score += loadScore * 0.1;
    
    // 优先级调整
    if (config.priority === 'urgent') {
      score *= 1.2; // 紧急任务提升评分
    }
    
    return score;
  }

  // 性能监控
  private updatePerformanceMetrics(agentId: string, result: TaskResult): void {
    const metrics = this.performanceMetrics.get(agentId);
    if (!metrics) return;
    
    metrics.totalTasks++;
    
    // 更新成功率
    const successCount = this.executionHistory
      .filter(r => r.agent.id === agentId && r.success)
      .length;
    metrics.successRate = successCount / metrics.totalTasks;
    
    // 更新平均执行时间
    const executionTimes = this.executionHistory
      .filter(r => r.agent.id === agentId)
      .map(r => r.executionTime);
    metrics.averageExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length;
    
    // 更新资源效率
    metrics.resourceEfficiency = this.calculateResourceEfficiency(result);
  }

  // 公共 API
  public getExecutionHistory(): TaskResult[] {
    return [...this.executionHistory];
  }

  public getAgentPerformance(agentId?: string): Map<string, AgentPerformance> | AgentPerformance | undefined {
    if (agentId) {
      return this.performanceMetrics.get(agentId);
    }
    return new Map(this.performanceMetrics);
  }

  public getExecutionStats(): ExecutionStats {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(r => r.success).length;
    const avgTime = total > 0 
      ? this.executionHistory.reduce((sum, r) => sum + r.executionTime, 0) / total 
      : 0;

    return {
      totalExecutions: total,
      successCount: successful,
      failureCount: total - successful,
      successRate: total > 0 ? successful / total : 0,
      averageExecutionTime: avgTime,
    };
  }
}

// 接口定义
export interface Agent {
  id: string;
  type: string;
  capabilities: string[];
  currentLoad: number;
  maxCapacity: number;
  resourceLimits: ResourceLimits;
  
  execute(config: TaskConfig): Promise<TaskResult>;
  getStatus(): AgentStatus;
  getCapabilities(): string[];
}

export interface AgentPerformance {
  totalTasks: number;
  successRate: number;
  averageExecutionTime: number;
  resourceEfficiency: number;
}

export interface ExecutionStats {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageExecutionTime: number;
}
```

### 阶段 4：CLI 命令重构 (1-2 天)

#### 4.1 简化的任务命令
```typescript
// core/cli/commands/task-command.ts
import { Command } from 'commander';
import { TaskConfig } from '../../types/index.js';
import { ConcurrencyPool } from '../../concurrency/concurrency-pool.js';

export function registerTaskCommand(program: Command): void {
  const task = program.command('task').description('任务管理命令');

  // 提交任务
  task
    .command('submit')
    .description('提交新任务')
    .option('-c, --config <file>', '任务配置文件')
    .option('-t, --type <type>', '任务类型')
    .option('-p, --priority <priority>', '优先级 (low|normal|high|urgent)')
    .option('--timeout <ms>', '超时时间（毫秒）')
    .option('--agent-endpoint <url>', '外部 Agent 端点')
    .action(async (options) => {
      try {
        let config: TaskConfig;
        
        if (options.config) {
          // 从文件加载配置
          config = await loadTaskConfig(options.config);
        } else {
          // 从命令行参数构建配置
          config = buildTaskConfigFromOptions(options);
        }
        
        const pool = getConcurrencyPool();
        const taskId = await pool.submitTask(config);
        
        console.log(`✅ 任务已提交: ${taskId}`);
        
      } catch (error) {
        console.error('❌ 任务提交失败:', error.message);
        process.exit(1);
      }
    });

  // 查看任务状态
  task
    .command('status <taskId>')
    .description('查看任务状态')
    .action(async (taskId) => {
      try {
        const status = await getTaskStatus(taskId);
        displayTaskStatus(status);
      } catch (error) {
        console.error('❌ 获取状态失败:', error.message);
        process.exit(1);
      }
    });

  // 列出任务
  task
    .command('list')
    .description('列出任务')
    .option('-s, --status <status>', '按状态筛选')
    .option('-t, --type <type>', '按类型筛选')
    .option('-l, --limit <number>', '限制数量', '20')
    .action(async (options) => {
      try {
        const tasks = await listTasks(options);
        displayTaskList(tasks);
      } catch (error) {
        console.error('❌ 获取任务列表失败:', error.message);
        process.exit(1);
      }
    });

  // 重试任务
  task
    .command('retry <taskId>')
    .description('重试失败的任务')
    .action(async (taskId) => {
      try {
        await retryTask(taskId);
        console.log(`✅ 任务重试已启动: ${taskId}`);
      } catch (error) {
        console.error('❌ 任务重试失败:', error.message);
        process.exit(1);
      }
    });
}

// 辅助函数
async function loadTaskConfig(configFile: string): Promise<TaskConfig> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  const fullPath = path.resolve(configFile);
  const content = await fs.readFile(fullPath, 'utf-8');
  
  if (configFile.endsWith('.json')) {
    return JSON.parse(content);
  } else if (configFile.endsWith('.yaml') || configFile.endsWith('.yml')) {
    const yaml = await import('yaml');
    return yaml.parse(content);
  } else {
    throw new Error('支持的配置文件格式: .json, .yaml, .yml');
  }
}

function buildTaskConfigFromOptions(options: any): TaskConfig {
  const config: TaskConfig = {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: options.type || 'custom',
    agent: {
      type: options.agentEndpoint ? 'external' : 'builtin',
      endpoint: options.agentEndpoint,
    },
  };
  
  if (options.priority) {
    config.priority = options.priority;
  }
  
  if (options.timeout) {
    config.timeout = parseInt(options.timeout);
  }
  
  return config;
}

function displayTaskStatus(status: TaskStatus): void {
  console.log('\n📋 任务状态');
  console.log('─'.repeat(50));
  console.log(`ID: ${status.id}`);
  console.log(`类型: ${status.type}`);
  console.log(`状态: ${getStatusEmoji(status.status)} ${status.status}`);
  console.log(`优先级: ${status.priority || 'normal'}`);
  console.log(`创建时间: ${status.createdAt}`);
  
  if (status.startedAt) {
    console.log(`开始时间: ${status.startedAt}`);
  }
  
  if (status.completedAt) {
    console.log(`完成时间: ${status.completedAt}`);
    console.log(`执行时长: ${status.executionTime}ms`);
  }
  
  if (status.error) {
    console.log(`❌ 错误: ${status.error.message}`);
  }
}

function getStatusEmoji(status: string): string {
  const emojiMap: Record<string, string> = {
    pending: '⏳',
    running: '🔄',
    completed: '✅',
    failed: '❌',
    cancelled: '🚫',
    retrying: '🔁',
  };
  return emojiMap[status] || '❓';
}
```

#### 4.2 并发管理命令
```typescript
// core/cli/commands/concurrency-command.ts
export function registerConcurrencyCommand(program: Command): void {
  const concurrency = program.command('concurrency').description('并发管理命令');

  // 查看并发状态
  concurrency
    .command('status')
    .description('查看并发状态')
    .option('--json', '以 JSON 格式输出')
    .action(async (options) => {
      try {
        const pool = getConcurrencyPool();
        const status = pool.getStatus();
        
        if (options.json) {
          console.log(JSON.stringify(status, null, 2));
        } else {
          displayConcurrencyStatus(status);
        }
      } catch (error) {
        console.error('❌ 获取并发状态失败:', error.message);
        process.exit(1);
      }
    });

  // 调整并发数
  concurrency
    .command('adjust <maxConcurrency>')
    .description('调整最大并发数')
    .action(async (maxConcurrency) => {
      try {
        const max = parseInt(maxConcurrency);
        if (isNaN(max) || max < 1) {
          throw new Error('最大并发数必须是大于 0 的整数');
        }
        
        const pool = getConcurrencyPool();
        await pool.adjustMaxConcurrency(max);
        
        console.log(`✅ 最大并发数已调整为: ${max}`);
      } catch (error) {
        console.error('❌ 调整并发数失败:', error.message);
        process.exit(1);
      }
    });

  // Agent 管理
  const agents = concurrency.command('agents').description('Agent 管理');
  
  agents
    .command('list')
    .description('列出所有 Agent')
    .option('--performance', '显示性能指标')
    .action(async (options) => {
      try {
        const executor = getTaskExecutor();
        const agentList = executor.getRegisteredAgents();
        
        if (options.performance) {
          const performance = executor.getAgentPerformance();
          displayAgentPerformance(agentList, performance);
        } else {
          displayAgentList(agentList);
        }
      } catch (error) {
        console.error('❌ 获取 Agent 列表失败:', error.message);
        process.exit(1);
      }
    });
}

function displayConcurrencyStatus(status: PoolStatus): void {
  console.log('\n🚀 并发状态');
  console.log('─'.repeat(50));
  console.log(`当前并发: ${status.currentConcurrency}/${status.maxConcurrency}`);
  console.log(`等待任务: ${status.pendingTasks}`);
  console.log(`运行任务: ${status.runningTasks}`);
  
  console.log('\n💻 资源使用');
  console.log('─'.repeat(30));
  console.log(`CPU: ${status.resourceUsage.cpu.toFixed(1)}%`);
  console.log(`内存: ${status.resourceUsage.memory.toFixed(1)} MB`);
  console.log(`磁盘: ${status.resourceUsage.disk.toFixed(1)} MB`);
  
  // 绘制简单的进度条
  const cpuBar = createProgressBar(status.resourceUsage.cpu, 100);
  const memoryBar = createProgressBar(status.resourceUsage.memory, 1024); // 假设 1GB 限制
  
  console.log(`\nCPU  [${cpuBar}] ${status.resourceUsage.cpu.toFixed(1)}%`);
  console.log(`内存 [${memoryBar}] ${status.resourceUsage.memory.toFixed(1)} MB`);
}

function createProgressBar(current: number, max: number, width: number = 20): string {
  const percentage = Math.min(current / max, 1);
  const filled = Math.round(percentage * width);
  const empty = width - filled;
  
  return '█'.repeat(filled) + '░'.repeat(empty);
}
```

### 阶段 5：测试与验证 (1-2 天)

#### 5.1 单元测试示例
```typescript
// tests/concurrency/concurrency-pool.test.ts
import { describe, test, expect, beforeEach } from 'vitest';
import { ConcurrencyPool } from '../../core/concurrency/concurrency-pool.js';
import { TaskConfig } from '../../core/types/index.js';

describe('ConcurrencyPool', () => {
  let pool: ConcurrencyPool;
  
  beforeEach(() => {
    pool = new ConcurrencyPool({
      maxConcurrency: 3,
      adaptiveScaling: false,
      resourceThresholds: {
        cpu: 80,
        memory: 512,
        disk: 1024,
      },
      scalingPolicy: {
        scaleUpThreshold: 0.8,
        scaleDownThreshold: 0.3,
        cooldownPeriod: 5000,
        maxScaleStep: 2,
      },
    });
  });

  test('应该能够提交任务', async () => {
    const config: TaskConfig = {
      id: 'test-task-1',
      type: 'testing',
      agent: {
        type: 'builtin',
        command: 'echo "test"',
      },
    };

    const taskId = await pool.submitTask(config);
    expect(taskId).toBe('test-task-1');
  });

  test('应该遵守最大并发限制', async () => {
    const configs: TaskConfig[] = Array.from({ length: 5 }, (_, i) => ({
      id: `test-task-${i + 1}`,
      type: 'testing',
      agent: {
        type: 'builtin',
        command: `sleep 1`,
      },
    }));

    // 提交 5 个任务，但最大并发为 3
    await Promise.all(configs.map(config => pool.submitTask(config)));
    
    const status = pool.getStatus();
    expect(status.runningTasks).toBeLessThanOrEqual(3);
    expect(status.pendingTasks + status.runningTasks).toBe(5);
  });

  test('应该能够调整并发数', async () => {
    await pool.adjustMaxConcurrency(5);
    const status = pool.getStatus();
    expect(status.maxConcurrency).toBe(5);
  });
});
```

#### 5.2 集成测试
```typescript
// tests/integration/task-lifecycle.test.ts
import { describe, test, expect } from 'vitest';
import { setupTestEnvironment, cleanupTestEnvironment } from '../helpers/test-setup.js';

describe('任务生命周期集成测试', () => {
  beforeEach(async () => {
    await setupTestEnvironment();
  });

  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  test('完整的任务执行流程', async () => {
    // 1. 提交任务
    const taskConfig: TaskConfig = {
      id: 'integration-test-1',
      type: 'development',
      agent: {
        type: 'external',
        endpoint: 'http://localhost:3001/api/execute',
      },
      priority: 'high',
      timeout: 10000,
      retryPolicy: {
        maxAttempts: 2,
        backoffStrategy: 'exponential',
        baseDelay: 1000,
      },
    };

    const taskId = await submitTask(taskConfig);
    expect(taskId).toBe('integration-test-1');

    // 2. 监控执行
    const result = await waitForTaskCompletion(taskId, 15000);
    expect(result.success).toBe(true);
    expect(result.taskId).toBe(taskId);

    // 3. 验证结果
    expect(result.executionTime).toBeGreaterThan(0);
    expect(result.agent.type).toBe('external');
  });
});
```

## 📝 配置文件示例

### 项目级配置
```yaml
# codex-father.config.yaml
version: 2.0.0
environment: production

# 并发管理配置
concurrency:
  maxConcurrency: 10
  adaptiveScaling: true
  resourceThresholds:
    cpu: 75
    memory: 512
    disk: 1024
  
  scalingPolicy:
    scaleUpThreshold: 0.8
    scaleDownThreshold: 0.3
    cooldownPeriod: 10000
    maxScaleStep: 3

# 默认重试策略
defaultRetryPolicy:
  maxAttempts: 3
  backoffStrategy: exponential
  baseDelay: 1000
  maxDelay: 30000

# 监控配置
monitoring:
  enabled: true
  metricsRetention: 7d
  alerting:
    enabled: true
    webhookUrl: "https://hooks.slack.com/services/..."

# Agent 配置
agents:
  builtin:
    shell:
      enabled: true
      timeout: 30000
    http:
      enabled: true
      timeout: 10000
  
  external:
    - name: "development-agent"
      endpoint: "http://dev-agent:3000"
      capabilities: ["development", "testing"]
      resourceLimits:
        cpu: 50
        memory: 256
```

### 任务批次配置
```json
{
  "name": "微服务部署批次",
  "description": "部署用户服务相关的微服务",
  "tasks": [
    {
      "id": "build-user-service",
      "type": "development",
      "agent": {
        "type": "external",
        "endpoint": "http://build-agent:3000",
        "options": {
          "environment": {
            "NODE_ENV": "production",
            "BUILD_TARGET": "user-service"
          }
        }
      },
      "priority": "high",
      "timeout": 180000,
      "retryPolicy": {
        "maxAttempts": 2,
        "backoffStrategy": "fixed",
        "baseDelay": 5000
      }
    },
    {
      "id": "deploy-user-database",
      "type": "deployment",
      "agent": {
        "type": "external",
        "command": "kubectl apply -f user-db.yaml"
      },
      "priority": "urgent",
      "timeout": 120000
    },
    {
      "id": "deploy-user-service",
      "type": "deployment",
      "agent": {
        "type": "external",
        "command": "kubectl apply -f user-service.yaml"
      },
      "dependencies": ["build-user-service", "deploy-user-database"],
      "priority": "high",
      "timeout": 90000,
      "retryPolicy": {
        "maxAttempts": 3,
        "backoffStrategy": "exponential",
        "baseDelay": 2000,
        "maxDelay": 15000
      }
    }
  ]
}
```

## 🎯 验收标准

### 功能验收
- [ ] 能够通过简化的 API 提交任务
- [ ] 支持外部 Agent 注册和管理
- [ ] 智能并发控制和自适应伸缩
- [ ] 完整的任务生命周期管理
- [ ] 错误处理和重试机制
- [ ] 实时监控和性能统计

### 性能验收
- [ ] 任务提交响应时间 < 10ms
- [ ] 支持 50+ 并发任务执行
- [ ] 内存占用减少 40%（相比当前版本）
- [ ] 资源利用率 > 85%

### 代码质量验收
- [ ] 代码行数减少 > 60%
- [ ] 单元测试覆盖率 > 90%
- [ ] 集成测试通过率 100%
- [ ] TypeScript 类型检查无错误
- [ ] ESLint 无警告

## 🚀 部署指南

### 开发环境部署
```bash
# 1. 安装依赖
cd /data/codex-father
npm install

# 2. 构建项目
npm run build

# 3. 启动开发服务器
npm run dev

# 4. 验证功能
npm run test
```

### 生产环境部署
```bash
# 1. 构建生产版本
npm run build

# 2. 配置环境变量
export NODE_ENV=production
export CODEX_FATHER_CONFIG=/path/to/config.yaml

# 3. 启动服务
npm start

# 4. 健康检查
curl http://localhost:3000/health
```

---

**重构完成后，codex-father 将成为一个专注、高效的多任务并发管理工具，为现代开发工作流提供强大支持！** 🎉

> 🐱 浮浮酱期待看到这个全新的、简洁而强大的 codex-father 在主人的项目中发挥重要作用喵～