#!/usr/bin/env node

import { spawn } from 'node:child_process';
import readline from 'node:readline';
import { once } from 'node:events';
import path from 'node:path';
import process from 'node:process';

async function main() {
  const [, , entryArg, projectRoot] = process.argv;
  if (!entryArg || !projectRoot) {
    console.error('[mcp-fallback] usage: node mcp_fallback_e2e.js <entry> <projectRoot>');
    process.exit(1);
  }
  const entry = path.resolve(entryArg);
  const env = {
    ...process.env,
    CODEX_MCP_PROJECT_ROOT: projectRoot,
    CODEX_JOB_SH: path.join(projectRoot, 'job.sh'),
    CODEX_START_SH: path.join(projectRoot, 'start.sh'),
    LOG_LEVEL: 'error',
  };
  const child = spawn('node', [entry], {
    env,
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const stderrChunks = [];
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderrChunks.push(chunk);
  });

  const rl = readline.createInterface({ input: child.stdout });

  const send = (msg) => {
    child.stdin.write(`${JSON.stringify(msg)}\n`);
  };

  const readResponse = async () => {
    const [line] = await once(rl, 'line');
    try {
      return JSON.parse(line);
    } catch (error) {
      throw new Error(`无法解析服务端响应：${line}`);
    }
  };

  const awaitValue = async () => {
    const response = await readResponse();
    if (response.error) {
      throw new Error(`服务端返回错误：${JSON.stringify(response.error)}`);
    }
    return response.result;
  };

  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-09-18',
      capabilities: {},
      clientInfo: { name: 'fallback-e2e', version: '0.0.0' },
    },
  });
  await awaitValue();

  send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: 'codex.exec',
      arguments: {
        command: 'echo fallback-exec',
        tag: 'fallback-e2e',
      },
    },
  });
  const execResult = await awaitValue();
  const execStructured = execResult && execResult.structuredContent;
  if (!execStructured) {
    throw new Error('codex.exec 未返回 structuredContent');
  }
  if ((execStructured?.stdout ?? '') !== 'fallback-exec') {
    throw new Error(`codex.exec stdout 异常：${JSON.stringify(execStructured)}`);
  }

  send({
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
      name: 'codex.start',
      arguments: {
        command: 'echo fallback-start',
        tag: 'fallback-test',
      },
    },
  });
  const startResult = await awaitValue();
  const startStructured = startResult && startResult.structuredContent;
  const jobId = typeof startStructured?.jobId === 'string' ? startStructured.jobId : '';
  if (!jobId) {
    throw new Error(`codex.start 未返回 jobId：${JSON.stringify(startResult)}`);
  }

  let status = '';
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    send({
      jsonrpc: '2.0',
      id: 100 + attempt,
      method: 'tools/call',
      params: {
        name: 'codex.status',
        arguments: { jobId },
      },
    });
    const statusResult = await awaitValue();
    const statusStructured = statusResult && statusResult.structuredContent;
    status = typeof statusStructured?.status === 'string' ? statusStructured.status : '';
    if (status && status !== 'running') {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (status !== 'succeeded' && status !== 'stopped' && status !== 'failed') {
    throw new Error(`codex.status 返回异常状态：${status}`);
  }

  child.stdin.end();
  rl.close();
  child.kill('SIGTERM');
  await once(child, 'close');

  if (stderrChunks.length) {
    const combined = stderrChunks.join('');
    if (combined.trim().length) {
      process.stderr.write(combined);
    }
  }
}

main().catch((error) => {
  console.error(`[mcp-fallback] ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
