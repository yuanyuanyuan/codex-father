# MCP 工具集介绍

MCP (Model Context Protocol) 是 Codex Father 2.0 的核心功能，提供与 Claude Code 的深度集成。通过六件套工具，你可以在对话环境中无缝执行和管理开发任务。

## 🎯 什么是 MCP 集成？

MCP 集成让你能够在 Claude Code 中直接：
- 🚀 **提交开发任务** - 自然语言描述需求
- 📊 **监控执行状态** - 实时查看任务进度
- 📝 **查看执行日志** - 获取详细的执行信息
- 💬 **继续任务对话** - 基于结果继续交互
- 📋 **管理任务列表** - 查看所有任务状态
- ❌ **取消运行任务** - 及时停止不需要的任务

## 🔧 MCP 六件套工具

| 工具名称 | 功能描述 | 使用场景 |
|---------|---------|----------|
| **codex_exec** | 执行开发任务 | 提交新的开发任务 |
| **codex_status** | 查询任务状态 | 检查任务执行进度 |
| **codex_logs** | 获取执行日志 | 查看详细的执行信息 |
| **codex_reply** | 继续任务对话 | 基于结果继续交互 |
| **codex_list** | 列出所有任务 | 查看任务概览 |
| **codex_cancel** | 取消运行任务 | 停止不需要的任务 |

## 🚀 快速体验

### 步骤 1：启动 MCP 服务器

```bash
# 启动 Codex Father MCP 服务
codex-father mcp

# 或者指定配置
codex-father mcp --max-concurrency 10 --timeout 600000
```

### 步骤 2：配置 Claude Code

在 Claude Code 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": ["mcp", "--max-concurrency", "10"]
    }
  }
}
```

### 步骤 3：开始对话

```
用户: 帮我创建一个用户登录功能

Claude: [调用 codex_exec 工具]
✅ 任务已提交: task-1704067200000-abc123
正在创建用户登录功能...

用户: 查看任务进度

Claude: [调用 codex_status 工具]
📊 任务状态: 正在执行中 (60%)
- 创建登录组件 ✅
- 实现表单验证 ✅  
- 添加样式处理 🔄
```

## 📋 详细工具说明

### 1. codex_exec - 执行开发任务

**功能**: 提交新的开发任务供执行

**参数**:
```json
{
  "taskId": "optional-custom-id",
  "prompt": "创建一个用户登录组件",
  "command": "npm test",
  "files": ["src/components/", "package.json"],
  "environment": "nodejs",
  "priority": "high",
  "dependencies": ["task-123"],
  "timeout": 300000,
  "workingDirectory": "/workspace"
}
```

**使用示例**:
```
用户: 帮我重构这个组件，让它支持 TypeScript

Claude: [调用 codex_exec]
{
  "prompt": "将 React 组件重构为 TypeScript，添加类型定义和接口",
  "files": ["src/components/UserProfile.jsx"],
  "environment": "nodejs"
}
```

**响应示例**:
```
✅ 任务已接受: task-1704067200000-def456
🎯 任务目标: 重构组件为 TypeScript
📁 包含文件: src/components/UserProfile.jsx
⏱️ 预计时间: 2-3 分钟
```

### 2. codex_status - 查询任务状态

**功能**: 查询特定任务的执行状态和进度

**参数**:
```json
{
  "taskId": "task-1704067200000-def456",
  "details": true
}
```

**使用示例**:
```
用户: 前面的重构任务怎么样了？

Claude: [调用 codex_status]
📊 任务状态详情
🔹 任务ID: task-1704067200000-def456
🔹 状态: 执行中 (75%)
🔹 开始时间: 2024-01-01 10:30:00
🔹 已运行: 2分15秒
🔹 当前进度: 正在添加接口定义

📋 完成步骤:
✅ 1. 分析原始组件结构
✅ 2. 创建 TypeScript 接口
🔄 3. 重构组件代码
⏳ 4. 添加类型检查
⏳ 5. 更新导入语句
```

**状态类型**:
- `queued`: 排队等待
- `running`: 正在执行
- `completed`: 执行完成
- `failed`: 执行失败
- `cancelled`: 已取消

### 3. codex_logs - 获取执行日志

**功能**: 查看任务的详细执行日志和输出

**参数**:
```json
{
  "taskId": "task-1704067200000-def456",
  "lines": 50,
  "follow": false,
  "level": "info"
}
```

**使用示例**:
```
用户: 我想看看重构任务的详细日志

Claude: [调用 codex_logs]
📝 任务执行日志
[10:30:15] 🚀 开始执行任务: TypeScript 重构
[10:30:16] 📁 分析文件: src/components/UserProfile.jsx
[10:30:18] ✅ 组件结构分析完成
[10:30:20] 🔧 创建接口: UserProfileProps
[10:30:22] 🔧 创建接口: UserProfileState
[10:30:25] 🔄 重构组件代码...
[10:30:28] ✅ 类型定义添加完成
[10:30:30] 📝 生成 TypeScript 代码:
```typescript
interface UserProfileProps {
  user: User;
  onUpdate: (user: User) => void;
}

interface UserProfileState {
  loading: boolean;
  error: string | null;
}
```
[10:30:32] 🎯 任务执行完成
```

### 4. codex_reply - 继续任务对话

**功能**: 基于任务结果继续交互或修改需求

**参数**:
```json
{
  "taskId": "task-1704067200000-def456",
  "message": "现在添加表单验证功能",
  "context": "add form validation"
}
```

**使用示例**:
```
用户: 重构完成了，现在给这个组件添加表单验证

Claude: [调用 codex_reply]
💬 继续任务: task-1704067200000-def456
📝 附加需求: 添加表单验证功能
🔄 正在基于之前的结果继续开发...

✅ 表单验证已添加
- 邮箱格式验证 ✅
- 密码强度检查 ✅  
- 实时验证反馈 ✅
- 错误信息显示 ✅
```

### 5. codex_list - 列出所有任务

**功能**: 查看所有任务的状态概览

**参数**:
```json
{
  "status": "all",
  "limit": 20,
  "sortBy": "startTime"
}
```

**使用示例**:
```
用户: 显示所有正在进行的任务

Claude: [调用 codex_list]
📋 任务列表概览

🔄 正在执行 (3):
• task-1704067200000-def456: TypeScript 重构 (75%)
• task-1704067200001-ghi789: API 接口开发 (40%)  
• task-1704067200002-jkl012: 单元测试编写 (20%)

✅ 已完成 (5):
• task-1704067100000-abc123: 用户登录组件
• task-1704067100001-bcd234: 数据模型设计
• task-1704067100002-cde345: 样式优化
• task-1704067100003-def456: 路由配置
• task-1704067100004-efg567: 文档更新

⏳ 排队等待 (2):
• task-1704067200003-mno345: 性能优化
• task-1704067200004-pqr456: 错误处理
```

### 6. codex_cancel - 取消运行任务

**功能**: 取消正在执行或排队中的任务

**参数**:
```json
{
  "taskId": "task-1704067200000-def456",
  "reason": "no longer needed"
}
```

**使用示例**:
```
用户: 取消那个重构任务，我有新的想法

Claude: [调用 codex_cancel]
🛑 正在取消任务: task-1704067200000-def456
⏹️ 任务已停止
📁 清理临时文件...
✅ 取消完成

任务状态更新为: cancelled
```

## 🎯 实际使用场景

### 场景 1: 功能开发

```
用户: 我需要开发一个完整的用户管理系统

Claude: [调用 codex_exec]
✅ 任务已提交: task-user-management
🎯 目标: 开发用户管理系统
📋 包含模块:
- 用户注册/登录
- 个人资料管理  
- 权限控制
- 数据验证

[几分钟后...]

用户: 查看开发进度

Claude: [调用 codex_status]
📊 用户管理系统开发进度 (60%)
✅ 后端 API 设计 (100%)
✅ 数据库模型 (100%)  
🔄 前端组件开发 (70%)
⏳ 权限集成 (0%)
```

### 场景 2: 代码重构

```
用户: 这个项目需要优化性能

Claude: [调用 codex_exec]
✅ 任务已提交: task-performance-opt
🔍 开始性能分析...
发现以下优化点:
- 组件重复渲染
- 内存泄漏风险
- API 调用未优化

用户: 先处理组件渲染问题

Claude: [调用 codex_reply]
🎯 专注优化: 组件渲染性能
📝 应用 React.memo 和 useMemo
🔄 重新渲染次数减少 80%
```

### 场景 3: 错误修复

```
用户: 生产环境有个 bug 需要紧急修复

Claude: [调用 codex_exec]
✅ 紧急任务已提交: task-bugfix
🚨 优先级: HIGH
🔍 正在分析错误日志...

用户: 有新的进展吗？

Claude: [调用 codex_logs]
📝 Bug 修复进度:
[14:30:15] 🔍 定位问题: 用户认证失败
[14:30:20] 🎯 找到根因: Token 过期处理错误
[14:30:25] 🔧 编写修复代码...
[14:30:30] ✅ 修复完成，正在测试
[14:30:35] 🧪 单元测试通过
[14:30:40] 🚀 可以部署了
```

## ⚙️ 高级配置

### 会话管理

MCP 工具支持会话上下文，让对话更连贯：

```json
{
  "sessionId": "session-123",
  "context": {
    "project": "e-commerce",
    "previousTasks": ["setup", "auth", "database"],
    "userPreferences": {
      "style": "typescript",
      "framework": "react"
    }
  }
}
```

### 批量操作

```
用户: 我需要同时处理几个任务

Claude: [调用 codex_exec] × 3
✅ 批量任务已提交:
1. 数据库迁移 (task-migration)
2. API 文档更新 (task-docs)  
3. 单元测试补充 (task-tests)

用户: 查看所有任务状态

Claude: [调用 codex_list]
📊 批量任务状态:
🔄 数据库迁移: 90%
🔄 API 文档: 60%
🔄 单元测试: 30%
```

## 🔍 故障排除

### 常见问题

**Q: MCP 工具无响应**
```bash
# 检查 MCP 服务器状态
codex-father status

# 重启 MCP 服务
pkill -f "codex-father mcp"
codex-father mcp
```

**Q: 任务执行失败**
```
用户: 任务失败了，怎么办？

Claude: [调用 codex_logs]
📝 错误日志:
[15:30:10] ❌ 任务执行失败
[15:30:11] 📄 错误类型: DEPENDENCY_FAILED
[15:30:12] 🔍 详细信息: 依赖的包未安装

建议解决方案:
1. 运行 npm install
2. 检查 package.json 依赖
3. 重新提交任务
```

**Q: 找不到任务ID**
```
用户: 我忘记任务ID了

Claude: [调用 codex_list]
📋 最近的任务列表:
• task-1704067200000-abc123: 用户组件 (已完成)
• task-1704067200001-def456: API 开发 (进行中)
• task-1704067200002-ghi789: 测试编写 (排队中)
```

## ✅ 最佳实践

### 1. 任务命名规范

```json
{
  "taskId": "feature-user-auth-v2",
  "prompt": "实现用户认证功能 v2.0"
}
```

### 2. 合理设置优先级

```json
{
  "priority": "high",    // 紧急修复
  "priority": "normal",  // 常规开发  
  "priority": "low"      // 优化改进
}
```

### 3. 管理任务依赖

```json
{
  "dependencies": ["setup-database", "create-models"],
  "prompt": "基于数据模型创建 API 接口"
}
```

### 4. 上下文保持

```
用户: 继续之前的登录功能开发

Claude: [基于会话上下文]
📋 检测到相关任务: task-user-auth
🔄 继续之前的工作...
✅ 登录功能已扩展
```

## 🎉 下一步

现在你已经掌握了 MCP 工具集的基本用法：

1. **深入学习** → [MCP 工具详解](./tools.md)
2. **配置指南** → [Claude Code 配置](./claude-code-setup.md)
3. **会话管理** → [会话上下文](./sessions.md)
4. **实际示例** → [MCP 使用示例](../examples/mcp-workflows.md)

---

**💡 小贴士**: MCP 集成的威力在于**对话式开发**。你可以自然地描述需求，让 AI 理解并执行，然后基于结果继续迭代，这是传统工具无法提供的体验！