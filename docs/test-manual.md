# 🧪 Codex Father 测试手册

## 📋 概述

本手册提供了 Codex Father 项目的完整测试指南，包括内存优化的分批测试解决方案。

## 🚀 快速开始

### 日常开发测试
```bash
# 核心单元测试 - 快速验证基础功能
npm run test:unit

# 已验证可运行的单独测试
npm run test:run tests/unit/schemas/status-example.test.ts --no-coverage
npm run test:run tests/unit/http-version.test.ts --no-coverage

# 构建验证
npm run build
```

### 完整测试套件（内存优化）
```bash
# 分批测试 - 解决内存溢出问题
npm run test:batch

# 快速分批测试
npm run test:quick unit

# 清理测试结果
npm run test:clean

# 合并测试报告
npm run test:merge
```

## 📊 测试分类与命令

### 1. 基础测试命令
```bash
npm run test              # 交互式测试模式
npm run test:run          # 运行所有测试（单次）
npm run test:unit         # 单元测试
npm run test:integration  # 集成测试
npm run test:e2e          # E2E测试
npm run test:coverage     # 覆盖率测试
```

### 2. 内存优化测试（推荐）
```bash
# 分批执行所有测试（16个批次，避免内存溢出）
npm run test:batch

# 按类型快速测试
npm run test:quick unit          # 单元测试 (~2GB内存)
npm run test:quick integration   # 集成测试 (~3GB内存)
npm run test:quick contract      # 契约测试 (~2GB内存)
npm run test:quick http          # HTTP测试 (~3GB内存)
npm run test:quick mcp           # MCP测试 (~4GB内存)
npm run test:quick e2e           # E2E测试 (~6GB内存)
```

### 3. 测试管理
```bash
npm run test:clean       # 清理测试结果和覆盖率
npm run test:merge       # 合并分批测试结果
```

## 🔧 已验证可用的测试

### ✅ 确认通过的测试文件
```bash
# 基础schemas测试
npm run test:run tests/unit/schemas/status-example.test.ts --no-coverage

# HTTP版本测试
npm run test:run tests/unit/http-version.test.ts --no-coverage

# HTTP服务器单元测试（部分通过）
npm run test:run tests/unit/http/HTTPServer.unit.test.ts --no-coverage
```


## 📈 分批测试详情

### 批次划分（16个批次）
1. **core-units** - 核心单元测试 (2GB内存，5分钟)
2. **small-units** - 小型单元测试 (1.5GB内存，2分钟)
3. **http-server** - HTTP服务器测试 (3GB内存，10分钟)
4. **contracts** - 契约测试 (2.5GB内存，5分钟)
5. **small-contracts** - 小型契约测试 (2GB内存，4分钟)
6. **auth-contracts** - 认证契约测试 (2GB内存，4分钟)
7. **medium-integration** - 中型集成测试 (3GB内存，6分钟)
8. **taskrunner-tests** - TaskRunner测试 (4GB内存，8分钟)
9. **mcp-server** - MCP服务器测试 (4GB内存，10分钟)
10. **e2e-http-api** - E2E HTTP API测试 (6GB内存，15分钟)
11. **e2e-concurrency** - E2E并发测试 (6GB内存，15分钟)
12. **e2e-mcp-toolkit** - E2E MCP工具包测试 (6GB内存，15分钟)
13. **acceptance** - 验收测试 (3GB内存，10分钟)
14. **remaining-integration** - 剩余集成测试 (4GB内存，10分钟)
15. **complex-integration** - 复杂集成测试 (5GB内存，12分钟)
16. **remaining-contracts** - 剩余契约测试 (2GB内存，5分钟)

### 内存压力分级
- 🟢 **低压力** (<2GB): 基础单元测试、小型契约测试
- 🟡 **中压力** (2-4GB): HTTP服务器、集成测试
- 🔴 **高压力** (>4GB): E2E测试、MCP服务器测试

## 🛠️ 开发工作流

### 1. 日常开发
```bash
# 1. 快速验证基础功能
npm run test:run tests/unit/schemas/status-example.test.ts --no-coverage

# 2. 构建检查
npm run build

# 3. 代码质量检查
npm run lint
npm run typecheck
```

### 2. 功能开发完成
```bash
# 1. 运行相关批次测试
npm run test:quick unit    # 如果修改了核心功能
npm run test:quick http    # 如果修改了HTTP功能

# 2. 完整测试（如果时间允许）
npm run test:batch

# 3. 查看测试报告
npm run test:merge
```

### 3. 提交前验证
```bash
# 1. 代码质量
npm run lint
npm run typecheck

# 2. 构建验证
npm run build

# 3. 快速测试
npm run test:quick unit
```

### 4. CI/CD流水线
```bash
# 1. 清理环境
npm run test:clean

# 2. 完整分批测试
npm run test:batch

# 3. 合并结果
npm run test:merge

# 4. 检查成功率
cat test-results/merged-test-report.json | jq '.summary.successRate'
```

## 📊 测试报告

### 报告文件位置
- **分批测试报告**: `./test-results/batch-test-report.json`
- **合并测试报告**: `./test-results/merged-test-report.json`
- **覆盖率报告**: `./coverage/lcov-report/index.html`

### 报告解读
```json
{
  "summary": {
    "totalTests": 1000,        // 测试总数
    "totalPassed": 950,        // 通过数量
    "totalFailed": 50,         // 失败数量
    "successRate": "95.0%",    // 成功率
    "totalDuration": "1200s"   // 总耗时
  }
}
```

## 🔧 故障排除

### 常见问题

**1. 内存溢出 (JavaScript heap out of memory)**
```bash
# 解决方案：使用分批测试
npm run test:batch
# 或降低内存的快速测试
npm run test:quick unit
```

**2. 某个测试文件找不到**
```bash
# 检查文件是否存在
find tests -name "具体文件名"

# 使用绝对路径测试
npm run test:run /完整路径/文件名 --no-coverage
```

**3. TypeScript类型错误**
```bash
# 重新构建
npm run clean
npm run build

# 类型检查
npm run typecheck
```

**4. 依赖缺失**
```bash
# 重新安装依赖
npm install

# 检查特定依赖
npm list 包名
```

### 调试技巧

**详细输出模式**
```bash
# 启用详细输出
DEBUG=vitest:* npm run test:batch

# 查看内存使用
node --trace gc scripts/run-batch-tests.ts
```

**单独运行问题批次**
```bash
# 运行特定批次
NODE_OPTIONS="--max-old-space-size=2048" npx vitest run tests/unit/schemas/status-example.test.ts --verbose
```

## 📝 测试最佳实践

### 1. 内存管理
- 优先使用 `npm run test:quick` 进行日常验证
- 完整测试使用 `npm run test:batch` 避免内存溢出
- 定期清理 `npm run test:clean`

### 2. 测试策略
- 基础功能：使用单元测试快速验证
- API功能：使用HTTP服务器测试
- 集成功能：使用分批测试
- 生产发布：运行完整批次测试

### 3. 报告分析
- 关注成功率，目标 >90%
- 监控内存使用，避免溢出
- 查看失败批次，优先修复关键问题

## 🎯 性能基准

### 预期执行时间
- **快速单元测试**: < 30秒
- **单个批次测试**: 2-15分钟
- **完整分批测试**: < 20分钟
- **覆盖率报告**: < 5分钟

### 内存使用预期
- **低压力批次**: < 2GB
- **中压力批次**: 2-4GB
- **高压力批次**: > 4GB
- **峰值内存**: < 8GB（分批执行）

## 📋 项目配置总结

### 依赖包统计
- **总依赖数**: 32个（清理前200+个）
- **生产依赖**: 14个核心包
- **开发依赖**: 18个工具包
- **精简程度**: 减少85%依赖数量

### 核心脚本命令
```bash
npm run dev          # 开发模式
npm run build        # 构建项目
npm run test:unit    # 单元测试
npm run test:batch   # 分批测试
npm run test:quick   # 快速测试
npm run lint         # 代码检查
npm run format       # 代码格式化
npm run typecheck    # 类型检查
```

---

**文档版本**: v1.7.0  
**创建时间**: 2025-01-16  
**维护团队**: 测试团队  
**更新说明**: 包含内存优化的分批测试解决方案