# Data Model — Multi-Agent Parallel Task Orchestration

本数据模型根据 `spec.md` 与 `design.md` 整理，服务于 CLI 编排、事件聚合与审计。

## Orchestration（编排会话）

- id: string (`orc_...`)
- requirement: string
- tasks: Task[]
- status: 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled'
- createdAt: Date
- completedAt?: Date
- successRateThreshold: number (default 0.9)
- config: OrchestrationConfig

OrchestrationConfig:

- maxConcurrency: number (≤10)
- taskTimeout: number (ms, default 1800000)
- outputFormat: 'json' | 'stream-json'
- successRateThreshold: number
- retryPolicy?: { maxAttempts: number; backoff: 'exponential'|'fixed';
  initialDelayMs: number; maxDelayMs: number }
- resourceMonitor?: { cpuThreshold?: number; memoryThreshold?: number;
  adjustMinIntervalMs?: number }
- quickValidate?: { steps: string[]; failOnMissing?: boolean }
- applyPatchStrategy?: 'git' | 'native'
- applyPatchFallbackOnFailure?: boolean

## Task（任务）

- id: string (`t_...`)
- title?: string
- description: string
- role: 'developer' | 'reviewer' | 'tester'
- mutation?: boolean
- roleMatchMethod: 'rule' | 'llm'
- roleMatchDetails: string
- status: 'pending' | 'waiting' | 'running' | 'completed' | 'failed' | 'timeout'
- dependencies: string[] (Task.id)
- priority: number (default 0)
- timeout: number (ms)
- createdAt: Date
- startedAt?: Date
- completedAt?: Date
- agentId?: string
- outputs?: TaskOutput[]
- error?: string
- attempts?: number

TaskOutput:

- type: 'file' | 'patch' | 'log'
- path: string
- description?: string

## Agent（Codex 实例）

- id: string (`agent_...`)
- role: string
- status: 'idle' | 'busy' | 'crashed' | 'terminated'
- processId: number
- currentTask?: string (Task.id)
- startedAt: Date
- lastActivityAt: Date
- workDir: string
- sessionDir: string
- resourceUsage?: { cpu: number; memory: number }

## Role（角色）

- name: string ('developer'|'reviewer'|'tester'|custom)
- baseInstructions: string
- allowedTools: string[]
- permissionMode: 'on-request' | 'never' | 'untrusted' | 'on-failure'
- sandbox: 'read-only' | 'workspace-write' | 'danger-full-access'
- resourceLimits?: { cpu?: number; memoryMB?: number }

## Patch（补丁）

- id: string (`patch_...`)
- taskId: string
- sequence: number
- filePath: string
- targetFiles: string[]
- status: 'pending' | 'applying' | 'applied' | 'failed'
- createdAt: Date
- appliedAt?: Date
- error?: string

## Feedback（反馈）

- id: string
- taskId: string
- agentId: string
- type: 'issue' | 'warning' | 'info'
- message: string
- severity?: 'low' | 'medium' | 'high'
- createdAt: Date

## 约束与校验

- 成功判定：successRate ≥ threshold 且 审计日志中无 `patch_failed`
  记录（流式事件不包含该枚举）
- 依赖：拓扑排序，无循环；违反即拒绝执行
- 快速校验：缺失可执行工具链则判失败（FAST_VALIDATE_UNAVAILABLE）
