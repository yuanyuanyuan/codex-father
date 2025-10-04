import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/_archived/008-ultrathink-codex-0/contracts/getUserSavedConfig.schema.json';

const ajv = new Ajv({ strict: false });

const requestSchema = schema.definitions
  ? { ...schema.request, definitions: schema.definitions }
  : schema.request;
const responseSchema = schema.definitions
  ? { ...schema.response, definitions: schema.definitions }
  : schema.response;

describe('MCP Contract: getUserSavedConfig', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(requestSchema);

    it('接受空请求对象', () => {
      expect(validateRequest({})).toBe(true);
    });

    it('拒绝包含未知字段的请求', () => {
      const request = { includeProfiles: true };

      expect(validateRequest(request)).toBe(false);
    });

    it('拒绝非对象类型的请求', () => {
      expect(validateRequest([])).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(responseSchema);

    it('接受仅包含空配置映射的响应', () => {
      const response = {
        config: {
          profiles: {},
        },
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('接受包含完整配置选项的响应', () => {
      const response = {
        config: {
          approvalPolicy: 'on-request',
          sandboxMode: 'workspace-write',
          sandboxSettings: {
            writableRoots: ['/workspace/data'],
            networkAccess: true,
            excludeTmpdirEnvVar: false,
            excludeSlashTmp: false,
          },
          model: 'gpt-5-codex',
          modelReasoningEffort: 'medium',
          modelReasoningSummary: 'auto',
          modelVerbosity: 'high',
          tools: {
            webSearch: true,
            viewImage: false,
          },
          profile: 'triage',
          profiles: {
            triage: {
              model: 'gpt-5-codex',
              modelProvider: 'openai',
              approvalPolicy: 'on-request',
              modelReasoningEffort: 'low',
              modelReasoningSummary: 'concise',
              modelVerbosity: 'medium',
              chatgptBaseUrl: 'https://chat.openai.com',
            },
          },
        },
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('拒绝缺少 profiles 字段的响应', () => {
      const response = {
        config: {
          approvalPolicy: 'never',
        },
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('拒绝包含非法审批策略的响应', () => {
      const response = {
        config: {
          approvalPolicy: 'always',
          profiles: {},
        },
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('拒绝包含未知沙箱设置字段的响应', () => {
      const response = {
        config: {
          profiles: {},
          sandboxSettings: {
            writableRoots: [],
            unknown: true,
          },
        },
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
