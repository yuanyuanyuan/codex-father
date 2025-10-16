import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';

export interface Config {
  server?: {
    port?: number;
    host?: string;
    enableWebSocket?: boolean;
    cors?: {
      origins?: string[];
      credentials?: boolean;
    };
  };
  runner?: {
    maxConcurrency?: number;
    defaultTimeout?: number;
    workingDirectory?: string;
    security?: {
      networkDisabled?: boolean;
      allowedPaths?: string[];
      maxExecutionTime?: number;
      allowedCommands?: string[];
    };
  };
  logging?: {
    level?: 'error' | 'warn' | 'info' | 'debug';
    file?: string;
    maxSize?: string;
    maxFiles?: number;
  };
}

export class ConfigManager {
  private configPaths: string[];
  private config: Config;

  constructor() {
    this.configPaths = this.getConfigPaths();
    this.config = this.getDefaultConfig();
  }

  private getConfigPaths(): string[] {
    const cwd = process.cwd();
    const home = homedir();

    return [
      path.join(cwd, 'codex-father.json'),
      path.join(cwd, '.codex-father.json'),
      path.join(home, '.codex-father', 'config.json'),
      path.join(home, '.codex-father.json'),
    ];
  }

  private getDefaultConfig(): Config {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        enableWebSocket: true,
        cors: {
          origins: ['*'],
          credentials: false,
        },
      },
      runner: {
        maxConcurrency: 10,
        defaultTimeout: 600000,
        workingDirectory: process.cwd(),
        security: {
          networkDisabled: true,
          allowedPaths: [process.cwd()],
          maxExecutionTime: 600000,
          allowedCommands: [
            'npm',
            'node',
            'python',
            'python3',
            'bash',
            'sh',
            'ls',
            'cat',
            'echo',
            'mkdir',
            'rm',
            'cp',
            'mv',
            'git',
          ],
        },
      },
      logging: {
        level: 'info',
        file: './logs/codex-father.log',
        maxSize: '10MB',
        maxFiles: 5,
      },
    };
  }

  async loadConfig(): Promise<Config> {
    for (const configPath of this.configPaths) {
      try {
        const data = await fs.readFile(configPath, 'utf-8');
        const loadedConfig = JSON.parse(data);

        // Merge with default config
        this.config = this.mergeConfig(this.config, loadedConfig);
        console.log(`✅ Configuration loaded from: ${configPath}`);
        return this.config;
      } catch (error) {
        // File doesn't exist or is invalid, try next path
        continue;
      }
    }

    // No config file found, use defaults
    console.log('ℹ️  No configuration file found, using defaults');
    return this.config;
  }

  private mergeConfig(defaultConfig: Config, loadedConfig: Partial<Config>): Config {
    return {
      server: { ...defaultConfig.server, ...loadedConfig.server },
      runner: { ...defaultConfig.runner, ...loadedConfig.runner },
      logging: { ...defaultConfig.logging, ...loadedConfig.logging },
    };
  }

  async saveConfig(config: Config, configPath?: string): Promise<void> {
    const targetPath = configPath || this.configPaths[0];

    try {
      // Ensure directory exists
      const dir = path.dirname(targetPath);
      await fs.mkdir(dir, { recursive: true });

      // Write config file
      const configJson = JSON.stringify(config, null, 2);
      await fs.writeFile(targetPath, configJson, 'utf-8');

      console.log(`✅ Configuration saved to: ${targetPath}`);
    } catch (error) {
      throw new Error(`Failed to save config to ${targetPath}: ${error}`);
    }
  }

  getConfig(): Config {
    return this.config;
  }

  get(key: string): any {
    const keys = key.split('.');
    let value: any = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined;
      }
    }

    return value;
  }

  set(key: string, value: any): void {
    const keys = key.split('.');
    let current: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!current[k] || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k];
    }

    current[keys[keys.length - 1]] = value;
  }

  validateConfig(config: Config): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate server config
    if (config.server) {
      if (config.server.port && (config.server.port < 1 || config.server.port > 65535)) {
        errors.push('Server port must be between 1 and 65535');
      }

      if (config.server.host && typeof config.server.host !== 'string') {
        errors.push('Server host must be a string');
      }
    }

    // Validate runner config
    if (config.runner) {
      if (
        config.runner.maxConcurrency &&
        (config.runner.maxConcurrency < 1 || config.runner.maxConcurrency > 100)
      ) {
        errors.push('Max concurrency must be between 1 and 100');
      }

      if (config.runner.defaultTimeout && config.runner.defaultTimeout < 1000) {
        errors.push('Default timeout must be at least 1000ms');
      }

      if (config.runner.workingDirectory && typeof config.runner.workingDirectory !== 'string') {
        errors.push('Working directory must be a string');
      }
    }

    // Validate logging config
    if (config.logging) {
      const validLevels = ['error', 'warn', 'info', 'debug'];
      if (config.logging.level && !validLevels.includes(config.logging.level)) {
        errors.push(`Log level must be one of: ${validLevels.join(', ')}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async createSampleConfig(outputPath?: string): Promise<void> {
    const sampleConfig = this.getDefaultConfig();
    const targetPath = outputPath || 'codex-father.example.json';

    await this.saveConfig(sampleConfig, targetPath);
    console.log(`📝 Sample configuration created: ${targetPath}`);
    console.log('💡 You can customize this file and rename it to codex-father.json');
  }
}
