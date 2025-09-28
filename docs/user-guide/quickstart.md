# PRD 系统快速入门

快速上手PRD Draft Documentation System，10分钟开始你的第一个产品需求文档。

## 🚀 快速导航

| 我是... | 推荐路径 | 估计时间 |
|---------|----------|----------|
| 产品经理 | [产品经理快速上手](#产品经理快速上手) | 15分钟 |
| 技术负责人 | [技术人员快速上手](#技术人员快速上手) | 10分钟 |
| 项目经理 | [项目管理快速上手](#项目管理快速上手) | 12分钟 |
| 新团队成员 | [新手完整指南](#新手完整指南) | 20分钟 |

---

## 前置准备 (2分钟)

### 系统要求
- Node.js 18+
- 网络连接
- 任意文本编辑器

### 安装工具
```bash
# 1. 安装PRD CLI工具
npm install -g @codex-father/prd-cli

# 2. 验证安装
prd --version
# 输出: prd version 1.0.0
```

### 获取访问权限
联系系统管理员获取：
- API服务地址
- 个人访问令牌
- 团队权限配置

---

## 产品经理快速上手

### 场景：为新功能创建PRD

#### 第1步：环境配置 (2分钟)
```bash
# 初始化配置
prd config init

# 设置工作环境
prd config set api.base_url "https://prd-api.yourcompany.com"
prd config set auth.token "pm_token_abc123xyz"

# 验证连接
prd list --limit 1
# 成功显示：📋 PRD草稿 (X total)
```

#### 第2步：选择合适模板 (1分钟)
```bash
# 查看所有可用模板
prd template list

# 查看产品功能模板详情
prd template show product-feature

# 输出示例：
# Template: product-feature
# Description: 产品新功能需求文档模板
# Sections: 需求背景, 目标用户, 功能描述, 验收标准, 风险评估
```

#### 第3步：创建PRD (3分钟)
```bash
# 方法1：交互式创建（推荐新手）
prd create --interactive

# 方法2：命令行直接创建
prd create --title "移动端用户头像上传功能" \
          --template product-feature \
          --description "支持用户在移动应用中上传和管理个人头像"

# 输出：
# ✅ PRD草稿 '移动端用户头像上传功能' 创建成功 (ID: mobile-avatar-001)
```

#### 第4步：内容编写 (6分钟)
```bash
# 查看PRD结构
prd show mobile-avatar-001 --sections title

# 分章节编辑内容
prd edit mobile-avatar-001 --section "需求背景" \
     --message "添加用户调研数据和业务价值分析"

prd edit mobile-avatar-001 --section "目标用户" \
     --message "定义主要用户群体和使用场景"

prd edit mobile-avatar-001 --section "功能描述" \
     --message "详细描述头像上传功能的具体实现"

# 预览编辑结果
prd show mobile-avatar-001 --format markdown
```

#### 第5步：提交审查 (3分钟)
```bash
# 自检文档质量
prd show mobile-avatar-001 --sections "功能描述,验收标准"

# 提交团队审查
prd review submit mobile-avatar-001 \
          --reviewers "tech-lead,ux-designer" \
          --due-date "2025-10-05" \
          --priority medium \
          --message "请重点关注技术可行性和用户体验设计"

# 跟踪审查状态
prd review status mobile-avatar-001
```

### 产品经理日常工作流
```bash
# 每日例行检查
echo "=== 产品经理日报 $(date +%Y-%m-%d) ==="

# 检查我的文档状态
echo "我的文档状态："
prd list --author $(whoami) --limit 10

# 检查待我审查的文档
echo "待我审查："
prd list --status in_review | grep "$(whoami)"

# 检查被要求修改的文档
echo "需要修改："
prd list --author $(whoami) --status changes_requested
```

---

## 技术人员快速上手

### 场景：技术方案设计和审查

#### 第1步：快速配置 (1分钟)
```bash
# 开发者配置
prd config init
prd config set api.base_url "$PRD_API_URL"
prd config set auth.token "$PRD_TECH_TOKEN"
prd config set editor.command "code --wait"  # 使用VS Code作为编辑器
```

#### 第2步：创建技术PRD (2分钟)
```bash
# 创建API设计文档
prd create --title "用户认证API v2.0设计" \
          --template api-specification \
          --description "升级用户认证系统，支持OAuth 2.0和JWT"

# 快速检查模板结构
prd show auth-api-v2-001 --sections title
```

#### 第3步：技术规范编写 (4分钟)
```bash
# 编辑API规范
prd edit auth-api-v2-001 --section "API端点设计"

# 添加代码示例（在编辑器中）：
# ```yaml
# POST /api/v2/auth/login
# Content-Type: application/json
#
# Request:
# {
#   "email": "user@example.com",
#   "password": "secure_password",
#   "remember_me": true
# }
#
# Response:
# {
#   "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "refresh_token": "refresh_abc123",
#   "expires_in": 3600
# }
# ```

# 添加技术约束
prd edit auth-api-v2-001 --section "技术约束" \
     --message "添加性能要求和安全规范"
```

#### 第4步：技术审查工作 (3分钟)
```bash
# 查找待审查的技术文档
prd list --status in_review | grep -E "(API|技术|架构)"

# 审查具体文档
prd show mobile-avatar-001 --sections "技术规范,架构设计"

# 提供技术审查意见
prd review respond mobile-avatar-001 \
          --decision changes_requested \
          --inline "建议使用CDN加速图片上传，考虑添加图片压缩和格式转换"
```

### 技术人员常用命令集
```bash
# 创建技术审查脚本
cat > ~/prd-tech-review.sh << 'EOF'
#!/bin/bash
# 技术审查助手

echo "=== 技术审查工具 ==="

# 1. 查找待审查文档
echo "待审查技术文档:"
prd list --status in_review --json | \
  jq -r '.drafts[] | select(.title | test("API|技术|架构|系统")) | "- " + .id + ": " + .title'

# 2. 快速技术检查
tech_check() {
  doc_id="$1"
  echo "技术检查: $doc_id"

  # 检查必需技术章节
  sections="技术架构 API设计 数据模型 性能要求 安全规范"
  for section in $sections; do
    if prd show "$doc_id" --sections "$section" >/dev/null 2>&1; then
      echo "✅ $section"
    else
      echo "❌ 缺少 $section"
    fi
  done
}

# 使用方法：tech_check <document-id>
EOF

chmod +x ~/prd-tech-review.sh
```

---

## 项目管理快速上手

### 场景：项目PRD统筹和进度跟踪

#### 第1步：项目环境准备 (2分钟)
```bash
# 项目经理配置
prd config init
prd config set api.base_url "$PRD_API_URL"
prd config set auth.token "$PRD_PM_TOKEN"
prd config set output.format "markdown"  # 便于报告生成
```

#### 第2步：项目文档创建 (3分钟)
```bash
# 创建项目总体PRD
prd create --title "电商平台移动端重构项目" \
          --template project-overview \
          --description "移动端用户体验全面升级，预计Q4完成"

# 创建功能模块PRD
modules=("用户认证" "商品浏览" "购物车" "支付流程" "个人中心")
for module in "${modules[@]}"; do
  prd create --title "移动端${module}模块重构" \
            --template mobile-feature \
            --description "${module}功能优化和重构需求"
done
```

#### 第3步：项目进度监控 (4分钟)
```bash
# 创建项目监控脚本
cat > project-status.sh << 'EOF'
#!/bin/bash
# 项目状态监控

project_name="电商平台移动端重构"

echo "# $project_name 项目状态报告"
echo "生成时间: $(date)"
echo ""

# 1. 总体进度
echo "## 总体进度"
total=$(prd search "$project_name" --json | jq '.total')
approved=$(prd search "$project_name" --status approved --json | jq '.total')
echo "- 总文档数: $total"
echo "- 已批准: $approved"
echo "- 完成率: $(echo "scale=1; $approved * 100 / $total" | bc)%"
echo ""

# 2. 模块状态
echo "## 模块状态"
modules=("用户认证" "商品浏览" "购物车" "支付流程" "个人中心")
for module in "${modules[@]}"; do
  status=$(prd search "移动端${module}模块" --json | jq -r '.drafts[0].status // "未找到"')
  echo "- $module: $status"
done
echo ""

# 3. 风险提醒
echo "## 风险提醒"
overdue=$(prd list --status in_review --json | \
  jq -r --arg date "$(date -d '3 days ago' +%Y-%m-%d)" \
  '.drafts[] | select(.updated_at < $date and (.title | contains("移动端"))) | "- " + .title')

if [ -n "$overdue" ]; then
  echo "⚠️ 超期待审查文档:"
  echo "$overdue"
else
  echo "✅ 无超期文档"
fi
EOF

chmod +x project-status.sh
./project-status.sh
```

#### 第4步：团队协调 (3分钟)
```bash
# 设置审查流程
mobile_docs=$(prd search "移动端" --status draft --json | jq -r '.drafts[].id')

for doc in $mobile_docs; do
  echo "设置审查: $doc"
  prd review submit "$doc" \
            --reviewers "mobile-tech-lead,ios-lead,android-lead,ux-designer" \
            --due-date "$(date -d '+5 days' +%Y-%m-%d)" \
            --priority medium \
            --message "移动端重构项目技术审查"
done

# 生成团队工作分配报告
{
  echo "# 团队工作分配"
  echo ""
  for role in mobile-tech-lead ios-lead android-lead ux-designer; do
    echo "## $role"
    prd list --json | jq -r --arg role "$role" \
      '.drafts[] | select(.reviewer == $role) | "- " + .title + " (" + .status + ")"'
    echo ""
  done
} > team-assignments.md
```

---

## 新手完整指南

### 第一次使用：从零到发布PRD

#### 阶段1：环境准备 (5分钟)

**获取访问权限**
1. 联系系统管理员获取API地址和访问令牌
2. 确认你的角色权限（创建者/审查者/管理员）
3. 了解团队的文档规范和流程

**安装和配置**
```bash
# 步骤1：安装工具
npm install -g @codex-father/prd-cli
prd --version

# 步骤2：初始配置
prd config init

# 步骤3：设置连接信息
prd config set api.base_url "https://prd-api.yourcompany.com"
prd config set auth.token "your_personal_token_here"

# 步骤4：验证连接
prd list --limit 1
# 如果成功，会显示文档列表或空列表
```

#### 阶段2：了解系统 (3分钟)

**探索现有文档**
```bash
# 查看所有文档
prd list --limit 20

# 查看已批准的优质文档
prd list --status approved --limit 5

# 查看一个示例文档
prd show <某个文档ID> --format markdown
```

**了解模板系统**
```bash
# 查看所有模板
prd template list

# 查看模板详情
prd template show default
prd template show product-feature

# 了解模板结构
prd template show technical --sections
```

#### 阶段3：创建第一个PRD (7分钟)

**选择适合的模板**
```bash
# 如果是产品功能需求
prd template show product-feature

# 如果是技术设计文档
prd template show technical

# 如果是API规范
prd template show api-specification
```

**交互式创建（推荐新手）**
```bash
prd create --interactive

# 系统会引导你：
# 1. 输入标题
# 2. 选择模板
# 3. 输入描述
# 4. 确认创建
```

**编写内容**
```bash
# 假设创建的文档ID是 my-first-prd-001

# 查看文档结构
prd show my-first-prd-001 --sections title

# 编辑第一个章节
prd edit my-first-prd-001 --section "需求背景"

# 在编辑器中添加内容：
# ## 需求背景
#
# ### 问题描述
# 目前用户反馈登录流程复杂，登录成功率只有85%...
#
# ### 业务价值
# 通过优化登录流程，预期可以：
# - 提升用户体验满意度
# - 减少客服工单数量
# - 提高新用户注册转化率

# 继续编辑其他章节
prd edit my-first-prd-001 --section "功能描述" \
     --message "添加具体功能需求和用户故事"
```

#### 阶段4：版本管理实践 (2分钟)

**查看版本历史**
```bash
# 查看所有版本
prd version list my-first-prd-001

# 比较版本差异
prd version diff my-first-prd-001 --from 1 --to 2
```

**创建稳定版本**
```bash
# 在重要节点创建标记版本
prd edit my-first-prd-001 --message "第一阶段：完成需求分析和功能设计"
```

#### 阶段5：提交审查 (3分钟)

**准备提交**
```bash
# 最终检查
prd show my-first-prd-001 --format markdown > review-check.md

# 自检清单（手动检查review-check.md）：
# - 需求背景是否清晰？
# - 功能描述是否详细？
# - 验收标准是否明确？
# - 技术约束是否考虑？
```

**提交审查**
```bash
# 提交给相关审查者
prd review submit my-first-prd-001 \
          --reviewers "your-team-lead,senior-colleague" \
          --due-date "$(date -d '+3 days' +%Y-%m-%d)" \
          --priority medium \
          --message "我的第一个PRD，请多指教"
```

### 新手常见问题和解决

#### 问题1：编辑器相关
```bash
# 如果默认编辑器不适合
prd config set editor.command "nano"        # 使用nano
prd config set editor.command "vim"         # 使用vim
prd config set editor.command "code --wait" # 使用VS Code

# 如果编辑器无法保存
prd edit my-first-prd-001 --no-commit       # 先编辑不提交
# 手动编辑后再提交
prd edit my-first-prd-001 --message "手动修改内容"
```

#### 问题2：权限相关
```bash
# 如果无法创建文档
prd config show --key auth.token           # 检查令牌
prd config show --key api.base_url         # 检查API地址

# 如果无法提交审查
prd list --author $(whoami)                # 确认是文档创建者
```

#### 问题3：内容格式
```bash
# 如果不熟悉Markdown语法
prd show approved-doc-example --format markdown > markdown-example.md
# 参考已批准文档的格式

# 快速Markdown参考：
echo "# Markdown快速参考
## 二级标题
### 三级标题

**粗体文本**
*斜体文本*

- 无序列表项1
- 无序列表项2

1. 有序列表项1
2. 有序列表项2

\`代码片段\`

\`\`\`bash
# 代码块
prd list
\`\`\`

[链接文本](URL)" > markdown-cheatsheet.md
```

---

## 快速参考卡片

### 最常用命令
```bash
# 文档操作
prd create --title "标题" --template 模板名
prd list --status 状态
prd show 文档ID
prd edit 文档ID
prd delete 文档ID

# 审查流程
prd review submit 文档ID --reviewers "审查者"
prd review status 文档ID
prd review respond 文档ID --decision 决定

# 版本控制
prd version list 文档ID
prd version diff 文档ID
prd version restore 文档ID 版本号 --message "原因"

# 导入导出
prd export 文档ID --format 格式 --output 文件名
prd import 文件名 --format 格式

# 配置管理
prd config show
prd config set 配置项 值
```

### 状态流转图
```
draft (草稿)
    ↓ [提交审查]
in_review (审查中)
    ↓ [审查完成]
┌── approved (已批准)
├── rejected (已拒绝)
└── changes_requested (要求修改)
    ↓ [修改后重新提交]
in_review (重新审查)
```

### 角色权限表
| 操作 | 创建者 | 协作者 | 审查者 | 管理员 |
|------|--------|--------|--------|--------|
| 创建文档 | ✅ | ✅ | ✅ | ✅ |
| 编辑自己的文档 | ✅ | ❌ | ❌ | ✅ |
| 编辑他人文档 | ❌ | ✅* | ❌ | ✅ |
| 提交审查 | ✅ | ✅* | ❌ | ✅ |
| 审查文档 | ❌ | ❌ | ✅ | ✅ |
| 删除文档 | ✅ | ❌ | ❌ | ✅ |

*需要被授权

---

## 下一步学习

恭喜！你已经掌握了PRD系统的基础用法。接下来可以：

1. **深入学习**: 阅读[完整用户指南](./README.md)了解高级功能
2. **命令参考**: 查看[CLI文档](../cli/README.md)学习所有命令
3. **最佳实践**: 参考[工作流示例](../cli/workflows.md)学习团队协作
4. **故障排除**: 遇到问题时查看[故障排除指南](./troubleshooting.md)

## 获取帮助

- **命令行帮助**: `prd --help` 或 `prd <命令> --help`
- **团队支持**: 联系你的团队lead或系统管理员
- **技术支持**: 发送邮件到 prd-support@yourcompany.com

祝你使用愉快！🎉