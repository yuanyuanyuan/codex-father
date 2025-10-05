#!/usr/bin/env node
/*
  Minimal MCP stdio probe client (black-box). No dependencies.
  - Spawns the server (node <path>) with given env.
  - Speaks JSON-RPC over LSP-style headers (Content-Length).
  - Initializes, lists tools/resources/prompts, and prints results.
*/

const { spawn } = require('node:child_process');

const SERVER_CMD = 'node';
const SERVER_ARGS = ['/data/codex-father/mcp/codex-mcp-server/dist/index.js'];

const SERVER_ENV = {
  ...process.env,
  CODEX_MCP_NAME_STYLE: 'underscore-only',
  LOG_LEVEL: 'info',
  MAX_CONCURRENT_JOBS: '5',
  APPROVAL_POLICY: 'on-failure',
};

const MODE = process.argv.find(a => a.startsWith('--mode='))?.split('=')[1] || 'lsp';

function encodeMessage(msgObj) {
  const json = JSON.stringify(msgObj);
  if (MODE === 'ndjson') {
    return Buffer.from(json + '\n', 'utf8');
  }
  const buf = Buffer.from(json, 'utf8');
  const header = Buffer.from(`Content-Length: ${buf.length}\r\n\r\n`, 'utf8');
  return Buffer.concat([header, buf]);
}

class Framer {
  constructor(onMessage) {
    this.buffer = Buffer.alloc(0);
    this.onMessage = onMessage;
  }
  push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    if (MODE === 'ndjson') {
      while (true) {
        const idx = this.buffer.indexOf('\n');
        if (idx === -1) {return;}
        const line = this.buffer.slice(0, idx).toString('utf8').trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) {continue;}
        try {
          const msg = JSON.parse(line);
          this.onMessage(msg);
        } catch (e) {
          console.error('[parse-error-ndjson]', e.message, '\nLine:', line);
        }
      }
    } else {
      while (true) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {return;} // Wait for more
        const header = this.buffer.slice(0, headerEnd).toString('utf8');
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          // Not an MCP-framed message; try NDJSON fallback parse on lines
          const asText = this.buffer.toString('utf8');
          const nl = asText.indexOf('\n');
          if (nl !== -1) {
            const maybeLine = asText.slice(0, nl).trim();
            try {
              const msg = JSON.parse(maybeLine);
              this.onMessage(msg);
              this.buffer = Buffer.from(asText.slice(nl + 1), 'utf8');
              continue;
            } catch {}
          }
          // Give up and log raw
          console.error('[server-raw]', asText.slice(0, 1000));
          this.buffer = Buffer.alloc(0);
          return;
        }
        const length = parseInt(match[1], 10);
        const totalNeeded = headerEnd + 4 + length; // 4 for \r\n\r\n
        if (this.buffer.length < totalNeeded) {return;} // Wait

        const body = this.buffer.slice(headerEnd + 4, headerEnd + 4 + length).toString('utf8');
        try {
          const msg = JSON.parse(body);
          this.onMessage(msg);
        } catch (e) {
          console.error('[parse-error]', e.message, '\nBody:', body);
        }
        this.buffer = this.buffer.slice(totalNeeded);
      }
    }
  }
}

function nextIdFactory() {
  let id = 1;
  return () => id++;
}

const nextId = nextIdFactory();
const pending = new Map();

function send(server, msg) {
  const id = nextId();
  const full = { jsonrpc: '2.0', id, ...msg };
  server.stdin.write(encodeMessage(full));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timeout waiting for response to ${msg.method}`));
    }, 10000);
    pending.set(id, { resolve: (v) => { clearTimeout(timer); resolve(v); }, reject: (e) => { clearTimeout(timer); reject(e); } });
  });
}

function notify(server, msg) {
  const payload = { jsonrpc: '2.0', ...msg };
  server.stdin.write(encodeMessage(payload));
}

async function main() {
  console.log('[probe] Spawning MCP server...');
  const server = spawn(SERVER_CMD, SERVER_ARGS, { env: SERVER_ENV, stdio: ['pipe', 'pipe', 'pipe'] });

  server.on('error', (err) => {
    console.error('[server-error]', err);
    process.exitCode = 1;
  });
  server.stderr.on('data', (d) => {
    const s = d.toString('utf8');
    // Log a small slice to avoid noise
    process.stderr.write(`[server-stderr] ${s}`);
  });

  const framer = new Framer((msg) => {
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if ('error' in msg) {
        reject(new Error(JSON.stringify(msg.error)));
      } else {
        resolve(msg.result);
      }
    } else {
      console.log('[server-notice]', JSON.stringify(msg));
    }
  });
  server.stdout.on('data', (d) => framer.push(d));

  // Give the server a moment to start
  await new Promise((r) => setTimeout(r, 150));

  console.log('[probe] Initializing...');
  const initParams = {
    method: 'initialize',
    params: {
      protocolVersion: '0.1',
      capabilities: {},
      clientInfo: { name: 'mcp-probe', version: '0.0.1' },
    },
  };
  let capabilities;
  try {
    const result = await send(server, initParams);
    console.log('[probe] initialize result:', JSON.stringify(result));
    capabilities = result && result.capabilities ? result.capabilities : {};
  } catch (e) {
    console.error('[probe] initialize failed:', e.message);
    // Try a fallback without protocolVersion in case the server expects a different shape
    try {
      const result2 = await send(server, { method: 'initialize', params: { capabilities: {}, clientInfo: { name: 'mcp-probe', version: '0.0.1' } } });
      console.log('[probe] initialize (fallback) result:', JSON.stringify(result2));
      capabilities = result2 && result2.capabilities ? result2.capabilities : {};
    } catch (e2) {
      console.error('[probe] initialize fallback failed:', e2.message);
    }
  }

  try {
    notify(server, { method: 'notifications/initialized', params: {} });
  } catch {}

  async function tryCall(method, params = {}) {
    try {
      const res = await send(server, { method, params });
      console.log(`[probe] ${method} ->`, JSON.stringify(res));
      return res;
    } catch (e) {
      console.error(`[probe] ${method} error:`, e.message);
      return null;
    }
  }

  // Discovery attempts
  await tryCall('tools/list', {});
  await tryCall('resources/list', {});
  await tryCall('prompts/list', {});

  // If tools/list returned tools, try the first tool with empty/default params
  let tools;
  try {
    const res = await send(server, { method: 'tools/list', params: {} });
    tools = res && res.tools ? res.tools : [];
    console.log(`[probe] tools discovered: ${tools.map(t => t.name).join(', ') || '(none)'}`);
  } catch {}

  if (tools && tools.length) {
    const t0 = tools[0];
    console.log(`[probe] calling first tool: ${t0.name}`);
    await tryCall('tools/call', { name: t0.name, arguments: {} });

    // Try with a bogus arg to test validation
    await tryCall('tools/call', { name: t0.name, arguments: { __bogus: true } });
  }

  // Basic concurrent calls test if tools exist
  if (tools && tools.length > 1) {
    console.log('[probe] concurrency test (2 parallel tools/call)');
    const calls = tools.slice(0, 2).map((t, i) => send(server, { method: 'tools/call', params: { name: t.name, arguments: {} } }).then(r => ({ ok: true, name: t.name })).catch(e => ({ ok: false, name: t.name, err: e.message })));
    const results = await Promise.allSettled(calls);
    console.log('[probe] concurrency results:', JSON.stringify(results));
  }

  // Graceful exit
  setTimeout(() => {
    try { server.kill(); } catch {}
    process.exit(0);
  }, 500);
}

main().catch((e) => {
  console.error('[probe] fatal:', e);
  process.exit(1);
});
