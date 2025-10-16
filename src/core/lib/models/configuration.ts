import { z } from 'zod';

export type WireApi = 'chat' | 'function_calling' | 'function_calling_v2';

export const CodexConfigSchema = z.object({
  model: z.string(),
  model_providers: z.record(z.object({
    wire_api: z.enum(['chat', 'function_calling', 'function_calling_v2']).optional(),
    base_url: z.string().url().optional(),
    api_key: z.string().optional(),
  })).optional(),
  reasoning_effort: z.enum(['low', 'medium', 'high']).optional(),
  max_tokens: z.number().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export type CodexConfig = z.infer<typeof CodexConfigSchema>;