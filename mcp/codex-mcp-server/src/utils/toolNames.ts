const CANONICAL_NAMES = [
  'codex.help',
  'codex.exec',
  'codex.start',
  'codex.resume',
  'codex.reply',
  'codex.status',
  'codex.logs',
  'codex.stop',
  'codex.list',
  'codex.clean',
  'codex.metrics',
  'codex.message',
] as const;

type CanonicalName = (typeof CANONICAL_NAMES)[number];

const STATIC_ALIASES: Record<string, CanonicalName> = {
  codex_help: 'codex.help',
  codex_exec: 'codex.exec',
  codex_start: 'codex.start',
  codex_resume: 'codex.resume',
  codex_reply: 'codex.reply',
  codex_status: 'codex.status',
  codex_logs: 'codex.logs',
  codex_stop: 'codex.stop',
  codex_list: 'codex.list',
  codex_clean: 'codex.clean',
  codex_metrics: 'codex.metrics',
  codex_message: 'codex.message',
  codex_send_message: 'codex.message',
};

export function normalizeToolName(input: string): string {
  if (!input) {
    return input;
  }
  if ((STATIC_ALIASES as Record<string, string>)[input]) {
    return STATIC_ALIASES[input];
  }
  const prefix = String(process.env.CODEX_MCP_TOOL_PREFIX || '').trim();
  if (!prefix) {
    return input;
  }

  for (const canonical of CANONICAL_NAMES) {
    const suffix = canonical.replace(/^codex[._]/, '');
    if (input === `${prefix}_${suffix}` || input === `${prefix}.${suffix}`) {
      return canonical;
    }
  }
  return input;
}

export function canonicalToolNames(): CanonicalName[] {
  return [...CANONICAL_NAMES];
}
