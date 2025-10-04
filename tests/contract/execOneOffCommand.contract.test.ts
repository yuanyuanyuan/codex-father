import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/_archived/008-ultrathink-codex-0/contracts/execOneOffCommand.schema.json';

const ajv = new Ajv({ strict: false });

const requestSchema = schema.definitions
  ? { ...schema.request, definitions: schema.definitions }
  : schema.request;

const responseSchema = schema.definitions
  ? { ...schema.response, definitions: schema.definitions }
  : schema.response;

describe('MCP Contract: execOneOffCommand', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(requestSchema);

    it('接受最小化的命令请求', () => {
      expect(
        validateRequest({
          command: ['ls'],
        })
      ).toBe(true);
    });

    it('接受包含完整可选字段的命令请求', () => {
      expect(
        validateRequest({
          command: ['bash', '-lc', 'echo hello'],
          timeoutMs: 10_000,
          cwd: '/workspace/project',
          sandboxPolicy: 'workspace-write',
        })
      ).toBe(true);
    });

    it('拒绝缺少 command 的请求', () => {
      expect(validateRequest({})).toBe(false);
    });

    it('拒绝空的 command 数组', () => {
      expect(
        validateRequest({
          command: [],
        })
      ).toBe(false);
    });

    it('拒绝 command 中包含非字符串元素的请求', () => {
      expect(
        validateRequest({
          command: ['npm', 1],
        })
      ).toBe(false);
    });

    it('拒绝包含未知字段的请求', () => {
      expect(
        validateRequest({
          command: ['whoami'],
          env: { NODE_ENV: 'test' },
        })
      ).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(responseSchema);

    it('接受包含 stdout 与 stderr 的响应', () => {
      expect(
        validateResponse({
          exitCode: 0,
          stdout: 'hello\n',
          stderr: '',
        })
      ).toBe(true);
    });

    it('接受包含 output 衍生字段的响应', () => {
      expect(
        validateResponse({
          exitCode: 1,
          stdout: '',
          stderr: 'command failed',
          output: 'command failed',
        })
      ).toBe(true);
    });

    it('拒绝缺少 exitCode 的响应', () => {
      expect(
        validateResponse({
          stdout: '',
          stderr: '',
        })
      ).toBe(false);
    });

    it('拒绝 exitCode 类型错误的响应', () => {
      expect(
        validateResponse({
          exitCode: '0',
          stdout: '',
          stderr: '',
        })
      ).toBe(false);
    });

    it('拒绝包含未知字段的响应', () => {
      expect(
        validateResponse({
          exitCode: 0,
          stdout: '',
          stderr: '',
          durationMs: 1200,
        })
      ).toBe(false);
    });
  });
});
