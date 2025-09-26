# Codex-Father 测试计划

## 项目结构分析

浮浮酱分析了项目结构，这是一个 bash 脚本为主的 CLI 包装系统 ヽ(✿ﾟ▽ﾟ)ノ

### 核心组件
- **start.sh**: 主入口点，处理参数解析、指令组合、日志管理
- **job.sh**: 异步任务管理器，后台任务控制
- **lib/common.sh**: 通用辅助函数库
- **lib/presets.sh**: 预设参数配置
- **mcp/**: MCP 服务器集成支持

### 关键功能
- 指令组合与文件处理
- 日志和会话管理
- 沙盒执行与安全特性
- 内容脱敏处理
- 多轮执行支持
- Git 集成变更跟踪

## 测试架构设计

### 1. 单元测试架构 (不包含 codex)

#### 1.1 测试框架选择
- **BATS** (Bash Automated Testing System) - 专为 bash 脚本设计
- **优势**: 原生 bash 支持、简单语法、丰富断言
- **替代**: 纯 bash 测试函数 + 自定义断言库

#### 1.2 测试目录结构
```
tests/
├── unit/
│   ├── test_start_sh_args.bats          # start.sh 参数解析测试
│   ├── test_start_sh_composition.bats   # 指令组合测试
│   ├── test_start_sh_logging.bats       # 日志功能测试
│   ├── test_start_sh_redaction.bats     # 脱敏功能测试
│   ├── test_job_sh_mgmt.bats           # job.sh 管理功能测试
│   ├── test_common_helpers.bats        # common.sh 辅助函数测试
│   ├── test_presets.bats               # presets.sh 预设测试
│   └── fixtures/                       # 测试数据文件
├── unit-codex/                         # 包含 codex 的单元测试
├── e2e/                               # 不包含 codex 的 E2E 测试
└── e2e-codex/                         # 包含 codex 的 E2E 测试
```

#### 1.3 单元测试类别

##### A. start.sh 参数解析测试
```bash
# test_start_sh_args.bats
@test "参数解析: --task 参数正确解析" { ... }
@test "参数解析: --file 多文件支持" { ... }
@test "参数解析: --preset 预设应用" { ... }
@test "参数解析: 未知参数错误提示" { ... }
@test "参数解析: 参数冲突检测" { ... }
```

##### B. 指令组合测试
```bash
# test_start_sh_composition.bats
@test "指令组合: 基础模板加载" { ... }
@test "指令组合: 文件内容叠加" { ... }
@test "指令组合: STDIN 输入处理" { ... }
@test "指令组合: prepend/append 文本" { ... }
@test "指令组合: 通配符文件展开" { ... }
```

##### C. 日志管理测试
```bash
# test_start_sh_logging.bats
@test "日志管理: 会话目录创建" { ... }
@test "日志管理: JSON 元数据生成" { ... }
@test "日志管理: 汇总文件写入" { ... }
@test "日志管理: 日志头部格式" { ... }
```

##### D. 脱敏功能测试
```bash
# test_start_sh_redaction.bats
@test "脱敏功能: API 密钥脱敏" { ... }
@test "脱敏功能: 自定义正则脱敏" { ... }
@test "脱敏功能: 多模式脱敏" { ... }
```

##### E. Job 管理测试
```bash
# test_job_sh_mgmt.bats
@test "任务管理: 任务创建和 ID 生成" { ... }
@test "任务管理: 状态查询" { ... }
@test "任务管理: 任务列表" { ... }
@test "任务管理: 任务终止" { ... }
```

##### F. 辅助函数测试
```bash
# test_common_helpers.bats
@test "辅助函数: json_escape 特殊字符处理" { ... }
@test "辅助函数: build_redact_sed_args 构建" { ... }
@test "辅助函数: compress_context_file 压缩" { ... }
@test "辅助函数: expand_arg_to_files 文件展开" { ... }
```

#### 1.4 测试工具和断言
```bash
# 自定义断言函数
assert_file_exists() { [[ -f "$1" ]] || fail "文件不存在: $1"; }
assert_json_valid() { echo "$1" | jq . >/dev/null || fail "无效 JSON"; }
assert_contains() { [[ "$1" == *"$2"* ]] || fail "$1 不包含 $2"; }
assert_exit_code() { [[ "$status" -eq "$1" ]] || fail "期望退出码 $1，实际 $status"; }
```

### 2. 单元测试架构 (包含 codex)

#### 2.1 测试策略
- **Mock Codex**: 使用假的 codex 命令进行控制测试
- **Stub Integration**: 测试与 codex CLI 的集成点
- **Response Simulation**: 模拟各种 codex 响应情况

#### 2.2 测试类别

##### A. Codex 集成测试
```bash
# test_codex_integration.bats
@test "Codex 集成: 基本执行流程" { ... }
@test "Codex 集成: 参数透传" { ... }
@test "Codex 集成: 退出码处理" { ... }
@test "Codex 集成: 错误处理" { ... }
```

##### B. 输出处理测试
```bash
# test_codex_output.bats
@test "输出处理: 标准输出捕获" { ... }
@test "输出处理: 错误输出处理" { ... }
@test "输出处理: 脱敏输出" { ... }
@test "输出处理: JSON 输出格式" { ... }
```

##### C. 会话管理测试
```bash
# test_codex_sessions.bats
@test "会话管理: last-message 文件处理" { ... }
@test "会话管理: 多轮执行" { ... }
@test "会话管理: 上下文压缩" { ... }
```

#### 2.3 Mock 实现
```bash
# tests/fixtures/mock_codex.sh
#!/bin/bash
# 模拟 codex 命令的行为
case "$1" in
  "exec")
    echo "模拟 codex 输出"
    echo "CONTROL: DONE"
    exit 0
    ;;
  "--version")
    echo "codex version 0.1.0 (mock)"
    exit 0
    ;;
esac
```

### 3. E2E 测试架构 (不包含 codex)

#### 3.1 测试范围
- **完整工作流**: 从命令行调用到文件输出
- **集成验证**: 各组件协同工作
- **边界条件**: 极限参数和错误场景

#### 3.2 测试类别

##### A. 完整流程测试
```bash
# test_e2e_workflow.bats
@test "E2E流程: 基本任务执行流程" { ... }
@test "E2E流程: 多文件输入处理" { ... }
@test "E2E流程: 预设参数应用" { ... }
```

##### B. 文件操作测试
```bash
# test_e2e_files.bats
@test "E2E文件: 通配符文件处理" { ... }
@test "E2E文件: 目录递归处理" { ... }
@test "E2E文件: STDIN 输入处理" { ... }
```

##### C. 日志系统测试
```bash
# test_e2e_logging.bats
@test "E2E日志: 完整日志生成" { ... }
@test "E2E日志: 汇总文件创建" { ... }
@test "E2E日志: JSON 输出格式" { ... }
```

##### D. Job 系统测试
```bash
# test_e2e_jobs.bats
@test "E2E任务: 后台任务创建" { ... }
@test "E2E任务: 任务状态跟踪" { ... }
@test "E2E任务: 并发任务管理" { ... }
```

### 4. E2E 测试架构 (包含 codex)

#### 4.1 测试策略
- **真实集成**: 使用真实 codex CLI (如果可用)
- **降级模式**: codex 不可用时跳过相关测试
- **沙盒环境**: 使用安全的测试环境

#### 4.2 测试类别

##### A. 真实 Codex 集成
```bash
# test_e2e_codex_real.bats
@test "E2E-Codex: 简单任务执行" { ... }
@test "E2E-Codex: 文件写入任务" { ... }
@test "E2E-Codex: 多轮执行" { ... }
```

##### B. 沙盒测试
```bash
# test_e2e_codex_sandbox.bats
@test "E2E-沙盒: 安全模式执行" { ... }
@test "E2E-沙盒: 权限控制" { ... }
@test "E2E-沙盒: 危险操作阻止" { ... }
```

##### C. MCP 集成测试
```bash
# test_e2e_mcp.bats
@test "E2E-MCP: TypeScript 服务器集成" { ... }
@test "E2E-MCP: 工具调用" { ... }
@test "E2E-MCP: 错误处理" { ... }
```

### 5. 测试数据和固定装置

#### 5.1 测试数据文件
```
tests/fixtures/
├── instructions/
│   ├── basic.md                    # 基础指令模板
│   ├── complex.md                  # 复杂指令示例
│   └── malformed.md                # 格式错误测试
├── files/
│   ├── sample1.md                  # 测试文档1
│   ├── sample2.md                  # 测试文档2
│   └── binary.pdf                  # 二进制文件测试
├── configs/
│   ├── preset-sprint.sh            # 预设配置
│   └── preset-analysis.sh          # 分析预设
└── expected/
    ├── json-outputs/               # 期望的 JSON 输出
    └── log-formats/                # 期望的日志格式
```

#### 5.2 测试环境设置
```bash
# tests/test_helper.bash
setup_test_env() {
    export TEST_WORK_DIR="/tmp/codex-father-test-$$"
    mkdir -p "$TEST_WORK_DIR"
    export CODEX_LOG_DIR="$TEST_WORK_DIR/logs"
}

cleanup_test_env() {
    rm -rf "$TEST_WORK_DIR"
}
```

### 6. 持续集成配置

#### 6.1 GitHub Actions 工作流
```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install BATS
        run: npm install -g bats
      - name: Run Unit Tests (No Codex)
        run: bats tests/unit/

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run E2E Tests (No Codex)
        run: bats tests/e2e/
```

#### 6.2 测试脚本
```bash
#!/bin/bash
# run_tests.sh - 统一测试入口

set -euo pipefail

run_unit_tests() {
    echo "=== 运行单元测试 (无 Codex) ==="
    bats tests/unit/
}

run_unit_codex_tests() {
    echo "=== 运行单元测试 (含 Codex) ==="
    if command -v codex >/dev/null 2>&1; then
        bats tests/unit-codex/
    else
        echo "跳过: Codex CLI 未安装"
    fi
}

run_e2e_tests() {
    echo "=== 运行 E2E 测试 (无 Codex) ==="
    bats tests/e2e/
}

run_e2e_codex_tests() {
    echo "=== 运行 E2E 测试 (含 Codex) ==="
    if command -v codex >/dev/null 2>&1; then
        bats tests/e2e-codex/
    else
        echo "跳过: Codex CLI 未安装"
    fi
}

main() {
    case "${1:-all}" in
        unit) run_unit_tests ;;
        unit-codex) run_unit_codex_tests ;;
        e2e) run_e2e_tests ;;
        e2e-codex) run_e2e_codex_tests ;;
        all)
            run_unit_tests
            run_unit_codex_tests
            run_e2e_tests
            run_e2e_codex_tests
            ;;
        *) echo "用法: $0 [unit|unit-codex|e2e|e2e-codex|all]"; exit 1 ;;
    esac
}

main "$@"
```

## 测试覆盖目标

### 功能覆盖率目标
- **参数解析**: 100% 路径覆盖
- **指令组合**: 90% 场景覆盖
- **日志系统**: 95% 功能覆盖
- **错误处理**: 85% 错误场景覆盖

### 测试金字塔比例
- **单元测试**: 70% (快速反馈)
- **集成测试**: 20% (组件协作)
- **E2E 测试**: 10% (完整流程)

这样的测试架构确保了代码质量和功能稳定性喵～ (｡♡‿♡｡)