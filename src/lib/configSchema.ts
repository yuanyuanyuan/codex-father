import { z } from 'zod';

// 审批策略枚举
export const ApprovalPolicySchema = z.enum(['untrusted', 'on-request', 'on-failure', 'never']);

// 沙箱模式枚举
export const SandboxModeSchema = z.enum(['read-only', 'workspace-write', 'danger-full-access']);

// wire_api 枚举
export const WireApiSchema = z.enum(['chat', 'responses']);

// 模型提供商配置
export const ModelProviderConfigSchema = z
  .object({
    wire_api: WireApiSchema.optional(),
    api_key: z.string().optional(),
    // ... 其他配置
  })
  .strict();

// Codex 配置项
export const CodexConfigSchema = z
  .object({
    model: z.string().optional(),
    approval_policy: ApprovalPolicySchema.optional(),
    sandbox: SandboxModeSchema.optional(),
    cwd: z.string().optional(),
    base_instructions: z.string().optional(),
    include_plan_tool: z.boolean().optional(),
    include_apply_patch_tool: z.boolean().optional(),
    model_providers: z.record(ModelProviderConfigSchema).optional(),
    // ... 其他配置项
  })
  .strict();

// Profile 配置（包含所有 CodexConfig 选项）
export const ProfileConfigSchema = CodexConfigSchema;

// 类型导出
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;
export type SandboxMode = z.infer<typeof SandboxModeSchema>;
export type WireApi = z.infer<typeof WireApiSchema>;
export type CodexConfig = z.infer<typeof CodexConfigSchema>;
export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;
