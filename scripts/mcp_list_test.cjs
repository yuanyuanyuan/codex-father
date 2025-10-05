#!/usr/bin/env node
// Simple MCP stdio client to query tools/list from our server with custom env
// Usage:
//   node scripts/mcp_list_test.cjs --env CODEX_MCP_NAME_STYLE=dot-only --env CODEX_MCP_TOOL_PREFIX=cf --env CODEX_MCP_HIDE_ORIGINAL=true
//   node scripts/mcp_list_test.cjs              # no extra env

const { spawn } = require('node:child_process');

function parseArgs(argv) {
  const env = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--env' && i + 1 < argv.length) {
      const kv = String(argv[++i]);
      const [k, ...rest] = kv.split('=');
      env[k] = rest.join('=');
    }
  }
  return { env };
}

function createReader(onMessage) {
  let pending = '';
  return (chunk) => {
    pending += chunk.toString('utf8');
    let idx;
    while ((idx = pending.indexOf('\n')) >= 0) {
      const line = pending.slice(0, idx).replace(/\r$/, '');
      pending = pending.slice(idx + 1);
      if (!line.trim()) {
        continue;
      }
      try {
        const msg = JSON.parse(line);
        onMessage(msg);
      } catch (e) {
        console.error('Failed to parse JSON line:', e, line);
      }
    }
  };
}

async function main() {
  const { env: extraEnv } = parseArgs(process.argv);
  const child = spawn('node', ['./mcp/codex-mcp-server/dist/index.js'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env, ...extraEnv },
  });

  const pending = new Map();
  let nextId = 1;

  const read = createReader((msg) => {
    if (typeof msg.id !== 'undefined' && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
    } else {
      // Notifications or unexpected messages
    }
  });
  child.stdout.on('data', read);

  function request(method, params) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      const msg = { jsonrpc: '2.0', id, method, params };
      child.stdin.write(JSON.stringify(msg) + '\n');
    });
  }

  // 1) initialize
  const initResp = await request('initialize', {
    protocolVersion: '2025-03-26',
    clientInfo: { name: 'mcp-list-test', version: '0.0.1' },
    capabilities: {},
  });
  if (initResp.error) {
    throw new Error('initialize failed: ' + JSON.stringify(initResp.error));
  }

  // 2) tools/list
  const listResp = await request('tools/list', {});
  if (listResp.error) {
    throw new Error('tools/list failed: ' + JSON.stringify(listResp.error));
  }
  const names = (listResp.result?.tools || []).map((t) => t.name);
  console.log(JSON.stringify({ tools: names }, null, 2));

  child.kill();
}

main().catch((e) => {
  console.error('[mcp_list_test] error:', e);
  process.exit(1);
});
