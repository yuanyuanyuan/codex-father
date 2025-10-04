import { describe, it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';
import {
  ApprovalPolicySchema,
  SandboxModeSchema,
  WireApiSchema,
  CodexConfigSchema,
} from '../../src/lib/configSchema';
import fs from 'node:fs';

describe('configSchema: 基础类型验证', () => {
  it('接受有效的 approval_policy 值', () => {
    const okValues: string[] = ['untrusted', 'on-request', 'on-failure', 'never'];
    for (const v of okValues) {
      const res = ApprovalPolicySchema.safeParse(v);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toBe(v);
      }
    }
  });

  it('拒绝无效的 approval_policy 值', () => {
    const res = ApprovalPolicySchema.safeParse('always');
    expect(res.success).toBe(false);
  });

  it('接受有效的 sandbox 值', () => {
    const okValues: string[] = ['read-only', 'workspace-write', 'danger-full-access'];
    for (const v of okValues) {
      const res = SandboxModeSchema.safeParse(v);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data).toBe(v);
      }
    }
  });

  it('拒绝无效的 sandbox 值', () => {
    const res = SandboxModeSchema.safeParse('full-access');
    expect(res.success).toBe(false);
  });

  it('接受有效的 wire_api 值', () => {
    expect(WireApiSchema.safeParse('chat').success).toBe(true);
    expect(WireApiSchema.safeParse('responses').success).toBe(true);
  });

  it('拒绝无效的 wire_api 值', () => {
    expect(WireApiSchema.safeParse('completions').success).toBe(false);
  });
});

describe('configSchema: 配置对象验证', () => {
  it('接受最小化配置（所有字段可选）', () => {
    const res = CodexConfigSchema.safeParse({});
    expect(res.success).toBe(true);
  });

  it('接受完整配置（含嵌套 model_providers）', () => {
    const cfg = {
      model: 'gpt-5-codex',
      approval_policy: 'on-request',
      sandbox: 'workspace-write',
      cwd: '/tmp/project',
      base_instructions: 'Follow directions.',
      include_plan_tool: true,
      include_apply_patch_tool: true,
      model_providers: {
        openai: { wire_api: 'responses', api_key: 'sk-test' },
        anthropic: { wire_api: 'chat' },
      },
    } as const;
    const res = CodexConfigSchema.safeParse(cfg);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toEqual(cfg);
    }
  });

  it('拒绝未知字段（strict mode）', () => {
    const res = CodexConfigSchema.safeParse({ unknown_field: 123 });
    expect(res.success).toBe(false);
  });

  it('拒绝错误的字段类型', () => {
    const bad = {
      include_plan_tool: 'yes',
    } as any;
    const res = CodexConfigSchema.safeParse(bad);
    expect(res.success).toBe(false);
  });
});

describe('configSchema: 嵌套对象验证', () => {
  it('验证 model_providers.openai.wire_api', () => {
    const cfg = {
      model_providers: {
        openai: { wire_api: 'responses' },
      },
    };
    expect(CodexConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('验证 model_providers.anthropic.wire_api', () => {
    const cfg = {
      model_providers: {
        anthropic: { wire_api: 'chat' },
      },
    };
    expect(CodexConfigSchema.safeParse(cfg).success).toBe(true);
  });

  it('拒绝嵌套对象中的无效值', () => {
    const bad = {
      model_providers: {
        openai: { wire_api: 'bad_value' },
      },
    } as any;
    expect(CodexConfigSchema.safeParse(bad).success).toBe(false);
  });
});

describe('configSchema: 性能测试', () => {
  it('解析简单配置 < 10ms', () => {
    const input = {};
    const t0 = performance.now();
    const res = CodexConfigSchema.parse(input);
    const dt = performance.now() - t0;
    expect(res).toEqual({});
    expect(dt).toBeLessThan(10);
  });

  it('解析复杂嵌套配置 < 50ms', () => {
    const input = {
      model: 'gpt-5-codex',
      approval_policy: 'on-request',
      sandbox: 'workspace-write',
      cwd: '/work',
      base_instructions: 'Base inst',
      include_plan_tool: true,
      include_apply_patch_tool: false,
      model_providers: {
        openai: { wire_api: 'responses', api_key: 'sk-test' },
        anthropic: { wire_api: 'chat' },
        azure: { wire_api: 'responses' },
      },
    };
    const t0 = performance.now();
    const res = CodexConfigSchema.parse(input);
    const dt = performance.now() - t0;
    expect(res).toEqual(input);
    expect(dt).toBeLessThan(50);
  });
});

describe('configSchema: 实际案例（research.md 行 77-84）', () => {
  it('解析 research.md 中的示例配置', () => {
    const text = fs.readFileSync('specs/008-ultrathink-codex-0/research.md', 'utf-8');
    // 提取片段中的 model 与 wire_api
    const modelMatch = text.match(/\n\s*model\s*=\s*"([^"]+)"/);
    const wireApiMatch = text.match(/\n\s*wire_api\s*=\s*"([^"]+)"/);
    expect(modelMatch).toBeTruthy();
    expect(wireApiMatch).toBeTruthy();
    const model = modelMatch?.[1] ?? 'gpt-5-codex';
    const wire_api = wireApiMatch?.[1] ?? 'responses';

    const cfg = {
      model,
      model_providers: {
        openai: { wire_api },
      },
    };

    const res = CodexConfigSchema.safeParse(cfg);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data).toEqual(cfg);
    }
  });
});
