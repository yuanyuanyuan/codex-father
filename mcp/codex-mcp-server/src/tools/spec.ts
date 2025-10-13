import type { ListToolsResult } from '@modelcontextprotocol/sdk/types.js';

type ToolDef = ListToolsResult['tools'][number];

// presets removed in v1.1

function canonicalTools(): ToolDef[] {
  return [
    {
      name: 'codex.version',
      description: 'Return version information for Codex Father (core + MCP) and runtime.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: 'codex.help',
      description:
        'Discover available codex.* tools and see usage examples. Optionally provide a specific tool name.',
      inputSchema: {
        type: 'object',
        properties: {
          tool: { type: 'string' },
          format: { type: 'string', enum: ['markdown', 'json'] },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'codex.exec',
      description: 'Run a synchronous codex execution; returns when finished.',
      inputSchema: {
        type: 'object',
        properties: {
          args: { type: 'array', items: { type: 'string' } },
          tag: { type: 'string' },
          cwd: { type: 'string' },
          approvalPolicy: {
            type: 'string',
            enum: ['untrusted', 'on-failure', 'on-request', 'never'],
          },
          sandbox: {
            type: 'string',
            enum: ['read-only', 'workspace-write', 'danger-full-access'],
          },
          network: { type: 'boolean' },
          dangerouslyBypass: { type: 'boolean' },
          profile: { type: 'string' },
          codexConfig: { type: 'object', additionalProperties: true },
          // preset removed
          carryContext: { type: 'boolean' },
          compressContext: { type: 'boolean' },
          contextHead: { type: 'integer' },
          patchMode: { type: 'boolean' },
          requireChangeIn: { type: 'array', items: { type: 'string' } },
          requireGitCommit: { type: 'boolean' },
          autoCommitOnDone: { type: 'boolean' },
          autoCommitMessage: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'codex.start',
      description: 'Start a non-blocking codex run; returns jobId immediately.',
      inputSchema: {
        type: 'object',
        properties: {
          args: { type: 'array', items: { type: 'string' } },
          tag: { type: 'string' },
          cwd: { type: 'string' },
          approvalPolicy: {
            type: 'string',
            enum: ['untrusted', 'on-failure', 'on-request', 'never'],
          },
          sandbox: {
            type: 'string',
            enum: ['read-only', 'workspace-write', 'danger-full-access'],
          },
          network: { type: 'boolean' },
          dangerouslyBypass: { type: 'boolean' },
          profile: { type: 'string' },
          codexConfig: { type: 'object', additionalProperties: true },
          // preset removed
          carryContext: { type: 'boolean' },
          compressContext: { type: 'boolean' },
          contextHead: { type: 'integer' },
          patchMode: { type: 'boolean' },
          requireChangeIn: { type: 'array', items: { type: 'string' } },
          requireGitCommit: { type: 'boolean' },
          autoCommitOnDone: { type: 'boolean' },
          autoCommitMessage: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'codex.resume',
      description: 'Reuse stored arguments of a finished codex job and start a new run.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          args: { type: 'array', items: { type: 'string' } },
          tag: { type: 'string' },
          cwd: { type: 'string' },
          strategy: { type: 'string', enum: ['full-restart', 'from-last-checkpoint', 'from-step'] },
          resumeFrom: { type: 'integer', minimum: 1 },
          resumeFromStep: { type: 'integer', minimum: 1 },
          skipCompleted: { type: 'boolean' },
          reuseArtifacts: { type: 'boolean' },
          approvalPolicy: {
            type: 'string',
            enum: ['untrusted', 'on-failure', 'on-request', 'never'],
          },
          sandbox: {
            type: 'string',
            enum: ['read-only', 'workspace-write', 'danger-full-access'],
          },
          network: { type: 'boolean' },
          dangerouslyBypass: { type: 'boolean' },
          profile: { type: 'string' },
          codexConfig: { type: 'object', additionalProperties: true },
          // preset removed
          carryContext: { type: 'boolean' },
          compressContext: { type: 'boolean' },
          contextHead: { type: 'integer' },
          patchMode: { type: 'boolean' },
          requireChangeIn: { type: 'array', items: { type: 'string' } },
          requireGitCommit: { type: 'boolean' },
          autoCommitOnDone: { type: 'boolean' },
          autoCommitMessage: { type: 'string' },
        },
        required: ['jobId'],
        additionalProperties: false,
      },
    },
    {
      name: 'codex.reply',
      description:
        'Append or prepend a user reply to an existing job and resume with the same configuration.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          message: { type: 'string' },
          messageFile: { type: 'string' },
          role: { type: 'string', enum: ['user', 'system'] },
          position: { type: 'string', enum: ['append', 'prepend'] },
          tag: { type: 'string' },
          cwd: { type: 'string' },
          args: { type: 'array', items: { type: 'string' } },
          approvalPolicy: {
            type: 'string',
            enum: ['untrusted', 'on-failure', 'on-request', 'never'],
          },
          sandbox: {
            type: 'string',
            enum: ['read-only', 'workspace-write', 'danger-full-access'],
          },
          network: { type: 'boolean' },
          dangerouslyBypass: { type: 'boolean' },
          profile: { type: 'string' },
          codexConfig: { type: 'object', additionalProperties: true },
          // preset removed
          carryContext: { type: 'boolean' },
          compressContext: { type: 'boolean' },
          contextHead: { type: 'integer' },
          patchMode: { type: 'boolean' },
          requireChangeIn: { type: 'array', items: { type: 'string' } },
          requireGitCommit: { type: 'boolean' },
          autoCommitOnDone: { type: 'boolean' },
          autoCommitMessage: { type: 'string' },
        },
        required: ['jobId'],
        additionalProperties: false,
      },
    },
    {
      name: 'codex.status',
      description: 'Inspect the state of a codex background job.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          cwd: { type: 'string' },
        },
        required: ['jobId'],
        additionalProperties: false,
      },
    },
    {
      name: 'codex.logs',
      description: 'Fetch logs for a codex background job.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          mode: { type: 'string', enum: ['bytes', 'lines'] },
          offset: { type: 'integer' },
          limit: { type: 'integer' },
          offsetLines: { type: 'integer' },
          limitLines: { type: 'integer' },
          tailLines: { type: 'integer' },
          grep: { type: 'string' },
          view: { type: 'string', enum: ['default', 'result-only', 'debug'] },
          cwd: { type: 'string' },
        },
        required: ['jobId'],
        additionalProperties: false,
      },
    },
    {
      name: 'codex.stop',
      description: 'Terminate a codex background job.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
          force: { type: 'boolean' },
          cwd: { type: 'string' },
        },
        required: ['jobId'],
        additionalProperties: false,
      },
    },
    {
      name: 'codex.list',
      description: 'List known codex background jobs stored on disk.',
      inputSchema: {
        type: 'object',
        properties: {
          cwd: { type: 'string' },
          state: { type: 'array', items: { type: 'string' } },
          tagContains: { type: 'string' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'codex.clean',
      description: 'Clean finished codex sessions according to filters.',
      inputSchema: {
        type: 'object',
        properties: {
          cwd: { type: 'string' },
          states: { type: 'array', items: { type: 'string' } },
          olderThanHours: { type: 'number' },
          limit: { type: 'integer' },
          dryRun: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'codex.metrics',
      description: 'Summarise codex task metrics (counts, durations, usage).',
      inputSchema: {
        type: 'object',
        properties: {
          cwd: { type: 'string' },
          states: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    },
    {
      name: 'codex.message',
      description: 'Send a message to a job mailbox for cross-job collaboration.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string' },
          message: { type: 'string' },
          from: { type: 'string' },
          channel: { type: 'string', enum: ['default', 'info', 'note', 'alert'] },
          cwd: { type: 'string' },
        },
        required: ['to', 'message'],
        additionalProperties: false,
      },
    },
  ];
}

function createAlias(tool: ToolDef, name: string): ToolDef {
  return {
    ...tool,
    name,
    description: `Alias of ${tool.name} (same behavior).`,
  };
}

function addPrefixAliases(tools: ToolDef[], canonical: ToolDef[], prefix: string): void {
  if (!prefix) {
    return;
  }
  const suffix = (name: string): string => name.replace(/^codex[._]/, '');
  const canonicalByName = new Map(canonical.map((t) => [t.name, t]));
  for (const tool of canonical) {
    const base = canonicalByName.get(tool.name);
    if (!base) {
      continue;
    }
    const dotName = `${prefix}.${suffix(tool.name)}`;
    const underName = `${prefix}_${suffix(tool.name)}`;
    tools.push(createAlias(base, dotName));
    tools.push(createAlias(base, underName));
  }
}

export function toolsSpec(): ListToolsResult {
  const rawStyle = String(process.env.CODEX_MCP_NAME_STYLE || '').toLowerCase();
  const allowedStyles = new Set(['underscore-only', 'dot-only']);
  const nameStyle = allowedStyles.has(rawStyle) ? rawStyle : '';
  const prefix = String(process.env.CODEX_MCP_TOOL_PREFIX || '').trim();
  const hideOriginal =
    String(process.env.CODEX_MCP_HIDE_ORIGINAL || '') === '1' ||
    String(process.env.CODEX_MCP_HIDE_ORIGINAL || '').toLowerCase() === 'true';

  const canonical = canonicalTools();
  const tools: ToolDef[] = [...canonical];

  for (const tool of canonical) {
    const aliasName = tool.name.replace('.', '_');
    tools.push(createAlias(tool, aliasName));
  }

  // Additional friendly aliases for message tool
  const messageBase = canonical.find((t) => t.name === 'codex.message');
  if (messageBase) {
    tools.push(createAlias(messageBase, 'codex.send_message'));
    tools.push(createAlias(messageBase, 'codex_send_message'));
  }

  if (prefix) {
    addPrefixAliases(tools, canonical, prefix);
  }

  if (hideOriginal) {
    const canonicalNames = new Set(canonical.map((tool) => tool.name));
    const filtered = tools.filter((tool) => !canonicalNames.has(tool.name));
    if (filtered.length > 0) {
      tools.length = 0;
      tools.push(...filtered);
    }
  }

  let filtered = tools;
  if (nameStyle === 'underscore-only') {
    filtered = tools.filter((t) => !t.name.includes('.'));
  } else if (nameStyle === 'dot-only') {
    filtered = tools.filter((t) => t.name.includes('.'));
  }

  const seen = new Set<string>();
  const uniq: ToolDef[] = [];
  for (const tool of filtered) {
    if (!seen.has(tool.name)) {
      seen.add(tool.name);
      uniq.push(tool);
    }
  }

  if (uniq.length > 0) {
    return { tools: uniq };
  }

  const fallback = canonical.filter((tool) => {
    if (nameStyle === 'underscore-only') {
      return !tool.name.includes('.');
    }
    if (nameStyle === 'dot-only') {
      return tool.name.includes('.');
    }
    return true;
  });

  return { tools: fallback.length ? fallback : canonical };
}
