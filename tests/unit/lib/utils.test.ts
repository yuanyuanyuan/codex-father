/**
 * Utils 单元测试
 *
 * 测试范围：
 * - ID生成工具 (UUID、短ID、时间戳ID)
 * - 验证和格式化工具
 * - 性能监控功能
 * - 错误处理和日志
 * - 配置管理和环境检测
 * - 路径处理和安全验证
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import * as crypto from 'crypto';
import { performance } from 'perf_hooks';
import {
  generateUUID,
  generateShortId,
  generateTimestampId,
  generateSlug,
  validateEmail,
  validateUrl,
  validatePath,
  validateJSON,
  validateSchema,
  formatDate,
  formatFileSize,
  formatDuration,
  formatNumber,
  sanitizePath,
  normalizePath,
  resolveRelativePath,
  isValidExtension,
  createPerformanceTimer,
  logPerformance,
  getPerformanceMetrics,
  clearPerformanceMetrics,
  createLogger,
  formatLogEntry,
  parseConfig,
  getConfigValue,
  setConfigValue,
  validateConfig,
  detectEnvironment,
  isProduction,
  isDevelopment,
  isTest,
  getSystemInfo,
  createRetryHandler,
  debounce,
  throttle,
  deepClone,
  deepMerge,
  arrayToMap,
  groupBy,
  chunk,
  calculateHash,
  compareHashes,
  encodeBase64,
  decodeBase64,
  type ValidationRule,
  type ValidationResult,
  type FormatOptions,
  type PerformanceMetric,
  type LogEntry,
  type ConfigValue,
  type Environment
} from '../../../src/lib/utils.js';

describe('Utils', () => {
  beforeEach(() => {
    // 清理性能指标
    clearPerformanceMetrics();

    // 重置模拟
    vi.clearAllMocks();
  });

  describe('ID Generation', () => {
    describe('generateUUID', () => {
      it('should generate valid UUID v4', () => {
        const uuid = generateUUID();

        expect(uuid).toBeDefined();
        expect(typeof uuid).toBe('string');
        expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      });

      it('should generate unique UUIDs', () => {
        const uuid1 = generateUUID();
        const uuid2 = generateUUID();

        expect(uuid1).not.toBe(uuid2);
      });

      it('should generate UUIDs of correct length', () => {
        const uuid = generateUUID();

        expect(uuid.length).toBe(36); // 32 characters + 4 hyphens
      });
    });

    describe('generateShortId', () => {
      it('should generate 8-character hex string', () => {
        const shortId = generateShortId();

        expect(shortId).toBeDefined();
        expect(typeof shortId).toBe('string');
        expect(shortId.length).toBe(8);
        expect(shortId).toMatch(/^[0-9a-f]{8}$/i);
      });

      it('should generate unique short IDs', () => {
        const id1 = generateShortId();
        const id2 = generateShortId();

        expect(id1).not.toBe(id2);
      });
    });

    describe('generateTimestampId', () => {
      it('should generate timestamp-based ID', () => {
        const timestampId = generateTimestampId();

        expect(timestampId).toBeDefined();
        expect(typeof timestampId).toBe('string');
        expect(timestampId.length).toBeGreaterThan(10);
      });

      it('should include timestamp prefix', () => {
        const timestampId = generateTimestampId('test');

        expect(timestampId).toMatch(/^test_\d+_[0-9a-f]+$/);
      });

      it('should generate unique IDs even in rapid succession', () => {
        const ids = Array.from({ length: 10 }, () => generateTimestampId());
        const uniqueIds = new Set(ids);

        expect(uniqueIds.size).toBe(ids.length);
      });
    });

    describe('generateSlug', () => {
      it('should generate URL-friendly slug', () => {
        const slug = generateSlug('Hello World Test');

        expect(slug).toBe('hello-world-test');
      });

      it('should handle special characters', () => {
        const slug = generateSlug('Hello, World! Test@#$%');

        expect(slug).toBe('hello-world-test');
      });

      it('should handle Unicode characters', () => {
        const slug = generateSlug('Héllo Wörld 测试');

        expect(slug).toMatch(/^[a-z0-9-]+$/);
      });

      it('should handle empty input', () => {
        const slug = generateSlug('');

        expect(slug).toBe('');
      });
    });
  });

  describe('Validation Tools', () => {
    describe('validateEmail', () => {
      it('should validate correct email addresses', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'user+tag@domain.org',
          '123@456.com'
        ];

        validEmails.forEach(email => {
          expect(validateEmail(email)).toBe(true);
        });
      });

      it('should reject invalid email addresses', () => {
        const invalidEmails = [
          'invalid.email',
          '@domain.com',
          'user@',
          'user space@domain.com',
          'user..double@domain.com'
        ];

        invalidEmails.forEach(email => {
          expect(validateEmail(email)).toBe(false);
        });
      });
    });

    describe('validateUrl', () => {
      it('should validate correct URLs', () => {
        const validUrls = [
          'https://example.com',
          'http://localhost:3000',
          'https://subdomain.example.com/path?query=value',
          'ftp://files.example.com'
        ];

        validUrls.forEach(url => {
          expect(validateUrl(url)).toBe(true);
        });
      });

      it('should reject invalid URLs', () => {
        const invalidUrls = [
          'not-a-url',
          'htps://typo.com',
          '//invalid-protocol',
          'http://',
          'javascript:alert(1)'
        ];

        invalidUrls.forEach(url => {
          expect(validateUrl(url)).toBe(false);
        });
      });
    });

    describe('validatePath', () => {
      it('should validate safe file paths', () => {
        const validPaths = [
          '/home/user/document.txt',
          'relative/path/file.md',
          './current/directory/file.json',
          'simple-filename.txt'
        ];

        validPaths.forEach(path => {
          expect(validatePath(path)).toBe(true);
        });
      });

      it('should reject dangerous paths', () => {
        const dangerousPaths = [
          '../../../etc/passwd',
          '/etc/passwd',
          '..\\windows\\system32',
          'file://dangerous',
          'path/with/null\0byte'
        ];

        dangerousPaths.forEach(path => {
          expect(validatePath(path)).toBe(false);
        });
      });
    });

    describe('validateJSON', () => {
      it('should validate correct JSON strings', () => {
        const validJSON = [
          '{"key": "value"}',
          '[1, 2, 3]',
          '"simple string"',
          'null',
          'true',
          '123'
        ];

        validJSON.forEach(json => {
          expect(validateJSON(json)).toBe(true);
        });
      });

      it('should reject invalid JSON strings', () => {
        const invalidJSON = [
          '{key: value}', // unquoted keys
          '[1, 2, 3,]', // trailing comma
          'undefined',
          '{broken json',
          'function() {}'
        ];

        invalidJSON.forEach(json => {
          expect(validateJSON(json)).toBe(false);
        });
      });
    });

    describe('validateSchema', () => {
      it('should validate object against schema', () => {
        const schema: ValidationRule[] = [
          {
            name: 'title',
            validator: (value) => typeof value === 'string' && value.length > 0,
            message: 'Title is required',
            required: true
          },
          {
            name: 'age',
            validator: (value) => typeof value === 'number' && value >= 0,
            message: 'Age must be a positive number'
          }
        ];

        const validObject = { title: 'Test Title', age: 25 };
        const result = validateSchema(validObject, schema);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect validation errors', () => {
        const schema: ValidationRule[] = [
          {
            name: 'title',
            validator: (value) => typeof value === 'string' && value.length > 0,
            message: 'Title is required',
            required: true
          }
        ];

        const invalidObject = { title: '' };
        const result = validateSchema(invalidObject, schema);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('title');
        expect(result.errors[0].message).toBe('Title is required');
      });

      it('should handle missing required fields', () => {
        const schema: ValidationRule[] = [
          {
            name: 'required_field',
            validator: (value) => value !== undefined,
            message: 'Field is required',
            required: true
          }
        ];

        const invalidObject = {};
        const result = validateSchema(invalidObject, schema);

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
      });
    });
  });

  describe('Formatting Tools', () => {
    describe('formatDate', () => {
      it('should format date with default options', () => {
        const date = new Date('2023-12-25T10:30:00Z');
        const formatted = formatDate(date);

        expect(formatted).toBeDefined();
        expect(typeof formatted).toBe('string');
      });

      it('should format date with custom options', () => {
        const date = new Date('2023-12-25T10:30:00Z');
        const options: FormatOptions = {
          locale: 'en-US',
          style: 'long'
        };

        const formatted = formatDate(date, options);

        expect(formatted).toBeDefined();
        expect(formatted.length).toBeGreaterThan(10);
      });

      it('should handle different locales', () => {
        const date = new Date('2023-12-25T10:30:00Z');

        const enFormat = formatDate(date, { locale: 'en-US' });
        const deFormat = formatDate(date, { locale: 'de-DE' });

        expect(enFormat).not.toBe(deFormat);
      });
    });

    describe('formatFileSize', () => {
      it('should format bytes correctly', () => {
        expect(formatFileSize(1024)).toBe('1.0 KB');
        expect(formatFileSize(1048576)).toBe('1.0 MB');
        expect(formatFileSize(1073741824)).toBe('1.0 GB');
        expect(formatFileSize(500)).toBe('500 B');
      });

      it('should handle zero and negative values', () => {
        expect(formatFileSize(0)).toBe('0 B');
        expect(formatFileSize(-100)).toBe('0 B');
      });

      it('should format with custom precision', () => {
        expect(formatFileSize(1536, 2)).toBe('1.50 KB');
        expect(formatFileSize(1536, 0)).toBe('2 KB');
      });
    });

    describe('formatDuration', () => {
      it('should format milliseconds to human readable', () => {
        expect(formatDuration(1000)).toBe('1.0s');
        expect(formatDuration(60000)).toBe('1m 0s');
        expect(formatDuration(3661000)).toBe('1h 1m 1s');
        expect(formatDuration(500)).toBe('500ms');
      });

      it('should handle zero duration', () => {
        expect(formatDuration(0)).toBe('0ms');
      });
    });

    describe('formatNumber', () => {
      it('should format numbers with separators', () => {
        expect(formatNumber(1234567)).toBe('1,234,567');
        expect(formatNumber(1234.567, 2)).toBe('1,234.57');
      });

      it('should handle different locales', () => {
        const number = 1234.567;

        const enFormat = formatNumber(number, 2, 'en-US');
        const deFormat = formatNumber(number, 2, 'de-DE');

        expect(enFormat).not.toBe(deFormat);
      });
    });
  });

  describe('Path Processing', () => {
    describe('sanitizePath', () => {
      it('should remove dangerous path components', () => {
        expect(sanitizePath('../../../etc/passwd')).not.toContain('..');
        expect(sanitizePath('path/with/../traversal')).not.toContain('..');
      });

      it('should preserve safe paths', () => {
        const safePath = 'docs/folder/file.txt';
        expect(sanitizePath(safePath)).toBe(safePath);
      });

      it('should handle null bytes and special characters', () => {
        const dangerousPath = 'file\0name.txt';
        const sanitized = sanitizePath(dangerousPath);

        expect(sanitized).not.toContain('\0');
      });
    });

    describe('normalizePath', () => {
      it('should normalize path separators', () => {
        expect(normalizePath('path\\to\\file')).toBe('path/to/file');
        expect(normalizePath('path//to///file')).toBe('path/to/file');
      });

      it('should handle relative paths', () => {
        expect(normalizePath('./path/to/file')).toBe('path/to/file');
        expect(normalizePath('path/./to/file')).toBe('path/to/file');
      });
    });

    describe('resolveRelativePath', () => {
      it('should resolve relative paths correctly', () => {
        const base = '/home/user/docs';
        const relative = '../images/photo.jpg';

        const resolved = resolveRelativePath(base, relative);

        expect(resolved).toBe('/home/user/images/photo.jpg');
      });

      it('should handle absolute paths', () => {
        const base = '/home/user/docs';
        const absolute = '/etc/config.json';

        const resolved = resolveRelativePath(base, absolute);

        expect(resolved).toBe('/etc/config.json');
      });
    });

    describe('isValidExtension', () => {
      it('should validate allowed extensions', () => {
        const allowedExtensions = ['.txt', '.md', '.json'];

        expect(isValidExtension('file.txt', allowedExtensions)).toBe(true);
        expect(isValidExtension('file.md', allowedExtensions)).toBe(true);
        expect(isValidExtension('file.exe', allowedExtensions)).toBe(false);
      });

      it('should handle case insensitive comparison', () => {
        const allowedExtensions = ['.txt'];

        expect(isValidExtension('file.TXT', allowedExtensions)).toBe(true);
        expect(isValidExtension('file.Txt', allowedExtensions)).toBe(true);
      });
    });
  });

  describe('Performance Monitoring', () => {
    describe('createPerformanceTimer', () => {
      it('should create timer with unique name', () => {
        const timer = createPerformanceTimer('test-operation');

        expect(timer).toBeDefined();
        expect(timer.name).toBe('test-operation');
        expect(timer.startTime).toBeGreaterThan(0);
        expect(timer.endTime).toBeUndefined();
      });

      it('should record start time', () => {
        const startTime = performance.now();
        const timer = createPerformanceTimer('test');

        expect(timer.startTime).toBeGreaterThanOrEqual(startTime);
      });
    });

    describe('logPerformance', () => {
      it('should log completed timer', () => {
        const timer = createPerformanceTimer('test-log');

        // 模拟一些工作
        const result = logPerformance(timer);

        expect(result.endTime).toBeDefined();
        expect(result.duration).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      });

      it('should calculate duration correctly', () => {
        const timer = createPerformanceTimer('duration-test');
        const logged = logPerformance(timer);

        expect(logged.duration).toBe(logged.endTime! - logged.startTime);
      });
    });

    describe('getPerformanceMetrics', () => {
      it('should return empty array initially', () => {
        const metrics = getPerformanceMetrics();

        expect(Array.isArray(metrics)).toBe(true);
        expect(metrics.length).toBe(0);
      });

      it('should return recorded metrics', () => {
        const timer = createPerformanceTimer('metrics-test');
        logPerformance(timer);

        const metrics = getPerformanceMetrics();

        expect(metrics.length).toBe(1);
        expect(metrics[0].name).toBe('metrics-test');
      });

      it('should filter metrics by name pattern', () => {
        createPerformanceTimer('test-1');
        createPerformanceTimer('test-2');
        createPerformanceTimer('other-1');

        const testMetrics = getPerformanceMetrics('test-*');
        const allMetrics = getPerformanceMetrics();

        expect(testMetrics.length).toBe(2);
        expect(allMetrics.length).toBe(3);
      });
    });

    describe('clearPerformanceMetrics', () => {
      it('should clear all metrics', () => {
        createPerformanceTimer('clear-test-1');
        createPerformanceTimer('clear-test-2');

        expect(getPerformanceMetrics().length).toBe(2);

        clearPerformanceMetrics();

        expect(getPerformanceMetrics().length).toBe(0);
      });
    });
  });

  describe('Logging', () => {
    describe('createLogger', () => {
      it('should create logger with specified name', () => {
        const logger = createLogger('test-logger');

        expect(logger).toBeDefined();
        expect(typeof logger.debug).toBe('function');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.error).toBe('function');
      });

      it('should log messages with correct format', () => {
        const logger = createLogger('format-test');
        const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        logger.info('Test message');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('formatLogEntry', () => {
      it('should format log entry correctly', () => {
        const entry: LogEntry = {
          level: 'info',
          message: 'Test message',
          timestamp: new Date('2023-12-25T10:30:00Z'),
          source: 'test-logger'
        };

        const formatted = formatLogEntry(entry);

        expect(formatted).toContain('info');
        expect(formatted).toContain('Test message');
        expect(formatted).toContain('test-logger');
      });

      it('should include stack trace for errors', () => {
        const entry: LogEntry = {
          level: 'error',
          message: 'Error message',
          timestamp: new Date(),
          stack: 'Error stack trace'
        };

        const formatted = formatLogEntry(entry);

        expect(formatted).toContain('Error stack trace');
      });
    });
  });

  describe('Configuration Management', () => {
    describe('parseConfig', () => {
      it('should parse JSON configuration', () => {
        const configJson = '{"key1": "value1", "key2": 123, "key3": true}';
        const config = parseConfig(configJson, 'json');

        expect(config.key1).toBe('value1');
        expect(config.key2).toBe(123);
        expect(config.key3).toBe(true);
      });

      it('should handle invalid JSON gracefully', () => {
        const invalidJson = '{invalid json}';

        expect(() => parseConfig(invalidJson, 'json')).toThrow();
      });

      it('should parse environment variables', () => {
        process.env.TEST_VAR = 'test-value';
        const config = parseConfig('TEST_VAR', 'env');

        expect(config).toBe('test-value');

        delete process.env.TEST_VAR;
      });
    });

    describe('getConfigValue', () => {
      it('should get configuration value by key', () => {
        const config = { app: { name: 'Test App', port: 3000 } };

        expect(getConfigValue(config, 'app.name')).toBe('Test App');
        expect(getConfigValue(config, 'app.port')).toBe(3000);
      });

      it('should return default value for missing keys', () => {
        const config = { existing: 'value' };

        expect(getConfigValue(config, 'missing.key', 'default')).toBe('default');
      });

      it('should handle nested object paths', () => {
        const config = {
          level1: {
            level2: {
              level3: 'deep-value'
            }
          }
        };

        expect(getConfigValue(config, 'level1.level2.level3')).toBe('deep-value');
      });
    });

    describe('setConfigValue', () => {
      it('should set configuration value by key', () => {
        const config = { existing: 'value' };

        setConfigValue(config, 'new.nested.key', 'new-value');

        expect(getConfigValue(config, 'new.nested.key')).toBe('new-value');
      });

      it('should update existing values', () => {
        const config = { existing: 'old-value' };

        setConfigValue(config, 'existing', 'new-value');

        expect(config.existing).toBe('new-value');
      });
    });

    describe('validateConfig', () => {
      it('should validate configuration against schema', () => {
        const config = { port: 3000, host: 'localhost' };
        const schema: ValidationRule[] = [
          {
            name: 'port',
            validator: (value) => typeof value === 'number' && value > 0,
            message: 'Port must be a positive number',
            required: true
          }
        ];

        const result = validateConfig(config, schema);

        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('Environment Detection', () => {
    describe('detectEnvironment', () => {
      it('should detect environment correctly', () => {
        const env = detectEnvironment();

        expect(env).toBeDefined();
        expect(typeof env.NODE_ENV).toBe('string');
        expect(typeof env.isDevelopment).toBe('boolean');
        expect(typeof env.isProduction).toBe('boolean');
        expect(typeof env.isTest).toBe('boolean');
      });

      it('should have consistent environment flags', () => {
        const env = detectEnvironment();

        // Only one environment should be true
        const trueCount = [env.isDevelopment, env.isProduction, env.isTest]
          .filter(flag => flag).length;

        expect(trueCount).toBeLessThanOrEqual(1);
      });
    });

    describe('isProduction/isDevelopment/isTest', () => {
      it('should detect production environment', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        expect(isProduction()).toBe(true);
        expect(isDevelopment()).toBe(false);
        expect(isTest()).toBe(false);

        process.env.NODE_ENV = originalEnv;
      });

      it('should detect development environment', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';

        expect(isDevelopment()).toBe(true);
        expect(isProduction()).toBe(false);
        expect(isTest()).toBe(false);

        process.env.NODE_ENV = originalEnv;
      });

      it('should detect test environment', () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'test';

        expect(isTest()).toBe(true);
        expect(isProduction()).toBe(false);
        expect(isDevelopment()).toBe(false);

        process.env.NODE_ENV = originalEnv;
      });
    });

    describe('getSystemInfo', () => {
      it('should return system information', () => {
        const info = getSystemInfo();

        expect(info).toBeDefined();
        expect(typeof info.platform).toBe('string');
        expect(typeof info.nodeVersion).toBe('string');
        expect(typeof info.cpuCount).toBe('number');
        expect(typeof info.totalMemory).toBe('number');
        expect(typeof info.freeMemory).toBe('number');
      });
    });
  });

  describe('Utility Functions', () => {
    describe('createRetryHandler', () => {
      it('should retry failed operations', async () => {
        let attempts = 0;
        const operation = () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return 'success';
        };

        const retryHandler = createRetryHandler(3, 10);
        const result = await retryHandler(operation);

        expect(result).toBe('success');
        expect(attempts).toBe(3);
      });

      it('should give up after max retries', async () => {
        const operation = () => {
          throw new Error('Permanent failure');
        };

        const retryHandler = createRetryHandler(2, 10);

        await expect(retryHandler(operation)).rejects.toThrow('Permanent failure');
      });
    });

    describe('debounce', () => {
      it('should debounce function calls', async () => {
        let callCount = 0;
        const fn = () => { callCount++; };
        const debouncedFn = debounce(fn, 50);

        // Call multiple times quickly
        debouncedFn();
        debouncedFn();
        debouncedFn();

        expect(callCount).toBe(0);

        // Wait for debounce delay
        await new Promise(resolve => setTimeout(resolve, 60));

        expect(callCount).toBe(1);
      });
    });

    describe('throttle', () => {
      it('should throttle function calls', async () => {
        let callCount = 0;
        const fn = () => { callCount++; };
        const throttledFn = throttle(fn, 50);

        // Call immediately (should execute)
        throttledFn();
        expect(callCount).toBe(1);

        // Call again immediately (should be throttled)
        throttledFn();
        expect(callCount).toBe(1);

        // Wait for throttle period
        await new Promise(resolve => setTimeout(resolve, 60));

        // Call again (should execute)
        throttledFn();
        expect(callCount).toBe(2);
      });
    });

    describe('deepClone', () => {
      it('should create deep copy of object', () => {
        const original = {
          primitive: 'string',
          nested: { value: 42 },
          array: [1, { inner: 'test' }]
        };

        const cloned = deepClone(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.nested).not.toBe(original.nested);
        expect(cloned.array).not.toBe(original.array);
      });

      it('should handle circular references', () => {
        const obj: any = { name: 'test' };
        obj.self = obj;

        const cloned = deepClone(obj);

        expect(cloned.name).toBe('test');
        expect(cloned.self).toBe(cloned);
      });
    });

    describe('deepMerge', () => {
      it('should merge objects deeply', () => {
        const obj1 = { a: 1, b: { c: 2, d: 3 } };
        const obj2 = { b: { d: 4, e: 5 }, f: 6 };

        const merged = deepMerge(obj1, obj2);

        expect(merged).toEqual({
          a: 1,
          b: { c: 2, d: 4, e: 5 },
          f: 6
        });
      });

      it('should not mutate original objects', () => {
        const obj1 = { a: { b: 1 } };
        const obj2 = { a: { c: 2 } };

        const merged = deepMerge(obj1, obj2);

        expect(obj1.a).not.toHaveProperty('c');
        expect(merged.a).toHaveProperty('c');
      });
    });

    describe('arrayToMap', () => {
      it('should convert array to map by key', () => {
        const array = [
          { id: '1', name: 'Alice' },
          { id: '2', name: 'Bob' }
        ];

        const map = arrayToMap(array, 'id');

        expect(map.get('1')).toEqual({ id: '1', name: 'Alice' });
        expect(map.get('2')).toEqual({ id: '2', name: 'Bob' });
      });

      it('should handle duplicate keys', () => {
        const array = [
          { id: '1', name: 'Alice' },
          { id: '1', name: 'Alice Updated' }
        ];

        const map = arrayToMap(array, 'id');

        expect(map.get('1')?.name).toBe('Alice Updated');
      });
    });

    describe('groupBy', () => {
      it('should group array by key', () => {
        const array = [
          { category: 'A', value: 1 },
          { category: 'B', value: 2 },
          { category: 'A', value: 3 }
        ];

        const grouped = groupBy(array, 'category');

        expect(grouped.A).toHaveLength(2);
        expect(grouped.B).toHaveLength(1);
        expect(grouped.A[0].value).toBe(1);
        expect(grouped.A[1].value).toBe(3);
      });
    });

    describe('chunk', () => {
      it('should split array into chunks', () => {
        const array = [1, 2, 3, 4, 5, 6, 7];
        const chunks = chunk(array, 3);

        expect(chunks).toHaveLength(3);
        expect(chunks[0]).toEqual([1, 2, 3]);
        expect(chunks[1]).toEqual([4, 5, 6]);
        expect(chunks[2]).toEqual([7]);
      });

      it('should handle empty array', () => {
        const chunks = chunk([], 3);

        expect(chunks).toHaveLength(0);
      });
    });
  });

  describe('Cryptographic Functions', () => {
    describe('calculateHash', () => {
      it('should calculate consistent hash', () => {
        const data = 'test data';
        const hash1 = calculateHash(data);
        const hash2 = calculateHash(data);

        expect(hash1).toBe(hash2);
        expect(typeof hash1).toBe('string');
        expect(hash1.length).toBeGreaterThan(0);
      });

      it('should produce different hashes for different data', () => {
        const hash1 = calculateHash('data1');
        const hash2 = calculateHash('data2');

        expect(hash1).not.toBe(hash2);
      });

      it('should support different algorithms', () => {
        const data = 'test';
        const sha256Hash = calculateHash(data, 'sha256');
        const md5Hash = calculateHash(data, 'md5');

        expect(sha256Hash).not.toBe(md5Hash);
        expect(sha256Hash.length).not.toBe(md5Hash.length);
      });
    });

    describe('compareHashes', () => {
      it('should compare hashes securely', () => {
        const hash1 = calculateHash('test');
        const hash2 = calculateHash('test');
        const hash3 = calculateHash('different');

        expect(compareHashes(hash1, hash2)).toBe(true);
        expect(compareHashes(hash1, hash3)).toBe(false);
      });

      it('should handle timing attacks', () => {
        const hash1 = 'a'.repeat(64);
        const hash2 = 'b'.repeat(64);

        // 应该使用常时间比较算法
        expect(compareHashes(hash1, hash2)).toBe(false);
      });
    });

    describe('encodeBase64/decodeBase64', () => {
      it('should encode and decode base64', () => {
        const original = 'Hello, World! 测试';
        const encoded = encodeBase64(original);
        const decoded = decodeBase64(encoded);

        expect(decoded).toBe(original);
        expect(encoded).not.toBe(original);
      });

      it('should handle empty strings', () => {
        expect(encodeBase64('')).toBe('');
        expect(decodeBase64('')).toBe('');
      });

      it('should handle Unicode correctly', () => {
        const unicode = '🎉 测试 Unicode';
        const encoded = encodeBase64(unicode);
        const decoded = decodeBase64(encoded);

        expect(decoded).toBe(unicode);
      });
    });
  });
});