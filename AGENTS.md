# Repository Guidelines

## Project Structure & Module Organization
- `start.sh`: Compose and run Codex instructions (sync or iterative).
- `job.sh`: Async job manager (start/status/logs/stop/list), writes to `runs/<job-id>/`.
- `mcp/`: MCP server (`mcp/server.sh`, TypeScript at `mcp/codex-mcp-server`).
- `lib/`: Shared Bash helpers (`common.sh`, `presets.sh`).
- `docs/`: Usage and design notes. `tests/`: E2E scripts.
- `.gitignore`: excludes `runs/` artifacts.

## Build, Test, and Development Commands
- CLI quick run: `./start.sh --task "hello" --dry-run`
- Async run: `./job.sh start --task "demo" --dry-run --tag e2e --json`
- MCP build/server: `(cd mcp/codex-mcp-server && npm install && npm run build)` then `./mcp/server.sh`
- E2E: `bash tests/mcp_ts_e2e.sh`

## Coding Style & Naming Conventions
- Bash (>=5): use `#!/usr/bin/env bash`, keep `set -euo pipefail`, write errors to stderr.
- Modularize: put shared functions in `lib/common.sh`; presets in `lib/presets.sh`.
- Portability: prefer `sed -E`, `grep -E`, `awk`, `tee`, `compgen -G`; avoid unnecessary deps.
- Artifacts: logs `codex-*.log`, snapshots `*.instructions.md`, meta `*.meta.json` under `runs/`.

## Testing Guidelines
- TS server: compile with `npm run build` (Node >=18).
- Bash: prefer small, hermetic tests; run `bash -n` and `shellcheck` if available.
- E2E scope: `tests/mcp_ts_e2e.sh` covers MCP initialize, exec, start/status/logs.

## Commit & Pull Request Guidelines
- Conventional Commits (Chinese allowed). Examples:
  - `feat(mcp): 增加 codex.exec 同步执行`
  - `docs(usage): 补充 instructions 组合与启停规则`
- PRs: include summary, rationale, test steps, and docs updates; avoid breaking artifact names/paths.

## Security & Configuration Tips
- Default safe: keep redaction (`--redact`, `--redact-pattern`) reliable; do not enable dangerous bypass by default.
- Pass-through to Codex: `--sandbox`, `--approvals`, `--profile`, `--full-auto`, `--codex-config`, `--codex-arg`.
- STDIN rule: `-` may be used once (in `-f` or `-F`).
