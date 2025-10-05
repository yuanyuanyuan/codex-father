export interface PreAssignmentValidatorOptions {
  requiredFiles?: string[];
  requiredEnv?: string[];
  requiredConfigKeys?: string[];
}

export interface ValidationInput {
  task: { id: string; description?: string };
  availableContext: {
    files?: string[];
    env?: Record<string, string>;
    config?: unknown;
  };
}

export interface ValidationResult {
  valid: boolean;
  missing: string[];
}

export class PreAssignmentValidator {
  private readonly opts: Required<PreAssignmentValidatorOptions>;

  public constructor(options: PreAssignmentValidatorOptions) {
    this.opts = {
      requiredFiles: options.requiredFiles ?? [],
      requiredEnv: options.requiredEnv ?? [],
      requiredConfigKeys: options.requiredConfigKeys ?? [],
    };
  }

  public async validate(input: ValidationInput): Promise<ValidationResult> {
    const missing: string[] = [];
    const ctxFiles = new Set<string>((input.availableContext.files ?? []).map((p) => String(p)));
    const ctxEnv = input.availableContext.env ?? {};
    const ctxConfig = input.availableContext.config;

    for (const f of this.opts.requiredFiles) {
      if (!ctxFiles.has(f)) {
        missing.push(f);
      }
    }
    for (const key of this.opts.requiredEnv) {
      if (!(key in ctxEnv) || !ctxEnv[key]) {
        missing.push(key);
      }
    }
    for (const path of this.opts.requiredConfigKeys) {
      const val = this.getConfigPath(ctxConfig, path);
      if (!val) {
        missing.push(path);
      }
    }

    return { valid: missing.length === 0, missing };
  }

  private getConfigPath(root: unknown, path: string): unknown {
    if (!root || typeof root !== 'object') {
      return undefined;
    }
    const parts = path.split('.');
    let cur: any = root;
    for (const p of parts) {
      if (cur && typeof cur === 'object' && p in cur) {
        cur = cur[p];
      } else {
        return undefined;
      }
    }
    return cur;
  }
}
