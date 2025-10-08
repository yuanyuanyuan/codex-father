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
- Strong typing with TypeScript + Zod

### MCP Tools

`codex.exec`, `codex.start`, `codex.status`, `codex.logs`, `codex.stop`,
`codex.list`, `codex.help`.

Naming options via env vars: `CODEX_MCP_NAME_STYLE`, `CODEX_MCP_TOOL_PREFIX`,
`CODEX_MCP_HIDE_ORIGINAL`.

## Architecture

Overview of MCP Server, Process Manager, Session Manager, Approval System, and
CLI. See: [Architecture Overview](docs/architecture/overview.en.md) and
[MCP Integration](docs/architecture/mcp-integration.en.md).

## Quick Start

```bash
npm install -g @starkdev020/codex-father-mcp-server
export CODEX_RUNTIME_HOME="$HOME/.codex-father-runtime"
export CODEX_SESSIONS_HOME="$HOME/.codex-father-sessions"
mkdir -p "$CODEX_RUNTIME_HOME" "$CODEX_SESSIONS_HOME"
CODEX_MCP_PROJECT_ROOT="$CODEX_RUNTIME_HOME" \
CODEX_SESSIONS_ROOT="$CODEX_SESSIONS_HOME" \
codex-mcp-server --transport=ndjson
```

Client integrations:

- Claude Desktop: add a server entry in `claude_desktop_config.json`.
- Codex CLI (rMCP): add `[mcp_servers.codex-father]` to `~/.codex/config.toml`.

Full details: [User Quick Start](docs/user/quick-start.en.md).

## Usage Guide

- Beginner‑friendly User Guide: [docs/user/manual.en.md](docs/user/manual.en.md)
- User docs index: [docs/user/README.en.md](docs/user/README.en.md)

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

## Testing

Run tests with `npm test` or see coverage in CI. See the Chinese README for
detailed counts.

## Documentation

- Docs portal: [docs/README.en.md](docs/README.en.md)
- User: [docs/user/README.en.md](docs/user/README.en.md)
- Developer: [docs/developer/README.en.md](docs/developer/README.en.md)
- Architecture: [docs/architecture/README.en.md](docs/architecture/README.en.md)
- Operations: [docs/operations/README.en.md](docs/operations/README.en.md)
- Releases: [docs/releases/README.en.md](docs/releases/README.en.md)
- Env vars:
  [docs/environment-variables-reference.en.md](docs/environment-variables-reference.en.md)

## Contributing

- Contribution guide (EN):
  [docs/developer/contributing.en.md](docs/developer/contributing.en.md)
- Docs contribution policy:
  [docs/developer/CONTRIBUTING.docs.en.md](docs/developer/CONTRIBUTING.docs.en.md)

## License

MIT — see [LICENSE](LICENSE).
