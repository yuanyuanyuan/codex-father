/**
 * Utils - 通用工具函数集合
 *
 * 核心功能：
 * - 验证和格式化工具
 * - ID生成和路径处理
 * - 错误处理和日志工具
 * - 性能监控和配置管理
 */

import * as path from 'path';
import * as crypto from 'crypto';
import { performance } from 'perf_hooks';

// ===== 类型定义 =====

export interface ValidationRule {
  name: string;
  validator: (value: any) => boolean;
  message: string;
  required?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  rule?: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface FormatOptions {
  locale?: string;
  timezone?: string;
  precision?: number;
  style?: 'short' | 'medium' | 'long' | 'full';
}

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: Date;
  source?: string;
  metadata?: Record<string, any>;
  stack?: string;
}

export interface ConfigValue {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  required?: boolean;
  defaultValue?: any;
}

export interface Environment {
  NODE_ENV: string;
  isDevelopment: boolean;
  isProduction: boolean;
  isTest: boolean;
  version?: string;
  buildDate?: Date;
}

// ===== ID生成工具 =====

/**
 * 生成UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * 生成短ID (8位)
 */
export function generateShortId(): string {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * 生成带前缀的ID
 */
export function generatePrefixedId(prefix: string, length: number = 8): string {
  const suffix = crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .substring(0, length);
  return `${prefix}_${suffix}`;
}

/**
 * 生成时间戳ID
 */
export function generateTimestampId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * 生成雪花ID (简化版)
 */
export function generateSnowflakeId(): string {
  const timestamp = Date.now() - 1640995200000; // 2022-01-01的时间戳
  const workerId = 1; // 简化为固定值
  const sequence = Math.floor(Math.random() * 4096); // 0-4095

  const id = (BigInt(timestamp) << 22n) | (BigInt(workerId) << 12n) | BigInt(sequence);
  return id.toString();
}

// ===== 验证工具 =====

/**
 * 预定义验证规则
 */
export const ValidationRules = {
  required: (message: string = 'Field is required'): ValidationRule => ({
    name: 'required',
    validator: (value: any) => value !== null && value !== undefined && value !== '',
    message,
    required: true,
  }),

  email: (message: string = 'Invalid email format'): ValidationRule => ({
    name: 'email',
    validator: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule => ({
    name: 'minLength',
    validator: (value: string) => value && value.length >= min,
    message: message || `Minimum length is ${min}`,
  }),

  maxLength: (max: number, message?: string): ValidationRule => ({
    name: 'maxLength',
    validator: (value: string) => !value || value.length <= max,
    message: message || `Maximum length is ${max}`,
  }),

  pattern: (regex: RegExp, message: string = 'Invalid format'): ValidationRule => ({
    name: 'pattern',
    validator: (value: string) => !value || regex.test(value),
    message,
  }),

  numeric: (message: string = 'Must be a number'): ValidationRule => ({
    name: 'numeric',
    validator: (value: any) => !isNaN(Number(value)),
    message,
  }),

  range: (min: number, max: number, message?: string): ValidationRule => ({
    name: 'range',
    validator: (value: number) => value >= min && value <= max,
    message: message || `Value must be between ${min} and ${max}`,
  }),

  url: (message: string = 'Invalid URL format'): ValidationRule => ({
    name: 'url',
    validator: (value: string) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message,
  }),

  semver: (message: string = 'Invalid semantic version'): ValidationRule => ({
    name: 'semver',
    validator: (value: string) =>
      /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(value),
    message,
  }),
};

/**
 * 验证对象
 */
export function validate(
  data: Record<string, any>,
  rules: Record<string, ValidationRule[]>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field];

    for (const rule of fieldRules) {
      if (rule.required && (value === null || value === undefined || value === '')) {
        errors.push({
          field,
          message: rule.message,
          value,
          rule: rule.name,
        });
        continue;
      }

      if (value !== null && value !== undefined && value !== '' && !rule.validator(value)) {
        errors.push({
          field,
          message: rule.message,
          value,
          rule: rule.name,
        });
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 验证单个值
 */
export function validateValue(value: any, rules: ValidationRule[]): ValidationResult {
  return validate({ value }, { value: rules });
}

/**
 * 深度验证嵌套对象
 */
export function validateNested(
  data: Record<string, any>,
  schema: Record<string, any>
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  function validateRecursive(obj: any, schemaObj: any, path: string = ''): void {
    for (const [key, rules] of Object.entries(schemaObj)) {
      const currentPath = path ? `${path}.${key}` : key;
      const value = obj?.[key];

      if (Array.isArray(rules)) {
        // 验证规则数组
        const result = validateValue(value, rules);
        errors.push(...result.errors.map((err) => ({ ...err, field: currentPath })));
        warnings.push(...result.warnings.map((warn) => ({ ...warn, field: currentPath })));
      } else if (typeof rules === 'object' && rules !== null) {
        // 嵌套对象
        if (value && typeof value === 'object') {
          validateRecursive(value, rules, currentPath);
        }
      }
    }
  }

  validateRecursive(data, schema);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ===== 格式化工具 =====

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number, options: FormatOptions = {}): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const precision = options.precision ?? 2;

  if (bytes === 0) {
    return '0 B';
  }

  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, index);

  return `${size.toFixed(precision)} ${units[index]}`;
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: Date | string | number, options: FormatOptions = {}): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const locale = options.locale || 'zh-CN';
  const style = options.style || 'medium';

  const formatOptions: Intl.DateTimeFormatOptions = {
    timeZone: options.timezone,
  };

  switch (style) {
    case 'short':
      formatOptions.dateStyle = 'short';
      formatOptions.timeStyle = 'short';
      break;
    case 'medium':
      formatOptions.dateStyle = 'medium';
      formatOptions.timeStyle = 'medium';
      break;
    case 'long':
      formatOptions.dateStyle = 'long';
      formatOptions.timeStyle = 'long';
      break;
    case 'full':
      formatOptions.dateStyle = 'full';
      formatOptions.timeStyle = 'full';
      break;
  }

  return new Intl.DateTimeFormat(locale, formatOptions).format(dateObj);
}

/**
 * 格式化相对时间
 */
export function formatRelativeTime(
  date: Date | string | number,
  options: FormatOptions = {}
): string {
  const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const locale = options.locale || 'zh-CN';

  // 使用Intl.RelativeTimeFormat
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (diffDays > 0) {
    return rtf.format(-diffDays, 'day');
  } else if (diffHours > 0) {
    return rtf.format(-diffHours, 'hour');
  } else if (diffMinutes > 0) {
    return rtf.format(-diffMinutes, 'minute');
  } else {
    return rtf.format(-diffSeconds, 'second');
  }
}

/**
 * 格式化数字
 */
export function formatNumber(
  value: number,
  options: FormatOptions & { currency?: string; percent?: boolean } = {}
): string {
  const locale = options.locale || 'zh-CN';
  const precision = options.precision;

  const formatOptions: Intl.NumberFormatOptions = {};

  if (options.currency) {
    formatOptions.style = 'currency';
    formatOptions.currency = options.currency;
  } else if (options.percent) {
    formatOptions.style = 'percent';
  }

  if (precision !== undefined) {
    formatOptions.minimumFractionDigits = precision;
    formatOptions.maximumFractionDigits = precision;
  }

  return new Intl.NumberFormat(locale, formatOptions).format(value);
}

/**
 * 格式化JSON
 */
export function formatJSON(obj: any, indent: number = 2): string {
  return JSON.stringify(obj, null, indent);
}

/**
 * 格式化代码
 */
export function formatCode(code: string, language: string = 'javascript'): string {
  // 简化的代码格式化，实际项目可以集成prettier等工具
  return code
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

// ===== 路径处理工具 =====

/**
 * 标准化路径
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * 解析路径信息
 */
export function parsePathInfo(filePath: string): {
  dir: string;
  name: string;
  ext: string;
  base: string;
  root?: string;
} {
  const parsed = path.parse(filePath);
  return {
    dir: parsed.dir,
    name: parsed.name,
    ext: parsed.ext,
    base: parsed.base,
    root: parsed.root || undefined,
  };
}

/**
 * 检查路径是否安全（防止路径遍历攻击）
 */
export function isPathSafe(filePath: string, basePath: string): boolean {
  const resolvedPath = path.resolve(basePath, filePath);
  const resolvedBase = path.resolve(basePath);

  return resolvedPath.startsWith(resolvedBase);
}

/**
 * 生成相对路径
 */
export function getRelativePath(from: string, to: string): string {
  return path.relative(from, to);
}

/**
 * 构建路径
 */
export function buildPath(...segments: string[]): string {
  return normalizePath(path.join(...segments));
}

/**
 * 获取文件扩展名（不含点）
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase();
}

/**
 * 改变文件扩展名
 */
export function changeFileExtension(filePath: string, newExt: string): string {
  const parsed = path.parse(filePath);
  return path.format({
    ...parsed,
    base: undefined,
    ext: newExt.startsWith('.') ? newExt : `.${newExt}`,
  });
}

// ===== 数据处理工具 =====

/**
 * 深拷贝对象
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  if (typeof obj === 'object') {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * 深度合并对象
 */
export function deepMerge<T = any>(...objects: Partial<T>[]): T {
  const result = {} as T;

  for (const obj of objects) {
    if (!obj) {
      continue;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        if (value && typeof value === 'object' && !Array.isArray(value)) {
          result[key] = deepMerge(result[key] || {}, value);
        } else {
          result[key] = value as T[Extract<keyof T, string>];
        }
      }
    }
  }

  return result;
}

/**
 * 获取嵌套属性值
 */
export function getNestedValue(obj: any, path: string, defaultValue?: any): any {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }

  return current;
}

/**
 * 设置嵌套属性值
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  let current = obj;

  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[lastKey] = value;
}

/**
 * 过滤对象属性
 */
export function filterObject<T>(
  obj: T,
  predicate: (key: string, value: any) => boolean
): Partial<T> {
  const result = {} as Partial<T>;

  for (const key in obj) {
    if (obj.hasOwnProperty(key) && predicate(key, obj[key])) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * 映射对象属性
 */
export function mapObject<T, U>(
  obj: Record<string, T>,
  mapper: (key: string, value: T) => U
): Record<string, U> {
  const result: Record<string, U> = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key] = mapper(key, obj[key]);
    }
  }

  return result;
}

/**
 * 数组去重
 */
export function uniqueArray<T>(array: T[], keySelector?: (item: T) => any): T[] {
  if (!keySelector) {
    return [...new Set(array)];
  }

  const seen = new Set();
  return array.filter((item) => {
    const key = keySelector(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * 数组分组
 */
export function groupBy<T>(
  array: T[],
  keySelector: (item: T) => string | number
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};

  for (const item of array) {
    const key = String(keySelector(item));
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }

  return groups;
}

/**
 * 数组分块
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ===== 性能监控工具 =====

const performanceMetrics = new Map<string, PerformanceMetric>();

/**
 * 开始性能监控
 */
export function startPerformanceTimer(name: string, metadata?: Record<string, any>): void {
  performanceMetrics.set(name, {
    name,
    startTime: performance.now(),
    metadata,
  });
}

/**
 * 结束性能监控
 */
export function endPerformanceTimer(name: string): PerformanceMetric | null {
  const metric = performanceMetrics.get(name);
  if (!metric) {
    return null;
  }

  metric.endTime = performance.now();
  metric.duration = metric.endTime - metric.startTime;

  performanceMetrics.delete(name);
  return metric;
}

/**
 * 测量函数执行时间
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T> | T,
  metadata?: Record<string, any>
): Promise<{ result: T; metric: PerformanceMetric }> {
  startPerformanceTimer(name, metadata);
  const result = await fn();
  const metric = endPerformanceTimer(name)!;

  return { result, metric };
}

/**
 * 性能监控装饰器
 */
export function performanceMonitor(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const methodName = name || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      startPerformanceTimer(methodName);
      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } finally {
        endPerformanceTimer(methodName);
      }
    };

    return descriptor;
  };
}

/**
 * 获取所有性能指标
 */
export function getAllPerformanceMetrics(): PerformanceMetric[] {
  return Array.from(performanceMetrics.values());
}

// ===== 错误处理工具 =====

/**
 * 自定义错误类
 */
export class CustomError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly metadata?: Record<string, any>;

  constructor(
    message: string,
    code: string = 'UNKNOWN_ERROR',
    statusCode: number = 500,
    metadata?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.metadata = metadata;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 验证错误
 */
export class ValidationError extends CustomError {
  constructor(message: string, field?: string, value?: any) {
    super(message, 'VALIDATION_ERROR', 400, { field, value });
  }
}

/**
 * 文件操作错误
 */
export class FileOperationError extends CustomError {
  constructor(message: string, operation: string, path?: string) {
    super(message, 'FILE_OPERATION_ERROR', 500, { operation, path });
  }
}

/**
 * 权限错误
 */
export class PermissionError extends CustomError {
  constructor(message: string, resource?: string, action?: string) {
    super(message, 'PERMISSION_ERROR', 403, { resource, action });
  }
}

/**
 * 安全包装函数执行
 */
export async function safeExecute<T>(
  fn: () => Promise<T> | T,
  fallback?: T,
  onError?: (error: Error) => void
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
    return fallback;
  }
}

/**
 * 重试执行
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 'linear' } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        throw lastError;
      }

      if (options.onRetry) {
        options.onRetry(attempt, lastError);
      }

      const delayTime = backoff === 'exponential' ? delay * Math.pow(2, attempt - 1) : delay;
      await sleep(delayTime);
    }
  }

  throw lastError!;
}

// ===== 日志工具 =====

const logEntries: LogEntry[] = [];
const maxLogEntries = 1000;

/**
 * 创建日志条目
 */
export function createLogEntry(
  level: LogEntry['level'],
  message: string,
  source?: string,
  metadata?: Record<string, any>
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date(),
    source,
    metadata,
  };

  if (level === 'error') {
    entry.stack = new Error().stack;
  }

  return entry;
}

/**
 * 记录日志
 */
export function log(
  level: LogEntry['level'],
  message: string,
  source?: string,
  metadata?: Record<string, any>
): void {
  const entry = createLogEntry(level, message, source, metadata);

  // 添加到内存日志
  logEntries.push(entry);
  if (logEntries.length > maxLogEntries) {
    logEntries.shift();
  }

  // 输出到控制台
  const prefix = `[${formatDateTime(entry.timestamp, { style: 'medium' })}] [${level.toUpperCase()}]`;
  const fullMessage = source ? `${prefix} ${source}: ${message}` : `${prefix} ${message}`;

  switch (level) {
    case 'debug':
      console.debug(fullMessage, metadata);
      break;
    case 'info':
      console.info(fullMessage, metadata);
      break;
    case 'warn':
      console.warn(fullMessage, metadata);
      break;
    case 'error':
      console.error(fullMessage, metadata);
      break;
  }
}

/**
 * 便捷日志方法
 */
export const logger = {
  debug: (message: string, source?: string, metadata?: Record<string, any>) =>
    log('debug', message, source, metadata),
  info: (message: string, source?: string, metadata?: Record<string, any>) =>
    log('info', message, source, metadata),
  warn: (message: string, source?: string, metadata?: Record<string, any>) =>
    log('warn', message, source, metadata),
  error: (message: string, source?: string, metadata?: Record<string, any>) =>
    log('error', message, source, metadata),
};

/**
 * 获取日志条目
 */
export function getLogEntries(filter?: {
  level?: LogEntry['level'][];
  source?: string;
  since?: Date;
  limit?: number;
}): LogEntry[] {
  let entries = [...logEntries];

  if (filter) {
    if (filter.level) {
      entries = entries.filter((entry) => filter.level!.includes(entry.level));
    }

    if (filter.source) {
      entries = entries.filter((entry) => entry.source === filter.source);
    }

    if (filter.since) {
      entries = entries.filter((entry) => entry.timestamp >= filter.since!);
    }

    if (filter.limit) {
      entries = entries.slice(-filter.limit);
    }
  }

  return entries;
}

// ===== 配置管理工具 =====

const configStore = new Map<string, ConfigValue>();

/**
 * 设置配置值
 */
export function setConfig(
  key: string,
  value: any,
  options?: {
    description?: string;
    required?: boolean;
  }
): void {
  configStore.set(key, {
    key,
    value,
    type: Array.isArray(value) ? 'array' : typeof value,
    description: options?.description,
    required: options?.required,
    defaultValue: value,
  });
}

/**
 * 获取配置值
 */
export function getConfig<T = any>(key: string, defaultValue?: T): T {
  const config = configStore.get(key);
  return config ? config.value : defaultValue;
}

/**
 * 检查配置是否存在
 */
export function hasConfig(key: string): boolean {
  return configStore.has(key);
}

/**
 * 删除配置
 */
export function deleteConfig(key: string): boolean {
  return configStore.delete(key);
}

/**
 * 获取所有配置
 */
export function getAllConfig(): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, config] of configStore) {
    result[key] = config.value;
  }
  return result;
}

/**
 * 验证配置
 */
export function validateConfig(): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  for (const [key, config] of configStore) {
    if (config.required && (config.value === null || config.value === undefined)) {
      errors.push({
        field: key,
        message: `Required configuration "${key}" is missing`,
        value: config.value,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ===== 环境检测工具 =====

/**
 * 获取环境信息
 */
export function getEnvironment(): Environment {
  const nodeEnv = process.env.NODE_ENV || 'development';

  return {
    NODE_ENV: nodeEnv,
    isDevelopment: nodeEnv === 'development',
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
    version: process.env.APP_VERSION,
    buildDate: process.env.BUILD_DATE ? new Date(process.env.BUILD_DATE) : undefined,
  };
}

/**
 * 检查是否为开发环境
 */
export function isDevelopment(): boolean {
  return getEnvironment().isDevelopment;
}

/**
 * 检查是否为生产环境
 */
export function isProduction(): boolean {
  return getEnvironment().isProduction;
}

/**
 * 检查是否为测试环境
 */
export function isTest(): boolean {
  return getEnvironment().isTest;
}

// ===== 其他工具函数 =====

/**
 * 睡眠函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function (...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 缓存函数结果
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);

    if (cache.has(key)) {
      return cache.get(key)!;
    }

    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * 限制数值范围
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 生成随机字符串
 */
export function randomString(
  length: number,
  charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * 计算哈希值
 */
export function calculateHash(data: string | Buffer, algorithm: string = 'sha256'): string {
  return crypto.createHash(algorithm).update(data).digest('hex');
}

/**
 * 比较版本号
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) {
      return 1;
    }
    if (part1 < part2) {
      return -1;
    }
  }

  return 0;
}

export default {
  // ID生成
  generateUUID,
  generateShortId,
  generatePrefixedId,
  generateTimestampId,
  generateSnowflakeId,

  // 验证
  ValidationRules,
  validate,
  validateValue,
  validateNested,

  // 格式化
  formatFileSize,
  formatDateTime,
  formatRelativeTime,
  formatNumber,
  formatJSON,
  formatCode,

  // 路径处理
  normalizePath,
  parsePathInfo,
  isPathSafe,
  getRelativePath,
  buildPath,
  getFileExtension,
  changeFileExtension,

  // 数据处理
  deepClone,
  deepMerge,
  getNestedValue,
  setNestedValue,
  filterObject,
  mapObject,
  uniqueArray,
  groupBy,
  chunkArray,

  // 性能监控
  startPerformanceTimer,
  endPerformanceTimer,
  measurePerformance,
  performanceMonitor,
  getAllPerformanceMetrics,

  // 错误处理
  CustomError,
  ValidationError,
  FileOperationError,
  PermissionError,
  safeExecute,
  retry,

  // 日志
  createLogEntry,
  log,
  logger,
  getLogEntries,

  // 配置管理
  setConfig,
  getConfig,
  hasConfig,
  deleteConfig,
  getAllConfig,
  validateConfig,

  // 环境检测
  getEnvironment,
  isDevelopment,
  isProduction,
  isTest,

  // 其他工具
  sleep,
  debounce,
  throttle,
  memoize,
  clamp,
  randomString,
  calculateHash,
  compareVersions,
};
