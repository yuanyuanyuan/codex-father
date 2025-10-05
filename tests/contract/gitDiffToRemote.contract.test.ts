import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/__archive/008-ultrathink-codex-0/contracts/gitDiffToRemote.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: gitDiffToRemote', () => {
  const validateRequest = ajv.compile(schema.request);
  const validateResponse = ajv.compile(schema.response);

  describe('Request Validation', () => {
    it('接受包含绝对路径的请求', () => {
      expect(
        validateRequest({
          cwd: '/workspace/project',
        })
      ).toBe(true);
    });

    it('接受包含相对路径的请求', () => {
      expect(
        validateRequest({
          cwd: '../repo',
        })
      ).toBe(true);
    });

    it('拒绝缺少 cwd 字段的请求', () => {
      expect(validateRequest({})).toBe(false);
    });

    it('拒绝空字符串作为 cwd', () => {
      expect(
        validateRequest({
          cwd: '',
        })
      ).toBe(false);
    });

    it('拒绝包含额外字段的请求', () => {
      expect(
        validateRequest({
          cwd: '/workspace',
          includeUntracked: true,
        })
      ).toBe(false);
    });
  });

  describe('Response Validation', () => {
    it('接受包含 SHA 与 diff 的响应', () => {
      expect(
        validateResponse({
          sha: 'a'.repeat(40),
          diff: 'diff --git a/file b/file\n',
        })
      ).toBe(true);
    });

    it('接受多行 diff 内容', () => {
      expect(
        validateResponse({
          sha: '0123456789abcdef0123456789abcdef01234567',
          diff: ['diff --git a/app.ts b/app.ts', '@@ -1 +1 @@', '-const a = 1;'].join('\n'),
        })
      ).toBe(true);
    });

    it('拒绝非法的 SHA 格式', () => {
      expect(
        validateResponse({
          sha: 'xyz',
          diff: 'diff --git a/file b/file',
        })
      ).toBe(false);
    });

    it('拒绝缺少 diff 字段的响应', () => {
      expect(
        validateResponse({
          sha: '0'.repeat(40),
        })
      ).toBe(false);
    });

    it('拒绝包含额外字段的响应', () => {
      expect(
        validateResponse({
          sha: '0'.repeat(40),
          diff: '',
          stats: {},
        })
      ).toBe(false);
    });
  });
});
