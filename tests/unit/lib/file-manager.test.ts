/**
 * FileManager 单元测试
 *
 * 测试范围：
 * - 文件基本操作 (读取、写入、删除、移动、复制)
 * - 原子写入和文件锁定机制
 * - 目录结构管理和初始化
 * - 文件监控和变更检测
 * - 备份和恢复机制
 * - 清理和维护功能
 * - 错误处理和边界情况
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { EventEmitter } from 'events';
import {
  FileManager,
  type FileManagerOptions,
  type FileMetadata,
  type DirectoryLayout,
  type FileOperation,
  type FileLock,
  type BackupInfo,
  type WatchEvent
} from '../../../src/lib/file-manager.js';

describe('FileManager', () => {
  let fileManager: FileManager;
  let testBaseDir: string;
  let mockFs: any;

  beforeEach(() => {
    // 设置测试目录
    testBaseDir = '/tmp/test-file-manager';

    // 创建 FileManager 实例
    const options: FileManagerOptions = {
      baseDir: testBaseDir,
      enableBackup: true,
      enableWatch: false, // 在测试中禁用监控
      lockTimeout: 1000,
      maxFileSize: 1024 * 1024, // 1MB
      allowedExtensions: ['.txt', '.md', '.json']
    };

    fileManager = new FileManager(options);

    // 模拟文件系统操作
    mockFs = {
      readFile: vi.fn(),
      writeFile: vi.fn(),
      unlink: vi.fn(),
      mkdir: vi.fn(),
      rmdir: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
      copyFile: vi.fn(),
      rename: vi.fn()
    };

    vi.doMock('fs/promises', () => mockFs);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const manager = new FileManager({ baseDir: '/test' });

      expect(manager).toBeDefined();
      expect(manager).toBeInstanceOf(EventEmitter);
    });

    it('should create directory layout on initialization', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));

      await fileManager.initialize();

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(testBaseDir),
        expect.objectContaining({ recursive: true })
      );
    });

    it('should validate base directory path', () => {
      expect(() => {
        new FileManager({ baseDir: '../dangerous/path' });
      }).toThrow('Invalid base directory path');
    });

    it('should setup directory layout correctly', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));

      await fileManager.initialize();

      const expectedDirs = ['drafts', 'templates', 'versions', 'backups', 'cache', 'logs', 'temp'];
      expectedDirs.forEach(dir => {
        expect(mockFs.mkdir).toHaveBeenCalledWith(
          expect.stringContaining(dir),
          expect.any(Object)
        );
      });
    });
  });

  describe('File Operations', () => {
    beforeEach(async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));
      await fileManager.initialize();
    });

    describe('readFile', () => {
      it('should read file successfully', async () => {
        const filePath = 'test/file.txt';
        const fileContent = 'Hello, World!';

        mockFs.readFile.mockResolvedValue(Buffer.from(fileContent));
        mockFs.stat.mockResolvedValue({
          size: fileContent.length,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });

        const content = await fileManager.readFile(filePath);

        expect(content).toBe(fileContent);
        expect(mockFs.readFile).toHaveBeenCalledWith(
          expect.stringContaining(filePath),
          'utf8'
        );
      });

      it('should validate file extension', async () => {
        const invalidFile = 'test/file.exe';

        await expect(fileManager.readFile(invalidFile))
          .rejects.toThrow('File extension not allowed');
      });

      it('should check file size limits', async () => {
        const filePath = 'test/large-file.txt';

        mockFs.stat.mockResolvedValue({
          size: 2 * 1024 * 1024, // 2MB, exceeds 1MB limit
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });

        await expect(fileManager.readFile(filePath))
          .rejects.toThrow('File too large');
      });

      it('should handle file not found', async () => {
        const filePath = 'test/nonexistent.txt';

        mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

        await expect(fileManager.readFile(filePath))
          .rejects.toThrow('File not found');
      });
    });

    describe('writeFile', () => {
      it('should write file with atomic operation', async () => {
        const filePath = 'test/new-file.txt';
        const content = 'Test content';

        mockFs.writeFile.mockResolvedValue(undefined);
        mockFs.rename.mockResolvedValue(undefined);

        const metadata = await fileManager.writeFile(filePath, content);

        expect(metadata).toBeDefined();
        expect(metadata.path).toContain(filePath);
        expect(metadata.size).toBe(content.length);
        expect(mockFs.writeFile).toHaveBeenCalledWith(
          expect.stringContaining('.tmp'),
          content,
          'utf8'
        );
        expect(mockFs.rename).toHaveBeenCalled();
      });

      it('should create backup before overwriting', async () => {
        const filePath = 'test/existing-file.txt';
        const newContent = 'Updated content';

        mockFs.stat.mockResolvedValue({
          size: 100,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.readFile.mockResolvedValue(Buffer.from('Old content'));
        mockFs.writeFile.mockResolvedValue(undefined);
        mockFs.copyFile.mockResolvedValue(undefined);
        mockFs.rename.mockResolvedValue(undefined);

        const metadata = await fileManager.writeFile(filePath, newContent);

        expect(mockFs.copyFile).toHaveBeenCalled(); // Backup created
        expect(metadata.size).toBe(newContent.length);
      });

      it('should validate file extension before writing', async () => {
        const invalidFile = 'test/file.exe';
        const content = 'content';

        await expect(fileManager.writeFile(invalidFile, content))
          .rejects.toThrow('File extension not allowed');
      });

      it('should handle write permissions', async () => {
        const filePath = 'test/readonly.txt';
        const content = 'content';

        mockFs.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));

        await expect(fileManager.writeFile(filePath, content))
          .rejects.toThrow('Permission denied');
      });
    });

    describe('deleteFile', () => {
      it('should delete file successfully', async () => {
        const filePath = 'test/to-delete.txt';

        mockFs.stat.mockResolvedValue({
          size: 100,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.unlink.mockResolvedValue(undefined);

        const result = await fileManager.deleteFile(filePath);

        expect(result).toBe(true);
        expect(mockFs.unlink).toHaveBeenCalledWith(
          expect.stringContaining(filePath)
        );
      });

      it('should create backup before deletion', async () => {
        const filePath = 'test/to-delete-with-backup.txt';

        mockFs.stat.mockResolvedValue({
          size: 100,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.copyFile.mockResolvedValue(undefined);
        mockFs.unlink.mockResolvedValue(undefined);

        await fileManager.deleteFile(filePath, { createBackup: true });

        expect(mockFs.copyFile).toHaveBeenCalled(); // Backup created
        expect(mockFs.unlink).toHaveBeenCalled(); // File deleted
      });

      it('should return false for non-existent file', async () => {
        const filePath = 'test/nonexistent.txt';

        mockFs.stat.mockRejectedValue(new Error('ENOENT'));

        const result = await fileManager.deleteFile(filePath);

        expect(result).toBe(false);
      });
    });

    describe('moveFile', () => {
      it('should move file successfully', async () => {
        const sourcePath = 'test/source.txt';
        const targetPath = 'test/moved/target.txt';

        mockFs.stat.mockResolvedValue({
          size: 100,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.rename.mockResolvedValue(undefined);

        const result = await fileManager.moveFile(sourcePath, targetPath);

        expect(result).toBe(true);
        expect(mockFs.mkdir).toHaveBeenCalledWith(
          expect.stringContaining('moved'),
          expect.objectContaining({ recursive: true })
        );
        expect(mockFs.rename).toHaveBeenCalled();
      });

      it('should handle cross-device moves', async () => {
        const sourcePath = 'test/source.txt';
        const targetPath = 'test/target.txt';

        mockFs.stat.mockResolvedValue({
          size: 100,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.rename.mockRejectedValue(new Error('EXDEV: cross-device link not permitted'));
        mockFs.copyFile.mockResolvedValue(undefined);
        mockFs.unlink.mockResolvedValue(undefined);

        const result = await fileManager.moveFile(sourcePath, targetPath);

        expect(result).toBe(true);
        expect(mockFs.copyFile).toHaveBeenCalled();
        expect(mockFs.unlink).toHaveBeenCalled();
      });
    });

    describe('copyFile', () => {
      it('should copy file successfully', async () => {
        const sourcePath = 'test/source.txt';
        const targetPath = 'test/copy.txt';

        mockFs.stat.mockResolvedValue({
          size: 100,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.copyFile.mockResolvedValue(undefined);

        const metadata = await fileManager.copyFile(sourcePath, targetPath);

        expect(metadata).toBeDefined();
        expect(metadata.path).toContain(targetPath);
        expect(mockFs.copyFile).toHaveBeenCalled();
      });

      it('should preserve metadata during copy', async () => {
        const sourcePath = 'test/source.txt';
        const targetPath = 'test/copy.txt';

        const originalStat = {
          size: 100,
          mtime: new Date('2023-01-01'),
          birthtime: new Date('2023-01-01'),
          isFile: () => true
        };

        mockFs.stat.mockResolvedValue(originalStat);
        mockFs.copyFile.mockResolvedValue(undefined);

        const metadata = await fileManager.copyFile(sourcePath, targetPath, {
          preserveMetadata: true
        });

        expect(metadata.size).toBe(originalStat.size);
      });
    });
  });

  describe('File Locking', () => {
    beforeEach(async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));
      await fileManager.initialize();
    });

    describe('acquireLock', () => {
      it('should acquire lock successfully', async () => {
        const filePath = 'test/lockable.txt';

        const lock = await fileManager.acquireLock(filePath);

        expect(lock).toBeDefined();
        expect(lock.path).toBe(filePath);
        expect(lock.lockId).toBeDefined();
        expect(lock.timestamp).toBeInstanceOf(Date);
        expect(lock.expiresAt).toBeInstanceOf(Date);
      });

      it('should fail to acquire already locked file', async () => {
        const filePath = 'test/locked.txt';

        await fileManager.acquireLock(filePath);

        await expect(fileManager.acquireLock(filePath))
          .rejects.toThrow('File is already locked');
      });

      it('should handle lock expiration', async () => {
        const filePath = 'test/expiring-lock.txt';

        // 使用很短的超时时间进行测试
        const shortTimeout = 10;
        const manager = new FileManager({
          baseDir: testBaseDir,
          lockTimeout: shortTimeout
        });

        await manager.initialize();

        await manager.acquireLock(filePath);

        // 等待锁过期
        await new Promise(resolve => setTimeout(resolve, shortTimeout + 10));

        // 现在应该可以再次获取锁
        const secondLock = await manager.acquireLock(filePath);
        expect(secondLock).toBeDefined();
      });
    });

    describe('releaseLock', () => {
      it('should release lock successfully', async () => {
        const filePath = 'test/to-unlock.txt';

        const lock = await fileManager.acquireLock(filePath);
        const result = await fileManager.releaseLock(lock.lockId);

        expect(result).toBe(true);

        // 现在应该可以再次获取锁
        const newLock = await fileManager.acquireLock(filePath);
        expect(newLock).toBeDefined();
      });

      it('should return false for invalid lock ID', async () => {
        const result = await fileManager.releaseLock('invalid-lock-id');

        expect(result).toBe(false);
      });
    });

    describe('isLocked', () => {
      it('should check lock status correctly', async () => {
        const filePath = 'test/check-lock.txt';

        expect(await fileManager.isLocked(filePath)).toBe(false);

        await fileManager.acquireLock(filePath);
        expect(await fileManager.isLocked(filePath)).toBe(true);
      });
    });
  });

  describe('Backup Management', () => {
    beforeEach(async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));
      await fileManager.initialize();
    });

    describe('createBackup', () => {
      it('should create backup successfully', async () => {
        const filePath = 'test/to-backup.txt';
        const reason = 'Manual backup';

        mockFs.stat.mockResolvedValue({
          size: 100,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.readFile.mockResolvedValue(Buffer.from('Original content'));
        mockFs.copyFile.mockResolvedValue(undefined);

        const backupInfo = await fileManager.createBackup(filePath, reason);

        expect(backupInfo).toBeDefined();
        expect(backupInfo.originalPath).toBe(filePath);
        expect(backupInfo.reason).toBe(reason);
        expect(backupInfo.backupPath).toContain('.backups');
        expect(mockFs.copyFile).toHaveBeenCalled();
      });

      it('should generate unique backup paths', async () => {
        const filePath = 'test/duplicate-backup.txt';

        mockFs.stat.mockResolvedValue({
          size: 100,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.readFile.mockResolvedValue(Buffer.from('Content'));
        mockFs.copyFile.mockResolvedValue(undefined);

        const backup1 = await fileManager.createBackup(filePath, 'First');
        const backup2 = await fileManager.createBackup(filePath, 'Second');

        expect(backup1.backupPath).not.toBe(backup2.backupPath);
      });
    });

    describe('restoreBackup', () => {
      it('should restore from backup successfully', async () => {
        const filePath = 'test/to-restore.txt';
        const backupContent = 'Backup content';

        // 首先创建备份
        mockFs.stat.mockResolvedValue({
          size: backupContent.length,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.readFile.mockResolvedValue(Buffer.from(backupContent));
        mockFs.copyFile.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);
        mockFs.rename.mockResolvedValue(undefined);

        const backupInfo = await fileManager.createBackup(filePath, 'Test backup');

        // 然后恢复
        const result = await fileManager.restoreBackup(backupInfo);

        expect(result).toBe(true);
        expect(mockFs.copyFile).toHaveBeenCalled();
      });
    });

    describe('listBackups', () => {
      it('should list backups for file', async () => {
        const filePath = 'test/multi-backup.txt';

        mockFs.stat.mockResolvedValue({
          size: 100,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.readFile.mockResolvedValue(Buffer.from('Content'));
        mockFs.copyFile.mockResolvedValue(undefined);

        await fileManager.createBackup(filePath, 'Backup 1');
        await fileManager.createBackup(filePath, 'Backup 2');

        const backups = await fileManager.listBackups(filePath);

        expect(backups).toHaveLength(2);
        expect(backups[0].reason).toBe('Backup 1');
        expect(backups[1].reason).toBe('Backup 2');
      });

      it('should return empty array for files without backups', async () => {
        const filePath = 'test/no-backups.txt';

        const backups = await fileManager.listBackups(filePath);

        expect(backups).toHaveLength(0);
      });
    });
  });

  describe('File Monitoring', () => {
    beforeEach(async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));
      await fileManager.initialize();
    });

    describe('startWatching', () => {
      it('should start watching directory', async () => {
        const watchPath = 'test/watch-dir';

        // 启用监控的 FileManager
        const watchManager = new FileManager({
          baseDir: testBaseDir,
          enableWatch: true
        });

        await watchManager.initialize();

        const result = await watchManager.startWatching(watchPath);

        expect(result).toBe(true);
      });

      it('should emit events for file changes', async () => {
        const watchManager = new FileManager({
          baseDir: testBaseDir,
          enableWatch: true
        });

        await watchManager.initialize();

        const events: WatchEvent[] = [];
        watchManager.on('fileChanged', (event: WatchEvent) => {
          events.push(event);
        });

        await watchManager.startWatching('test');

        // 模拟文件变更事件
        watchManager.emit('fileChanged', {
          type: 'change',
          path: 'test/changed.txt',
          timestamp: new Date()
        });

        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('change');
      });
    });

    describe('stopWatching', () => {
      it('should stop watching directory', async () => {
        const watchManager = new FileManager({
          baseDir: testBaseDir,
          enableWatch: true
        });

        await watchManager.initialize();
        await watchManager.startWatching('test');

        const result = await watchManager.stopWatching('test');

        expect(result).toBe(true);
      });
    });
  });

  describe('Maintenance and Cleanup', () => {
    beforeEach(async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));
      await fileManager.initialize();
    });

    describe('cleanupTempFiles', () => {
      it('should cleanup old temporary files', async () => {
        const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago

        mockFs.readdir.mockResolvedValue(['temp1.tmp', 'temp2.tmp', 'keep.txt']);
        mockFs.stat
          .mockResolvedValueOnce({
            mtime: oldDate,
            isFile: () => true
          })
          .mockResolvedValueOnce({
            mtime: new Date(), // Recent file
            isFile: () => true
          })
          .mockResolvedValueOnce({
            mtime: oldDate,
            isFile: () => true
          });
        mockFs.unlink.mockResolvedValue(undefined);

        const result = await fileManager.cleanupTempFiles(60 * 60 * 1000); // 1 hour threshold

        expect(result.deletedCount).toBe(1); // Only temp1.tmp should be deleted
        expect(mockFs.unlink).toHaveBeenCalledWith(
          expect.stringContaining('temp1.tmp')
        );
      });
    });

    describe('cleanupOldBackups', () => {
      it('should cleanup old backup files', async () => {
        const oldDate = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago

        mockFs.readdir.mockResolvedValue(['backup1.bak', 'backup2.bak']);
        mockFs.stat
          .mockResolvedValueOnce({
            mtime: oldDate,
            size: 1000,
            isFile: () => true
          })
          .mockResolvedValueOnce({
            mtime: new Date(),
            size: 1000,
            isFile: () => true
          });
        mockFs.unlink.mockResolvedValue(undefined);

        const result = await fileManager.cleanupOldBackups(7); // 7 days retention

        expect(result.deletedCount).toBe(1);
        expect(result.freedSpace).toBe(1000);
      });
    });

    describe('validateIntegrity', () => {
      it('should validate file system integrity', async () => {
        mockFs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);
        mockFs.stat.mockResolvedValue({
          size: 100,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.readFile.mockResolvedValue(Buffer.from('Content'));

        const result = await fileManager.validateIntegrity();

        expect(result.isValid).toBe(true);
        expect(result.checkedFiles).toBe(2);
        expect(result.errors).toHaveLength(0);
      });

      it('should detect corrupted files', async () => {
        mockFs.readdir.mockResolvedValue(['corrupted.txt']);
        mockFs.stat.mockResolvedValue({
          size: 100,
          mtime: new Date(),
          birthtime: new Date(),
          isFile: () => true
        });
        mockFs.readFile.mockRejectedValue(new Error('Corrupted file'));

        const result = await fileManager.validateIntegrity();

        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('corrupted.txt');
      });
    });

    describe('getStorageInfo', () => {
      it('should return storage information', async () => {
        mockFs.readdir.mockResolvedValue(['file1.txt', 'file2.txt']);
        mockFs.stat.mockResolvedValue({
          size: 1000,
          isFile: () => true
        });

        const info = await fileManager.getStorageInfo();

        expect(info).toBeDefined();
        expect(typeof info.totalFiles).toBe('number');
        expect(typeof info.totalSize).toBe('number');
        expect(typeof info.freeSpace).toBe('number');
        expect(Array.isArray(info.largestFiles)).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.stat.mockRejectedValue(new Error('Directory not found'));
      await fileManager.initialize();
    });

    it('should handle permission errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(fileManager.readFile('test/restricted.txt'))
        .rejects.toThrow('Permission denied');
    });

    it('should handle disk space errors', async () => {
      mockFs.writeFile.mockRejectedValue(new Error('ENOSPC: no space left on device'));

      await expect(fileManager.writeFile('test/large.txt', 'content'))
        .rejects.toThrow('No space left on device');
    });

    it('should handle network filesystem errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('EIO: i/o error'));

      await expect(fileManager.readFile('test/network.txt'))
        .rejects.toThrow('I/O error');
    });

    it('should emit error events for async operations', (done) => {
      fileManager.on('error', (error) => {
        expect(error).toBeInstanceOf(Error);
        done();
      });

      // 触发异步错误
      fileManager.emit('error', new Error('Test async error'));
    });
  });

  describe('Cross-platform Compatibility', () => {
    it('should handle Windows path separators', () => {
      const windowsPath = 'folder\\subfolder\\file.txt';
      const normalized = fileManager.normalizePath(windowsPath);

      expect(normalized).toBe('folder/subfolder/file.txt');
    });

    it('should handle Unix hidden files', async () => {
      const hiddenFile = '.hidden-file.txt';

      mockFs.stat.mockResolvedValue({
        size: 100,
        mtime: new Date(),
        birthtime: new Date(),
        isFile: () => true
      });
      mockFs.readFile.mockResolvedValue(Buffer.from('Hidden content'));

      const content = await fileManager.readFile(hiddenFile);

      expect(content).toBe('Hidden content');
    });

    it('should handle case sensitivity correctly', async () => {
      const file1 = 'test/File.txt';
      const file2 = 'test/file.txt';

      // 在大小写敏感的系统中，这应该是不同的文件
      expect(fileManager.normalizePath(file1)).not.toBe(fileManager.normalizePath(file2));
    });
  });
});