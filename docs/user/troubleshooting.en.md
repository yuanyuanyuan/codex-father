# 🆘 Troubleshooting (EN)

Common issues and quick fixes. For the full env var list and defaults, see:

- Human‑readable: ../environment-variables-reference.en.md
- Machine‑readable: ../environment-variables.json, ../environment-variables.csv

## Quick diagnosis by symptom

- Server not connecting
- Unknown tool / naming mismatch
- Command execution failures
- Permission errors
- Performance problems
- Approval policy issues
- Passive notifications missing

---

## Server not connecting

Symptoms

- “Not connected” in Claude Desktop
- Requests have no response

Steps

1) Validate config format (Claude Desktop)

```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
```

2) Check commands

```bash
npx -y @starkdev020/codex-father-mcp-server   # npx path
codex-mcp-server --version                    # global install
```

3) Check Node.js version (>= 18)

```bash
node --version
```

Fixes

- Reconfigure using the recommended JSON/TOML
- Fully quit and restart the client
- Use MCP Inspector for interactive debugging:

```bash
npx @modelcontextprotocol/inspector npx -y @starkdev020/codex-father-mcp-server
```

---

## Unknown tool name / naming mismatch

Cause: different clients prefer dot vs underscore tool names; Codex 0.44 responses may reject dotted names.

Fix

- Set `CODEX_MCP_NAME_STYLE=underscore-only`.
- Optionally set `CODEX_MCP_TOOL_PREFIX=cf` and `CODEX_MCP_HIDE_ORIGINAL=1` to expose only `cf_*` tools.
- Use `codex.help` to list tools or query a specific tool with `format: 'json'`.

---

## Command execution failures

Check Codex CLI presence and syntax; test on terminal first. If you see `400 Unsupported model`, switch to a supported model or adjust provider mapping. For reasoning effort use `minimal|low|medium|high`.

Patch mode notes: `--patch-mode` adds a policy note and writes diffs to `<session>/patches/patch.diff`. To avoid conflicts with general “style/explanation” base instructions, patch mode skips injecting the base block and keeps only the task text plus the policy note. Tune visibility with `--patch-preview-lines` or `--no-patch-preview`; disable artifact with `--no-patch-artifact`.

### View the patch manifest (logs --patches)

The patch manifest lives under `<session>/patches/manifest.jsonl`. Use the CLI to list/tail:

```bash
# Show last 50 patch records (text formatted)
codex-father logs <sessionId> --patches --limit 50

# Follow the patch manifest (tail -f style)
codex-father logs <sessionId> --patches --follow

# Output raw JSON lines (e.g., for pipelines)
codex-father logs <sessionId> --patches --format json --limit 200
```

Common jq snippets (operate on the manifest file directly):

```bash
# Applied patches only (TSV: sequence, patchId, path, sha256)
jq -r 'select(.status=="applied") | [.sequence,.patchId,.path,.sha256] | @tsv' \
  .codex-father/sessions/<sessionId>/patches/manifest.jsonl

# Failed patches with errors
jq -r 'select(.status=="failed") | {seq:.sequence, id:.patchId, path, error}' \
  .codex-father/sessions/<sessionId>/patches/manifest.jsonl

# Last 10 entries (tail) and extract key fields
tail -n 10 .codex-father/sessions/<sessionId>/patches/manifest.jsonl \
  | jq -r '{ts: (.appliedAt // .createdAt), status, id: .patchId, path, sha: .sha256}'
```

Network restricted by default: enable via CLI `--codex-config sandbox_workspace_write.network_access=true` or set the MCP tool argument accordingly; verify `<session>/job.meta.json` shows `effective_network_access: enabled`.

Resuming jobs: use `./job.sh status <jobId> --json` then `./job.sh resume <jobId> ...`. For MCP, call `codex.resume` with `jobId` and optional `args`.

---

## Permission errors

Fix common cases by adjusting file permissions or running installs with proper rights. On Windows PowerShell, set execution policy to `RemoteSigned` for local scripts.

---

## Performance problems

- Limit concurrency via `MAX_CONCURRENT_JOBS`
- Clean large log folders periodically

---

## Approval policy issues

- Too many prompts? Prefer `on-failure` for mostly non‑interactive flows.
- Need fully unattended? Consider `never` (only in trusted environments) or an explicit “dangerously bypass” option; understand the risks first.

---

## Passive notifications missing

Common causes include input size precheck failures (`context_overflow`) and early invalid parameters (`input_error`). Inspect `events.jsonl` and `job.log` under `.codex-father/sessions/<jobId>/`. Upgrade to the latest version if you suspect old path joining bugs for logs.

Self‑checks (examples): see Chinese doc for the shell scenarios; semantics are the same.

### Quick session health check (validate-session)

Verify a session has a proper start/end and a closed state:

```bash
scripts/validate-session.sh /abs/path/to/.codex-father/sessions/<sessionId>
```

It checks both `start` and `orchestration_completed` exist in `events.jsonl`, and `state.json` ends in `completed/failed/cancelled`.

### Tip: echo full composed instructions

Since v1.7 we no longer echo the full composed instructions into `job.log` by default (we record an `instructions_updated` event with path/sha256/line counts). Enable full echo only when you need it:

```bash
export CODEX_ECHO_INSTRUCTIONS=1
export CODEX_ECHO_INSTRUCTIONS_LIMIT=0  # no truncation
```

Or use CLI flags: `--echo-instructions --echo-limit 0`.

---

## Advanced diagnostics

Enable debug logging:

```json
{
  "mcpServers": {
    "codex-father": {
      "env": {
        "LOG_LEVEL": "debug",
        "LOG_FILE": "/tmp/codex-father-debug.log"
      }
    }
  }
}
```

Inspect with MCP Inspector (see command above).

---

## Get more help

When filing an issue, include: error text/screenshots, your config, OS and Node.js versions, and relevant logs.
