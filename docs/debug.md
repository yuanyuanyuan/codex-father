### 调试指南

- 日志产物
  - 异步运行落盘于 `runs/<job-id>/`
  - 关键文件：`job.log`、`*.instructions.md`、`*.meta.json`、`state.json`

- 常见问题
  - `mcp/server.sh` 提示 Node/构建缺失：
    - 运行：`cd mcp/codex-mcp-server && npm install && npm run build`
  - 日志过大：
    - `./job.sh logs <id> --tail N` 或使用 MCP `codex.logs`（lines/bytes 模式）
  - STDIN 出现两次：
    - `-` 仅允许出现一次（`-f -` 或 `-F -` 其一），否则会报错

- 单步排查 MCP 交互
  - 初始化：
    - `printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"debug","version":"0.0.0"}}}\n' | ./mcp/server.sh`
  - 列出工具：
    - `printf '{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | ./mcp/server.sh`
  - 触发运行：
    - `printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","Debug run","--dry-run"],"tag":"debug"}}}\n' | ./mcp/server.sh`

