# PRD CLI 工作流示例

实际使用场景下的CLI工作流示例，涵盖从文档创建到团队协作的完整流程。

## 目录
- [个人开发工作流](#个人开发工作流)
- [团队协作工作流](#团队协作工作流)
- [项目管理工作流](#项目管理工作流)
- [质量保证工作流](#质量保证工作流)
- [发布管理工作流](#发布管理工作流)
- [维护与优化工作流](#维护与优化工作流)

---

## 个人开发工作流

### 场景1：新功能PRD创建和迭代

作为产品经理，需要为新功能创建PRD并不断完善。

#### 步骤1：初始化和创建
```bash
# 1. 首次使用，初始化配置
prd config init
prd config set api.base_url "https://prd-api.company.com"
prd config set auth.token "your-api-token"

# 2. 查看可用模板
prd template list

# 3. 创建新功能PRD
prd create --title "移动端用户头像上传功能" \
          --template mobile-feature \
          --description "支持用户在移动端上传和管理个人头像"

# 输出示例：
# ✅ PRD草稿 '移动端用户头像上传功能' 创建成功 (ID: mobile-avatar-001)
```

#### 步骤2：编写和完善内容
```bash
# 1. 编辑PRD内容（会打开默认编辑器）
prd edit mobile-avatar-001 --message "初始需求框架"

# 2. 分章节编辑
prd edit mobile-avatar-001 --section "需求概述" --message "完善需求描述"
prd edit mobile-avatar-001 --section "用户故事" --message "添加用户场景"
prd edit mobile-avatar-001 --section "技术规范" --message "添加技术约束"

# 3. 查看当前进展
prd show mobile-avatar-001 --sections "需求概述,用户故事"
```

#### 步骤3：版本管理和备份
```bash
# 1. 查看版本历史
prd version list mobile-avatar-001

# 输出示例：
# Version  Author      Date                Message
# -------  ----------  ------------------  ------------------------
# 3        product-pm  2025-09-28 14:30    添加技术约束
# 2        product-pm  2025-09-28 11:15    添加用户场景
# 1        product-pm  2025-09-28 09:00    初始需求框架

# 2. 比较版本差异
prd version diff mobile-avatar-001 --from 1 --to 3 --format side-by-side

# 3. 如果需要回退
prd version restore mobile-avatar-001 2 --message "回退到添加用户场景版本"
```

#### 步骤4：准备交付
```bash
# 1. 最终检查
prd show mobile-avatar-001

# 2. 导出为多种格式
prd export mobile-avatar-001 --format pdf --output "./deliverables/移动端头像上传PRD.pdf"
prd export mobile-avatar-001 --format html --output "./docs/mobile-avatar-prd.html"

# 3. 为下次迭代做准备
prd list --author $(whoami) --status draft
```

---

### 场景2：从现有文档导入和改进

从Word文档导入现有需求，并使用PRD系统改进。

```bash
# 1. 导入现有文档
prd import "./legacy-docs/支付系统需求.docx" \
         --format docx \
         --template payment-system \
         --title "支付系统重构需求文档"

# 输出示例：
# ✅ 成功导入文档 (ID: payment-recon-001)
# 📝 已应用模板: payment-system
# ⚠️  发现3个格式问题，建议手动检查

# 2. 检查导入结果
prd show payment-recon-001 --no-metadata

# 3. 修复导入问题
prd edit payment-recon-001 --section "数据流图" --message "修复图表格式"
prd edit payment-recon-001 --section "API规范" --message "标准化API文档格式"

# 4. 验证最终结果
prd show payment-recon-001 --format markdown --output "./temp/验证导入结果.md"
```

---

## 团队协作工作流

### 场景3：多人协作编写大型PRD

团队协作编写复杂产品的PRD文档。

#### 产品经理（主导者）
```bash
# 1. 创建主文档框架
prd create --title "电商平台3.0架构重构" \
          --template enterprise-system \
          --description "面向企业客户的电商平台架构升级"

# 2. 设置文档结构并分配任务
prd edit ecommerce-v3-001 --message "创建文档框架和章节结构"

# 3. 通知团队成员
echo "文档ID: ecommerce-v3-001" | mail -s "电商3.0 PRD协作" team@company.com
```

#### 技术架构师（协作者）
```bash
# 1. 查看分配的文档
prd show ecommerce-v3-001 --sections "技术架构"

# 2. 编辑技术相关章节
prd edit ecommerce-v3-001 --section "技术架构" \
     --message "添加微服务架构设计和数据库分片方案"

prd edit ecommerce-v3-001 --section "系统集成" \
     --message "定义外部系统接口规范"

# 3. 查看其他人的更新
prd version diff ecommerce-v3-001 --format unified
```

#### UX设计师（协作者）
```bash
# 1. 专注用户体验章节
prd edit ecommerce-v3-001 --section "用户体验" \
     --message "添加用户旅程地图和交互原型"

# 2. 添加设计相关需求
prd edit ecommerce-v3-001 --section "界面设计" \
     --message "定义设计系统和可访问性要求"

# 3. 导出当前版本进行设计review
prd export ecommerce-v3-001 --format html \
          --sections "用户体验,界面设计" \
          --output "./design-review/ux-sections.html"
```

#### 团队同步和冲突解决
```bash
# 1. 团队lead检查整体进展
prd version list ecommerce-v3-001

# 2. 如果发现冲突或需要整合
prd version diff ecommerce-v3-001 --from 5 --to 8

# 3. 创建整合版本
prd edit ecommerce-v3-001 --message "整合技术架构和UX设计章节，解决依赖冲突"

# 4. 通知团队最新状态
prd show ecommerce-v3-001 --format text | head -20 > ./status-update.txt
```

---

### 场景4：审查流程管理

严格的文档审查和批准流程。

#### 提交审查
```bash
# 1. 准备提交审查
prd show ecommerce-v3-001 --sections "概述,核心需求" # 最终检查

# 2. 提交多级审查
prd review submit ecommerce-v3-001 \
          --reviewers "tech-lead,product-director,architecture-board" \
          --due-date "2025-10-15T18:00:00Z" \
          --priority high \
          --message "第一阶段需求审查：技术可行性和产品策略对齐性评估"

# 输出示例：
# ✅ 审查请求已发送
# 👥 审查者: tech-lead, product-director, architecture-board
# 📅 截止时间: 2025-10-15 18:00 UTC
# 🔔 邮件通知已发送
```

#### 审查者响应
```bash
# 技术负责人审查
prd review status ecommerce-v3-001

# 输出示例：
# 📋 审查状态
# 文档: 电商平台3.0架构重构 (ecommerce-v3-001)
# 状态: 待审查 (2/3 完成)
# 审查者状态:
#   ✅ tech-lead: 已批准 (2025-09-28 15:30)
#   ❌ product-director: 请求修改 (2025-09-28 16:45)
#   ⏳ architecture-board: 待审查

# 产品总监请求修改
prd review respond ecommerce-v3-001 \
          --decision changes_requested \
          --inline "市场分析章节需要更详细的竞争对手分析，建议增加成本效益分析"

# 架构委员会审查（从文件读取详细意见）
prd review respond ecommerce-v3-001 \
          --decision approved \
          --comments "./review-comments/architecture-board-feedback.md"
```

#### 处理审查意见
```bash
# 1. 查看所有审查意见
prd review status ecommerce-v3-001

# 2. 根据意见修改文档
prd edit ecommerce-v3-001 --section "市场分析" \
     --message "根据产品总监意见：增加竞争对手分析和成本效益分析"

# 3. 重新提交审查
prd review submit ecommerce-v3-001 \
          --reviewers "product-director" \
          --message "已根据意见修改市场分析章节，请重新审查"

# 4. 最终批准后的处理
prd export ecommerce-v3-001 --format pdf \
          --include-metadata --include-history \
          --output "./approved-docs/电商平台3.0-正式版-v$(date +%Y%m%d).pdf"
```

---

## 项目管理工作流

### 场景5：项目群文档管理

管理多个相关项目的PRD文档。

#### 项目概览管理
```bash
# 1. 查看所有项目相关文档
prd list --search "电商平台" --sort updated --limit 20

# 输出示例：
# 📋 PRD草稿 (8 total)
# ID               Title                           Status        Updated
# ---------------- ------------------------------- ------------- ----------
# ecommerce-v3-001 电商平台3.0架构重构             approved      2025-09-28
# ecommerce-api-02 电商API网关设计                 in_review     2025-09-27
# ecommerce-mob-03 移动端重构方案                  draft         2025-09-26
# ecommerce-data-04 数据迁移方案                   changes_req   2025-09-25

# 2. 按状态分类检查
for status in draft in_review changes_requested approved; do
  echo "=== $status 状态文档 ==="
  prd list --search "电商平台" --status $status --limit 10
  echo ""
done

# 3. 生成项目状态报告
prd list --search "电商平台" --json > ./reports/ecommerce-project-status-$(date +%Y%m%d).json
```

#### 里程碑和依赖管理
```bash
# 1. 检查关键里程碑文档
milestone_docs=("ecommerce-v3-001" "ecommerce-api-02" "ecommerce-data-04")

for doc in "${milestone_docs[@]}"; do
  echo "=== 检查 $doc ==="
  prd show $doc --sections "时间计划,依赖关系" --format text
  echo ""
done

# 2. 导出里程碑概览
for doc in "${milestone_docs[@]}"; do
  prd export $doc --format html \
            --sections "概述,时间计划,依赖关系" \
            --output "./milestones/${doc}-milestone.html"
done

# 3. 检查跨项目依赖
prd search "依赖于" --in content --limit 20 | grep -E "(ecommerce|电商)"
```

#### 团队工作量分析
```bash
# 1. 按作者分析工作负载
authors=("alice" "bob" "charlie" "diana")

for author in "${authors[@]}"; do
  echo "=== $author 的工作 ==="
  echo "进行中:"
  prd list --author $author --status draft,in_review --limit 5
  echo "已完成:"
  prd list --author $author --status approved --limit 3
  echo ""
done

# 2. 生成团队效率报告
{
  echo "# 团队工作效率报告 - $(date +%Y-%m-%d)"
  echo ""
  for author in "${authors[@]}"; do
    echo "## $author"
    echo "```"
    prd list --author $author --json | jq -r '.drafts | length' | \
      xargs echo "文档总数:"
    prd list --author $author --status approved --json | jq -r '.drafts | length' | \
      xargs echo "已批准:"
    echo "```"
    echo ""
  done
} > "./reports/team-efficiency-$(date +%Y%m%d).md"
```

---

### 场景6：发布周期管理

管理产品发布周期中的文档流程。

#### 发布准备阶段
```bash
# 1. 创建发布计划文档
prd create --title "电商平台3.0发布计划" \
          --template release-plan \
          --description "Q4发布的功能清单、时间表和风险评估"

# 2. 收集所有相关功能PRD
release_features=$(prd search "电商平台3.0" --status approved --json | jq -r '.drafts[].id')

echo "发布包含的功能PRD:" > release-package.txt
for feature in $release_features; do
  prd show $feature --sections "概述" --format text | head -5 >> release-package.txt
  echo "---" >> release-package.txt
done

# 3. 生成发布文档包
mkdir -p "./release-v3.0/docs"
for feature in $release_features; do
  prd export $feature --format pdf \
            --output "./release-v3.0/docs/${feature}.pdf"
done
```

#### 发布后文档归档
```bash
# 1. 标记发布相关文档
released_docs=$(prd search "电商平台3.0" --status approved --json | jq -r '.drafts[].id')

# 2. 创建发布归档
mkdir -p "./archive/release-v3.0-$(date +%Y%m%d)"

for doc in $released_docs; do
  prd export $doc --format markdown \
            --include-history \
            --output "./archive/release-v3.0-$(date +%Y%m%d)/${doc}.md"
done

# 3. 生成发布总结报告
{
  echo "# 电商平台3.0发布总结"
  echo "发布日期: $(date +%Y-%m-%d)"
  echo ""
  echo "## 包含功能"
  for doc in $released_docs; do
    echo "- $(prd show $doc --sections title --format text)"
  done
} > "./archive/release-v3.0-$(date +%Y%m%d)/RELEASE-SUMMARY.md"
```

---

## 质量保证工作流

### 场景7：文档质量检查

确保文档质量和一致性的自动化流程。

#### 批量质量检查
```bash
# 1. 检查所有草稿状态文档
draft_docs=$(prd list --status draft --json | jq -r '.drafts[].id')

echo "=== 草稿文档质量检查 ===" > quality-report.txt
date >> quality-report.txt
echo "" >> quality-report.txt

for doc in $draft_docs; do
  echo "检查文档: $doc" >> quality-report.txt

  # 检查必需章节
  sections=$(prd show $doc --sections "概述,需求,技术规范" --format text 2>&1)
  if echo "$sections" | grep -q "章节不存在"; then
    echo "❌ 缺少必需章节" >> quality-report.txt
  else
    echo "✅ 章节完整" >> quality-report.txt
  fi

  # 检查字数
  word_count=$(prd show $doc --format text | wc -w)
  if [ $word_count -lt 500 ]; then
    echo "⚠️  内容过少 (${word_count} 词)" >> quality-report.txt
  else
    echo "✅ 内容充实 (${word_count} 词)" >> quality-report.txt
  fi

  echo "---" >> quality-report.txt
done
```

#### 模板一致性检查
```bash
# 1. 检查模板使用情况
{
  echo "# 模板使用统计"
  echo ""
  prd list --json | jq -r '.drafts[] | "\(.template // "无模板")"' | \
    sort | uniq -c | sort -nr | \
    awk '{print "- " $2 ": " $1 " 个文档"}'
  echo ""
} > template-usage-report.md

# 2. 查找未使用标准模板的文档
echo "## 未使用标准模板的文档" >> template-usage-report.md
prd list --json | jq -r '.drafts[] | select(.template == null or .template == "custom") | "- " + .title + " (" + .id + ")"' >> template-usage-report.md

# 3. 建议标准化操作
echo "## 建议操作" >> template-usage-report.md
echo "1. 为未使用模板的文档分配合适模板" >> template-usage-report.md
echo "2. 审查自定义模板的必要性" >> template-usage-report.md
```

#### 审查流程监控
```bash
# 1. 检查长期待审查文档
overdue_reviews=$(prd list --status in_review --json | \
  jq -r --arg date "$(date -d '7 days ago' +%Y-%m-%d)" \
  '.drafts[] | select(.updated_at < $date) | .id')

if [ -n "$overdue_reviews" ]; then
  echo "⚠️  发现超期待审查文档:"
  for doc in $overdue_reviews; do
    echo "- $doc ($(prd show $doc --format text | head -1))"
    # 发送提醒
    prd review status $doc
  done
fi

# 2. 生成审查效率报告
{
  echo "# 审查流程效率报告"
  echo "生成时间: $(date)"
  echo ""
  echo "## 当前待审查文档"
  prd list --status in_review --limit 20
  echo ""
  echo "## 请求修改的文档"
  prd list --status changes_requested --limit 10
} > review-efficiency-report.md
```

---

## 维护与优化工作流

### 场景8：定期维护和清理

保持文档库整洁和高效的维护流程。

#### 定期清理流程
```bash
#!/bin/bash
# 文档库维护脚本

echo "开始文档库维护..."

# 1. 清理长期草稿
old_drafts=$(prd list --status draft --json | \
  jq -r --arg date "$(date -d '30 days ago' +%Y-%m-%d)" \
  '.drafts[] | select(.updated_at < $date) | .id')

if [ -n "$old_drafts" ]; then
  echo "发现 $(echo $old_drafts | wc -w) 个超过30天的草稿"
  for draft in $old_drafts; do
    echo "检查草稿: $draft"
    # 导出备份
    prd export $draft --format markdown \
              --output "./cleanup-backup/${draft}-$(date +%Y%m%d).md"
    # 询问是否删除（在实际脚本中可能需要交互确认）
    echo "已备份: $draft"
  done
fi

# 2. 归档已批准的旧文档
old_approved=$(prd list --status approved --json | \
  jq -r --arg date "$(date -d '90 days ago' +%Y-%m-%d)" \
  '.drafts[] | select(.updated_at < $date) | .id')

mkdir -p "./archive/quarterly-$(date +%Y-Q%q)"
for doc in $old_approved; do
  prd export $doc --format pdf \
            --include-history \
            --output "./archive/quarterly-$(date +%Y-Q%q)/${doc}.pdf"
done

# 3. 生成维护报告
{
  echo "# 文档库维护报告"
  echo "日期: $(date)"
  echo ""
  echo "## 统计信息"
  echo "- 总文档数: $(prd list --json | jq '.total')"
  echo "- 草稿数: $(prd list --status draft --json | jq '.total')"
  echo "- 待审查数: $(prd list --status in_review --json | jq '.total')"
  echo "- 已批准数: $(prd list --status approved --json | jq '.total')"
  echo ""
  echo "## 本次维护"
  echo "- 备份旧草稿: $(echo $old_drafts | wc -w) 个"
  echo "- 归档文档: $(echo $old_approved | wc -w) 个"
} > "./maintenance-reports/maintenance-$(date +%Y%m%d).md"

echo "维护完成!"
```

#### 性能优化检查
```bash
# 1. 检查大文档
large_docs=$(prd list --json | jq -r '.drafts[] | select(.size > 100000) | .id + " (" + (.size/1000|floor|tostring) + "KB)"')

if [ -n "$large_docs" ]; then
  echo "发现大文档 (>100KB):"
  echo "$large_docs"
  echo ""
  echo "建议优化措施:"
  echo "1. 检查是否包含过大图片"
  echo "2. 考虑拆分为多个文档"
  echo "3. 移除不必要的详细内容"
fi

# 2. 模板使用优化
echo "=== 模板使用优化建议 ==="
prd template list | while read template; do
  usage_count=$(prd list --template "$template" --json | jq '.total')
  if [ "$usage_count" -eq 0 ]; then
    echo "❌ 未使用的模板: $template"
  elif [ "$usage_count" -lt 3 ]; then
    echo "⚠️  使用较少的模板: $template ($usage_count 次)"
  fi
done

# 3. 搜索性能测试
echo "=== 搜索性能测试 ==="
time_start=$(date +%s.%N)
prd search "系统" --limit 50 > /dev/null
time_end=$(date +%s.%N)
search_time=$(echo "$time_end - $time_start" | bc)
echo "搜索用时: ${search_time}s"

if (( $(echo "$search_time > 2.0" | bc -l) )); then
  echo "⚠️  搜索性能较慢，建议检查索引"
fi
```

---

### 场景9：备份和恢复流程

确保文档安全和业务连续性的备份恢复策略。

#### 全量备份流程
```bash
#!/bin/bash
# 文档库全量备份脚本

backup_date=$(date +%Y%m%d_%H%M%S)
backup_dir="./backups/full_backup_$backup_date"

echo "开始全量备份到: $backup_dir"
mkdir -p "$backup_dir"

# 1. 导出所有文档
all_docs=$(prd list --limit 1000 --json | jq -r '.drafts[].id')
total_docs=$(echo "$all_docs" | wc -l)
current=0

mkdir -p "$backup_dir/docs"
for doc in $all_docs; do
  current=$((current + 1))
  echo "备份文档 $current/$total_docs: $doc"

  # 多格式备份
  prd export "$doc" --format markdown \
            --include-history \
            --output "$backup_dir/docs/${doc}.md"

  prd export "$doc" --format json \
            --include-metadata \
            --output "$backup_dir/docs/${doc}.json"
done

# 2. 备份模板
echo "备份模板..."
mkdir -p "$backup_dir/templates"
prd template list --json | jq -r '.[].id' | while read template; do
  prd template show "$template" --format yaml > "$backup_dir/templates/${template}.yaml"
done

# 3. 备份配置
echo "备份配置..."
cp ~/.codex-father/prd-config.yaml "$backup_dir/config.yaml" 2>/dev/null || true

# 4. 生成备份清单
{
  echo "# 备份清单"
  echo "备份时间: $(date)"
  echo "备份版本: $backup_date"
  echo ""
  echo "## 文档统计"
  echo "- 总数: $total_docs"
  echo "- 按状态分布:"
  for status in draft in_review approved; do
    count=$(prd list --status "$status" --json | jq '.total')
    echo "  - $status: $count"
  done
  echo ""
  echo "## 文件列表"
  find "$backup_dir" -type f | sort
} > "$backup_dir/backup_manifest.md"

echo "备份完成: $backup_dir"
echo "备份大小: $(du -sh "$backup_dir" | cut -f1)"
```

#### 增量备份流程
```bash
#!/bin/bash
# 增量备份脚本（仅备份最近修改的文档）

last_backup_date="2025-09-27"  # 上次备份日期
backup_date=$(date +%Y%m%d_%H%M%S)
backup_dir="./backups/incremental_backup_$backup_date"

echo "增量备份自 $last_backup_date"
mkdir -p "$backup_dir"

# 查找最近修改的文档
recent_docs=$(prd list --json | \
  jq -r --arg date "$last_backup_date" \
  '.drafts[] | select(.updated_at > $date) | .id')

if [ -z "$recent_docs" ]; then
  echo "没有需要备份的新修改文档"
  exit 0
fi

echo "发现 $(echo "$recent_docs" | wc -l) 个修改的文档"

# 备份修改的文档
for doc in $recent_docs; do
  echo "备份: $doc"
  prd export "$doc" --format markdown \
            --include-history \
            --output "$backup_dir/${doc}.md"
done

# 生成增量备份报告
{
  echo "# 增量备份报告"
  echo "备份时间: $(date)"
  echo "基准日期: $last_backup_date"
  echo ""
  echo "## 备份的文档"
  for doc in $recent_docs; do
    title=$(prd show "$doc" --format text | head -1)
    echo "- $doc: $title"
  done
} > "$backup_dir/incremental_manifest.md"

echo "增量备份完成: $backup_dir"
```

#### 灾难恢复流程
```bash
#!/bin/bash
# 灾难恢复脚本

backup_dir="$1"
if [ -z "$backup_dir" ]; then
  echo "用法: $0 <备份目录>"
  exit 1
fi

if [ ! -d "$backup_dir" ]; then
  echo "错误: 备份目录不存在: $backup_dir"
  exit 1
fi

echo "开始从备份恢复: $backup_dir"

# 1. 恢复配置
if [ -f "$backup_dir/config.yaml" ]; then
  echo "恢复配置文件..."
  mkdir -p ~/.codex-father
  cp "$backup_dir/config.yaml" ~/.codex-father/prd-config.yaml
fi

# 2. 恢复模板
if [ -d "$backup_dir/templates" ]; then
  echo "恢复模板..."
  for template_file in "$backup_dir/templates"/*.yaml; do
    if [ -f "$template_file" ]; then
      echo "恢复模板: $(basename "$template_file" .yaml)"
      prd template create --file "$template_file"
    fi
  done
fi

# 3. 恢复文档
if [ -d "$backup_dir/docs" ]; then
  echo "恢复文档..."
  failed_imports=""

  for doc_file in "$backup_dir/docs"/*.md; do
    if [ -f "$doc_file" ]; then
      doc_id=$(basename "$doc_file" .md)
      echo "恢复文档: $doc_id"

      if ! prd import "$doc_file" --title "恢复-$doc_id"; then
        failed_imports="$failed_imports $doc_id"
      fi
    fi
  done

  if [ -n "$failed_imports" ]; then
    echo "⚠️  以下文档恢复失败: $failed_imports"
  fi
fi

# 4. 验证恢复结果
echo "=== 恢复验证 ==="
echo "文档总数: $(prd list --json | jq '.total')"
echo "模板数量: $(prd template list | wc -l)"
echo "配置状态: $(prd config show --key api.base_url)"

echo "灾难恢复完成"
```

---

## 总结

这些工作流示例涵盖了PRD CLI工具在实际工作中的各种应用场景：

### 个人工作流
- **文档创建和迭代**：从初始创建到最终交付的完整流程
- **导入改进**：将现有文档迁移到PRD系统并改进

### 团队协作流程
- **多人协作**：大型项目中多角色协作编写PRD
- **审查管理**：严格的多级审查和反馈处理

### 项目管理流程
- **项目群管理**：管理多个相关项目的文档
- **发布周期**：从发布准备到文档归档的完整周期

### 质量保证流程
- **质量检查**：自动化的文档质量和一致性检查
- **流程监控**：审查流程效率监控和优化

### 维护优化流程
- **定期维护**：保持文档库整洁的定期清理流程
- **备份恢复**：确保业务连续性的完整备份恢复策略

每个工作流都提供了具体的命令示例和最佳实践，可以根据实际需求进行调整和定制 ╰(*°▽°*)╯