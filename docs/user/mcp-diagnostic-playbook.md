# MCP 诊断 Playbook（草案）

> 目的：用“可照做”的步骤快速定位常见问题，配合已有的诊断工具矩阵。

## 适用范围
- CLI/MCP 调用失败但原因不明确
- 路径/权限/超时等环境问题高发场景
- 需要最短路径复现并收集上下文

## 快速索引
- 工具清单：见 `docs/user/mcp-diagnostic-tools.md`
- 端到端示例：`scripts/rmcp-client.mjs`（tools/list、tools/call）

## 决策树（reason → 行动）
```
                 +-----------------------------+
                 |  call-with-downgrade.reason |
                 +-------------+---------------+
                               |
        +----------------------+-------------------------------+
        |                      |                               |
 invalid_arguments        not_found                     permission_denied
   |                        |                                 |
   | 修正入参/绝对路径     | 补齐文件/改绝对路径            | 切可写目录/放宽策略
   v                        v                                 v
  重试                    重试                               重试

        |                      |                               |
        +----------------------+-------------------------------+
                               |
                    +----------v-----------+
                    |   仍失败？           |
                    +----------+-----------+
                               |
     +-------------------------+--------------------------+
     |                        |                          |
   timeout           communication_error             server_error
     |                      |                          |
   提高超时/拆小        ping/echo连通性→直连/降级      查看错误详情→回退/重试
     v                      v                          v
    重试                  重试                        重试
```

> 小贴士：如果不确定入口，从 `tools/list` → `call-with-downgrade`（目标工具为 read-report-file 或 read-events-preview）开始，快速拿到 reason 再按上图行动即可。

## 场景一：权限不足（permission_denied）
1) 列出最近会话：`tools/list-sessions`
2) 读取报告：`tools/read-report-file { path: "/abs/.../report.json" }`
3) 查看失败分类：`permission_denied` 是否 > 0？
4) 建议：切换到允许写入的目录；校验沙箱/审批策略；必要时提升权限或变更角色配置。

## 场景二：路径/上下文缺失（insufficient_context）
1) 读取报告与事件预览：`tools/read-report-file`、`tools/read-events-preview`
2) 定位 "no such file"、"not found" 等关键字
3) 建议：补齐缺失文件/目录/环境变量；在任务描述中声明输入/依赖。

## 场景三：依赖未就绪（dependency_not_ready）
1) grep 事件：`tools/grep-events { pattern: "dependency|locked|wait" }`
2) 若频繁重试仍失败：放宽依赖判定或延长等待；调整重试/退避参数。

## 场景四：参数非法/方法不被允许（invalid_arguments/method_not_allowed）
1) 使用 `tools/call-with-downgrade` 调用目标方法
2) 检查返回的 `reason` 字段（已扩展为 method_not_allowed|invalid_arguments|timeout|server_error|communication_error）
3) 建议：修正参数或更换受支持的方法；必要时降级。

## 场景五：通信/超时（communication_error/timeout）
1) `tools/ping-bridge` 检测连通性；`tools/echo` 验证往返
2) 若超时：缩小请求体、放宽超时设置，或改用按批次/分页调用
3) 建议：检查本地网络/代理，必要时切换为本地直连或离线模式

---
附：最小排障流程
1) `tools/list` → 确认工具可见
2) `tools/read-report-file` → 定位失败分类
3) `tools/read-events-preview`/`tools/grep-events` → 抓关键线索
4) 根据分类选择对应建议 → 修改后重试

## 命令演示（rMCP）

1) 直接给出 reason 与建议（读取报告）
```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp \
  call-tool call-with-downgrade \
  --arguments '{"targetTool":"read-report-file","arguments":{"path":"/abs/path/to/report.json"},"fallback":null}'
```
示例返回：`{"degraded":true,"reason":"not_found","result":null}` → 按“not_found”分支操作。

2) 事件预览（末尾 10 行）
```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp \
  call-tool read-events-preview \
  --arguments '{"path":"/abs/path/to/events.jsonl","limit":10}'
```
