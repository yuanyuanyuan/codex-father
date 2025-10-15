# Codex Father 产品需求文档 (PRD)

> **目标**：将过度复杂的多 Agent 编排系统重构为专注、高效的多任务并发管理工具
> 
> **核心原则**：MCP 第一，简单至上，用户价值优先

## 📋 产品概述

### 产品定位
Codex Father 2.0 是一个专注于多任务并发管理的轻量级工具，通过 MCP 协议与 Claude Code 深度集成，为开发者提供高效的任务执行和管理能力。

### 产品愿景
让每个开发者都能轻松管理复杂的并发任务，专注于创造而非等待。

### 核心价值
- **MCP 深度集成**：与 Claude Code 无缝协作，AI 自动化任务执行
- **极简设计**：从 5000+ 行精简到 550 行，专注核心功能
- **高并发性能**：智能任务调度，充分利用系统资源
- **灵活扩展**：支持外部 Agent，适配各种开发场景

## 🎯 目标用户

### 主要用户（60%）
- **Claude Code 用户**：在 AI 对话中进行开发，需要自动化任务执行
- 痛点：手动切换终端打断思路，失去工作流的连贯性

### 次要用户（25%）
- **命令行开发者**：习惯使用终端，需要批量任务管理
- 痛点：多个任务串行执行效率低，缺乏并发控制

### 再次用户（15%）
- **CI/CD 工程师**：需要 HTTP API 集成到自动化流程
- 痛点：现有的工具过于复杂，学习成本高

## 🚀 功能规划

### Phase 1：MCP 核心（MVP - 300 行）
**目标**：实现与 Claude Code 的深度集成

#### 核心功能
1. **MCP 工具集**
   - `codex_exec`：执行开发任务（生成代码、运行测试、部署等）
   - `codex_status`：查看任务状态和进度
   - `codex_reply`：基于结果继续执行
   - `codex_logs`：查看执行日志
   - `codex_list`：列出所有任务
   - `codex_send_message`：跨任务通信

2. **并发控制引擎**
   - 智能任务调度
   - 依赖关系管理
   - 资源限制控制
   - 错误处理和重试

#### 用户体验
```typescript
// 典型对话流程
用户：帮我实现用户登录功能
Claude：(调用 codex_exec) 正在实现登录功能...
Claude：✅ 已完成！创建了 Login 组件、auth API 和测试
用户：很好，添加社交登录
Claude：(调用 codex_reply) 正在扩展登录功能...
Claude：✅ 社交登录已添加，支持 Google 和 GitHub
```

### Phase 2：HTTP API（+200 行）
**目标**：支持 CI/CD 和第三方集成

#### 核心 API
```typescript
POST /tasks          // 提交任务
GET /tasks/{id}       // 获取任务状态
GET /tasks           // 列出所有任务
POST /tasks/{id}/reply // 继续执行任务
WebSocket /ws        // 实时状态推送
```

#### 集成场景
- GitHub Actions
- GitLab CI
- Jenkins Pipeline
- 自定义脚本

### Phase 3：CLI 接口（+50 行）
**目标**：提供命令行使用方式

#### 核心命令
```bash
codex-father mcp                    # 启动 MCP 模式（默认）
codex-father server --port 3000     # 启动 HTTP 服务
codex-father run --config task.json # 执行任务配置
codex-father status                 # 查看状态
```

## 📊 技术架构

### 整体架构
```
┌─────────────────┐
│   Claude Code   │
└─────────┬───────┘
          │ MCP Protocol
┌─────────▼───────┐
│  MCP Server     │
│  (200 lines)    │
└─────────┬───────┘
          │
┌─────────▼───────┐
│  TaskRunner     │
│  (100 lines)    │
└─────────┬───────┘
          │
┌─────────▼───────┐
│  External Tasks │
└─────────────────┘
```

### 核心组件

#### 1. TaskRunner（100 行）
```typescript
class TaskRunner {
  // 并发控制
  async run(task: TaskConfig): Promise<string>
  
  // 状态管理
  getStatus(): RunnerStatus
  getResult(taskId: string): TaskResult
  
  // 批量执行
  runBatch(tasks: TaskConfig[]): Promise<string[]>
}
```

#### 2. MCP Server（200 行）
```typescript
class CodexMCPServer {
  // 工具注册
  setupTools()
  
  // 消息处理
  handleExec(args: any): Promise<any>
  handleStatus(args: any): Promise<any>
  handleReply(args: any): Promise<any>
  
  // 会话管理
  manageSessions()
}
```

#### 3. HTTP API（150 行）
```typescript
class HTTPAdapter {
  // REST 端点
  setupRoutes()
  
  // WebSocket 支持
  setupWebSocket()
  
  // 状态推送
  pushUpdates()
}
```

## 📈 成功指标

### 技术指标
- [ ] 代码行数减少 90%（5000+ → 550）
- [ ] 启动时间 < 50ms
- [ ] 内存占用 < 20MB
- [ ] 支持 50+ 并发任务

### 用户指标
- [ ] MCP 调用成功率 > 99%
- [ ] 平均响应时间 < 100ms
- [ ] 用户学习成本 < 5 分钟
- [ ] 用户满意度 > 4.5/5

### 业务指标
- [ ] Claude Code 集成使用率 > 60%
- [ ] 日活跃用户增长 200%
- [ ] 任务执行效率提升 5x
- [ ] 错误率 < 1%

## 🔄 开发计划

### Week 1：核心 MVP（300 行）
- [ ] 实现 TaskRunner 核心引擎
- [ ] 实现基础 MCP 服务器
- [ ] 支持 6 个核心 MCP 工具
- [ ] 基础测试和文档

### Week 2：MCP 完善（+100 行）
- [ ] 优化 MCP 交互体验
- [ ] 添加任务依赖管理
- [ ] 完善错误处理
- [ ] 编写用户指南

### Week 3：HTTP API（+200 行）
- [ ] 实现 REST API
- [ ] 添加 WebSocket 支持
- [ ] API 文档生成
- [ ] 集成测试

### Week 4：CLI 和发布（+50 行）
- [ ] 实现 CLI 接口
- [ ] 打包和发布
- [ ] 迁移指南
- [ ] 用户反馈收集

## 🎯 竞争分析

### 优势
1. **MCP 深度集成**：市面上唯一专注 Claude Code 集成的工具
2. **极简设计**：零学习成本，5 分钟上手
3. **高性能**：轻量级实现，资源占用极小
4. **开源友好**：MIT 协议，易于扩展

### 差异化
- vs. Makefile：更智能的依赖管理和并行执行
- vs. npm scripts：跨平台支持和实时状态监控
- vs. GitHub Actions：本地开发场景更适用
- vs. Task Runner：专注 Claude Code 集成

## 📋 PRD 验收标准

### MVP 验收
1. **功能完整**：所有 MCP 工具正常工作
2. **性能达标**：并发执行 10+ 任务无压力
3. **体验流畅**：Claude Code 对话不中断
4. **文档齐全**：快速上手指南 + API 文档

### 最终验收
1. **多接口支持**：MCP + HTTP + CLI
2. **稳定可靠**：连续运行 24h 无崩溃
3. **生态友好**：易于集成和扩展
4. **用户满意**：真实用户反馈积极

---

**总结**：Codex Father 2.0 将通过极简的设计和 MCP 深度集成，为 Claude Code 用户提供前所未有的自动化开发体验。从复杂到简单，从工具到伙伴。