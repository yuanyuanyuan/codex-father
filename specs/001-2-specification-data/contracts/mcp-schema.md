# MCP Protocol Contracts

## MCP Tools Schema

### codex_exec
```json
{
  "name": "codex_exec",
  "description": "Execute a development task (AI prompt or command)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskId": {
        "type": "string",
        "pattern": "^[a-zA-Z0-9_-]+$",
        "description": "Custom task id; server generates if omitted"
      },
      "prompt": {
        "type": "string",
        "description": "Natural language prompt for AI execution"
      },
      "command": {
        "type": "string",
        "description": "Shell command to execute"
      },
      "files": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Files/paths to include in context"
      },
      "priority": {
        "type": "string",
        "enum": ["low", "normal", "high"],
        "default": "normal"
      },
      "dependencies": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Task IDs that must complete first"
      },
      "environment": {
        "type": "string",
        "enum": ["shell", "nodejs", "python"],
        "default": "shell"
      },
      "timeout": {
        "type": "number",
        "description": "Timeout in milliseconds (default: 600000)"
      }
    },
    "anyOf": [
      { "required": ["prompt"] },
      { "required": ["command"] }
    ]
  }
}
```

### codex_status
```json
{
  "name": "codex_status",
  "description": "Check task execution status",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskId": {
        "type": "string",
        "description": "Task ID to check"
      },
      "includeResult": {
        "type": "boolean",
        "description": "Include final result if completed",
        "default": false
      }
    },
    "required": ["taskId"]
  }
}
```

### codex_logs
```json
{
  "name": "codex_logs",
  "description": "Get task execution logs",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskId": {
        "type": "string",
        "description": "Task ID"
      },
      "tailLines": {
        "type": "integer",
        "description": "Number of lines to show from end",
        "default": 50,
        "minimum": 1,
        "maximum": 1000
      },
      "cursor": {
        "type": "string",
        "description": "Pagination cursor for incremental log fetch"
      }
    },
    "required": ["taskId"]
  }
}
```

### codex_reply
```json
{
  "name": "codex_reply",
  "description": "Reply to a running task with additional context",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskId": {
        "type": "string",
        "description": "Task ID to reply to"
      },
      "message": {
        "type": "string",
        "description": "Message to append to task context"
      },
      "files": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Additional files to include"
      }
    },
    "required": ["taskId", "message"]
  }
}
```

### codex_list
```json
{
  "name": "codex_list",
  "description": "List all tasks",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["running", "completed", "failed", "pending", "cancelled"]
        },
        "description": "Filter by status"
      },
      "limit": {
        "type": "integer",
        "description": "Maximum number of tasks to return",
        "default": 20,
        "minimum": 1,
        "maximum": 100
      },
      "cursor": {
        "type": "string",
        "description": "Pagination cursor"
      }
    }
  }
}
```

### codex_cancel
```json
{
  "name": "codex_cancel",
  "description": "Cancel a running task",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskId": {
        "type": "string",
        "description": "Task ID to cancel"
      }
    },
    "required": ["taskId"]
  }
}
```

## MCP Response Format

### Success Response
```json
{
  "content": [
    {
      "type": "text",
      "text": "✅ Task accepted: task-1704067200000-abc123"
    }
  ]
}
```

### Error Response
```json
{
  "error": {
    "code": -32002,
    "message": "Task execution failed: Command timeout",
    "data": {
      "taskId": "task-1704067200000-abc123",
      "errorType": "TIMEOUT",
      "retryable": true,
      "hint": "请缩短命令执行时间或调整默认超时配置"
    }
  }
}
```

## MCP Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| -32602 | Invalid params | No |
| -32603 | Internal error | No |
| -32001 | Task not found | No |
| -32002 | Task execution failed | Yes |
| -32003 | Timeout | Yes |
| -32004 | Resource insufficient | Yes |
| -32005 | Security violation | No |