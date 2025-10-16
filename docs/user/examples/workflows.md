# 实用工作流示例

本文档提供 Codex Father 2.0 在真实开发场景中的实用工作流示例，帮助你快速将工具集成到日常开发工作中。

## 🎯 示例概览

### 开发场景
- [🏗️ 项目初始化工作流](#项目初始化工作流)
- [🧪 测试驱动开发工作流](#测试驱动开发工作流)
- [🚀 部署自动化工作流](#部署自动化工作流)
- [🔧 代码重构工作流](#代码重构工作流)

### 集成场景
- [🤖 AI 辅助开发工作流](#ai-辅助开发工作流)
- [📊 数据处理工作流](#数据处理工作流)
- [🔄 CI/CD 集成工作流](#cicd-集成工作流)
- [📚 文档生成工作流](#文档生成工作流)

## 🏗️ 项目初始化工作流

### 场景描述
快速创建新项目的基础结构，包括目录创建、依赖安装、初始代码生成等。

### MCP 方式（推荐）

```javascript
// 在 Claude Code 中执行
用户: 帮我创建一个完整的 React + TypeScript 项目

Claude: [调用 codex_exec]
✅ 任务已提交: task-react-setup
🎯 创建 React + TypeScript 项目
📋 包含以下组件：
- 项目结构创建
- 依赖安装 (React, TypeScript, ESLint, Prettier)
- 配置文件生成
- 示例组件创建
- 开发服务器配置

[等待任务完成]

✅ 项目初始化完成！
📁 项目结构:
my-react-app/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── types/
│   └── utils/
├── public/
├── package.json
├── tsconfig.json
├── .eslintrc.js
└── README.md

用户: 启动开发服务器

Claude: [调用 codex_exec]
✅ 开发服务器已启动: http://localhost:3000
🔄 热重载已启用
```

### CLI 方式

```bash
# 1. 创建项目初始化配置
cat > project-init.json << 'EOF'
{
  "tasks": [
    {
      "id": "create-structure",
      "command": "mkdir -p my-app/{src/{components,hooks,types,utils},public,tests,docs}",
      "environment": "shell"
    },
    {
      "id": "init-package",
      "command": "cd my-app && npm init -y",
      "environment": "shell",
      "dependencies": ["create-structure"]
    },
    {
      "id": "install-deps",
      "command": "cd my-app && npm install react react-dom typescript @types/react @types/react-dom",
      "environment": "shell",
      "dependencies": ["init-package"]
    },
    {
      "id": "install-dev-deps",
      "command": "cd my-app && npm install --save-dev @vitejs/plugin-react vite eslint @typescript-eslint/eslint-plugin prettier",
      "environment": "shell",
      "dependencies": ["install-deps"]
    },
    {
      "id": "create-configs",
      "command": "cd my-app && echo '{\"compilerOptions\": {\"target\": \"ES2020\"}}' > tsconfig.json",
      "environment": "shell",
      "dependencies": ["install-dev-deps"]
    },
    {
      "id": "create-vite-config",
      "command": "cd my-app && cat > vite.config.ts << 'VITEEOF'\nimport { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()]\n})\nVITEEOF",
      "environment": "shell",
      "dependencies": ["create-configs"]
    },
    {
      "id": "create-app-component",
      "command": "cd my-app && cat > src/App.tsx << 'APPEOF'\nimport React from 'react'\nimport './App.css'\n\nfunction App() {\n  return (\n    <div className=\"App\">\n      <h1>Welcome to React + TypeScript!</h1>\n    </div>\n  )\n}\n\nexport default App\nAPPEOF",
      "environment": "shell",
      "dependencies": ["create-vite-config"]
    }
  ]
}
EOF

# 2. 执行项目初始化
codex-father run project-init.json

# 3. 查看执行状态
codex-father status --watch
```

### HTTP API 方式

```bash
# 1. 启动服务器
codex-father server --port 3000 &

# 2. 提交项目初始化任务
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "创建一个 Next.js 项目，包含 TypeScript、Tailwind CSS 和 ESLint 配置",
    "environment": "nodejs",
    "priority": "high",
    "workingDirectory": "./projects"
  }'

# 3. 监控任务进度
curl http://localhost:3000/tasks/task-123
```

## 🧪 测试驱动开发工作流

### 场景描述
在开发新功能时，先编写测试，然后实现功能代码，确保代码质量和测试覆盖率。

### MCP 方式

```javascript
用户: 我需要为用户管理功能创建 TDD 工作流

Claude: [调用 codex_exec]
✅ 任务已提交: task-tdd-user-management
🎯 用户管理功能 TDD 开发

第一步：创建测试文件
[正在创建 tests/userManagement.test.ts...]

用户: 查看测试进度

Claude: [调用 codex_status]
📊 TDD 工作流进度 (40%)
✅ 1. 创建测试文件结构
✅ 2. 编写用户创建测试
🔄 3. 编写用户更新测试
⏳ 4. 实现功能代码
⏳ 5. 运行测试验证

用户: 继续实现功能代码

Claude: [调用 codex_reply]
💬 继续实现: userManagement 功能
🔧 正在基于测试编写实现代码...
✅ 所有测试通过: 15/15
📊 测试覆盖率: 95%
```

### CLI 配置文件

```json
{
  "tasks": [
    {
      "id": "create-test-structure",
      "command": "mkdir -p tests/{unit,integration,e2e}",
      "environment": "shell"
    },
    {
      "id": "write-user-tests",
      "command": "cat > tests/userManagement.test.ts << 'TESTEOF'\nimport { UserManagement } from '../src/userManagement'\n\ndescribe('UserManagement', () => {\n  let userMgmt: UserManagement\n\n  beforeEach(() => {\n    userMgmt = new UserManagement()\n  })\n\n  test('should create user successfully', async () => {\n    const userData = { name: 'John Doe', email: 'john@example.com' }\n    const user = await userMgmt.createUser(userData)\n    expect(user.id).toBeDefined()\n    expect(user.name).toBe(userData.name)\n  })\n\n  test('should update user information', async () => {\n    // 测试用户更新功能\n  })\n\n  test('should validate user email', async () => {\n    // 测试邮箱验证\n  })\n})\nTESTEOF",
      "environment": "shell",
      "dependencies": ["create-test-structure"]
    },
    {
      "id": "run-tests-failing",
      "command": "npm test -- --watchAll=false",
      "environment": "shell",
      "dependencies": ["write-user-tests"]
    },
    {
      "id": "implement-user-management",
      "command": "cat > src/userManagement.ts << 'IMPLEOF'\nexport interface User {\n  id: string\n  name: string\n  email: string\n  createdAt: Date\n  updatedAt: Date\n}\n\nexport class UserManagement {\n  private users: Map<string, User> = new Map()\n\n  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {\n    this.validateEmail(userData.email)\n    \n    const user: User = {\n      id: this.generateId(),\n      ...userData,\n      createdAt: new Date(),\n      updatedAt: new Date()\n    }\n    \n    this.users.set(user.id, user)\n    return user\n  }\n\n  async updateUser(id: string, updates: Partial<User>): Promise<User> {\n    const user = this.users.get(id)\n    if (!user) {\n      throw new Error('User not found')\n    }\n    \n    if (updates.email) {\n      this.validateEmail(updates.email)\n    }\n    \n    const updatedUser = { ...user, ...updates, updatedAt: new Date() }\n    this.users.set(id, updatedUser)\n    return updatedUser\n  }\n\n  private validateEmail(email: string): void {\n    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/\n    if (!emailRegex.test(email)) {\n      throw new Error('Invalid email format')\n    }\n  }\n\n  private generateId(): string {\n    return Math.random().toString(36).substr(2, 9)\n  }\n}\nIMPLEOF",
      "environment": "shell",
      "dependencies": ["run-tests-failing"]
    },
    {
      "id": "run-tests-passing",
      "command": "npm test -- --coverage --watchAll=false",
      "environment": "shell",
      "dependencies": ["implement-user-management"]
    }
  ]
}
```

## 🚀 部署自动化工作流

### 场景描述
自动化项目的构建、测试和部署流程，支持多环境部署。

### 完整部署配置

```json
{
  "tasks": [
    {
      "id": "checkout-code",
      "command": "git pull origin main",
      "environment": "shell",
      "workingDirectory": "/var/www/app"
    },
    {
      "id": "install-dependencies",
      "command": "npm ci --production=false",
      "environment": "shell",
      "dependencies": ["checkout-code"],
      "workingDirectory": "/var/www/app"
    },
    {
      "id": "run-tests",
      "command": "npm run test:ci",
      "environment": "shell",
      "dependencies": ["install-dependencies"],
      "workingDirectory": "/var/www/app"
    },
    {
      "id": "build-application",
      "command": "npm run build",
      "environment": "shell",
      "dependencies": ["run-tests"],
      "workingDirectory": "/var/www/app"
    },
    {
      "id": "run-security-scan",
      "command": "npm audit --audit-level=moderate",
      "environment": "shell",
      "dependencies": ["build-application"],
      "workingDirectory": "/var/www/app"
    },
    {
      "id": "create-backup",
      "command": "cp -r /var/www/app/current /var/www/app/backup/$(date +%Y%m%d_%H%M%S)",
      "environment": "shell",
      "dependencies": ["run-security-scan"]
    },
    {
      "id": "deploy-staging",
      "command": "rsync -av --delete dist/ staging-server:/var/www/staging/",
      "environment": "shell",
      "dependencies": ["create-backup"],
      "condition": {
        "environment": "staging"
      }
    },
    {
      "id": "deploy-production",
      "command": "rsync -av --delete dist/ production-server:/var/www/production/",
      "environment": "shell",
      "dependencies": ["create-backup"],
      "condition": {
        "environment": "production"
      }
    },
    {
      "id": "health-check",
      "command": "curl -f http://staging-server/healthz || exit 1",
      "environment": "shell",
      "dependencies": ["deploy-staging"]
    },
    {
      "id": "notify-slack",
      "command": "curl -X POST -H 'Content-type: application/json' --data '{\"text\":\"🚀 Deployment to staging completed successfully!\"}' https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
      "environment": "shell",
      "dependencies": ["health-check"]
    }
  ]
}
```

### 部署脚本

```bash
#!/bin/bash
# deploy.sh - 自动化部署脚本

ENVIRONMENT=${1:-staging}
CONFIG_FILE="deploy-${ENVIRONMENT}.json"

echo "🚀 开始部署到 ${ENVIRONMENT} 环境..."

# 检查配置文件
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ 配置文件不存在: $CONFIG_FILE"
    exit 1
fi

# 执行部署
codex-father run "$CONFIG_FILE" \
  --environment "$ENVIRONMENT" \
  --continue-on-error

# 检查部署结果
if [ $? -eq 0 ]; then
    echo "✅ 部署成功完成!"
else
    echo "❌ 部署失败，请检查日志"
    codex-father logs --recent 20 --level error
    exit 1
fi
```

## 🔧 代码重构工作流

### 场景描述
系统性地重构现有代码，包括代码分析、重构计划、分步实施和测试验证。

### MCP 重构对话

```javascript
用户: 我需要重构这个遗留的用户认证系统，它现在有很多问题

Claude: [调用 codex_exec]
✅ 任务已提交: task-auth-refactor-analysis
🎯 分析遗留认证系统代码
📋 正在检查以下方面：
- 代码结构和组织
- 安全漏洞识别  
- 性能瓶颈分析
- 依赖关系梳理

用户: 分析结果如何？

Claude: [调用 codex_status]
📊 代码分析完成 (100%)
🔍 发现的主要问题：
1. 认证逻辑分散在多个文件
2. 密码存储不安全（明文）
3. 缺少输入验证
4. 没有会话管理
5. 错误处理不完善

用户: 制定重构计划

Claude: [调用 codex_reply]
💬 重构计划制定
📋 重构阶段：
阶段1: 安全修复（高优先级）
- 实现密码哈希
- 添加输入验证
- 修复SQL注入漏洞

阶段2: 架构重构（中优先级）  
- 统一认证接口
- 实现会话管理
- 重构数据库层

阶段3: 功能增强（低优先级）
- 添加多因子认证
- 实现OAuth集成
- 增强日志记录

要开始实施吗？
```

### 分步重构配置

```json
{
  "tasks": [
    {
      "id": "backup-current-code",
      "command": "cp -r src/auth src/auth.backup.$(date +%Y%m%d)",
      "environment": "shell"
    },
    {
      "id": "create-auth-interface",
      "command": "cat > src/auth/IAuthService.ts << 'INTEOF'\nexport interface IAuthService {\n  authenticate(email: string, password: string): Promise<AuthResult>\n  register(userData: RegisterData): Promise<User>\n  refreshToken(token: string): Promise<string>\n  logout(userId: string): Promise<void>\n}\n\nexport interface AuthResult {\n  success: boolean\n  user?: User\n  token?: string\n  error?: string\n}\n\nexport interface User {\n  id: string\n  email: string\n  name: string\n  role: string\n  createdAt: Date\n}\nINTEOF",
      "environment": "shell",
      "dependencies": ["backup-current-code"]
    },
    {
      "id": "implement-password-hashing",
      "command": "cat > src/auth/security.ts << 'SECEOF'\nimport bcrypt from 'bcryptjs'\n\nexport class PasswordService {\n  static async hashPassword(password: string): Promise<string> {\n    const saltRounds = 12\n    return bcrypt.hash(password, saltRounds)\n  }\n\n  static async verifyPassword(password: string, hash: string): Promise<boolean> {\n    return bcrypt.compare(password, hash)\n  }\n}\nSECEOF",
      "environment": "shell",
      "dependencies": ["create-auth-interface"]
    },
    {
      "id": "implement-input-validation",
      "command": "cat > src/auth/validation.ts << 'VALEOF'\nexport class ValidationService {\n  static validateEmail(email: string): boolean {\n    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/\n    return emailRegex.test(email)\n  }\n\n  static validatePassword(password: string): { valid: boolean; errors: string[] } {\n    const errors: string[] = []\n    \n    if (password.length < 8) {\n      errors.push('密码长度至少8位')\n    }\n    \n    if (!/[A-Z]/.test(password)) {\n      errors.push('密码必须包含大写字母')\n    }\n    \n    if (!/[a-z]/.test(password)) {\n      errors.push('密码必须包含小写字母')\n    }\n    \n    if (!/[0-9]/.test(password)) {\n      errors.push('密码必须包含数字')\n    }\n    \n    return {\n      valid: errors.length === 0,\n      errors\n    }\n  }\n}\nVALEOF",
      "environment": "shell",
      "dependencies": ["implement-password-hashing"]
    },
    {
      "id": "refactor-auth-service",
      "command": "cat > src/auth/AuthService.ts << 'AUTHEOF'\nimport { IAuthService, AuthResult, User, RegisterData } from './IAuthService'\nimport { PasswordService } from './security'\nimport { ValidationService } from './validation'\nimport { DatabaseService } from './database'\nimport { TokenService } from './token'\n\nexport class AuthService implements IAuthService {\n  private db: DatabaseService\n  private tokenService: TokenService\n\n  constructor() {\n    this.db = new DatabaseService()\n    this.tokenService = new TokenService()\n  }\n\n  async authenticate(email: string, password: string): Promise<AuthResult> {\n    try {\n      // 输入验证\n      if (!ValidationService.validateEmail(email)) {\n        return { success: false, error: '邮箱格式无效' }\n      }\n\n      // 查找用户\n      const user = await this.db.findUserByEmail(email)\n      if (!user) {\n        return { success: false, error: '用户不存在' }\n      }\n\n      // 验证密码\n      const isValidPassword = await PasswordService.verifyPassword(password, user.passwordHash)\n      if (!isValidPassword) {\n        return { success: false, error: '密码错误' }\n      }\n\n      // 生成令牌\n      const token = this.tokenService.generateToken(user)\n\n      return {\n        success: true,\n        user: { ...user, passwordHash: undefined },\n        token\n      }\n    } catch (error) {\n      return { success: false, error: '认证服务异常' }\n    }\n  }\n\n  async register(userData: RegisterData): Promise<User> {\n    // 实现用户注册逻辑\n  }\n\n  async refreshToken(token: string): Promise<string> {\n    // 实现令牌刷新逻辑\n  }\n\n  async logout(userId: string): Promise<void> {\n    // 实现登出逻辑\n  }\n}\nAUTHEOF",
      "environment": "shell",
      "dependencies": ["implement-input-validation"]
    },
    {
      "id": "run-refactor-tests",
      "command": "npm test -- --testPathPattern=auth",
      "environment": "shell",
      "dependencies": ["refactor-auth-service"]
    }
  ]
}
```

## 🤖 AI 辅助开发工作流

### 场景描述
结合 AI 能力，实现智能化的代码生成、错误修复和优化建议。

### AI 辅助功能开发

```javascript
用户: 我需要开发一个智能代码审查工具，能够自动检测代码问题

Claude: [调用 codex_exec]
✅ 任务已提交: task-code-review-tool
🎯 开发智能代码审查工具
🤖 AI 功能规划：
1. 静态代码分析
2. 安全漏洞检测  
3. 性能问题识别
4. 代码风格检查
5. 最佳实践建议

用户: 先实现核心分析功能

Claude: [调用 codex_reply]
💬 实现代码分析核心功能
🔧 正在创建分析引擎...
✅ 核心分析模块已完成：
- AST 解析器
- 规则引擎
- 问题分类器
- 报告生成器

用户: 添加自定义规则支持

Claude: [调用 codex_reply]  
💬 扩展自定义规则系统
🎯 规则配置化完成
✅ 支持的功能：
- JSON 规则定义
- 动态规则加载
- 规则优先级管理
- 规则测试框架
```

### 智能代码审查配置

```json
{
  "tasks": [
    {
      "id": "setup-code-review-project",
      "command": "mkdir -p code-reviewer/{src/{analyzers,rules,reporters},tests,config}",
      "environment": "shell"
    },
    {
      "id": "create-core-analyzer",
      "command": "cat > code-reviewer/src/CodeAnalyzer.ts << 'ANALEOF'\nimport * as ts from 'typescript'\nimport { RuleEngine } from './RuleEngine'\nimport { ReportGenerator } from './ReportGenerator'\n\nexport interface AnalysisResult {\n  filePath: string\n  issues: CodeIssue[]\n  metrics: CodeMetrics\n  suggestions: Suggestion[]\n}\n\nexport interface CodeIssue {\n  id: string\n  severity: 'error' | 'warning' | 'info'\n  message: string\n  line: number\n  column: number\n  rule: string\n  fix?: FixSuggestion\n}\n\nexport class CodeAnalyzer {\n  private ruleEngine: RuleEngine\n  private reportGenerator: ReportGenerator\n\n  constructor() {\n    this.ruleEngine = new RuleEngine()\n    this.reportGenerator = new ReportGenerator()\n  }\n\n  async analyzeFile(filePath: string): Promise<AnalysisResult> {\n    const sourceCode = await this.readFile(filePath)\n    const ast = this.createAST(sourceCode, filePath)\n    \n    const issues = await this.ruleEngine.analyze(ast, sourceCode)\n    const metrics = this.calculateMetrics(ast, sourceCode)\n    const suggestions = this.generateSuggestions(issues, metrics)\n\n    return {\n      filePath,\n      issues,\n      metrics,\n      suggestions\n    }\n  }\n\n  async analyzeProject(projectPath: string): Promise<AnalysisResult[]> {\n    const files = await this.getSourceFiles(projectPath)\n    const results = await Promise.all(\n      files.map(file => this.analyzeFile(file))\n    )\n    return results\n  }\n\n  private createAST(sourceCode: string, filePath: string): ts.SourceFile {\n    return ts.createSourceFile(\n      filePath,\n      sourceCode,\n      ts.ScriptTarget.Latest,\n      true\n    )\n  }\n\n  private async readFile(filePath: string): Promise<string> {\n    // 实现文件读取逻辑\n  }\n\n  private async getSourceFiles(projectPath: string): Promise<string[]> {\n    // 实现文件扫描逻辑\n  }\n\n  private calculateMetrics(ast: ts.SourceFile, sourceCode: string): CodeMetrics {\n    // 实现代码指标计算\n  }\n\n  private generateSuggestions(issues: CodeIssue[], metrics: CodeMetrics): Suggestion[] {\n    // 实现建议生成逻辑\n  }\n}\nANALEOF",
      "environment": "shell",
      "dependencies": ["setup-code-review-project"]
    },
    {
      "id": "create-rule-engine",
      "command": "cat > code-reviewer/src/RuleEngine.ts << 'RULEEOF'\nimport { ts } from 'typescript'\nimport { CodeIssue, Rule } from '../types'\n\nexport class RuleEngine {\n  private rules: Map<string, Rule> = new Map()\n\n  constructor() {\n    this.loadBuiltinRules()\n  }\n\n  async analyze(ast: ts.SourceFile, sourceCode: string): Promise<CodeIssue[]> {\n    const issues: CodeIssue[] = []\n\n    for (const [name, rule] of this.rules) {\n      if (rule.enabled) {\n        const ruleIssues = await this.applyRule(rule, ast, sourceCode)\n        issues.push(...ruleIssues)\n      }\n    }\n\n    return issues.sort((a, b) => {\n      const severityOrder = { error: 3, warning: 2, info: 1 }\n      return severityOrder[b.severity] - severityOrder[a.severity]\n    })\n  }\n\n  private async applyRule(rule: Rule, ast: ts.SourceFile, sourceCode: string): Promise<CodeIssue[]> {\n    // 实现规则应用逻辑\n    return []\n  }\n\n  private loadBuiltinRules(): void {\n    // 加载内置规则\n    this.addRule(new NoConsoleLogRule())\n    this.addRule(new UnusedVariableRule())\n    this.addRule(new SecurityVulnerabilityRule())\n  }\n\n  addRule(rule: Rule): void {\n    this.rules.set(rule.name, rule)\n  }\n\n  removeRule(ruleName: string): void {\n    this.rules.delete(ruleName)\n  }\n\n  enableRule(ruleName: string): void {\n    const rule = this.rules.get(ruleName)\n    if (rule) {\n      rule.enabled = true\n    }\n  }\n\n  disableRule(ruleName: string): void {\n    const rule = this.rules.get(ruleName)\n    if (rule) {\n      rule.enabled = false\n    }\n  }\n}\n\n// 内置规则示例\nclass NoConsoleLogRule implements Rule {\n  name = 'no-console-log'\n  description = '禁止使用 console.log'\n  severity = 'warning' as const\n  enabled = true\n\n  async check(ast: ts.SourceFile, sourceCode: string): Promise<CodeIssue[]> {\n    const issues: CodeIssue[] = []\n    \n    ts.forEachChild(ast, (node) => {\n      if (ts.isCallExpression(node) && \n          ts.isIdentifier(node.expression) &&\n          node.expression.text === 'console') {\n        \n        const { line, character } = ast.getLineAndCharacterOfPosition(node.getStart())\n        issues.push({\n          id: `console-log-${line}`,\n          severity: this.severity,\n          message: '不应该使用 console.log，请使用适当的日志记录方式',\n          line: line + 1,\n          column: character + 1,\n          rule: this.name,\n          fix: {\n            type: 'replace',\n            message: '替换为 logger.log 或移除'\n          }\n        })\n      }\n    })\n\n    return issues\n  }\n}\nRULEEOF",
      "environment": "shell",
      "dependencies": ["create-core-analyzer"]
    }
  ]
}
```

## 📊 数据处理工作流

### 场景描述
处理大数据集，包括数据清洗、转换、分析和可视化。

### 数据处理管道

```json
{
  "tasks": [
    {
      "id": "data-ingestion",
      "command": "python scripts/data_ingestion.py --source csv --input data/raw/sales_data.csv",
      "environment": "python",
      "timeout": 300000
    },
    {
      "id": "data-validation",
      "command": "python scripts/data_validation.py --input data/processed/sales_data.json",
      "environment": "python",
      "dependencies": ["data-ingestion"]
    },
    {
      "id": "data-transformation",
      "command": "python scripts/data_transformation.py --input data/validated/sales_data.json --output data/transformed/",
      "environment": "python",
      "dependencies": ["data-validation"]
    },
    {
      "id": "data-analysis",
      "command": "python scripts/data_analysis.py --input data/transformed/ --output reports/",
      "environment": "python",
      "dependencies": ["data-transformation"]
    },
    {
      "id": "generate-visualizations",
      "command": "python scripts/generate_charts.py --data reports/analysis.json --output visuals/",
      "environment": "python",
      "dependencies": ["data-analysis"]
    },
    {
      "id": "create-dashboard",
      "command": "python scripts/create_dashboard.py --data reports/ --charts visuals/ --output dashboard/index.html",
      "environment": "python",
      "dependencies": ["generate-visualizations"]
    }
  ]
}
```

## 🔄 CI/CD 集成工作流

### GitHub Actions 配置

```yaml
# .github/workflows/codex-father.yml
name: Codex Father CI/CD

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install Codex Father
      run: npm install -g codex-father
    
    - name: Run Code Analysis
      run: |
        codex-father run .github/codex-father/analysis.json
    
    - name: Run Tests
      run: |
        codex-father run .github/codex-father/tests.json
    
    - name: Security Scan
      run: |
        codex-father run .github/codex-father/security.json

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install Codex Father
      run: npm install -g codex-father
    
    - name: Deploy to Production
      run: |
        codex-father run .github/codex-father/deploy.json \
          --environment production
      env:
        DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
```

## 📚 文档生成工作流

### 自动文档生成

```json
{
  "tasks": [
    {
      "id": "extract-api-docs",
      "command": "npx typedoc src/index.ts --out docs/api",
      "environment": "nodejs"
    },
    {
      "id": "generate-user-guide",
      "command": "node scripts/generate-user-guide.js",
      "environment": "nodejs",
      "dependencies": ["extract-api-docs"]
    },
    {
      "id": "create-code-examples",
      "command": "node scripts/generate-examples.js",
      "environment": "nodejs",
      "dependencies": ["extract-api-docs"]
    },
    {
      "id": "build-documentation",
      "command": "npm run docs:build",
      "environment": "nodejs",
      "dependencies": ["generate-user-guide", "create-code-examples"]
    },
    {
      "id": "deploy-docs",
      "command": "npm run docs:deploy",
      "environment": "nodejs",
      "dependencies": ["build-documentation"]
    }
  ]
}
```

## ✅ 工作流最佳实践

### 1. 任务设计原则

- **单一职责**: 每个任务只做一件事
- **幂等性**: 任务可以安全地重复执行
- **错误处理**: 明确定义失败时的行为
- **依赖管理**: 清晰定义任务间的依赖关系

### 2. 配置管理

```bash
# 环境特定配置
configs/
├── base.json          # 基础配置
├── development.json   # 开发环境
├── testing.json      # 测试环境
├── staging.json      # 预发布环境
└── production.json   # 生产环境
```

### 3. 监控和日志

```json
{
  "monitoring": {
    "enabled": true,
    "notifications": {
      "slack": {
        "webhook": "${SLACK_WEBHOOK_URL}",
        "channel": "#deployments"
      },
      "email": {
        "enabled": true,
        "recipients": ["dev-team@company.com"]
      }
    }
  }
}
```

### 4. 错误恢复

```json
{
  "errorHandling": {
    "retryPolicy": {
      "maxRetries": 3,
      "backoffMultiplier": 2,
      "initialDelay": 1000
    },
    "fallbackActions": {
      "onTimeout": "notify-admin",
      "onFailure": "rollback-deployment"
    }
  }
}
```

## 🎉 下一步

现在你已经看到了各种实际的工作流示例：

1. **自定义工作流** → [创建自定义工作流](./custom-workflows.md)
2. **高级集成** → [高级集成示例](./advanced-integrations.md)
3. **性能优化** → [工作流性能优化](./performance-optimization.md)
4. **故障排除** → [工作流故障排除](./workflow-troubleshooting.md)

---

**💡 提示**: 这些工作流示例可以根据你的具体需求进行调整和组合。关键是理解每个任务的职责和它们之间的依赖关系，这样就能构建出适合自己项目的自动化工作流。