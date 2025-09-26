#!/usr/bin/env bats
# 单元测试: Codex 集成功能

load '../test_helper'

setup() {
    setup_test_env
    ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../../ && pwd)"
    START_SH="$ROOT_DIR/start.sh"
    JOB_SH="$ROOT_DIR/job.sh"

    # 设置 Mock Codex
    setup_mock_codex "success"
}

teardown() {
    cleanup_test_env
}

# === Codex 基础集成测试 ===

@test "Codex 集成: 成功执行基本任务" {
    run "$START_SH" \
        --task "测试任务：请输出 Hello World" \
        --tag "codex-basic" \
        --json

    assert_exit_code 0
    assert_json_valid "$output"

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_file_exists "$log_file"

    # 验证 mock codex 输出
    assert_contains "$(cat "$log_file")" "Mock codex execution"
    assert_contains "$(cat "$log_file")" "CONTROL: DONE"
    assert_contains "$(cat "$log_file")" "Exit Code: 0"
}

@test "Codex 集成: 处理 codex 执行失败" {
    setup_mock_codex "failure"

    run "$START_SH" \
        --task "失败测试任务" \
        --tag "codex-failure" \
        --json

    assert_exit_code 1
    assert_json_valid "$output"

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_contains "$(cat "$log_file")" "Mock codex error"
    assert_contains "$(cat "$log_file")" "Exit Code: 1"
}

@test "Codex 集成: 参数透传到 codex" {
    run "$START_SH" \
        --task "参数透传测试" \
        --sandbox read-only \
        --ask-for-approval never \
        --tag "param-passthrough" \
        --json

    assert_exit_code 0
    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')

    # 验证参数被记录在日志中
    assert_contains "$(cat "$log_file")" "--sandbox"
    assert_contains "$(cat "$log_file")" "read-only"
    assert_contains "$(cat "$log_file")" "--ask-for-approval"
    assert_contains "$(cat "$log_file")" "never"
}

@test "Codex 集成: 透传自定义配置" {
    run "$START_SH" \
        --task "配置测试" \
        --codex-config "max_tokens=2000" \
        --codex-arg "--experimental" \
        --tag "config-test" \
        --json

    assert_exit_code 0
    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')

    # 验证自定义配置被透传
    assert_contains "$(cat "$log_file")" "--config"
    assert_contains "$(cat "$log_file")" "max_tokens=2000"
    assert_contains "$(cat "$log_file")" "--experimental"
}

# === 输出处理测试 ===

@test "Codex 集成: last-message 文件处理" {
    run "$START_SH" \
        --task "最后消息测试" \
        --tag "last-msg" \
        --json

    assert_exit_code 0

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    local last_msg_file="${log_file%.log}.r1.last.txt"

    # last-message 文件应该被创建
    assert_file_exists "$last_msg_file"
    assert_contains "$(cat "$last_msg_file")" "Mock codex execution"
}

@test "Codex 集成: 脱敏输出处理" {
    # 创建包含敏感信息的指令
    create_test_instruction_file "sensitive.md" "API Key: sk-1234567890abcdef"

    run "$START_SH" \
        --file "$TEST_WORK_DIR/sensitive.md" \
        --redact \
        --tag "redacted-output" \
        --json

    assert_exit_code 0

    local instructions_file log_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    log_file=$(echo "$output" | jq -r '.log_file')

    # 验证指令文件已脱敏
    assert_not_contains "$(cat "$instructions_file")" "sk-1234567890abcdef"
    assert_contains "$(cat "$instructions_file")" "***REDACTED***"
}

@test "Codex 集成: JSON 模式输出格式" {
    run "$START_SH" \
        --task "JSON 输出测试" \
        --tag "json-test" \
        --json

    assert_exit_code 0
    assert_json_valid "$output"

    # 验证完整的 JSON 字段
    json_has_key <(echo "$output") "id"
    json_has_key <(echo "$output") "timestamp"
    json_has_key <(echo "$output") "exit_code"
    json_has_key <(echo "$output") "log_file"
    json_has_key <(echo "$output") "instructions_file"

    local exit_code
    exit_code=$(echo "$output" | jq -r '.exit_code')
    [[ "$exit_code" == "0" ]]
}

# === 多轮执行测试 ===

@test "Codex 集成: 多轮执行功能" {
    skip "多轮执行需要更复杂的 mock 设置"

    run "$START_SH" \
        --task "多轮测试任务" \
        --max-runs 3 \
        --repeat-until "CONTROL: DONE" \
        --tag "multi-round" \
        --json

    assert_exit_code 0

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')

    # 应该包含多轮执行的标记
    local iteration_count
    iteration_count=$(grep -c "Iteration" "$log_file")
    [[ $iteration_count -ge 1 ]]
}

@test "Codex 集成: 上下文压缩功能" {
    # 创建大型上下文文件
    local context_file="$TEST_WORK_DIR/large_context.md"
    generate_large_text 5 > "$context_file"

    run "$START_SH" \
        --file "$context_file" \
        --task "上下文压缩测试" \
        --max-runs 2 \
        --context-head 50 \
        --tag "context-compress" \
        --json

    assert_exit_code 0

    # 验证压缩功能不导致错误
    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_file_exists "$log_file"
}

# === 错误处理和异常情况 ===

@test "Codex 集成: codex 命令不存在" {
    # 临时移除 mock codex
    export PATH="/usr/bin:/bin"

    run "$START_SH" \
        --task "命令缺失测试" \
        --tag "no-codex" \
        --json

    assert_exit_code 127
    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_contains "$(cat "$log_file")" "codex CLI 未找到"
}

@test "Codex 集成: codex 超时处理" {
    setup_mock_codex "timeout"

    # 使用较短的超时时间测试
    timeout 5 bash -c "'$START_SH' --task '超时测试' --tag timeout-test --json" || {
        local exit_code=$?
        # 超时应该被正确处理
        [[ $exit_code -eq 124 || $exit_code -eq 1 ]]
    }
}

@test "Codex 集成: 大型指令处理" {
    # 创建大型指令文件
    local large_instruction="$TEST_WORK_DIR/large.md"
    {
        echo "# 大型指令测试"
        generate_large_text 20
    } > "$large_instruction"

    run "$START_SH" \
        --file "$large_instruction" \
        --task "大型指令处理测试" \
        --tag "large-input" \
        --json

    assert_exit_code 0

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_file_exists "$log_file"

    # 验证大型输入被正确处理
    assert_contains "$(cat "$log_file")" "Mock codex execution"
}

# === 安全和沙盒测试 ===

@test "Codex 集成: 沙盒模式执行" {
    run "$START_SH" \
        --task "沙盒测试任务" \
        --sandbox workspace-write \
        --tag "sandbox-test" \
        --json

    assert_exit_code 0

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_contains "$(cat "$log_file")" "workspace-write"
}

@test "Codex 集成: 危险模式绕过" {
    run "$START_SH" \
        --task "危险模式测试" \
        --dangerously-bypass-approvals-and-sandbox \
        --tag "bypass-test" \
        --json

    assert_exit_code 0

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_contains "$(cat "$log_file")" "dangerously-bypass-approvals-and-sandbox"
}

# === Job 集成测试 ===

@test "Codex 集成: 后台任务执行" {
    local job_output
    job_output=$("$JOB_SH" start \
        --task "后台 Codex 任务" \
        --tag "bg-codex" \
        --json)

    local job_id
    job_id=$(echo "$job_output" | jq -r '.jobId')
    [[ -n "$job_id" ]]

    # 等待任务完成
    sleep 2

    run "$JOB_SH" status "$job_id" --json

    assert_exit_code 0
    local state
    state=$(echo "$output" | jq -r '.state')
    [[ "$state" == "completed" ]]
}

@test "Codex 集成: 任务日志包含 Codex 输出" {
    local job_output
    job_output=$("$JOB_SH" start \
        --task "日志输出测试" \
        --tag "log-output" \
        --json)

    local job_id
    job_id=$(echo "$job_output" | jq -r '.jobId')

    sleep 2

    run "$JOB_SH" logs "$job_id"

    assert_exit_code 0
    assert_contains "$output" "Mock codex execution"
    assert_contains "$output" "CONTROL: DONE"
}

# === 元数据和分类测试 ===

@test "Codex 集成: 执行结果分类" {
    run "$START_SH" \
        --task "分类测试任务" \
        --tag "classification" \
        --json

    assert_exit_code 0

    local instructions_file meta_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    meta_file="${instructions_file%.instructions.md}.meta.json"

    assert_file_exists "$meta_file"

    # 验证分类字段
    json_has_key "$meta_file" "classification"
    json_has_key "$meta_file" "control_flag"

    local classification
    classification=$(json_get_value "$meta_file" '.classification')
    [[ -n "$classification" ]]
}

@test "Codex 集成: Token 使用统计" {
    run "$START_SH" \
        --task "Token 统计测试" \
        --tag "tokens" \
        --json

    assert_exit_code 0

    local instructions_file meta_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    meta_file="${instructions_file%.instructions.md}.meta.json"

    # 验证 token 统计字段存在（即使是 mock，应该有占位符）
    json_has_key "$meta_file" "tokens_used"
}

# === 完整性和数据一致性 ===

@test "Codex 集成: 会话数据完整性" {
    run "$START_SH" \
        --task "数据完整性测试" \
        --tag "integrity" \
        --json

    assert_exit_code 0

    local log_file instructions_file meta_file
    log_file=$(echo "$output" | jq -r '.log_file')
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    meta_file="${instructions_file%.instructions.md}.meta.json"

    # 验证所有文件存在并包含正确引用
    assert_file_exists "$log_file"
    assert_file_exists "$instructions_file"
    assert_file_exists "$meta_file"

    # 验证日志包含对其他文件的引用
    assert_contains "$(cat "$log_file")" "$(basename "$instructions_file")"
    assert_contains "$(cat "$log_file")" "$(basename "$meta_file")"

    # 验证元数据包含正确的文件路径
    local meta_log_file meta_instructions_file
    meta_log_file=$(json_get_value "$meta_file" '.log_file')
    meta_instructions_file=$(json_get_value "$meta_file" '.instructions_file')

    [[ "$meta_log_file" == "$log_file" ]]
    [[ "$meta_instructions_file" == "$instructions_file" ]]
}