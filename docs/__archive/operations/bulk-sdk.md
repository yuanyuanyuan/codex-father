# 程序化 Bulk API（Node）

为脚本/集成场景提供一次性批量操作能力，避免逐个调用 `codex_status/stop/resume`。

- 支持：`codex_bulk_status`、`codex_bulk_stop`、`codex_bulk_resume`
- 默认只读预演（`stop/resume`），传 `execute: true` 才执行
- 可通过 `sessions/repoRoot` 指定会话目录；若不指定，按约定路径自动推断
- 可选 `refresh: true` 在读取前调用 `job.sh status --json` 刷新状态

## 使用示例

```ts
import {
  codex_bulk_status,
  codex_bulk_stop,
  codex_bulk_resume,
} from 'codex-father/dist/core/sdk/bulk.js';

const status = await codex_bulk_status({ jobIds: ['job-1','job-2'], repoRoot: process.cwd() });

const stopPreview = await codex_bulk_stop({ jobIds: ['job-1','job-2'], repoRoot: process.cwd() });
const stopExec = await codex_bulk_stop({ jobIds: ['job-1','job-2'], repoRoot: process.cwd(), execute: true });

const resumePreview = await codex_bulk_resume({ jobIds: ['job-3'], repoRoot: process.cwd() });
const resumeExec = await codex_bulk_resume({ jobIds: ['job-3'], repoRoot: process.cwd(), execute: true, resumeFrom: 7 });
```

## 返回结构

与 CLI 对齐：
- bulk:status → `{ success, data: Array<{ jobId, status|null, error? }> }`
- bulk:stop → 预演：`{ data: { dryRun: true, preview: [...], advice: {...} } }`；执行：`{ data: { dryRun:false, stopped:[], failed:[], summary:{...}, advice:{...} } }`
- bulk:resume → 预演：`{ data: { dryRun: true, preview:[...], resumeFrom?, skipCompleted, advice:{...} } }`；执行：`{ data: { dryRun:false, resumed:[], failed:[], summary:{...}, advice:{...} } }`

> 安全提示：执行型操作需显式 `execute: true`；预演结果中附带 `advice.retry/rollback` 字段，仅用于文案与外部系统提示，不改变行为。

