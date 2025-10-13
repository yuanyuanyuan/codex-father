# Codex Father — TypeScript MCP Server (MVP1)

> A Model Context Protocol (MCP) server that exposes the Codex CLI as standard
> MCP tools. Includes single‑process orchestration, async jobs, and approval
> policies.

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-2024--11--05-purple)](https://modelcontextprotocol.io/)

Language: English | [中文](README.md)

> 📘 New to this project? Start with the Beginner‑friendly
> [User Guide](docs/user/manual.en.md). It shows installation, configuration,
> usage, and troubleshooting with a flowchart.

## Highlights

- MCP server: initialize, tools.list, tools.call
- Async jobs with `jobId`, status/log retrieval
- Approval modes: `untrusted`, `on-request`, `on-failure`, `never`
- Event logging (JSONL) and session metadata
- New: logs summary and env-driven session root
- Strong typing with TypeScript + Zod

### Phase 1 increments

- Fine‑grained progress in `status --json`:
  `progress{current,total,percentage,currentTask,eta*}` and `checkpoints[]`
- Event extensions: `plan_updated`, `progress_updated`, `checkpoint_saved` (see
  docs/schemas/stream-json-event.schema.json)
- Read‑only HTTP/SSE server: `http:serve` exposes
  `/api/v1/jobs/:id/status|checkpoints|events` (SSE supports `fromSeq` resume)
- Bulk CLI: `bulk:status|stop|resume` (dry‑run by default; add `--execute` to
  perform)
  - Programmatic API: `codex_bulk_status|codex_bulk_stop|codex_bulk_resume`
    (Node SDK, thin wrapper)

### MCP Tools

`codex.exec`, `codex.start`, `codex.status`, `codex.logs`, `codex.stop`,
`codex.list`, `codex.help`.

Naming options via env vars: `CODEX_MCP_NAME_STYLE`, `CODEX_MCP_TOOL_PREFIX`,
`CODEX_MCP_HIDE_ORIGINAL`.

## Architecture

Overview of MCP Server, Process Manager, Session Manager, Approval System, and
CLI. See: [Architecture Overview](docs/architecture/overview.en.md) and
[MCP Integration](docs/architecture/mcp-integration.en.md).

```text
┌─────────────────┐
│  MCP Client     │  (Claude Desktop, MCP Inspector)
│  (stdio/SSE)    │
└────────┬────────┘
         │ JSON-RPC 2.0
         │
┌────────▼────────────────────────────────────────┐
│  MCP Server (core/mcp/server.ts)                │
│  - Protocol handling                            │
│  - Tool registration                            │
│  - Event forwarding                             │
└────────┬────────────────────────────────────────┘
         │
         │ Bridge Layer
         │
┌────────▼────────────────────────────────────────┐
│  Process Manager (core/process/manager.ts)      │
│  - Codex CLI lifecycle                          │
│  - JSON-RPC communication                       │
│  - Health monitoring                            │
└────────┬────────────────────────────────────────┘
         │
         │
┌────────▼────────────────────────────────────────┐
│  Session Manager (core/session/)                │
│  - Session lifecycle                            │
│  - Event logging (.jsonl)                       │
│  - Config persistence (.json)                   │
└────────┬────────────────────────────────────────┘
         │
         │
┌────────▼────────────────────────────────────────┐
│  Approval System (core/approval/)               │
│  - Policy engine                                │
│  - Terminal UI (inquirer)                       │
│  - Whitelist management                         │
└─────────────────────────────────────────────────┘
```

## Quick Start

```bash
npm install -g @starkdev020/codex-father-mcp-server
export CODEX_RUNTIME_HOME="$HOME/.codex-father-runtime"
export CODEX_SESSIONS_HOME="$HOME/.codex-father-sessions"   # legacy root still supported
mkdir -p "$CODEX_RUNTIME_HOME" "$CODEX_SESSIONS_HOME"
CODEX_MCP_PROJECT_ROOT="$CODEX_RUNTIME_HOME" \
CODEX_SESSIONS_ROOT="$CODEX_SESSIONS_HOME" \
codex-mcp-server --transport=ndjson
```

### Read‑only HTTP / SSE (live progress)

```bash
# Start HTTP/SSE server (defaults to 0.0.0.0:7070)
node bin/codex-father http:serve --port 7070

# Query status
curl http://127.0.0.1:7070/api/v1/jobs/<jobId>/status | jq

# Subscribe to events (SSE)
curl -N http://127.0.0.1:7070/api/v1/jobs/<jobId>/events?fromSeq=0
```

See docs/operations/sse-endpoints.en.md for details.

### Bulk CLI (read‑only)

```bash
node bin/codex-father bulk:status job-1 job-2 --json
# or
node bin/codex-father bulk:status --jobs job-1 --jobs job-2 --json
```

See docs/operations/bulk-cli.en.md.

### Programmatic Bulk API (Node)

Avoid N separate calls; operate on multiple jobs at once.

Example:

```ts
import {
  codex_bulk_status,
  codex_bulk_stop,
  codex_bulk_resume,
} from 'codex-father/dist/core/sdk/bulk.js';

// 1) Bulk status (reads state.json by default; pass refresh: true to call job.sh status first)
const status = await codex_bulk_status({
  jobIds: ['job-1', 'job-2'],
  repoRoot: process.cwd(),
  // sessions: '/repo/.codex-father-sessions',
  // refresh: true,
});

// 2) Bulk stop (dry-run by default; set execute: true to act)
const stopPreview = await codex_bulk_stop({
  jobIds: ['job-1', 'job-2'],
  repoRoot: process.cwd(),
});
const stopExec = await codex_bulk_stop({
  jobIds: ['job-1', 'job-2'],
  repoRoot: process.cwd(),
  execute: true,
});

// 3) Bulk resume (supports resumeFrom/skipCompleted)
const resumePreview = await codex_bulk_resume({
  jobIds: ['job-3'],
  repoRoot: process.cwd(),
});
const resumeExec = await codex_bulk_resume({
  jobIds: ['job-3'],
  repoRoot: process.cwd(),
  execute: true,
  resumeFrom: 7,
  skipCompleted: true,
});
```

Return shapes align with CLI outputs, including `data.dryRun` and
`advice.retry/rollback` fields.

### Resume strategies (codex.resume)

- MCP tool `codex.resume` supports:
  - `strategy`: `full-restart` | `from-last-checkpoint` | `from-step` (default
    `from-last-checkpoint`)
  - `resumeFrom`/`resumeFromStep`: step index to restart from (required when
    `from-step`)
  - `skipCompleted`: incremental resume (skip finished steps)
  - `reuseArtifacts`: reuse artifacts from completed steps (default true)
- Shell equivalent:
  `job.sh resume <jobId> [--strategy ..] [--resume-from N] [--skip-completed] [--reuse-artifacts|--no-reuse-artifacts]`
- Checkpoint schema now includes `error`, `durationMs`, `context`. See
  `docs/schemas/checkpoint.schema.json`.

### Resource usage fields (status --json)

- `resource_usage` additions:
  - `apiCalls`: count of `tool_use` events in `events.jsonl`
  - `filesModified`: count of `status=applied` entries in
    `patches/manifest.jsonl`
- Others: `tokens`/`tokensUsed` are best‑effort (may be null). Schema:
  `docs/schemas/codex-status-response.schema.json`.

Client integrations:

- Claude Desktop: add a server entry in `claude_desktop_config.json`.
- Codex CLI (rMCP): add `[mcp_servers.codex-father]` to `~/.codex/config.toml`
  (prod via npx).

Full details: [User Quick Start](docs/user/quick-start.en.md).

## Usage Guide

- Beginner‑friendly User Guide: [docs/user/manual.en.md](docs/user/manual.en.md)
- User docs index: [docs/user/README.en.md](docs/user/README.en.md)

### Logs summary (new in v1.7)

- Per‑session summary from events.jsonl:

```bash
# For start/job sessions
node dist/core/cli/start.js logs:summary <sessionId> --text
# Or write summary JSON to <session>/report.summary.json
node dist/core/cli/start.js logs:summary <sessionId>
```

- Inline, multi‑session summary via logs:

```bash
# Single session
node dist/core/cli/start.js logs <sessionId> --summary
# Multiple sessions
node dist/core/cli/start.js logs id1,id2,id3 --summary
# All sessions under the configured root
node dist/core/cli/start.js logs all --summary
```

Session root is configurable via `CODEX_SESSIONS_ROOT` (or
`CODEX_SESSIONS_HOME`). By default it resolves to `.codex-father/sessions`. The
legacy `.codex-father-sessions/` can be kept as a symlink for compatibility.

### 🧪 Quick Validation (validate-session)

To verify a session is structurally healthy (proper start/end events and a
closed state):

```bash
scripts/validate-session.sh /abs/path/to/.codex-father/sessions/<sessionId>
```

It checks that:

- `events.jsonl` contains both `start` and `orchestration_completed` events;
- `state.json` ends in a final state (completed/failed/cancelled).

### First‑time tips

- Models & effort (compat for 0.42/0.44 and 0.46):
  - Model only: `--model gpt-5-codex`
  - 0.46 recommended: `--model "gpt-5-codex high"` or `--model gpt-5-codex high`
  - Legacy hyphen form auto‑normalized:
    `--model gpt-5-codex-minimal|low|medium|high` → `model=gpt-5-codex` +
    `model_reasoning_effort=<effort>`
  - The same applies to `--codex-config model=...`.
  - Only `gpt-5-codex-<effort>` is normalized; explicit `model_reasoning_effort`
    always wins. If backend rejects with 400, switch to a supported slug or
    adjust provider mapping.
- Networking: restricted by default; enable via
  `--codex-config sandbox_workspace_write.network_access=true` and verify
  `effective_network_access: enabled` in `<session>/job.meta.json`.
- Approvals & sandbox: prefer `on-failure` for unattended; bypass only if you
  fully trust the environment.
- Patch mode: `--patch-mode` stores diffs (`patches/patch.diff` under session),
  preview lines limited; tune with
  `--patch-preview-lines`/`--no-patch-preview`/`--no-patch-artifact`.
- Quick view patches: `codex-father logs <sessionId> --patches` (reads
  `<session>/patches/manifest.jsonl`; supports `--follow` and `--format json`).
- Structured instructions: `--instructions path/to/task.json --task T032`; see
  [Structured Instructions](specs/structured-instructions/README.en.md).
- Input size guard: very large inputs are rejected; split or compress context.
- Preset validation: unknown presets fail fast with clear messages.
- Status semantics: completed/normal, stopped/user_cancelled,
  failed/input_error, failed/context_overflow, etc.

## Feature Status

- [x] MCP server (initialize/tools.list/tools.call)
- [x] Async queue (start/status/logs/stop/list)
- [x] Approval + terminal UI
- [x] Event logging + session persistence
- [x] Contract tests
- [x] Orchestrate CLI (basic, evolving)
- [x] SWW single‑writer + two‑phase apply (basic, with tests)
- [ ] Resource monitoring & concurrency control (≤10)
- [ ] Event schema export & auditing enhancements

Note: The `auto` command is planned. Use `orchestrate` and MCP tools for stable
flows.

## Development

- Dev guide:
  [docs/developer/DEVELOPMENT.en.md](docs/developer/DEVELOPMENT.en.md)
- Developer docs: [docs/developer/README.en.md](docs/developer/README.en.md)

### Project structure

```text
codex-father/
├── core/ (approval, cli, mcp, process, session, lib)
├── tests/
├── docs/
└── specs/
```

### Dev commands

```bash
npm run typecheck
npm run lint && npm run lint:check
npm run format && npm run format:check
npm run check:all      # sequential CI‑like
npm run check:all:fast # parallel + smart tests
npm run check:all:parallel
```

### Fast checks & cache guard

- Cache guard tracks toolchain/config fingerprints and cleans caches when
  changed.
- Smart tests prefer `vitest related`, fallback to full run.

### Git hooks

- pre‑commit: lint‑staged + fast checks
- pre‑push: README‑linked bilingual docs check + full checks

## Testing

Run tests with `npm test` or see coverage in CI.

### Debugging

- MCP Inspector

```bash
npx @modelcontextprotocol/inspector npm run mcp:start
```

- VS Code

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug MCP Server",
  "program": "${workspaceFolder}/core/cli/start.ts",
  "args": ["mcp", "--debug"],
  "env": { "NODE_ENV": "development" }
}
```

### Performance baseline

```bash
npm run benchmark

# Targets (typical):
# - MCP response: < 500ms
# - Event delay:  < 100ms
# - Memory:       < 100MB
```

## Documentation

- Docs portal: [docs/README.en.md](docs/README.en.md)
- User: [docs/user/README.en.md](docs/user/README.en.md)
- Developer: [docs/developer/README.en.md](docs/developer/README.en.md)
- Architecture: [docs/architecture/README.en.md](docs/architecture/README.en.md)
- Operations: [docs/operations/README.en.md](docs/operations/README.en.md)
- Releases: [docs/releases/README.en.md](docs/releases/README.en.md)
- Env vars:
  [docs/environment-variables-reference.en.md](docs/environment-variables-reference.en.md)

Role‑based navigation

- First‑time user: [Quick Start](docs/user/quick-start.en.md) →
  [First Run](docs/user/first-run.en.md) →
  [Use Cases](docs/user/use-cases/README.en.md)
- Developer: [Development](docs/developer/DEVELOPMENT.en.md) →
  [Architecture Overview](docs/architecture/overview.en.md) →
  [Contributing](docs/developer/contributing.en.md)
- Operator: [Deploy](docs/operations/DEPLOY.en.md) →
  [Configuration](docs/user/configuration.en.md) →
  [Troubleshooting](docs/user/troubleshooting.en.md)

## Contributing

- Contribution guide (EN):
  [docs/developer/contributing.en.md](docs/developer/contributing.en.md)
- Docs contribution policy:
  [docs/developer/CONTRIBUTING.docs.en.md](docs/developer/CONTRIBUTING.docs.en.md)

## License

MIT — see [LICENSE](LICENSE).

## Roadmap

- 006 — Multi‑Agent Orchestration (ongoing)
  - CLI: `orchestrate` command
  - Max concurrency ≤ 10; timeouts and success thresholds
  - SWW two‑phase writes; stream‑JSON event schema
  - Exit conditions: success rate ≥ threshold and no `patch_failed`

See: `specs/006-docs-capability-assessment/*`.

## Use Cases

Codex Father helps with:

- Code review
- Refactoring
- Docs generation
- Test generation
- Bug fixes
- Performance optimization

See **[15+ examples](docs/user/use-cases/examples.en.md)** for more.

## Releases

- Full flow: `docs/releases/RELEASE_FLOW_MCP.md` (ZH)
- Current version notes: see [Releases index](docs/releases/README.en.md)
