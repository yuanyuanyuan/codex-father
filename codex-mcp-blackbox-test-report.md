# Codex Father MCP Server 黑盒测试报告

**测试日期：** 2025-10-05 **测试版本：** codex-father-preview **测试者：**
幽浮喵（黑盒用户视角）

---

## 📊 测试概览

### 测试覆盖

测试了全部 9 个工具：

1. ✅ `codex.help` - 查看帮助文档
2. ⚠️ `codex.list` - 列出任务（有问题）
3. ⚠️ `codex.exec` - 同步执行（有问题）
4. ✅ `codex.metrics` - 统计数据
5. ⚠️ `codex.logs` - 查看日志（部分问题）
6. ✅ `codex.start` - 后台启动
7. ✅ `codex.status` - 查询状态
8. ✅ `codex.clean` - 清理任务
9. ✅ `codex.stop` - 停止任务

### 测试场景

1. 查看帮助文档
2. 列出所有任务
3. 执行同步任务
4. 查看任务统计
5. 查看任务日志（多种视图）
6. 启动后台任务
7. 查询任务状态
8. 清理历史任务（dry-run）
9. 停止后台任务

---

## ✨ 非常好的改进

### 1. **帮助文档质量飞跃**

**亮点：**

- ✅ 新增"快速上手场景"：3 个完整的端到端示例
  - 执行一次性任务
  - 后台启动并持续跟踪
  - 清理旧会话并生成指标
- ✅ 参数说明用**表格**展示，清晰易读
- ✅ 明确标注"必填/否"
- ✅ 每个工具都有调用示例和返回示例
- ✅ 新增"返回值"说明，明确是 JSON 字符串
- ✅ 常见问题解答（FAQ）
- ✅ 进阶指南

**用户感受：**
文档非常专业，看完就知道怎么用了。结构清晰，从快速开始 → 核心工具速览 → 详细说明 → 常见问题 → 进阶指南，层次分明。

### 2. **返回格式大幅改善**

成功返回**结构化 JSON 对象**的工具：

- ✅ `codex.metrics` - 完美的 JSON 对象
- ✅ `codex.start` - 完美的 JSON 对象
- ✅ `codex.status` - 完美的 JSON 对象
- ✅ `codex.logs` - 完美的 JSON 对象
- ✅ `codex.clean` - 完美的 JSON 对象
- ✅ `codex.stop` - 完美的 JSON 对象

**用户感受：** 不用自己解析字符串了，直接就能使用数据，开发体验显著提升。

### 3. **新功能很实用**

- ✅ `codex.clean` 支持 dry-run 预览，避免误删
- ✅ `codex.metrics` 提供统计概览，便于任务管理
- ✅ `codex.logs` 支持 `view` 参数（default/result-only/debug）
- ✅ `codex.list` 支持多种过滤选项（state、tagContains、limit、offset）

### 4. **错误信息结构化**

即使出错，也能看到清晰的错误信息：

```json
{
  "code": "CLI_NON_ZERO_EXIT",
  "message": "命令 /data/codex-father/job.sh list --json --cwd /data/codex-father 以退出码 1 结束。",
  "details": {
    "command": "/data/codex-father/job.sh list --json --cwd /data/codex-father",
    "exitCode": 1,
    "stdout": "...",
    "stderr": "..."
  }
}
```

---

## ⚠️ 发现的问题

### 问题 1: **codex.list 返回格式异常**

**现象：**

- 工具返回 `isError: true`
- 但 `details.stdout` 里有完整的 JSON 数组数据
- `exitCode: 1`

**实际测试结果：**

```json
{
  "code": "CLI_NON_ZERO_EXIT",
  "message": "命令 /data/codex-father/job.sh list --json --cwd /data/codex-father 以退出码 1 结束。",
  "details": {
    "exitCode": 1,
    "stdout": "[{\"id\":\"cdx-20251004_134913\",\"state\":\"completed\",...}]"
  }
}
```

**用户困惑：**

- 不知道是成功还是失败
- 为什么成功的数据放在错误对象里？
- 需要自己从 `error.details.stdout` 中提取数据吗？

**建议：**

- 如果任务成功且有数据，应该返回正常结果，而不是错误
- 如果底层命令 exitCode=1 但有数据，需要调整错误判断逻辑
- 或者在文档中明确说明这种情况

---

### 问题 2: **codex.exec 返回错误但任务实际成功**

**现象：**

```json
{
  "exitCode": 1,
  "stdout": "...codex-father...", // 任务实际成功了
  "stderr": "/data/codex-father/start.d/03_finalize.sh: line 9: CODEX_EXIT: unbound variable"
}
```

**详细测试：**

- 执行任务：输出 package.json 中的 name 字段
- 实际输出：`codex-father`（正确）
- 但返回状态：`exitCode: 1`（错误）
- 错误原因：`CODEX_EXIT: unbound variable`

**用户困惑：**

- 任务执行成功了（输出了正确结果）
- 但返回的是错误状态
- 不知道应该信任结果还是重试

**建议：**

- **高优先级**修复 `CODEX_EXIT: unbound variable` 的底层脚本错误
- 检查 `start.d/03_finalize.sh: line 9`
- 这影响所有 `codex.exec` 调用

---

### 问题 3: **codex.logs 的 result-only 视图返回空**

**现象：** 使用 `view: "result-only"` 时：

```json
{
  "lines": [],
  "totalLines": 0,
  "view": "result-only"
}
```

但默认视图能看到完整日志，包括标记为 "codex" 的部分。

**测试对比：**

- `view: "default"` → 返回 112 行日志，包含 thinking、exec、codex 等部分
- `view: "result-only"` → 返回 0 行

**用户困惑：**

- 文档说 result-only "仅显示 codex 输出"
- 但实际返回是空的
- 想看精简的结果，但没办法

**建议：**

- 检查 result-only 的过滤逻辑
- 确认是否正确识别 "codex" 标记的内容
- 或者在文档中说明 result-only 适用的场景和限制

---

### 问题 4: **tokens_used 字段类型不一致**

**现象：** 在 `codex.list` 的输出中，同一个字段有三种类型：

- 有的任务是数字：`"tokens_used": 8139`
- 有的任务是字符串：`"tokens_used": "tokens used"`
- 有的任务是 null：`"tokens_used": null`

**实际数据样本：**

```json
[
  { "id": "cdx-20251004_134913", "tokens_used": 8139 },
  { "id": "cdx-20251004_141152", "tokens_used": "tokens used" },
  { "id": "cdx-20251005_042515-demo-health-check", "tokens_used": null }
]
```

**用户困惑：**

- 不知道哪个是正确的
- 如果要统计 tokens，需要先判断类型
- `"tokens used"` 这个字符串是什么意思？

**建议：**

- 统一为数字类型（number）
- 未知或解析失败时用 `null`
- 不要出现字符串 `"tokens used"`

---

### 问题 5: **返回格式仍不完全一致**

**当前情况：**

- `codex.metrics`、`codex.start`、`codex.status`、`codex.logs`、`codex.clean`、`codex.stop`
  → 返回 JSON 对象 ✅
- `codex.exec` 和 `codex.list` → 在错误时把数据放在 `stdout` 字符串中 ⚠️
- 文档说"返回 JSON 字符串"，但实际很多是对象

**用户困惑：**

- 不确定每个工具返回的是字符串还是对象
- 不知道是否需要 `JSON.parse()`
- 需要针对不同工具写不同的处理逻辑

**建议：**

- **推荐：** 全部改为返回 JSON 对象（已经完成了 6/9）
- 或者全部返回 JSON 字符串（需要保持一致）
- 或者在每个工具的文档中明确说明返回类型

---

## 🎯 优化建议（按优先级）

### 🔥 P0 - 阻塞性问题（必须修复）

#### 1. 修复 `CODEX_EXIT: unbound variable` 错误

- **影响：** `codex.exec` 所有调用都返回失败状态（exitCode=1）
- **位置：** `start.d/03_finalize.sh: line 9`
- **严重性：** 高 - 影响核心功能
- **建议：** 检查变量是否定义，或使用 `${CODEX_EXIT:-0}` 设置默认值

#### 2. 修复 `codex.list` 的返回逻辑

- **影响：** 用户不知道 list 是成功还是失败，需要从错误对象中提取数据
- **当前行为：** exitCode=1 但 stdout 有完整数据
- **严重性：** 高 - 影响用户体验和数据访问
- **建议：** 如果有数据就返回成功，不要用错误包裹；或者调整 exitCode 判断逻辑

---

### 📌 P1 - 高优先级（影响体验）

#### 3. 修复 `codex.logs` 的 result-only 视图

- **影响：** 用户无法快速查看任务结果，失去了精简视图的意义
- **当前行为：** result-only 返回空数组
- **建议：** 检查过滤逻辑，确认 "codex" 标记识别是否正确；或在文档中说明限制

#### 4. 统一 `tokens_used` 字段类型

- **影响：** 数据处理困难，需要类型判断
- **当前行为：** 数字、字符串 "tokens used"、null 三种类型混合
- **建议：** 始终用 `number` 类型，未知时用 `null`，移除字符串值

#### 5. 统一返回格式

- **影响：** 用户需要针对不同工具写不同的处理逻辑
- **当前进度：** 6/9 工具已返回 JSON 对象
- **建议：**
  - **推荐方案：** 全部改为返回 JSON 对象
  - 同时更新文档中的"返回值"说明

---

### 🌟 P2 - 中优先级（改善体验）

#### 6. 在 help 中增加错误码文档

- **当前情况：** 只有一个示例错误码 `CLI_NON_ZERO_EXIT`
- **建议：** 增加"错误码参考"章节，列出所有可能的错误码及含义
- **示例结构：**

  ```markdown
  ## 错误码参考

  - `CLI_NON_ZERO_EXIT` - 底层命令以非零退出码结束
  - `INVALID_JOB_ID` - 提供的 jobId 不存在
  - `PERMISSION_DENIED` - 权限不足 ...
  ```

#### 7. `codex.list` 支持更多过滤选项

- **当前支持：** state、tagContains、limit、offset
- **建议增加：**
  - `createdAfter`：只显示指定时间后创建的任务
  - `createdBefore`：只显示指定时间前创建的任务
  - `exitCode`：按退出码过滤（如只看失败的任务）

---

### ✨ P3 - 低优先级（锦上添花）

#### 8. `codex.clean` 返回更多信息

- **当前返回：** deleted 和 kept 任务列表
- **建议增加：**
  - `diskSpaceFreed`：释放的磁盘空间（字节）
  - `deletedCount`：删除数量（方便快速查看）
  - `keptCount`：保留数量

#### 9. `codex.metrics` 增加时间维度

- **当前统计：** 总量、状态分布、分类分布、tokens 总计
- **建议增加：**
  - 按时间分组统计（最近 24h、7天、30天）
  - 平均执行时间
  - tokens 平均消耗

---

## 📈 测试数据

### codex.metrics 输出示例

```json
{
  "total": 14,
  "byState": {
    "failed": 1,
    "completed": 11,
    "stopped": 2
  },
  "byClassification": {
    "normal": 11,
    "context_overflow": 3
  },
  "tokensUsed": 8139
}
```

### codex.clean dry-run 输出示例

```json
{
  "dryRun": true,
  "deleted": [],
  "kept": [
    "cdx-20251004_134913",
    "cdx-20251004_141152"
    // ... 37 个任务
  ],
  "limit": 3
}
```

### codex.stop 输出示例

```json
{
  "jobId": "cdx-20251005_073021-bg-test",
  "previousState": "running",
  "newState": "stopped",
  "forced": false,
  "signal": "SIGTERM",
  "action": "stop_requested"
}
```

---

## 🌟 总体评价

### 功能完整性：9/10 ✨

- 9 个工具覆盖了完整的任务管理生命周期
- clean 和 metrics 是很好的补充
- 功能设计合理，符合实际使用场景

### 文档质量：9.5/10 📖

- 结构清晰、示例丰富、表格展示专业
- 快速上手场景非常贴心，新用户友好
- 参数说明清晰，可选值明确
- 只差错误码文档就完美了

### 返回格式：7/10（进步很大！）

- 6/9 工具已返回 JSON 对象（大进步！）
- 但 list 和 exec 还有问题
- tokens_used 类型不一致影响数据处理

### 使用体验：7/10（有潜力！）

- 核心功能（start、status、logs、stop、clean、metrics）都能正常使用
- 但 list 和 exec 的错误让人困惑
- result-only 视图不工作降低了便利性

### 稳定性：6/10（需要改进）

- `CODEX_EXIT` 脚本错误影响所有 exec 调用
- list 的 exitCode=1 问题需要解决
- 这两个是当前最大的稳定性问题

---

## 💬 改进对比

### 显著进步的方面 ✨

1. **帮助文档质量飞跃**
   - 新增快速上手场景（3 个端到端示例）
   - 参数表格化展示
   - 返回值说明明确
   - FAQ 和进阶指南完善

2. **返回格式大幅改善**
   - 6/9 工具返回 JSON 对象（不再是紧凑字符串）
   - 开发体验显著提升

3. **新功能很实用**
   - clean 的 dry-run 模式
   - metrics 统计概览
   - logs 的多种视图模式
   - list 的丰富过滤选项

4. **错误信息结构化**
   - code、message、details 三层结构
   - 便于程序化处理

### 仍需改进的方面 ⚠️

1. **脚本错误影响核心功能**
   - `CODEX_EXIT` 未定义
   - 导致所有 exec 返回失败

2. **返回格式不完全一致**
   - list 和 exec 仍在错误处理中
   - tokens_used 类型混乱

3. **部分功能未完善**
   - result-only 视图不工作
   - list 的 exitCode 判断逻辑

4. 补充问题：

在 scripts/rmcp-client.mjs:1 新增 Node 包装脚本，自动检测 cargo、提示版本过旧并按需执行 cargo
build
--release，构建失败时给出 rustup 升级指引，同时转发输出让首次体验者能看到完整日志。

- 在 package.json:65 补充 rmcp:client
  npm 脚本，让用户可以直接运行内置 rMCP 客户端。
- 在 mcp/codex-mcp-server/src/index.ts:147 增加启动提示，告诉使用者可在新终端执行 npm
  run rmcp:client 进行联调。
- 在 README.md:181 增补“本地 rMCP
  CLI 快速体验”章节，列出双终端流程及自动构建说明，降低上手门槛。

---

## 🎀 结论

### 一句话总结

**这个工具进步非常大！**
文档、返回格式、新功能都很棒，但脚本错误影响了实际体验，修复后会是个非常专业的工具。

### 优先修复顺序

1. **立即修复（P0）：**
   - `CODEX_EXIT` 脚本错误
   - `codex.list` 返回逻辑

2. **尽快修复（P1）：**
   - `codex.logs` result-only 视图
   - `tokens_used` 类型统一
   - 返回格式完全统一

3. **逐步优化（P2-P3）：**
   - 错误码文档
   - 更多过滤选项
   - 时间维度统计
4. 补充问题也要修复

### 可用性评估

- **当前状态：** 可以使用，但需要绕过 exec 和 list 的问题
- **修复 P0 后：** 可以正式投入使用
- **修复 P1 后：** 达到生产级别质量
- **完成 P2-P3：** 企业级专业工具

---

**测试完成时间：** 2025-10-05T07:31:00Z **测试工具版本：** codex-father-preview
(node ./mcp/codex-mcp-server/dist/index.js) **测试环境：** /data/codex-father
