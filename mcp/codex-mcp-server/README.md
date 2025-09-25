codex-father-mcp-server

TypeScript MCP server for this repo using @modelcontextprotocol/sdk. It exposes tools to execute/start and manage Codex runs by delegating to the local `start.sh`/`job.sh`.

Usage
- Dev run (requires deps installed):
  - `npm install`
  - `npm run dev`

- Build + run:
  - `npm run build`
  - `node dist/index.js`

- As CLI after publish:
  - GitHub Packages (this repo uses GH Packages)
    - Configure ~/.npmrc:
      - `@yuanyuanyuan:registry=https://npm.pkg.github.com`
      - `//npm.pkg.github.com/:_authToken=<YOUR_GITHUB_TOKEN>`
    - Install or run:
      - `npm install -g @yuanyuanyuan/codex-father-mcp-server`
      - or `npx @yuanyuanyuan/codex-father-mcp-server`
  - npmjs (if published there)
    - `npx @yuanyuanyuan/codex-father-mcp-server` (or `codex-mcp-server` if globally installed)

Tools
- `codex.exec`: Synchronous execution (blocks until finish). Args:
  - `args`: string[] — forwarded to `start.sh`
  - `tag`: string — label for the run (used in directory name)
  - `cwd`: string — project root for session storage (default: server cwd)
  - Returns JSON: `{ runId, exitCode, cwd, logFile, instructionsFile, metaFile, lastMessageFile, tag }`

- `codex.start`: Start a non-blocking run. Args:
  - `args`: string[] — forwarded to `start.sh`
  - `tag`: string — job tag
  - `cwd`: string — working directory for job

- `codex.status`: Get job status. Args: `{ jobId: string, cwd?: string }`
- `codex.logs`: Read job log. Args:
  - `jobId` (string), optional `cwd` to locate `.codex-father/sessions`
  - Either byte pagination (`offset`, `limit`) or line mode (`mode: "lines"`, with `offsetLines`/`limitLines` or `tailLines`, optional `grep`)
- `codex.stop`: Stop a job. Args: `{ jobId: string, force?: boolean, cwd?: string }`
- `codex.list`: List known jobs. Args: `{ cwd?: string }`

Configuration (VS Code-style)
```
{
  "servers": {
    "codex-father": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "type": "stdio"
    },
    "deepwiki": {
      "url": "https://mcp.deepwiki.com/sse",
      "type": "http"
    }
  }
}
```

Deepwiki note
- With `deepwiki` configured, you can query `https://github.com/modelcontextprotocol/typescript-sdk` content at any time in your MCP-enabled client.
- This server focuses on Codex job orchestration. You can also build a bridge tool to proxy deepwiki via the MCP client API if desired.

Environment
- `CODEX_JOB_SH`: optional absolute path to `job.sh`. Defaults to `./job.sh` from current working dir.
- `CODEX_START_SH`: optional absolute path to `start.sh`. Defaults to `./start.sh` from current working dir.

Storage layout
- Sessions live under `<project>/.codex-father/sessions/<job-id>/` with `job.log`, `*.instructions.md`, `*.meta.json`, `state.json` (async), and `*.last.txt` files.
