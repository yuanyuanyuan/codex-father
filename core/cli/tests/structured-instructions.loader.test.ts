import { mkdtempSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  loadStructuredInstructions,
  prepareStructuredInstructions,
} from '../instructions/index.js';

const FIXED_DATE = new Date('2025-10-06T00:00:00Z');

function createTempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), 'codex-instructions-'));
}

describe('structured instructions loader', () => {
  it('loads JSON instructions and produces normalized file', async () => {
    const dir = createTempDir();
    const sourcePath = path.join(dir, 'instructions.json');
    const payload = {
      version: '1.0',
      id: 'T-unit-json',
      objective: 'demo',
      tasks: [
        {
          id: 'T1',
          steps: [
            {
              id: 'step-1',
              run: 'echo hello',
            },
          ],
        },
      ],
      vcs: {
        branch: 'feature/test',
        commitMessage: 'test commit',
        pr: {
          title: 'test PR',
        },
      },
    };

    await fs.writeFile(sourcePath, JSON.stringify(payload, null, 2), 'utf8');

    const prepared = await prepareStructuredInstructions(sourcePath, {
      outputDir: path.join(dir, 'normalized'),
      now: FIXED_DATE,
    });

    expect(prepared.data.id).toBe('T-unit-json');
    expect(prepared.format).toBe('json');
    expect(prepared.normalizedPath).toMatch(/20251006-000000-T-unit-json\.json$/);

    const normalized = JSON.parse(await fs.readFile(prepared.normalizedPath, 'utf8'));
    expect(normalized.instructions.tasks[0].steps[0].run).toBe('echo hello');
  });

  it('loads YAML instructions and validates expected task id', async () => {
    const dir = createTempDir();
    const sourcePath = path.join(dir, 'instructions.yaml');
    const yamlContent = `
version: '1.0'
id: 'demo-yaml'
objective: 'demo'
tasks:
  - id: 'T032'
    steps:
      - id: 'status'
        run: 'echo status'
vcs:
  branch: 'feat/demo'
  commitMessage: 'demo commit'
  pr:
    title: 'demo pr'
`;

    await fs.writeFile(sourcePath, yamlContent, 'utf8');

    const prepared = await prepareStructuredInstructions(sourcePath, {
      expectedTaskId: 'T032',
      now: FIXED_DATE,
    });

    expect(prepared.format).toBe('yaml');
    expect(prepared.data.tasks).toHaveLength(1);
  });

  it('throws when task id missing in instructions', async () => {
    const dir = createTempDir();
    const sourcePath = path.join(dir, 'instructions.json');
    const payload = {
      version: '1.0',
      id: 'no-task',
      objective: 'demo',
      tasks: [
        {
          id: 'T-other',
          steps: [{ id: 's1', run: 'echo oops' }],
        },
      ],
      vcs: {
        branch: 'feature/test',
        commitMessage: 'test commit',
        pr: {
          title: 'test PR',
        },
      },
    };

    await fs.writeFile(sourcePath, JSON.stringify(payload), 'utf8');

    await expect(
      prepareStructuredInstructions(sourcePath, { expectedTaskId: 'missing' })
    ).rejects.toThrow(/任务 ID 'missing'/);
  });

  it('parses XML instructions via loadStructuredInstructions', async () => {
    const dir = createTempDir();
    const sourcePath = path.join(dir, 'instructions.xml');
    const xmlContent = `
<instructions version="1.0" id="xml-demo">
  <objective>demo objective</objective>
  <tasks>
    <task id="T1">
      <step id="S1">echo xml</step>
    </task>
  </tasks>
  <vcs branch="feat/xml" commitMessage="xml commit">
    <pr title="xml pr" />
  </vcs>
</instructions>
`;

    await fs.writeFile(sourcePath, xmlContent, 'utf8');

    const result = await loadStructuredInstructions(sourcePath);
    expect(result.format).toBe('xml');
    expect(result.data.id).toBe('xml-demo');
    expect(result.data.tasks[0].steps[0].run).toBe('echo xml');
  });
});
