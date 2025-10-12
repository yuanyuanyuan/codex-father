# 📦 Installation Guide (EN)

Complete instructions for installing the Codex Father MCP server, including system requirements, multiple install methods, verification, and uninstall.

## Contents

- System Requirements
- Install Methods
  - Method 1: User‑level install (recommended)
  - Method 2: npx (quick trial)
  - Method 3: From source
- Verify Installation
- Uninstall
- FAQ

---

## System Requirements

Required

| Item | Requirement | Verify |
| --- | --- | --- |
| Node.js | >= 18.0.0 | `node --version` |
| npm | >= 9.0.0 | `npm --version` |
| Codex CLI | Latest | `codex --version` |
| OS | macOS / Windows / Linux | - |

Recommended

- Memory: ≥ 2GB free
- Disk: ≥ 500MB free
- Network: stable internet (for npm installs)

Quick check

```bash
node --version   # >= v18.0.0
npm --version    # >= 9.0.0
codex --version  # should print a version
```

If Codex CLI is missing, see its official docs and install the latest version.

---

## Install Methods

### Method 1: User‑level install (recommended)

Benefits

- Reusable across MCP clients (install once)
- Fast startup (avoid npx cold start)
- Runtime and logs stay in user folders; do not pollute your projects

Steps

```bash
# 1) Install the latest version (or pin a version)
npm install -g @starkdev020/codex-father-mcp-server

# 2) Prepare runtime and sessions folders
export CODEX_RUNTIME_HOME="$HOME/.codex-father-runtime"
export CODEX_SESSIONS_HOME="$HOME/.codex-father-sessions"
mkdir -p "$CODEX_RUNTIME_HOME" "$CODEX_SESSIONS_HOME"

# 3) Start (NDJSON transport by default)
CODEX_MCP_PROJECT_ROOT="$CODEX_RUNTIME_HOME" \
CODEX_SESSIONS_ROOT="$CODEX_SESSIONS_HOME" \
codex-mcp-server --transport=ndjson
```

You can also run `codex-mcp-server --version` to confirm the installed version.

Client config example (Claude Desktop/Code style JSON):

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"],
      "env": {
        "NODE_ENV": "production",
        "CODEX_MCP_PROJECT_ROOT": "/ABS/PATH/TO/.codex-father-runtime",
        "CODEX_SESSIONS_ROOT": "/ABS/PATH/TO/.codex-father-sessions"
      }
    }
  }
}
```

Replace `/ABS/PATH/TO/...` with absolute paths (e.g., `~/.codex-father-runtime` and `~/.codex-father-sessions`, expanded). If you prefer project‑local runtimes, point these to `/path/to/project/.codex-father` and create `mkdir -p .codex-father/sessions`. For Codex CLI TOML, see below.

Codex CLI (rMCP) TOML

```toml
[mcp_servers.codex-father]
command = "npx"
args = ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"]
env.NODE_ENV = "production"
env.CODEX_MCP_PROJECT_ROOT = "/ABS/PATH/TO/.codex-father-runtime"
env.CODEX_SESSIONS_ROOT = "/ABS/PATH/TO/.codex-father-sessions"
startup_timeout_sec = 45
tool_timeout_sec = 120
```

Notes

- Timeouts align to Codex CLI guidance. You can manage entries via `codex config mcp add/list`.
- We recommend npx for prod configurations to minimize drift; global installs remain optional.

### Method 2: npx (quick trial)

Benefits

- No prior install, always latest

Command

```bash
npx -y @starkdev020/codex-father-mcp-server
```

Suggested uses

- Quick demos or one‑off automation

Client config example

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"]
    }
  }
}
```

Tip: increase client handshake timeout (e.g., to ≥45s) to avoid timeouts during first download.

### Method 3: From source

Benefits

- Hackable source, easier debugging, latest main branch

Steps

```bash
git clone https://github.com/yuanyuanyuan/codex-father.git
cd codex-father
npm install
npm run build
ls -la dist/   # verify build
npm start      # start the server
```

Client JSON example

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "node",
      "args": ["/path/to/codex-father/dist/core/cli/start.js"]
    }
  }
}
```

Replace `/path/to/codex-father` with your absolute repo path.

---

## Verify Installation

1) Start and banner

```bash
cd codex-father
npm start
```

Expected (example)

```
MCP Server started
Listening on stdin/stdout
Server capabilities: tools
Tools registered: codex.exec, codex.start, codex.status, codex.logs, codex.stop, codex.list
```

2) Inspect with MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx -y @starkdev020/codex-father-mcp-server
```

Your browser will open the Inspector UI.

3) Check versions

```bash
npm list -g @starkdev020/codex-father-mcp-server
npm list    @starkdev020/codex-father-mcp-server
codex --version
```

---

## Uninstall

Global npm uninstall

```bash
npm uninstall -g @starkdev020/codex-father-mcp-server
```

Remove source checkout

```bash
cd /path/to/codex-father
rm -rf node_modules dist
cd .. && rm -rf codex-father
```

Clean client configs

- Claude Desktop: remove the `codex-father` entry in `claude_desktop_config.json`.
- Codex CLI: remove `[mcp_servers.codex-father]` in `~/.codex/config.toml`.

---

## FAQ

Q1: `npm install` fails

Likely network/permission issue.

```bash
npm install --registry=https://registry.npmmirror.com
# or
yarn install
```

Q2: Node.js version too low

```bash
nvm install 18
nvm use 18
node --version
```

Q3: `npm start` not found

Run the standard sequence:

```bash
npm install
npm run build
npm start
```

Q4: macOS “cannot be opened because the developer cannot be verified”

Temporarily allow in System Settings → Privacy & Security, or:

```bash
sudo spctl --master-disable
```

Q5: Windows PowerShell execution policy

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## Next Steps

1) Configure a client: see [Configuration](configuration.en.md)
2) Quick start test: see [5‑Minute Quick Start](quick-start.en.md)
3) First‑run verification: see [First Run Tests](first-run.en.md)

---

## Get Help

- Docs index: [docs/README.en.md](../README.en.md)
- Troubleshooting: [troubleshooting.en.md](troubleshooting.en.md)
- Issues: GitHub Issues

---

🎉 Installation complete! Enjoy Codex Father.
