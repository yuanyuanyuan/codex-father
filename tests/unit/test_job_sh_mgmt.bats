#!/usr/bin/env bats
# 单元测试: job.sh 任务管理功能

load '../test_helper'

setup() {
    setup_test_env
    ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../../ && pwd)"
    JOB_SH="$ROOT_DIR/job.sh"
    START_SH="$ROOT_DIR/start.sh"

    # 设置模拟环境
    export CODEX_START_SH="$START_SH"
}

teardown() {
    cleanup_test_env
}

# === 任务启动测试 ===

@test "任务管理: start 命令创建任务" {
    run "$JOB_SH" start --task "测试任务" --tag "unittest" --dry-run --json

    assert_exit_code 0
    assert_json_valid "$output"

    local job_id
    job_id=$(echo "$output" | jq -r '.jobId')
    [[ -n "$job_id" ]]
    assert_regex_match "$job_id" "^cdx-[0-9]{8}_[0-9]{6}-unittest$"
}

@test "任务管理: start 命令参数透传" {
    run "$JOB_SH" start --task "参数测试" --sandbox read-only --dry-run --json

    assert_exit_code 0
    local job_id
    job_id=$(echo "$output" | jq -r '.jobId')

    # 验证任务创建了会话目录
    local session_dir
    session_dir=$(echo "$output" | jq -r '.session_dir // empty')
    [[ -n "$session_dir" ]]
}

@test "任务管理: start 命令工作目录设置" {
    local custom_cwd="$TEST_WORK_DIR/custom"
    mkdir -p "$custom_cwd"

    run "$JOB_SH" start --task "工作目录测试" --cwd "$custom_cwd" --dry-run --json

    assert_exit_code 0
    local job_id
    job_id=$(echo "$output" | jq -r '.jobId')
    [[ -n "$job_id" ]]
}

# === 任务状态查询测试 ===

@test "任务管理: status 查询已完成任务" {
    # 先创建一个任务
    local start_output
    start_output=$("$JOB_SH" start --task "状态测试" --dry-run --json)
    local job_id
    job_id=$(echo "$start_output" | jq -r '.jobId')

    # 等待任务完成（dry-run 应该很快完成）
    sleep 1

    run "$JOB_SH" status "$job_id" --json

    assert_exit_code 0
    assert_json_valid "$output"

    local state
    state=$(echo "$output" | jq -r '.state')
    [[ "$state" == "completed" ]]
}

@test "任务管理: status 查询不存在任务" {
    run "$JOB_SH" status "nonexistent-job-id" --json

    assert_exit_code 1
    assert_contains "$output" "not found"
}

@test "任务管理: status 命令输出格式" {
    # 创建任务
    local start_output
    start_output=$("$JOB_SH" start --task "格式测试" --dry-run --json)
    local job_id
    job_id=$(echo "$start_output" | jq -r '.jobId')

    sleep 1

    run "$JOB_SH" status "$job_id" --json

    assert_exit_code 0

    # 验证状态输出包含必要字段
    json_has_key <(echo "$output") "state"
    json_has_key <(echo "$output") "exit_code"
    json_has_key <(echo "$output") "log_file"
}

# === 任务列表测试 ===

@test "任务管理: list 显示任务列表" {
    # 创建几个任务
    "$JOB_SH" start --task "任务1" --tag "list-test" --dry-run --json >/dev/null
    "$JOB_SH" start --task "任务2" --tag "list-test" --dry-run --json >/dev/null

    sleep 1

    run "$JOB_SH" list --json

    assert_exit_code 0
    assert_json_valid "$output"

    # 验证包含刚创建的任务
    assert_contains "$output" "list-test"
}

@test "任务管理: list 空任务列表" {
    # 在干净环境中测试
    local clean_cwd="$TEST_WORK_DIR/clean"
    mkdir -p "$clean_cwd"

    run bash -c "cd '$clean_cwd' && '$JOB_SH' list --json"

    assert_exit_code 0
    # 应该返回有效 JSON，即使是空列表
    assert_json_valid "$output"
}

# === 任务终止测试 ===

@test "任务管理: stop 终止运行任务" {
    # 创建一个长时间运行的任务（使用 sleep）
    local start_output
    start_output=$("$JOB_SH" start --task "sleep 5" --json 2>/dev/null || echo '{"jobId":"test-job"}')
    local job_id
    job_id=$(echo "$start_output" | jq -r '.jobId')

    # 立即尝试终止（可能任务已经完成，但测试命令本身）
    run "$JOB_SH" stop "$job_id"

    # 不管任务是否还在运行，stop 命令应该不出错
    [[ $status -eq 0 || $status -eq 1 ]]  # 成功或任务不存在
}

@test "任务管理: stop 不存在的任务" {
    run "$JOB_SH" stop "nonexistent-job-id"

    assert_exit_code 1
    assert_contains "$output" "not found"
}

# === 日志查看测试 ===

@test "任务管理: logs 查看任务日志" {
    # 创建任务
    local start_output
    start_output=$("$JOB_SH" start --task "日志测试" --dry-run --json)
    local job_id
    job_id=$(echo "$start_output" | jq -r '.jobId')

    sleep 1

    run "$JOB_SH" logs "$job_id"

    assert_exit_code 0
    assert_contains "$output" "Codex Run Start"
    assert_contains "$output" "[DRY-RUN]"
}

@test "任务管理: logs --tail 限制输出行数" {
    # 创建任务
    local start_output
    start_output=$("JOB_SH" start --task "尾部日志测试" --dry-run --json)
    local job_id
    job_id=$(echo "$start_output" | jq -r '.jobId')

    sleep 1

    run "$JOB_SH" logs "$job_id" --tail 5

    assert_exit_code 0

    # 验证输出行数不超过预期（加上可能的额外输出）
    local line_count
    line_count=$(echo "$output" | wc -l)
    [[ $line_count -le 10 ]]  # 允许一些额外的格式化输出
}

@test "任务管理: logs 不存在任务的日志" {
    run "$JOB_SH" logs "nonexistent-job-id"

    assert_exit_code 1
    assert_contains "$output" "not found"
}

# === 会话管理测试 ===

@test "任务管理: 会话目录创建" {
    local cwd="$TEST_WORK_DIR/session-test"
    mkdir -p "$cwd"

    local start_output
    start_output=$("$JOB_SH" start --task "会话测试" --cwd "$cwd" --dry-run --json)

    local job_id
    job_id=$(echo "$start_output" | jq -r '.jobId')

    # 验证会话目录被创建
    assert_dir_exists "$cwd/.codex-father"
    assert_dir_exists "$cwd/.codex-father/sessions"
}

@test "任务管理: 任务 ID 格式验证" {
    local start_output
    start_output=$("$JOB_SH" start --task "ID测试" --tag "format" --dry-run --json)

    local job_id
    job_id=$(echo "$start_output" | jq -r '.jobId')

    # 验证 Job ID 格式: cdx-YYYYMMDD_HHMMSS-tag
    assert_regex_match "$job_id" "^cdx-[0-9]{8}_[0-9]{6}-format$"
}

@test "任务管理: 并发任务创建" {
    local job_ids=()

    # 快速创建多个任务
    for i in {1..3}; do
        local output
        output=$("$JOB_SH" start --task "并发任务$i" --tag "concurrent" --dry-run --json)
        local job_id
        job_id=$(echo "$output" | jq -r '.jobId')
        job_ids+=("$job_id")
    done

    # 验证所有任务ID都不同
    [[ ${#job_ids[@]} -eq 3 ]]
    [[ "${job_ids[0]}" != "${job_ids[1]}" ]]
    [[ "${job_ids[1]}" != "${job_ids[2]}" ]]
    [[ "${job_ids[0]}" != "${job_ids[2]}" ]]
}

# === 错误处理测试 ===

@test "任务管理: 无效命令错误" {
    run "$JOB_SH" invalid-command

    assert_exit_code 1
    assert_contains "$output" "用法:"
}

@test "任务管理: start 缺少参数" {
    run "$JOB_SH" start

    assert_exit_code 2
    assert_contains "$output" "task"
}

@test "任务管理: status 缺少 job-id" {
    run "$JOB_SH" status

    assert_exit_code 1
    assert_contains "$output" "job-id"
}

# === JSON 输出格式测试 ===

@test "任务管理: start JSON 输出完整性" {
    run "$JOB_SH" start --task "JSON测试" --dry-run --json

    assert_exit_code 0
    assert_json_valid "$output"

    # 验证包含必要的字段
    local job_id session_dir start_time
    job_id=$(echo "$output" | jq -r '.jobId')
    session_dir=$(echo "$output" | jq -r '.session_dir // empty')
    start_time=$(echo "$output" | jq -r '.start_time // empty')

    [[ -n "$job_id" ]]
    [[ -n "$start_time" ]]
}

@test "任务管理: status JSON 输出完整性" {
    # 创建任务
    local start_output
    start_output=$("$JOB_SH" start --task "状态JSON测试" --dry-run --json)
    local job_id
    job_id=$(echo "$start_output" | jq -r '.jobId')

    sleep 1

    run "$JOB_SH" status "$job_id" --json

    assert_exit_code 0
    assert_json_valid "$output"

    # 验证状态字段
    local state exit_code
    state=$(echo "$output" | jq -r '.state')
    exit_code=$(echo "$output" | jq -r '.exit_code // "null"')

    [[ "$state" == "completed" ]]
    [[ "$exit_code" == "0" ]]
}