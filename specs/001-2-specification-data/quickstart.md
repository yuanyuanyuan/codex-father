# Quick Start Guide

## Installation

### Global Installation
```bash
npm install -g codex-father
```

### Local Installation
```bash
npm install --save-dev codex-father
```

### From Source
```bash
git clone https://github.com/your-org/codex-father.git
cd codex-father
npm install
npm run build
npm link
```

## MCP Integration (Recommended)

### 1. Configure Claude Code
Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": ["mcp", "--max-concurrency", "10"]
    }
  }
}
```

### 2. Start Using in Claude Code
```
User: 帮我创建一个用户登录组件
Claude: [Uses codex_exec tool] 
✅ Task accepted: task-1704067200000-abc123

User: 查看任务状态
Claude: [Uses codex_status tool]
📊 Task completed: Login component created successfully
```

### 3. Available MCP Tools
- `codex_exec`: Execute development tasks
- `codex_status`: Check task status
- `codex_logs`: View execution logs
- `codex_reply`: Continue tasks with context
- `codex_list`: List all tasks
- `codex_cancel`: Cancel running tasks

## HTTP API Usage

### 1. Start Server
```bash
codex-father server --port 3000
```

### 2. Submit Task
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a REST API for user management",
    "environment": "nodejs",
    "priority": "high"
  }'
```

### 3. Check Status
```bash
curl http://localhost:3000/tasks/task-123
```

### 4. WebSocket Integration
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Task update:', message);
};
```

## CLI Usage

### Basic Commands
```bash
# Start MCP server (default)
codex-father mcp

# Start HTTP server
codex-father server --port 3000

# Run tasks from config file
codex-father run tasks.json

# Check system status
codex-father status

# View task logs
codex-father logs task-123

# Cancel running task
codex-father cancel task-123
```

### Configuration File
Create `codex-father.json`:
```json
{
  "runner": {
    "maxConcurrency": 20,
    "defaultTimeout": 600000,
    "workingDirectory": "./workspace"
  },
  "server": {
    "port": 3000,
    "enableWebSocket": true
  }
}
```

## Task Examples

### Shell Command
```bash
codex-father mcp
# In Claude Code: "Run the test suite"
# Executes: npm test
```

### Node.js Script
```bash
# In Claude Code: "Build the project"
# Creates and runs: build.js
```

### Python Script
```bash
# In Claude Code: "Analyze the data"
# Creates and runs: analysis.py
```

### Complex Workflow
```json
{
  "tasks": [
    {
      "id": "install",
      "command": "npm install",
      "environment": "shell"
    },
    {
      "id": "lint",
      "command": "npm run lint",
      "dependencies": ["install"],
      "environment": "nodejs"
    },
    {
      "id": "test",
      "command": "npm test",
      "dependencies": ["lint"],
      "environment": "nodejs"
    },
    {
      "id": "build",
      "command": "npm run build",
      "dependencies": ["test"],
      "environment": "nodejs"
    }
  ]
}
```

## Security Settings

### Default Security Policy
- Network access disabled
- File system restricted to working directory
- 10-minute default timeout
- No automatic retry on failure

### Custom Security Policy
```json
{
  "runner": {
    "security": {
      "networkDisabled": true,
      "allowedPaths": ["/workspace", "/tmp"],
      "maxExecutionTime": 600000,
      "maxMemoryUsage": "512MB",
      "allowedCommands": ["npm", "node", "python", "bash"]
    }
  }
}
```

## Troubleshooting

### Common Issues

#### Task Timeout
```bash
# Increase timeout
codex-father mcp --timeout 600000
```

#### Permission Denied
```bash
# Check working directory permissions
ls -la ./workspace

# Change working directory
codex-father mcp --working-directory ./my-project
```

#### Port Already in Use
```bash
# Use different port
codex-father server --port 3001
```

### Debug Mode
```bash
codex-father mcp --verbose --log-level debug
```

### Log Files
```bash
# View logs
codex-father logs task-id

# Follow logs in real-time
codex-father logs task-id --follow
```

## Performance Tuning

### Concurrency
```bash
# Increase concurrent tasks
codex-father mcp --max-concurrency 50
```

### Memory Usage
```json
{
  "runner": {
    "maxConcurrency": 10,
    "maxMemoryUsage": "1GB"
  }
}
```

### Resource Monitoring
```bash
codex-father status --detailed
```

## Next Steps

1. **Explore MCP Integration**: Try the Claude Code integration
2. **Build Custom Workflows**: Create task configuration files
3. **Monitor Performance**: Use the status command and logs
4. **Configure Security**: Adjust security policies for your use case
5. **Scale Up**: Tune concurrency and performance settings

## Support

- **Documentation**: [Link to full docs]
- **Issues**: [GitHub Issues]
- **Community**: [Discord/Slack]
- **Examples**: [Example Repository]

---

*Happy coding with Codex Father 2.0! 🚀*