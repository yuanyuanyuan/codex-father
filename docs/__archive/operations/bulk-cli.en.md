# Bulk CLI (Minimal)

- Subcommand: `bulk:status` (light wrapper over existing APIs)
- Purpose: reduce multiple network/filesystem calls and make scripts simpler.

Usage
- As positional list:
  - `codex-father bulk:status job-1 job-2 job-3 --json`
- Or with repeated `--jobs`:
  - `codex-father bulk:status --jobs job-1 --jobs job-2 --json`

Options
- `--sessions <path>`: custom sessions root (auto‑discovered by default)
- `--repo-root <path>`: repository root (defaults to CWD)

Example output (`--json`, status):
```
{
  "success": true,
  "data": [
    { "jobId": "job-1", "status": { "id": "job-1", "state": "running", "progress": {"current":2,"total":5,"percentage":40} } },
    { "jobId": "job-2", "status": null, "error": "state.json not found: .../job-2/state.json" }
  ]
}
```

Notes
- Read‑only: does not change job states.
- Implementation detail: first tries `job.sh status --json` for a fresh snapshot; if unavailable/empty, falls back to reading `<session>/state.json`.

## Bulk stop (dry‑run by default)

```bash
# Dry‑run: preview which jobs would be stopped
node bin/codex-father bulk:stop job-1 job-2 --json

# Execute: actually send SIGTERM; add --force for SIGKILL
node bin/codex-father bulk:stop job-1 job-2 --execute --json
node bin/codex-father bulk:stop job-1 job-2 --execute --force --json
```

Preview response:
```
{
  "success": true,
  "data": {
    "dryRun": true,
    "force": false,
    "preview": [
      { "jobId": "job-1", "state": "running", "eligible": true },
      { "jobId": "job-2", "state": "done", "eligible": false, "reason": "not_running" }
    ]
  }
}
```

Failure rollback/retry strategy (documentation and response shape only; no behavior change):
- Response contains `advice`:
  - `advice.retry.suggested` ∈ {`none`, `retry_failed_only`}; `cooldownSeconds` is a hint.
  - `advice.rollback.supported=false` (no automatic rollback; manual only).
  - Execution responses also include `summary` (totals).
  - See schemas: `docs/schemas/bulk-stop-response.schema.json`, `docs/schemas/bulk-resume-response.schema.json`.

## Bulk resume (dry‑run by default)

```bash
# Dry‑run: uses state.json `resume_from` suggestion
node bin/codex-father bulk:resume job-3 job-4 --json

# Execute: resume from suggested or specified step; optional --skip-completed
node bin/codex-father bulk:resume job-3 job-4 --execute --json
node bin/codex-father bulk:resume job-3 --execute --resume-from 7 --skip-completed --json
```

Preview response:
```
{
  "success": true,
  "data": {
    "dryRun": true,
    "preview": [
      { "jobId": "job-3", "state": "failed", "resumeFrom": 7, "eligible": true },
      { "jobId": "job-4", "state": "running", "eligible": false, "reason": "running" }
    ]
  }
}
```
