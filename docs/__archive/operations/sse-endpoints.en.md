# HTTP / SSE Endpoints (Minimal)

Goal: provide read‑only HTTP APIs and an SSE stream without breaking the two‑line stdout contract, so UIs or external systems can subscribe to live progress and events.

Conventions
- Base path: `/api/v1`.
- JSON responses follow schemas in `docs/schemas/*.json`.
- Read‑only only; write operations remain CLI‑driven.

Endpoints
- `GET /api/v1/version` → returns current service version, Node version and platform.
- `GET /api/v1/jobs/:id/status` → `codex-status-response.schema.json`.
- `GET /api/v1/jobs/:id/events` → SSE stream of `stream-json-event.schema.json`; supports resume:
  - Query `?fromSeq=<number>` to replay from a sequence (inclusive).
  - Heartbeat `event: heartbeat` every 15s.
  - Idempotent consumption: each event has `orchestrationId` and monotonic `seq`.
- `GET /api/v1/jobs/:id/checkpoints` → `checkpoint.schema.json[]`.

New events
- `plan_updated`, `progress_updated`, `checkpoint_saved`.

Errors
- Unified error body: `{ code, message, hint }`.

Example (SSE)
```
event: progress_updated
data: {"orchestrationId":"orc_1","seq":42,"timestamp":"2025-10-13T10:34:20Z","data":{"progress":{"current":3,"total":10,"percentage":30,"currentTask":"Refactor SimulateForm.tsx","etaHuman":"4m 20s"}}}

event: checkpoint_saved
data: {"orchestrationId":"orc_1","seq":43,"timestamp":"2025-10-13T10:34:30Z","data":{"step":3,"status":"in_progress","artifact":"components/mvp/SimulateForm.tsx"}}
```

Implementation notes
- File queue: stream from `.codex-father/sessions/<id>/events.jsonl`; server tracks file offset.
- Resume: client uses `fromSeq`; fallback to replay recent 1000 lines if not found.
- Protection: rate limiting via `express-rate-limit`; consider reverse proxy in production.
