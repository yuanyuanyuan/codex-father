# Research Report: PRD Draft Documentation System

**Date**: 2025-09-28 **Feature**: PRD Draft Documentation System
(002-docs-prd-draft)

## Technical Research Findings

### 1. Markdown解析器选择

**Decision**: marked.js **Rationale**:

- 轻量级（<50KB），性能优秀
- 支持GitHub Flavored Markdown (GFM)
- 扩展性强，支持自定义渲染器
- TypeScript类型支持完善
- 安全性：内置XSS防护

**Alternatives considered**:

- remark.js: 功能强大但体积较大(>200KB)
- markdown-it: 插件丰富但配置复杂

### 2. Mermaid图表集成方案

**Decision**: mermaid + puppeteer (服务端渲染) **Rationale**:

- 服务端渲染避免前端依赖
- 支持SVG/PNG输出格式
- 与codex-father现有架构一致
- 可控的渲染环境

**Alternatives considered**:

- 客户端渲染：需要额外前端框架
- mermaid-cli：需要额外进程管理

### 3. 权限管理框架

**Decision**: 基于角色的简单权限系统 (RBAC) **Rationale**:

- 符合需求中的三种角色 (Architect/PM/Dev-Test)
- 文件级权限控制，无需复杂ACL
- 易于扩展和维护
- 与文件系统权限对应

**Alternatives considered**:

- ABAC (基于属性)：过于复杂
- 简单用户组：灵活性不足

### 4. 文件系统监听机制

**Decision**: chokidar **Rationale**:

- 跨平台兼容性 (Linux/macOS/Windows)
- 高性能，低延迟文件变更检测
- 稳定的API，TypeScript支持
- 节流和防抖功能内置

**Alternatives considered**:

- Node.js fs.watch: 跨平台问题
- 轮询方案: 性能较差

### 5. 版本历史存储方案

**Decision**: JSON Lines (.jsonl) + 文件系统 **Rationale**:

- 符合codex-father现有日志格式规范
- 追加写入，高性能
- 易于查询和分析
- 无需额外数据库

**Alternatives considered**:

- Git版本控制：复杂度高，学习成本大
- SQLite：额外依赖，过度设计

### 6. 配置管理方案

**Decision**: YAML配置文件 + JSON Schema验证 **Rationale**:

- 人类可读的配置格式
- 支持注释和多行文本
- Schema验证确保配置正确性
- 与项目现有配置方式一致

**Alternatives considered**:

- JSON：不支持注释
- TOML：生态支持不如YAML

## Performance Benchmarks

### Target Performance Metrics

- 文档加载: < 100ms (目标文档大小 < 10MB)
- 编辑响应: < 50ms (实时预览)
- Mermaid渲染: < 500ms (中等复杂度图表)
- 搜索响应: < 200ms (数百个文档)

### Memory Usage Targets

- Base memory: < 50MB (空闲状态)
- Per document: < 5MB (缓存大小)
- Peak memory: < 200MB (符合宪章要求)

## Security Considerations

### Input Validation

- Markdown内容XSS防护 (marked.js内置sanitizer)
- 文件路径遍历攻击防护 (path.resolve验证)
- 用户输入长度限制 (防DOS攻击)

### Access Control

- 文件系统权限基于操作系统用户
- 角色权限在应用层验证
- 敏感操作审计日志记录

### Data Protection

- 配置文件敏感信息掩码
- 错误消息脱敏处理
- 临时文件安全清理

## Integration Points

### 与codex-father集成

- MCP工具接口：PRD创建、编辑、查询
- CLI命令：prd-create, prd-edit, prd-review, prd-list
- 配置文件：扩展现有config.yaml
- 日志系统：集成现有结构化日志

### 外部依赖最小化

- 仅使用Node.js标准库和必要npm包
- 避免重型框架依赖
- 保持与主项目版本同步

## Implementation Complexity Assessment

### Low Complexity (Green)

- 基本CRUD操作
- 文件读写操作
- 简单权限验证

### Medium Complexity (Yellow)

- Markdown解析和渲染
- 版本历史管理
- 文件监听和变更通知

### High Complexity (Red)

- Mermaid图表渲染集成
- 复杂的模板结构验证
- 并发编辑冲突检测

## Recommended Implementation Order

1. **Core Models** (Week 1): 数据模型和基础类型
2. **File System Layer** (Week 1): 文件操作和存储
3. **Document Service** (Week 2): PRD文档CRUD
4. **Template System** (Week 2): 模板管理和验证
5. **Permission System** (Week 3): 权限验证和角色管理
6. **CLI Interface** (Week 3): 命令行工具
7. **Markdown Rendering** (Week 4): 解析和渲染
8. **Mermaid Integration** (Week 4): 图表支持
9. **Version History** (Week 5): 历史记录和回滚
10. **Testing & Polish** (Week 5): 测试完善和优化

---

**Research Complete**: All technical unknowns resolved. Ready for Phase 1
design.
