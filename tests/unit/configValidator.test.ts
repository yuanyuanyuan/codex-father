import { describe, it, expect } from 'vitest';
import {
  CodexConfigSchema,
  type CodexConfig,
  type WireApi,
} from '../../core/lib/models/configuration';
import {
  validateConfig,
  checkWireApiCompatibility,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
  type ValidationSuggestion,
  validateParametersCompatibility,
} from '../../core/lib/validation/data-validator';

describe('configValidator - Schema 验证', () => {
  it('有效配置应通过验证', async () => {
    const config: CodexConfig = {
      model: 'gpt-4',
      model_providers: {
        openai: { wire_api: 'chat' },
      },
    };

    // 先确保 schema 自身通过
    const parsed = CodexConfigSchema.safeParse(config);
    expect(parsed.success).toBe(true);

    const result = await validateConfig(config, '0.44.0');
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('非法字段类型应被拒绝', async () => {
    const bad: any = {
      model: 123, // 类型错误
      model_providers: {
        openai: { wire_api: 'chat' as WireApi },
      },
    };

    const parsed = CodexConfigSchema.safeParse(bad);
    expect(parsed.success).toBe(false);

    const res = await validateConfig(bad as CodexConfig, '0.44.0');
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
  });
});

describe('configValidator - wire_api 兼容性', () => {
  it('gpt-5-codex + chat → 错误，并包含修复建议', async () => {
    const config: CodexConfig = {
      model: 'gpt-5-codex',
      model_providers: { openai: { wire_api: 'chat' } },
    };
    const result = await validateConfig(config, '0.44.0');
    expect(result.valid).toBe(false);
    expect(result.errors.find((e) => e.code === 'WIRE_API_MISMATCH')).toBeTruthy();
    expect(
      result.suggestions.find((s) => s.action === 'change_wire_api' && s.newValue === 'responses')
    ).toBeTruthy();
  });

  it('gpt-5-codex + responses → 通过验证', async () => {
    const config: CodexConfig = {
      model: 'gpt-5-codex',
      model_providers: { openai: { wire_api: 'responses' } },
    };
    const result = await validateConfig(config, '0.44.0');
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('gpt-4 + chat → 通过验证', async () => {
    const config: CodexConfig = {
      model: 'gpt-4',
      model_providers: { openai: { wire_api: 'chat' } },
    };
    const result = await validateConfig(config, '0.44.0');
    expect(result.valid).toBe(true);
  });

  it('gpt-4 + responses → 警告并给出建议', async () => {
    const config: CodexConfig = {
      model: 'gpt-4',
      model_providers: { openai: { wire_api: 'responses' } },
    };
    const result = await validateConfig(config, '0.44.0');
    expect(result.valid).toBe(true); // 非致命，仅警告
    expect(result.warnings.find((w) => w.code === 'WIRE_API_NOT_RECOMMENDED')).toBeTruthy();
    expect(
      result.suggestions.find((s) => s.action === 'change_wire_api' && s.newValue === 'chat')
    ).toBeTruthy();
  });

  it('checkWireApiCompatibility 仅在致命情况下返回错误', () => {
    const err = checkWireApiCompatibility('gpt-5-codex', 'chat');
    expect(err).toBeTruthy();
    const ok = checkWireApiCompatibility('gpt-4', 'responses');
    expect(ok).toBeNull();
  });
});

describe('configValidator - 版本兼容性 (参数层)', () => {
  it('0.42 + profile 参数 → 错误并建议升级', () => {
    const r = validateParametersCompatibility('0.42.0', ['profile']);
    expect(r.valid).toBe(false);
    expect(r.errors.find((e) => e.code === 'PARAMETER_NOT_SUPPORTED')).toBeTruthy();
    expect(
      r.suggestions.find((s) => s.action === 'upgrade_codex' && s.newValue === '0.44.0')
    ).toBeTruthy();
  });

  it('0.44 + profile 参数 → 通过', () => {
    const r = validateParametersCompatibility('0.44.0', ['profile']);
    expect(r.valid).toBe(true);
    expect(r.errors.length).toBe(0);
  });

  it('0.42 + model 参数 → 通过', () => {
    const r = validateParametersCompatibility('0.42.0', ['model']);
    expect(r.valid).toBe(true);
  });
});

describe('configValidator - 性能', () => {
  it('复杂配置验证应 < 200ms', async () => {
    const config: CodexConfig = {
      model: 'gpt-5-codex',
      approval_policy: 'never',
      sandbox: 'workspace-write',
      cwd: '/tmp',
      base_instructions: 'hello',
      include_plan_tool: true,
      include_apply_patch_tool: true,
      model_providers: {
        openai: { wire_api: 'responses', api_key: 'sk-test' },
        other: { wire_api: 'chat', api_key: 'x' },
      },
    };
    const start = performance.now();
    const result = await validateConfig(config, '0.44.0');
    const duration = performance.now() - start;
    expect(result.valid).toBe(true);
    expect(duration).toBeLessThan(200);
  });
});
