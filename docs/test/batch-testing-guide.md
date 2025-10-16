# 🧪 分批测试使用指南

## 概述

为了避免内存溢出问题，Codex Father v1.7.0 项目提供了智能分批测试解决方案。该方案将大型测试套件分解为多个小批次，按内存压力和优先级执行，确保在各种硬件环境下都能稳定运行测试。

### 核心优势

- **内存优化**: 解决JavaScript堆内存溢出问题
- **智能分批**: 根据内存需求和测试复杂度动态分组
- **断点续传**: 支持从失败批次继续执行
- **实时监控**: 提供详细的内存使用和执行进度信息
- **灵活配置**: 可根据硬件环境调整批次策略

## 🚀 快速开始

### 日常开发测试

```bash
# ✅ 推荐：快速验证基础功能
npm run test:quick unit

# 功能特定的快速测试
npm run test:quick integration   # 集成功能验证
npm run test:quick contract      # 契约验证
npm run test:quick http          # HTTP接口测试
npm run test:quick mcp           # MCP功能测试
npm run test:quick e2e           # 端到端测试（高内存）
```

### 完整分批测试流程

```bash
# 1. 清理旧的测试结果（推荐）
npm run test:clean

# 2. 执行完整的分批测试
npm run test:batch

# 3. 合并测试结果和覆盖率报告
npm run test:merge

# 4. 查看测试报告
cat test-results/merged-test-report.json | jq '.summary'
```

### 硬件环境适配

```bash
# 低配置环境 (< 8GB RAM)
export NODE_OPTIONS="--max-old-space-size=2048"
npm run test:quick unit

# 中等配置环境 (8-16GB RAM)
npm run test:batch

# 高配置环境 (> 16GB RAM)
NODE_OPTIONS="--max-old-space-size=8192" npm run test:batch
```

## 📊 测试策略详解

### 内存压力分级

| 压力等级 | 内存范围 | 测试类型 | 运行策略 | 预期时间 |
|----------|----------|----------|----------|----------|
| 🟢 **低压力** | <2GB | 单元测试、Schema验证 | 中批量并行 | 2-5分钟 |
| 🟡 **中压力** | 2-4GB | HTTP服务器、集成测试 | 小批量并行 | 5-10分钟 |
| 🔴 **高压力** | >4GB | E2E测试、MCP服务器 | 单独顺序执行 | 10-15分钟 |

### 智能批次划分 (共16个批次)

| 批次 | 名称 | 包含测试 | 内存需求 | 执行时间 | 优先级 |
|------|------|----------|----------|----------|--------|
| 1 | **core-units** | 核心单元测试 (TaskRunner, 配置) | ~2GB | 3-5分钟 | P0 |
| 2 | **small-units** | 小型单元测试 (工具类、Schema) | ~1.5GB | 2-3分钟 | P0 |
| 3 | **http-server** | HTTP服务器测试 | ~3GB | 8-10分钟 | P1 |
| 4 | **contracts** | 基础契约测试 (JSON-RPC, MCP) | ~2.5GB | 4-6分钟 | P1 |
| 5 | **small-contracts** | 小型契约测试 (认证、管理) | ~2GB | 3-4分钟 | P1 |
| 6 | **auth-contracts** | 认证相关契约测试 | ~2GB | 3-4分钟 | P1 |
| 7 | **medium-integration** | 中型集成测试 (处理器、桥接) | ~3GB | 6-8分钟 | P1 |
| 8 | **taskrunner-tests** | TaskRunner专项测试 | ~4GB | 8-10分钟 | P1 |
| 9 | **mcp-server** | MCP服务器测试 | ~4GB | 10-12分钟 | P1 |
| 10 | **e2e-http-api** | E2E HTTP API完整流程 | ~6GB | 12-15分钟 | P2 |
| 11 | **e2e-concurrency** | E2E并发引擎测试 | ~6GB | 12-15分钟 | P2 |
| 12 | **e2e-mcp-toolkit** | E2E MCP工具包测试 | ~6GB | 15-18分钟 | P2 |
| 13 | **acceptance** | 验收测试 (用户场景) | ~3GB | 8-10分钟 | P2 |
| 14 | **remaining-integration** | 剩余集成功能 | ~4GB | 10-12分钟 | P2 |
| 15 | **complex-integration** | 复杂集成测试 (MVP等) | ~5GB | 12-15分钟 | P2 |
| 16 | **remaining-contracts** | 剩余契约验证测试 | ~2GB | 4-5分钟 | P2 |

### 批次执行策略

1. **优先级驱动**: P0批次优先执行，确保核心功能稳定
2. **内存感知**: 实时监控内存使用，动态调整批次大小
3. **失败快速跳过**: 批次失败时快速跳到下一批次，支持后续重试
4. **断点续传**: 保存执行状态，支持从失败批次继续执行
5. **资源清理**: 每个批次执行后自动清理临时资源

## 🛠️ 核心脚本工具

### 1. run-batch-tests.ts - 智能分批执行器

**功能特点**:
- 🧠 **智能内存分配**: 根据文件复杂度和历史运行数据动态分配内存
- 📊 **实时监控**: 显示执行进度、内存使用、成功率等关键指标
- 💾 **断点续传**: 自动保存执行状态，支持从失败批次继续
- 📋 **详细报告**: 生成JSON、文本和HTML多格式测试报告
- ⚡ **性能优化**: 智能跳过已通过的测试，优化执行时间

**核心算法**:
```javascript
// 内存分配算法示例
function allocateMemoryForBatch(files) {
  const complexity = files.reduce((sum, file) => sum + file.complexity, 0);
  const baseMemory = 1024; // 1GB基础内存
  const complexityMultiplier = complexity * 10; // MB per complexity unit
  return Math.max(baseMemory, baseMemory + complexityMultiplier);
}
```

### 2. quick-test.sh - 快速测试启动器

**功能特点**:
- 🎯 **类型精准**: 按测试类型精准选择测试子集
- ⚡ **极速启动**: 优化启动流程，适合开发阶段快速验证
- 🔧 **内存优化**: 针对不同测试类型预设最优内存配置
- 🛡️ **安全保护**: 支持交互式确认，避免危险操作
- 📱 **友好界面**: 彩色输出和进度条，提升用户体验

**使用示例**:
```bash
# 交互式选择测试类型
./scripts/quick-test.sh

# 直接指定类型
./scripts/quick-test.sh unit
./scripts/quick-test.sh integration
./scripts/quick-test.sh e2e
```

### 3. merge-test-results.ts - 测试结果合并器

**功能特点**:
- 📊 **智能合并**: 自动识别和合并各批次的测试结果
- 📈 **覆盖率整合**: 整合所有批次的覆盖率报告，生成统一视图
- 📋 **多格式输出**: 支持JSON、HTML、Markdown等多种报告格式
- 📉 **趋势分析**: 计算测试通过率趋势和性能指标变化
- 🎯 **质量评估**: 提供测试质量评分和改进建议

**报告类型**:
- **执行摘要**: 总体通过率、执行时间、内存使用
- **详细报告**: 每个批次的详细结果和错误信息
- **覆盖率报告**: 代码覆盖率、分支覆盖率、函数覆盖率
- **性能报告**: 测试执行时间、内存峰值、资源使用

## 📋 使用场景

### 场景1: 日常开发
```bash
# 修改了配置相关代码
npm run test:quick unit

# 修改了HTTP接口
npm run test:quick http

# 修改了MCP功能
npm run test:quick mcp
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
NODE_OPTIONS="--max-old-space-size=1024" npm run test:quick unit

# 中等内存测试 (核心功能)
NODE_OPTIONS="--max-old-space-size=2048" npm run test:quick integration
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
npm run test:quick unit
```

**Q: 某个批次失败**
```bash
# 单独运行失败的批次
npm run test:quick http  # 假设HTTP批次失败

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
node --trace-gc scripts/run-batch-tests.ts
```

## 🎯 最佳实践

1. **开发阶段**: 使用 `npm run test:quick unit` 进行快速验证
2. **功能开发**: 根据功能类型选择对应的快速测试
3. **提交前**: 运行 `npm run test:batch` 确保整体质量
4. **CI/CD**: 使用分批测试避免内存问题
5. **内存监控**: 关注各批次的内存使用情况
6. **报告分析**: 定期查看合并报告，识别趋势

## 📝 配置自定义

可以通过修改 `scripts/run-batch-tests.ts` 中的批次定义来自定义：
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
npm run test:quick unit
npm run test:batch && npm run test:merge
```