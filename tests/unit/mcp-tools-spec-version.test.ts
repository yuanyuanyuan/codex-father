import { describe, it, expect } from 'vitest';
import { toolsSpec } from '../../mcp/codex-mcp-server/src/tools/spec.js';
import { normalizeToolName } from '../../mcp/codex-mcp-server/src/utils/toolNames.js';

describe('MCP tools spec includes codex.version (T-MCP-TOOLS-VERSION)', () => {
  it('has codex.version tool', () => {
    const spec = toolsSpec();
    const names = spec.tools.map((t) => normalizeToolName(t.name));
    expect(names).toContain('codex.version');
  });
});
