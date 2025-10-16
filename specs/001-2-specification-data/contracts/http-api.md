# HTTP API Contracts

## REST Endpoints

### POST /tasks
Submit a new task for execution.

**Request:**
```json
{
  "id": "optional-custom-task-id",
  "prompt": "Create a user login component",
  "command": "npm test",
  "files": ["src/components/", "package.json"],
  "environment": "nodejs",
  "priority": "high",
  "dependencies": ["task-123"],
  "timeout": 300000,
  "workingDirectory": "/workspace"
}
```

**Response (201):**
```json
{
  "success": true,
  "taskId": "task-1704067200000-xyz789",
  "status": "started",
  "message": "Task submitted successfully"
}
```

### GET /tasks/{id}
Get task status and details.

**Response (200):**
```json
{
  "taskId": "task-1704067200000-xyz789",
  "status": "completed",
  "progress": 100,
  "startTime": "2024-01-01T12:00:00.000Z",
  "endTime": "2024-01-01T12:02:30.000Z",
  "duration": 150000,
  "result": {
    "filesCreated": ["src/components/Login.tsx"],
    "summary": "Login component created successfully"
  },
  "logs": ["Installing dependencies...", "Building component..."]
}
```

### GET /tasks
List tasks with optional filtering.

**Query Parameters:**
- `status`: Filter by status (running|completed|failed|pending|cancelled)
- `limit`: Maximum number of tasks (default: 20, max: 100)
- `cursor`: Pagination cursor
- `orderBy`: Sort field (createdAt|duration|status|priority)
- `order`: Sort direction (asc|desc)

**Response (200):**
```json
{
  "tasks": [
    {
      "taskId": "task-1704067200000-abc123",
      "status": "running",
      "progress": 45,
      "startTime": "2024-01-01T12:00:00.000Z"
    }
  ],
  "total": 1,
  "hasMore": false,
  "cursor": "next-page-token"
}
```

### POST /tasks/{id}/reply
Continue a task with additional context.

**Request:**
```json
{
  "message": "Add social login support",
  "files": ["src/auth/"]
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Context added to task"
}
```

### DELETE /tasks/{id}
Cancel a running task.

**Response (200):**
```json
{
  "success": true,
  "message": "Task cancelled successfully"
}
```

### GET /healthz
Health check endpoint.

**Response (200):**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime": 3600,
  "tasks": {
    "running": 3,
    "pending": 1,
    "completed": 25
  }
}
```

## WebSocket Messages

### Connection
```
GET /ws
Upgrade: websocket
Connection: Upgrade
```

### Message Types

#### task_started
```json
{
  "type": "task_started",
  "data": {
    "taskId": "task-1704067200000-abc123",
    "prompt": "Create login component"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### task_progress
```json
{
  "type": "task_progress",
  "data": {
    "taskId": "task-1704067200000-abc123",
    "progress": 60,
    "message": "Building component..."
  },
  "timestamp": "2024-01-01T12:01:00.000Z"
}
```

#### task_completed
```json
{
  "type": "task_completed",
  "data": {
    "taskId": "task-1704067200000-abc123",
    "result": {
      "filesCreated": 3,
      "summary": "Login component completed"
    },
    "duration": 120000
  },
  "timestamp": "2024-01-01T12:02:00.000Z"
}
```

#### task_failed
```json
{
  "type": "task_failed",
  "data": {
    "taskId": "task-1704067200000-abc123",
    "error": "Build failed: Missing dependency",
    "duration": 45000
  },
  "timestamp": "2024-01-01T12:01:45.000Z"
}
```

## Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": {
    "code": "TASK_NOT_FOUND",
    "message": "Task not found",
    "hint": "Check the task ID and try again",
    "details": {
      "taskId": "invalid-task-id",
      "timestamp": "2024-01-01T12:00:00.000Z"
    },
    "requestId": "req-xyz789"
  }
}
```

### HTTP Status Codes

| Status | Code | Description |
|--------|------|-------------|
| 200 | SUCCESS | Request successful |
| 201 | CREATED | Task created successfully |
| 400 | BAD_REQUEST | Invalid request parameters |
| 404 | NOT_FOUND | Task not found |
| 409 | CONFLICT | Task state conflict |
| 422 | UNPROCESSABLE_ENTITY | Invalid task configuration |
| 429 | TOO_MANY_REQUESTS | Rate limit exceeded |
| 500 | INTERNAL_ERROR | Server internal error |
| 503 | SERVICE_UNAVAILABLE | Service temporarily unavailable |