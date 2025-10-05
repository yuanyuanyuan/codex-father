#!/usr/bin/env node
import { Command } from 'commander';
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const filePath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(filePath);
const repoRoot = path.resolve(scriptDir, '..');
const serverRoot = path.join(repoRoot, 'mcp', 'codex-mcp-server');
const defaultServerCommand = process.env.CODEX_RMCP_SERVER_COMMAND ?? 'node';
const defaultServerArgs = process.env.CODEX_RMCP_SERVER_ARGS
  ? splitArgs(process.env.CODEX_RMCP_SERVER_ARGS)
  : [path.join(serverRoot, 'dist', 'index.js')];
const defaultTimeout = Number.parseInt(process.env.CODEX_RMCP_TIMEOUT ?? '', 10);

function splitArgs(value) {
  return value
    .match(/(?:"[^"]*"|'[^']*'|[^\s"]+)+/g)
    ?.map((token) => token.replace(/^"|"$/g, '').replace(/^'|'$/g, '')) ?? [];
}

function collectKeyValue(value, previous) {
  const separator = value.indexOf('=');
  if (separator === -1) {
    throw new Error(`无效的环境变量定义：${value}，正确示例：KEY=value`);
  }
  const key = value.slice(0, separator);
  const val = value.slice(separator + 1);
  return { ...previous, [key]: val };
}

async function withClient(globalOptions, run) {
  const transport = new StdioClientTransport({
    command: globalOptions.server,
    args: globalOptions.serverArgs,
    env: { ...process.env, ...globalOptions.serverEnv },
    stderr: globalOptions.pipeServerStderr ? 'pipe' : 'inherit',
    cwd: globalOptions.cwd,
  });

  if (globalOptions.verbose) {
    const originalSend = transport.send.bind(transport);
    transport.send = async (message) => {
      console.log('[rmcp-client] ->', JSON.stringify(message));
      return originalSend(message);
    };
    const originalOnclose = transport.onclose;
    transport.onclose = (...args) => {
      console.log('[rmcp-client] transport closed');
      originalOnclose?.(...args);
    };
    const originalOnerror = transport.onerror;
    transport.onerror = (error) => {
      console.error('[rmcp-client] transport error:', error);
      originalOnerror?.(error);
    };
  }

  if (globalOptions.pipeServerStderr) {
    const stderrStream = transport.stderr;
    if (stderrStream) {
      stderrStream.pipe(process.stderr);
    }
  }

  const client = new Client({
    name: 'codex-rmcp-client',
    version: '0.1.0',
  }, {
    enforceStrictCapabilities: false,
  });
  client.registerCapabilities({
    tools: {},
    logging: {},
  });

  try {
    if (globalOptions.verbose) {
      console.log('[rmcp-client] 正在启动 MCP 服务器…');
    }
    await client.connect(transport, { timeout: globalOptions.timeout });
    if (globalOptions.verbose && client.transport) {
      const originalOnmessage = client.transport.onmessage;
      client.transport.onmessage = (message, extra) => {
        console.log('[rmcp-client] <-', JSON.stringify(message));
        originalOnmessage?.(message, extra);
      };
    }
    if (globalOptions.verbose) {
      console.log('[rmcp-client] 已完成 initialize 握手。');
    }
    await run(client);
  } catch (error) {
    if (globalOptions.verbose) {
      console.error('[rmcp-client] 连接失败:', error);
    }
    throw error;
  } finally {
    await client.close().catch(() => undefined);
  }
}

function formatTool(tool) {
  const aliases = tool.aliases?.length ? ` (别名: ${tool.aliases.join(', ')})` : '';
  const description = tool.description ? `\n    描述: ${tool.description}` : '';
  return `- ${tool.name}${aliases}${description}`;
}

const program = new Command();
program
  .name('codex-rmcp-client')
  .description('Codex Father 示例 rMCP 客户端，使用 @modelcontextprotocol/sdk 实现。')
  .option('--server <command>', '用于启动 MCP 服务器的命令', defaultServerCommand)
  .option('--server-args <values...>', '传递给 MCP 服务器命令的参数', defaultServerArgs)
  .option('--cwd <path>', '启动 MCP 服务器时的工作目录', serverRoot)
  .option('--server-env <KEY=VALUE>', '为 MCP 服务器设置额外环境变量，可重复', collectKeyValue, {})
  .option('--pipe-server-stderr', '将服务器 stderr 输出到当前终端')
  .option('--timeout <ms>', 'MCP 请求超时时间（毫秒）', (value) => Number.parseInt(value, 10), Number.isFinite(defaultTimeout) ? defaultTimeout : 15000)
  .option('--verbose', '输出额外调试日志');

program
  .command('list-tools')
  .description('列出服务器提供的工具')
  .action(async (_cmdOptions, command) => {
    const globalOptions = command.parent.opts();
    try {
      await withClient(globalOptions, async (client) => {
        const result = await client.listTools({});
        if (!result.tools.length) {
          console.log('未获取到任何工具，检查服务器是否正常初始化。');
          return;
        }
        console.log(`共 ${result.tools.length} 个工具：`);
        for (const tool of result.tools) {
          console.log(formatTool(tool));
        }
      });
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('call-tool <name>')
  .description('调用指定工具，可通过 --arguments 传入 JSON 形式的参数')
  .option('--arguments <json>', '工具参数（JSON 字符串）', '{}')
  .action(async (name, cmdOptions, command) => {
    let parsedArgs;
    try {
      parsedArgs = JSON.parse(cmdOptions.arguments ?? '{}');
    } catch (error) {
      handleError(new Error(`无法解析 --arguments：${error instanceof Error ? error.message : String(error)}`));
      return;
    }

    const globalOptions = command.parent.opts();
    try {
      await withClient(globalOptions, async (client) => {
        const result = await client.callTool({
          name,
          arguments: parsedArgs,
        });
        console.log(JSON.stringify(result, null, 2));
      });
    } catch (error) {
      handleError(error);
    }
  });

program
  .command('ping')
  .description('发送 ping 请求，检验基础连通性')
  .action(async (_cmdOptions, command) => {
    const globalOptions = command.parent.opts();
    try {
      await withClient(globalOptions, async (client) => {
        await client.ping();
        console.log('ping 成功，服务器在线。');
      });
    } catch (error) {
      handleError(error);
    }
  });

program
  .showSuggestionAfterError()
  .exitOverride();

function handleError(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[rmcp-client] ${message}`);
  if (message.includes('Connection closed')) {
    console.error('[rmcp-client] 建议：确认服务器未提前退出，可使用 --verbose 查看握手日志。');
  }
  if (error?.stack) {
    console.debug(error.stack);
  }
  process.exitCode = 1;
}

(async () => {
  try {
    if (process.argv.length <= 2) {
      program.help();
      return;
    }
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error?.code === 'commander.helpDisplayed') {
      return;
    }
    handleError(error);
  }
})();
