#!/usr/bin/env bash
# 测试辅助函数库
# 为 codex-father 项目提供统一的测试工具和断言

# 测试环境设置
setup_test_env() {
    export TEST_WORK_DIR="/tmp/codex-father-test-$$-$(date +%s)"
    mkdir -p "$TEST_WORK_DIR"
    export CODEX_LOG_DIR="$TEST_WORK_DIR/logs"
    export CODEX_SESSION_DIR="$TEST_WORK_DIR/session"

    # 保存原始环境变量
    export ORIG_PATH="$PATH"
    export ORIG_CODEX_LOG_DIR="${CODEX_LOG_DIR:-}"
}

cleanup_test_env() {
    [[ -n "$TEST_WORK_DIR" && -d "$TEST_WORK_DIR" ]] && rm -rf "$TEST_WORK_DIR"
    export PATH="$ORIG_PATH"
    export CODEX_LOG_DIR="$ORIG_CODEX_LOG_DIR"
}

# 自定义断言函数
assert_file_exists() {
    local file="$1"
    [[ -f "$file" ]] || {
        echo "断言失败: 文件不存在 '$file'" >&2
        return 1
    }
}

assert_file_not_exists() {
    local file="$1"
    [[ ! -f "$file" ]] || {
        echo "断言失败: 文件应该不存在 '$file'" >&2
        return 1
    }
}

assert_dir_exists() {
    local dir="$1"
    [[ -d "$dir" ]] || {
        echo "断言失败: 目录不存在 '$dir'" >&2
        return 1
    }
}

assert_json_valid() {
    local json_string="$1"
    echo "$json_string" | jq . >/dev/null 2>&1 || {
        echo "断言失败: 无效的 JSON 格式" >&2
        echo "内容: $json_string" >&2
        return 1
    }
}

assert_contains() {
    local haystack="$1"
    local needle="$2"
    [[ "$haystack" == *"$needle"* ]] || {
        echo "断言失败: '$haystack' 不包含 '$needle'" >&2
        return 1
    }
}

assert_not_contains() {
    local haystack="$1"
    local needle="$2"
    [[ "$haystack" != *"$needle"* ]] || {
        echo "断言失败: '$haystack' 不应包含 '$needle'" >&2
        return 1
    }
}

assert_exit_code() {
    local expected="$1"
    local actual="$status"
    [[ "$actual" -eq "$expected" ]] || {
        echo "断言失败: 期望退出码 $expected，实际 $actual" >&2
        return 1
    }
}

assert_regex_match() {
    local text="$1"
    local pattern="$2"
    [[ "$text" =~ $pattern ]] || {
        echo "断言失败: '$text' 不匹配正则 '$pattern'" >&2
        return 1
    }
}

assert_line_count() {
    local file="$1"
    local expected_count="$2"
    local actual_count
    actual_count=$(wc -l < "$file")
    [[ "$actual_count" -eq "$expected_count" ]] || {
        echo "断言失败: 文件 '$file' 期望 $expected_count 行，实际 $actual_count 行" >&2
        return 1
    }
}

# JSON 工具函数
json_get_value() {
    local json_file="$1"
    local path="$2"
    jq -r "$path" "$json_file" 2>/dev/null || echo "null"
}

json_has_key() {
    local json_file="$1"
    local key="$2"
    jq -e "has(\"$key\")" "$json_file" >/dev/null 2>&1
}

# 文件内容验证
assert_log_format() {
    local log_file="$1"
    assert_file_exists "$log_file"
    assert_contains "$(head -n1 "$log_file")" "===== Codex Run Start:"
    assert_contains "$(tail -n3 "$log_file" | head -n1)" "===== Codex Run End:"
}

assert_meta_json_valid() {
    local meta_file="$1"
    assert_file_exists "$meta_file"
    assert_json_valid "$(cat "$meta_file")"
    json_has_key "$meta_file" "id"
    json_has_key "$meta_file" "timestamp"
    json_has_key "$meta_file" "exit_code"
}

# Mock codex 命令
setup_mock_codex() {
    local mock_behavior="${1:-success}"
    local mock_codex="$TEST_WORK_DIR/mock_codex"

    cat > "$mock_codex" << 'EOF'
#!/bin/bash
# Mock codex command for testing

case "$1" in
    "exec")
        if [[ "${MOCK_CODEX_BEHAVIOR:-success}" == "success" ]]; then
            echo "Mock codex execution"
            echo "CONTROL: DONE"
            exit 0
        elif [[ "${MOCK_CODEX_BEHAVIOR}" == "failure" ]]; then
            echo "Mock codex error" >&2
            exit 1
        elif [[ "${MOCK_CODEX_BEHAVIOR}" == "timeout" ]]; then
            sleep 10
            exit 124
        fi
        ;;
    "--version")
        echo "codex version 0.1.0 (mock)"
        exit 0
        ;;
    *)
        echo "Unknown mock codex command: $*" >&2
        exit 1
        ;;
esac
EOF
    chmod +x "$mock_codex"
    export MOCK_CODEX_BEHAVIOR="$mock_behavior"
    export PATH="$TEST_WORK_DIR:$PATH"
}

# 创建测试文件
create_test_instruction_file() {
    local filename="$1"
    local content="${2:-测试指令内容}"
    echo "$content" > "$TEST_WORK_DIR/$filename"
}

create_test_markdown_files() {
    mkdir -p "$TEST_WORK_DIR/docs"
    echo "# 文档1" > "$TEST_WORK_DIR/docs/doc1.md"
    echo "# 文档2" > "$TEST_WORK_DIR/docs/doc2.md"
    echo "# 子文档" > "$TEST_WORK_DIR/docs/subdir/subdoc.md"
}

# 时间戳验证
assert_timestamp_format() {
    local timestamp="$1"
    # 验证格式: YYYYMMDD_HHMMSS
    [[ "$timestamp" =~ ^[0-9]{8}_[0-9]{6}$ ]] || {
        echo "断言失败: 时间戳格式错误 '$timestamp'" >&2
        return 1
    }
}

# 日志内容验证辅助函数
count_log_sections() {
    local log_file="$1"
    local section_marker="$2"
    grep -c "$section_marker" "$log_file" 2>/dev/null || echo "0"
}

get_log_section() {
    local log_file="$1"
    local start_marker="$2"
    local end_marker="$3"
    sed -n "/$start_marker/,/$end_marker/p" "$log_file"
}

# 进程管理辅助
wait_for_file() {
    local file="$1"
    local timeout="${2:-10}"
    local elapsed=0

    while [[ ! -f "$file" && $elapsed -lt $timeout ]]; do
        sleep 0.1
        elapsed=$((elapsed + 1))
    done

    [[ -f "$file" ]]
}

wait_for_process() {
    local pid="$1"
    local timeout="${2:-10}"
    local elapsed=0

    while kill -0 "$pid" 2>/dev/null && [[ $elapsed -lt $timeout ]]; do
        sleep 0.1
        elapsed=$((elapsed + 1))
    done

    ! kill -0 "$pid" 2>/dev/null
}

# 文本处理工具
normalize_whitespace() {
    local text="$1"
    echo "$text" | sed 's/[[:space:]]\+/ /g' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//'
}

strip_ansi_codes() {
    local text="$1"
    echo "$text" | sed 's/\x1b\[[0-9;]*m//g'
}

# 测试数据生成
generate_large_text() {
    local size_kb="${1:-10}"
    local lines=$((size_kb * 20))  # 约 50 字符每行
    for ((i=1; i<=lines; i++)); do
        echo "这是测试行 $i，包含一些中文和英文 content for testing"
    done
}

# Git 仓库测试辅助
setup_test_git_repo() {
    cd "$TEST_WORK_DIR" || return 1
    git init --quiet
    git config user.email "test@example.com"
    git config user.name "Test User"
    echo "# Test Repo" > README.md
    git add README.md
    git commit -m "Initial commit" --quiet
}

# 清理函数注册
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    # 被 source 调用时注册清理函数
    trap cleanup_test_env EXIT
fi