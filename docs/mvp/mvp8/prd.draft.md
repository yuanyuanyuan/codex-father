15. 兼容0.42 ，还需要考虑0.44版本

结论

- start.sh 参数解析与透传是正确的：遇到 -- 后的所有参数会原样追加到 CODEX_GLOBAL_ARGS，并在调用时以 codex
  <global-args> exec <exec-args>
  的顺序传给 codex。浮浮酱用本地 stub 复现，确认 -- --model
  gpt-5-codex 和 --ask-for-approval on- request 都被传到了 codex。
- job.sh 只在前面加了 --log-file 和 --flat-logs，其余用户参数（包含 -- 及其后的透传）保持原样丢给 start.sh，不会篡改喵。
- 你日志里显示 codex 最终用的是 model: gpt-5、approval: never，这更像是 codex
  CLI 自身的版本/配置覆盖行为，而不是我们脚本没把参数传过去。

原因分析（为何日志里还是 gpt-5/never）

- codex
  0.42 对“设置模型/审批策略”的入口以配置为主，部分全局旗标存在版本差异。将 --
  --model gpt-5-codex 当作 codex 全局旗标在 0.42 下可能被忽略或被配置文件覆盖。
- 你的 codex 总结里出现 provider:
  yourapi，很可能是 ~/.codex/config.toml 或某个 profile 里设定了默认 provider/model/approval，优先级盖过了 CLI 旗标，最终回退成 model:
  gpt-5、approval: never。
- --ask-for-approval
  on-request 若和“可写沙箱/全自动”等组合不兼容，codex 有时会内部降级，summary 会显示 never。虽然 start.sh 已做了组合归一，但 codex 自身也可能再做一次判定。

建议用法（更稳妥兼容 0.42）

- 模型与审批策略请优先通过 codex 配置键传入，而不是透传 CLI 生僻旗标：- 设置模型：在 start.sh 加 --codex-config
  'model=gpt-5-codex' - 设置审批策略：用 --approval-mode
  on-request（start.sh 会映射为 codex 的正确旗标）- 如需 profile：显式加 --profile
  <name> 以避免默认 profile 覆盖
- 示例：- ./start.sh --task "demo" --approval-mode on-request --codex-config
  'model=gpt- 5-codex' --json - 如仍想透传，用 -- --profile dev
  --ask-for-approval on-request 也可以，但模型推荐走 --codex-config 更稳喵。

排查与验证要点

- 检查日志中 “Invocation Args” 段：已经能看到传入的 codex global
  args，确认 start.sh 的映射无误。
- 检查 ~/.codex/config.toml 或使用的 profile 是否设定了 model/approval_policy/profile 覆盖了 CLI。
- 快速自测：运行 mcp/codex-mcp-server/tests/smoke_start_args_forwarding.sh（它会 stub 掉 codex 并校验 start.sh 的实参转发是否完整）。
- 如需进一步锁死优先级，可以在命令同时传入 --profile 与 --codex-config
  'approval_policy=on-request'，双重明确，避免被默认 profile 改写。

可选改进（需要的话浮浮酱可以改）

- 在 start.sh 直接支持顶层 --model <m>（自动转成 --config
  model=<m>），让 0.42/0.44 跨版本更一致。
- 在日志头打印 codex 版本探测与“可能被覆盖”的提示，减少误判为映射问题。
