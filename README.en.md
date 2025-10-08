# Codex Father - TypeScript MCP Server (MVP1)

> Model Context Protocol (MCP) server exposing the Codex CLI as standard MCP
> tools, with single‑process orchestration, async jobs, and approval policies.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)

Language: English | [中文](README.md)

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

Add the server in your MCP client (Claude Desktop/Code or Codex CLI). See
Chinese README for detailed examples.

User Guide (Beginner‑friendly): `docs/user/manual.en.md` (Chinese original:
`docs/user/manual.md`).

Note: the `auto` command is planned; please use `orchestrate` and MCP tools for
stable workflows.
