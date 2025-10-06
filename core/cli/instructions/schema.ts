import { z } from 'zod';

const RetrySchema = z
  .object({
    max: z.number().int().nonnegative(),
    delayMs: z.number().int().nonnegative().optional(),
    backoff: z.enum(['fixed', 'exponential']).optional(),
  })
  .strict();

const ErrorMatcherSchema = z.union([
  z.string().min(1),
  z
    .object({
      type: z.literal('regex'),
      pattern: z.string().min(1),
      flags: z
        .string()
        .regex(/^[gimsuy]*$/)
        .optional(),
    })
    .strict(),
]);

const RunSchema = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1),
  z
    .object({
      shell: z.enum(['bash', 'sh']),
      script: z.string().min(1),
    })
    .strict(),
]);

export const StepSchema = z
  .object({
    id: z.string().min(1),
    run: RunSchema,
    workdir: z.string().optional(),
    timeoutMs: z.number().int().nonnegative().optional(),
    retry: RetrySchema.optional(),
    continueOnError: z.boolean().optional(),
    allowExitCodes: z.array(z.number().int()).optional(),
    errorMatchers: z.array(ErrorMatcherSchema).optional(),
    env: z
      .object({
        set: z.record(z.string()).optional(),
      })
      .strict()
      .optional(),
    when: z.string().optional(),
    artifacts: z.array(z.string()).optional(),
  })
  .strict();

export const TaskSchema = z
  .object({
    id: z.string().min(1),
    description: z.string().optional(),
    steps: z.array(StepSchema).min(1),
  })
  .strict();

export const VcsSchema = z
  .object({
    branch: z.string().min(1),
    commitMessage: z.string().min(1),
    pr: z
      .object({
        title: z.string().min(1),
        body: z.string().optional(),
        labels: z.array(z.string()).optional(),
        draft: z.boolean().optional(),
        reviewers: z.array(z.string()).optional(),
      })
      .strict(),
  })
  .strict();

export const StructuredInstructionsSchema = z
  .object({
    version: z.string().regex(/^\d+\.\d+(?:\.\d+)?$/),
    id: z.string().min(1),
    context: z.string().optional(),
    objective: z.string().min(1),
    audience: z.string().optional(),
    style: z.string().optional(),
    tone: z.string().optional(),
    response: z
      .object({
        artifacts: z.array(z.string()).optional(),
        format: z.enum(['json', 'text', 'markdown']).optional(),
      })
      .strict()
      .optional(),
    constraints: z
      .object({
        timeoutMs: z.number().int().nonnegative().optional(),
        maxParallel: z.number().int().min(1).optional(),
      })
      .strict()
      .optional(),
    env: z
      .object({
        allow: z.array(z.string().regex(/^[A-Z0-9_.*-]+$/)).optional(),
      })
      .strict()
      .optional(),
    tasks: z.array(TaskSchema).min(1),
    vcs: VcsSchema,
    ci: z.record(z.unknown()).optional(),
  })
  .strict();

export type StructuredInstructions = z.infer<typeof StructuredInstructionsSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Step = z.infer<typeof StepSchema>;
