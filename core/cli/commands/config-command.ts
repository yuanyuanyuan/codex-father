import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CLIParser } from '../parser.js';
import type { CommandContext, CommandResult } from '../../lib/types.js';

interface PersistentConfig {
  values: Record<string, unknown>;
  environments: Record<string, Record<string, unknown>>;
  metadata: {
    createdAt: string;
    updatedAt: string;
  };
}

const CONFIG_FILE_NAME = 'config.json';

export function registerConfigCommand(parser: CLIParser): void {
  parser.registerCommand(
    'config',
    'Manage Codex Father configuration',
    async (context: CommandContext): Promise<CommandResult> => {
      const startedAt = Date.now();
      const action = context.args[0];
      const key = context.args[1];
      const value = context.args[2];
      const environment = (context.options.environment || context.options.env) as string | undefined;
      const configPath = ensureConfigPath(context.workingDirectory);

      try {
        switch (action) {
          case 'init':
            return handleInit(configPath, environment, context, startedAt);
          case 'set':
            return handleSet(configPath, key, value, environment, context, startedAt);
          case 'get':
            return handleGet(configPath, key, environment, context, startedAt);
          case 'list':
            return handleList(configPath, context, startedAt);
          case 'validate':
            return handleValidate(configPath, context, startedAt);
          default:
            return {
              success: false,
              message: `Unknown config action: ${action ?? ''}`.trim(),
              errors: ['Supported actions: init, get, set, list, validate'],
              executionTime: Date.now() - startedAt,
            };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message: 'Configuration command failed',
          errors: [message],
          executionTime: Date.now() - startedAt,
        };
      }
    },
    {
      arguments: [
        { name: 'action', description: 'Config action (init|get|set|list|validate)', required: true },
        { name: 'key', description: 'Configuration key (dot notation)', required: false },
        { name: 'value', description: 'Configuration value for set action', required: false },
      ],
      options: [
        { flags: '--environment <env>', description: 'Target environment (development|testing|production)' },
        { flags: '--env <env>', description: 'Alias of --environment' },
        { flags: '--json', description: 'Output in JSON format' },
      ],
    }
  );
}

function ensureConfigPath(workingDirectory: string): string {
  const baseDir = join(workingDirectory, '.codex-father', 'config');
  if (!existsSync(baseDir)) {
    mkdirSync(baseDir, { recursive: true });
  }
  const configFile = join(baseDir, CONFIG_FILE_NAME);
  if (!existsSync(configFile)) {
    const now = new Date().toISOString();
    const initial: PersistentConfig = {
      values: {},
      environments: {},
      metadata: { createdAt: now, updatedAt: now },
    };
    writeFileSync(configFile, JSON.stringify(initial, null, 2), 'utf8');
  }
  return configFile;
}

function loadConfig(configPath: string): PersistentConfig {
  const raw = readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<PersistentConfig>;
  return {
    values: parsed.values ?? {},
    environments: parsed.environments ?? {},
    metadata: parsed.metadata ?? {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
}

function saveConfig(configPath: string, config: PersistentConfig): void {
  config.metadata.updatedAt = new Date().toISOString();
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

function handleInit(
  configPath: string,
  environment: string | undefined,
  context: CommandContext,
  startedAt: number
): CommandResult {
  const config = loadConfig(configPath);
  if (environment) {
    if (!config.environments[environment]) {
      config.environments[environment] = {};
      saveConfig(configPath, config);
    }
  } else {
    saveConfig(configPath, config);
  }

  const data = {
    configPath,
    environment: environment ?? null,
    environments: Object.keys(config.environments),
  };

  if (context.json) {
    return {
      success: true,
      data,
      executionTime: Date.now() - startedAt,
    };
  }

  const envMessage = environment
    ? `Environment "${environment}" initialized`
    : 'Configuration initialized';

  return {
    success: true,
    message: envMessage,
    executionTime: Date.now() - startedAt,
  };
}

function handleSet(
  configPath: string,
  key: string | undefined,
  value: string | undefined,
  environment: string | undefined,
  context: CommandContext,
  startedAt: number
): CommandResult {
  if (!key) {
    return {
      success: false,
      message: 'Missing configuration key',
      errors: ['Usage: codex-father config set <key> <value>'],
      executionTime: Date.now() - startedAt,
    };
  }
  if (value === undefined) {
    return {
      success: false,
      message: 'Missing configuration value',
      errors: ['Provide a value to assign'],
      executionTime: Date.now() - startedAt,
    };
  }

  const parsedValue = parseValue(value);
  const config = loadConfig(configPath);

  if (environment) {
    if (!config.environments[environment]) {
      config.environments[environment] = {};
    }
    setByPath(config.environments[environment], key, parsedValue);
  } else {
    setByPath(config.values, key, parsedValue);
  }

  saveConfig(configPath, config);

  const payload = { key, value: parsedValue, environment: environment ?? null };
  if (context.json) {
    return {
      success: true,
      data: payload,
      executionTime: Date.now() - startedAt,
    };
  }

  return {
    success: true,
    message: `Configuration updated for ${environment ?? 'global'}:${key}`,
    executionTime: Date.now() - startedAt,
  };
}

function handleGet(
  configPath: string,
  key: string | undefined,
  environment: string | undefined,
  context: CommandContext,
  startedAt: number
): CommandResult {
  if (!key) {
    return {
      success: false,
      message: 'Missing configuration key',
      errors: ['Usage: codex-father config get <key>'],
      executionTime: Date.now() - startedAt,
    };
  }

  const config = loadConfig(configPath);
  let value: unknown;

  if (environment) {
    value = getByPath(config.environments[environment], key);
  }
  if (value === undefined) {
    value = getByPath(config.values, key);
  }

  if (value === undefined) {
    return {
      success: false,
      message: `Configuration key not found: ${key}`,
      errors: ['Key does not exist in config'],
      executionTime: Date.now() - startedAt,
    };
  }

  if (context.json) {
    return {
      success: true,
      data: { key, value, environment: environment ?? null },
      executionTime: Date.now() - startedAt,
    };
  }

  return {
    success: true,
    message: `${key} = ${formatValue(value)}`,
    executionTime: Date.now() - startedAt,
  };
}

function handleList(
  configPath: string,
  context: CommandContext,
  startedAt: number
): CommandResult {
  const config = loadConfig(configPath);
  const data = {
    global: config.values,
    environments: config.environments,
    metadata: config.metadata,
  };

  if (context.json) {
    return {
      success: true,
      data,
      executionTime: Date.now() - startedAt,
    };
  }

  const envLines = Object.entries(config.environments).map(
    ([env, values]) => `Environment: ${env}\n${JSON.stringify(values, null, 2)}`
  );

  const lines = [
    'Global configuration:',
    JSON.stringify(config.values, null, 2),
    ...envLines,
  ];

  return {
    success: true,
    message: lines.join('\n\n'),
    executionTime: Date.now() - startedAt,
  };
}

function handleValidate(
  configPath: string,
  context: CommandContext,
  startedAt: number
): CommandResult {
  try {
    const config = loadConfig(configPath);
    const environments = Object.keys(config.environments);
    const data = { configPath, environments, updatedAt: config.metadata.updatedAt };

    if (context.json) {
      return {
        success: true,
        data,
        executionTime: Date.now() - startedAt,
      };
    }

    return {
      success: true,
      message: 'Configuration file is valid',
      executionTime: Date.now() - startedAt,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: 'Configuration validation failed',
      errors: [message],
      executionTime: Date.now() - startedAt,
    };
  }
}

function setByPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.');
  let current: Record<string, unknown> = target;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!(segment in current) || typeof current[segment] !== 'object' || current[segment] === null) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]] = value;
}

function getByPath(target: Record<string, unknown> | undefined, path: string): unknown {
  if (!target) return undefined;
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in acc) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, target);
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (!Number.isNaN(Number(trimmed)) && trimmed !== '') {
    return Number(trimmed);
  }
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

function formatValue(value: unknown): string {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}
