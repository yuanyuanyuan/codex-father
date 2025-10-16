# 常见问题与故障排除

本文档收集了 Codex Father 2.0 使用过程中的常见问题和解决方案，帮助你快速定位和解决问题。

## 🔍 问题分类

- [🚀 安装和启动问题](#安装和启动问题)
- [⚙️ 配置相关问题](#配置相关问题)
- [📋 任务执行问题](#任务执行问题)
- [🌐 网络和连接问题](#网络和连接问题)
- [📊 性能相关问题](#性能相关问题)
- [🛡️ 安全和权限问题](#安全和权限问题)
- [💾 存储和文件问题](#存储和文件问题)

## 🚀 安装和启动问题

### 问题 1: 命令找不到

**症状**:
```bash
codex-father: command not found
```

**解决方案**:

#### 方案 A: 检查安装
```bash
# 检查是否已安装
npm list -g codex-father

# 如果未安装，重新安装
npm install -g codex-father

# 验证安装
codex-father --version
```

#### 方案 B: 检查 PATH
```bash
# 查看 npm 全局安装路径
npm config get prefix

# 检查 PATH 是否包含 npm 路径
echo $PATH | grep -o '[^:]*npm[^:]*'

# 如果 PATH 不包含，添加到 shell 配置
echo 'export PATH=$(npm config get prefix)/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

#### 方案 C: 使用 npx
```bash
# 使用 npx 运行
npx codex-father --version

# 或者在 package.json 中添加脚本
{
  "scripts": {
    "codex": "codex-father"
  }
}
```

### 问题 2: Node.js 版本不兼容

**症状**:
```bash
Error: Node.js version 16.x.x is not supported. Please use Node.js 18.0.0 or higher.
```

**解决方案**:

#### 使用 nvm 管理 Node.js 版本
```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 重启 shell 或执行
source ~/.bashrc

# 安装兼容的 Node.js 版本
nvm install 18
nvm use 18

# 设置默认版本
nvm alias default 18

# 验证版本
node --version
npm --version
```

#### 直接升级 Node.js
```bash
# 从官网下载安装
# https://nodejs.org/

# 或使用包管理器
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# macOS
brew install node@20
brew link --overwrite node@20
```

### 问题 3: 权限不足

**症状**:
```bash
npm ERR! code EACCES
npm ERR! syscall access
npm ERR! path /usr/local/lib/node_modules/codex-father
```

**解决方案**:

#### 方案 A: 使用 nvm
```bash
# 推荐：使用 nvm 避免权限问题
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
npm install -g codex-father
```

#### 方案 B: 修改 npm 全局目录
```bash
# 创建新的全局目录
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'

# 添加到 PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# 重新安装
npm install -g codex-father
```

#### 方案 C: 使用 sudo（不推荐）
```bash
# 临时使用 sudo
sudo npm install -g codex-father

# 或者修复权限
sudo chown -R $(whoami) /usr/local/lib/node_modules
npm install -g codex-father
```

### 问题 4: 启动失败

**症状**:
```bash
codex-father: error while loading shared libraries: libxxx.so: cannot open shared object file
```

**解决方案**:

#### 检查系统依赖
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential

# CentOS/RHEL
sudo yum groupinstall "Development Tools"
sudo yum install python3

# macOS
xcode-select --install
```

#### 重新安装依赖
```bash
# 清理 npm 缓存
npm cache clean --force

# 删除 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install
```

## ⚙️ 配置相关问题

### 问题 1: 配置文件找不到

**症状**:
```bash
Error: Configuration file not found. Please create a configuration file.
```

**解决方案**:

#### 创建默认配置
```bash
# 使用 CLI 创建配置
codex-father config init

# 或手动创建配置文件
cat > codex-father.json << 'EOF'
{
  "runner": {
    "maxConcurrency": 10,
    "defaultTimeout": 600000
  }
}
EOF
```

#### 检查配置文件位置
```bash
# 查看当前配置
codex-father config show

# 列出可能的配置文件位置
ls -la codex-father.json .codex-father.json ~/.codex-father/config.json

# 指定配置文件路径
codex-father --config ./my-config.json mcp
```

### 问题 2: 配置格式错误

**症状**:
```bash
Error: Invalid configuration file format. JSON parse error at line 5.
```

**解决方案**:

#### 验证配置文件
```bash
# 使用 CLI 验证
codex-father config validate

# 使用 jq 验证 JSON 格式
jq . codex-father.json

# 检查语法错误
cat -n codex-father.json
```

#### 修复配置文件
```bash
# 备份当前配置
cp codex-father.json codex-father.json.backup

# 重新创建正确格式的配置
cat > codex-father.json << 'EOF'
{
  "runner": {
    "maxConcurrency": 10,
    "defaultTimeout": 600000,
    "workingDirectory": "./workspace"
  },
  "server": {
    "port": 3000,
    "enableWebSocket": true
  }
}
EOF
```

### 问题 3: 配置项无效

**症状**:
```bash
Warning: Unknown configuration option "invalidOption" will be ignored.
```

**解决方案**:

#### 查看有效配置项
```bash
# 查看配置模板
codex-father config show --template

# 查看帮助文档
codex-father config --help
```

#### 更新配置文件
```bash
# 移除无效配置项
codex-father config set invalidOption null

# 或编辑配置文件移除无效项
```

## 📋 任务执行问题

### 问题 1: 任务超时

**症状**:
```bash
Error: Task execution timeout after 600000ms.
```

**解决方案**:

#### 增加超时时间
```bash
# 临时调整
codex-father run tasks.json --timeout 1200000

# 永久调整
codex-father config set runner.defaultTimeout 1200000
```

#### 优化任务执行
```bash
# 检查任务是否可以拆分
# 优化代码逻辑
# 减少不必要的操作
```

### 问题 2: 任务依赖失败

**症状**:
```bash
Error: Task dependency "install-deps" failed.
```

**解决方案**:

#### 检查依赖任务状态
```bash
# 查看依赖任务日志
codex-father logs install-deps

# 检查依赖任务配置
cat tasks.json | jq '.tasks[] | select(.id == "install-deps")'
```

#### 修复依赖任务
```bash
# 重新运行失败的依赖任务
codex-father run dependency-tasks.json

# 或者跳过依赖（不推荐）
codex-father run tasks.json --skip-dependencies
```

### 问题 3: 内存不足

**症状**:
```bash
Error: Task execution failed: JavaScript heap out of memory.
```

**解决方案**:

#### 增加 Node.js 内存限制
```bash
# 临时增加
export NODE_OPTIONS="--max-old-space-size=4096"
codex-father run tasks.json

# 永久设置
echo 'export NODE_OPTIONS="--max-old-space-size=4096"' >> ~/.bashrc
```

#### 优化任务配置
```json
{
  "runner": {
    "maxConcurrency": 5,
    "maxMemoryUsage": "2GB"
  }
}
```

### 问题 4: 文件权限问题

**症状**:
```bash
Error: Permission denied: cannot write to file './output.js'.
```

**解决方案**:

#### 检查文件权限
```bash
# 检查目标目录权限
ls -la ./workspace/

# 修改权限
chmod 755 ./workspace/
chmod 644 ./workspace/*.js
```

#### 更改工作目录
```bash
# 使用有写权限的目录
codex-father mcp --working-directory ~/projects

# 或在配置中指定
echo '{"runner": {"workingDirectory": "~/projects"}}' > codex-father.json
```

## 🌐 网络和连接问题

### 问题 1: MCP 连接失败

**症状**:
```bash
Claude Code: MCP tools not available. Connection timeout.
```

**解决方案**:

#### 检查 MCP 服务器状态
```bash
# 检查进程是否运行
ps aux | grep codex-father

# 手动启动 MCP 服务器
codex-father mcp --verbose

# 检查端口占用
netstat -an | grep 3010
```

#### 重启 MCP 服务
```bash
# 停止现有进程
pkill -f "codex-father mcp"

# 重新启动
codex-father mcp

# 检查 Claude Code 配置
cat ~/.config/claude/claude_desktop_config.json
```

### 问题 2: HTTP 服务器无法访问

**症状**:
```bash
curl: (7) Failed to connect to localhost port 3000: Connection refused
```

**解决方案**:

#### 检查服务器状态
```bash
# 检查服务器是否运行
codex-father status

# 启动 HTTP 服务器
codex-father server --port 3000

# 检查防火墙设置
sudo ufw status
```

#### 更改服务器配置
```bash
# 使用不同端口
codex-father server --port 8080

# 绑定到所有接口
codex-father server --host 0.0.0.0
```

### 问题 3: WebSocket 连接断开

**症状**:
```javascript
WebSocket connection to 'ws://localhost:3000/ws' failed: Connection closed.
```

**解决方案**:

#### 检查 WebSocket 配置
```bash
# 确保 WebSocket 已启用
codex-father server --enable-websocket

# 检查连接限制
codex-father config set server.websocket.maxConnections 100
```

#### 实现重连机制
```javascript
function connectWebSocket() {
  const ws = new WebSocket('ws://localhost:3000/ws');
  
  ws.onclose = () => {
    console.log('连接断开，5秒后重连...');
    setTimeout(connectWebSocket, 5000);
  };
  
  return ws;
}
```

## 📊 性能相关问题

### 问题 1: 系统响应缓慢

**症状**:
```bash
任务执行时间过长，系统响应缓慢。
```

**解决方案**:

#### 检查系统资源
```bash
# 查看系统状态
codex-father status --detailed

# 监控系统资源
top
htop
iotop
```

#### 优化并发设置
```bash
# 降低并发数
codex-father config set runner.maxConcurrency 5

# 增加超时时间
codex-father config set runner.defaultTimeout 1200000
```

### 问题 2: 内存使用过高

**症状**:
```bash
系统内存使用率持续增长，最终导致内存不足。
```

**解决方案**:

#### 监控内存使用
```bash
# 查看内存使用情况
codex-father status --performance

# 设置内存限制
codex-father config set runner.maxMemoryUsage "1GB"
```

#### 清理系统缓存
```bash
# 清理完成的任务数据
codex-father cleanup --completed-tasks

# 重启服务释放内存
pkill -f codex-father
codex-father mcp
```

### 问题 3: CPU 使用率过高

**症状**:
```bash
CPU 使用率持续保持在 90% 以上。
```

**解决方案**:

#### 检查任务负载
```bash
# 查看运行中的任务
codex-father status --tasks

# 取消高负载任务
codex-father cancel --all
```

#### 调整调度策略
```bash
# 启用 CPU 监控
codex-father config set runner.cpuMonitoring true

# 设置 CPU 使用率阈值
codex-father config set runner.maxCpuUsage 80
```

## 🛡️ 安全和权限问题

### 问题 1: 文件访问被拒绝

**症状**:
```bash
Error: Access denied to file '/etc/passwd'.
```

**解决方案**:

#### 检查安全策略
```bash
# 查看当前安全策略
codex-father config get security

# 检查允许的路径
codex-father config get security.allowedPaths
```

#### 更新安全配置
```json
{
  "security": {
    "allowedPaths": [
      "./workspace",
      "/tmp",
      "/home/user/projects"
    ]
  }
}
```

### 问题 2: 网络访问被阻止

**症状**:
```bash
Error: Network access is disabled by security policy.
```

**解决方案**:

#### 检查网络策略
```bash
# 查看网络设置
codex-father config get security.networkDisabled

# 如果需要网络访问（谨慎）
codex-father config set security.networkDisabled false
```

## 💾 存储和文件问题

### 问题 1: 磁盘空间不足

**症状**:
```bash
Error: No space left on device.
```

**解决方案**:

#### 检查磁盘使用情况
```bash
# 查看磁盘使用
df -h

# 查找大文件
find ./workspace -type f -size +100M -exec ls -lh {} \;

# 清理日志文件
codex-father cleanup --logs
```

#### 配置日志轮转
```json
{
  "logging": {
    "maxSize": "10MB",
    "maxFiles": 5,
    "compress": true
  }
}
```

### 问题 2: 数据文件损坏

**症状**:
```bash
Error: Cannot read task data file. File is corrupted.
```

**解决方案**:

#### 检查数据文件
```bash
# 检查数据文件状态
ls -la ~/.codex-father/data/

# 验证 JSON 格式
jq . ~/.codex-father/data/tasks.json
```

#### 重建数据文件
```bash
# 备份现有数据
cp -r ~/.codex-father/data ~/.codex-father/data.backup

# 重建数据文件
codex-father repair --rebuild-data
```

## 🔧 调试技巧

### 启用详细日志

```bash
# 启动调试模式
codex-father mcp --verbose --log-level debug

# 设置环境变量
export DEBUG=codex-father:*
export CODEX_FATHER_LOG_LEVEL=debug
codex-father mcp
```

### 使用测试模式

```bash
# 测试模式，不实际执行任务
codex-father run tasks.json --dry-run

# MCP 测试模式
codex-father mcp --test-mode
```

### 检查系统状态

```bash
# 详细状态信息
codex-father status --detailed --performance

# 导出状态用于分析
codex-father status --export json > status.json
```

### 使用诊断工具

```bash
# 系统诊断
codex-father diagnose --all

# 检查配置
codex-father diagnose --config

# 检查权限
codex-father diagnose --permissions
```

## 📞 获取帮助

### 自助资源

- **查看帮助**: `codex-father --help`
- **配置文档**: [配置指南](../configuration/overview.md)
- **API 文档**: [API 参考](../reference/api.md)

### 社区支持

- **GitHub Issues**: [报告问题](https://github.com/your-org/codex-father/issues)
- **讨论区**: [GitHub Discussions](https://github.com/your-org/codex-father/discussions)
- **文档**: [在线文档](https://docs.codex-father.com)

### 报告问题时请提供

1. **系统信息**:
   ```bash
   codex-father --version
   node --version
   npm --version
   uname -a
   ```

2. **配置信息**:
   ```bash
   codex-father config show
   ```

3. **错误日志**:
   ```bash
   codex-father logs --all --level error
   ```

4. **复现步骤**:
   - 详细的操作步骤
   - 预期结果 vs 实际结果
   - 相关的配置文件

## ✅ 预防措施

### 定期维护

```bash
# 定期清理
codex-father cleanup --all

# 检查系统健康
codex-father diagnose --all

# 备份配置
codex-father config show > config-backup.json
```

### 监控设置

```bash
# 设置监控脚本
cat > monitor.sh << 'EOF'
#!/bin/bash
while true; do
  if ! codex-father status > /dev/null 2>&1; then
    echo "Codex Father 状态异常，正在重启..."
    pkill -f codex-father
    sleep 5
    codex-father mcp &
  fi
  sleep 60
done
EOF

chmod +x monitor.sh
./monitor.sh &
```

### 配置最佳实践

1. **定期备份配置文件**
2. **使用版本控制管理配置**
3. **设置合理的资源限制**
4. **启用日志记录**
5. **定期更新系统**

---

**💡 提示**: 大多数问题都可以通过检查配置、调整参数或重启服务来解决。如果问题持续存在，请查看详细的错误日志或在社区寻求帮助。