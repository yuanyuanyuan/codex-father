import { describe, it, expect } from 'vitest';
import { VersionCommand } from '../../core/cli/commands/meta-commands.js';

const ROOT_PKG = await import('../../package.json', {
  with: { type: 'json' },
}).then((m: any) => m.default ?? m);

describe('VersionCommand (T-CLI-VERSION-JSON)', () => {
  it('returns JSON when context.json=true', async () => {
    const result = await VersionCommand.handle({
      args: [],
      options: {},
      workingDirectory: process.cwd(),
      configPath: '',
      verbose: false,
      dryRun: false,
      json: true,
      logLevel: 'info',
    });
    expect(result.success).toBe(true);
    const data = (result as any).data;
    expect(data.name).toBe(ROOT_PKG.name);
    expect(data.version).toBe(ROOT_PKG.version);
  });
});
