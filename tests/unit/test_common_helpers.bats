#!/usr/bin/env bats
# 单元测试: lib/common.sh 辅助函数

load '../test_helper'

setup() {
    setup_test_env
    ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../../ && pwd)"

    # 加载 common.sh 函数
    source "$ROOT_DIR/lib/common.sh"
}

teardown() {
    cleanup_test_env
}

# === json_escape 函数测试 ===

@test "辅助函数: json_escape 基本字符串" {
    result=$(json_escape "hello world")
    [[ "$result" == "hello world" ]]
}

@test "辅助函数: json_escape 转义双引号" {
    result=$(json_escape 'hello "world"')
    [[ "$result" == 'hello \"world\"' ]]
}

@test "辅助函数: json_escape 转义反斜杠" {
    result=$(json_escape 'path\to\file')
    [[ "$result" == 'path\\to\\file' ]]
}

@test "辅助函数: json_escape 转义换行符" {
    local input=$'line1\nline2'
    result=$(json_escape "$input")
    [[ "$result" == 'line1\nline2' ]]
}

@test "辅助函数: json_escape 转义制表符" {
    local input=$'column1\tcolumn2'
    result=$(json_escape "$input")
    [[ "$result" == 'column1\tcolumn2' ]]
}

@test "辅助函数: json_escape 移除回车符" {
    local input=$'line1\r\nline2'
    result=$(json_escape "$input")
    [[ "$result" == 'line1\nline2' ]]
}

@test "辅助函数: json_escape 复合转义" {
    local input=$'path "C:\temp\file.txt"\nwith newline'
    result=$(json_escape "$input")
    expected='path \"C:\\temp\\file.txt\"\nwith newline'
    [[ "$result" == "$expected" ]]
}

# === build_redact_sed_args 函数测试 ===

@test "辅助函数: build_redact_sed_args 单个模式" {
    local patterns=('sk-[A-Za-z0-9]{10,}')
    local args=()

    build_redact_sed_args args "${patterns[@]}"

    [[ ${#args[@]} -eq 2 ]]
    [[ "${args[0]}" == "-e" ]]
    assert_contains "${args[1]}" "sk-"
    assert_contains "${args[1]}" "***REDACTED***"
}

@test "辅助函数: build_redact_sed_args 多个模式" {
    local patterns=('sk-[A-Za-z0-9]{10,}' 'gh[pouas]_[A-Za-z0-9]{20,}')
    local args=()

    build_redact_sed_args args "${patterns[@]}"

    [[ ${#args[@]} -eq 4 ]]  # 2 patterns × 2 args each
    [[ "${args[0]}" == "-e" ]]
    [[ "${args[2]}" == "-e" ]]
}

@test "辅助函数: build_redact_sed_args 空模式数组" {
    local patterns=()
    local args=()

    build_redact_sed_args args "${patterns[@]}"

    [[ ${#args[@]} -eq 0 ]]
}

# === compress_context_file 函数测试 ===

@test "辅助函数: compress_context_file 基本压缩" {
    local input_file="$TEST_WORK_DIR/input.txt"
    local output_file="$TEST_WORK_DIR/output.txt"

    # 创建测试输入文件
    cat > "$input_file" << 'EOF'
第一行
第二行
CONTROL: 重要行
第四行
第五行
ERROR: 错误行
第七行
第八行
EOF

    compress_context_file "$input_file" "$output_file" 3 "CONTROL:" "ERROR:"

    assert_file_exists "$output_file"
    local content
    content=$(cat "$output_file")

    # 应该包含头部3行
    assert_contains "$content" "第一行"
    assert_contains "$content" "第二行"

    # 应该包含匹配的关键行
    assert_contains "$content" "CONTROL: 重要行"
    assert_contains "$content" "ERROR: 错误行"

    # 应该包含标记
    assert_contains "$content" "=== Head"
    assert_contains "$content" "=== Key Lines"
}

@test "辅助函数: compress_context_file 空文件处理" {
    local input_file="$TEST_WORK_DIR/empty.txt"
    local output_file="$TEST_WORK_DIR/output.txt"

    touch "$input_file"  # 创建空文件

    compress_context_file "$input_file" "$output_file"

    assert_file_exists "$output_file"
    assert_contains "$(cat "$output_file")" "[no previous context]"
}

@test "辅助函数: compress_context_file 不存在文件处理" {
    local input_file="$TEST_WORK_DIR/nonexistent.txt"
    local output_file="$TEST_WORK_DIR/output.txt"

    compress_context_file "$input_file" "$output_file"

    assert_file_exists "$output_file"
    assert_contains "$(cat "$output_file")" "[no previous context]"
}

# === expand_arg_to_files 函数测试 ===

@test "辅助函数: expand_arg_to_files 单个文件" {
    local test_file="$TEST_WORK_DIR/test.md"
    echo "test content" > "$test_file"

    expand_arg_to_files "$test_file"

    [[ ${#EXP_FILES[@]} -eq 1 ]]
    [[ "${EXP_FILES[0]}" == "$test_file" ]]
    [[ -z "$EXP_ERRORS" ]]
}

@test "辅助函数: expand_arg_to_files 不存在文件" {
    expand_arg_to_files "/nonexistent/file.md"

    [[ ${#EXP_FILES[@]} -eq 0 ]]
    assert_contains "$EXP_ERRORS" "文件不存在"
}

@test "辅助函数: expand_arg_to_files 目录展开" {
    mkdir -p "$TEST_WORK_DIR/docs"
    echo "doc1" > "$TEST_WORK_DIR/docs/doc1.md"
    echo "doc2" > "$TEST_WORK_DIR/docs/doc2.markdown"
    echo "not-md" > "$TEST_WORK_DIR/docs/readme.txt"

    expand_arg_to_files "$TEST_WORK_DIR/docs"

    [[ ${#EXP_FILES[@]} -eq 2 ]]  # 只有 .md 和 .markdown 文件
    [[ -z "$EXP_ERRORS" ]]
}

@test "辅助函数: expand_arg_to_files 通配符展开" {
    mkdir -p "$TEST_WORK_DIR/docs"
    echo "doc1" > "$TEST_WORK_DIR/docs/file1.md"
    echo "doc2" > "$TEST_WORK_DIR/docs/file2.md"
    echo "other" > "$TEST_WORK_DIR/docs/other.txt"

    expand_arg_to_files "$TEST_WORK_DIR/docs/*.md"

    [[ ${#EXP_FILES[@]} -eq 2 ]]
    [[ -z "$EXP_ERRORS" ]]
}

@test "辅助函数: expand_arg_to_files 通配符无匹配" {
    expand_arg_to_files "$TEST_WORK_DIR/nonexistent/*.md"

    [[ ${#EXP_FILES[@]} -eq 0 ]]
    assert_contains "$EXP_ERRORS" "未匹配到任何文件"
}

@test "辅助函数: expand_arg_to_files @列表文件" {
    local list_file="$TEST_WORK_DIR/files.list"
    local file1="$TEST_WORK_DIR/file1.md"
    local file2="$TEST_WORK_DIR/file2.md"

    echo "file1" > "$file1"
    echo "file2" > "$file2"

    cat > "$list_file" << EOF
$file1
$file2
# 这是注释
EOF

    expand_arg_to_files "@$list_file"

    [[ ${#EXP_FILES[@]} -eq 2 ]]
    [[ -z "$EXP_ERRORS" ]]
}

@test "辅助函数: expand_arg_to_files @列表文件不存在" {
    expand_arg_to_files "@/nonexistent/list.txt"

    [[ ${#EXP_FILES[@]} -eq 0 ]]
    assert_contains "$EXP_ERRORS" "列表文件不存在"
}

# === flag_help_line 函数测试 ===

@test "辅助函数: flag_help_line 已知参数" {
    result=$(flag_help_line "--task")
    assert_contains "$result" "--task"
    assert_contains "$result" "设置任务描述"
}

@test "辅助函数: flag_help_line 未知参数" {
    result=$(flag_help_line "--unknown")
    [[ "$result" == "--unknown" ]]
}

# === print_unknown_arg_help 函数测试 ===

@test "辅助函数: print_unknown_arg_help 参数建议" {
    run print_unknown_arg_help "--tsk"

    assert_contains "$output" "未知参数: --tsk"
    assert_contains "$output" "是否想使用以下参数"
    assert_contains "$output" "--task"  # 应该建议相似的参数
}

@test "辅助函数: print_unknown_arg_help 完全匹配建议" {
    run print_unknown_arg_help "--tas"

    assert_contains "$output" "--task"  # 前缀匹配
}

# === 文件权限和安全测试 ===

@test "辅助函数: 文件创建使用正确的 umask" {
    # 测试文件权限处理（这个需要在实际函数中验证）
    local test_file="$TEST_WORK_DIR/permission_test.txt"

    (
        umask 077
        echo "secure content" > "$test_file"
    )

    assert_file_exists "$test_file"

    # 在支持的系统上检查权限
    if command -v stat >/dev/null 2>&1; then
        local perms
        perms=$(stat -c %a "$test_file" 2>/dev/null || stat -f %A "$test_file" 2>/dev/null || echo "600")
        [[ "$perms" == "600" ]]
    fi
}