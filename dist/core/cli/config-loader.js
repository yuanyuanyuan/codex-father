import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { parse as parseYaml } from 'yaml';
const CONFIG_FILE_NAMES = [
    'codex-father.config.js',
    'codex-father.config.json',
    'codex-father.config.yaml',
    'codex-father.config.yml',
    '.codex-father.json',
    '.codex-father.yaml',
    '.codex-father.yml',
];
const DEFAULT_CONFIG = {
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
        maxExecutionTime: 300000,
        maxMemoryUsage: 1024 * 1024 * 1024,
        enableProfiling: false,
    },
    security: {
        sandboxMode: 'workspace-write',
        auditLogging: true,
        redactSensitiveData: true,
    },
};
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
export class ConfigLoader {
    configValues = new Map();
    searchPaths = [];
    warnings = [];
    errors = [];
    constructor(searchPaths) {
        this.searchPaths = searchPaths || this.getDefaultSearchPaths();
    }
    getDefaultSearchPaths() {
        const paths = [];
        paths.push(process.cwd());
        const projectRoot = this.findProjectRoot();
        if (projectRoot !== process.cwd()) {
            paths.push(projectRoot);
        }
        const homeDir = process.env.HOME || process.env.USERPROFILE;
        if (homeDir) {
            paths.push(join(homeDir, '.config', 'codex-father'));
            paths.push(join(homeDir, '.codex-father'));
        }
        if (process.platform !== 'win32') {
            paths.push('/etc/codex-father');
        }
        return paths;
    }
    findProjectRoot() {
        let currentDir = process.cwd();
        while (currentDir !== dirname(currentDir)) {
            if (existsSync(join(currentDir, 'package.json')) || existsSync(join(currentDir, '.git'))) {
                return currentDir;
            }
            currentDir = dirname(currentDir);
        }
        return process.cwd();
    }
    async load(options) {
        this.reset();
        try {
            this.loadDefaultConfig();
            await this.loadFileConfig(options?.configFile);
            this.loadEnvironmentConfig();
            if (options?.overrides) {
                this.loadOverrides(options.overrides);
            }
            if (options?.environment) {
                this.applyEnvironmentConfig(options.environment);
            }
            const config = this.buildFinalConfig();
            this.validateConfig(config);
            return {
                config,
                sources: this.getConfigSources(),
                warnings: [...this.warnings],
                errors: [...this.errors],
            };
        }
        catch (error) {
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
    reset() {
        this.configValues.clear();
        this.warnings = [];
        this.errors = [];
    }
    loadDefaultConfig() {
        this.setConfigValue('', DEFAULT_CONFIG, 'default', 'built-in defaults');
    }
    async loadFileConfig(configFile) {
        let configPath = null;
        if (configFile) {
            configPath = resolve(configFile);
            if (!existsSync(configPath)) {
                this.errors.push(`Specified config file not found: ${configPath}`);
                return;
            }
        }
        else {
            configPath = this.findConfigFile();
        }
        if (!configPath) {
            this.warnings.push('No configuration file found, using defaults');
            return;
        }
        try {
            const config = this.parseConfigFile(configPath);
            this.setConfigValue('', config, 'file', configPath);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errors.push(`Failed to load config file ${configPath}: ${message}`);
        }
    }
    findConfigFile() {
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
    parseConfigFile(filePath) {
        const content = readFileSync(filePath, 'utf8');
        const ext = filePath.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'json':
                return JSON.parse(content);
            case 'yaml':
            case 'yml':
                return parseYaml(content);
            case 'js':
                throw new Error('JavaScript config files not yet supported');
            default:
                throw new Error(`Unsupported config file format: ${ext}`);
        }
    }
    loadEnvironmentConfig() {
        for (const [envKey, configPath] of Object.entries(ENV_MAPPINGS)) {
            const value = process.env[envKey];
            if (value !== undefined) {
                const parsedValue = this.parseEnvironmentValue(value, configPath);
                this.setConfigValue(configPath, parsedValue, 'env', envKey);
            }
        }
    }
    parseEnvironmentValue(value, configPath) {
        if (value.toLowerCase() === 'true') {
            return true;
        }
        if (value.toLowerCase() === 'false') {
            return false;
        }
        if (/^\\d+$/.test(value)) {
            return parseInt(value, 10);
        }
        if (/^\\d+\\.\\d+$/.test(value)) {
            return parseFloat(value);
        }
        if (value.startsWith('{') || value.startsWith('[')) {
            try {
                return JSON.parse(value);
            }
            catch {
                this.warnings.push(`Failed to parse JSON in environment variable for ${configPath}: ${value}`);
            }
        }
        return value;
    }
    loadOverrides(overrides) {
        this.setConfigValue('', overrides, 'cli', 'command-line overrides');
    }
    applyEnvironmentConfig(environment) {
        const envConfig = { environment };
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
    setConfigValue(path, value, source, sourcePath) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            for (const [key, val] of Object.entries(value)) {
                const newPath = path ? `${path}.${key}` : key;
                this.setConfigValue(newPath, val, source, sourcePath);
            }
        }
        else {
            this.configValues.set(path, {
                value,
                source,
                path: sourcePath,
            });
        }
    }
    buildFinalConfig() {
        const config = { ...DEFAULT_CONFIG };
        const priorities = ['default', 'file', 'env', 'cli'];
        for (const priority of priorities) {
            for (const [path, configValue] of this.configValues.entries()) {
                if (configValue.source === priority && path) {
                    this.setNestedValue(config, path, configValue.value);
                }
            }
        }
        return config;
    }
    setNestedValue(obj, path, value) {
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
    validateConfig(config) {
        const validEnvironments = ['development', 'testing', 'production'];
        if (!validEnvironments.includes(config.environment)) {
            this.errors.push(`Invalid environment: ${config.environment}`);
        }
        const validLogLevels = ['debug', 'info', 'warn', 'error'];
        if (!validLogLevels.includes(config.logging.level)) {
            this.errors.push(`Invalid log level: ${config.logging.level}`);
        }
        if (config.performance.maxExecutionTime <= 0) {
            this.errors.push('maxExecutionTime must be positive');
        }
        if (config.performance.maxMemoryUsage <= 0) {
            this.errors.push('maxMemoryUsage must be positive');
        }
        const validSandboxModes = ['readonly', 'workspace-write', 'full'];
        if (!validSandboxModes.includes(config.security.sandboxMode)) {
            this.errors.push(`Invalid sandbox mode: ${config.security.sandboxMode}`);
        }
    }
    getConfigSources() {
        const sources = {};
        for (const [path, configValue] of this.configValues.entries()) {
            if (path) {
                sources[path] = configValue.source;
            }
        }
        return sources;
    }
}
let globalConfig = null;
export async function getConfig(options) {
    if (!globalConfig || options?.reload) {
        const loader = new ConfigLoader();
        const result = await loader.load(options);
        if (result.errors.length > 0) {
            throw new Error(`Configuration errors: ${result.errors.join(', ')}`);
        }
        globalConfig = result.config;
        if (result.warnings.length > 0 && process.env.CODEX_VERBOSE) {
            result.warnings.forEach((warning) => {
                console.warn(`⚠️  Config warning: ${warning}`);
            });
        }
    }
    return globalConfig;
}
export async function reloadConfig(options) {
    return getConfig({ ...options, reload: true });
}
export function getConfigValue(path, defaultValue) {
    if (!globalConfig) {
        throw new Error('Configuration not loaded. Call getConfig() first.');
    }
    const keys = path.split('.');
    let current = globalConfig;
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        }
        else {
            return defaultValue;
        }
    }
    return current;
}
export function isConfigLoaded() {
    return globalConfig !== null;
}
