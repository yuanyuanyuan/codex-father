interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
}

interface DegradationStrategy {
  version: string;
  features: string[];
  fallbacks: { [feature: string]: string };
}

export class DegradationStrategy {
  private strategies: Map<string, DegradationStrategy> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // 0.42 版本策略
    this.strategies.set('0.42', {
      version: '0.42',
      features: ['basic-task-execution', 'file-operations', 'git-operations'],
      fallbacks: {
        profile: 'Use environment variables instead',
        'sendUserTurn.effort': 'Omit effort parameter',
        'sendUserTurn.summary': 'Omit summary parameter',
      },
    });

    // 0.44 版本策略
    this.strategies.set('0.44', {
      version: '0.44',
      features: [
        'basic-task-execution',
        'file-operations',
        'git-operations',
        'profile-support',
        'effort-parameter',
        'summary-parameter',
      ],
      fallbacks: {},
    });
  }

  getStrategy(version: string): DegradationStrategy | null {
    // 查找最接近的策略
    const versions = Array.from(this.strategies.keys()).sort();
    const closest = this.findClosestVersion(version, versions);
    return this.strategies.get(closest) || null;
  }

  private findClosestVersion(target: string, available: string[]): string {
    const targetParts = target.split('.').map(Number);

    let closest = available[0];
    let closestDistance = this.versionDistance(target, closest);

    for (const version of available) {
      const distance = this.versionDistance(target, version);
      if (distance < closestDistance) {
        closest = version;
        closestDistance = distance;
      }
    }

    return closest;
  }

  private versionDistance(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    return (
      Math.abs(parts1[0] - parts2[0]) * 100 +
      Math.abs(parts1[1] - parts2[1]) * 10 +
      Math.abs(parts1[2] - parts2[2])
    );
  }

  supportsFeature(feature: string, version: string): boolean {
    const strategy = this.getStrategy(version);
    return strategy ? strategy.features.includes(feature) : false;
  }

  getFallback(feature: string, version: string): string | null {
    const strategy = this.getStrategy(version);
    return strategy ? strategy.fallbacks[feature] || null : null;
  }
}

// CLI 参数检查接口
export interface CliCheckResult {
  compatible: boolean;
  incompatibleParams: string[];
  errorMessage?: string;
}

// 配置过滤接口
export interface ConfigFilterResult {
  filtered: string[];
  filteredConfig: any;
  warnings: string[];
}

// MCP 参数验证接口
export interface McpValidationResult {
  valid: boolean;
  error?: {
    code: number;
    message: string;
  };
}

// CLI 参数检查函数
export function checkCliParams(cliParams: Record<string, any>, version: string): CliCheckResult {
  const incompatibleParams: string[] = [];
  
  // 检查 0.42 版本不支持的参数
  if (version.startsWith('0.42')) {
    const unsupportedParams = ['profile'];
    for (const param of unsupportedParams) {
      if (cliParams[param] !== undefined) {
        incompatibleParams.push(param);
      }
    }
  }
  
  const compatible = incompatibleParams.length === 0;
  const errorMessage = compatible ? undefined : 
    `Parameters [${incompatibleParams.join(', ')}] require Codex >= 0.44, current version is ${version}`;
  
  return {
    compatible,
    incompatibleParams,
    errorMessage
  };
}

// 配置过滤函数
export function filterConfig(config: any, version: string): ConfigFilterResult {
  const filtered: string[] = [];
  const filteredConfig = { ...config };
  const warnings: string[] = [];
  
  // 检查 0.42 版本不支持的配置项
  if (version.startsWith('0.42')) {
    const unsupportedConfigs = [
      'profile',
      'model_reasoning_summary',
      'sendUserTurn.effort',
      'sendUserTurn.summary'
    ];
    
    for (const configKey of unsupportedConfigs) {
      if (filteredConfig[configKey] !== undefined) {
        filtered.push(configKey);
        delete filteredConfig[configKey];
        
        // 生成警告信息
        const strategy = degradationStrategy.getFallback(configKey, version);
        if (strategy) {
          warnings.push(`Configuration '${configKey}' filtered. Suggestion: ${strategy}`);
        }
      }
    }
  }
  
  return {
    filtered,
    filteredConfig,
    warnings
  };
}

// MCP 参数验证函数
export function validateMcpParams(method: string, params: Record<string, any>, version: string): McpValidationResult {
  const cliCheck = checkCliParams(params, version);
  
  if (!cliCheck.compatible) {
    return {
      valid: false,
      error: {
        code: -32602,
        message: `Invalid params: '${cliCheck.incompatibleParams.join(', ')}' requires Codex >= 0.44, current version is ${version}`
      }
    };
  }
  
  return { valid: true };
}

export const degradationStrategy = new DegradationStrategy();
