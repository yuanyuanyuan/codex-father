# Codex-Father 测试套件

这个测试套件为 Codex-Father 项目提供全面的测试覆盖 ヽ(✿ﾟ▽ﾟ)ノ

## 测试架构

### 测试分类

#### 1. 单元测试 (`tests/unit/`)

测试单独的功能模块，不依赖外部系统：

- `test_start_sh_args.bats` - 参数解析功能测试
- `test_common_helpers.bats` - 辅助函数测试
- `test_job_sh_mgmt.bats` - 任务管理功能测试

#### 2. 单元测试 + Codex (`tests/unit-codex/`)

测试与 Codex CLI 的集成功能：

- `test_codex_integration.bats` - Codex 集成测试

#### 3. E2E 测试 (`tests/e2e/`)

端到端完整流程测试，不包含 Codex：

- `test_e2e_workflow.bats` - 完整工作流程测试

#### 4. E2E 测试 + Codex (`tests/e2e-codex/`)

包含真实 Codex 集成的端到端测试（待实现）

## 快速开始

### 安装依赖

```bash
# Ubuntu/Debian
sudo apt-get install bats jq

# macOS
brew install bats-core jq

# npm (跨平台)
npm install -g bats
```

### 运行测试

```bash
# 运行所有测试
./run_tests.sh

# 运行特定类型的测试
./run_tests.sh unit          # 单元测试 (无 Codex)
./run_tests.sh unit-codex    # 单元测试 (含 Codex)
./run_tests.sh e2e           # E2E 测试 (无 Codex)
./run_tests.sh e2e-codex     # E2E 测试 (含 Codex)
./run_tests.sh existing      # 现有测试套件
```

### 单独运行 BATS 测试

```bash
# 运行单个测试文件
bats tests/unit/test_start_sh_args.bats

# 运行目录下所有测试
bats tests/unit/

# 详细输出
bats --tap tests/unit/
```

## 测试工具和辅助函数

### 测试辅助库 (`tests/test_helper.bash`)

提供统一的测试工具和断言函数：

```bash
# 环境设置
setup_test_env()         # 设置测试环境
cleanup_test_env()       # 清理测试环境

# 断言函数
assert_file_exists()     # 断言文件存在
assert_json_valid()      # 断言有效 JSON
assert_contains()        # 断言包含文本
assert_exit_code()       # 断言退出码

# 工具函数
setup_mock_codex()       # 设置 Mock Codex
create_test_markdown_files()  # 创建测试文档
```

### Mock 环境

测试使用 Mock Codex 来模拟不同的执行场景：

- `success` - 成功执行
- `failure` - 执行失败
- `timeout` - 执行超时

## 测试数据

### 测试固定装置 (`tests/fixtures/`)

```
fixtures/
├── instructions/          # 指令模板
│   ├── basic.md          # 基础指令
│   └── complex.md        # 复杂指令
├── files/                # 测试文件
│   ├── sample1.md        # 示例文档1
│   └── sample2.md        # 示例文档2
├── configs/              # 配置文件
└── expected/             # 期望输出
    ├── json-outputs/     # JSON 输出样例
    └── log-formats/      # 日志格式样例
```

## 测试编写指南

### BATS 测试语法

```bash
#!/usr/bin/env bats
load '../test_helper'

setup() {
    setup_test_env
    # 测试特定的设置
}

teardown() {
    cleanup_test_env
}

@test "测试描述" {
    # 执行操作
    run command_to_test --args

    # 验证结果
    assert_exit_code 0
    assert_contains "$output" "expected content"
}
```

### 最佳实践

1. **测试命名**: 使用描述性的测试名称
2. **独立性**: 每个测试应该独立运行
3. **清理**: 始终在 teardown 中清理资源
4. **断言**: 使用适当的断言函数
5. **Mock**: 对外部依赖使用 Mock

### 添加新测试

1. 在适当的目录创建 `.bats` 文件
2. 加载 `test_helper`
3. 实现 `setup()` 和 `teardown()`
4. 编写测试用例
5. 更新 `run_tests.sh`（如需要）

## 持续集成

测试套件支持 CI/CD 集成：

```yaml
# GitHub Actions 示例
- name: Run Tests
  run: |
    npm install -g bats
    ./run_tests.sh all
```

## 测试覆盖

### 当前覆盖率目标

- **参数解析**: ~95% 路径覆盖
- **指令组合**: ~90% 场景覆盖
- **日志系统**: ~90% 功能覆盖
- **错误处理**: ~85% 错误场景

### 测试金字塔分布

- **单元测试**: 70% (快速反馈)
- **集成测试**: 20% (组件协作)
- **E2E 测试**: 10% (完整流程)

## 故障排查

### 常见问题

1. **BATS 未安装**

   ```bash
   npm install -g bats
   ```

2. **权限错误**

   ```bash
   chmod +x run_tests.sh
   ```

3. **Codex 测试跳过**
   - 安装 Codex CLI 或使用 Mock 模式

4. **临时文件清理失败**
   - 检查磁盘空间和权限

### 调试测试

```bash
# 详细输出
bats --verbose tests/unit/test_file.bats

# 在失败时停止
bats --stop-on-failure tests/unit/

# 显示所有输出
bats --show-output-of-passing-tests tests/unit/
```

## 贡献指南

1. 添加测试来覆盖新功能
2. 确保所有测试通过
3. 遵循现有的命名和结构约定
4. 更新文档

---

_测试是代码质量的保证，让我们一起维护高质量的测试套件！_ ＼(^o^)／
