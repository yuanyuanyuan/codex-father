#!/usr/bin/env bats
# E2E测试: 完整工作流程 (不包含 codex)

load '../test_helper'

setup() {
    setup_test_env
    ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../../ && pwd)"
    START_SH="$ROOT_DIR/start.sh"
    JOB_SH="$ROOT_DIR/job.sh"

    # 创建测试文档
    create_test_markdown_files
    setup_test_git_repo
}

teardown() {
    cleanup_test_env
}

# === 完整端到端工作流测试 ===

@test "E2E流程: 基本任务执行完整流程" {
    # 1. 创建指令文件
    create_test_instruction_file "task.md" "请分析项目结构并提供建议"

    # 2. 执行完整流程
    run "$START_SH" \
        --file "$TEST_WORK_DIR/task.md" \
        --task "端到端测试任务" \
        --tag "e2e-basic" \
        --dry-run \
        --json

    assert_exit_code 0
    assert_json_valid "$output"

    # 3. 验证输出文件
    local log_file instructions_file meta_file
    log_file=$(echo "$output" | jq -r '.log_file')
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    meta_file=$(echo "$instructions_file" | sed 's/instructions\.md/meta.json/')

    assert_file_exists "$log_file"
    assert_file_exists "$instructions_file"
    assert_file_exists "$meta_file"

    # 4. 验证日志格式
    assert_log_format "$log_file"
    assert_contains "$(cat "$log_file")" "e2e-basic"
    assert_contains "$(cat "$log_file")" "[DRY-RUN]"

    # 5. 验证指令组合
    assert_contains "$(cat "$instructions_file")" "分析项目结构"
    assert_contains "$(cat "$instructions_file")" "端到端测试任务"

    # 6. 验证元数据
    assert_meta_json_valid "$meta_file"
    local tag_value
    tag_value=$(json_get_value "$meta_file" '.tag')
    [[ "$tag_value" == "e2e-basic" ]]
}

@test "E2E流程: 多文件输入工作流" {
    # 1. 创建多个输入文件
    create_test_instruction_file "input1.md" "# 第一个文档\n内容1"
    create_test_instruction_file "input2.md" "# 第二个文档\n内容2"
    create_test_instruction_file "input3.md" "# 第三个文档\n内容3"

    # 2. 执行多文件组合
    run "$START_SH" \
        --file "$TEST_WORK_DIR/input1.md" \
        --file "$TEST_WORK_DIR/input2.md" \
        --file "$TEST_WORK_DIR/input3.md" \
        --prepend "这是前置说明" \
        --append "这是后置说明" \
        --tag "multi-file" \
        --dry-run \
        --json

    assert_exit_code 0
    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')

    # 3. 验证内容组合顺序
    local content
    content=$(cat "$instructions_file")
    assert_contains "$content" "前置说明"
    assert_contains "$content" "第一个文档"
    assert_contains "$content" "第二个文档"
    assert_contains "$content" "第三个文档"
    assert_contains "$content" "后置说明"

    # 4. 验证 XML 标记结构
    assert_contains "$content" '<instructions-section type="prepend-text">'
    assert_contains "$content" '<instructions-section type="file"'
    assert_contains "$content" '<instructions-section type="append-text">'
}

@test "E2E流程: 预设参数应用工作流" {
    # 测试 sprint 预设
    run "$START_SH" \
        --preset sprint \
        --task "冲刺模式测试" \
        --tag "preset-test" \
        --dry-run \
        --json

    assert_exit_code 0
    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')

    # 验证预设参数的效果（sprint 预设可能设置了特定参数）
    assert_file_exists "$log_file"
    assert_contains "$(cat "$log_file")" "preset-test"
}

@test "E2E流程: 脱敏功能端到端" {
    # 1. 创建包含敏感信息的文件
    cat > "$TEST_WORK_DIR/sensitive.md" << 'EOF'
# 敏感信息测试

API密钥: sk-1234567890abcdef
GitHub令牌: ghp_abcdefghij1234567890
密码: password="secret123"
EOF

    # 2. 执行脱敏处理
    run "$START_SH" \
        --file "$TEST_WORK_DIR/sensitive.md" \
        --redact \
        --tag "redaction-test" \
        --dry-run \
        --json

    assert_exit_code 0
    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')

    # 3. 验证敏感信息被脱敏
    local content
    content=$(cat "$instructions_file")
    assert_not_contains "$content" "sk-1234567890abcdef"
    assert_not_contains "$content" "ghp_abcdefghij1234567890"
    assert_contains "$content" "***REDACTED***"
}

@test "E2E流程: 通配符文件处理工作流" {
    # 1. 创建文档结构
    mkdir -p "$TEST_WORK_DIR/project/{docs,src,tests}"
    echo "# 主要文档" > "$TEST_WORK_DIR/project/docs/main.md"
    echo "# API 文档" > "$TEST_WORK_DIR/project/docs/api.md"
    echo "# 开发指南" > "$TEST_WORK_DIR/project/docs/dev.md"
    echo "源代码" > "$TEST_WORK_DIR/project/src/main.py"

    # 2. 使用通配符包含所有文档
    run "$START_SH" \
        --docs "$TEST_WORK_DIR/project/docs/*.md" \
        --task "分析项目文档" \
        --tag "glob-test" \
        --dry-run \
        --json

    assert_exit_code 0
    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')

    # 3. 验证所有 markdown 文件被包含
    local content
    content=$(cat "$instructions_file")
    assert_contains "$content" "主要文档"
    assert_contains "$content" "API 文档"
    assert_contains "$content" "开发指南"
    assert_not_contains "$content" "main.py"  # 非 md 文件应该被排除
}

@test "E2E流程: 目录递归处理工作流" {
    # 1. 创建嵌套目录结构
    mkdir -p "$TEST_WORK_DIR/docs/{guide,api,examples}"
    echo "# 用户指南" > "$TEST_WORK_DIR/docs/guide/user.md"
    echo "# 管理员指南" > "$TEST_WORK_DIR/docs/guide/admin.md"
    echo "# REST API" > "$TEST_WORK_DIR/docs/api/rest.md"
    echo "# 基础示例" > "$TEST_WORK_DIR/docs/examples/basic.md"

    # 2. 使用目录递归
    run "$START_SH" \
        --docs-dir "$TEST_WORK_DIR/docs" \
        --task "文档整理任务" \
        --tag "recursive-test" \
        --dry-run \
        --json

    assert_exit_code 0
    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')

    # 3. 验证嵌套目录中的文件被包含
    local content
    content=$(cat "$instructions_file")
    assert_contains "$content" "用户指南"
    assert_contains "$content" "管理员指南"
    assert_contains "$content" "REST API"
    assert_contains "$content" "基础示例"
}

@test "E2E流程: STDIN 输入处理工作流" {
    # 1. 通过管道输入内容
    local input_content="这是通过 STDIN 输入的内容\n包含多行文本\n用于测试管道输入功能"

    run bash -c "echo -e '$input_content' | '$START_SH' --file - --task '管道测试' --tag stdin-test --dry-run --json"

    assert_exit_code 0
    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')

    # 2. 验证 STDIN 内容被正确包含
    local content
    content=$(cat "$instructions_file")
    assert_contains "$content" "通过 STDIN 输入的内容"
    assert_contains "$content" "管道测试"
}

@test "E2E流程: 日志聚合功能工作流" {
    # 1. 执行任务
    run "$START_SH" \
        --task "聚合测试任务" \
        --tag "aggregation" \
        --dry-run \
        --json

    assert_exit_code 0
    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')

    # 2. 验证聚合文件
    local aggregate_file
    aggregate_file="$(dirname "$log_file")/aggregate.txt"
    local jsonl_file
    jsonl_file="$(dirname "$log_file")/aggregate.jsonl"

    # 等待文件写入完成
    wait_for_file "$aggregate_file" 5
    wait_for_file "$jsonl_file" 5

    assert_file_exists "$aggregate_file"
    assert_file_exists "$jsonl_file"

    # 3. 验证聚合文件内容
    assert_contains "$(cat "$aggregate_file")" "aggregation"
    assert_contains "$(cat "$aggregate_file")" "聚合测试任务"

    # 4. 验证 JSONL 格式
    assert_json_valid "$(cat "$jsonl_file")"
}

@test "E2E流程: Git 集成工作流" {
    # 1. 在 git 仓库中执行
    cd "$TEST_WORK_DIR"

    # 创建一些变更
    echo "新内容" > "new_file.md"
    git add new_file.md
    git commit -m "添加新文件" --quiet

    # 2. 执行任务
    run "$START_SH" \
        --task "Git 集成测试" \
        --tag "git-test" \
        --dry-run \
        --json

    assert_exit_code 0
    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')

    # 3. 验证日志包含 Git 信息
    assert_file_exists "$log_file"
    # Git 集成主要在非 dry-run 模式下工作，这里主要验证不出错
}

@test "E2E流程: 错误恢复工作流" {
    # 1. 测试文件不存在的恢复
    run "$START_SH" \
        --file "/nonexistent/file.md" \
        --task "错误测试" \
        --dry-run

    assert_exit_code 2
    assert_contains "$output" "文件不存在"
    assert_contains "$output" "工作目录:"  # 应该提供调试信息

    # 2. 测试参数冲突的恢复
    run "$START_SH" \
        --dangerously-bypass-approvals-and-sandbox \
        --ask-for-approval never \
        --dry-run

    assert_exit_code 2
    assert_contains "$output" "参数冲突"
}

@test "E2E流程: 性能和并发测试" {
    # 1. 创建大量小文件
    mkdir -p "$TEST_WORK_DIR/large-docs"
    for i in {1..20}; do
        echo "# 文档 $i" > "$TEST_WORK_DIR/large-docs/doc$i.md"
        echo "这是文档 $i 的内容" >> "$TEST_WORK_DIR/large-docs/doc$i.md"
    done

    # 2. 测试处理大量文件
    local start_time end_time duration
    start_time=$(date +%s)

    run "$START_SH" \
        --docs-dir "$TEST_WORK_DIR/large-docs" \
        --task "性能测试" \
        --tag "performance" \
        --dry-run \
        --json

    end_time=$(date +%s)
    duration=$((end_time - start_time))

    assert_exit_code 0

    # 3. 验证性能合理（处理20个小文件应该在合理时间内完成）
    [[ $duration -lt 10 ]]  # 少于10秒

    # 4. 验证所有文件被处理
    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    local content
    content=$(cat "$instructions_file")
    assert_contains "$content" "文档 1"
    assert_contains "$content" "文档 20"
}

@test "E2E流程: 会话完整性验证" {
    # 1. 执行任务
    run "$START_SH" \
        --task "会话完整性测试" \
        --tag "session-integrity" \
        --dry-run \
        --json

    assert_exit_code 0

    # 2. 验证所有相关文件都被创建
    local log_file instructions_file meta_file
    log_file=$(echo "$output" | jq -r '.log_file')
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    meta_file=$(echo "$instructions_file" | sed 's/instructions\.md/meta.json/')

    assert_file_exists "$log_file"
    assert_file_exists "$instructions_file"
    assert_file_exists "$meta_file"

    # 3. 验证文件内容一致性
    local log_session_id instructions_meta_ref
    log_session_id=$(grep "session-integrity" "$log_file" | head -n1 | sed 's/.*session-integrity.*/session-integrity/')

    # 检查指令文件被日志正确引用
    assert_contains "$(cat "$log_file")" "$(basename "$instructions_file")"

    # 4. 验证时间戳一致性
    local meta_timestamp log_timestamp
    meta_timestamp=$(json_get_value "$meta_file" '.timestamp')
    log_timestamp=$(grep "Codex Run Start:" "$log_file" | sed 's/.*: \([0-9_]*\).*/\1/')

    # 时间戳应该相近（同一次执行）
    [[ -n "$meta_timestamp" ]]
    [[ -n "$log_timestamp" ]]
}