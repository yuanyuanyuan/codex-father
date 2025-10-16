# 🧪 分批测试使用指南

## 概述

为了避免内存溢出问题，codex-father 项目现在提供了智能分批测试解决方案。该方案将大型测试套件分解为多个小批次，按内存压力和优先级执行。

## 🚀 快速开始

### 日常开发测试
```bash
# 快速单元测试 (推荐日常使用)
npm run test:quick:unit

# 快速集成测试
npm run test:quick:integration

# 快速HTTP服务器测试
npm run test:quick:http

# 快速MCP测试
npm run test:quick:mcp
```

### 完整分批测试
```bash
# 执行所有批次的完整测试
npm run test:batch

# 清理旧的测试结果
npm run test:clean

# 合并测试结果和覆盖率
npm run test:merge
```

## 📊 测试策略

### 内存压力分级
- **🔴 高压力** (>4GB): MCP服务器、E2E测试 - 单独运行
- **🟡 中压力** (2-4GB): HTTP服务器、集成测试 - 小批量运行  
- **🟢 低压力** (<2GB): 单元测试、契约测试 - 中批量运行

### 批次划分 (共16个批次)
1. **核心单元测试** - 基础功能验证 (2GB内存)
2. **小型单元测试** - 配置和工具类 (1.5GB内存)
3. **HTTP服务器测试** - Web接口测试 (3GB内存)
4. **契约测试** - JSON-RPC协议验证 (2.5GB内存)
5. **小型契约测试** - 认证和用户管理 (2GB内存)
6. **中型集成测试** - 处理器和桥接 (3GB内存)
7. **TaskRunner测试** - 任务执行器 (4GB内存)
8. **MCP服务器测试** - MCP核心功能 (4GB内存)
9. **E2E HTTP API测试** - 完整API流程 (6GB内存)
10. **E2E并发引擎测试** - 并发处理验证 (6GB内存)
11. **E2E MCP工具包测试** - MCP工具集成 (6GB内存)
12. **验收测试** - 用户场景验证 (3GB内存)
13. **剩余集成测试** - 其他集成功能 (4GB内存)
14. **复杂集成测试** - MVP单进程等 (5GB内存)
15. **剩余契约测试** - 其他契约验证 (2GB内存)
16. **清理和收尾** - 最终验证批次

## 🛠️ 脚本说明

### run-batch-tests.js
智能分批测试执行器，特点：
- 根据文件大小和复杂度动态分配内存
- 按优先级顺序执行，先易后难
- 实时显示进度和内存使用情况
- 自动保存中间结果，支持断点续传
- 生成详细的JSON和文本报告

### quick-test.sh
轻量级快速测试脚本，特点：
- 按类型执行特定测试子集
- 适合开发阶段的快速验证
- 内存使用经过优化，适合持续运行
- 支持交互式确认危险操作

### merge-test-results.js
测试结果合并器，功能：
- 合并各批次的测试结果
- 整合覆盖率报告
- 生成统一的HTML报告
- 计算总体统计信息和成功率

## 📋 使用场景

### 场景1: 日常开发
```bash
# 修改了配置相关代码
npm run test:quick:unit

# 修改了HTTP接口
npm run test:quick:http

# 修改了MCP功能
npm run test:quick:mcp
```

### 场景2: 提交前验证
```bash
# 运行关键测试批次
npm run test:batch
npm run test:merge
```

### 场景3: CI/CD流水线
```bash
# 清理环境
npm run test:clean

# 执行完整测试
npm run test:batch

# 生成报告
npm run test:merge

# 检查结果
cat test-results/merged-test-report.json | jq '.summary.successRate'
```

### 场景4: 内存受限环境
```bash
# 超低内存测试 (仅基础功能)
NODE_OPTIONS="--max-old-space-size=1024" npm run test:quick:unit

# 中等内存测试 (核心功能)
NODE_OPTIONS="--max-old-space-size=2048" npm run test:quick:integration
```

## 📈 报告解读

### 批次执行报告
每个批次完成后会显示：
- ✅/❌ 批次执行状态
- 📊 测试通过数量和总数
- ⏱️ 执行时间
- 💾 内存使用情况

### 合并报告格式
```json
{
  "timestamp": "2025-01-XX",
  "summary": {
    "totalBatches": 16,
    "totalTests": 1000,
    "totalPassed": 950,
    "totalFailed": 50,
    "successRate": "95.0%",
    "totalDuration": "1200s"
  },
  "coverage": {
    "lines": {"pct": "85.5"},
    "functions": {"pct": "87.2"},
    "branches": {"pct": "82.1"},
    "statements": {"pct": "86.0"}
  }
}
```

## 🔧 故障排除

### 常见问题

**Q: 仍然出现内存溢出**
```bash
# 减少并发线程
export NODE_OPTIONS="--max-old-space-size=2048"

# 或者运行更小的批次
npm run test:quick:unit
```

**Q: 某个批次失败**
```bash
# 单独运行失败的批次
npm run test:quick:http  # 假设HTTP批次失败

# 查看详细错误
cat test-results/batch-test-report.json | jq '.results[] | select(.batch=="http-server")'
```

**Q: 覆盖率报告不完整**
```bash
# 重新合并覆盖率
npm run test:merge

# 或者查看特定批次的覆盖率
open coverage/lcov-report/index.html
```

### 调试模式
```bash
# 启用详细输出
DEBUG=vitest:* npm run test:batch

# 查看内存使用
node --trace gc scripts/run-batch-tests.js
```

## 🎯 最佳实践

1. **开发阶段**: 使用 `npm run test:quick:unit` 进行快速验证
2. **功能开发**: 根据功能类型选择对应的快速测试
3. **提交前**: 运行 `npm run test:batch` 确保整体质量
4. **CI/CD**: 使用分批测试避免内存问题
5. **内存监控**: 关注各批次的内存使用情况
6. **报告分析**: 定期查看合并报告，识别趋势

## 📝 配置自定义

可以通过修改 `scripts/run-batch-tests.js` 中的批次定义来自定义：
- 批次包含的测试文件
- 内存限制大小
- 超时时间
- 执行优先级

## 🔄 迁移指南

从旧的测试命令迁移：
```bash
# 旧的 (会导致内存溢出)
npm test --watch
npm run test:coverage

# 新的 (内存安全)
npm run test:quick:unit
npm run test:batch && npm run test:merge
```