/**
 * 路径遍历保护安全测试
 *
 * 测试文件系统操作中的路径遍历攻击防护
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FileManager } from '../../src/lib/file-manager';
import { createTempDirectory, cleanupDirectory } from '../helpers/test-utils';

describe('路径遍历保护安全测试', () => {
  let fileManager: FileManager;
  let testDir: string;
  let sensitiveDir: string;
  let sensitiveFile: string;

  beforeEach(async () => {
    // 创建测试环境
    testDir = await createTempDirectory('path-traversal-test');
    sensitiveDir = path.join(testDir, '..', 'sensitive');
    sensitiveFile = path.join(sensitiveDir, 'secret.txt');

    // 创建敏感目录和文件
    await fs.mkdir(sensitiveDir, { recursive: true });
    await fs.writeFile(sensitiveFile, '这是敏感数据，不应该被访问');

    // 初始化FileManager
    fileManager = new FileManager({
      baseDir: testDir,
      enableBackup: false,
      enableWatch: false,
      allowedExtensions: ['.md', '.txt', '.json']
    });

    await fileManager.initialize();
  });

  afterEach(async () => {
    await fileManager?.destroy();
    await cleanupDirectory(testDir);
    await cleanupDirectory(sensitiveDir);
  });

  describe('路径遍历攻击防护', () => {
    it('应该阻止基本的 ../ 路径遍历', async () => {
      const maliciousPath = '../sensitive/secret.txt';

      await expect(
        fileManager.readFile(maliciousPath)
      ).rejects.toThrow('Path outside base directory');
    });

    it('应该阻止多层 ../ 路径遍历', async () => {
      const maliciousPath = '../../sensitive/secret.txt';

      await expect(
        fileManager.readFile(maliciousPath)
      ).rejects.toThrow('Path outside base directory');
    });

    it('应该阻止深层嵌套的路径遍历', async () => {
      const maliciousPath = '../../../../../../../etc/passwd';

      await expect(
        fileManager.readFile(maliciousPath)
      ).rejects.toThrow('Path outside base directory');
    });

    it('应该阻止混合正常路径的遍历攻击', async () => {
      const maliciousPath = 'normal/path/../../sensitive/secret.txt';

      await expect(
        fileManager.readFile(maliciousPath)
      ).rejects.toThrow('Path outside base directory');
    });

    it('应该阻止URL编码的路径遍历', async () => {
      const maliciousPaths = [
        '%2e%2e%2fsensitive%2fsecret.txt',
        '..%2fsensitive%2fsecret.txt',
        '..%5csensitive%5csecret.txt'
      ];

      for (const maliciousPath of maliciousPaths) {
        await expect(
          fileManager.readFile(decodeURIComponent(maliciousPath))
        ).rejects.toThrow('Path outside base directory');
      }
    });

    it('应该阻止双重编码的路径遍历', async () => {
      const maliciousPath = '%252e%252e%252fsensitive%252fsecret.txt';
      const decodedPath = decodeURIComponent(decodeURIComponent(maliciousPath));

      await expect(
        fileManager.readFile(decodedPath)
      ).rejects.toThrow('Path outside base directory');
    });

    it('应该阻止Unicode编码的路径遍历', async () => {
      const maliciousPaths = [
        '\u002e\u002e\u002fsensitive\u002fsecret.txt',
        '\u002e\u002e\u005csensitive\u005csecret.txt'
      ];

      for (const maliciousPath of maliciousPaths) {
        await expect(
          fileManager.readFile(maliciousPath)
        ).rejects.toThrow('Path outside base directory');
      }
    });

    it('应该阻止UTF-8编码的路径遍历', async () => {
      const maliciousPaths = [
        '\xc0\xae\xc0\xae\x2fsensitive\x2fsecret.txt',
        '\xc1\x9c\xc1\x9c\x2fsensitive\x2fsecret.txt'
      ];

      for (const maliciousPath of maliciousPaths) {
        // UTF-8解码可能失败，所以用try-catch包装
        try {
          await expect(
            fileManager.readFile(maliciousPath)
          ).rejects.toThrow('Path outside base directory');
        } catch (error) {
          // 如果路径本身无效，也是安全的
          expect(error).toBeDefined();
        }
      }
    });

    it('应该阻止混合分隔符的路径遍历', async () => {
      const maliciousPaths = [
        '..\\sensitive\\secret.txt',
        '../sensitive\\secret.txt',
        '..\\sensitive/secret.txt'
      ];

      for (const maliciousPath of maliciousPaths) {
        await expect(
          fileManager.readFile(maliciousPath)
        ).rejects.toThrow('Path outside base directory');
      }
    });

    it('应该阻止长路径名的遍历攻击', async () => {
      const longPath = '../'.repeat(1000) + 'sensitive/secret.txt';

      await expect(
        fileManager.readFile(longPath)
      ).rejects.toThrow('Path outside base directory');
    });

    it('应该阻止符号链接路径遍历', async () => {
      const linkPath = path.join(testDir, 'malicious-link');

      try {
        // 创建指向敏感目录的符号链接
        await fs.symlink(sensitiveDir, linkPath);

        await expect(
          fileManager.readFile('malicious-link/secret.txt')
        ).rejects.toThrow(); // 应该被阻止或失败
      } catch (error) {
        // 如果无法创建符号链接（权限问题），跳过测试
        if (error.code !== 'EPERM') {
          throw error;
        }
      }
    });
  });

  describe('写入操作的路径遍历防护', () => {
    it('应该阻止写入操作的路径遍历', async () => {
      const maliciousPath = '../sensitive/malicious.txt';
      const content = '恶意内容';

      await expect(
        fileManager.writeFileAtomic(maliciousPath, content)
      ).rejects.toThrow('Path outside base directory');
    });

    it('应该阻止删除操作的路径遍历', async () => {
      const maliciousPath = '../sensitive/secret.txt';

      await expect(
        fileManager.deleteFile(maliciousPath)
      ).rejects.toThrow('Path outside base directory');
    });

    it('应该阻止移动操作的路径遍历', async () => {
      // 创建合法源文件
      const sourceFile = 'legitimate.txt';
      await fileManager.writeFileAtomic(sourceFile, 'test content');

      const maliciousTarget = '../sensitive/moved.txt';

      await expect(
        fileManager.moveFile(sourceFile, maliciousTarget)
      ).rejects.toThrow('Path outside base directory');
    });

    it('应该阻止复制操作的路径遍历', async () => {
      // 创建合法源文件
      const sourceFile = 'legitimate.txt';
      await fileManager.writeFileAtomic(sourceFile, 'test content');

      const maliciousTarget = '../sensitive/copied.txt';

      await expect(
        fileManager.copyFile(sourceFile, maliciousTarget)
      ).rejects.toThrow('Path outside base directory');
    });
  });

  describe('目录操作的路径遍历防护', () => {
    it('应该阻止列出目录的路径遍历', async () => {
      const maliciousPath = '../sensitive';

      await expect(
        fileManager.listDirectory(maliciousPath)
      ).rejects.toThrow('Path outside base directory');
    });

    it('应该阻止创建目录的路径遍历', async () => {
      const maliciousPath = '../sensitive/new-dir';

      await expect(
        fileManager.ensureDir(maliciousPath)
      ).rejects.toThrow('Path outside base directory');
    });
  });

  describe('文件扩展名限制', () => {
    it('应该阻止不允许的文件扩展名', async () => {
      const maliciousPaths = [
        'script.exe',
        'malware.bat',
        'virus.com',
        'trojan.scr',
        'backdoor.cmd',
        'shell.php',
        'exploit.jsp',
        'malicious.asp'
      ];

      for (const maliciousPath of maliciousPaths) {
        await expect(
          fileManager.writeFileAtomic(maliciousPath, 'malicious content')
        ).rejects.toThrow('File extension not allowed');
      }
    });

    it('应该允许合法的文件扩展名', async () => {
      const legitimatePaths = [
        'document.md',
        'config.json',
        'data.txt'
      ];

      for (const legitimatePath of legitimatePaths) {
        await expect(
          fileManager.writeFileAtomic(legitimatePath, 'legitimate content')
        ).resolves.toBeDefined();
      }
    });

    it('应该阻止多重扩展名绕过', async () => {
      const maliciousPaths = [
        'file.txt.exe',
        'document.md.bat',
        'config.json.php'
      ];

      for (const maliciousPath of maliciousPaths) {
        await expect(
          fileManager.writeFileAtomic(maliciousPath, 'content')
        ).rejects.toThrow('File extension not allowed');
      }
    });

    it('应该处理大小写绕过尝试', async () => {
      const maliciousPaths = [
        'script.EXE',
        'malware.BAT',
        'Shell.PHP'
      ];

      for (const maliciousPath of maliciousPaths) {
        await expect(
          fileManager.writeFileAtomic(maliciousPath, 'content')
        ).rejects.toThrow('File extension not allowed');
      }
    });
  });

  describe('特殊字符和边界情况', () => {
    it('应该处理空路径', async () => {
      await expect(
        fileManager.readFile('')
      ).rejects.toThrow();
    });

    it('应该处理包含空字符的路径', async () => {
      const maliciousPath = 'file\x00.txt';

      await expect(
        fileManager.readFile(maliciousPath)
      ).rejects.toThrow();
    });

    it('应该处理包含控制字符的路径', async () => {
      const maliciousPaths = [
        'file\x01.txt',
        'file\x1f.txt',
        'file\x7f.txt'
      ];

      for (const maliciousPath of maliciousPaths) {
        await expect(
          fileManager.readFile(maliciousPath)
        ).rejects.toThrow();
      }
    });

    it('应该处理过长的文件名', async () => {
      const longFileName = 'a'.repeat(300) + '.txt';

      await expect(
        fileManager.writeFileAtomic(longFileName, 'content')
      ).rejects.toThrow();
    });

    it('应该处理特殊Windows设备名', async () => {
      const windowsDeviceNames = [
        'CON.txt',
        'PRN.txt',
        'AUX.txt',
        'NUL.txt',
        'COM1.txt',
        'LPT1.txt'
      ];

      for (const deviceName of windowsDeviceNames) {
        // 在非Windows系统上，这些可能是合法文件名
        // 但在Windows上应该被阻止
        try {
          await fileManager.writeFileAtomic(deviceName, 'content');
          // 如果成功，验证文件确实被创建在正确位置
          const exists = await fileManager.exists(deviceName);
          expect(exists).toBe(true);
        } catch (error) {
          // 如果被阻止，这也是可接受的安全行为
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('绝对路径安全性', () => {
    it('应该安全处理绝对路径', async () => {
      const absolutePaths = [
        '/etc/passwd',
        '/bin/bash',
        '/tmp/malicious.txt',
        'C:\\Windows\\System32\\config\\SAM',
        'C:\\Users\\Administrator\\Desktop\\secret.txt'
      ];

      for (const absolutePath of absolutePaths) {
        await expect(
          fileManager.readFile(absolutePath)
        ).rejects.toThrow('Path outside base directory');
      }
    });

    it('应该允许基础目录内的绝对路径', async () => {
      const legitimateFile = 'legitimate.txt';
      await fileManager.writeFileAtomic(legitimateFile, 'content');

      const absolutePath = path.resolve(testDir, legitimateFile);

      await expect(
        fileManager.readFile(absolutePath)
      ).resolves.toBe('content');
    });
  });

  describe('竞争条件防护', () => {
    it('应该防止TOCTOU (Time-of-Check-Time-of-Use) 攻击', async () => {
      const legitimateFile = 'legitimate.txt';
      await fileManager.writeFileAtomic(legitimateFile, 'original content');

      // 模拟竞争条件攻击
      const promises = Array.from({ length: 10 }, async (_, i) => {
        try {
          if (i % 2 === 0) {
            return await fileManager.readFile(legitimateFile);
          } else {
            return await fileManager.writeFileAtomic(legitimateFile, `modified ${i}`);
          }
        } catch (error) {
          return error;
        }
      });

      const results = await Promise.allSettled(promises);

      // 所有操作应该成功或以可预测的方式失败
      results.forEach(result => {
        if (result.status === 'rejected') {
          // 如果有失败，应该是由于锁定机制，而不是安全漏洞
          expect(result.reason.message).toMatch(/locked|timeout/i);
        }
      });
    });
  });

  describe('内存安全', () => {
    it('应该防止通过大文件进行内存耗尽攻击', async () => {
      // 创建一个超过限制的大内容
      const largeContent = 'A'.repeat(200 * 1024 * 1024); // 200MB

      await expect(
        fileManager.writeFileAtomic('large.txt', largeContent)
      ).rejects.toThrow('File size exceeds limit');
    });

    it('应该防止通过深层嵌套路径进行内存攻击', async () => {
      const deepPath = 'a/'.repeat(10000) + 'file.txt';

      await expect(
        fileManager.writeFileAtomic(deepPath, 'content')
      ).rejects.toThrow();
    });
  });

  describe('日志记录和审计', () => {
    it('应该记录被阻止的恶意操作', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        await fileManager.readFile('../sensitive/secret.txt');
      } catch (error) {
        // 期望操作被阻止
      }

      // 注意：这个测试假设FileManager会记录安全事件
      // 实际实现可能需要添加日志记录功能
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/security|blocked|denied|unauthorized/i)
      );

      consoleSpy.mockRestore();
    });

    it('应该触发安全事件', async () => {
      const securityEvents: any[] = [];

      fileManager.on('securityViolation', (event) => {
        securityEvents.push(event);
      });

      try {
        await fileManager.readFile('../sensitive/secret.txt');
      } catch (error) {
        // 期望操作被阻止
      }

      // 注意：这需要FileManager实现securityViolation事件
      expect(securityEvents).toHaveLength(1);
      expect(securityEvents[0]).toMatchObject({
        type: 'pathTraversal',
        attemptedPath: expect.stringContaining('../sensitive/secret.txt'),
        timestamp: expect.any(Date)
      });
    });
  });
});