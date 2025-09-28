# PRD 系统故障排除指南

快速解决PRD Draft Documentation System使用过程中遇到的常见问题。

## 目录
- [连接和认证问题](#连接和认证问题)
- [文档操作问题](#文档操作问题)
- [编辑器和内容问题](#编辑器和内容问题)
- [审查流程问题](#审查流程问题)
- [版本控制问题](#版本控制问题)
- [导入导出问题](#导入导出问题)
- [性能和网络问题](#性能和网络问题)
- [权限和访问问题](#权限和访问问题)
- [高级故障排除](#高级故障排除)

---

## 连接和认证问题

### 问题1：无法连接到API服务器

**症状**：
```bash
prd list
❌ Error: Network connection failed (timeout)
```

**诊断步骤**：
```bash
# 1. 检查配置
prd config show --key api.base_url
prd config show --key auth.token

# 2. 测试网络连接
curl -I "$(prd config show --key api.base_url)"

# 3. 检查DNS解析
nslookup prd-api.yourcompany.com

# 4. 测试端口连通性
telnet prd-api.yourcompany.com 443
```

**解决方案**：
```bash
# 方案1：修正API地址
prd config set api.base_url "https://correct-api-url.com"

# 方案2：检查网络防火墙
# 联系网络管理员确认端口访问权限

# 方案3：使用代理（如果在企业网络）
prd config set network.proxy "http://proxy.company.com:8080"

# 方案4：增加超时时间
prd config set api.timeout 60
```

### 问题2：认证失败

**症状**：
```bash
prd list
❌ Error: Authentication failed (code: AUTH_TOKEN_INVALID)
```

**诊断和解决**：
```bash
# 1. 检查令牌格式
token=$(prd config show --key auth.token)
echo "令牌长度: ${#token}"
echo "令牌前缀: ${token:0:10}..."

# 2. 验证令牌有效性
curl -H "Authorization: Bearer $token" \
     "$(prd config show --key api.base_url)/api/v1/health"

# 3. 重新获取令牌
# 联系管理员获取新的访问令牌
prd config set auth.token "your_new_token_here"

# 4. 清除缓存令牌
rm -f ~/.codex-father/.auth_cache
```

### 问题3：权限不足

**症状**：
```bash
prd create --title "测试文档"
❌ Error: Permission denied (code: PERMISSION_INSUFFICIENT)
```

**解决方案**：
```bash
# 1. 检查用户角色
prd config show --key user.role

# 2. 确认权限范围
prd config show --key user.permissions

# 3. 联系管理员提升权限
# 或者使用有限权限进行操作

# 4. 检查IP白名单限制
# 确认当前IP是否在允许列表中
```

---

## 文档操作问题

### 问题4：创建文档失败

**症状**：
```bash
prd create --title "新文档"
❌ Error: Validation error (code: VALIDATION_TITLE_TOO_SHORT)
```

**诊断和解决**：
```bash
# 1. 检查标题长度和格式
echo "标题长度: $(echo '新文档' | wc -m)"
# 标题应该在1-200字符之间

# 2. 检查特殊字符
echo "新文档！@#$" | grep -o '[^a-zA-Z0-9\u4e00-\u9fff\s\-_]'
# 避免使用特殊符号

# 3. 检查模板有效性
prd template validate your-template

# 4. 使用有效参数重试
prd create --title "移动端用户认证功能优化需求文档" \
          --template product-feature \
          --description "改进现有用户认证流程的产品需求"
```

### 问题5：无法找到文档

**症状**：
```bash
prd show my-doc-001
❌ Error: Resource not found (code: RESOURCE_NOT_FOUND)
```

**诊断步骤**：
```bash
# 1. 确认文档ID
prd list --search "my-doc" --limit 20

# 2. 检查文档状态（可能已删除）
prd list --status archived --search "my-doc"

# 3. 检查权限（可能无访问权限）
prd list --author $(whoami) | grep "my-doc"

# 4. 使用标题搜索
prd search "文档标题关键词"
```

**解决方案**：
```bash
# 1. 使用正确的文档ID
correct_id=$(prd search "关键词" --json | jq -r '.drafts[0].id')
prd show "$correct_id"

# 2. 恢复已删除文档（如果有权限）
prd restore my-doc-001

# 3. 重新获取访问权限
# 联系文档创建者或管理员
```

### 问题6：文档列表为空

**症状**：
```bash
prd list
📋 PRD草稿 (0 total)
```

**可能原因和解决**：
```bash
# 1. 检查筛选条件
prd list --status all --limit 100

# 2. 检查用户权限范围
prd config show --key user.access_scope

# 3. 检查时间范围（可能数据在不同时间段）
prd list --json | jq -r '.drafts[] | .updated_at' | sort

# 4. 重置所有筛选条件
prd list --author "" --status "" --search ""
```

---

## 编辑器和内容问题

### 问题7：编辑器无法启动

**症状**：
```bash
prd edit doc-001
❌ Error: Editor command failed (code: EDITOR_NOT_FOUND)
```

**解决方案**：
```bash
# 1. 检查当前编辑器配置
prd config show --key editor.command

# 2. 测试编辑器命令
code --version  # 或其他编辑器命令
vim --version

# 3. 设置可用的编辑器
prd config set editor.command "nano"           # 简单编辑器
prd config set editor.command "vim"            # Vim编辑器
prd config set editor.command "code --wait"    # VS Code
prd config set editor.command "subl --wait"    # Sublime Text

# 4. 使用环境变量
export EDITOR="nano"
prd edit doc-001
```

### 问题8：编辑内容丢失

**症状**：编辑器关闭后内容没有保存

**预防和恢复**：
```bash
# 1. 检查是否有自动备份
ls ~/.codex-father/backups/doc-001-*

# 2. 检查版本历史
prd version list doc-001

# 3. 恢复到上一版本
last_version=$(prd version list doc-001 --json | jq -r '.versions[-2].version')
prd version restore doc-001 $last_version --message "恢复丢失的编辑内容"

# 4. 启用编辑备份
prd config set behavior.backup true
prd config set behavior.auto_save true

# 5. 手动创建备份
prd export doc-001 --format markdown --output "backup-$(date +%Y%m%d%H%M).md"
```

### 问题9：Markdown格式错误

**症状**：文档显示格式混乱

**诊断和修复**：
```bash
# 1. 导出检查格式
prd show doc-001 --format markdown > format-check.md

# 2. 使用Markdown检查工具
markdownlint format-check.md

# 3. 常见格式问题修复
# 问题：标题层级错误
# 错误：#### 标题（跳过了二级三级）
# 正确：## 二级标题 → ### 三级标题 → #### 四级标题

# 问题：列表格式错误
# 错误：
# -项目1
# - 项目2
# 正确：
# - 项目1
# - 项目2

# 问题：代码块不完整
# 错误：```bash 代码 (缺少结束```)
# 正确：```bash
# 代码内容
# ```

# 4. 自动格式化工具
prettier --parser markdown --write format-check.md
prd import format-check.md --title "格式修复版本"
```

---

## 审查流程问题

### 问题10：无法提交审查

**症状**：
```bash
prd review submit doc-001 --reviewers "alice,bob"
❌ Error: Review submission failed (code: REVIEW_INVALID_REVIEWERS)
```

**诊断和解决**：
```bash
# 1. 检查审查者用户名
prd config show --key team.members

# 2. 验证审查者权限
curl -H "Authorization: Bearer $(prd config show --key auth.token)" \
     "$(prd config show --key api.base_url)/api/v1/users/alice"

# 3. 检查文档状态
prd show doc-001 --json | jq -r '.status'
# 只有draft状态的文档可以提交审查

# 4. 使用正确的审查者
prd review submit doc-001 --reviewers "valid-reviewer" \
          --message "请审查此文档"
```

### 问题11：审查响应失败

**症状**：
```bash
prd review respond doc-001 --decision approved
❌ Error: Not authorized to review this document
```

**解决方案**：
```bash
# 1. 确认审查权限
prd review status doc-001

# 2. 检查是否被指定为审查者
prd list --status in_review --json | \
  jq -r '.drafts[] | select(.id == "doc-001") | .reviewers[]'

# 3. 联系文档创建者添加为审查者
# 或请求管理员权限

# 4. 使用正确身份审查
prd review respond doc-001 --decision approved \
          --inline "技术方案可行，建议实施"
```

### 问题12：审查流程卡住

**症状**：文档长时间处于in_review状态

**解决方案**：
```bash
# 1. 检查审查者状态
prd review status doc-001 --verbose

# 2. 发送提醒
echo "审查提醒" | mail -s "待审查文档: doc-001" reviewer@company.com

# 3. 更换审查者（如果有权限）
prd review submit doc-001 --reviewers "backup-reviewer" \
          --message "原审查者不可用，更换审查者"

# 4. 紧急情况下撤回审查
prd review withdraw doc-001 --reason "需要紧急修改"
```

---

## 版本控制问题

### 问题13：版本比较失败

**症状**：
```bash
prd version diff doc-001 --from 1 --to 3
❌ Error: Version not found
```

**解决方案**：
```bash
# 1. 检查可用版本
prd version list doc-001

# 2. 使用存在的版本号
prd version diff doc-001 --from 1 --to 2

# 3. 检查版本完整性
prd version show doc-001 1 --format text | head -5

# 4. 修复损坏的版本数据
# 联系管理员进行数据修复
```

### 问题14：版本恢复失败

**症状**：
```bash
prd version restore doc-001 2 --message "恢复版本"
❌ Error: Cannot restore to same version
```

**解决方案**：
```bash
# 1. 检查当前版本
current=$(prd show doc-001 --json | jq -r '.version')
echo "当前版本: $current"

# 2. 恢复到不同版本
if [ "$current" != "2" ]; then
  prd version restore doc-001 2 --message "恢复到版本2"
else
  echo "已经是版本2，无需恢复"
fi

# 3. 创建基于历史版本的新文档
prd version show doc-001 2 --format markdown > temp-v2.md
prd import temp-v2.md --title "文档名称-版本2分支"
```

---

## 导入导出问题

### 问题15：导入格式不支持

**症状**：
```bash
prd import document.pages
❌ Error: Unsupported format
```

**解决方案**：
```bash
# 1. 检查支持的格式
prd import --help | grep -A 5 "format"

# 2. 转换文件格式
# Pages → Word
# 在Mac上使用Pages应用导出为Word格式

# Word → Markdown
pandoc document.docx -t markdown -o document.md

# 3. 导入转换后的文件
prd import document.md --format markdown

# 4. 手动复制粘贴内容
# 打开原文件，复制内容到文本编辑器，另存为Markdown格式
```

### 问题16：导出PDF失败

**症状**：
```bash
prd export doc-001 --format pdf
❌ Error: PDF generation failed
```

**解决方案**：
```bash
# 1. 检查系统依赖
which pandoc
which wkhtmltopdf

# 2. 安装缺失依赖
# Ubuntu/Debian:
sudo apt-get install pandoc wkhtmltopdf

# macOS:
brew install pandoc wkhtmltopdf

# 3. 先导出为HTML再转PDF
prd export doc-001 --format html --output temp.html
wkhtmltopdf temp.html document.pdf

# 4. 使用在线转换服务
prd export doc-001 --format markdown --output temp.md
# 使用Pandoc在线工具或其他服务转换
```

### 问题17：导入内容格式混乱

**症状**：导入后文档格式错乱，章节结构不对

**解决方案**：
```bash
# 1. 预览导入结果
prd import document.docx --dry-run

# 2. 清理格式后重新导入
pandoc document.docx -t markdown --wrap=none > clean.md
# 手动编辑clean.md修复格式问题
prd import clean.md --template appropriate-template

# 3. 分章节导入
# 将大文档拆分为多个小文件分别导入

# 4. 使用专用转换工具
mammoth document.docx clean-output.md  # Word到Markdown
prd import clean-output.md
```

---

## 性能和网络问题

### 问题18：操作响应缓慢

**症状**：所有命令执行都很慢

**诊断和优化**：
```bash
# 1. 测试网络延迟
ping prd-api.yourcompany.com

# 2. 测试API响应时间
time curl "$(prd config show --key api.base_url)/api/v1/health"

# 3. 调整超时设置
prd config set api.timeout 30      # 减少超时时间
prd config set api.retries 1       # 减少重试次数

# 4. 使用本地缓存
prd config set cache.enabled true
prd config set cache.ttl 300       # 5分钟缓存

# 5. 限制结果数量
prd list --limit 10                # 减少列表数量
prd search "关键词" --limit 5       # 限制搜索结果
```

### 问题19：大文件处理失败

**症状**：
```bash
prd import large-document.md
❌ Error: File too large (code: FILE_SIZE_LIMIT_EXCEEDED)
```

**解决方案**：
```bash
# 1. 检查文件大小限制
prd config show --key upload.max_size

# 2. 分割大文件
split -l 100 large-document.md section-
# 生成 section-aa, section-ab, section-ac...

# 为每个部分创建单独的PRD
for file in section-*; do
  title="大文档-$(basename $file)"
  prd import "$file" --title "$title"
done

# 3. 压缩内容
# 移除不必要的图片和附件
# 简化内容描述

# 4. 使用外部存储
# 将大文件上传到云存储，在PRD中引用链接
```

---

## 权限和访问问题

### 问题20：团队成员无法访问

**症状**：团队成员报告无法看到共享文档

**解决方案**：
```bash
# 1. 检查文档权限设置
prd show doc-001 --json | jq '.permissions'

# 2. 添加团队成员访问权限
prd share doc-001 --users "team-member" --permission read

# 3. 设置团队默认权限
prd config set team.default_permissions "read,comment"

# 4. 创建团队组
prd group create "mobile-team" --members "alice,bob,charlie"
prd share doc-001 --group "mobile-team" --permission "read,write"

# 5. 检查用户账户状态
curl -H "Authorization: Bearer $(prd config show --key auth.token)" \
     "$(prd config show --key api.base_url)/api/v1/users/team-member"
```

### 问题21：跨部门协作权限

**症状**：其他部门成员无法审查文档

**解决方案**：
```bash
# 1. 申请跨部门权限
# 联系系统管理员申请权限

# 2. 使用临时访问权限
prd share doc-001 --users "other-dept-reviewer" \
          --permission "review" \
          --expires "2025-10-15"

# 3. 创建访客账户
# 为外部审查者创建临时账户

# 4. 导出文档进行线下审查
prd export doc-001 --format pdf --output "review-copy.pdf"
# 通过邮件发送PDF进行审查
```

---

## 高级故障排除

### 系统诊断工具

创建诊断脚本：
```bash
#!/bin/bash
# PRD系统诊断工具

echo "=== PRD系统诊断报告 ==="
echo "时间: $(date)"
echo "用户: $(whoami)"
echo ""

# 1. 配置检查
echo "## 配置状态"
echo "API地址: $(prd config show --key api.base_url)"
echo "认证状态: $(prd config show --key auth.token | cut -c1-10)..."
echo ""

# 2. 连接测试
echo "## 连接测试"
if prd list --limit 1 >/dev/null 2>&1; then
  echo "✅ API连接正常"
else
  echo "❌ API连接失败"
fi
echo ""

# 3. 权限检查
echo "## 权限检查"
if prd create --title "诊断测试" --description "自动诊断" >/dev/null 2>&1; then
  echo "✅ 创建权限正常"
  # 清理测试文档
  prd delete $(prd list --search "诊断测试" --json | jq -r '.drafts[0].id') --force --confirm >/dev/null 2>&1
else
  echo "❌ 创建权限受限"
fi
echo ""

# 4. 性能测试
echo "## 性能测试"
start_time=$(date +%s.%N)
prd list --limit 10 >/dev/null
end_time=$(date +%s.%N)
duration=$(echo "$end_time - $start_time" | bc)
echo "列表查询耗时: ${duration}s"

if (( $(echo "$duration > 2.0" | bc -l) )); then
  echo "⚠️  响应较慢，建议检查网络"
else
  echo "✅ 响应速度正常"
fi
echo ""

# 5. 依赖检查
echo "## 依赖检查"
dependencies="curl jq bc pandoc"
for dep in $dependencies; do
  if which $dep >/dev/null 2>&1; then
    echo "✅ $dep 已安装"
  else
    echo "❌ $dep 未安装"
  fi
done
echo ""

echo "=== 诊断完成 ==="
```

### 日志分析工具

```bash
#!/bin/bash
# PRD系统日志分析

log_file="$HOME/.codex-father/prd.log"

if [ ! -f "$log_file" ]; then
  echo "日志文件不存在: $log_file"
  exit 1
fi

echo "=== PRD系统日志分析 ==="

# 1. 错误统计
echo "## 最近错误统计"
tail -1000 "$log_file" | grep -i "error" | \
  awk '{print $4}' | sort | uniq -c | sort -nr | head -10

# 2. 慢查询检测
echo ""
echo "## 慢查询检测 (>2秒)"
tail -1000 "$log_file" | grep -E "duration.*[2-9][0-9]{3}ms|duration.*[0-9]+s"

# 3. 网络问题检测
echo ""
echo "## 网络问题"
tail -1000 "$log_file" | grep -i "timeout\|connection\|network"

# 4. 认证问题
echo ""
echo "## 认证问题"
tail -1000 "$log_file" | grep -i "auth\|token\|permission"
```

### 数据修复工具

```bash
#!/bin/bash
# PRD数据修复工具

echo "=== PRD数据修复工具 ==="

# 1. 检查数据完整性
echo "## 数据完整性检查"
corrupted_docs=""

prd list --json | jq -r '.drafts[].id' | while read doc_id; do
  if ! prd show "$doc_id" >/dev/null 2>&1; then
    echo "❌ 损坏的文档: $doc_id"
    corrupted_docs="$corrupted_docs $doc_id"
  fi
done

# 2. 修复版本数据
echo ""
echo "## 版本数据修复"
prd list --json | jq -r '.drafts[].id' | while read doc_id; do
  version_count=$(prd version list "$doc_id" --json 2>/dev/null | jq '.versions | length' 2>/dev/null)
  if [ "$version_count" = "null" ] || [ -z "$version_count" ]; then
    echo "⚠️  $doc_id 版本数据异常，尝试修复..."
    # 尝试重新初始化版本数据
    prd edit "$doc_id" --message "修复版本数据" >/dev/null 2>&1
  fi
done

# 3. 清理临时文件
echo ""
echo "## 清理临时文件"
temp_files=$(find ~/.codex-father -name "*.tmp" -o -name "*.backup.*" -o -name ".lock*")
if [ -n "$temp_files" ]; then
  echo "清理临时文件:"
  echo "$temp_files"
  echo "$temp_files" | xargs rm -f
else
  echo "✅ 无需清理"
fi

echo ""
echo "=== 修复完成 ==="
```

---

## 紧急联系方式

### 技术支持渠道

1. **内部支持**：
   - 系统管理员：admin@yourcompany.com
   - 技术支持团队：prd-support@yourcompany.com
   - 内部Wiki：https://wiki.company.com/prd-system

2. **社区支持**：
   - GitHub Issues：https://github.com/codex-father/prd-cli/issues
   - 用户论坛：https://forum.prd-system.com
   - 技术文档：https://docs.prd-system.com

3. **紧急联系**：
   - 24/7技术热线：+1-800-PRD-HELP
   - 紧急故障邮箱：emergency@prd-system.com
   - 企业微信群：PRD系统技术支持

### 故障报告模板

遇到问题时，请使用以下模板报告故障：

```
故障报告
=======

基本信息:
- 时间: [故障发生时间]
- 用户: [你的用户名]
- 环境: [开发/测试/生产]
- CLI版本: [prd --version 输出]

问题描述:
- 预期行为: [你期望发生什么]
- 实际行为: [实际发生了什么]
- 错误信息: [完整的错误消息]

复现步骤:
1. [第一步]
2. [第二步]
3. [第三步]

配置信息:
- API地址: [prd config show --key api.base_url]
- 操作系统: [macOS/Linux/Windows]
- 网络环境: [企业网络/家庭网络/移动网络]

已尝试的解决方案:
- [列出你已经尝试的方法]

附件:
- [相关日志文件]
- [屏幕截图]
- [诊断报告]
```

### 快速自救检查单

遇到问题时，请先按此检查单自查：

- [ ] 检查网络连接是否正常
- [ ] 验证API地址和认证令牌
- [ ] 确认CLI工具版本是最新的
- [ ] 检查命令语法是否正确
- [ ] 查看是否有相关错误日志
- [ ] 尝试重新启动CLI工具
- [ ] 清除本地缓存和临时文件
- [ ] 联系团队成员确认是否为系统性问题

如果自查后问题仍然存在，请按照故障报告模板提交问题。

---

## 预防性维护建议

### 定期维护任务

建议设置定期维护任务，预防常见问题：

```bash
#!/bin/bash
# PRD系统预防性维护脚本

echo "开始PRD系统维护..."

# 1. 更新CLI工具
npm update -g @codex-father/prd-cli

# 2. 清理缓存
rm -rf ~/.codex-father/.cache/*
rm -rf ~/.codex-father/.tmp/*

# 3. 备份重要配置
cp ~/.codex-father/prd-config.yaml ~/.codex-father/backups/config-$(date +%Y%m%d).yaml

# 4. 检查磁盘空间
df -h ~/.codex-father

# 5. 验证系统状态
./system-diagnostic.sh

echo "维护完成！"
```

### 最佳使用习惯

1. **定期备份**：重要文档定期导出备份
2. **版本管理**：重要修改前创建版本标记
3. **命令验证**：危险操作前使用`--dry-run`预览
4. **配置管理**：定期检查和更新配置
5. **权限审查**：定期清理不必要的访问权限

通过遵循这些故障排除指南和预防措施，你应该能够快速解决大部分常见问题。如果问题持续存在，请不要犹豫联系技术支持团队！🛠️