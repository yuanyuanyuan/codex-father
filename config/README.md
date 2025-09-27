# Config 配置管理

项目配置文件和环境管理。

## 配置分类

### 架构配置
- `architecture/` - 技术架构规范
- `directory-standard.json` - 目录结构标准
- `quality-rules.json` - 代码质量规则

### 测试配置
- `testing/` - 测试框架配置
- `coverage-requirements.json` - 覆盖率要求

### 安全配置
- `security/` - 安全策略配置
- `sandbox-policies.json` - 沙箱策略
- `audit-config.json` - 审计配置

### 环境配置
- `environments/` - 环境特定配置
- `development.json` - 开发环境
- `testing.json` - 测试环境
- `production.json` - 生产环境

## 配置原则

- **环境隔离**: 不同环境使用独立配置
- **安全性**: 敏感信息加密存储
- **可验证**: 所有配置支持 Schema 验证
- **可继承**: 支持配置继承和覆盖