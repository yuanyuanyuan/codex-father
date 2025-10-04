import { CodexConfigSchema, type CodexConfig, type WireApi } from './configSchema';
import { getRecommendedWireApi } from './modelWireApiMapping';
import { getParamMinVersion, isParamSupported } from './parameterMapping';

// ===== 校验结果类型（按任务要求定义） =====
export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  value?: any;
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

export interface ValidationSuggestion {
  action: string;
  description: string;
  oldValue?: any;
  newValue?: any;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

/**
 * 检查 wire_api 配置与模型的兼容性
 * 仅对会导致 405 的组合报错：gpt-5-codex + chat
 */
export function checkWireApiCompatibility(model: string, wireApi: WireApi): ValidationError | null {
  if (!model) {
    return null;
  }
  const recommended = getRecommendedWireApi(model);

  if (model === 'gpt-5-codex' && wireApi === 'chat') {
    return {
      code: 'WIRE_API_MISMATCH',
      message: "gpt-5-codex must use wire_api='responses', using 'chat' causes HTTP 405",
      field: 'wire_api',
      value: wireApi,
    };
  }

  // 其他模型与非推荐 wire_api 不视为致命错误，由上层发出警告
  if (recommended && recommended !== wireApi && model !== 'gpt-5-codex') {
    return null;
  }

  return null;
}

/**
 * 参数层版本兼容性验证（纯静态、离线）
 * 供单元测试与 validateConfig 内部复用
 */
export function validateParametersCompatibility(
  codexVersion: string | undefined,
  usedParams: string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];

  if (!codexVersion) {
    return { valid: true, errors, warnings, suggestions };
  }

  for (const p of usedParams) {
    if (!isParamSupported(p, codexVersion)) {
      const min = getParamMinVersion(p);
      errors.push({
        code: 'PARAMETER_NOT_SUPPORTED',
        message: min
          ? `Parameter '${p}' requires Codex >= ${min}, current version is ${codexVersion}`
          : `Parameter '${p}' is not supported by Codex ${codexVersion}`,
        field: p,
      });
      if (min) {
        suggestions.push({
          action: 'upgrade_codex',
          description: `升级 Codex 至 ${min} 或更高版本以使用参数 '${p}'`,
          newValue: min,
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings, suggestions };
}

/**
 * 验证 Codex 配置对象（离线，<200ms）
 * - Zod Schema 验证
 * - 模型与 wire_api 兼容性
 * - 参数层版本兼容（通过可检测的已使用参数列表，若无法检测则跳过）
 */
export async function validateConfig(
  config: CodexConfig,
  codexVersion?: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];

  // 1) 基础 Schema 验证（严格模式）
  const parsed = CodexConfigSchema.safeParse(config);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        code: 'SCHEMA_VALIDATION_ERROR',
        message: issue.message,
        field: issue.path.join('.'),
      });
    }
    return { valid: false, errors, warnings, suggestions };
  }

  const cfg = parsed.data;

  // 2) wire_api 兼容性检查（遍历已配置的 provider）
  if (cfg.model && cfg.model_providers) {
    for (const [providerName, providerCfg] of Object.entries(cfg.model_providers)) {
      const wire = providerCfg?.wire_api;
      if (!wire) {
        continue;
      }

      // 仅对与模型提供方相关的 provider 执行致命组合检查
      const shouldCheckFatal = providerName === 'openai';
      const err = shouldCheckFatal ? checkWireApiCompatibility(cfg.model, wire) : null;
      if (err) {
        errors.push({ ...err, field: `model_providers.${providerName}.wire_api` });
        suggestions.push({
          action: 'change_wire_api',
          description: `将 ${providerName} 的 wire_api 调整为推荐值 'responses' 以避免 405 错误`,
          oldValue: wire,
          newValue: 'responses',
        });
      } else {
        const recommended = getRecommendedWireApi(cfg.model);
        if (recommended && wire !== recommended) {
          warnings.push({
            code: 'WIRE_API_NOT_RECOMMENDED',
            message: `模型 ${cfg.model} 建议使用 wire_api='${recommended}'（当前: '${wire}'）`,
            field: `model_providers.${providerName}.wire_api`,
          });
          suggestions.push({
            action: 'change_wire_api',
            description: `将 ${providerName} 的 wire_api 调整为推荐值 '${recommended}'`,
            oldValue: wire,
            newValue: recommended,
          });
        }
      }
    }
  }

  // 3) 参数层版本兼容（仅当可检测到已用参数时）
  // 由于 CodexConfig 不直接暴露诸如 'profile' 之类的 0.44 独有参数，
  // 这里尝试从已知配置中提取（当前提取为空，保留扩展点）。
  const usedParams: string[] = [];
  const paramCheck = validateParametersCompatibility(codexVersion, usedParams);
  if (!paramCheck.valid) {
    errors.push(...paramCheck.errors);
    suggestions.push(...paramCheck.suggestions);
  } else {
    warnings.push(...paramCheck.warnings);
    suggestions.push(...paramCheck.suggestions);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}
