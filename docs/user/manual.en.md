# 🧭 Codex Father User Guide (Beginner-friendly)

This beginner‑friendly manual shows how to install, configure, use, and troubleshoot Codex Father. No programming required.

---

## One Picture: From Install to Result

```mermaid
flowchart TD
  A[Prepare] --> B[Install MCP server]
  B --> C[Configure client (Claude Desktop/Code or Codex CLI)]
  C --> D[Start codex-mcp-server]
  D --> E[Ask a request (e.g., "list files")]
  E --> F[Codex Father executes]
  F --> G[Get results & logs]
  G --> H{Happy?}
  H -- Yes --> I[Save and reuse]
  H -- No --> J[Read tips/logs, adjust and retry]
```

Think of Codex Father as a “helpful assistant”. You prepare the power (install & configure), then ask “please turn on this light” (give a task), it does the work and shows results.

---

## Quick Start (3 steps, ~5 minutes)

1) Install (global recommended)

```bash
npm install -g @starkdev020/codex-father-mcp-server
```

2) Prepare folders and start the server (keep the window open)

```bash
export CODEX_RUNTIME_HOME="$HOME/.codex-father-runtime"
export CODEX_SESSIONS_HOME="$HOME/.codex-father-sessions"
mkdir -p "$CODEX_RUNTIME_HOME" "$CODEX_SESSIONS_HOME"

CODEX_MCP_PROJECT_ROOT="$CODEX_RUNTIME_HOME" \
CODEX_SESSIONS_ROOT="$CODEX_SESSIONS_HOME" \
codex-mcp-server --transport=ndjson
```

3) Configure and test a client (pick one)

- Claude Desktop: add a server named `codex-father` (see steps below).
- Codex CLI (rMCP): add a server entry in `~/.codex/config.toml`.

Open your client and say: “Please list .md files in the project.”
If you see a list, you’re done ✅

---

## Detailed Steps

### A. Install

Requires Node.js ≥ 18.

- Install: `npm install -g @starkdev020/codex-father-mcp-server`
- Upgrade: `npm update -g @starkdev020/codex-father-mcp-server`
- Uninstall: `npm uninstall -g @starkdev020/codex-father-mcp-server`

### B. Start the Server

Use user‑level folders (won’t mess up your projects):

```bash
export CODEX_RUNTIME_HOME="$HOME/.codex-father-runtime"
export CODEX_SESSIONS_HOME="$HOME/.codex-father-sessions"
mkdir -p "$CODEX_RUNTIME_HOME" "$CODEX_SESSIONS_HOME"

CODEX_MCP_PROJECT_ROOT="$CODEX_RUNTIME_HOME" \
CODEX_SESSIONS_ROOT="$CODEX_SESSIONS_HOME" \
codex-mcp-server --transport=ndjson
```

You should see a banner like “waiting for MCP client …”.

### C. Configure a Client

1) Claude Desktop

- Config file:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Add:

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"],
      "env": {
        "CODEX_MCP_PROJECT_ROOT": "/ABS/PATH/TO/.codex-father-runtime",
        "CODEX_SESSIONS_ROOT": "/ABS/PATH/TO/.codex-father-sessions"
      }
    }
  }
}
```

- Quit and reopen Claude Desktop.
- Verify the server shows “connected”.

2) Codex CLI (rMCP)

Edit `~/.codex/config.toml`:

```toml
[mcp_servers.codex-father]
command = "npx"
args = ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"]
env.CODEX_MCP_PROJECT_ROOT = "/ABS/PATH/TO/.codex-father-runtime"
env.CODEX_SESSIONS_ROOT = "/ABS/PATH/TO/.codex-father-sessions"
startup_timeout_sec = 60
tool_timeout_sec = 180
```

Then run `codex` and ask to list `.md` files.

---

## First Two Tests

- Test 1: Connection
  - Ask: “List all .md files here.”
  - Expect: A list of markdown files ✅

- Test 2: Create a file
  - Ask: “Create hello.txt with content ‘Hello, Codex Father!’”
  - Expect: Success and file appears in the folder ✅

---

## Common Tasks (copy & use)

- Show logs for a known job ID
  - “Show logs for job cdx‑2025… (latest 50 lines).”

- Stop a running job
  - “Stop job cdx‑2025… (no force).” / “Force stop.”

- Start a long command in background
  - “Use codex.start to run ‘npm run lint’, and tell me the jobId.”
  - “Use codex.logs to follow logs by lines.”

- Orchestration demo (for repos with example tasks)

```bash
node dist/core/cli/start.ts orchestrate "Main Path FR-123" \
  --mode manual \
  --tasks-file core/cli/tests/fixtures/manual.tasks.json \
  --output-format stream-json
```

---

## Troubleshooting

- Can’t see the server?
  - Ensure `codex-mcp-server` is running and window stays open.
  - Use absolute paths on Windows/macOS (no `~`).

- Approval prompts too often?
  - That’s security. Prefer `on-failure` to reduce prompts.

- No internet access?
  - Network is restricted by default. Ask your maintainer to enable when needed.

- Where are logs?
  - `.codex-father/sessions/<session-id>/` contains `events.jsonl` and `job.log`.

### Log Summary (added in v1.7)

> Think of it as compressing a long “diary” into a one‑page “health report”. Great for quick status/outcome checks.

- Generate a summary for one session and preview key fields as text:

```bash
node dist/core/cli/start.js logs:summary <sessionId> --text
```

- Generate and write to `<session>/report.summary.json`:

```bash
node dist/core/cli/start.js logs:summary <sessionId>
```

- Preview multiple or all sessions inline:

```bash
node dist/core/cli/start.js logs id1,id2 --summary
node dist/core/cli/start.js logs all --summary
```

Note: The session root can be overridden via `CODEX_SESSIONS_ROOT` (compatible: `CODEX_SESSIONS_HOME`). The default is `.codex-father/sessions`.

### Echo full composed instructions (noise‑controlled)

> By default we only record an “instruction fingerprint” via `instructions_updated` event. If you need the full composed instructions in `job.log`, enable it explicitly.

- Enable before running (no truncation):

```bash
export CODEX_ECHO_INSTRUCTIONS=1
export CODEX_ECHO_INSTRUCTIONS_LIMIT=0  # 0 = no truncation
```

- Or pass equivalent CLI options: `--echo-instructions --echo-limit 0`

Heads‑up: Since v1.7 the default is to NOT echo the full text. Current defaults in code are:

- `CODEX_ECHO_INSTRUCTIONS=0`
- `CODEX_ECHO_INSTRUCTIONS_LIMIT=120`

- Full reset
  - Close client and server → remove `~/.codex-father-*` temp folders → redo quick start.

---

## FAQ

- Can I use natural language only?
  - Yes. Speak plain requests; the assistant calls tools for you.

- Use per project?
  - Yes. Point `CODEX_MCP_PROJECT_ROOT` to a project‑local folder.

- Upgrade?
  - `npm update -g @starkdev020/codex-father-mcp-server`

---

## Cheatsheet

- Start server: `codex-mcp-server --transport=ndjson`
- Generate API docs (in repo): `npm run docs:api`
- Run tests (in repo): `npm test`
