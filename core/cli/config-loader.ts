/**
 * 配置加载器
 * 统一的配置文件加载和环境变量处理
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { parse as parseYaml } from 'yaml';
import type { ProjectConfig } from '../lib/types.js';

/**
 * 配置源类型
 */
type ConfigSource = 'default' | 'file' | 'env' | 'cli';

/**
 * 配置值元数据
 */
interface ConfigValue<T = any> {
  value: T;
  source: ConfigSource;
  path: string;
  override?: boolean;
}

/**
 * 配置加载结果
 */
interface ConfigLoadResult {
  config: ProjectConfig;
  sources: Record<string, ConfigSource>;
  warnings: string[];
  errors: string[];
}

/**
 * 环境类型
 */
type Environment = 'development' | 'testing' | 'production';

/**
 * 配置文件查找路径
 */
const CONFIG_FILE_NAMES = [
  'codex-father.config.js',
  'codex-father.config.json',
  'codex-father.config.yaml',
  'codex-father.config.yml',
  '.codex-father.json',
  '.codex-father.yaml',
  '.codex-father.yml',
];

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ProjectConfig = {
  version: '1.0.0',
  environment: 'development',
  logging: {
    level: 'info',
    format: 'text',
    outputs: [
      {
        type: 'console',
      },
    ],
  },
  performance: {
    maxExecutionTime: 300000, // 5 minutes
    maxMemoryUsage: 1024 * 1024 * 1024, // 1GB
    enableProfiling: false,
  },
  security: {
    sandboxMode: 'workspace-write',
    auditLogging: true,
    redactSensitiveData: true,
  },
};

/**
 * 环境变量映射
 */
const ENV_MAPPINGS = {
  CODEX_ENVIRONMENT: 'environment',
  CODEX_LOG_LEVEL: 'logging.level',
  CODEX_LOG_FORMAT: 'logging.format',
  CODEX_MAX_EXECUTION_TIME: 'performance.maxExecutionTime',
  CODEX_MAX_MEMORY_USAGE: 'performance.maxMemoryUsage',
  CODEX_ENABLE_PROFILING: 'performance.enableProfiling',
  CODEX_SANDBOX_MODE: 'security.sandboxMode',
  CODEX_AUDIT_LOGGING: 'security.auditLogging',
  CODEX_REDACT_SENSITIVE: 'security.redactSensitiveData',
};

/**
 * 配置加载器类
 */
export class ConfigLoader {
  private configValues = new Map<string, ConfigValue>();
  private searchPaths: string[] = [];
  private warnings: string[] = [];
  private errors: string[] = [];

  constructor(searchPaths?: string[]) {
    this.searchPaths = searchPaths || this.getDefaultSearchPaths();
  }

  /**
   * 获取默认搜索路径
   */
  private getDefaultSearchPaths(): string[] {
    const paths: string[] = [];

    // 当前工作目录
    paths.push(process.cwd());

    // 项目根目录
    const projectRoot = this.findProjectRoot();
    if (projectRoot !== process.cwd()) {
      paths.push(projectRoot);
    }

    // 用户配置目录
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      paths.push(join(homeDir, '.config', 'codex-father'));
      paths.push(join(homeDir, '.codex-father'));
    }

    // 系统配置目录
    if (process.platform !== 'win32') {
      paths.push('/etc/codex-father');
    }

    return paths;
  }

  /**
   * 查找项目根目录
   */
  private findProjectRoot(): string {
    let currentDir = process.cwd();

    while (currentDir !== dirname(currentDir)) {
      if (existsSync(join(currentDir, 'package.json')) || existsSync(join(currentDir, '.git'))) {
        return currentDir;
      }
      currentDir = dirname(currentDir);
    }

    return process.cwd();
  }

  /**
   * 加载配置
   */
  async load(options?: {
    configFile?: string;
    environment?: Environment;
    overrides?: Partial<ProjectConfig>;
  }): Promise<ConfigLoadResult> {
    this.reset();

    try {
      // 1. 加载默认配置
      this.loadDefaultConfig();

      // 2. 加载文件配置
      await this.loadFileConfig(options?.configFile);

      // 3. 加载环境变量
      this.loadEnvironmentConfig();

      // 4. 应用命令行覆盖
      if (options?.overrides) {
        this.loadOverrides(options.overrides);
      }

      // 5. 环境特定配置
      if (options?.environment) {
        this.applyEnvironmentConfig(options.environment);
      }

      // 6. 验证配置
      const config = this.buildFinalConfig();
      this.validateConfig(config);

      return {
        config,
        sources: this.getConfigSources(),
        warnings: [...this.warnings],
        errors: [...this.errors],
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.errors.push(`Configuration loading failed: ${reason}`);
      return {
        config: DEFAULT_CONFIG,
        sources: {},
        warnings: this.warnings,
        errors: this.errors,
      };
    }
  }

  /**
   * 重置加载器状态
   */
  private reset(): void {
    this.configValues.clear();
    this.warnings = [];
    this.errors = [];
  }

  /**
   * 加载默认配置
   */
  private loadDefaultConfig(): void {
    this.setConfigValue('', DEFAULT_CONFIG, 'default', 'built-in defaults');
  }

  /**
   * 加载文件配置
   */
  private async loadFileConfig(configFile?: string): Promise<void> {
    let configPath: string | null = null;

    if (configFile) {
      // 使用指定的配置文件
      configPath = resolve(configFile);
      if (!existsSync(configPath)) {
        this.errors.push(`Specified config file not found: ${configPath}`);
        return;
      }
    } else {
      // 搜索配置文件
      configPath = this.findConfigFile();
    }

    if (!configPath) {
      this.warnings.push('No configuration file found, using defaults');
      return;
    }

    try {
      const config = this.parseConfigFile(configPath);
      this.setConfigValue('', config, 'file', configPath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.errors.push(`Failed to load config file ${configPath}: ${message}`);
    }
  }

  /**
   * 查找配置文件
   */
  private findConfigFile(): string | null {
    for (const searchPath of this.searchPaths) {
      for (const fileName of CONFIG_FILE_NAMES) {
        const fullPath = join(searchPath, fileName);
        if (existsSync(fullPath)) {
          return fullPath;
        }
      }
    }
    return null;
  }

  /**
   * 解析配置文件
   */
  private parseConfigFile(filePath: string): Partial<ProjectConfig> {
    const content = readFileSync(filePath, 'utf8');
    const ext = filePath.split('.').pop()?.toLowerCase();

    switch (ext) {
      case 'json':
        return JSON.parse(content);

      case 'yaml':
      case 'yml':
        return parseYaml(content);

      case 'js':
        // 注意：这里需要动态导入，在生产环境可能需要特殊处理
        throw new Error('JavaScript config files not yet supported');

      default:
        throw new Error(`Unsupported config file format: ${ext}`);
    }
  }

  /**
   * 加载环境变量配置
   */
  private loadEnvironmentConfig(): void {
    for (const [envKey, configPath] of Object.entries(ENV_MAPPINGS)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        const parsedValue = this.parseEnvironmentValue(value, configPath);
        this.setConfigValue(configPath, parsedValue, 'env', envKey);
      }
    }
  }

  /**
   * 解析环境变量值
   */
  private parseEnvironmentValue(value: string, configPath: string): any {
    // 布尔值
    if (value.toLowerCase() === 'true') {
      return true;
    }
    if (value.toLowerCase() === 'false') {
      return false;
    }

    // 数字
    if (/^\\d+$/.test(value)) {
      return parseInt(value, 10);
    }
    if (/^\\d+\\.\\d+$/.test(value)) {
      return parseFloat(value);
    }

    // JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch {
        this.warnings.push(
          `Failed to parse JSON in environment variable for ${configPath}: ${value}`
        );
      }
    }

    return value;
  }

  /**
   * 加载命令行覆盖
   */
  private loadOverrides(overrides: Partial<ProjectConfig>): void {
    this.setConfigValue('', overrides, 'cli', 'command-line overrides');
  }

  /**
   * 应用环境特定配置
   */
  private applyEnvironmentConfig(environment: Environment): void {
    const envConfig: Partial<ProjectConfig> = { environment };

    // 环境特定的默认值
    switch (environment) {
      case 'development':
        envConfig.logging = {
          ...DEFAULT_CONFIG.logging,
          level: 'debug',
        };
        envConfig.performance = {
          ...DEFAULT_CONFIG.performance,
          enableProfiling: true,
        };
        break;

      case 'testing':
        envConfig.logging = {
          ...DEFAULT_CONFIG.logging,
          level: 'warn',
          format: 'json',
        };
        break;

      case 'production':
        envConfig.security = {
          ...DEFAULT_CONFIG.security,
          sandboxMode: 'readonly',
        };
        break;
    }

    this.setConfigValue('', envConfig, 'default', `environment: ${environment}`);
  }

  /**
   * 设置配置值
   */
  private setConfigValue(path: string, value: any, source: ConfigSource, sourcePath: string): void {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // 递归处理对象
      for (const [key, val] of Object.entries(value)) {
        const newPath = path ? `${path}.${key}` : key;
        this.setConfigValue(newPath, val, source, sourcePath);
      }
    } else {
      // 设置具体值
      this.configValues.set(path, {
        value,
        source,
        path: sourcePath,
      });
    }
  }

  /**
   * 构建最终配置
   */
  private buildFinalConfig(): ProjectConfig {
    const config = { ...DEFAULT_CONFIG };

    // 按优先级合并配置值
    const priorities: ConfigSource[] = ['default', 'file', 'env', 'cli'];

    for (const priority of priorities) {
      for (const [path, configValue] of this.configValues.entries()) {
        if (configValue.source === priority && path) {
          this.setNestedValue(config, path, configValue.value);
        }
      }
    }

    return config;
  }

  /**
   * 设置嵌套对象值
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key && (!(key in current) || typeof current[key] !== 'object')) {
        current[key] = {};
      }
      if (key) {
        current = current[key];
      }
    }

    const finalKey = keys[keys.length - 1];
    if (finalKey) {
      current[finalKey] = value;
    }
  }

  /**
   * 验证配置
   */
  private validateConfig(config: ProjectConfig): void {
    // 验证环境
    const validEnvironments: Environment[] = ['development', 'testing', 'production'];
    if (!validEnvironments.includes(config.environment)) {
      this.errors.push(`Invalid environment: ${config.environment}`);
    }

    // 验证日志级别
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(config.logging.level)) {
      this.errors.push(`Invalid log level: ${config.logging.level}`);
    }

    // 验证数值范围
    if (config.performance.maxExecutionTime <= 0) {
      this.errors.push('maxExecutionTime must be positive');
    }

    if (config.performance.maxMemoryUsage <= 0) {
      this.errors.push('maxMemoryUsage must be positive');
    }

    // 验证安全配置
    const validSandboxModes = ['readonly', 'workspace-write', 'full'];
    if (!validSandboxModes.includes(config.security.sandboxMode)) {
      this.errors.push(`Invalid sandbox mode: ${config.security.sandboxMode}`);
    }
  }

  /**
   * 获取配置源信息
   */
  private getConfigSources(): Record<string, ConfigSource> {
    const sources: Record<string, ConfigSource> = {};

    for (const [path, configValue] of this.configValues.entries()) {
      if (path) {
        sources[path] = configValue.source;
      }
    }

    return sources;
  }
}

/**
 * 全局配置实例
 */
let globalConfig: ProjectConfig | null = null;

/**
 * 获取全局配置
 */
export async function getConfig(options?: {
  reload?: boolean;
  configFile?: string;
  environment?: Environment;
  overrides?: Partial<ProjectConfig>;
}): Promise<ProjectConfig> {
  if (!globalConfig || options?.reload) {
    const loader = new ConfigLoader();
    const result = await loader.load(options);

    if (result.errors.length > 0) {
      throw new Error(`Configuration errors: ${result.errors.join(', ')}`);
    }

    globalConfig = result.config;

    // 在 verbose 模式下显示警告
    if (result.warnings.length > 0 && process.env.CODEX_VERBOSE) {
      result.warnings.forEach((warning) => {
        console.warn(`⚠️  Config warning: ${warning}`);
      });
    }
  }

  return globalConfig;
}

/**
 * 重新加载配置
 */
export async function reloadConfig(
  options?: Parameters<typeof getConfig>[0]
): Promise<ProjectConfig> {
  return getConfig({ ...options, reload: true });
}

/**
 * 获取配置值
 */
export function getConfigValue<T>(path: string, defaultValue?: T): T | undefined {
  if (!globalConfig) {
    throw new Error('Configuration not loaded. Call getConfig() first.');
  }

  const keys = path.split('.');
  let current: any = globalConfig;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return defaultValue;
    }
  }

  return current;
}

/**
 * 检查配置是否已加载
 */
export function isConfigLoaded(): boolean {
  return globalConfig !== null;
}
