# SWW 冲突检测矩阵与重放策略（维护者指南）

## 背景
SWW（Single Writer Window）通过“单写窗口 + 队列串行”保证补丁应用的一致性，并在以下场景进行启发式冲突检测：

- 同一目标文件在补丁创建之后被其他补丁修改 → 判定为冲突（PATCH_CONFLICT），建议重放（更新时间戳）
- 请求中止（requestAbort）→ 丢弃未处理队列；恢复（resetAbort）后可重新入队并按 FIFO 顺序应用

实现位置：`core/orchestrator/sww-coordinator.ts`

## 检测规则（多文件/交错时间戳）

- 维度：
  - 时间：`createdAt`（补丁生成时刻）、`appliedAt`（已应用时间）
  - 范围：`targetFiles[]` 交集
- 冲突条件（任一成立）：
  - 存在已应用补丁 `P`，其 `appliedAt > createdAt(Q)` 且 `P.targetFiles ∩ Q.targetFiles ≠ ∅`
- 非冲突：
  - 仅路径不同（交集为空）或 `appliedAt ≤ createdAt(Q)`

## 重放策略

1) 将过期补丁 Q 更新时间戳（视为基于最新状态生成）
2) 重新入队 → FIFO 应用 → 通过

相关用例：

- 单补丁冲突并重放：`core/orchestrator/tests/sww-conflict.replay.test.ts`
- 中止→恢复→重放：`core/orchestrator/tests/sww-reset-abort.requeue.test.ts`
- 取消→恢复→冲突→重放（集成）：`core/orchestrator/tests/cancel-resume.conflict-replay.integration.test.ts`
- 多补丁冲突→重放顺序（FIFO）：`core/orchestrator/tests/cancel-resume.multi-conflict-replay.order.test.ts`
- 跨目录顺序稳定：`core/orchestrator/tests/sww-cross-dir.order.test.ts`
- 大并发跨目录：`core/orchestrator/tests/sww-heavy-cross-dir.order.test.ts`
- 同路径冲突→重放成功：`core/orchestrator/tests/sww-same-path.conflict-replay.test.ts`
- 交错重放（双文件）：`core/orchestrator/tests/sww-interleaved-replay.order.test.ts`
- 三补丁链（两次冲突→两次重放）：`core/orchestrator/tests/sww-three-patch.chain-conflict-replay.test.ts`
- 多轮交错重放×顺序扰动：`core/orchestrator/tests/sww-multi-round-interleaved.perturbed-order.test.ts`
  - 场景：A/B 两文件，Round0 基准成功；Round1 过期→重放；Round2 再过期→以打乱顺序入队重放（先 B 再 A）。
  - 断言：所有重放严格按照全局入队顺序应用；每轮 stale 均失败；最终 applied 序列后两项为 `[B2_replay, A2_replay]`。

## 故障排查建议

- 冲突频发：
  - 合并小粒度补丁、减少同一文件的交错提交
  - 在高并发场景中提升分片粒度或引入基于目录的写窗口
- 重放失败：
  - 确认 `resetAbort()` 是否在恢复前调用
  - 检查队列是否被意外清空/重建
