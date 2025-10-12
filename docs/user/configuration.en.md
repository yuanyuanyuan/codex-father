# ⚙️ Configuration (Ubuntu focus, EN)

This guide shows how to configure Claude Desktop (reference), Claude Code, and Codex CLI (rMCP). Paths use Ubuntu/Linux examples; macOS/Windows paths are noted where relevant.

## Contents

- (Reference) Configure Claude Desktop
- Configure Claude Code (CLI)
- Configure Codex CLI (rMCP)
- Orchestrator mapping (experimental)
- Advanced configuration
- Example configs
- Common mistakes

---

## (Reference) Configure Claude Desktop

Step 1: Locate config file

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\\Claude\\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

Open quickly

```bash
# macOS
open ~/Library/Application\\ Support/Claude/claude_desktop_config.json

# Windows (PowerShell)
notepad $env:APPDATA\\Claude\\claude_desktop_config.json

# Linux
gedit ~/.config/Claude/claude_desktop_config.json
```

Step 2: Add Codex Father server

Method A: user‑level (recommended)

```json
{
  "mcpServers": {
    "codex-father-prod": {
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

Replace absolute paths accordingly. To keep runtime per‑project, point to `/path/to/project/.codex-father` and create `mkdir -p .codex-father/sessions`.

Method B: npx (on‑demand quick trial)

```json
{
  "mcpServers": {
    "codex-father-prod": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"]
    }
  }
}
```

Method C: from source

```json
{
  "mcpServers": {
    "codex-father-preview": {
      "command": "node",
      "args": ["/path/to/codex-father/dist/core/cli/start.js"]
    }
  }
}
```

Step 3: Restart Claude Desktop completely (not just minimize), then open again. Check the MCP list shows `codex-father-prod` connected.

---

## Configure Claude Code (CLI)

Step 1: Create project config file if missing

```
.claude/mcp_settings.json
```

Step 2: Add preview and prod entries

```json
{
  "mcpServers": {
    "codex-father-preview": {
      "command": "node",
      "args": ["./mcp/codex-mcp-server/dist/index.js"]
    },
    "codex-father-prod": {
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

Restart Claude Code (`exit` then run `claude-code` again). Ask: “List available MCP tools.” You should see the tools set. For Codex 0.44 responses, consider exporting underscore‑only names or a `cf_*` prefix.

Naming strategy env vars (see details in env reference): `CODEX_MCP_NAME_STYLE`, `CODEX_MCP_TOOL_PREFIX`, `CODEX_MCP_HIDE_ORIGINAL`.

---

## Configure Codex CLI (rMCP)

Requires Codex CLI ≥ 0.44.0

```bash
codex --version
# if needed
npm install -g @anthropic/codex-cli@latest
```

Edit `~/.codex/config.toml` and add both preview and prod:

```toml
[mcp_servers.codex-father-preview]
command = "node"
args = ["/abs/path/to/repo/mcp/codex-mcp-server/dist/index.js", "--transport=ndjson"]

[mcp_servers.codex-father-prod]
command = "npx"
args = ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"]
env.NODE_ENV = "production"
env.CODEX_MCP_PROJECT_ROOT = "/ABS/PATH/TO/.codex-father-runtime"
env.CODEX_SESSIONS_ROOT = "/ABS/PATH/TO/.codex-father-sessions"
startup_timeout_sec = 60
tool_timeout_sec = 180
```

Start a Codex session and ask: “List files in the project.” If using npx for prod, first run may download the package; consider `startup_timeout_sec >= 60`.
For prod via npx we suggest slightly higher timeouts (e.g., 60s/180s) to accommodate first‑time package download.

---

## 🧭 Orchestrator mapping (experimental)

The `orchestrate` command may read optional fields from a project config `orchestrator` node and inject runtime gates (manual intervention, understanding check). See the Chinese doc for the JSON example; semantics are equivalent.

---

## 🔧 Advanced configuration

Approval policy example

```json
{
  "mcpServers": {
    "codex-father-prod": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"],
      "env": {
        "APPROVAL_POLICY": "on-failure",
        "CODEX_MCP_PROJECT_ROOT": "/ABS/PATH/TO/.codex-father-runtime",
        "CODEX_SESSIONS_ROOT": "/ABS/PATH/TO/.codex-father-sessions"
      }
    }
  }
}
```

Policy options

| Policy | Meaning | When to use |
| --- | --- | --- |
| `untrusted` | Approve every command | first‑time, test env |
| `on-request` | Approve on tool request | balance safety & speed |
| `on-failure` | Approve only on failure | production (recommended) |
| `never` | Never ask | fully trusted env |

Env variables (examples)

```json
{
  "mcpServers": {
    "codex-father-prod": {
      "env": {
        "APPROVAL_POLICY": "on-failure",
        "LOG_LEVEL": "info",
        "CODEX_CONFIG_PATH": "~/.codex/config.toml",
        "MAX_CONCURRENT_JOBS": "10",
        "CODEX_MCP_PROJECT_ROOT": "/ABS/PATH/TO/.codex-father-runtime",
        "CODEX_SESSIONS_ROOT": "/ABS/PATH/TO/.codex-father-sessions"
      },
      "startup_timeout_sec": 45,
      "tool_timeout_sec": 120
    }
  }
}
```

See: human‑readable env reference and machine‑readable JSON/CSV for the full list and defaults.

Logging example

```json
{
  "mcpServers": {
    "codex-father-prod": {
      "env": {
        "LOG_FILE": "/path/to/codex-father.log"
      }
    }
  }
}
```

Full Codex CLI example

```toml
[mcp_servers.codex-father-preview]
command = "node"
args = ["/abs/path/to/repo/mcp/codex-mcp-server/dist/index.js"]

[mcp_servers.codex-father-prod]
command = "npx"
args = ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"]

[mcp_servers.codex-father-prod.env]
APPROVAL_POLICY = "on-failure"
LOG_LEVEL = "info"
MAX_CONCURRENT_JOBS = "5"
NODE_ENV = "production"
CODEX_MCP_NAME_STYLE = "underscore-only"
CODEX_MCP_TOOL_PREFIX = "cf"
CODEX_MCP_HIDE_ORIGINAL = "1"
CODEX_MCP_PROJECT_ROOT = "/ABS/PATH/TO/.codex-father-runtime"
CODEX_SESSIONS_ROOT = "/ABS/PATH/TO/.codex-father-sessions"
```

---

## Common mistakes

1) Invalid JSON format (Claude Desktop)

```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
```

2) Paths with spaces not escaped

Use absolute paths and escape spaces if needed.

3) Node.js version too low — upgrade to Node.js 18+ via nvm.

4) Permission issues

```bash
chmod 644 ~/.codex/config.toml
sudo npm install -g @starkdev020/codex-father-mcp-server   # not recommended unless needed
```

---

## Next Steps

1) Run tests: [First Run](first-run.en.md)
2) Use cases: [Use Cases](use-cases/README.en.md)
3) Troubleshooting: [Troubleshooting](troubleshooting.en.md)
