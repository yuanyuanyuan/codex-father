import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, chmodSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
const CONFIG_RELATIVE_DIR = '.codex-father/config';
const CONFIG_FILE_NAME = 'config.json';
const ENCRYPTION_ENV_KEY = 'CODEX_CONFIG_SECRET';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
function isEncryptedPayload(value) {
    return Boolean(value &&
        typeof value === 'object' &&
        value.__encrypted === true &&
        typeof value.data === 'string');
}
function hashSecret(secret) {
    return createHash('sha256').update(secret).digest();
}
function encryptValue(raw, key) {
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
function decryptValue(payload, key) {
    const iv = Buffer.from(payload.iv, 'base64');
    const decipher = createDecipheriv(payload.algorithm, key, iv);
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payload.data, 'base64')),
        decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8'));
}
function ensureConfigDirectory(baseDirectory) {
    const configDir = resolve(baseDirectory, CONFIG_RELATIVE_DIR);
    const configPath = join(configDir, CONFIG_FILE_NAME);
    const warnings = [];
    if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
    }
    try {
        const stats = statSync(configDir);
        if ((stats.mode & 0o002) !== 0) {
            chmodSync(configDir, 0o700);
            warnings.push('Configuration directory permissions were too permissive and were tightened to 700');
        }
    }
    catch (error) {
        warnings.push(`Unable to adjust permissions for ${configDir}: ${error.message}`);
    }
    if (!existsSync(configPath)) {
        const now = new Date().toISOString();
        const initial = {
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
    }
    catch (error) {
        warnings.push(`Unable to adjust permissions for ${configPath}: ${error.message}`);
    }
    return { configDir, configPath, warnings };
}
function loadStore(configPath) {
    const raw = readFileSync(configPath, 'utf8');
    try {
        const parsed = JSON.parse(raw);
        return {
            global: parsed.global ?? {},
            environments: parsed.environments ?? {},
            metadata: parsed.metadata ?? {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: '1.0.0',
            },
        };
    }
    catch (error) {
        throw new Error(`Failed to parse configuration file ${configPath}: ${error.message}`);
    }
}
function saveStore(configPath, store) {
    const updated = {
        ...store,
        metadata: {
            ...store.metadata,
            updatedAt: new Date().toISOString(),
        },
    };
    writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
}
function resolveContainer(store, environment) {
    if (!environment) {
        return store.global;
    }
    if (!store.environments[environment]) {
        store.environments[environment] = {};
    }
    return store.environments[environment];
}
function setNestedValue(target, key, value) {
    const segments = key.split('.');
    let cursor = target;
    segments.forEach((segment, index) => {
        if (index === segments.length - 1) {
            cursor[segment] = value;
            return;
        }
        if (!Object.prototype.hasOwnProperty.call(cursor, segment) ||
            typeof cursor[segment] !== 'object' ||
            cursor[segment] === null) {
            cursor[segment] = {};
        }
        cursor = cursor[segment];
    });
}
function getNestedValue(target, key) {
    if (!target) {
        return undefined;
    }
    return key.split('.').reduce((acc, segment) => {
        if (acc && typeof acc === 'object' && segment in acc) {
            return acc[segment];
        }
        return undefined;
    }, target);
}
function parseValue(raw) {
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
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
            return JSON.parse(trimmed);
        }
        catch {
            return raw;
        }
    }
    return raw;
}
export class ConfigAccess {
    configPath;
    warnings = [];
    constructor(workingDirectory) {
        const { configPath, warnings } = ensureConfigDirectory(workingDirectory);
        this.configPath = configPath;
        this.warnings.push(...warnings);
    }
    getWarnings() {
        return [...this.warnings];
    }
    getConfigPath() {
        return this.configPath;
    }
    init(environment) {
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
    set(options) {
        if (!options.key) {
            throw new Error('Configuration key is required');
        }
        const store = loadStore(this.configPath);
        const container = resolveContainer(store, options.environment);
        const parsedValue = typeof options.value === 'string' ? parseValue(options.value) : options.value;
        const encryptionKey = options.secure ? this.getEncryptionKey() : null;
        if (options.secure && !encryptionKey) {
            throw new Error(`Secure storage requested but ${ENCRYPTION_ENV_KEY} is not configured`);
        }
        const storedValue = encryptionKey ? encryptValue(parsedValue, encryptionKey) : parsedValue;
        setNestedValue(container, options.key, storedValue);
        saveStore(this.configPath, store);
        return {
            encrypted: Boolean(encryptionKey),
            value: encryptionKey ? '[encrypted]' : parsedValue,
            ...(options.environment ? { environment: options.environment } : {}),
        };
    }
    get(options) {
        const store = loadStore(this.configPath);
        const container = options.environment
            ? store.environments[options.environment] ?? {}
            : store.global;
        const raw = getNestedValue(container, options.key);
        if (raw === undefined) {
            return {
                encrypted: false,
                ...(options.environment ? { environment: options.environment } : {}),
            };
        }
        if (isEncryptedPayload(raw)) {
            const key = this.getEncryptionKey();
            if (!key) {
                return {
                    encrypted: true,
                    value: '[encrypted]',
                    ...(options.environment ? { environment: options.environment } : {}),
                };
            }
            const decrypted = decryptValue(raw, key);
            return {
                encrypted: true,
                value: options.reveal ? decrypted : '[encrypted]',
                ...(options.environment ? { environment: options.environment } : {}),
            };
        }
        return {
            encrypted: false,
            value: raw,
            ...(options.environment ? { environment: options.environment } : {}),
        };
    }
    list() {
        return loadStore(this.configPath);
    }
    getEncryptionKey() {
        const secret = process.env[ENCRYPTION_ENV_KEY];
        if (!secret || secret.trim() === '') {
            return null;
        }
        return hashSecret(secret.trim());
    }
}
export function maskSensitive(value) {
    if (isEncryptedPayload(value)) {
        return '[encrypted]';
    }
    if (Array.isArray(value)) {
        return value.map((item) => maskSensitive(item));
    }
    if (typeof value === 'object' && value !== null) {
        const clone = {};
        for (const [key, val] of Object.entries(value)) {
            clone[key] = maskSensitive(val);
        }
        return clone;
    }
    return value;
}
export function summarise(store) {
    return {
        global: maskSensitive(store.global),
        environments: maskSensitive(store.environments),
    };
}
