# 安装指南

本文档将指导你通过各种方式安装 Codex Father 2.0。

## 📋 系统要求

### 最低要求
- **Node.js**: 18.0.0 或更高版本
- **npm**: 8.0.0 或更高版本
- **内存**: 128MB 可用内存
- **磁盘**: 50MB 可用空间
- **操作系统**: Linux, macOS, Windows

### 推荐配置
- **Node.js**: 20.0.0 LTS（推荐）
- **内存**: 512MB 可用内存
- **CPU**: 2+ 核心处理器

### 检查 Node.js 版本
```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本  
npm --version

# 如果版本过低，请升级 Node.js
# 推荐使用 nvm 管理 Node.js 版本
```

## 🚀 安装方式

### 方式一：全局安装（推荐）

适合大多数用户，可以在任何位置使用 `codex-father` 命令。

```bash
# 使用 npm 全局安装
npm install -g codex-father

# 验证安装
codex-father --version

# 查看帮助信息
codex-father --help
```

### 方式二：本地安装

适合在特定项目中使用，版本管理更灵活。

```bash
# 在项目目录中安装
npm install --save-dev codex-father

# 使用 npx 运行
npx codex-father --version

# 或者在 package.json 中添加脚本
{
  "scripts": {
    "codex": "codex-father",
    "mcp": "codex-father mcp",
    "server": "codex-father server"
  }
}
```

### 方式三：从源码安装

适合开发者或需要最新功能的用户。

```bash
# 克隆仓库
git clone https://github.com/your-org/codex-father.git
cd codex-father

# 安装依赖
npm install

# 构建项目
npm run build

# 全局链接（开发模式）
npm link

# 验证安装
codex-father --version
```

### 方式四：Docker 安装

适合容器化部署环境。

```bash
# 拉取镜像
docker pull codex-father:latest

# 运行容器
docker run -it --rm codex-father --version

# 挂载当前目录运行
docker run -it --rm -v $(pwd):/workspace codex-father mcp
```

## 🔧 环境配置

### 配置文件位置

Codex Father 2.0 会按以下顺序查找配置文件：

1. `./codex-father.json`（当前目录）
2. `./.codex-father.json`（当前目录，隐藏文件）
3. `~/.codex-father/config.json`（用户配置目录）
4. `/etc/codex-father/config.json`（系统配置）

### 基础配置文件

创建默认配置文件 `codex-father.json`：

```json
{
  "runner": {
    "maxConcurrency": 10,
    "defaultTimeout": 600000,
    "workingDirectory": "./workspace",
    "security": {
      "networkDisabled": true,
      "allowedPaths": ["./workspace", "/tmp"],
      "maxExecutionTime": 600000,
      "maxMemoryUsage": "512MB"
    }
  },
  "server": {
    "port": 3000,
    "host": "localhost",
    "enableWebSocket": true,
    "cors": {
      "origin": "*",
      "credentials": true
    }
  },
  "logging": {
    "level": "info",
    "file": "./logs/codex-father.log",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

### 环境变量

可以通过环境变量覆盖配置：

```bash
# 设置最大并发数
export CODEX_FATHER_MAX_CONCURRENCY=20

# 设置工作目录
export CODEX_FATHER_WORKING_DIRECTORY=/my/workspace

# 设置日志级别
export CODEX_FATHER_LOG_LEVEL=debug

# 设置服务器端口
export CODEX_FATHER_SERVER_PORT=8080
```

## ✅ 验证安装

### 基础功能测试

```bash
# 1. 检查版本信息
codex-father --version

# 2. 查看帮助信息
codex-father --help

# 3. 检查系统状态
codex-father status

# 4. 测试任务执行
echo 'console.log("Hello from Codex Father!");' > test.js
codex-father mcp --test-mode
```

### MCP 集成测试

```bash
# 启动 MCP 服务器
codex-father mcp --verbose

# 在另一个终端测试（如果有 MCP 客户端）
# 或者使用 Claude Code 测试集成
```

### HTTP API 测试

```bash
# 启动 HTTP 服务器
codex-father server --port 3000 &

# 测试健康检查端点
curl http://localhost:3000/healthz

# 测试任务提交
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Say hello world",
    "environment": "nodejs"
  }'

# 停止服务器
pkill -f "codex-father server"
```

## 🛠️ 故障排除

### 常见安装问题

#### 问题 1：权限不足
```bash
# npm 全局安装时权限错误
npm install -g codex-father

# 解决方案：使用 nvm 或配置 npm 全局目录
# 方案 A：使用 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install node
npm install -g codex-father

# 方案 B：配置 npm 全局目录
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
npm install -g codex-father
```

#### 问题 2：Node.js 版本过低
```bash
# 检查当前版本
node --version

# 升级 Node.js
# 使用 nvm
nvm install 20
nvm use 20

# 或直接从官网下载安装
# https://nodejs.org/
```

#### 问题 3：网络连接问题
```bash
# 使用国内镜像源
npm config set registry https://registry.npmmirror.com
npm install -g codex-father

# 恢复官方源
npm config set registry https://registry.npmjs.org
```

#### 问题 4：命令找不到
```bash
# 检查安装路径
npm list -g codex-father

# 检查 PATH 环境变量
echo $PATH | grep -o '[^:]*npm[^:]*'

# 手动添加到 PATH（根据实际路径调整）
export PATH=/usr/local/bin:$PATH
echo 'export PATH=/usr/local/bin:$PATH' >> ~/.bashrc
```

### 开发环境问题

#### 问题 1：从源码构建失败
```bash
# 清理缓存
npm cache clean --force
rm -rf node_modules package-lock.json

# 重新安装
npm install

# 如果有 TypeScript 编译错误
npm run build

# 检查依赖完整性
npm audit fix
```

#### 问题 2：测试失败
```bash
# 运行完整测试套件
npm test

# 运行特定测试
npm test -- --grep "TaskRunner"

# 查看测试覆盖率
npm run test:coverage
```

## 🔄 更新和卸载

### 更新到最新版本

```bash
# 全局安装更新
npm update -g codex-father

# 查看当前和最新版本
npm outdated -g codex-father

# 安装特定版本
npm install -g codex-father@2.0.0
```

### 卸载

```bash
# 全局卸载
npm uninstall -g codex-father

# 本地卸载
npm uninstall --save-dev codex-father

# 清理配置文件（可选）
rm -rf ~/.codex-father
rm -f ./codex-father.json ./.codex-father.json
```

## 📦 下一步

安装完成后，你可以：

1. **阅读快速入门** → [快速入门指南](./quickstart.md)
2. **配置 MCP 集成** → [Claude Code 配置](./mcp/claude-code-setup.md)
3. **探索 API** → [API 概览](./http/overview.md)
4. **查看示例** → [实用示例](./examples/workflows.md)

---

**💡 提示**: 如果在安装过程中遇到问题，请查看 [故障排除指南](./troubleshooting/common-issues.md) 或在社区寻求帮助。