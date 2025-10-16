# 环境配置指南

本文档详细介绍 Codex Father 2.0 的环境配置选项，包括系统环境、运行环境、安全环境等方面的配置。

## 🎯 配置层次

Codex Father 2.0 支持多层次的配置管理：

1. **系统默认配置** - 内置的默认值
2. **全局配置文件** - `/etc/codex-father/config.json`
3. **用户配置文件** - `~/.codex-father/config.json`
4. **项目配置文件** - `./codex-father.json`
5. **环境变量** - 动态覆盖配置
6. **命令行参数** - 临时覆盖配置

配置优先级：命令行参数 > 环境变量 > 项目配置 > 用户配置 > 全局配置 > 默认配置

## 📋 环境变量参考

### 基础配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `CODEX_FATHER_HOME` | 配置文件目录 | `~/.codex-father` | `/opt/codex-father` |
| `CODEX_FATHER_LOG_LEVEL` | 日志级别 | `info` | `debug` |
| `CODEX_FATHER_LOG_FILE` | 日志文件路径 | - | `/var/log/codex-father.log` |
| `CODEX_FATHER_WORKING_DIRECTORY` | 工作目录 | `./workspace` | `/home/user/projects` |
| `CODEX_FATHER_CONFIG_FILE` | 配置文件路径 | - | `/etc/codex-father/config.json` |

### 运行器配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `CODEX_FATHER_MAX_CONCURRENCY` | 最大并发数 | `10` | `20` |
| `CODEX_FATHER_DEFAULT_TIMEOUT` | 默认超时时间(ms) | `600000` | `1200000` |
| `CODEX_FATHER_MAX_MEMORY_USAGE` | 最大内存使用 | `512MB` | `2GB` |
| `CODEX_FATHER_MAX_CPU_USAGE` | 最大CPU使用率(%) | `80` | `90` |
| `CODEX_FATHER_CPU_MONITORING` | CPU监控开关 | `true` | `false` |

### 服务器配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `CODEX_FATHER_SERVER_PORT` | HTTP服务器端口 | `3000` | `8080` |
| `CODEX_FATHER_SERVER_HOST` | 服务器主机 | `localhost` | `0.0.0.0` |
| `CODEX_FATHER_ENABLE_WEBSOCKET` | WebSocket开关 | `true` | `false` |
| `CODEX_FATHER_MAX_CONNECTIONS` | 最大连接数 | `100` | `200` |
| `CODEX_FATHER_CORS_ORIGIN` | CORS源 | `*` | `https://myapp.com` |

### MCP 配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `CODEX_FATHER_MCP_HEARTBEAT_INTERVAL` | 心跳间隔(ms) | `30000` | `60000` |
| `CODEX_FATHER_MCP_MAX_SESSIONS` | 最大会话数 | `50` | `100` |
| `CODEX_FATHER_MCP_SESSION_TIMEOUT` | 会话超时时间(ms) | `3600000` | `7200000` |

### 安全配置

| 变量名 | 说明 | 默认值 | 示例 |
|--------|------|--------|------|
| `CODEX_FATHER_NETWORK_DISABLED` | 禁用网络访问 | `true` | `false` |
| `CODEX_FATHER_ALLOWED_PATHS` | 允许的路径 | `./workspace` | `/tmp,/home/user` |
| `CODEX_FATHER_MAX_EXECUTION_TIME` | 最大执行时间(ms) | `600000` | `1200000` |
| `CODEX_FATHER_ALLOWED_COMMANDS` | 允许的命令 | `*` | `npm,node,python` |

## ⚙️ 配置文件详解

### 完整配置文件示例

```json
{
  "runner": {
    "maxConcurrency": 10,
    "defaultTimeout": 600000,
    "workingDirectory": "./workspace",
    "maxMemoryUsage": "512MB",
    "maxCpuUsage": 80,
    "cpuMonitoring": true,
    "environment": "nodejs",
    "security": {
      "networkDisabled": true,
      "allowedPaths": ["./workspace", "/tmp"],
      "maxExecutionTime": 600000,
      "allowedCommands": ["npm", "node", "python", "bash"],
      "workingDirectoryRestriction": true
    }
  },
  "server": {
    "port": 3000,
    "host": "localhost",
    "enableWebSocket": true,
    "maxConnections": 100,
    "cors": {
      "origin": "*",
      "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      "allowedHeaders": ["Content-Type", "Authorization"],
      "credentials": true
    },
    "rateLimit": {
      "windowMs": 60000,
      "max": 100,
      "skipSuccessfulRequests": false,
      "message": "请求过于频繁，请稍后再试"
    },
    "security": {
      "helmet": true,
      "compression": true,
      "trustProxy": false
    }
  },
  "mcp": {
    "heartbeatInterval": 30000,
    "maxSessions": 50,
    "sessionTimeout": 3600000,
    "maxMessageSize": "10MB",
    "enableCompression": true
  },
  "logging": {
    "level": "info",
    "file": "./logs/codex-father.log",
    "maxSize": "10MB",
    "maxFiles": 5,
    "rotate": true,
    "compress": true,
    "format": "json",
    "console": true,
    "colors": true
  },
  "storage": {
    "dataDirectory": "./data",
    "backupEnabled": true,
    "backupInterval": 86400000,
    "maxBackups": 7,
    "compression": true
  },
  "monitoring": {
    "enabled": true,
    "metricsInterval": 30000,
    "healthCheckInterval": 10000,
    "performanceTracking": true,
    "exportMetrics": true,
    "metricsFile": "./metrics/metrics.json"
  }
}
```

### 运行器配置

#### 并发控制
```json
{
  "runner": {
    "maxConcurrency": 20,
    "concurrencyStrategy": "adaptive", // "fixed" | "adaptive"
    "adaptiveThreshold": {
      "cpuUsage": 80,
      "memoryUsage": 85,
      "scaleUpDelay": 30000,
      "scaleDownDelay": 60000
    },
    "queueManagement": {
      "maxQueueSize": 1000,
      "priorityLevels": ["low", "normal", "high", "urgent"],
      "fairShareEnabled": true
    }
  }
}
```

#### 任务执行环境
```json
{
  "runner": {
    "environments": {
      "shell": {
        "defaultShell": "/bin/bash",
        "envVars": {
          "PATH": "/usr/local/bin:/usr/bin:/bin",
          "HOME": "/home/user"
        }
      },
      "nodejs": {
        "nodeVersion": "18",
        "envVars": {
          "NODE_ENV": "production",
          "NODE_OPTIONS": "--max-old-space-size=2048"
        }
      },
      "python": {
        "pythonVersion": "3.9",
        "envVars": {
          "PYTHONPATH": "./lib",
          "PYTHONUNBUFFERED": "1"
        }
      }
    }
  }
}
```

### 服务器配置

#### 高级 HTTP 配置
```json
{
  "server": {
    "port": 3000,
    "host": "0.0.0.0",
    "keepAliveTimeout": 65000,
    "headersTimeout": 66000,
    "bodyLimit": "10mb",
    "compression": {
      "level": 6,
      "threshold": "1kb"
    },
    "static": {
      "enabled": true,
      "root": "./public",
      "maxAge": "1d"
    }
  }
}
```

#### WebSocket 配置
```json
{
  "server": {
    "websocket": {
      "enabled": true,
      "path": "/ws",
      "compression": true,
      "maxPayload": "100MB",
      "heartbeatInterval": 30000,
      "heartbeatTimeout": 5000,
      "clientTracking": {
        "enabled": true,
        "maxClients": 1000,
        "cleanupInterval": 60000
      }
    }
  }
}
```

### 日志配置

#### 详细日志设置
```json
{
  "logging": {
    "level": "info",
    "transports": {
      "console": {
        "enabled": true,
        "level": "info",
        "format": "simple",
        "colors": true
      },
      "file": {
        "enabled": true,
        "level": "debug",
        "filename": "./logs/codex-father.log",
        "maxSize": "50MB",
        "maxFiles": 10,
        "rotate": true,
        "compress": true,
        "format": "json"
      },
      "syslog": {
        "enabled": false,
        "host": "localhost",
        "port": 514,
        "facility": "local0"
      }
    },
    "categories": {
      "task": "info",
      "server": "warn",
      "mcp": "debug",
      "security": "error"
    }
  }
}
```

## 🌍 环境特定配置

### 开发环境

```bash
# 开发环境配置
export CODEX_FATHER_LOG_LEVEL=debug
export CODEX_FATHER_MAX_CONCURRENCY=5
export CODEX_FATHER_SERVER_PORT=3001
export NODE_ENV=development
export DEBUG=codex-father:*
```

```json
// dev-config.json
{
  "runner": {
    "maxConcurrency": 5,
    "defaultTimeout": 300000,
    "workingDirectory": "./dev-workspace"
  },
  "server": {
    "port": 3001,
    "cors": {
      "origin": ["http://localhost:3000", "http://localhost:3001"]
    }
  },
  "logging": {
    "level": "debug",
    "console": {
      "colors": true,
      "format": "pretty"
    }
  }
}
```

### 测试环境

```bash
# 测试环境配置
export CODEX_FATHER_LOG_LEVEL=warn
export CODEX_FATHER_MAX_CONCURRENCY=2
export CODEX_FATHER_DEFAULT_TIMEOUT=60000
export NODE_ENV=test
```

```json
// test-config.json
{
  "runner": {
    "maxConcurrency": 2,
    "defaultTimeout": 60000,
    "workingDirectory": "./test-workspace"
  },
  "security": {
    "networkDisabled": true,
    "allowedPaths": ["./test-workspace", "/tmp"]
  },
  "logging": {
    "level": "warn",
    "file": {
      "enabled": false
    }
  }
}
```

### 生产环境

```bash
# 生产环境配置
export CODEX_FATHER_LOG_LEVEL=info
export CODEX_FATHER_MAX_CONCURRENCY=20
export CODEX_FATHER_SERVER_PORT=80
export NODE_ENV=production
export CODEX_FATHER_LOG_FILE=/var/log/codex-father/app.log
```

```json
// prod-config.json
{
  "runner": {
    "maxConcurrency": 20,
    "defaultTimeout": 1200000,
    "workingDirectory": "/opt/codex-father/workspace",
    "maxMemoryUsage": "2GB",
    "maxCpuUsage": 80
  },
  "server": {
    "port": 80,
    "host": "0.0.0.0",
    "enableWebSocket": true,
    "maxConnections": 1000,
    "security": {
      "helmet": true,
      "trustProxy": true
    }
  },
  "logging": {
    "level": "info",
    "file": {
      "enabled": true,
      "filename": "/var/log/codex-father/app.log",
      "maxSize": "100MB",
      "maxFiles": 30,
      "compress": true
    }
  },
  "monitoring": {
    "enabled": true,
    "exportMetrics": true,
    "metricsFile": "/var/log/codex-father/metrics.json"
  }
}
```

## 🔧 配置管理工具

### CLI 配置命令

```bash
# 查看当前配置
codex-father config show

# 查看特定配置项
codex-father config get runner.maxConcurrency

# 设置配置项
codex-father config set runner.maxConcurrency 15

# 删除配置项
codex-father config delete runner.maxConcurrency

# 重置配置
codex-father config reset

# 验证配置
codex-father config validate

# 初始化配置文件
codex-father config init

# 导出配置
codex-father config export > my-config.json

# 导入配置
codex-father config import my-config.json
```

### 配置文件模板

```bash
# 生成默认配置
codex-father config init --template default

# 生成开发环境配置
codex-father config init --template development

# 生成生产环境配置
codex-father config init --template production

# 生成最小配置
codex-father config init --template minimal
```

### 配置合并

```bash
# 合并多个配置文件
codex-father --config base.json --config override.json mcp

# 使用配置目录
codex-father --config-dir ./configs mcp

# 环境特定配置
codex-father --config ./configs/common.json \
             --config ./configs/production.json \
             mcp
```

## 🛡️ 安全配置

### 路径限制

```json
{
  "security": {
    "allowedPaths": [
      "/opt/codex-father/workspace",
      "/tmp/codex-father"
    ],
    "forbiddenPaths": [
      "/etc",
      "/usr/bin",
      "/bin"
    ],
    "pathPatterns": {
      "allowed": ["^/opt/codex-father/.*"],
      "forbidden": [".*\\.ssh.*", ".*\\.gnupg.*"]
    }
  }
}
```

### 命令白名单

```json
{
  "security": {
    "allowedCommands": [
      "npm",
      "node",
      "python",
      "python3",
      "bash",
      "sh",
      "git",
      "curl",
      "wget"
    ],
    "forbiddenCommands": [
      "rm",
      "sudo",
      "su",
      "passwd",
      "chmod",
      "chown"
    ],
    "commandPatterns": {
      "allowed": ["^(npm|node|python) .*"],
      "forbidden": [".*sudo.*", ".*rm -rf.*"]
    }
  }
}
```

### 网络策略

```json
{
  "security": {
    "networkDisabled": true,
    "allowedDomains": [],
    "allowedPorts": [],
    "proxy": {
      "enabled": false,
      "host": "",
      "port": 0,
      "username": "",
      "password": ""
    }
  }
}
```

## 🔍 配置验证

### 配置检查工具

```bash
# 验证配置文件
codex-father config validate --strict

# 检查配置兼容性
codex-father config check-compatibility --version 2.0.0

# 显示配置差异
codex-father config diff current.json template.json

# 生成配置报告
codex-father config report --format markdown
```

### 配置测试

```bash
# 测试运行器配置
codex-father test --config-runner

# 测试服务器配置
codex-father test --config-server

# 测试安全配置
codex-father test --config-security

# 全面配置测试
codex-father test --config-all
```

## 📊 性能调优

### 高性能配置

```json
{
  "runner": {
    "maxConcurrency": 50,
    "adaptiveConcurrency": true,
    "resourceMonitoring": {
      "enabled": true,
      "interval": 5000,
      "thresholds": {
        "cpuUsage": 90,
        "memoryUsage": 85,
        "diskUsage": 80
      }
    }
  },
  "server": {
    "maxConnections": 1000,
    "keepAliveTimeout": 65000,
    "compression": {
      "enabled": true,
      "level": 6,
      "chunkSize": 16384
    }
  },
  "caching": {
    "enabled": true,
    "maxSize": "100MB",
    "ttl": 300000,
    "strategy": "lru"
  }
}
```

### 资源限制配置

```json
{
  "runner": {
    "resourceLimits": {
      "maxMemoryPerTask": "256MB",
      "maxCpuPerTask": 50,
      "maxExecutionTime": 600000,
      "maxFileSize": "100MB"
    }
  },
  "server": {
    "requestLimits": {
      "maxPayloadSize": "50MB",
      "maxHeaderSize": "16KB",
      "maxUrlLength": 4096
    }
  }
}
```

## 🔄 动态配置

### 热重载配置

```bash
# 启用配置热重载
codex-father mcp --hot-reload

# 监听配置文件变化
codex-father mcp --watch-config

# 指定配置监听路径
codex-father mcp --config-watch-path ./configs
```

### 运行时配置更新

```bash
# 更新并发数
codex-father config set runner.maxConcurrency 20 --runtime

# 更新日志级别
codex-father config set logging.level debug --runtime

# 重载配置
codex-father reload-config
```

## ✅ 最佳实践

### 1. 配置文件组织

```
project/
├── configs/
│   ├── base.json          # 基础配置
│   ├── development.json   # 开发环境配置
│   ├── testing.json      # 测试环境配置
│   ├── staging.json      # 预发布环境配置
│   └── production.json   # 生产环境配置
├── codex-father.json     # 当前环境配置（符号链接）
└── .env                  # 环境变量
```

### 2. 环境变量管理

```bash
# .env 文件
CODEX_FATHER_LOG_LEVEL=info
CODEX_FATHER_MAX_CONCURRENCY=10
CODEX_FATHER_WORKING_DIRECTORY=./workspace

# 加载环境变量
source .env
codex-father mcp
```

### 3. 配置版本控制

```json
// .gitignore
codex-father.json
.env
logs/
data/
*.log
```

```json
// codex-father.template.json
{
  "runner": {
    "maxConcurrency": "${MAX_CONCURRENCY}",
    "workingDirectory": "${WORKSPACE}"
  }
}
```

### 4. 配置验证脚本

```bash
#!/bin/bash
# validate-config.sh

echo "验证 Codex Father 配置..."

# 检查配置文件
if [ ! -f "codex-father.json" ]; then
    echo "❌ 配置文件不存在"
    exit 1
fi

# 验证 JSON 格式
if ! jq empty codex-father.json; then
    echo "❌ 配置文件 JSON 格式错误"
    exit 1
fi

# 使用 CLI 验证
if ! codex-father config validate; then
    echo "❌ 配置验证失败"
    exit 1
fi

echo "✅ 配置验证通过"
```

## 🎉 下一步

现在你已经掌握了环境配置的详细方法：

1. **安全配置** → [安全策略详解](../security/policy.md)
2. **性能调优** → [性能优化指南](../configuration/performance.md)
3. **监控配置** → [监控系统配置](../monitoring/setup.md)
4. **故障排除** → [配置问题排查](../troubleshooting/config-issues.md)

---

**💡 提示**: 合理的配置是系统稳定运行的基础。建议根据实际需求和环境特点，选择合适的配置方案，并定期检查和优化配置参数。