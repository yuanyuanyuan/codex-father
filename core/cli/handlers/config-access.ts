import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export interface ConfigMetadata {
  createdAt: string;
  updatedAt: string;
  version: string;
}

export interface ConfigStore {
  global: Record<string, unknown>;
  environments: Record<string, Record<string, unknown>>;
  metadata: ConfigMetadata;
}

export interface SetConfigOptions {
  key: string;
  value: unknown;
  environment?: string;
  secure?: boolean;
}

export interface GetConfigOptions {
  key: string;
  environment?: string;
  reveal?: boolean;
}

export interface ConfigAccessResult {
  configPath: string;
  warnings: string[];
}

const CONFIG_RELATIVE_DIR = '.codex-father/config';
const CONFIG_FILE_NAME = 'config.json';
const ENCRYPTION_ENV_KEY = 'CODEX_CONFIG_SECRET';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';

interface EncryptedPayload {
  __encrypted: true;
  algorithm: string;
  iv: string;
  tag: string;
  data: string;
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as Record<string, unknown>).__encrypted === true &&
      typeof (value as Record<string, unknown>).data === 'string'
  );
}

function hashSecret(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function encryptValue(raw: unknown, key: Buffer): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(raw), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    __encrypted: true,
    algorithm: ENCRYPTION_ALGORITHM,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

function decryptValue(payload: EncryptedPayload, key: Buffer): unknown {
  const iv = Buffer.from(payload.iv, 'base64');
  const decipher = createDecipheriv(payload.algorithm, key, iv);
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

function ensureConfigDirectory(baseDirectory: string): {
  configDir: string;
  configPath: string;
  warnings: string[];
} {
  const configDir = resolve(baseDirectory, CONFIG_RELATIVE_DIR);
  const configPath = join(configDir, CONFIG_FILE_NAME);
  const warnings: string[] = [];

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  try {
    const stats = statSync(configDir);
    if ((stats.mode & 0o002) !== 0) {
      chmodSync(configDir, 0o700);
      warnings.push(
        'Configuration directory permissions were too permissive and were tightened to 700'
      );
    }
  } catch (error) {
    warnings.push(`Unable to adjust permissions for ${configDir}: ${(error as Error).message}`);
  }

  if (!existsSync(configPath)) {
    const now = new Date().toISOString();
    const initial: ConfigStore = {
      global: {},
      environments: {},
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: '1.0.0',
      },
    };
    writeFileSync(configPath, JSON.stringify(initial, null, 2), 'utf8');
  }

  try {
    const stats = statSync(configPath);
    if ((stats.mode & 0o077) !== 0) {
      chmodSync(configPath, 0o600);
      warnings.push('Configuration file permissions were tightened to 600 to protect secrets');
    }
  } catch (error) {
    warnings.push(`Unable to adjust permissions for ${configPath}: ${(error as Error).message}`);
  }

  return { configDir, configPath, warnings };
}

function loadStore(configPath: string): ConfigStore {
  const raw = readFileSync(configPath, 'utf8');
  try {
    const parsed = JSON.parse(raw) as Partial<ConfigStore>;
    return {
      global: parsed.global ?? {},
      environments: parsed.environments ?? {},
      metadata: parsed.metadata ?? {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: '1.0.0',
      },
    };
  } catch (error) {
    throw new Error(
      `Failed to parse configuration file ${configPath}: ${(error as Error).message}`
    );
  }
}

function saveStore(configPath: string, store: ConfigStore): void {
  const updated: ConfigStore = {
    ...store,
    metadata: {
      ...store.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
  writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
}

function resolveContainer(store: ConfigStore, environment?: string): Record<string, unknown> {
  if (!environment) {
    return store.global;
  }
  if (!store.environments[environment]) {
    store.environments[environment] = {};
  }
  return store.environments[environment];
}

function setNestedValue(target: Record<string, unknown>, key: string, value: unknown): void {
  const segments = key.split('.');
  let cursor: Record<string, unknown> = target;

  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }
    if (
      !Object.prototype.hasOwnProperty.call(cursor, segment) ||
      typeof cursor[segment] !== 'object' ||
      cursor[segment] === null
    ) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  });
}

function getNestedValue(target: Record<string, unknown> | undefined, key: string): unknown {
  if (!target) {
    return undefined;
  }
  return key.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, target);
}

function parseValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return '';
  }
  if (trimmed === 'true') {
    return true;
  }
  if (trimmed === 'false') {
    return false;
  }
  if (trimmed === 'null') {
    return null;
  }
  if (!Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

export class ConfigAccess {
  private readonly configPath: string;
  private readonly warnings: string[] = [];

  constructor(workingDirectory: string) {
    const { configPath, warnings } = ensureConfigDirectory(workingDirectory);
    this.configPath = configPath;
    this.warnings.push(...warnings);
  }

  getWarnings(): string[] {
    return [...this.warnings];
  }

  getConfigPath(): string {
    return this.configPath;
  }

  init(environment?: string): ConfigAccessResult {
    const store = loadStore(this.configPath);
    if (environment && !store.environments[environment]) {
      store.environments[environment] = {};
      saveStore(this.configPath, store);
    }
    return {
      configPath: this.configPath,
      warnings: this.getWarnings(),
    };
  }

  set(options: SetConfigOptions): { encrypted: boolean; environment?: string; value: unknown } {
    if (!options.key) {
      throw new Error('Configuration key is required');
    }

    const store = loadStore(this.configPath);
    const container = resolveContainer(store, options.environment);
    const parsedValue =
      typeof options.value === 'string' ? parseValue(options.value) : options.value;
    const encryptionKey = options.secure ? this.getEncryptionKey() : null;

    if (options.secure && !encryptionKey) {
      throw new Error(`Secure storage requested but ${ENCRYPTION_ENV_KEY} is not configured`);
    }

    const storedValue = encryptionKey ? encryptValue(parsedValue, encryptionKey) : parsedValue;
    setNestedValue(container, options.key, storedValue);
    saveStore(this.configPath, store);

    return {
      encrypted: Boolean(encryptionKey),
      environment: options.environment,
      value: encryptionKey ? '[encrypted]' : parsedValue,
    };
  }

  get(options: GetConfigOptions): { value?: unknown; encrypted: boolean; environment?: string } {
    const store = loadStore(this.configPath);
    const container = options.environment ? store.environments[options.environment] : store.global;
    const raw = getNestedValue(container, options.key);

    if (raw === undefined) {
      return { encrypted: false, environment: options.environment };
    }

    if (isEncryptedPayload(raw)) {
      const key = this.getEncryptionKey();
      if (!key) {
        return { encrypted: true, environment: options.environment, value: '[encrypted]' };
      }
      const decrypted = decryptValue(raw, key);
      return {
        encrypted: true,
        environment: options.environment,
        value: options.reveal ? decrypted : '[encrypted]',
      };
    }

    return {
      encrypted: false,
      environment: options.environment,
      value: raw,
    };
  }

  list(): ConfigStore {
    return loadStore(this.configPath);
  }

  private getEncryptionKey(): Buffer | null {
    const secret = process.env[ENCRYPTION_ENV_KEY];
    if (!secret || secret.trim() === '') {
      return null;
    }
    return hashSecret(secret.trim());
  }
}

export function maskSensitive(value: unknown): unknown {
  if (isEncryptedPayload(value)) {
    return '[encrypted]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskSensitive(item));
  }
  if (typeof value === 'object' && value !== null) {
    const clone: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      clone[key] = maskSensitive(val);
    }
    return clone;
  }
  return value;
}

export function summarise(store: ConfigStore): {
  global: Record<string, unknown>;
  environments: Record<string, Record<string, unknown>>;
} {
  return {
    global: maskSensitive(store.global) as Record<string, unknown>,
    environments: maskSensitive(store.environments) as Record<string, Record<string, unknown>>,
  };
}
