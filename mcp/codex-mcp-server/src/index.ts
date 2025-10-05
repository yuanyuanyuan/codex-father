#!/usr/bin/env node
import { createRequire } from 'node:module';
import os from 'node:os';
import process from 'node:process';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { parseCliArgs, parseEnv } from './config/env.js';
import { CliLogger } from './logger.js';
import { toolsSpec } from './tools/spec.js';
import { handleCall } from './handlers/index.js';
import { resolvePaths } from './utils/resolvePaths.js';
import { createTransport, describeTransport } from './transport/factory.js';
import type { HandlerContext } from './handlers/types.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { name?: string; version?: string };

function printHelp() {
  const binary = pkg.name || 'codex-mcp-server';
  const lines = [
    `${binary} v${pkg.version || 'unknown'} — Codex Father MCP Server`,
    '',
    '用法：',
    '  node dist/index.js [--transport=ndjson|content-length] [--help] [--version]',
    '',
    '说明：',
    '  --transport    指定传输协议：',
    '                 - ndjson（默认，与 @modelcontextprotocol/sdk stdio 行为一致）',
    '                 - content-length（兼容 Content-Length 分帧的客户端）',
    '                 提示：若你的客户端严格要求 Content-Length，请显式添加 --transport=content-length。',
    '  --help, -h     显示本帮助信息后退出。',
    '  --version, -V  显示版本信息后退出。',
    '',
    '常用环境变量：',
    '  LOG_LEVEL                控制日志级别（debug/info/warn/error/silent）。',
    '  CODEX_MCP_NAME_STYLE     控制导出工具命名风格（underscore-only/dot-only）。',
    '  CODEX_MCP_TOOL_PREFIX    为工具生成前缀别名。',
    '  CODEX_MCP_HIDE_ORIGINAL  为 1/true 时仅保留别名。',
    '  CODEX_MCP_PROJECT_ROOT   指定包含 job.sh/start.sh 的仓库根目录。',
    '  MAX_CONCURRENT_JOBS      自定义并发限制（正整数）。',
    '  APPROVAL_POLICY          默认审批策略（untrusted/on-failure/on-request/never）。',
    '',
    '示例：',
    '  LOG_LEVEL=debug node dist/index.js',
    '  node dist/index.js --transport=content-length',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function printVersion() {
  const binary = pkg.name || 'codex-mcp-server';
  process.stdout.write(`${binary} ${pkg.version || 'unknown'}\n`);
}

async function main() {
  const parsedCli = parseCliArgs(process.argv.slice(2));

  if (parsedCli.showHelp) {
    printHelp();
    return;
  }

  if (parsedCli.showVersion) {
    printVersion();
    return;
  }

  const envConfig = parseEnv();
  const logger = new CliLogger(envConfig.logLevel);

  const resolvedPaths = resolvePaths();

  const banner = [
    `${pkg.name || 'codex-mcp-server'} v${pkg.version || 'unknown'} (${process.pid})`,
    `Node ${process.version} on ${os.platform()} ${os.release()}`,
    `Transport：${describeTransport(parsedCli.transport)}`,
    `LOG_LEVEL=${envConfig.logLevel}`,
    `CODEX_MCP_NAME_STYLE=${envConfig.nameStyle || '(未设置)'}`,
    `CODEX_MCP_TOOL_PREFIX=${envConfig.toolPrefix || '(未设置)'}`,
    `CODEX_MCP_HIDE_ORIGINAL=${envConfig.hideOriginal ? 'true' : 'false'}`,
    `MAX_CONCURRENT_JOBS=${envConfig.maxConcurrentJobs ?? '(未设置)'}`,
    `APPROVAL_POLICY=${envConfig.approvalPolicy || '(未设置)'}`,
    `PROJECT_ROOT=${resolvedPaths.projectRoot}`,
  ];
  logger.banner(banner);

  if (parsedCli.unknownArgs.length) {
    for (const arg of parsedCli.unknownArgs) {
      logger.warn(`忽略未知参数：${arg}`);
    }
  }

  if (envConfig.warnings.length) {
    for (const warning of envConfig.warnings) {
      logger.warn(warning);
    }
  }

  const context: HandlerContext = {
    jobSh: resolvedPaths.jobSh.path,
    startSh: resolvedPaths.startSh.path,
    projectRoot: resolvedPaths.projectRoot,
    jobShExists: resolvedPaths.jobSh.exists,
    startShExists: resolvedPaths.startSh.exists,
  };

  if (!context.jobShExists) {
    logger.warn(
      `未在 ${context.jobSh} 找到 job.sh，可通过 CODEX_MCP_PROJECT_ROOT 或 CODEX_JOB_SH 覆盖。`
    );
  }
  if (!context.startShExists) {
    logger.warn(
      `未在 ${context.startSh} 找到 start.sh，可通过 CODEX_MCP_PROJECT_ROOT 或 CODEX_START_SH 覆盖。`
    );
  }

  const server = new Server(
    { name: 'codex-father-mcp', version: pkg.version || '0.1.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => toolsSpec());
  server.setRequestHandler(CallToolRequestSchema, async (req) => handleCall(req, context));

  server.oninitialized = () => {
    logger.info('已完成 MCP initialize 握手。');
  };

  server.onclose = () => {
    logger.warn('传输已关闭，进程将退出。');
  };

  server.onerror = (error: unknown) => {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`传输错误：${err.message}`);
    if (/content-length/i.test(err.message)) {
      logger.error('提示：若客户端使用 Content-Length 分帧，请使用 --transport=content-length。');
    }
  };

  const transport = createTransport(parsedCli.transport, logger);
  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.warn(`收到 ${signal}，正在关闭传输…`);
    try {
      await transport.close();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`关闭传输时出错：${err.message}`);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await server.connect(transport);
    logger.info('等待 MCP 客户端发送 initialize 请求…');
    logger.info('提示：可在新终端执行 `npm run rmcp:client -- list-tools` 体验示例客户端。');
    if (!process.stdin.readableFlowing) {
      process.stdin.resume();
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(`启动传输失败：${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack || err.message : String(err);
  process.stderr.write(`[codex-mcp] fatal: ${msg}\n`);
  process.exit(1);
});
