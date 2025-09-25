### 调试指南

- 日志产物
  - 异步运行落盘于 `.codex-father/sessions/<job-id>/`
  - 关键文件：`job.log`、`*.instructions.md`、`*.meta.json`、`state.json`

- 常见问题
  - `mcp/server.sh` 提示 Node/构建缺失：
    - 运行：`cd mcp/codex-mcp-server && npm install && npm run build`
  - 日志过大：
    - `./job.sh logs <id> --tail N` 或使用 MCP `codex.logs`（lines/bytes 模式）
  - STDIN 出现两次：
    - `-` 仅允许出现一次（`-f -` 或 `-F -` 其一），否则会报错

- 参数错误与建议
  - 未知参数会输出类似：
    ```
    ❌ 未知参数: --execute-remaining-tasks
    💡 是否想使用以下参数？
       --task <text>         设置任务描述
       --preset <name>       使用预设(sprint|analysis|secure|fast)
       --docs <files...>     指定参考文档（支持通配符与多值/@列表/目录）
       --docs-dir <dir>      指定目录内的文档（递归 *.md）
    📖 运行 --help 查看完整参数列表
    ```

- 通配符/路径调试
  - 当通配符未匹配到任何文件时，错误信息会附带调试块：
    ```
    错误: 文件不存在: docs/technical/*.md
    🔎 调试信息:
       - 搜索模式: docs/technical/*.md
       - 工作目录: /abs/project
       - 匹配到的文件: 0 个
       - 建议: 确认路径/通配符是否正确；必要时改用具体文件或 --docs-dir 目录
    ```
  - 推荐改用：`--docs-dir <dir>`、列出具体文件、或通过 `@list.txt` 维护清单。

- 自检脚本
  - 运行 smoke 测试（需要 jq）：
    - `make smoke`
  - 单独运行与修复相关的新增测试：
    - `bash tests/smoke_start_unknown_arg.sh`
    - `bash tests/smoke_start_docs_success.sh`
    - `bash tests/smoke_start_docs_fail.sh`

- 单步排查 MCP 交互
  - 初始化：
    - `printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"debug","version":"0.0.0"}}}\n' | ./mcp/server.sh`
  - 列出工具：
    - `printf '{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | ./mcp/server.sh`
  - 触发运行：
    - `printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","Debug run","--dry-run"],"tag":"debug"}}}\n' | ./mcp/server.sh`
