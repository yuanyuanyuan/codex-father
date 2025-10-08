# Checklist 同步与校验指南

本文档介绍如何使用 `scripts/checklist-sync.mjs` 对 `specs/archive-checklist-followup-tasks.md` 与 `specs/archive-requirements-checklist-status.md` 的状态进行一致性检查。

## 作用
- 统计 Follow-up 任务完成度（done/inProgress/todo）。
- 解析每个任务的 `Links: CHKxxx`，对照 `archive-requirements-checklist-status.md` 中对应 CHK 的状态：
  - 任务“已完成”→ 关联 CHK 应为“已实现”；否则记为 mismatch（用于提醒或强失败）。
  - 任务“进行中/待启动”→ 关联 CHK 可为“部分实现/未实现”。

## 用法

```bash
npm run checklist:sync

# 严格模式（打印警告但不失败）：
node scripts/checklist-sync.mjs --strict

# CI 强失败开关：当 CHECKLIST_STRICT_LEVEL>=2 且存在 mismatch 时退出码为 1
CHECKLIST_STRICT=1 CHECKLIST_STRICT_LEVEL=2 node scripts/checklist-sync.mjs
```

输出为 JSON，包含 `items[]` 与 `mismatches[]` 详情。

## CI 集成
- 已提供软提示工作流：`.github/workflows/checklist-sync.yml`（PR 与 main push 自动运行，不失败流水线）。
- 如需开启强失败，请在项目 CI 中设置环境：
  - `CHECKLIST_STRICT=1`（开启严格模式输出）
  - `CHECKLIST_STRICT_LEVEL=2`（当存在 mismatch 时以退出码 1 失败流程）

### 严格模式工作流（可控开关）
- 已提供 `.github/workflows/checklist-sync-strict.yml`：
  - 触发：`workflow_dispatch`（可传 `strict_level`，默认 2），或推送到 `release/**`、`hotfix/**` 分支，或打 `v*` 标签。
  - 行为：当 `CHECKLIST_STRICT_LEVEL>=2` 且存在硬性不一致时直接失败。
  - 本地等效：
    ```bash
    CHECKLIST_STRICT=1 CHECKLIST_STRICT_LEVEL=2 \
      node scripts/checklist-sync.mjs --strict --strict-level 2
    ```

示例（GitHub Actions 片段）：
```yaml
jobs:
  checklist-sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run checklist sync (strict fail)
        env:
          CHECKLIST_STRICT: '1'
          CHECKLIST_STRICT_LEVEL: '2'
        run: node scripts/checklist-sync.mjs
```

## 注意
- 当任务标记“已完成”但关联 CHK 仍为“未实现/部分实现”时，表示“实现与台账不一致”：
  - 要么补实现并在状态台账中将 CHK 标为“已实现”；
  - 要么将任务状态回调为“进行中”或移除与该 CHK 的链接。

## 从 mismatch 到绿灯（步骤）
1) 运行 `node scripts/checklist-sync.mjs --strict`，记录 `mismatches[]` 条目。
2) 打开 `specs/archive-requirements-checklist-status.md`，搜对应 `CHKxxx`。
3) 若功能已落地：补充“已实现/证据链接”，保存并再次运行同步脚本确认清零。
4) 若功能尚未完成：将对应 Follow-up 任务从“已完成”改为“进行中”，或删去该 CHK 链接。
5) PR 中附上脚本输出截图或 JSON 摘要，便于审阅者快速确认。
