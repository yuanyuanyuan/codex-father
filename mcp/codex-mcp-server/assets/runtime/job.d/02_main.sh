main() {
  [[ $# -ge 1 ]] || { usage; exit 2; }
  local sub="$1"; shift || true
  case "$sub" in
    start) cmd_start "$@" ;;
    status) cmd_status "$@" ;;
    logs) cmd_logs "$@" ;;
    stop) cmd_stop "$@" ;;
    list) cmd_list "$@" ;;
    clean) cmd_clean "$@" ;;
    metrics) cmd_metrics "$@" ;;
    -h|--help|help) usage ;;
    *) err "未知命令: ${sub}"; usage; exit 2 ;;
  esac
}

main "$@"
