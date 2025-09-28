# PRD 系统用户指南

PRD Draft Documentation System 全面用户指南，从快速入门到高级用法。

## 目录
- [快速开始](#快速开始)
- [核心概念](#核心概念)
- [基础用法](#基础用法)
- [高级功能](#高级功能)
- [团队协作](#团队协作)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)
- [进阶指南](#进阶指南)

---

## 快速开始

### 5分钟快速体验

#### 1. 系统安装
```bash
# 安装CLI工具
npm install -g @codex-father/prd-cli

# 验证安装
prd --version
```

#### 2. 初始配置
```bash
# 初始化配置（仅需一次）
prd config init

# 设置API连接
prd config set api.base_url "https://your-prd-api.com"
prd config set auth.token "your-api-token"

# 验证连接
prd list --limit 1
```

#### 3. 创建第一个PRD
```bash
# 查看可用模板
prd template list

# 创建新PRD（使用默认模板）
prd create --title "我的第一个产品需求文档" \
          --description "学习PRD系统的示例文档"

# 输出示例：
# ✅ PRD草稿 '我的第一个产品需求文档' 创建成功 (ID: my-first-prd-001)
```

#### 4. 编辑和预览
```bash
# 编辑PRD内容
prd edit my-first-prd-001

# 预览编辑结果
prd show my-first-prd-001

# 导出为PDF查看
prd export my-first-prd-001 --format pdf --output "./我的第一个PRD.pdf"
```

### 常见第一次使用场景

#### 场景A：从零开始创建PRD
适合：产品经理为新功能创建PRD
```bash
# 1. 选择合适的模板
prd template show product-feature  # 查看模板内容

# 2. 交互式创建（推荐新手）
prd create --title "用户登录功能优化" --interactive

# 3. 按模板结构编辑
prd edit user-login-opt-001 --section "需求背景"
prd edit user-login-opt-001 --section "功能描述"
prd edit user-login-opt-001 --section "验收标准"
```

#### 场景B：导入现有文档
适合：将Word/Markdown文档迁移到PRD系统
```bash
# 1. 导入现有文档
prd import "./现有需求文档.docx" \
         --format docx \
         --title "支付系统重构需求"

# 2. 检查和修正导入结果
prd show payment-system-001 --format markdown

# 3. 应用标准模板优化结构
prd edit payment-system-001 --message "应用标准模板优化文档结构"
```

#### 场景C：团队协作准备
适合：团队lead设置协作环境
```bash
# 1. 创建项目主PRD
prd create --title "移动应用2.0项目总体需求" \
          --template project-overview

# 2. 设置团队审查流程
prd review submit mobile-app-v2-001 \
          --reviewers "tech-lead,ux-designer,qa-lead" \
          --due-date "2025-10-15"

# 3. 通知团队成员
echo "项目PRD已创建: mobile-app-v2-001" | mail -s "项目启动" team@company.com
```

---

## 核心概念

### PRD文档生命周期

```
创建 → 编辑 → 审查 → 修改 → 批准 → 实施 → 归档
 ↓      ↓      ↓      ↓      ↓      ↓      ↓
draft  draft  review changes approved confirmed archived
```

#### 状态说明
- **draft**: 草稿状态，可自由编辑
- **in_review**: 审查中，等待审查者反馈
- **changes_requested**: 审查者要求修改
- **approved**: 已批准，准备实施
- **rejected**: 被拒绝，需要重新评估
- **confirmed**: 已确认实施，最终状态

### 文档结构层次

```
PRD文档
├── 元数据 (标题、作者、状态、时间等)
├── 版本历史 (每次修改的记录)
├── 内容章节
│   ├── 需求概述
│   ├── 目标用户
│   ├── 功能描述
│   ├── 技术规范
│   ├── 验收标准
│   └── 风险评估
└── 审查记录 (审查者意见和决定)
```

### 模板系统

PRD系统提供多种预定义模板：

- **default**: 通用产品需求模板
- **technical**: 技术功能需求模板
- **mobile-feature**: 移动端功能模板
- **api-specification**: API规范模板
- **product-launch**: 产品发布模板
- **enterprise-system**: 企业系统模板

### 权限和角色

- **创建者**: 创建和编辑自己的PRD
- **协作者**: 受邀编辑特定PRD章节
- **审查者**: 对PRD进行评审和批准
- **管理员**: 管理整个系统和用户权限

---

## 基础用法

### 文档管理基础

#### 创建文档
```bash
# 基础创建
prd create --title "功能需求标题"

# 指定模板创建
prd create --title "移动端新功能" --template mobile-feature

# 带描述创建
prd create --title "支付功能" \
          --description "第三方支付集成需求" \
          --template payment-system

# 交互式创建（新手推荐）
prd create --interactive
```

#### 查看和搜索
```bash
# 列出所有文档
prd list

# 按状态筛选
prd list --status draft
prd list --status approved

# 按作者筛选
prd list --author $(whoami)
prd list --author alice

# 搜索功能
prd search "用户认证"
prd search "支付" --in title
prd search "API" --status approved

# 查看文档详情
prd show doc-001
prd show "用户认证功能" --format html
```

#### 编辑文档
```bash
# 全文档编辑
prd edit doc-001

# 编辑特定章节
prd edit doc-001 --section "需求描述"

# 使用特定编辑器
prd edit doc-001 --editor "code"

# 带提交信息
prd edit doc-001 --message "更新验收标准"
```

### 版本控制基础

#### 查看版本历史
```bash
# 列出所有版本
prd version list doc-001

# 查看特定版本
prd version show doc-001 2

# 比较版本差异
prd version diff doc-001
prd version diff doc-001 --from 1 --to 3
```

#### 版本恢复
```bash
# 恢复到特定版本
prd version restore doc-001 2 --message "回退到稳定版本"

# 创建基于历史版本的新分支
prd version show doc-001 2 --format markdown > temp.md
prd import temp.md --title "用户认证功能-v2分支"
```

### 导入导出基础

#### 导出功能
```bash
# 导出为不同格式
prd export doc-001 --format pdf --output "需求文档.pdf"
prd export doc-001 --format html --output "需求文档.html"
prd export doc-001 --format markdown --output "需求文档.md"

# 导出时控制内容
prd export doc-001 --format pdf \
          --include-metadata \
          --include-history \
          --output "完整需求文档.pdf"

# 导出特定章节
prd export doc-001 --format html \
          --sections "需求概述,功能描述"
```

#### 导入功能
```bash
# 导入不同格式文档
prd import "需求.md" --format markdown
prd import "需求.docx" --format docx
prd import "需求.html" --format html

# 指定目标模板
prd import "API需求.md" --template api-specification

# 预览导入结果
prd import "需求.md" --dry-run
```

---

## 高级功能

### 复杂审查流程

#### 多级审查设置
```bash
# 第一级：技术审查
prd review submit doc-001 \
          --reviewers "tech-lead,senior-dev" \
          --priority high \
          --message "请重点关注技术可行性"

# 等待第一级审查完成后，第二级：产品审查
prd review submit doc-001 \
          --reviewers "product-director,ux-lead" \
          --message "技术审查已通过，请进行产品策略审查"

# 最终级：决策层审查
prd review submit doc-001 \
          --reviewers "cto,cpo" \
          --priority high \
          --due-date "2025-10-01" \
          --message "最终决策审查"
```

#### 审查意见管理
```bash
# 查看详细审查状态
prd review status doc-001

# 审查者提供详细反馈
prd review respond doc-001 \
          --decision changes_requested \
          --comments "./detailed-review-comments.md"

# 内联快速反馈
prd review respond doc-001 \
          --decision approved \
          --inline "技术方案可行，建议优化第3节的性能指标"
```

### 高级版本管理

#### 分支式版本管理
```bash
# 创建功能分支
prd version show doc-001 3 --format markdown > feature-branch.md
prd import feature-branch.md --title "用户认证功能-安全增强分支"

# 并行开发多个版本
prd create --title "支付功能-简化版" --template payment-simple
prd create --title "支付功能-企业版" --template payment-enterprise

# 版本合并（手动合并内容后）
prd edit doc-001 --message "合并安全增强分支的改进"
```

#### 复杂版本比较
```bash
# 跨文档版本比较
prd export doc-001 --format markdown --output v1.md
prd export doc-002 --format markdown --output v2.md
diff -u v1.md v2.md

# 自定义diff格式
prd version diff doc-001 --format json > version-diff.json
prd version diff doc-001 --format side-by-side > readable-diff.txt
```

### 批量操作和自动化

#### 批量文档处理
```bash
#!/bin/bash
# 批量更新脚本示例

# 查找需要更新的文档
docs_to_update=$(prd search "旧版API" --status approved --json | jq -r '.drafts[].id')

# 批量处理
for doc in $docs_to_update; do
  echo "更新文档: $doc"

  # 备份当前版本
  prd export $doc --format markdown --output "backup-${doc}.md"

  # 应用更新（这里是示例，实际需要具体的更新逻辑）
  prd edit $doc --message "更新API版本引用"

  # 验证更新结果
  if prd show $doc | grep -q "新版API"; then
    echo "✅ $doc 更新成功"
  else
    echo "❌ $doc 更新可能失败，请手动检查"
  fi
done
```

#### 定期维护自动化
```bash
#!/bin/bash
# 定期维护脚本

# 1. 清理长期草稿
echo "清理超过30天的草稿..."
old_drafts=$(prd list --status draft --json | \
  jq -r --arg date "$(date -d '30 days ago' +%Y-%m-%d)" \
  '.drafts[] | select(.updated_at < $date) | .id')

for draft in $old_drafts; do
  echo "发现旧草稿: $draft"
  # 导出备份
  prd export $draft --format markdown --output "archive/old-draft-${draft}.md"
  # 可选：自动删除或标记
done

# 2. 检查待审查文档
echo "检查超期待审查文档..."
overdue=$(prd list --status in_review --json | \
  jq -r --arg date "$(date -d '7 days ago' +%Y-%m-%d)" \
  '.drafts[] | select(.updated_at < $date) | .id')

for doc in $overdue; do
  echo "⚠️  超期待审查: $doc"
  # 发送提醒邮件或通知
done

# 3. 生成状态报告
{
  echo "# PRD系统状态报告 - $(date)"
  echo ""
  echo "## 文档统计"
  echo "- 总文档数: $(prd list --json | jq '.total')"
  echo "- 草稿数: $(prd list --status draft --json | jq '.total')"
  echo "- 待审查数: $(prd list --status in_review --json | jq '.total')"
  echo "- 已批准数: $(prd list --status approved --json | jq '.total')"
} > "status-report-$(date +%Y%m%d).md"
```

### 高级搜索和分析

#### 复杂搜索查询
```bash
# 多条件组合搜索
prd search "用户体验" --status approved --author "ux-team"

# 时间范围搜索（通过JSON处理）
prd list --json | jq -r --arg start "2025-09-01" --arg end "2025-09-30" \
  '.drafts[] | select(.updated_at >= $start and .updated_at <= $end) | .id'

# 内容深度分析
prd search "性能" --in content | while read doc; do
  echo "=== $doc 中的性能相关内容 ==="
  prd show $doc --format text | grep -i "性能" -A 2 -B 2
done
```

#### 数据分析和报告
```bash
# 作者效率分析
{
  echo "# 作者效率分析"
  echo "| 作者 | 文档总数 | 草稿数 | 已批准数 | 效率比 |"
  echo "|------|----------|--------|----------|--------|"

  prd list --json | jq -r '.drafts[].author' | sort | uniq | while read author; do
    total=$(prd list --author "$author" --json | jq '.total')
    approved=$(prd list --author "$author" --status approved --json | jq '.total')
    efficiency=$(echo "scale=2; $approved * 100 / $total" | bc -l 2>/dev/null || echo "0")
    echo "| $author | $total | $(prd list --author "$author" --status draft --json | jq '.total') | $approved | ${efficiency}% |"
  done
} > author-efficiency-report.md

# 模板使用统计
{
  echo "# 模板使用统计"
  echo ""
  prd list --json | jq -r '.drafts[].template // "无模板"' | \
    sort | uniq -c | sort -nr | \
    awk '{print "- " $2 ": " $1 " 个文档"}'
} > template-usage-stats.md
```

---

## 团队协作

### 团队角色和职责

#### 产品经理（Product Manager）
**主要职责**：PRD创建、需求定义、优先级管理

**日常工作流程**：
```bash
# 1. 每日检查待处理需求
prd list --author $(whoami) --status draft

# 2. 创建新需求PRD
prd create --title "用户反馈系统" \
          --template user-feedback \
          --description "基于用户调研的反馈收集系统"

# 3. 跟踪审查进度
prd list --status in_review --search "$(whoami)"

# 4. 处理审查反馈
prd review status user-feedback-001
prd edit user-feedback-001 --message "根据技术团队反馈调整架构方案"
```

#### 技术负责人（Tech Lead）
**主要职责**：技术可行性审查、架构建议、技术规范定义

**审查工作流程**：
```bash
# 1. 查看待审查的技术PRD
prd list --status in_review | grep -E "(API|技术|架构)"

# 2. 深度审查技术方案
prd show api-redesign-001 --sections "技术规范,架构设计"

# 3. 提供技术审查意见
prd review respond api-redesign-001 \
          --decision changes_requested \
          --comments "./tech-review-api-redesign.md"

# 4. 跟踪修改实施
prd version diff api-redesign-001 --from 2 --to 3
```

#### UX设计师（UX Designer）
**主要职责**：用户体验审查、交互设计需求、可用性评估

**设计审查流程**：
```bash
# 1. 筛选UX相关PRD
prd search "用户体验" --status in_review

# 2. 审查用户流程设计
prd show mobile-checkout-001 --sections "用户旅程,界面设计"

# 3. 提供UX改进建议
prd review respond mobile-checkout-001 \
          --decision changes_requested \
          --inline "建议简化支付流程，减少步骤从5步到3步"

# 4. 验证UX改进效果
prd show mobile-checkout-001 --version 2 --sections "用户旅程"
```

### 团队协作最佳实践

#### 建立团队工作规范
```bash
# 1. 统一配置模板
echo "团队配置模板setup.sh:"
cat > team-setup.sh << 'EOF'
#!/bin/bash
# 团队PRD工具配置

# 设置团队API地址
prd config set api.base_url "https://prd.company.com"

# 设置默认模板
prd config set templates.default "company-standard"

# 设置编辑器
prd config set editor.command "code --wait"

# 设置输出格式偏好
prd config set output.format "markdown"
prd config set output.colors true

echo "团队配置完成！"
EOF

# 2. 创建团队模板
prd template create --name "company-standard" \
                   --description "公司标准PRD模板" \
                   --file "./templates/company-standard.yaml"
```

#### 建立审查流程规范
```bash
# 团队审查流程脚本
cat > review-workflow.sh << 'EOF'
#!/bin/bash
# 标准审查流程

doc_id="$1"
if [ -z "$doc_id" ]; then
  echo "用法: $0 <文档ID>"
  exit 1
fi

echo "开始标准审查流程: $doc_id"

# 第一阶段：同行审查
echo "第一阶段：同行审查"
prd review submit "$doc_id" \
  --reviewers "peer-reviewer-1,peer-reviewer-2" \
  --priority medium \
  --message "同行审查：请检查需求完整性和逻辑性"

# 等待同行审查完成（实际使用中可能需要手动触发下一阶段）
echo "等待同行审查完成..."
echo "完成后请运行: review-workflow-stage2.sh $doc_id"
EOF

cat > review-workflow-stage2.sh << 'EOF'
#!/bin/bash
# 审查流程第二阶段

doc_id="$1"
echo "第二阶段：专家审查"
prd review submit "$doc_id" \
  --reviewers "tech-lead,ux-lead,qa-lead" \
  --priority high \
  --due-date "$(date -d '+5 days' '+%Y-%m-%d')" \
  --message "专家审查：技术可行性、用户体验和质量保证"
EOF
```

#### 冲突解决机制
```bash
# 冲突检测和解决工具
cat > conflict-resolution.sh << 'EOF'
#!/bin/bash
# PRD冲突检测和解决

doc_id="$1"

echo "检查 $doc_id 的潜在冲突..."

# 1. 检查并发编辑
current_version=$(prd show "$doc_id" --json | jq -r '.version')
echo "当前版本: $current_version"

recent_changes=$(prd version list "$doc_id" --json | \
  jq -r --arg today "$(date '+%Y-%m-%d')" \
  '.versions[] | select(.date >= $today) | .version')

if [ $(echo "$recent_changes" | wc -l) -gt 1 ]; then
  echo "⚠️  发现今日多次更新，可能存在并发编辑"
  echo "今日版本: $recent_changes"

  # 显示版本差异
  for version in $recent_changes; do
    if [ "$version" != "$current_version" ]; then
      echo "=== 版本 $version vs $current_version 差异 ==="
      prd version diff "$doc_id" --from "$version" --to "$current_version"
    fi
  done
fi

# 2. 检查审查冲突
review_status=$(prd review status "$doc_id" --json)
conflicting_decisions=$(echo "$review_status" | jq -r '.reviews[] | select(.decision == "changes_requested") | .reviewer')

if [ -n "$conflicting_decisions" ]; then
  echo "⚠️  发现冲突的审查意见："
  echo "$conflicting_decisions"
  echo ""
  echo "建议：召开协调会议解决分歧"
fi
EOF
```

### 分布式团队协作

#### 时区友好的异步协作
```bash
# 全球团队协作工具
cat > global-team-workflow.sh << 'EOF'
#!/bin/bash
# 跨时区团队协作

# 1. 创建时区友好的审查计划
create_timezone_friendly_review() {
  doc_id="$1"

  # 美国时区审查者（周一开始）
  prd review submit "$doc_id" \
    --reviewers "us-tech-lead,us-product-manager" \
    --due-date "$(date -d 'next Monday +2 days' '+%Y-%m-%d')" \
    --message "美国团队审查窗口"

  # 欧洲时区审查者（美国审查后）
  prd review submit "$doc_id" \
    --reviewers "eu-ux-lead,eu-qa-lead" \
    --due-date "$(date -d 'next Wednesday +2 days' '+%Y-%m-%d')" \
    --message "欧洲团队审查窗口"

  # 亚洲时区审查者（欧洲审查后）
  prd review submit "$doc_id" \
    --reviewers "asia-arch-lead,asia-dev-lead" \
    --due-date "$(date -d 'next Friday +2 days' '+%Y-%m-%d')" \
    --message "亚洲团队审查窗口"
}

# 2. 每日状态同步报告
generate_daily_sync() {
  {
    echo "# 全球团队日报 - $(date '+%Y-%m-%d')"
    echo ""
    echo "## 美洲团队更新"
    prd list --author "*us*" --json | jq -r '.drafts[] | select(.updated_at >= "'$(date -d '1 day ago' '+%Y-%m-%d')'") | "- " + .title + " (" + .status + ")"'

    echo ""
    echo "## 欧洲团队更新"
    prd list --author "*eu*" --json | jq -r '.drafts[] | select(.updated_at >= "'$(date -d '1 day ago' '+%Y-%m-%d')'") | "- " + .title + " (" + .status + ")"'

    echo ""
    echo "## 亚洲团队更新"
    prd list --author "*asia*" --json | jq -r '.drafts[] | select(.updated_at >= "'$(date -d '1 day ago' '+%Y-%m-%d')'") | "- " + .title + " (" + .status + ")"'
  } > "daily-sync-$(date '+%Y%m%d').md"
}

# 3. 交接文档自动生成
create_handoff_doc() {
  outgoing_team="$1"  # us, eu, asia

  {
    echo "# ${outgoing_team^^} 团队交接文档 - $(date '+%Y-%m-%d %H:%M %Z')"
    echo ""
    echo "## 今日完成工作"
    prd list --author "*${outgoing_team}*" --json | \
      jq -r '.drafts[] | select(.updated_at >= "'$(date '+%Y-%m-%d')'") | "- " + .title + ": " + .status'

    echo ""
    echo "## 待下一团队处理"
    prd list --status in_review --json | \
      jq -r '.drafts[] | select(.reviewer | contains("'${outgoing_team}'") | not) | "- " + .title + " (等待: " + .reviewer + ")"'

    echo ""
    echo "## 阻塞问题"
    prd list --status changes_requested --json | \
      jq -r '.drafts[] | select(.author | contains("'${outgoing_team}'")) | "- " + .title + ": 需要修改"'
  } > "handoff-${outgoing_team}-$(date '+%Y%m%d_%H%M').md"
}
EOF
```

---

## 最佳实践

### PRD写作最佳实践

#### 1. 结构化写作方法

**STAR原则** (Situation, Task, Action, Result)
```markdown
# PRD标题：用户认证系统优化

## 背景情况 (Situation)
当前用户登录成功率只有85%，用户反馈登录流程复杂，
技术指标显示40%的登录失败来自密码找回环节。

## 任务目标 (Task)
- 提升登录成功率到95%+
- 简化用户认证流程
- 降低客服关于登录问题的工单数量

## 解决方案 (Action)
1. 实施社交媒体登录集成
2. 优化密码找回流程
3. 添加生物识别认证选项
4. 改进错误提示和用户引导

## 预期结果 (Result)
- 登录成功率提升到95%
- 用户满意度提升20%
- 客服工单减少50%
- 新用户注册转化率提升15%
```

#### 2. 需求优先级框架

**MoSCoW方法**
```markdown
## 功能需求优先级

### Must Have (必须有)
- [ ] 邮箱密码登录
- [ ] 密码重置功能
- [ ] 基本安全验证

### Should Have (应该有)
- [ ] 社交媒体登录
- [ ] 记住登录状态
- [ ] 双因素认证

### Could Have (可以有)
- [ ] 生物识别登录
- [ ] 单点登录集成
- [ ] 高级安全选项

### Won't Have (暂不实现)
- [ ] 企业域认证集成
- [ ] 硬件密钥支持
```

#### 3. 用户故事编写规范

**标准格式**
```markdown
## 用户故事

### 故事1：快速登录
**作为** 移动端用户
**我希望** 能够使用指纹快速登录
**以便** 避免每次都输入复杂密码

**验收标准：**
- [ ] 支持主流生物识别方式（指纹、面部）
- [ ] 生物识别失败时可回退到密码登录
- [ ] 首次设置流程不超过3步
- [ ] 生物识别响应时间<2秒

### 故事2：安全找回
**作为** 忘记密码的用户
**我希望** 能够安全便捷地重置密码
**以便** 快速恢复账户访问权限

**验收标准：**
- [ ] 支持邮箱和手机号验证
- [ ] 验证码有效期15分钟
- [ ] 密码强度实时检查
- [ ] 重置后强制重新登录所有设备
```

#### 4. 技术规范写作

**API设计规范**
```markdown
## API技术规范

### 认证端点
```yaml
POST /api/v1/auth/login
Content-Type: application/json

Request:
{
  "email": "string",
  "password": "string",
  "remember_me": "boolean"
}

Response:
{
  "access_token": "string",
  "refresh_token": "string",
  "expires_in": "number",
  "user": {
    "id": "string",
    "email": "string",
    "role": "string"
  }
}
```

### 错误处理
- 400: 请求参数错误
- 401: 认证失败
- 429: 请求频率限制
- 500: 服务器内部错误

### 安全要求
- 密码最少8位，包含大小写字母和数字
- 登录失败5次锁定账户30分钟
- JWT token有效期2小时
- 支持refresh token自动续期
```

### 质量保证最佳实践

#### 1. PRD自检清单

```markdown
## PRD质量自检清单

### 内容完整性 ✓
- [ ] 需求背景清晰描述
- [ ] 目标用户明确定义
- [ ] 功能描述详细具体
- [ ] 验收标准可测量
- [ ] 技术约束明确说明
- [ ] 时间计划合理可行

### 逻辑一致性 ✓
- [ ] 功能之间无冲突
- [ ] 优先级设置合理
- [ ] 依赖关系清晰
- [ ] 风险评估充分

### 可执行性 ✓
- [ ] 技术实现可行
- [ ] 资源需求明确
- [ ] 时间计划现实
- [ ] 成功标准可衡量
```

#### 2. 审查者指南

**技术审查关注点**
```bash
# 技术审查脚本模板
tech_review_checklist() {
  doc_id="$1"

  echo "=== 技术审查清单: $doc_id ==="

  # 检查技术章节完整性
  sections="架构设计,API规范,数据模型,性能要求,安全规范"
  for section in $(echo $sections | tr ',' ' '); do
    if prd show "$doc_id" --sections "$section" >/dev/null 2>&1; then
      echo "✅ $section 章节存在"
    else
      echo "❌ 缺少 $section 章节"
    fi
  done

  # 检查技术关键词
  keywords="性能,安全,扩展性,可维护性,兼容性"
  for keyword in $(echo $keywords | tr ',' ' '); do
    if prd show "$doc_id" --format text | grep -q "$keyword"; then
      echo "✅ 包含 $keyword 考虑"
    else
      echo "⚠️  可能缺少 $keyword 相关描述"
    fi
  done
}
```

**产品审查关注点**
```bash
# 产品审查脚本模板
product_review_checklist() {
  doc_id="$1"

  echo "=== 产品审查清单: $doc_id ==="

  # 检查商业价值
  if prd show "$doc_id" --format text | grep -i "roi\|价值\|收益"; then
    echo "✅ 包含商业价值分析"
  else
    echo "❌ 缺少商业价值分析"
  fi

  # 检查用户研究
  if prd show "$doc_id" --format text | grep -i "用户调研\|用户反馈\|市场分析"; then
    echo "✅ 基于用户研究"
  else
    echo "⚠️  建议补充用户研究依据"
  fi

  # 检查竞品分析
  if prd show "$doc_id" --format text | grep -i "竞品\|竞争对手\|市场对比"; then
    echo "✅ 包含竞品分析"
  else
    echo "⚠️  建议补充竞品分析"
  fi
}
```

### 团队效率最佳实践

#### 1. 模板标准化策略

```bash
# 团队模板管理脚本
manage_team_templates() {
  echo "=== 团队模板标准化 ==="

  # 1. 检查模板使用情况
  echo "当前模板使用统计："
  prd list --json | jq -r '.drafts[].template // "无模板"' | \
    sort | uniq -c | sort -nr

  # 2. 推广标准模板
  echo ""
  echo "推广标准模板使用："
  non_standard=$(prd list --json | \
    jq -r '.drafts[] | select(.template == null or .template == "custom") | .id')

  for doc in $non_standard; do
    echo "建议为 $doc 应用标准模板"
    # 可以添加自动应用逻辑
  done

  # 3. 模板质量检查
  echo ""
  echo "检查模板完整性："
  prd template list | while read template; do
    if prd template validate "$template" >/dev/null 2>&1; then
      echo "✅ $template 模板有效"
    else
      echo "❌ $template 模板需要修复"
    fi
  done
}
```

#### 2. 自动化质量门禁

```bash
# 质量门禁脚本
quality_gate_check() {
  doc_id="$1"

  echo "=== 质量门禁检查: $doc_id ==="

  # 1. 字数检查
  word_count=$(prd show "$doc_id" --format text | wc -w)
  if [ "$word_count" -lt 500 ]; then
    echo "❌ 内容太少 ($word_count 词)，建议至少500词"
    return 1
  else
    echo "✅ 内容充实 ($word_count 词)"
  fi

  # 2. 必需章节检查
  required_sections="概述 需求 验收标准"
  missing_sections=""
  for section in $required_sections; do
    if ! prd show "$doc_id" --sections "$section" >/dev/null 2>&1; then
      missing_sections="$missing_sections $section"
    fi
  done

  if [ -n "$missing_sections" ]; then
    echo "❌ 缺少必需章节:$missing_sections"
    return 1
  else
    echo "✅ 必需章节完整"
  fi

  # 3. 版本稳定性检查
  recent_changes=$(prd version list "$doc_id" --json | \
    jq -r --arg today "$(date '+%Y-%m-%d')" \
    '.versions[] | select(.date >= $today) | .version' | wc -l)

  if [ "$recent_changes" -gt 5 ]; then
    echo "⚠️  今日修改过于频繁 ($recent_changes 次)，建议稳定后再提交审查"
    return 1
  else
    echo "✅ 版本变更合理"
  fi

  echo "🎉 质量门禁通过"
  return 0
}

# 自动运行质量检查
auto_quality_check() {
  # 对所有草稿状态文档运行检查
  prd list --status draft --json | jq -r '.drafts[].id' | while read doc; do
    echo ""
    if quality_gate_check "$doc"; then
      echo "✅ $doc 可以提交审查"
    else
      echo "❌ $doc 需要改进"
    fi
  done
}
```

#### 3. 知识库建设

```bash
# 团队知识库建设
build_knowledge_base() {
  echo "=== 构建团队PRD知识库 ==="

  mkdir -p "./knowledge-base"

  # 1. 最佳实践案例库
  echo "收集最佳实践案例..."
  prd list --status approved --json | \
    jq -r '.drafts[] | select(.rating >= 4) | .id' | \
    head -10 | while read doc; do
      echo "导出优秀案例: $doc"
      prd export "$doc" --format markdown \
                 --output "./knowledge-base/best-practices/${doc}.md"
    done

  # 2. 常见问题解答
  {
    echo "# PRD常见问题解答"
    echo ""
    echo "## 写作问题"
    echo "### Q: 如何确定需求优先级？"
    echo "A: 使用MoSCoW方法，结合商业价值和技术复杂度评估..."
    echo ""
    echo "### Q: 技术规范写到什么程度？"
    echo "A: 应该详细到开发人员可以直接实施，但不过度设计..."
    echo ""
    echo "## 流程问题"
    echo "### Q: 审查周期一般多长？"
    echo "A: 标准流程5-7个工作日，紧急需求可以加急处理..."
    echo ""
    echo "### Q: 如何处理审查意见分歧？"
    echo "A: 先尝试异步讨论，如无法达成一致则召开协调会议..."
  } > "./knowledge-base/faq.md"

  # 3. 模板使用指南
  prd template list | while read template; do
    {
      echo "# $template 模板使用指南"
      echo ""
      echo "## 适用场景"
      echo "$(prd template show "$template" --json | jq -r '.description')"
      echo ""
      echo "## 使用示例"
      echo '```bash'
      echo "prd create --title \"示例标题\" --template $template"
      echo '```'
      echo ""
      echo "## 注意事项"
      echo "- 确保所有必填章节都有内容"
      echo "- 根据具体需求调整章节结构"
      echo "- 参考最佳实践案例"
    } > "./knowledge-base/templates/${template}-guide.md"
  done

  echo "知识库构建完成，位置: ./knowledge-base/"
}
```

这个全面的用户指南涵盖了从基础使用到高级功能的所有方面，为不同角色的用户提供了实用的指导和最佳实践建议 (´｡• ᵕ •｡`) ♡