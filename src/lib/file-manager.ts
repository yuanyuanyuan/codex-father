/**
 * FileManager - 文件系统操作和管理
 *
 * 核心功能：
 * - 原子写入和文件锁定
 * - 目录结构管理
 * - 文件监控和变更检测
 * - 备份和清理机制
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { EventEmitter } from 'events';

export interface FileManagerOptions {
  baseDir: string;
  backupDir?: string;
  tempDir?: string;
  lockTimeout?: number;
  enableBackup?: boolean;
  enableWatch?: boolean;
  maxFileSize?: number;
  allowedExtensions?: string[];
}

export interface FileMetadata {
  path: string;
  size: number;
  created: Date;
  modified: Date;
  checksum: string;
  locked: boolean;
  version?: string;
}

export interface DirectoryLayout {
  drafts: string;
  templates: string;
  versions: string;
  backups: string;
  cache: string;
  logs: string;
  temp: string;
}

export interface FileOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'move' | 'copy';
  source?: string;
  target: string;
  timestamp: Date;
  checksum?: string;
  metadata?: any;
}

export interface FileLock {
  path: string;
  lockId: string;
  timestamp: Date;
  expiresAt: Date;
  process?: string;
}

export interface BackupInfo {
  originalPath: string;
  backupPath: string;
  timestamp: Date;
  checksum: string;
  size: number;
  reason: string;
}

export interface WatchEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  timestamp: Date;
  metadata?: FileMetadata;
}

/**
 * FileManager 类
 *
 * 提供全面的文件系统操作能力，支持原子操作、锁定、监控和备份
 */
export class FileManager extends EventEmitter {
  private options: Required<FileManagerOptions>;
  private layout: DirectoryLayout;
  private locks: Map<string, FileLock> = new Map();
  private watchers: Map<string, any> = new Map();
  private operations: Map<string, FileOperation> = new Map();

  constructor(options: FileManagerOptions) {
    super();

    this.options = {
      baseDir: options.baseDir,
      backupDir: options.backupDir || path.join(options.baseDir, '.backups'),
      tempDir: options.tempDir || path.join(options.baseDir, '.tmp'),
      lockTimeout: options.lockTimeout || 30000, // 30秒
      enableBackup: options.enableBackup !== false,
      enableWatch: options.enableWatch !== false,
      maxFileSize: options.maxFileSize || 100 * 1024 * 1024, // 100MB
      allowedExtensions: options.allowedExtensions || ['.md', '.json', '.yaml', '.yml', '.txt'],
    };

    this.layout = {
      drafts: path.join(this.options.baseDir, 'drafts'),
      templates: path.join(this.options.baseDir, 'templates'),
      versions: path.join(this.options.baseDir, 'versions'),
      backups: this.options.backupDir,
      cache: path.join(this.options.baseDir, '.cache'),
      logs: path.join(this.options.baseDir, '.logs'),
      temp: this.options.tempDir,
    };

    this.setupCleanupHandlers();
  }

  /**
   * 初始化文件管理器
   */
  async initialize(): Promise<void> {
    await this.createDirectoryStructure();
    await this.cleanupExpiredLocks();
    await this.cleanupTempFiles();

    if (this.options.enableWatch) {
      await this.setupFileWatching();
    }

    this.emit('initialized');
  }

  /**
   * 原子写入文件
   */
  async writeFileAtomic(
    filePath: string,
    content: string | Buffer,
    options?: {
      encoding?: BufferEncoding;
      backup?: boolean;
      lock?: boolean;
      metadata?: any;
    }
  ): Promise<FileOperation> {
    const absolutePath = this.resolvePath(filePath);
    const tempPath = this.getTempPath(absolutePath);
    const operationId = this.generateOperationId();

    let lockId: string | undefined;

    try {
      // 验证文件路径和大小
      this.validateFilePath(absolutePath);
      this.validateFileSize(content);

      // 获取锁
      if (options?.lock !== false) {
        lockId = await this.acquireLock(absolutePath);
      }

      // 创建备份
      if (options?.backup && (await this.exists(absolutePath))) {
        await this.createBackup(absolutePath, 'atomic_write');
      }

      // 确保目录存在
      await this.ensureDir(path.dirname(absolutePath));

      // 写入临时文件
      await fs.writeFile(tempPath, content, {
        encoding: options?.encoding || 'utf8',
      });

      // 验证写入内容
      const writtenContent = await fs.readFile(tempPath);
      const checksum = this.calculateChecksum(writtenContent);

      // 原子移动
      await fs.rename(tempPath, absolutePath);

      // 记录操作
      const operation: FileOperation = {
        id: operationId,
        type: (await this.exists(absolutePath)) ? 'update' : 'create',
        target: absolutePath,
        timestamp: new Date(),
        checksum,
        metadata: options?.metadata,
      };

      this.operations.set(operationId, operation);
      this.emit('fileWritten', { operation, path: absolutePath });

      return operation;
    } catch (error) {
      // 清理临时文件
      try {
        await fs.unlink(tempPath);
      } catch {}

      throw new Error(`Atomic write failed: ${error}`);
    } finally {
      // 释放锁
      if (lockId) {
        await this.releaseLock(absolutePath, lockId);
      }
    }
  }

  /**
   * 读取文件
   */
  async readFile(
    filePath: string,
    options?: {
      encoding?: BufferEncoding;
      verifyChecksum?: boolean;
      cached?: boolean;
    }
  ): Promise<string | Buffer> {
    const absolutePath = this.resolvePath(filePath);

    this.validateFilePath(absolutePath);

    if (!(await this.exists(absolutePath))) {
      throw new Error(`File not found: ${filePath}`);
    }

    try {
      const content = await fs.readFile(absolutePath, {
        encoding: options?.encoding || 'utf8',
      });

      // 验证校验和
      if (options?.verifyChecksum) {
        const metadata = await this.getFileMetadata(absolutePath);
        const currentChecksum = this.calculateChecksum(
          typeof content === 'string' ? Buffer.from(content) : content
        );

        if (metadata.checksum !== currentChecksum) {
          throw new Error(`Checksum mismatch for file: ${filePath}`);
        }
      }

      this.emit('fileRead', { path: absolutePath });
      return content;
    } catch (error) {
      throw new Error(`Read failed: ${error}`);
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(
    filePath: string,
    options?: {
      backup?: boolean;
      force?: boolean;
    }
  ): Promise<FileOperation> {
    const absolutePath = this.resolvePath(filePath);
    const operationId = this.generateOperationId();

    this.validateFilePath(absolutePath);

    if (!(await this.exists(absolutePath))) {
      throw new Error(`File not found: ${filePath}`);
    }

    let lockId: string | undefined;

    try {
      // 获取锁
      lockId = await this.acquireLock(absolutePath);

      // 创建备份
      if (options?.backup !== false && this.options.enableBackup) {
        await this.createBackup(absolutePath, 'before_delete');
      }

      // 获取文件元数据
      const metadata = await this.getFileMetadata(absolutePath);

      // 删除文件
      await fs.unlink(absolutePath);

      // 记录操作
      const operation: FileOperation = {
        id: operationId,
        type: 'delete',
        target: absolutePath,
        timestamp: new Date(),
        checksum: metadata.checksum,
      };

      this.operations.set(operationId, operation);
      this.emit('fileDeleted', { operation, path: absolutePath });

      return operation;
    } catch (error) {
      throw new Error(`Delete failed: ${error}`);
    } finally {
      if (lockId) {
        await this.releaseLock(absolutePath, lockId);
      }
    }
  }

  /**
   * 移动或重命名文件
   */
  async moveFile(
    sourcePath: string,
    targetPath: string,
    options?: {
      backup?: boolean;
      overwrite?: boolean;
    }
  ): Promise<FileOperation> {
    const absoluteSource = this.resolvePath(sourcePath);
    const absoluteTarget = this.resolvePath(targetPath);
    const operationId = this.generateOperationId();

    this.validateFilePath(absoluteSource);
    this.validateFilePath(absoluteTarget);

    if (!(await this.exists(absoluteSource))) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    if (!options?.overwrite && (await this.exists(absoluteTarget))) {
      throw new Error(`Target file already exists: ${targetPath}`);
    }

    let sourceLockId: string | undefined;
    let targetLockId: string | undefined;

    try {
      // 获取锁
      sourceLockId = await this.acquireLock(absoluteSource);
      if (await this.exists(absoluteTarget)) {
        targetLockId = await this.acquireLock(absoluteTarget);
      }

      // 创建备份
      if (options?.backup !== false && this.options.enableBackup) {
        await this.createBackup(absoluteSource, 'before_move');
        if (await this.exists(absoluteTarget)) {
          await this.createBackup(absoluteTarget, 'before_overwrite');
        }
      }

      // 确保目标目录存在
      await this.ensureDir(path.dirname(absoluteTarget));

      // 获取源文件校验和
      const sourceMetadata = await this.getFileMetadata(absoluteSource);

      // 移动文件
      await fs.rename(absoluteSource, absoluteTarget);

      // 记录操作
      const operation: FileOperation = {
        id: operationId,
        type: 'move',
        source: absoluteSource,
        target: absoluteTarget,
        timestamp: new Date(),
        checksum: sourceMetadata.checksum,
      };

      this.operations.set(operationId, operation);
      this.emit('fileMoved', { operation, source: absoluteSource, target: absoluteTarget });

      return operation;
    } catch (error) {
      throw new Error(`Move failed: ${error}`);
    } finally {
      if (sourceLockId) {
        await this.releaseLock(absoluteSource, sourceLockId);
      }
      if (targetLockId) {
        await this.releaseLock(absoluteTarget, targetLockId);
      }
    }
  }

  /**
   * 复制文件
   */
  async copyFile(
    sourcePath: string,
    targetPath: string,
    options?: {
      overwrite?: boolean;
      preserveMetadata?: boolean;
    }
  ): Promise<FileOperation> {
    const absoluteSource = this.resolvePath(sourcePath);
    const absoluteTarget = this.resolvePath(targetPath);
    const operationId = this.generateOperationId();

    this.validateFilePath(absoluteSource);
    this.validateFilePath(absoluteTarget);

    if (!(await this.exists(absoluteSource))) {
      throw new Error(`Source file not found: ${sourcePath}`);
    }

    if (!options?.overwrite && (await this.exists(absoluteTarget))) {
      throw new Error(`Target file already exists: ${targetPath}`);
    }

    try {
      // 确保目标目录存在
      await this.ensureDir(path.dirname(absoluteTarget));

      // 复制文件
      await fs.copyFile(absoluteSource, absoluteTarget);

      // 保留元数据
      if (options?.preserveMetadata) {
        const sourceStats = await fs.stat(absoluteSource);
        await fs.utimes(absoluteTarget, sourceStats.atime, sourceStats.mtime);
      }

      // 获取校验和
      const targetMetadata = await this.getFileMetadata(absoluteTarget);

      // 记录操作
      const operation: FileOperation = {
        id: operationId,
        type: 'copy',
        source: absoluteSource,
        target: absoluteTarget,
        timestamp: new Date(),
        checksum: targetMetadata.checksum,
      };

      this.operations.set(operationId, operation);
      this.emit('fileCopied', { operation, source: absoluteSource, target: absoluteTarget });

      return operation;
    } catch (error) {
      throw new Error(`Copy failed: ${error}`);
    }
  }

  /**
   * 获取文件元数据
   */
  async getFileMetadata(filePath: string): Promise<FileMetadata> {
    const absolutePath = this.resolvePath(filePath);

    if (!(await this.exists(absolutePath))) {
      throw new Error(`File not found: ${filePath}`);
    }

    const stats = await fs.stat(absolutePath);
    const content = await fs.readFile(absolutePath);
    const checksum = this.calculateChecksum(content);
    const isLocked = this.locks.has(absolutePath);

    return {
      path: absolutePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      checksum,
      locked: isLocked,
    };
  }

  /**
   * 列出目录内容
   */
  async listDirectory(
    dirPath: string,
    options?: {
      recursive?: boolean;
      includeMetadata?: boolean;
      filter?: (path: string) => boolean;
    }
  ): Promise<string[] | FileMetadata[]> {
    const absolutePath = this.resolvePath(dirPath);

    if (!(await this.exists(absolutePath))) {
      throw new Error(`Directory not found: ${dirPath}`);
    }

    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${dirPath}`);
    }

    const files: string[] = [];

    const scanDirectory = async (currentPath: string): Promise<void> => {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (options?.filter && !options.filter(fullPath)) {
          continue;
        }

        if (entry.isFile()) {
          files.push(fullPath);
        } else if (entry.isDirectory() && options?.recursive) {
          await scanDirectory(fullPath);
        }
      }
    };

    await scanDirectory(absolutePath);

    if (options?.includeMetadata) {
      const metadata: FileMetadata[] = [];
      for (const file of files) {
        try {
          metadata.push(await this.getFileMetadata(file));
        } catch (error) {
          // 跳过无法访问的文件
        }
      }
      return metadata;
    }

    return files;
  }

  /**
   * 检查文件是否存在
   */
  async exists(filePath: string): Promise<boolean> {
    const absolutePath = this.resolvePath(filePath);
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 创建目录
   */
  async ensureDir(dirPath: string): Promise<void> {
    const absolutePath = this.resolvePath(dirPath);
    await fs.mkdir(absolutePath, { recursive: true });
  }

  /**
   * 获取文件锁
   */
  async acquireLock(filePath: string, timeout?: number): Promise<string> {
    const absolutePath = this.resolvePath(filePath);
    const lockId = this.generateLockId();
    const lockTimeout = timeout || this.options.lockTimeout;
    const expiresAt = new Date(Date.now() + lockTimeout);

    // 检查现有锁
    const existingLock = this.locks.get(absolutePath);
    if (existingLock && existingLock.expiresAt > new Date()) {
      throw new Error(`File is locked by ${existingLock.lockId}`);
    }

    // 创建锁
    const lock: FileLock = {
      path: absolutePath,
      lockId,
      timestamp: new Date(),
      expiresAt,
      process: process.pid?.toString(),
    };

    this.locks.set(absolutePath, lock);

    // 设置自动过期
    setTimeout(() => {
      const currentLock = this.locks.get(absolutePath);
      if (currentLock?.lockId === lockId) {
        this.locks.delete(absolutePath);
        this.emit('lockExpired', { path: absolutePath, lockId });
      }
    }, lockTimeout);

    this.emit('lockAcquired', { path: absolutePath, lockId });
    return lockId;
  }

  /**
   * 释放文件锁
   */
  async releaseLock(filePath: string, lockId: string): Promise<boolean> {
    const absolutePath = this.resolvePath(filePath);
    const lock = this.locks.get(absolutePath);

    if (!lock || lock.lockId !== lockId) {
      return false;
    }

    this.locks.delete(absolutePath);
    this.emit('lockReleased', { path: absolutePath, lockId });
    return true;
  }

  /**
   * 创建备份
   */
  async createBackup(filePath: string, reason: string): Promise<BackupInfo> {
    const absolutePath = this.resolvePath(filePath);

    if (!(await this.exists(absolutePath))) {
      throw new Error(`Cannot backup non-existent file: ${filePath}`);
    }

    const timestamp = new Date();
    const backupName = `${path.basename(absolutePath)}.${timestamp.getTime()}.backup`;
    const backupPath = path.join(this.layout.backups, backupName);

    await this.ensureDir(this.layout.backups);

    const metadata = await this.getFileMetadata(absolutePath);
    await this.copyFile(absolutePath, backupPath);

    const backupInfo: BackupInfo = {
      originalPath: absolutePath,
      backupPath,
      timestamp,
      checksum: metadata.checksum,
      size: metadata.size,
      reason,
    };

    this.emit('backupCreated', backupInfo);
    return backupInfo;
  }

  /**
   * 设置文件监控
   */
  async setupFileWatching(): Promise<void> {
    // 这里需要使用 chokidar 库，但为了简化，我们使用基本的 fs.watch
    try {
      for (const [name, dirPath] of Object.entries(this.layout)) {
        if (await this.exists(dirPath)) {
          const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
            if (filename) {
              const fullPath = path.join(dirPath, filename);
              const event: WatchEvent = {
                type: eventType === 'change' ? 'change' : 'add',
                path: fullPath,
                timestamp: new Date(),
              };

              this.emit('fileChanged', event);
            }
          });

          this.watchers.set(name, watcher);
        }
      }

      this.emit('watchingStarted');
    } catch (error) {
      console.warn('File watching setup failed:', error);
    }
  }

  /**
   * 停止文件监控
   */
  async stopFileWatching(): Promise<void> {
    for (const [name, watcher] of this.watchers) {
      if (watcher && typeof watcher.close === 'function') {
        watcher.close();
      }
      this.watchers.delete(name);
    }

    this.emit('watchingStopped');
  }

  /**
   * 清理过期锁
   */
  async cleanupExpiredLocks(): Promise<number> {
    const now = new Date();
    const expiredLocks: string[] = [];

    for (const [path, lock] of this.locks) {
      if (lock.expiresAt <= now) {
        expiredLocks.push(path);
      }
    }

    for (const path of expiredLocks) {
      this.locks.delete(path);
    }

    if (expiredLocks.length > 0) {
      this.emit('locksCleanedUp', { count: expiredLocks.length });
    }

    return expiredLocks.length;
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles(): Promise<number> {
    if (!(await this.exists(this.layout.temp))) {
      return 0;
    }

    const tempFiles = (await this.listDirectory(this.layout.temp)) as string[];
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    let cleaned = 0;

    for (const file of tempFiles) {
      try {
        const stats = await fs.stat(file);
        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(file);
          cleaned++;
        }
      } catch {
        // 忽略清理错误
      }
    }

    if (cleaned > 0) {
      this.emit('tempFilesCleanedUp', { count: cleaned });
    }

    return cleaned;
  }

  /**
   * 获取目录布局
   */
  getLayout(): DirectoryLayout {
    return { ...this.layout };
  }

  /**
   * 获取操作历史
   */
  getOperationHistory(limit?: number): FileOperation[] {
    const operations = Array.from(this.operations.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    return limit ? operations.slice(0, limit) : operations;
  }

  /**
   * 销毁文件管理器
   */
  async destroy(): Promise<void> {
    await this.stopFileWatching();
    await this.cleanupTempFiles();

    // 释放所有锁
    this.locks.clear();
    this.operations.clear();

    this.removeAllListeners();
    this.emit('destroyed');
  }

  // 私有方法
  private async createDirectoryStructure(): Promise<void> {
    for (const dirPath of Object.values(this.layout)) {
      await this.ensureDir(dirPath);
    }
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return path.normalize(filePath);
    }
    return path.resolve(this.options.baseDir, filePath);
  }

  private validateFilePath(filePath: string): void {
    // 检查路径是否在允许的基础目录内
    const resolvedPath = path.resolve(filePath);
    const resolvedBase = path.resolve(this.options.baseDir);

    if (!resolvedPath.startsWith(resolvedBase)) {
      throw new Error(`Path outside base directory: ${filePath}`);
    }

    // 检查文件扩展名
    const ext = path.extname(filePath).toLowerCase();
    if (ext && !this.options.allowedExtensions.includes(ext)) {
      throw new Error(`File extension not allowed: ${ext}`);
    }
  }

  private validateFileSize(content: string | Buffer): void {
    const size = typeof content === 'string' ? Buffer.byteLength(content) : content.length;

    if (size > this.options.maxFileSize) {
      throw new Error(`File size exceeds limit: ${size} > ${this.options.maxFileSize}`);
    }
  }

  private getTempPath(filePath: string): string {
    const filename = path.basename(filePath);
    const tempName = `${Date.now()}_${Math.random().toString(36).substring(2)}_${filename}`;
    return path.join(this.layout.temp, tempName);
  }

  private calculateChecksum(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private generateLockId(): string {
    return `lock_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private setupCleanupHandlers(): void {
    // 定期清理
    setInterval(
      () => {
        this.cleanupExpiredLocks();
        this.cleanupTempFiles();
      },
      5 * 60 * 1000
    ); // 每5分钟清理一次

    // 进程退出时清理
    process.on('exit', () => {
      this.destroy();
    });

    process.on('SIGINT', () => {
      this.destroy();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.destroy();
      process.exit(0);
    });
  }
}

export default FileManager;
