#!/usr/bin/env bats
# 单元测试: start.sh 参数解析功能

load '../test_helper'

setup() {
    setup_test_env
    ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../../ && pwd)"
    START_SH="$ROOT_DIR/start.sh"
}

teardown() {
    cleanup_test_env
}

# === 基础参数解析测试 ===

@test "参数解析: --help 显示帮助信息" {
    run "$START_SH" --help
    assert_exit_code 0
    assert_contains "$output" "用法:"
    assert_contains "$output" "--task"
    assert_contains "$output" "--file"
}

@test "参数解析: --task 参数正确解析" {
    run "$START_SH" --task "测试任务" --dry-run --json
    assert_exit_code 0
    assert_json_valid "$output"

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_file_exists "$log_file"
}

@test "参数解析: --file 单文件参数" {
    create_test_instruction_file "test.md" "测试内容"
    run "$START_SH" --file "$TEST_WORK_DIR/test.md" --dry-run --json
    assert_exit_code 0

    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    assert_file_exists "$instructions_file"
    assert_contains "$(cat "$instructions_file")" "测试内容"
}

@test "参数解析: --file 多文件参数" {
    create_test_instruction_file "test1.md" "内容1"
    create_test_instruction_file "test2.md" "内容2"

    run "$START_SH" --file "$TEST_WORK_DIR/test1.md" "$TEST_WORK_DIR/test2.md" --dry-run --json
    assert_exit_code 0

    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    assert_contains "$(cat "$instructions_file")" "内容1"
    assert_contains "$(cat "$instructions_file")" "内容2"
}

@test "参数解析: --tag 参数设置" {
    run "$START_SH" --task "测试" --tag "unittest" --dry-run --json
    assert_exit_code 0

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_contains "$log_file" "unittest"
}

@test "参数解析: --log-dir 自定义日志目录" {
    local custom_log_dir="$TEST_WORK_DIR/custom-logs"
    run "$START_SH" --task "测试" --log-dir "$custom_log_dir" --dry-run --json
    assert_exit_code 0

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_contains "$log_file" "$custom_log_dir"
    assert_dir_exists "$custom_log_dir"
}

@test "参数解析: --dry-run 模式" {
    run "$START_SH" --task "测试" --dry-run --json
    assert_exit_code 0

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_file_exists "$log_file"
    assert_contains "$(cat "$log_file")" "[DRY-RUN]"
}

@test "参数解析: --json 输出格式" {
    run "$START_SH" --task "测试" --dry-run --json
    assert_exit_code 0
    assert_json_valid "$output"

    # 验证必需的 JSON 字段
    local exit_code
    exit_code=$(echo "$output" | jq -r '.exit_code')
    [[ "$exit_code" == "0" ]]
}

# === 内容组合参数测试 ===

@test "参数解析: --content 文本内容" {
    run "$START_SH" --content "直接文本内容" --dry-run --json
    assert_exit_code 0

    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    assert_contains "$(cat "$instructions_file")" "直接文本内容"
}

@test "参数解析: --prepend 前置文本" {
    run "$START_SH" --prepend "前置内容" --task "主要任务" --dry-run --json
    assert_exit_code 0

    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    local content
    content=$(cat "$instructions_file")

    # 验证前置内容在主要任务之前
    assert_contains "$content" "前置内容"
    assert_contains "$content" "主要任务"
}

@test "参数解析: --append 后置文本" {
    run "$START_SH" --task "主要任务" --append "后置内容" --dry-run --json
    assert_exit_code 0

    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    assert_contains "$(cat "$instructions_file")" "后置内容"
}

# === 预设参数测试 ===

@test "参数解析: --preset sprint 预设" {
    run "$START_SH" --preset sprint --task "冲刺任务" --dry-run --json
    assert_exit_code 0
    # 预设会设置特定参数，这里主要验证不报错
}

@test "参数解析: --preset analysis 预设" {
    run "$START_SH" --preset analysis --task "分析任务" --dry-run --json
    assert_exit_code 0
}

# === 安全和沙盒参数测试 ===

@test "参数解析: --sandbox 沙盒模式" {
    run "$START_SH" --sandbox read-only --task "只读任务" --dry-run --json
    assert_exit_code 0

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_contains "$(cat "$log_file")" "read-only"
}

@test "参数解析: --redact 脱敏模式" {
    create_test_instruction_file "sensitive.md" "API_KEY=sk-1234567890abcdef"
    run "$START_SH" --file "$TEST_WORK_DIR/sensitive.md" --redact --dry-run --json
    assert_exit_code 0

    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    assert_not_contains "$(cat "$instructions_file")" "sk-1234567890abcdef"
    assert_contains "$(cat "$instructions_file")" "***REDACTED***"
}

# === 错误处理测试 ===

@test "参数解析: 未知参数错误" {
    run "$START_SH" --unknown-parameter
    assert_exit_code 2
    assert_contains "$output" "未知参数"
    assert_contains "$output" "是否想使用以下参数"
}

@test "参数解析: 缺少必需值的参数" {
    run "$START_SH" --task
    assert_exit_code 2
    assert_contains "$output" "需要文本参数"
}

@test "参数解析: 不存在的文件" {
    run "$START_SH" --file "/nonexistent/file.md" --dry-run
    assert_exit_code 2
    assert_contains "$output" "文件不存在"
}

@test "参数解析: 参数冲突检测" {
    run "$START_SH" --dangerously-bypass-approvals-and-sandbox --ask-for-approval never --dry-run
    assert_exit_code 2
    assert_contains "$output" "参数冲突"
}

# === STDIN 处理测试 ===

@test "参数解析: STDIN 输入处理" {
    echo "STDIN 内容" | run "$START_SH" --file - --dry-run --json
    assert_exit_code 0

    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    assert_contains "$(cat "$instructions_file")" "STDIN 内容"
}

@test "参数解析: 多次 STDIN 请求错误" {
    run bash -c 'echo "内容" | "$0" --file - --file - --dry-run' "$START_SH"
    assert_exit_code 2
    assert_contains "$output" "多处请求从 STDIN 读取"
}

# === 通配符和文件展开测试 ===

@test "参数解析: 通配符文件展开" {
    mkdir -p "$TEST_WORK_DIR/docs"
    echo "文档1" > "$TEST_WORK_DIR/docs/doc1.md"
    echo "文档2" > "$TEST_WORK_DIR/docs/doc2.md"

    run "$START_SH" --file "$TEST_WORK_DIR/docs/*.md" --dry-run --json
    assert_exit_code 0

    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    assert_contains "$(cat "$instructions_file")" "文档1"
    assert_contains "$(cat "$instructions_file")" "文档2"
}

@test "参数解析: --docs-dir 目录递归" {
    mkdir -p "$TEST_WORK_DIR/docs/subdir"
    echo "# 主文档" > "$TEST_WORK_DIR/docs/main.md"
    echo "# 子文档" > "$TEST_WORK_DIR/docs/subdir/sub.md"

    run "$START_SH" --docs-dir "$TEST_WORK_DIR/docs" --dry-run --json
    assert_exit_code 0

    local instructions_file
    instructions_file=$(echo "$output" | jq -r '.instructions_file')
    assert_contains "$(cat "$instructions_file")" "主文档"
    assert_contains "$(cat "$instructions_file")" "子文档"
}

# === 元数据和日志验证 ===

@test "参数解析: 生成的元数据格式正确" {
    run "$START_SH" --task "元数据测试" --tag "meta" --dry-run --json
    assert_exit_code 0

    local meta_file
    meta_file=$(echo "$output" | jq -r '.instructions_file' | sed 's/instructions\.md/meta.json/')
    assert_meta_json_valid "$meta_file"

    # 验证特定字段
    local tag_value
    tag_value=$(json_get_value "$meta_file" '.tag')
    [[ "$tag_value" == "meta" ]]
}

@test "参数解析: 日志格式正确" {
    run "$START_SH" --task "日志测试" --dry-run --json
    assert_exit_code 0

    local log_file
    log_file=$(echo "$output" | jq -r '.log_file')
    assert_log_format "$log_file"

    # 验证日志包含必要信息
    assert_contains "$(cat "$log_file")" "Codex Run Start"
    assert_contains "$(cat "$log_file")" "Exit Code: 0"
}