# Codex MCP Server (stdio)

This is a minimal JSON‑RPC 2.0 server over stdio that exposes Codex jobs as MCP tools. It maps to `codex-command/job.sh` so calls are non‑blocking and observable via `runs/<job-id>`.

## Tools

- `codex.start(args?, tag?, cwd?)` → `{ jobId, pid, cwd, logFile, metaGlob, lastMessageGlob, tag }`
- `codex.status(jobId)` → state snapshot from `state.json`
- `codex.logs(jobId, offset?, limit?)` → incremental log bytes `{ chunk, nextOffset, eof, size }`
- `codex.stop(jobId, force?)` → `{ ok: true }`
- `codex.list()` → array of jobs

All tools are advertised via `tools/list`. You can also call them via `tools/call` with `name` and `arguments`.

## Requirements

- Bash + coreutils
- jq (required for parsing JSON requests)

Without `jq`, only a very limited fallback of `tools/list` and `ping` is supported.

## Run

```bash
# From repo root
./codex-command/mcp/server.sh
```

Send JSON‑RPC requests on stdin, read responses from stdout. One JSON object per line.

### Examples

```bash
# tools/list
printf '%s\n' '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | ./codex-command/mcp/server.sh

# Start a dry‑run job
printf '%s\n' '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","demo","--dry-run"],"tag":"mcp"}}}' | ./codex-command/mcp/server.sh

# Query status
printf '%s\n' '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.status","arguments":{"jobId":"<job-id>"}}}' | ./codex-command/mcp/server.sh

# Read first 2KB of logs
printf '%s\n' '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"codex.logs","arguments":{"jobId":"<job-id>","offset":0,"limit":2048}}}' | ./codex-command/mcp/server.sh
```

### Line‑mode logs and filtering

```bash
# First 100 lines
printf '%s\n' '{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"codex.logs","arguments":{"jobId":"<job-id>","mode":"lines","offsetLines":0,"limitLines":100}}}' | ./codex-command/mcp/server.sh

# Filtered lines (regex), paginated
printf '%s\n' '{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"codex.logs","arguments":{"jobId":"<job-id>","mode":"lines","grep":"^Exit|^----- End","offsetLines":0,"limitLines":20}}}' | ./codex-command/mcp/server.sh

# Tail last 200 lines
printf '%s\n' '{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"codex.logs","arguments":{"jobId":"<job-id>","mode":"lines","tailLines":200,"limitLines":200}}}' | ./codex-command/mcp/server.sh
```

## Claude Code integration (conceptual)

- Configure an MCP transport that runs `codex-command/mcp/server.sh`.
- Discover tools via `tools/list` and call with `tools/call`.
- For long operations, call `codex.start` and then poll `codex.status` and `codex.logs` until `state != running`.

This server does not elevate privileges; it inherits the same sandbox/approval behavior that `start.sh` and Codex CLI enforce.

## Run as a service

### systemd (Linux)

1) Copy the unit file and edit `<REPO_DIR>`:

`codex-command/mcp/systemd/codex-mcp.service`

2) Install and start:

```bash
sudo cp codex-command/mcp/systemd/codex-mcp.service /etc/systemd/system/
sudo sed -i "s#<REPO_DIR>#$(pwd)#" /etc/systemd/system/codex-mcp.service
sudo systemctl daemon-reload
sudo systemctl enable --now codex-mcp
systemctl status codex-mcp
```

### launchd (macOS)

1) Copy the plist and edit `<REPO_DIR>`:

`codex-command/mcp/launchd/com.codex.mcp.plist`

2) Load:

```bash
cp codex-command/mcp/launchd/com.codex.mcp.plist ~/Library/LaunchAgents/
plutil -replace ProgramArguments -json '["/bin/bash","-lc","cd <REPO_DIR> && ./codex-command/mcp/server.sh"]' ~/Library/LaunchAgents/com.codex.mcp.plist
launchctl load -w ~/Library/LaunchAgents/com.codex.mcp.plist
launchctl list | grep com.codex.mcp
```
