import { describe, it, expect } from 'vitest';

import { type CodexConfig } from '../../core/lib/models/configuration.js';
import {
  checkCliParams,
  filterConfig,
  validateMcpParams,
  type CliCheckResult,
  type ConfigFilterResult,
  type McpValidationResult,
} from '../../src/lib/degradationStrategy.js';

describe('T030 三层降级策略', () => {
  describe('CLI 层: checkCliParams', () => {
    it('0.42 + profile 参数 → incompatible=false? 应为不兼容', () => {
      const cliParams = { profile: 'high' };
      const res: CliCheckResult = checkCliParams(cliParams, '0.42.0');
      expect(res.compatible).toBe(false);
      expect(res.incompatibleParams).toContain('profile');
      expect(res.errorMessage).toContain('Parameters [profile] require Codex >= 0.44');
      expect(res.errorMessage).toContain('current version is 0.42.0');
    });

    it('0.44 + profile 参数 → compatible=true', () => {
      const cliParams = { profile: 'high' };
      const res = checkCliParams(cliParams, '0.44.0');
      expect(res.compatible).toBe(true);
      expect(res.incompatibleParams.length).toBe(0);
      expect(res.errorMessage).toBeUndefined();
    });

    it('0.42 + model 参数 → compatible=true', () => {
      const cliParams = { model: 'gpt-5-codex' };
      const res = checkCliParams(cliParams, '0.42.0');
      expect(res.compatible).toBe(true);
      expect(res.incompatibleParams.length).toBe(0);
    });
  });

  describe('配置层: filterConfig', () => {
    it('0.42 + profile 配置 → 过滤 profile，返回警告', () => {
      const cfg: any = { model: 'gpt-5-codex', profile: 'high' } as CodexConfig &
        Record<string, any>;
      const res: ConfigFilterResult = filterConfig(cfg as CodexConfig, '0.42.0');
      expect(res.filtered).toContain('profile');
      expect(Object.prototype.hasOwnProperty.call(res.filteredConfig as any, 'profile')).toBe(
        false
      );
      expect(res.warnings.join(' ')).toContain('Configuration \'profile\' filtered. Suggestion: Use environment variables instead');
    });

    it('0.44 + profile 配置 → 不过滤', () => {
      const cfg: any = { model: 'gpt-5-codex', profile: 'high' } as CodexConfig &
        Record<string, any>;
      const res = filterConfig(cfg as CodexConfig, '0.44.0');
      expect(res.filtered.length).toBe(0);
      expect(res.warnings.length).toBe(0);
      expect((res.filteredConfig as any).profile).toBe('high');
    });

    it('多个不兼容参数 → 全部过滤', () => {
      const cfg: any = {
        model: 'gpt-5-codex',
        profile: 'high',
        model_reasoning_effort: 'medium',
        model_reasoning_summary: 'tl;dr',
      } as CodexConfig & Record<string, any>;
      const res = filterConfig(cfg as CodexConfig, '0.42.0');
      // 都被过滤
      expect(res.filtered).toEqual(
        expect.arrayContaining(['profile', 'model_reasoning_summary'])
      );
      for (const key of res.filtered) {
        expect(Object.prototype.hasOwnProperty.call(res.filteredConfig as any, key)).toBe(false);
      }
      expect(res.warnings.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('MCP 层: validateMcpParams', () => {
    it('0.42 + profile 参数 → JSON-RPC -32602 错误，消息包含 currentVersion 和 minVersion', () => {
      const res: McpValidationResult = validateMcpParams(
        'newConversation',
        { model: 'gpt-5-codex', profile: 'high' },
        '0.42.0'
      );

      expect(res.valid).toBe(false);
      expect(res.error).toBeDefined();
      expect(res.error?.code).toBe(-32602);
      expect(res.error?.message).toMatch(/Invalid params/i);
      expect(res.error?.message).toMatch(/'profile'/);
      expect(res.error?.message).toContain('current version is 0.42.0');
      expect(res.error?.message).toContain('profile');
      expect(res.error?.message).toContain('0.42.0');
      expect(res.error?.message).toContain('requires Codex >= 0.44');
    });

    it('0.44 + profile 参数 → valid=true', () => {
      const res = validateMcpParams(
        'newConversation',
        { model: 'gpt-5-codex', profile: 'high' },
        '0.44.0'
      );
      expect(res.valid).toBe(true);
      expect(res.error).toBeUndefined();
    });
  });
});
