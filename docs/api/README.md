# PRD Draft Documentation System API

基于OpenAPI 3.0的PRD（产品需求文档）草稿管理系统REST API文档。

## 目录

- [快速开始](#快速开始)
- [认证授权](#认证授权)
- [API端点](#api端点)
- [代码示例](#代码示例)
- [错误处理](#错误处理)
- [集成指南](#集成指南)
- [最佳实践](#最佳实践)

## 快速开始

### 基础信息

- **Base URL**: `http://localhost:3000/api/v1` (开发环境)
- **Base URL**: `https://api.codex-father.dev/v1` (生产环境)
- **Content-Type**: `application/json`
- **认证方式**: Bearer Token (JWT)

### 简单示例

```bash
# 获取所有PRD草稿
curl -X GET "http://localhost:3000/api/v1/drafts" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

## 认证授权

### JWT Token

API使用JWT（JSON Web Token）进行身份验证。所有需要认证的端点都需要在请求头中包含有效的Bearer token。

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 获取Token

```javascript
// 示例：登录获取token
const response = await fetch('/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'your-username',
    password: 'your-password'
  })
});

const data = await response.json();
const token = data.accessToken;
```

### 角色权限

| 角色 | 权限 |
|------|------|
| `architect` | 所有操作权限 |
| `product_manager` | 创建、编辑、审核PRD |
| `developer` | 查看PRD，创建评论 |
| `tester` | 查看PRD，测试相关章节编辑 |
| `reviewer` | 查看和审核PRD |

## API端点

### PRD草稿管理

#### 1. 获取PRD草稿列表

```http
GET /drafts?page=1&limit=20&status=draft&author=user123
```

**查询参数:**
- `page` (int): 页码，默认1
- `limit` (int): 每页数量，最大100，默认20
- `status` (string): 过滤状态 - `draft|in_review|approved|rejected`
- `author` (string): 作者用户ID
- `template` (string): 模板ID
- `search` (string): 搜索标题和内容

**响应示例:**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "新功能PRD：用户认证系统",
      "description": "实现OAuth 2.0用户认证功能",
      "status": "draft",
      "authorId": "user123",
      "templateId": "template-basic",
      "version": 3,
      "createdAt": "2024-01-15T08:30:00Z",
      "updatedAt": "2024-01-15T14:20:00Z",
      "metadata": {
        "tags": ["authentication", "security"],
        "priority": "high",
        "estimatedReadTime": 15
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

#### 2. 创建新PRD草稿

```http
POST /drafts
```

**请求体:**
```json
{
  "title": "移动端推送功能PRD",
  "description": "实现跨平台推送通知系统",
  "templateId": "template-feature",
  "initialContent": "# 概述\n\n本PRD描述移动端推送功能的需求...",
  "metadata": {
    "tags": ["mobile", "notification"],
    "priority": "medium",
    "category": "feature"
  }
}
```

**响应示例:**
```json
{
  "id": "456e7890-e89b-12d3-a456-426614174001",
  "title": "移动端推送功能PRD",
  "description": "实现跨平台推送通知系统",
  "status": "draft",
  "authorId": "current-user-id",
  "templateId": "template-feature",
  "version": 1,
  "createdAt": "2024-01-15T16:00:00Z",
  "updatedAt": "2024-01-15T16:00:00Z",
  "content": "# 概述\n\n本PRD描述移动端推送功能的需求...",
  "sections": [
    {
      "id": "overview",
      "title": "概述",
      "order": 1,
      "content": "本PRD描述移动端推送功能的需求...",
      "level": 1,
      "isRequired": true
    }
  ]
}
```

#### 3. 获取PRD草稿详情

```http
GET /drafts/{draftId}?includeContent=true&version=2
```

**路径参数:**
- `draftId` (uuid): 草稿ID

**查询参数:**
- `includeContent` (boolean): 是否包含内容，默认true
- `version` (int): 指定版本号，默认最新版本

#### 4. 更新PRD草稿

```http
PUT /drafts/{draftId}
```

**请求体:**
```json
{
  "title": "移动端推送功能PRD (更新版)",
  "content": "# 概述\n\n更新后的内容...",
  "commitMessage": "添加技术实现细节",
  "sections": [
    {
      "id": "overview",
      "title": "概述",
      "order": 1,
      "content": "更新后的概述内容...",
      "level": 1,
      "isRequired": true
    },
    {
      "id": "technical",
      "title": "技术实现",
      "order": 2,
      "content": "## 架构设计\n\n使用Firebase Cloud Messaging...",
      "level": 1,
      "isRequired": false
    }
  ]
}
```

#### 5. 删除PRD草稿

```http
DELETE /drafts/{draftId}?force=false
```

**查询参数:**
- `force` (boolean): 是否永久删除，默认false（软删除）

### 版本管理

#### 1. 获取版本历史

```http
GET /drafts/{draftId}/versions?limit=10
```

**响应示例:**
```json
{
  "data": [
    {
      "id": "version-uuid-1",
      "versionNumber": 3,
      "changeType": "edit",
      "createdAt": "2024-01-15T14:20:00Z",
      "createdBy": "user123",
      "commitMessage": "添加安全性要求章节"
    },
    {
      "id": "version-uuid-2",
      "versionNumber": 2,
      "changeType": "review",
      "createdAt": "2024-01-15T10:15:00Z",
      "createdBy": "reviewer456",
      "commitMessage": "审核反馈：需要补充性能指标"
    }
  ]
}
```

#### 2. 获取特定版本

```http
GET /drafts/{draftId}/versions/{versionNumber}
```

#### 3. 恢复到指定版本

```http
POST /drafts/{draftId}/versions/{versionNumber}
```

**请求体:**
```json
{
  "commitMessage": "回退到版本2，修复格式问题"
}
```

### 审核管理

#### 1. 获取审核状态

```http
GET /drafts/{draftId}/reviews
```

**响应示例:**
```json
{
  "id": "review-uuid",
  "draftId": "draft-uuid",
  "status": "in_review",
  "phase": "technical",
  "assignees": [
    {
      "userId": "architect-user",
      "role": "architect",
      "assignedAt": "2024-01-15T09:00:00Z",
      "status": "pending"
    }
  ],
  "reviews": [
    {
      "id": "review-item-1",
      "reviewerId": "reviewer-123",
      "status": "approved",
      "submittedAt": "2024-01-15T11:30:00Z",
      "comments": [
        {
          "sectionId": "technical",
          "content": "技术方案合理，建议补充容灾设计",
          "type": "suggestion",
          "severity": "medium"
        }
      ]
    }
  ],
  "dueDate": "2024-01-20T18:00:00Z",
  "priority": "high"
}
```

#### 2. 提交审核

```http
POST /drafts/{draftId}/reviews
```

**请求体:**
```json
{
  "assignees": [
    {
      "userId": "architect-001",
      "role": "architect"
    },
    {
      "userId": "pm-002",
      "role": "product_manager"
    }
  ],
  "dueDate": "2024-01-25T18:00:00Z",
  "priority": "high",
  "message": "请重点关注技术可行性和资源评估"
}
```

#### 3. 提交审核意见

```http
PUT /drafts/{draftId}/reviews/{reviewId}
```

**请求体:**
```json
{
  "status": "changes_requested",
  "comments": [
    {
      "sectionId": "overview",
      "lineNumber": 15,
      "content": "需要明确用户故事的验收标准",
      "type": "issue",
      "severity": "high"
    },
    {
      "sectionId": "technical",
      "content": "建议考虑使用微服务架构",
      "type": "suggestion",
      "severity": "medium"
    }
  ]
}
```

### 模板管理

#### 1. 获取模板列表

```http
GET /templates?active=true
```

#### 2. 获取模板详情

```http
GET /templates/{templateId}
```

#### 3. 创建新模板

```http
POST /templates
```

### 用户管理

#### 1. 获取当前用户信息

```http
GET /users/me
```

#### 2. 更新用户设置

```http
PUT /users/me
```

## 代码示例

### JavaScript/TypeScript

```typescript
class PRDApiClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async request(method: string, endpoint: string, data?: any) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API Error: ${error.message}`);
    }

    return await response.json();
  }

  // 获取草稿列表
  async getDrafts(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  } = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request('GET', `/drafts?${query}`);
  }

  // 创建草稿
  async createDraft(draft: {
    title: string;
    description?: string;
    templateId: string;
    initialContent?: string;
  }) {
    return this.request('POST', '/drafts', draft);
  }

  // 更新草稿
  async updateDraft(draftId: string, updates: {
    title?: string;
    content?: string;
    commitMessage?: string;
  }) {
    return this.request('PUT', `/drafts/${draftId}`, updates);
  }

  // 提交审核
  async submitForReview(draftId: string, reviewRequest: {
    assignees: Array<{ userId: string; role: string }>;
    dueDate: string;
    priority?: string;
    message?: string;
  }) {
    return this.request('POST', `/drafts/${draftId}/reviews`, reviewRequest);
  }
}

// 使用示例
const api = new PRDApiClient('http://localhost:3000/api/v1', 'your-jwt-token');

// 创建新草稿
const newDraft = await api.createDraft({
  title: '新功能：实时协作编辑',
  description: '支持多人同时编辑PRD文档',
  templateId: 'template-feature',
  initialContent: '# 概述\n\n实现Google Docs式的实时协作功能...'
});

// 获取草稿列表
const drafts = await api.getDrafts({
  status: 'draft',
  limit: 10
});

// 提交审核
await api.submitForReview(newDraft.id, {
  assignees: [
    { userId: 'architect-001', role: 'architect' },
    { userId: 'pm-002', role: 'product_manager' }
  ],
  dueDate: '2024-02-01T18:00:00Z',
  priority: 'high',
  message: '请重点评估技术复杂度和开发周期'
});
```

### Python

```python
import requests
from typing import Dict, List, Optional
from datetime import datetime

class PRDApiClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip('/')
        self.token = token
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict:
        url = f"{self.base_url}{endpoint}"
        response = self.session.request(method, url, **kwargs)

        if not response.ok:
            error_data = response.json()
            raise Exception(f"API Error {response.status_code}: {error_data.get('message', 'Unknown error')}")

        return response.json()

    def get_drafts(self, page: int = 1, limit: int = 20,
                   status: Optional[str] = None,
                   search: Optional[str] = None) -> Dict:
        """获取PRD草稿列表"""
        params = {'page': page, 'limit': limit}
        if status:
            params['status'] = status
        if search:
            params['search'] = search

        return self._request('GET', '/drafts', params=params)

    def create_draft(self, title: str, template_id: str,
                     description: Optional[str] = None,
                     initial_content: Optional[str] = None) -> Dict:
        """创建新的PRD草稿"""
        data = {
            'title': title,
            'templateId': template_id
        }
        if description:
            data['description'] = description
        if initial_content:
            data['initialContent'] = initial_content

        return self._request('POST', '/drafts', json=data)

    def update_draft(self, draft_id: str, title: Optional[str] = None,
                     content: Optional[str] = None,
                     commit_message: Optional[str] = None) -> Dict:
        """更新PRD草稿"""
        data = {}
        if title:
            data['title'] = title
        if content:
            data['content'] = content
        if commit_message:
            data['commitMessage'] = commit_message

        return self._request('PUT', f'/drafts/{draft_id}', json=data)

    def submit_for_review(self, draft_id: str, assignees: List[Dict[str, str]],
                          due_date: str, priority: str = 'medium',
                          message: Optional[str] = None) -> Dict:
        """提交草稿进行审核"""
        data = {
            'assignees': assignees,
            'dueDate': due_date,
            'priority': priority
        }
        if message:
            data['message'] = message

        return self._request('POST', f'/drafts/{draft_id}/reviews', json=data)

# 使用示例
api = PRDApiClient('http://localhost:3000/api/v1', 'your-jwt-token')

# 创建新草稿
new_draft = api.create_draft(
    title='用户权限管理系统PRD',
    template_id='template-system',
    description='设计基于角色的权限管理系统',
    initial_content='# 背景\n\n当前系统缺乏细粒度权限控制...'
)

print(f"Created draft: {new_draft['id']}")

# 更新草稿内容
api.update_draft(
    new_draft['id'],
    content='# 背景\n\n更新后的内容...\n\n## 需求分析\n\n...',
    commit_message='完善需求分析章节'
)

# 提交审核
api.submit_for_review(
    new_draft['id'],
    assignees=[
        {'userId': 'security-expert', 'role': 'architect'},
        {'userId': 'pm-lead', 'role': 'product_manager'}
    ],
    due_date='2024-02-15T18:00:00Z',
    priority='high',
    message='请重点关注安全性和合规要求'
)
```

### cURL 脚本

```bash
#!/bin/bash

# 配置
API_BASE="http://localhost:3000/api/v1"
TOKEN="your-jwt-token"

# 通用请求函数
api_request() {
    local method=$1
    local endpoint=$2
    local data=$3

    curl -s -X "$method" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        ${data:+-d "$data"} \
        "$API_BASE$endpoint"
}

# 创建新草稿
create_draft() {
    local title=$1
    local template_id=$2
    local description=$3

    local data=$(cat <<EOF
{
    "title": "$title",
    "templateId": "$template_id",
    "description": "$description"
}
EOF
)

    api_request "POST" "/drafts" "$data"
}

# 获取草稿列表
get_drafts() {
    local status=${1:-""}
    local query=""

    if [ -n "$status" ]; then
        query="?status=$status"
    fi

    api_request "GET" "/drafts$query"
}

# 提交审核
submit_review() {
    local draft_id=$1
    local due_date=$2

    local data=$(cat <<EOF
{
    "assignees": [
        {"userId": "architect-001", "role": "architect"},
        {"userId": "pm-002", "role": "product_manager"}
    ],
    "dueDate": "$due_date",
    "priority": "high",
    "message": "请审核技术方案的可行性"
}
EOF
)

    api_request "POST" "/drafts/$draft_id/reviews" "$data"
}

# 使用示例
echo "Creating new draft..."
draft=$(create_draft "API集成PRD" "template-api" "第三方服务集成方案")
draft_id=$(echo "$draft" | jq -r '.id')

echo "Draft created with ID: $draft_id"

echo "Getting all drafts..."
get_drafts | jq '.data[] | {id, title, status}'

echo "Submitting for review..."
submit_review "$draft_id" "2024-02-20T18:00:00Z"
```

## 错误处理

### 标准错误响应

所有错误响应都遵循统一格式：

```json
{
  "code": "VALIDATION_ERROR",
  "message": "请求参数验证失败",
  "details": {
    "field": "title",
    "reason": "标题长度不能超过200个字符"
  }
}
```

### 常见错误码

| HTTP状态码 | 错误码 | 说明 | 解决方案 |
|------------|--------|------|----------|
| 400 | `VALIDATION_ERROR` | 请求参数验证失败 | 检查请求参数格式和数值范围 |
| 400 | `INVALID_TEMPLATE` | 模板ID无效或不存在 | 使用`GET /templates`获取有效模板列表 |
| 401 | `UNAUTHORIZED` | 认证失败，token无效 | 重新登录获取有效token |
| 401 | `TOKEN_EXPIRED` | JWT token已过期 | 使用refresh token更新access token |
| 403 | `FORBIDDEN` | 权限不足 | 检查用户角色和资源权限 |
| 403 | `INSUFFICIENT_ROLE` | 用户角色权限不够 | 联系管理员分配适当角色 |
| 404 | `DRAFT_NOT_FOUND` | 草稿不存在 | 检查草稿ID是否正确 |
| 404 | `VERSION_NOT_FOUND` | 版本不存在 | 使用`GET /drafts/{id}/versions`查看可用版本 |
| 409 | `CONFLICT` | 资源冲突 | 获取最新版本后重试 |
| 409 | `REVIEW_IN_PROGRESS` | 审核进行中，不能修改 | 等待审核完成或撤回审核 |
| 422 | `BUSINESS_RULE_VIOLATION` | 业务规则违反 | 查看具体规则说明并调整请求 |
| 429 | `RATE_LIMIT_EXCEEDED` | 请求频率超限 | 等待后重试，实施指数退避策略 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 | 检查请求格式，如持续出现请联系技术支持 |

### 错误处理最佳实践

```typescript
// TypeScript 错误处理示例
interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

class APIException extends Error {
  public code: string;
  public details?: Record<string, any>;

  constructor(error: APIError) {
    super(error.message);
    this.code = error.code;
    this.details = error.details;
  }
}

async function handleApiCall<T>(apiCall: () => Promise<T>): Promise<T> {
  try {
    return await apiCall();
  } catch (error: any) {
    if (error.response?.status === 401) {
      // 处理认证失败
      await refreshToken();
      return await apiCall(); // 重试
    }

    if (error.response?.status === 429) {
      // 处理频率限制
      const retryAfter = error.response.headers['retry-after'] || 1;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return await apiCall(); // 重试
    }

    if (error.response?.status >= 500) {
      // 服务器错误，实施指数退避
      return await retryWithBackoff(apiCall);
    }

    throw new APIException(error.response.data);
  }
}

// 指数退避重试
async function retryWithBackoff<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
```

## 集成指南

### 1. 认证集成

```typescript
// JWT Token管理
class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.loadTokensFromStorage();
  }

  async getValidToken(): Promise<string> {
    if (this.isTokenExpired()) {
      await this.refreshAccessToken();
    }

    if (!this.accessToken) {
      throw new Error('No valid access token');
    }

    return this.accessToken;
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    return Date.now() >= this.tokenExpiry - 60000; // 提前60秒刷新
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    if (!response.ok) {
      this.clearTokens();
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    this.setTokens(data.accessToken, data.refreshToken, data.expiresIn);
  }

  private setTokens(accessToken: string, refreshToken: string, expiresIn: number): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.tokenExpiry = Date.now() + (expiresIn * 1000);
    this.saveTokensToStorage();
  }
}
```

### 2. 实时更新集成

```typescript
// WebSocket集成，用于实时更新
class PRDRealtimeClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(private token: string, private draftId: string) {}

  connect(): void {
    const wsUrl = `ws://localhost:3000/ws/drafts/${this.draftId}?token=${this.token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleRealtimeUpdate(data);
    };

    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      this.attemptReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private handleRealtimeUpdate(data: any): void {
    switch (data.type) {
      case 'CONTENT_UPDATED':
        this.onContentUpdate(data.payload);
        break;
      case 'REVIEW_STATUS_CHANGED':
        this.onReviewStatusUpdate(data.payload);
        break;
      case 'USER_JOINED':
        this.onUserJoined(data.payload);
        break;
      case 'USER_LEFT':
        this.onUserLeft(data.payload);
        break;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;

      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, delay);
    }
  }

  // 事件处理器（需要实现）
  onContentUpdate(payload: any): void {}
  onReviewStatusUpdate(payload: any): void {}
  onUserJoined(payload: any): void {}
  onUserLeft(payload: any): void {}
}
```

### 3. 批量操作

```typescript
// 批量操作辅助类
class BatchOperations {
  constructor(private apiClient: PRDApiClient) {}

  async batchUpdateDrafts(updates: Array<{
    draftId: string;
    updates: any;
  }>): Promise<any[]> {
    const results = await Promise.allSettled(
      updates.map(({ draftId, updates }) =>
        this.apiClient.updateDraft(draftId, updates)
      )
    );

    const successful = results
      .filter(result => result.status === 'fulfilled')
      .map(result => (result as PromiseFulfilledResult<any>).value);

    const failed = results
      .filter(result => result.status === 'rejected')
      .map(result => (result as PromiseRejectedResult).reason);

    if (failed.length > 0) {
      console.warn(`${failed.length} operations failed:`, failed);
    }

    return successful;
  }

  async exportDrafts(draftIds: string[]): Promise<string[]> {
    const exports = await Promise.all(
      draftIds.map(id => this.apiClient.getDraft(id))
    );

    return exports.map(draft => {
      // 转换为Markdown格式
      return this.convertToMarkdown(draft);
    });
  }

  private convertToMarkdown(draft: any): string {
    let markdown = `# ${draft.title}\n\n`;

    if (draft.description) {
      markdown += `${draft.description}\n\n`;
    }

    if (draft.sections) {
      for (const section of draft.sections) {
        const heading = '#'.repeat(section.level);
        markdown += `${heading} ${section.title}\n\n${section.content}\n\n`;
      }
    }

    return markdown;
  }
}
```

### 4. 缓存策略

```typescript
// 带缓存的API客户端
class CachedPRDApiClient extends PRDApiClient {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟

  async getDrafts(params: any = {}): Promise<any> {
    const cacheKey = `drafts:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const data = await super.getDrafts(params);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }

  async getDraft(draftId: string): Promise<any> {
    const cacheKey = `draft:${draftId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const data = await super.getDraft(draftId);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }

  // 更新操作后清除相关缓存
  async updateDraft(draftId: string, updates: any): Promise<any> {
    const result = await super.updateDraft(draftId, updates);

    // 清除相关缓存
    this.cache.delete(`draft:${draftId}`);
    for (const key of this.cache.keys()) {
      if (key.startsWith('drafts:')) {
        this.cache.delete(key);
      }
    }

    return result;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
```

## 最佳实践

### 1. 性能优化

- **使用分页**: 大列表查询时始终使用`limit`参数
- **按需加载内容**: 使用`includeContent=false`减少不必要的数据传输
- **实施客户端缓存**: 缓存不经常变化的数据如模板和用户信息
- **批量操作**: 需要多个API调用时考虑使用Promise.all()

### 2. 安全考虑

- **验证输入**: 客户端也要进行基础验证，不能完全依赖服务端
- **敏感信息处理**: 不要在日志中记录完整的JWT token
- **HTTPS**: 生产环境务必使用HTTPS
- **Token存储**: 使用安全的存储方式，避免XSS攻击

### 3. 错误处理

- **优雅降级**: API失败时提供备用方案
- **用户友好**: 将技术错误转换为用户可理解的消息
- **重试机制**: 对于临时性错误实施适当的重试策略
- **监控告警**: 集成错误监控，及时发现API问题

### 4. 开发调试

```typescript
// 调试辅助工具
class APIDebugger {
  private logs: any[] = [];

  logRequest(method: string, url: string, data?: any): void {
    this.logs.push({
      type: 'request',
      timestamp: new Date().toISOString(),
      method,
      url,
      data
    });
  }

  logResponse(url: string, status: number, data: any): void {
    this.logs.push({
      type: 'response',
      timestamp: new Date().toISOString(),
      url,
      status,
      data
    });
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  clearLogs(): void {
    this.logs = [];
  }
}

// 在API客户端中使用
const debugger = new APIDebugger();

// 请求拦截
fetch.intercept('request', (request) => {
  debugger.logRequest(request.method, request.url, request.body);
  return request;
});

// 响应拦截
fetch.intercept('response', (response) => {
  debugger.logResponse(response.url, response.status, response.data);
  return response;
});
```

### 5. 版本兼容性

```typescript
// API版本管理
class VersionedAPIClient {
  constructor(
    private baseUrl: string,
    private token: string,
    private version: string = 'v1'
  ) {}

  private getVersionedUrl(endpoint: string): string {
    return `${this.baseUrl}/${this.version}${endpoint}`;
  }

  // 支持向后兼容的方法
  async getDrafts(params: any): Promise<any> {
    if (this.version === 'v1') {
      return this.getDraftsV1(params);
    } else if (this.version === 'v2') {
      return this.getDraftsV2(params);
    }
    throw new Error(`Unsupported API version: ${this.version}`);
  }

  private async getDraftsV1(params: any): Promise<any> {
    // v1 实现
  }

  private async getDraftsV2(params: any): Promise<any> {
    // v2 实现，可能有不同的参数或返回格式
  }
}
```

---

## 支持与反馈

- **文档问题**: 如发现文档错误或缺失，请提交issue
- **API问题**: 遇到API异常请查看错误码说明
- **新功能建议**: 欢迎提交功能需求和改进建议

**更新时间**: 2024-01-15
**API版本**: v1.0.0
**文档版本**: 1.0.0