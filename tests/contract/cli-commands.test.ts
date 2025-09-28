/**
 * Contract tests for the PRD CLI described in contracts/cli-commands.yaml.
 *
 * Each test documents the expected behaviour of a CLI command group. The
 * current implementation does not exist yet, so these tests all fail (Red
 * phase) when the `prd` executable cannot be found or does not satisfy the
 * contract. They will guide the future implementation to satisfy the CLI
 * specification exactly.
 */

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { spawnSync, type SpawnSyncReturns } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI_BIN = 'prd';

let workspaceDir: string;
let configPath: string;
let exportDir: string;
let importSourcePath: string;
let templatesDir: string;

let createdDraftId = '';
let createdTemplateId = '';
let storedReviewId = '';

beforeAll(() => {
  workspaceDir = mkdtempSync(join(tmpdir(), 'prd-cli-contract-'));
  configPath = join(workspaceDir, 'config.yaml');
  exportDir = join(workspaceDir, 'exports');
  importSourcePath = join(workspaceDir, 'import-source.md');
  templatesDir = join(workspaceDir, 'templates');

  mkdirSync(exportDir, { recursive: true });
  mkdirSync(templatesDir, { recursive: true });

  const configContent = [
    'api:',
    '  base_url: http://localhost:3000/api/v1',
    '  timeout: 8000',
    '  retries: 2',
    'auth:',
    '  method: bearer',
    '  token: test-token',
    'user:',
    '  name: Contract Tester',
    '  email: contract@test.example.com',
    '  role: architect',
    'editor:',
    '  command: vim',
    '  args: ["+"]',
    'templates:',
    '  default: technical',
    `  search_paths: ["${templatesDir}"]`,
    'output:',
    '  format: human',
    '  colors: true',
    '  pager: false',
    'behavior:',
    '  auto_save: true',
    '  backup: true',
    '  confirm_delete: true',
  ].join('\n');

  writeFileSync(configPath, `${configContent}\n`, 'utf8');
  writeFileSync(
    importSourcePath,
    '# Sample Import Draft\n\nContent prepared for CLI import contract tests.\n',
    'utf8'
  );
});

afterAll(() => {
  if (workspaceDir && existsSync(workspaceDir)) {
    rmSync(workspaceDir, { recursive: true, force: true });
  }
});

function runCLI(args: string[], expectSuccess = true): SpawnSyncReturns<string> {
  const finalArgs = ['--config', configPath, '--json', ...args];
  const result = spawnSync(CLI_BIN, finalArgs, {
    encoding: 'utf8',
    cwd: workspaceDir,
    env: {
      ...process.env,
      PRD_CONFIG_PATH: configPath,
      PRD_OUTPUT_DIR: exportDir,
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (expectSuccess) {
    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe('');
  }

  return result;
}

function parseJson(stdout: string): any {
  expect(stdout).toBeTruthy();
  const trimmed = stdout.trim();
  expect(() => JSON.parse(trimmed)).not.toThrow();
  return JSON.parse(trimmed);
}

describe.sequential('PRD CLI contract (Red phase)', () => {
  describe('Draft management commands', () => {
    it('creates a draft (prd create)', () => {
      const result = runCLI([
        'create',
        '--title',
        'CLI Contract Draft',
        '--template',
        'technical',
        '--description',
        'Draft created during CLI contract validation',
      ]);

      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        draft: {
          id: expect.any(String),
          title: 'CLI Contract Draft',
          status: expect.any(String),
        },
      });

      createdDraftId = payload.draft.id;
    });

    it('lists drafts (prd list)', () => {
      expect(createdDraftId).not.toBe('');

      const result = runCLI(['list', '--status', 'draft', '--limit', '10']);
      const payload = parseJson(result.stdout);

      expect(payload).toMatchObject({
        success: true,
        drafts: expect.any(Array),
        pagination: expect.objectContaining({
          limit: expect.any(Number),
          total: expect.any(Number),
        }),
      });
    });

    it('shows draft details (prd show)', () => {
      expect(createdDraftId).not.toBe('');

      const result = runCLI(['show', createdDraftId, '--format', 'markdown']);
      const payload = parseJson(result.stdout);

      expect(payload).toMatchObject({
        success: true,
        draft: expect.objectContaining({
          id: createdDraftId,
          sections: expect.any(Array),
        }),
      });
    });

    it('edits a draft section (prd edit)', () => {
      expect(createdDraftId).not.toBe('');

      const result = runCLI([
        'edit',
        createdDraftId,
        '--section',
        'overview',
        '--message',
        'Updated overview section for contract test',
      ]);

      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        draft: expect.objectContaining({ id: createdDraftId }),
      });
    });
  });

  describe('Review workflow commands', () => {
    it('submits draft for review (prd review submit)', () => {
      expect(createdDraftId).not.toBe('');

      const result = runCLI([
        'review',
        'submit',
        createdDraftId,
        '--reviewers',
        'pm@example.com,qa@example.com',
        '--due-date',
        '2025-10-05',
        '--priority',
        'high',
        '--message',
        'Please review for release readiness.',
      ]);

      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        review: expect.objectContaining({
          draftId: createdDraftId,
          status: expect.any(String),
        }),
      });
      storedReviewId = payload.review.id;
    });

    it('shows review status (prd review status)', () => {
      expect(createdDraftId).not.toBe('');

      const result = runCLI(['review', 'status', createdDraftId]);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        review: expect.objectContaining({
          draftId: createdDraftId,
          status: expect.any(String),
        }),
      });
    });

    it('responds to a review (prd review respond)', () => {
      expect(createdDraftId).not.toBe('');
      expect(storedReviewId).not.toBe('');

      const result = runCLI([
        'review',
        'respond',
        createdDraftId,
        '--review-id',
        storedReviewId,
        '--decision',
        'approved',
        '--comment',
        'Approved from architecture perspective.',
      ]);

      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        review: expect.objectContaining({
          id: storedReviewId,
          decision: 'approved',
        }),
      });
    });
  });

  describe('Version management commands', () => {
    it('lists versions (prd version list)', () => {
      expect(createdDraftId).not.toBe('');

      const result = runCLI(['version', 'list', createdDraftId]);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        versions: expect.any(Array),
      });
    });

    it('shows a specific version (prd version show)', () => {
      expect(createdDraftId).not.toBe('');

      const result = runCLI(['version', 'show', createdDraftId, '--version', '1']);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        version: expect.objectContaining({
          draftId: createdDraftId,
          versionNumber: expect.any(Number),
        }),
      });
    });

    it('restores a version (prd version restore)', () => {
      expect(createdDraftId).not.toBe('');

      const result = runCLI([
        'version',
        'restore',
        createdDraftId,
        '--version',
        '1',
        '--message',
        'Restore baseline version for testing.',
      ]);

      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        draft: expect.objectContaining({ id: createdDraftId }),
      });
    });

    it('diffs two versions (prd version diff)', () => {
      expect(createdDraftId).not.toBe('');

      const result = runCLI([
        'version',
        'diff',
        createdDraftId,
        '--from',
        '1',
        '--to',
        '2',
        '--format',
        'unified',
      ]);

      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        diff: expect.any(String),
      });
    });
  });

  describe('Template commands', () => {
    it('lists templates (prd template list)', () => {
      const result = runCLI(['template', 'list']);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        templates: expect.any(Array),
      });
    });

    it('creates a template (prd template create)', () => {
      expect(createdDraftId).not.toBe('');

      const result = runCLI([
        'template',
        'create',
        '--name',
        'cli-contract-template',
        '--description',
        'Template created during CLI contract validation',
        '--version',
        '1.0.0',
        '--from-draft',
        createdDraftId,
      ]);

      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        template: expect.objectContaining({
          id: expect.any(String),
          name: 'cli-contract-template',
        }),
      });

      createdTemplateId = payload.template.id;
    });

    it('shows template details (prd template show)', () => {
      expect(createdTemplateId).not.toBe('');

      const result = runCLI(['template', 'show', createdTemplateId]);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        template: expect.objectContaining({ id: createdTemplateId }),
      });
    });

    it('validates template structure (prd template validate)', () => {
      expect(createdTemplateId).not.toBe('');

      const result = runCLI(['template', 'validate', '--template', createdTemplateId]);

      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        template: expect.objectContaining({ id: createdTemplateId }),
      });
    });
  });

  describe('Utility commands', () => {
    it('shows configuration (prd config show)', () => {
      const result = runCLI(['config', 'show']);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        config: expect.any(Object),
      });
    });

    it('exports a draft (prd export)', () => {
      expect(createdDraftId).not.toBe('');

      const outputPath = join(exportDir, 'contract-draft.md');
      const result = runCLI([
        'export',
        createdDraftId,
        '--format',
        'markdown',
        '--output',
        outputPath,
        '--include-metadata',
        '--include-history',
      ]);

      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        export: expect.objectContaining({
          path: outputPath,
          format: 'markdown',
        }),
      });
    });

    it('imports a draft (prd import)', () => {
      const result = runCLI([
        'import',
        importSourcePath,
        '--format',
        'markdown',
        '--template',
        'technical',
        '--title',
        'Imported CLI Contract Draft',
      ]);

      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        draft: expect.objectContaining({
          id: expect.any(String),
          title: 'Imported CLI Contract Draft',
        }),
      });
    });

    it('searches drafts (prd search)', () => {
      const result = runCLI(['search', 'contract', '--in', 'all', '--limit', '5']);

      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        results: expect.any(Array),
      });
    });

    it('deletes a draft (prd delete)', () => {
      expect(createdDraftId).not.toBe('');

      const result = runCLI(['delete', createdDraftId, '--force']);
      const payload = parseJson(result.stdout);
      expect(payload).toMatchObject({
        success: true,
        draft: expect.objectContaining({ id: createdDraftId }),
      });
    });
  });
});
