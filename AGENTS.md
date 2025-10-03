# Repository Guidelines

## Project Structure & Module Organization

- `start.sh`: Compose and run Codex instructions (sync or iterative).
- `job.sh`: Async job manager (start/status/logs/stop/list), writes to
  `.codex-father/sessions/<job-id>/`.
- `mcp/`: MCP server (`mcp/server.sh`, TypeScript at `mcp/codex-mcp-server`).
- `lib/`: Shared Bash helpers (`common.sh`, `presets.sh`).
- `docs/`: Usage and design notes. `tests/`: E2E scripts.
- `.gitignore`: excludes `.codex-father/sessions/` artifacts (legacy `runs/`
  also ignored).

## Build, Test, and Development Commands

- CLI quick run: `./start.sh --task "hello" --dry-run`
- Async run: `./job.sh start --task "demo" --dry-run --tag e2e --json`
- MCP build/server: `(cd mcp/codex-mcp-server && npm install && npm run build)`
  then `./mcp/server.sh`
- E2E: `bash tests/mcp_ts_e2e.sh`

## Coding Style & Naming Conventions

- Bash (>=5): use `#!/usr/bin/env bash`, keep `set -euo pipefail`, write errors
  to stderr.
- Modularize: put shared functions in `lib/common.sh`; presets in
  `lib/presets.sh`.
- Portability: prefer `sed -E`, `grep -E`, `awk`, `tee`, `compgen -G`; avoid
  unnecessary deps.
- Artifacts: logs `codex-*.log`, snapshots `*.instructions.md`, meta
  `*.meta.json` under `.codex-father/sessions/<job-id>/`.

## Testing Guidelines

- TS server: compile with `npm run build` (Node >=18).
- Bash: prefer small, hermetic tests; run `bash -n` and `shellcheck` if
  available.
- Arg forwarding smoke: `bash tests/smoke_start_args_forwarding.sh` validates
  `start.sh` forwards core flags to `codex`.
- E2E scope: `tests/mcp_ts_e2e.sh` covers MCP initialize, exec,
  start/status/logs.

## Commit & Pull Request Guidelines

- Conventional Commits (Chinese allowed). Examples:
  - `feat(mcp): 增加 codex.exec 同步执行`
  - `docs(usage): 补充 instructions 组合与启停规则`
- PRs: include summary, rationale, test steps, and docs updates; avoid breaking
  artifact names/paths.

## Security & Configuration Tips

- Default safe: keep redaction (`--redact`, `--redact-pattern`) reliable; do not
  enable dangerous bypass by default.
- Pass-through to Codex: `--sandbox`, `--approvals`, `--profile`, `--full-auto`,
  `--codex-config`, `--codex-arg`.
- STDIN rule: `-` may be used once (in `-f` or `-F`).

## Feature 006 — Multi‑Agent Orchestration (Agent Notes)

Scope: specs/006-docs-capability-assessment/\*

- Tech stack (reuse first):
  - Node.js >=18 + TypeScript ^5
  - Reuse core modules: `core/lib/queue/*` (concurrency/retry/scheduler),
    `core/session/event-logger.ts` (JSONL), `core/cli/config-loader.ts`
    (file→env→CLI overrides)
  - Stream events follow `docs/schemas/stream-json-event.schema.json`; audit
    logs are JSONL under `.codex-father/sessions/<id>/`
  - LLM access via `codex exec` only; orchestrator stays offline by default
- Architecture choices:
  - Concurrency via TaskScheduler + queue; DO NOT add `p-queue`/`p-limit`
    (DRY/YAGNI)
  - Writes use SWW (Single Writer Window) with two‑phase write: isolated patch
    generation → serialized apply + quick validate
  - Patch apply: prefer `git apply`, fallback to native on failure
  - Quick validate is mandatory; if missing tools, mark write as failed
  - Resource monitor: prefer Node built‑ins (`os`, `process`) before adding deps
- CLI contract (orchestrate):
  - Add `core/cli/commands/orchestrate-command.ts`
  - Options: `--mode`, `--tasks-file`, `--max-concurrency` (≤10),
    `--task-timeout`, `--success-threshold`, `--output-format`, `--config`
  - Exit 0 iff successRate ≥ threshold AND no `patch_failed`
- Docs mapping (for reference):
  - `specs/006-docs-capability-assessment/design.md` — technical design (updated
    tech choices)
  - `specs/006-docs-capability-assessment/plan.md` — /plan output, phases &
    approach
  - `specs/006-docs-capability-assessment/research.md` — Phase 0 decisions
  - `specs/006-docs-capability-assessment/data-model.md` — entities & states
  - `specs/006-docs-capability-assessment/contracts/` — CLI/events contracts
  - `specs/006-docs-capability-assessment/quickstart.md` — usage & samples
- Safety defaults:
  - Sandbox: `workspace-write`; approvals: `never` for orchestrator runs
  - Single writer at any time; write tasks must output patches, not raw edits
- Dependency alignment:
  - Code imports `uuid`; ensure it is declared in `package.json` when
    implementing
- Testing expectations:
  - Contract tests for CLI args and event schema compliance
  - Unit tests for scheduling, SWW success/failure paths, and quick‑validate
    gate
