# API 错误码参考和故障排除指南

## 目录

- [错误响应格式](#错误响应格式)
- [HTTP状态码分类](#http状态码分类)
- [详细错误码参考](#详细错误码参考)
- [故障排除指南](#故障排除指南)
- [监控和调试](#监控和调试)

## 错误响应格式

所有API错误都遵循统一的响应格式：

```json
{
  "code": "ERROR_CODE",
  "message": "人类可读的错误描述",
  "details": {
    "field": "具体的错误字段",
    "value": "导致错误的值",
    "constraint": "违反的约束条件",
    "suggestion": "修复建议"
  },
  "timestamp": "2024-01-15T10:30:00Z",
  "requestId": "req_1234567890abcdef",
  "path": "/api/v1/drafts/invalid-id"
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | string | 标准化错误代码，用于程序处理 |
| `message` | string | 用户友好的错误描述 |
| `details` | object | 详细错误信息，包含具体字段和修复建议 |
| `timestamp` | string | 错误发生的时间戳 |
| `requestId` | string | 请求唯一标识符，用于问题追踪 |
| `path` | string | 发生错误的API路径 |

## HTTP状态码分类

### 2xx 成功状态码

| 状态码 | 说明 | 使用场景 |
|--------|------|----------|
| 200 | OK | 成功获取资源或更新资源 |
| 201 | Created | 成功创建新资源 |
| 204 | No Content | 成功删除资源，无返回内容 |

### 4xx 客户端错误

| 状态码 | 说明 | 常见原因 |
|--------|------|----------|
| 400 | Bad Request | 请求参数格式错误、验证失败 |
| 401 | Unauthorized | 认证失败、token无效或过期 |
| 403 | Forbidden | 权限不足，无访问权限 |
| 404 | Not Found | 请求的资源不存在 |
| 409 | Conflict | 资源冲突，如版本冲突 |
| 422 | Unprocessable Entity | 业务逻辑验证失败 |
| 429 | Too Many Requests | 请求频率超出限制 |

### 5xx 服务器错误

| 状态码 | 说明 | 处理建议 |
|--------|------|----------|
| 500 | Internal Server Error | 服务器内部错误，稍后重试 |
| 502 | Bad Gateway | 上游服务错误，检查服务状态 |
| 503 | Service Unavailable | 服务暂时不可用，实施退避重试 |
| 504 | Gateway Timeout | 请求超时，检查网络和服务响应时间 |

## 详细错误码参考

### 认证和授权错误 (AUTH_*)

#### AUTH_TOKEN_MISSING
```json
{
  "code": "AUTH_TOKEN_MISSING",
  "message": "缺少认证token",
  "details": {
    "suggestion": "在请求头中添加 'Authorization: Bearer <token>'"
  }
}
```
**解决方案**: 在所有需要认证的请求中包含有效的JWT token。

#### AUTH_TOKEN_INVALID
```json
{
  "code": "AUTH_TOKEN_INVALID",
  "message": "认证token无效",
  "details": {
    "reason": "token格式错误或签名验证失败",
    "suggestion": "重新登录获取有效token"
  }
}
```
**解决方案**: 检查token格式，确保使用正确的JWT格式。

#### AUTH_TOKEN_EXPIRED
```json
{
  "code": "AUTH_TOKEN_EXPIRED",
  "message": "认证token已过期",
  "details": {
    "expiredAt": "2024-01-15T10:00:00Z",
    "suggestion": "使用refresh token更新access token"
  }
}
```
**解决方案**:
```javascript
// 自动刷新token
if (error.code === 'AUTH_TOKEN_EXPIRED') {
  await refreshToken();
  // 重试原请求
  return retryOriginalRequest();
}
```

#### AUTH_INSUFFICIENT_PERMISSIONS
```json
{
  "code": "AUTH_INSUFFICIENT_PERMISSIONS",
  "message": "权限不足",
  "details": {
    "requiredRole": "architect",
    "currentRole": "developer",
    "resource": "draft:123e4567-e89b-12d3-a456-426614174000",
    "action": "delete"
  }
}
```
**解决方案**: 联系管理员分配适当的角色权限。

### 验证错误 (VALIDATION_*)

#### VALIDATION_REQUIRED_FIELD
```json
{
  "code": "VALIDATION_REQUIRED_FIELD",
  "message": "缺少必填字段",
  "details": {
    "field": "title",
    "location": "body",
    "suggestion": "请提供草稿标题"
  }
}
```

#### VALIDATION_FIELD_LENGTH
```json
{
  "code": "VALIDATION_FIELD_LENGTH",
  "message": "字段长度超出限制",
  "details": {
    "field": "title",
    "currentLength": 250,
    "maxLength": 200,
    "suggestion": "将标题缩短至200个字符以内"
  }
}
```

#### VALIDATION_FIELD_FORMAT
```json
{
  "code": "VALIDATION_FIELD_FORMAT",
  "message": "字段格式错误",
  "details": {
    "field": "draftId",
    "value": "invalid-uuid",
    "expectedFormat": "UUID v4",
    "suggestion": "使用有效的UUID格式，如: 123e4567-e89b-12d3-a456-426614174000"
  }
}
```

#### VALIDATION_ENUM_VALUE
```json
{
  "code": "VALIDATION_ENUM_VALUE",
  "message": "枚举值无效",
  "details": {
    "field": "status",
    "value": "invalid_status",
    "allowedValues": ["draft", "in_review", "approved", "rejected"],
    "suggestion": "使用允许的状态值之一"
  }
}
```

### 资源错误 (RESOURCE_*)

#### RESOURCE_NOT_FOUND
```json
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "请求的资源不存在",
  "details": {
    "resourceType": "PRDDraft",
    "resourceId": "nonexistent-id",
    "suggestion": "检查资源ID是否正确，或使用 GET /drafts 查看可用资源"
  }
}
```

#### RESOURCE_ALREADY_EXISTS
```json
{
  "code": "RESOURCE_ALREADY_EXISTS",
  "message": "资源已存在",
  "details": {
    "resourceType": "Template",
    "conflictField": "name",
    "conflictValue": "existing-template-name",
    "suggestion": "使用不同的名称或更新现有资源"
  }
}
```

#### RESOURCE_LOCKED
```json
{
  "code": "RESOURCE_LOCKED",
  "message": "资源被锁定，无法修改",
  "details": {
    "resourceId": "draft-123",
    "lockedBy": "user-456",
    "lockedAt": "2024-01-15T10:30:00Z",
    "lockType": "editing",
    "suggestion": "等待编辑完成或联系锁定用户"
  }
}
```

### 业务逻辑错误 (BUSINESS_*)

#### BUSINESS_REVIEW_IN_PROGRESS
```json
{
  "code": "BUSINESS_REVIEW_IN_PROGRESS",
  "message": "草稿正在审核中，无法编辑",
  "details": {
    "draftId": "draft-123",
    "reviewId": "review-456",
    "reviewStatus": "in_review",
    "assignees": ["architect-001", "pm-002"],
    "suggestion": "等待审核完成或撤回审核后再编辑"
  }
}
```

#### BUSINESS_INVALID_STATUS_TRANSITION
```json
{
  "code": "BUSINESS_INVALID_STATUS_TRANSITION",
  "message": "无效的状态转换",
  "details": {
    "currentStatus": "approved",
    "requestedStatus": "draft",
    "allowedTransitions": ["confirmed", "rejected"],
    "suggestion": "只能从已批准状态转换到确认或拒绝"
  }
}
```

#### BUSINESS_TEMPLATE_INCOMPATIBLE
```json
{
  "code": "BUSINESS_TEMPLATE_INCOMPATIBLE",
  "message": "模板不兼容",
  "details": {
    "templateId": "template-v2",
    "draftTemplateId": "template-v1",
    "incompatibleFields": ["newRequiredField"],
    "suggestion": "先迁移草稿到兼容模板或使用原模板"
  }
}
```

### 版本控制错误 (VERSION_*)

#### VERSION_CONFLICT
```json
{
  "code": "VERSION_CONFLICT",
  "message": "版本冲突",
  "details": {
    "currentVersion": 5,
    "requestedVersion": 3,
    "lastModifiedBy": "user-789",
    "lastModifiedAt": "2024-01-15T11:00:00Z",
    "suggestion": "获取最新版本后重新提交更改"
  }
}
```

#### VERSION_NOT_FOUND
```json
{
  "code": "VERSION_NOT_FOUND",
  "message": "指定版本不存在",
  "details": {
    "draftId": "draft-123",
    "requestedVersion": 10,
    "latestVersion": 7,
    "suggestion": "使用 GET /drafts/{id}/versions 查看可用版本"
  }
}
```

### 频率限制错误 (RATE_LIMIT_*)

#### RATE_LIMIT_EXCEEDED
```json
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "请求频率超出限制",
  "details": {
    "limit": 100,
    "window": "3600s",
    "remaining": 0,
    "resetTime": "2024-01-15T12:00:00Z",
    "suggestion": "等待限制重置或减少请求频率"
  }
}
```

### 服务器错误 (SERVER_*)

#### SERVER_INTERNAL_ERROR
```json
{
  "code": "SERVER_INTERNAL_ERROR",
  "message": "服务器内部错误",
  "details": {
    "errorId": "err_1234567890",
    "suggestion": "请稍后重试，如问题持续请联系技术支持"
  }
}
```

#### SERVER_SERVICE_UNAVAILABLE
```json
{
  "code": "SERVER_SERVICE_UNAVAILABLE",
  "message": "服务暂时不可用",
  "details": {
    "serviceName": "DocumentService",
    "estimatedRecoveryTime": "2024-01-15T12:30:00Z",
    "suggestion": "系统维护中，请稍后重试"
  }
}
```

## 故障排除指南

### 1. 认证问题排查

#### 步骤1: 检查token格式
```bash
# 验证JWT token结构
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." | cut -d. -f2 | base64 -d | jq .
```

#### 步骤2: 验证token有效期
```javascript
function checkTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = payload.exp;

    if (now >= expiresAt) {
      console.log('Token已过期');
      return false;
    }

    console.log(`Token还有 ${expiresAt - now} 秒过期`);
    return true;
  } catch (e) {
    console.log('Token格式无效');
    return false;
  }
}
```

#### 步骤3: 检查请求头
```javascript
// 正确的请求头格式
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// 常见错误
// ❌ 'Authorization': token  // 缺少Bearer前缀
// ❌ 'Authorization': `Bearer${token}`  // 缺少空格
// ❌ 'authorization': `Bearer ${token}`  // 大小写错误
```

### 2. 权限问题排查

#### 检查用户角色
```bash
# 获取当前用户信息
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/v1/users/me
```

#### 验证资源权限
```javascript
// 检查草稿权限
async function checkDraftPermissions(draftId) {
  try {
    const draft = await api.getDraft(draftId);
    console.log('资源权限:', draft.permissions);

    const user = await api.getCurrentUser();
    console.log('用户角色:', user.roles);

    // 分析权限
    const isOwner = draft.permissions.owner === user.id;
    const isCollaborator = draft.permissions.collaborators.includes(user.id);
    const canEdit = isOwner || isCollaborator || user.roles.some(r => r.type === 'architect');

    console.log('权限分析:', { isOwner, isCollaborator, canEdit });
  } catch (error) {
    console.log('权限检查失败:', error);
  }
}
```

### 3. 版本冲突处理

#### 冲突检测和解决
```javascript
async function handleVersionConflict(draftId, updates) {
  try {
    // 尝试更新
    return await api.updateDraft(draftId, updates);
  } catch (error) {
    if (error.code === 'VERSION_CONFLICT') {
      // 获取最新版本
      const latestDraft = await api.getDraft(draftId);

      // 显示冲突信息
      console.log('版本冲突:', {
        current: latestDraft.version,
        attempted: updates.version,
        lastModifiedBy: latestDraft.metadata.lastEditor
      });

      // 提供冲突解决选项
      const resolution = await promptUserForConflictResolution(latestDraft, updates);

      switch (resolution) {
        case 'merge':
          return await mergeChanges(latestDraft, updates);
        case 'overwrite':
          return await api.updateDraft(draftId, { ...updates, version: latestDraft.version });
        case 'cancel':
          throw new Error('用户取消操作');
      }
    }
    throw error;
  }
}

async function mergeChanges(latestDraft, updates) {
  // 实现三方合并逻辑
  const merged = {
    ...latestDraft,
    ...updates,
    content: mergeContent(latestDraft.content, updates.content),
    version: latestDraft.version
  };

  return await api.updateDraft(latestDraft.id, merged);
}
```

### 4. 网络问题排查

#### 连接测试
```bash
# 测试API连通性
curl -I http://localhost:3000/api/v1/health

# 测试特定端点
curl -v -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/v1/drafts
```

#### 超时问题
```javascript
// 设置合理的超时时间
const apiClient = new PRDApiClient(baseUrl, token, {
  timeout: 30000, // 30秒
  retryAttempts: 3,
  retryDelay: 1000
});

// 实现重试机制
async function withRetry(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      if (error.code === 'NETWORK_TIMEOUT' || error.status >= 500) {
        const delay = Math.pow(2, i) * 1000; // 指数退避
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error; // 非重试错误直接抛出
    }
  }
}
```

### 5. 数据验证问题

#### 请求数据验证
```javascript
// 客户端预验证
function validateDraftData(data) {
  const errors = [];

  if (!data.title || data.title.trim().length === 0) {
    errors.push('标题不能为空');
  }

  if (data.title && data.title.length > 200) {
    errors.push('标题长度不能超过200个字符');
  }

  if (data.templateId && !isValidUUID(data.templateId)) {
    errors.push('模板ID格式无效');
  }

  if (errors.length > 0) {
    throw new ValidationError(errors);
  }
}

function isValidUUID(str) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}
```

### 6. 业务逻辑问题

#### 状态转换验证
```javascript
// 状态转换规则
const statusTransitions = {
  'draft': ['in_review'],
  'in_review': ['approved', 'rejected', 'changes_requested'],
  'changes_requested': ['draft', 'in_review'],
  'approved': ['confirmed', 'rejected'],
  'rejected': ['draft'],
  'confirmed': []
};

function canTransitionTo(currentStatus, targetStatus) {
  const allowedTransitions = statusTransitions[currentStatus] || [];
  return allowedTransitions.includes(targetStatus);
}

// 使用示例
if (!canTransitionTo(draft.status, 'approved')) {
  throw new Error(`无法从 ${draft.status} 状态转换到 approved`);
}
```

## 监控和调试

### 1. 请求日志记录

```javascript
class APILogger {
  constructor() {
    this.logs = [];
  }

  logRequest(method, url, data, headers) {
    const log = {
      type: 'request',
      timestamp: new Date().toISOString(),
      method,
      url,
      data: this.sanitizeData(data),
      headers: this.sanitizeHeaders(headers),
      id: this.generateRequestId()
    };

    this.logs.push(log);
    console.log('API Request:', log);
    return log.id;
  }

  logResponse(requestId, status, data, headers) {
    const log = {
      type: 'response',
      timestamp: new Date().toISOString(),
      requestId,
      status,
      data: this.sanitizeData(data),
      headers: this.sanitizeHeaders(headers)
    };

    this.logs.push(log);
    console.log('API Response:', log);
  }

  logError(requestId, error) {
    const log = {
      type: 'error',
      timestamp: new Date().toISOString(),
      requestId,
      error: {
        code: error.code,
        message: error.message,
        stack: error.stack
      }
    };

    this.logs.push(log);
    console.error('API Error:', log);
  }

  sanitizeData(data) {
    if (!data) return data;

    // 移除敏感信息
    const sanitized = JSON.parse(JSON.stringify(data));
    if (sanitized.password) sanitized.password = '***';
    if (sanitized.token) sanitized.token = '***';

    return sanitized;
  }

  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    if (sanitized.authorization) {
      sanitized.authorization = 'Bearer ***';
    }
    return sanitized;
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  exportLogs(format = 'json') {
    switch (format) {
      case 'csv':
        return this.exportToCSV();
      case 'json':
      default:
        return JSON.stringify(this.logs, null, 2);
    }
  }
}
```

### 2. 性能监控

```javascript
class APIPerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  startTiming(endpoint) {
    const key = `${Date.now()}_${Math.random()}`;
    this.metrics.set(key, {
      endpoint,
      startTime: performance.now()
    });
    return key;
  }

  endTiming(key, status) {
    const metric = this.metrics.get(key);
    if (!metric) return;

    const duration = performance.now() - metric.startTime;
    this.metrics.delete(key);

    // 记录性能指标
    console.log(`API ${metric.endpoint}: ${duration.toFixed(2)}ms (${status})`);

    // 慢请求警告
    if (duration > 5000) {
      console.warn(`Slow API call detected: ${metric.endpoint} took ${duration.toFixed(2)}ms`);
    }

    return { endpoint: metric.endpoint, duration, status };
  }

  getAverageResponseTime(endpoint) {
    // 计算平均响应时间的逻辑
  }
}
```

### 3. 健康检查

```javascript
class APIHealthChecker {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.healthStatus = 'unknown';
    this.lastCheck = null;
  }

  async checkHealth() {
    try {
      const start = Date.now();

      // 基础连接测试
      await this.apiClient.get('/health');

      // 认证测试
      await this.apiClient.getCurrentUser();

      // 核心功能测试
      await this.apiClient.getDrafts({ limit: 1 });

      const duration = Date.now() - start;

      this.healthStatus = 'healthy';
      this.lastCheck = new Date();

      console.log(`API health check passed in ${duration}ms`);
      return { status: 'healthy', responseTime: duration };

    } catch (error) {
      this.healthStatus = 'unhealthy';
      this.lastCheck = new Date();

      console.error('API health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }

  async startPeriodicHealthCheck(interval = 60000) {
    setInterval(() => {
      this.checkHealth();
    }, interval);
  }
}
```

### 4. 错误上报

```javascript
class ErrorReporter {
  constructor(config) {
    this.config = config;
    this.errorQueue = [];
  }

  reportError(error, context = {}) {
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: {
        code: error.code,
        message: error.message,
        stack: error.stack
      },
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: context.userId,
        requestId: context.requestId,
        ...context
      },
      severity: this.determineSeverity(error)
    };

    this.errorQueue.push(errorReport);

    // 立即发送高严重性错误
    if (errorReport.severity === 'high') {
      this.sendErrorReport(errorReport);
    } else {
      // 批量发送低严重性错误
      this.scheduleErrorBatch();
    }
  }

  determineSeverity(error) {
    if (error.status >= 500) return 'high';
    if (error.code === 'AUTH_TOKEN_EXPIRED') return 'medium';
    if (error.status === 404) return 'low';
    return 'medium';
  }

  async sendErrorReport(errorReport) {
    try {
      await fetch(this.config.errorReportingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorReport)
      });
    } catch (e) {
      console.error('Failed to send error report:', e);
    }
  }
}
```

---

## 总结

此错误码参考指南提供了：

1. **标准化错误格式** - 统一的错误响应结构
2. **详细错误分类** - 按功能模块组织的错误码
3. **实用故障排除** - 常见问题的诊断和解决步骤
4. **监控工具** - 性能监控和错误追踪的实现

使用此指南可以：
- 快速定位和解决API使用问题
- 实施有效的错误处理策略
- 建立完善的监控和调试体系
- 提高API集成的稳定性和可靠性

**更新时间**: 2024-01-15
**文档版本**: 1.0.0