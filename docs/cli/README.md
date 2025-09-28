# PRD CLI Documentation

全面的PRD Draft Documentation System命令行工具文档

## 目录
- [快速开始](#快速开始)
- [全局选项](#全局选项)
- [命令参考](#命令参考)
- [工作流示例](#工作流示例)
- [配置管理](#配置管理)
- [错误处理](#错误处理)
- [最佳实践](#最佳实践)

---

## 快速开始

### 安装配置
```bash
# 安装PRD CLI工具
npm install -g @codex-father/prd-cli

# 初始化配置
prd config init

# 验证安装
prd --help
```

### 第一个PRD
```bash
# 创建新的PRD草稿
prd create --title "我的第一个产品需求文档" --template default

# 查看创建的草稿
prd list

# 编辑草稿内容
prd edit <draft-id>
```

---

## 全局选项

所有`prd`命令都支持以下全局选项：

| 选项 | 简写 | 类型 | 默认值 | 描述 |
|------|------|------|--------|------|
| `--config` | `-c` | string | `~/.codex-father/config.yaml` | 配置文件路径 |
| `--json` | - | boolean | false | JSON格式输出 |
| `--verbose` | `-v` | boolean | false | 详细日志输出 |
| `--help` | `-h` | boolean | - | 显示帮助信息 |

### 示例
```bash
# 使用自定义配置文件
prd --config /path/to/config.yaml list

# JSON格式输出
prd --json list

# 详细模式
prd --verbose create --title "测试PRD"
```

---

## 命令参考

### 草稿管理

#### `prd create` - 创建PRD草稿

创建新的PRD草稿文档。

**语法**
```bash
prd create [options]
```

**选项**
| 选项 | 简写 | 类型 | 必需 | 描述 | 验证 |
|------|------|------|------|------|------|
| `--title` | `-t` | string | ✓ | 草稿标题 | 1-200字符 |
| `--template` | - | string | - | 模板ID | 默认: default |
| `--description` | `-d` | string | - | 简要描述 | 最大500字符 |
| `--output` | `-o` | string | - | 输出文件路径 | - |
| `--interactive` | `-i` | boolean | - | 交互式创建模式 | 默认: false |

**示例**
```bash
# 基本创建
prd create --title "用户认证系统" --template technical

# 交互式创建
prd create -t "移动应用" -i

# 带描述的创建
prd create --title "支付系统重构" --description "优化现有支付流程，提升用户体验"

# 指定输出文件
prd create --title "API文档" --output ./api-spec.md
```

**返回值**
- **成功** (exit code: 0): 返回创建的草稿信息
- **失败** (exit code: 1): 返回错误信息

成功示例输出：
```bash
✅ PRD草稿 '用户认证系统' 创建成功 (ID: prd-auth-001)
```

---

#### `prd list` - 列出PRD草稿

显示PRD草稿列表，支持多种筛选和排序选项。

**语法**
```bash
prd list [options]
```

**选项**
| 选项 | 简写 | 类型 | 描述 | 可选值 |
|------|------|------|------|-------|
| `--status` | `-s` | string | 按状态筛选 | draft, in_review, changes_requested, approved, rejected, confirmed |
| `--author` | `-a` | string | 按作者筛选 | - |
| `--template` | - | string | 按模板筛选 | - |
| `--search` | - | string | 在标题和内容中搜索 | - |
| `--limit` | `-l` | integer | 结果数量限制 | 1-100, 默认: 20 |
| `--sort` | - | string | 排序字段 | created, updated, title, status, 默认: updated |
| `--reverse` | `-r` | boolean | 反向排序 | 默认: false |

**示例**
```bash
# 列出所有草稿状态的文档
prd list --status draft

# 查看特定作者的文档
prd list --author john --sort created

# 搜索包含"认证"的文档
prd list --search "认证"

# 显示最近更新的前10个文档
prd list --limit 10 --sort updated

# 按标题排序（Z到A）
prd list --sort title --reverse
```

**输出格式**
```
📋 PRD草稿 (15 total)

ID           Title                       Status        Author      Updated
------------ --------------------------- ------------- ----------- ----------
prd-auth-001 用户认证系统                draft         john        2025-09-28
prd-pay-002  支付系统重构                in_review     jane        2025-09-27
prd-api-003  API文档规范                 approved      mike        2025-09-26
```

---

#### `prd show` - 显示PRD详情

显示指定PRD草稿的详细信息和内容。

**语法**
```bash
prd show <draft-id> [options]
```

**参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `draft-id` | string | ✓ | 草稿ID或标题 |

**选项**
| 选项 | 简写 | 类型 | 描述 | 可选值 |
|------|------|------|------|-------|
| `--version` | `-v` | integer | 显示特定版本 | - |
| `--content` | `-c` | boolean | 包含完整内容 | 默认: true |
| `--format` | `-f` | string | 输出格式 | markdown, html, text, 默认: markdown |
| `--sections` | - | string | 显示指定章节（逗号分隔） | - |
| `--no-metadata` | - | boolean | 隐藏元数据 | 默认: false |

**示例**
```bash
# 显示草稿详情
prd show prd-auth-001

# 显示HTML格式
prd show prd-auth-001 --format html

# 显示特定版本
prd show "用户认证系统" --version 2

# 只显示特定章节
prd show prd-auth-001 --sections "overview,requirements"

# 无元数据的纯内容
prd show prd-auth-001 --no-metadata
```

---

#### `prd edit` - 编辑PRD草稿

打开编辑器修改PRD草稿内容。

**语法**
```bash
prd edit <draft-id> [options]
```

**参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `draft-id` | string | ✓ | 草稿ID或标题 |

**选项**
| 选项 | 简写 | 类型 | 描述 | 默认值 |
|------|------|------|------|-------|
| `--editor` | `-e` | string | 编辑器命令 | $EDITOR |
| `--section` | `-s` | string | 编辑特定章节 | - |
| `--message` | `-m` | string | 提交信息 | - |
| `--no-commit` | - | boolean | 不自动提交更改 | false |
| `--backup` | - | boolean | 编辑前创建备份 | true |

**示例**
```bash
# 基本编辑
prd edit prd-auth-001

# 编辑特定章节
prd edit prd-auth-001 --section overview

# 使用特定编辑器
prd edit prd-auth-001 --editor "code"

# 带提交信息的编辑
prd edit "用户认证系统" -m "更新需求描述"

# 不自动提交
prd edit prd-auth-001 --no-commit
```

---

#### `prd delete` - 删除PRD草稿

删除或归档PRD草稿。

**语法**
```bash
prd delete <draft-id> [options]
```

**参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `draft-id` | string | ✓ | 草稿ID或标题 |

**选项**
| 选项 | 简写 | 类型 | 描述 | 默认值 |
|------|------|------|------|-------|
| `--force` | `-f` | boolean | 永久删除（跳过归档） | false |
| `--confirm` | - | boolean | 跳过确认提示 | false |

**示例**
```bash
# 归档草稿（软删除）
prd delete prd-auth-001

# 永久删除且不提示
prd delete prd-auth-001 --force --confirm

# 删除时会有确认提示
prd delete "用户认证系统"
```

---

### 审查管理

#### `prd review` - 审查管理

管理PRD草稿的审查流程。

##### `prd review submit` - 提交审查

将草稿提交给指定审查者。

**语法**
```bash
prd review submit <draft-id> [options]
```

**参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `draft-id` | string | ✓ | 草稿ID或标题 |

**选项**
| 选项 | 简写 | 类型 | 描述 | 可选值 |
|------|------|------|------|-------|
| `--reviewers` | `-r` | string | 审查者用户名（逗号分隔） | 必需 |
| `--due-date` | `-d` | string | 审查截止日期（ISO 8601） | - |
| `--priority` | `-p` | string | 审查优先级 | low, medium, high, 默认: medium |
| `--message` | `-m` | string | 审查请求消息 | - |

**示例**
```bash
# 基本审查提交
prd review submit prd-auth-001 -r "john,jane"

# 带截止日期的审查
prd review submit prd-auth-001 -r "john,jane" -d "2025-10-01"

# 高优先级审查
prd review submit prd-auth-001 -r "senior-architect" -p high -m "紧急：需要架构审查"
```

##### `prd review status` - 检查审查状态

查看草稿的审查状态。

**语法**
```bash
prd review status <draft-id>
```

##### `prd review respond` - 回应审查

对审查请求给出反馈。

**语法**
```bash
prd review respond <draft-id> [options]
```

**选项**
| 选项 | 简写 | 类型 | 描述 | 可选值 |
|------|------|------|------|-------|
| `--decision` | - | string | 审查决定 | approved, rejected, changes_requested, 必需 |
| `--comments` | `-c` | string | 审查意见文件路径 | - |
| `--inline` | - | string | 内联评论文本 | - |

**示例**
```bash
# 批准审查
prd review respond prd-auth-001 --decision approved

# 请求修改
prd review respond prd-auth-001 --decision changes_requested --inline "需要增加安全性考虑"

# 从文件读取评论
prd review respond prd-auth-001 --decision rejected --comments ./review-comments.md
```

---

### 版本管理

#### `prd version` - 版本控制

管理PRD草稿的版本历史。

##### `prd version list` - 列出版本

显示草稿的所有版本。

**语法**
```bash
prd version list <draft-id>
```

##### `prd version show` - 显示特定版本

查看指定版本的内容。

**语法**
```bash
prd version show <draft-id> <version-number>
```

##### `prd version restore` - 恢复版本

将草稿恢复到指定版本。

**语法**
```bash
prd version restore <draft-id> <version-number> [options]
```

**选项**
| 选项 | 简写 | 类型 | 描述 |
|------|------|------|------|
| `--message` | `-m` | string | 恢复原因（必需） |

**示例**
```bash
# 恢复到版本2
prd version restore prd-auth-001 2 -m "回退到稳定版本"
```

##### `prd version diff` - 比较版本

比较不同版本之间的差异。

**语法**
```bash
prd version diff <draft-id> [options]
```

**选项**
| 选项 | 类型 | 描述 | 可选值 |
|------|------|------|-------|
| `--from` | integer | 起始版本（默认: 当前-1） | - |
| `--to` | integer | 目标版本（默认: 当前） | - |
| `--format` | string | 差异格式 | unified, side-by-side, json, 默认: unified |

**示例**
```bash
# 比较最近两个版本
prd version diff prd-auth-001

# 比较特定版本
prd version diff prd-auth-001 --from 1 --to 3

# 并排格式
prd version diff prd-auth-001 --format side-by-side
```

---

### 模板管理

#### `prd template` - 模板管理

管理PRD文档模板。

##### `prd template list` - 列出模板

显示所有可用模板。

**语法**
```bash
prd template list
```

##### `prd template show` - 显示模板

查看模板详情。

**语法**
```bash
prd template show <template-id>
```

##### `prd template create` - 创建模板

创建新的文档模板。

**语法**
```bash
prd template create [options]
```

**选项**
| 选项 | 简写 | 类型 | 必需 | 描述 |
|------|------|------|------|------|
| `--name` | `-n` | string | ✓ | 模板名称 |
| `--description` | `-d` | string | ✓ | 模板描述 |
| `--from` | - | string | - | 基础模板ID |
| `--file` | `-f` | string | - | 模板定义文件 |

**示例**
```bash
# 创建新模板
prd template create --name "移动应用模板" --description "移动应用产品需求模板"

# 基于现有模板创建
prd template create --name "API模板" --from technical --description "API产品需求模板"

# 从文件创建
prd template create --name "自定义模板" --file ./my-template.yaml
```

##### `prd template validate` - 验证模板

验证模板结构的正确性。

**语法**
```bash
prd template validate <template-file>
```

---

### 配置管理

#### `prd config` - 配置管理

管理CLI工具配置。

##### `prd config show` - 显示配置

查看当前配置。

**语法**
```bash
prd config show [options]
```

**选项**
| 选项 | 简写 | 类型 | 描述 |
|------|------|------|------|
| `--key` | `-k` | string | 显示特定配置项 |

**示例**
```bash
# 显示所有配置
prd config show

# 显示特定配置
prd config show --key api.base_url
```

##### `prd config set` - 设置配置

设置配置值。

**语法**
```bash
prd config set <key> <value>
```

**示例**
```bash
# 设置API基础URL
prd config set api.base_url "https://api.example.com"

# 设置默认编辑器
prd config set editor.command "code"
```

##### `prd config init` - 初始化配置

初始化配置文件。

**语法**
```bash
prd config init [options]
```

**选项**
| 选项 | 简写 | 类型 | 描述 | 默认值 |
|------|------|------|------|-------|
| `--force` | `-f` | boolean | 覆盖现有配置 | false |

---

### 导入导出

#### `prd export` - 导出PRD

将PRD草稿导出为各种格式。

**语法**
```bash
prd export <draft-id> [options]
```

**参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `draft-id` | string | ✓ | 草稿ID或标题 |

**选项**
| 选项 | 简写 | 类型 | 必需 | 描述 | 可选值 |
|------|------|------|------|------|-------|
| `--format` | `-f` | string | ✓ | 导出格式 | markdown, html, pdf, docx |
| `--output` | `-o` | string | - | 输出文件路径 | - |
| `--template` | - | string | - | 导出模板 | - |
| `--include-metadata` | - | boolean | - | 包含元数据 | 默认: true |
| `--include-history` | - | boolean | - | 包含版本历史 | 默认: false |

**示例**
```bash
# 导出为PDF
prd export prd-auth-001 --format pdf --output ./auth-system.pdf

# 导出为HTML（包含历史）
prd export prd-auth-001 --format html --include-history

# 导出为Word文档
prd export "用户认证系统" --format docx --output ./requirements.docx
```

#### `prd import` - 导入PRD

从文件导入PRD草稿。

**语法**
```bash
prd import <file> [options]
```

**参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `file` | string | ✓ | 源文件路径 |

**选项**
| 选项 | 简写 | 类型 | 描述 | 可选值 |
|------|------|------|------|-------|
| `--format` | `-f` | string | 源格式 | markdown, html, docx, auto, 默认: auto |
| `--template` | `-t` | string | 目标模板ID | - |
| `--title` | - | string | 覆盖文档标题 | - |
| `--dry-run` | - | boolean | 预览导入（不创建） | 默认: false |

**示例**
```bash
# 自动检测格式导入
prd import ./requirements.md

# 指定格式导入
prd import ./spec.docx --format docx --template technical

# 预览导入
prd import ./requirements.md --dry-run
```

---

### 搜索功能

#### `prd search` - 搜索PRD

在PRD草稿中搜索内容。

**语法**
```bash
prd search <query> [options]
```

**参数**
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| `query` | string | ✓ | 搜索查询 |

**选项**
| 选项 | 类型 | 描述 | 可选值 |
|------|------|------|-------|
| `--in` | string | 搜索范围 | title, content, all, 默认: all |
| `--status` | string | 按状态筛选 | - |
| `--author` | string | 按作者筛选 | - |
| `--limit` | integer | 结果限制 | 默认: 10 |

**示例**
```bash
# 全文搜索
prd search "用户认证"

# 只在标题中搜索
prd search "API" --in title

# 搜索特定作者的文档
prd search "支付" --author john --limit 5
```

---

## 工作流示例

### 典型开发流程

#### 1. 创建和编辑PRD
```bash
# 1. 创建新的PRD草稿
prd create --title "用户管理系统" --template technical --description "用户注册、登录、权限管理系统"

# 2. 编辑草稿内容
prd edit user-mgmt-001 --section overview

# 3. 查看编辑结果
prd show user-mgmt-001

# 4. 继续编辑其他章节
prd edit user-mgmt-001 --section requirements --message "添加功能需求"
```

#### 2. 版本管理流程
```bash
# 1. 查看版本历史
prd version list user-mgmt-001

# 2. 比较版本差异
prd version diff user-mgmt-001 --from 1 --to 2

# 3. 如需回退版本
prd version restore user-mgmt-001 1 --message "回退到初始版本"
```

#### 3. 审查流程
```bash
# 1. 提交审查
prd review submit user-mgmt-001 --reviewers "tech-lead,product-manager" --priority high --due-date "2025-10-15"

# 2. 检查审查状态
prd review status user-mgmt-001

# 3. 审查者回应（作为审查者）
prd review respond user-mgmt-001 --decision changes_requested --inline "需要增加安全性考虑和性能要求"

# 4. 修改后重新提交
prd edit user-mgmt-001 --message "根据审查意见更新安全和性能需求"
prd review submit user-mgmt-001 --reviewers "tech-lead,product-manager"
```

#### 4. 文档交付流程
```bash
# 1. 最终审查通过后导出
prd export user-mgmt-001 --format pdf --output ./deliverables/user-management-requirements.pdf

# 2. 导出HTML版本用于在线查看
prd export user-mgmt-001 --format html --output ./docs/user-management.html --include-history

# 3. 如需Word版本
prd export user-mgmt-001 --format docx --output ./deliverables/user-management.docx
```

### 团队协作场景

#### 多作者协作
```bash
# 作者A：创建初始版本
prd create --title "电商平台重构" --template product

# 作者B：基于现有文档继续编辑
prd list --search "电商"
prd edit ecommerce-001 --section "技术架构" --message "添加微服务架构设计"

# 作者C：查看最新变更
prd version diff ecommerce-001
prd show ecommerce-001 --sections "技术架构"
```

#### 项目管理场景
```bash
# 项目经理：检查所有进行中的PRD
prd list --status in_review --sort updated

# 查看特定项目的所有文档
prd list --search "电商平台"

# 导出项目文档包
for id in $(prd list --search "电商平台" --json | jq -r '.drafts[].id'); do
  prd export $id --format pdf --output "./project-docs/${id}.pdf"
done
```

### 模板管理场景

#### 创建团队模板
```bash
# 1. 基于现有文档创建模板
prd show best-practices-001 --format markdown --output ./template-base.md

# 2. 创建新模板
prd template create --name "移动应用PRD" --description "移动应用产品需求文档模板" --file ./mobile-template.yaml

# 3. 验证模板
prd template validate ./mobile-template.yaml

# 4. 使用新模板创建文档
prd create --title "iOS用户端" --template mobile-app
```

---

## 配置管理

### 配置文件位置
默认配置文件：`~/.codex-father/prd-config.yaml`

### 配置项说明

#### API配置
```yaml
api:
  base_url: "https://api.example.com"    # API基础URL
  timeout: 30                            # 请求超时时间（秒）
  retries: 3                            # 重试次数
```

#### 认证配置
```yaml
auth:
  method: "bearer"                       # 认证方法
  token: "your-api-token"               # API令牌
```

#### 编辑器配置
```yaml
editor:
  command: "code"                        # 编辑器命令
  args: ["--wait"]                      # 编辑器参数
```

#### 模板配置
```yaml
templates:
  default: "standard"                    # 默认模板
  search_paths:                         # 模板搜索路径
    - "~/.codex-father/templates"
    - "/usr/local/share/prd-templates"
```

#### 输出配置
```yaml
output:
  format: "markdown"                     # 默认输出格式
  colors: true                          # 彩色输出
  pager: true                           # 使用分页器
```

#### 行为配置
```yaml
behavior:
  auto_save: true                       # 自动保存
  backup: true                          # 创建备份
  confirm_delete: true                  # 删除确认
```

### 配置示例

#### 初始化基本配置
```bash
# 初始化配置文件
prd config init

# 设置API地址
prd config set api.base_url "https://prd-api.company.com"

# 设置认证令牌
prd config set auth.token "your-api-token-here"

# 设置默认编辑器
prd config set editor.command "vim"
```

#### 团队共享配置
```bash
# 使用团队配置文件
prd --config /shared/team-prd-config.yaml list

# 或设置环境变量
export PRD_CONFIG="/shared/team-prd-config.yaml"
prd list
```

---

## 错误处理

### 退出代码

| 代码 | 含义 | 描述 |
|------|------|------|
| 0 | 成功 | 命令执行成功 |
| 1 | 通用错误 | 未分类的错误 |
| 2 | 参数无效 | 命令行参数错误 |
| 3 | 文件未找到 | 指定文件不存在 |
| 4 | 权限拒绝 | 没有访问权限 |
| 5 | 网络错误 | 网络连接问题 |
| 6 | 认证失败 | 身份验证错误 |
| 7 | 验证错误 | 数据验证失败 |
| 8 | 冲突错误 | 资源冲突 |
| 9 | 资源未找到 | 请求的资源不存在 |
| 10 | 配置错误 | 配置文件问题 |

### 常见错误处理

#### 认证错误
```bash
# 错误：认证失败
❌ Error: Authentication failed (code: AUTH_TOKEN_INVALID)

# 解决方案
prd config set auth.token "new-valid-token"
```

#### 网络连接错误
```bash
# 错误：网络连接失败
❌ Error: Network connection failed (code: NETWORK_TIMEOUT)

# 解决方案
# 1. 检查网络连接
# 2. 增加超时时间
prd config set api.timeout 60

# 3. 检查API地址
prd config show --key api.base_url
```

#### 文件权限错误
```bash
# 错误：权限拒绝
❌ Error: Permission denied (code: PERMISSION_DENIED)

# 解决方案
# 检查文件权限
ls -la ~/.codex-father/

# 修复权限
chmod 755 ~/.codex-father/
chmod 644 ~/.codex-father/prd-config.yaml
```

### 调试技巧

#### 详细模式
```bash
# 启用详细日志
prd --verbose create --title "调试测试"

# 查看配置
prd config show

# 测试连接
prd list --limit 1
```

#### JSON输出用于脚本
```bash
# 获取结构化错误信息
result=$(prd --json list 2>&1)
if [ $? -ne 0 ]; then
  echo "错误：$(echo $result | jq -r '.error')"
  echo "代码：$(echo $result | jq -r '.code')"
fi
```

---

## 最佳实践

### 命名规范

#### 草稿标题
- **清晰描述**：使用简洁明确的标题
- **版本标识**：重大版本可在标题中体现
- **项目关联**：包含项目或模块名称

```bash
# 推荐
prd create --title "用户认证系统 - 移动端"
prd create --title "支付API v2.0 重构方案"
prd create --title "电商平台 - 订单管理模块"

# 不推荐
prd create --title "新功能"
prd create --title "API"
prd create --title "需求文档123"
```

#### 提交信息
- **简洁明确**：描述本次修改的内容
- **影响范围**：说明修改的章节或功能
- **修改原因**：简述修改原因

```bash
# 推荐
prd edit doc-001 --message "更新安全需求：添加OAuth 2.0认证"
prd edit doc-001 --message "修复：纠正API端点路径错误"
prd edit doc-001 --message "优化：简化用户注册流程描述"

# 不推荐
prd edit doc-001 --message "更新"
prd edit doc-001 --message "修改文档"
prd edit doc-001 --message "fix"
```

### 工作流建议

#### 版本控制策略
```bash
# 1. 定期创建检查点
prd edit doc-001 --message "第一阶段：完成需求分析"

# 2. 重大修改前备份
prd version list doc-001  # 查看当前版本
# 进行重大修改...

# 3. 修改后验证
prd show doc-001 --sections "requirements"
```

#### 审查流程规范
```bash
# 1. 明确审查者和截止时间
prd review submit doc-001 --reviewers "arch-team,product-team" --due-date "2025-10-15" --priority high

# 2. 提供清晰的审查说明
prd review submit doc-001 --reviewers "security-team" --message "请重点关注第3节安全需求的完整性"

# 3. 及时响应审查意见
prd review respond doc-001 --decision changes_requested --inline "建议将认证方式从Basic改为OAuth 2.0"
```

#### 文档组织管理
```bash
# 1. 使用一致的模板
prd template list  # 查看可用模板
prd create --title "新项目API" --template api-standard

# 2. 定期整理和搜索
prd list --status draft --limit 20  # 清理草稿状态文档
prd search "已废弃" --status all     # 查找需要清理的文档

# 3. 批量操作示例
for id in $(prd list --status rejected --json | jq -r '.drafts[].id'); do
  prd delete $id --confirm
done
```

### 团队协作建议

#### 权限管理
- **角色分工**：明确文档创建者、审查者、批准者角色
- **访问控制**：设置适当的读写权限
- **审查流程**：建立标准的审查和批准流程

#### 模板标准化
```bash
# 创建团队标准模板
prd template create --name "团队API标准" --description "团队API文档标准模板"

# 定期更新模板
prd template show team-api-standard
prd template validate ./updated-template.yaml
```

#### 文档质量保证
```bash
# 1. 使用标准模板
prd create --title "新功能PRD" --template team-standard

# 2. 强制审查流程
prd review submit doc-001 --reviewers "qa-lead,arch-lead" --priority medium

# 3. 定期质量检查
prd list --status approved | head -10  # 检查最近批准的文档
```

### 性能优化

#### 大型项目管理
```bash
# 1. 使用搜索而非全量列表
prd search "项目名" --limit 50

# 2. 分批处理大量文档
prd list --status draft --limit 20 --sort updated

# 3. 定期清理无用文档
prd list --status rejected --limit 100
```

#### 网络优化
```bash
# 1. 设置合理的超时时间
prd config set api.timeout 30

# 2. 使用本地缓存（如果支持）
prd config set cache.enabled true

# 3. 批量操作减少请求次数
# 使用脚本批量处理而非逐个操作
```

---

## 故障排除

### 常见问题

#### 1. 配置文件问题
**症状**：命令执行失败，提示配置错误
```bash
❌ Error: Configuration file not found
```

**解决方案**：
```bash
# 检查配置文件是否存在
ls -la ~/.codex-father/prd-config.yaml

# 重新初始化配置
prd config init --force

# 验证配置
prd config show
```

#### 2. API连接问题
**症状**：网络超时或连接失败
```bash
❌ Error: Network connection failed (timeout)
```

**解决方案**：
```bash
# 检查API地址
prd config show --key api.base_url

# 测试连接
curl -I $(prd config show --key api.base_url)

# 增加超时时间
prd config set api.timeout 60
```

#### 3. 权限问题
**症状**：操作被拒绝
```bash
❌ Error: Permission denied
```

**解决方案**：
```bash
# 检查认证状态
prd config show --key auth

# 更新认证令牌
prd config set auth.token "new-token"

# 验证权限
prd list --limit 1
```

### 获取帮助

#### 内置帮助
```bash
# 查看主命令帮助
prd --help

# 查看子命令帮助
prd create --help
prd review --help

# 查看特定子命令帮助
prd review submit --help
```

#### 调试信息
```bash
# 启用详细模式
prd --verbose list

# 获取版本信息
prd --version

# 检查配置状态
prd config show
```

---

这个CLI文档提供了完整的命令参考、实用的工作流示例和最佳实践建议，帮助用户高效使用PRD Draft Documentation System CLI工具 (´｡• ᵕ •｡`) ♡