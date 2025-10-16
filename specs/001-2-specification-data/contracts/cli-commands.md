# CLI Commands Contract

## Command Structure

```bash
codex-father [global-options] <command> [command-options]
```

### Global Options
- `--version, -v`: Show version number
- `--help, -h`: Show help information
- `--config <path>`: Configuration file path
- `--verbose, -V`: Verbose output

## Commands

### mcp
Start MCP server (default mode).

```bash
codex-father mcp [options]
```

**Options:**
- `--max-concurrency <number>`: Maximum concurrent tasks (default: 10)
- `--timeout <milliseconds>`: Default task timeout (default: 600000)
- `--working-directory <path>`: Working directory for tasks
- `--log-level <level>`: Log level (error|warn|info|debug)

**Examples:**
```bash
codex-father mcp
codex-father mcp --max-concurrency 20 --timeout 300000
codex-father mcp --working-directory ./workspace
```

### server
Start HTTP API server.

```bash
codex-father server [options]
```

**Options:**
- `--port <number>`: Port to listen on (default: 3000)
- `--host <address>`: Host address (default: 0.0.0.0)
- `--max-concurrency <number>`: Maximum concurrent tasks (default: 10)
- `--cors <origins>`: CORS allowed origins (default: *)
- `--enable-websocket`: Enable WebSocket support

**Examples:**
```bash
codex-father server
codex-father server --port 8080 --host localhost
codex-father server --enable-websocket --max-concurrency 50
```

### run
Run tasks from configuration file.

```bash
codex-father run <config-file> [options]
```

**Arguments:**
- `config-file`: Path to task configuration file

**Options:**
- `--max-concurrency <number>`: Maximum concurrent tasks (default: 5)
- `--continue-on-error`: Continue after task failure
- `--dry-run`: Show what would be executed without running

**Configuration File Format:**
```json
{
  "tasks": [
    {
      "id": "build",
      "command": "npm run build",
      "environment": "nodejs",
      "timeout": 300000
    },
    {
      "id": "test",
      "command": "npm test",
      "dependencies": ["build"],
      "environment": "nodejs"
    }
  ],
  "settings": {
    "maxConcurrency": 5,
    "workingDirectory": "./project"
  }
}
```

**Examples:**
```bash
codex-father run tasks.json
codex-father run deploy.json --max-concurrency 3
codex-father run ci-tasks.json --dry-run
```

### status
Show system status and statistics.

```bash
codex-father status [options]
```

**Options:**
- `--json`: Output in JSON format
- `--detailed`: Show detailed task information

**Examples:**
```bash
codex-father status
codex-father status --json
codex-father status --detailed
```

### logs
View task logs.

```bash
codex-father logs <task-id> [options]
```

**Arguments:**
- `task-id`: Task ID to view logs for

**Options:**
- `--tail <number>`: Number of lines to show from end (default: 50)
- `--follow, -f`: Follow log output
- `--timestamp`: Show timestamps

**Examples:**
```bash
codex-father logs task-123
codex-father logs task-123 --tail 100
codex-father logs task-123 --follow
```

### cancel
Cancel a running task.

```bash
codex-father cancel <task-id>
```

**Arguments:**
- `task-id`: Task ID to cancel

**Examples:**
```bash
codex-father cancel task-123
```

### config
Show or update configuration.

```bash
codex-father config [key] [value]
```

**Usage:**
- `codex-father config`: Show all configuration
- `codex-father config <key>`: Show specific configuration value
- `codex-father config <key> <value>`: Set configuration value

**Examples:**
```bash
codex-father config
codex-father config maxConcurrency
codex-father config maxConcurrency 20
```

## Configuration File

### Default Locations
- `~/.codex-father/config.json`
- `./codex-father.json`
- `./.codex-father.json`

### Configuration Format
```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "enableWebSocket": true,
    "cors": {
      "origins": ["*"],
      "credentials": false
    }
  },
  "runner": {
    "maxConcurrency": 10,
    "defaultTimeout": 600000,
    "workingDirectory": process.cwd(),
    "security": {
      "networkDisabled": true,
      "allowedPaths": ["."]
    }
  },
  "logging": {
    "level": "info",
    "file": "./logs/codex-father.log",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Configuration error |
| 4 | Task execution failure |
| 130 | Interrupted (Ctrl+C) |