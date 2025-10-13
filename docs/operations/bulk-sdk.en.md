# Programmatic Bulk API (Node)

Operate on multiple jobs at once without N separate calls.

- Supports: `codex_bulk_status`, `codex_bulk_stop`, `codex_bulk_resume`
- Default is dry-run for stop/resume; set `execute: true` to act
- Use `sessions/repoRoot` to point to your sessions root (auto-discovered by default)
- Optional `refresh: true` to call `job.sh status --json` before reading

## Usage

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

## Return Shapes

Aligned with CLI outputs:
- bulk:status → `{ success, data: Array<{ jobId, status|null, error? }> }`
- bulk:stop → dry-run: `{ data: { dryRun: true, preview: [...], advice: {...} } }`; execute: `{ data: { dryRun:false, stopped:[], failed:[], summary:{...}, advice:{...} } }`
- bulk:resume → dry-run: `{ data: { dryRun: true, preview:[...], resumeFrom?, skipCompleted, advice:{...} } }`; execute: `{ data: { dryRun:false, resumed:[], failed:[], summary:{...}, advice:{...} } }`

> Safety: `execute: true` is required to perform actions. `advice.retry/rollback` fields are informational only.

