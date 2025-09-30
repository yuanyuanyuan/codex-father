/**
 * Config Persister Unit Tests - 配置持久化器单元测试
 *
 * 测试覆盖:
 * - 配置的保存和读取
 * - 原子写入保证
 * - 配置格式验证 (Zod Schema)
 * - 日期序列化 (Date ↔ ISO String)
 * - Rollout 引用管理
 * - 错误处理
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ConfigPersister,
  createConfigPersister,
  saveRolloutRef,
  loadRolloutRef,
} from '../config-persister.js';
import type { Session } from '../../lib/types.js';
import { SessionStatus, ApprovalMode, SandboxPolicy } from '../../lib/types.js';

describe('ConfigPersister', () => {
  const testSessionsDir = path.join(process.cwd(), '.test-sessions');
  let sessionDir: string;
  let persister: ConfigPersister;

  beforeEach(async () => {
    // 创建测试会话目录
    sessionDir = path.join(testSessionsDir, `test-session-${uuidv4()}`);
    await fs.mkdir(sessionDir, { recursive: true });

    // 创建配置持久化器
    persister = createConfigPersister({
      sessionDir,
      configFileName: 'config.json',
      validateConfig: true,
      atomicWrite: true,
    });
  });

  afterEach(async () => {
    // 清理测试会话目录
    try {
      await fs.rm(testSessionsDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('基本功能', () => {
    it('应该成功保存和读取会话配置', async () => {
      // 准备测试会话
      const testSession: Session = {
        conversationId: uuidv4(),
        sessionName: 'test-session',
        jobId: uuidv4(),
        createdAt: new Date('2025-01-01T10:00:00Z'),
        sessionDir,
        rolloutRef: '/path/to/rollout.json',
        processId: 12345,
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-opus',
          cwd: '/workspace',
          approvalPolicy: ApprovalMode.ON_REQUEST,
          sandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
          timeout: 30000,
        },
      };

      // 保存配置
      await persister.saveConfig(testSession);

      // 验证文件已创建
      const exists = await persister.configExists();
      expect(exists).toBe(true);

      // 读取配置
      const loadedSession = await persister.loadConfig();

      // 验证字段一致性
      expect(loadedSession.conversationId).toBe(testSession.conversationId);
      expect(loadedSession.sessionName).toBe(testSession.sessionName);
      expect(loadedSession.jobId).toBe(testSession.jobId);
      expect(loadedSession.createdAt).toEqual(testSession.createdAt);
      expect(loadedSession.rolloutRef).toBe(testSession.rolloutRef);
      expect(loadedSession.processId).toBe(testSession.processId);
      expect(loadedSession.config).toEqual(testSession.config);
    });

    it('应该正确序列化和反序列化 Date 对象', async () => {
      const testSession: Session = {
        conversationId: uuidv4(),
        sessionName: 'date-test',
        jobId: uuidv4(),
        createdAt: new Date('2025-03-15T14:30:00.500Z'),
        sessionDir,
        rolloutRef: '/path/to/rollout.json',
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-sonnet',
          cwd: '/test',
          approvalPolicy: ApprovalMode.UNTRUSTED,
          sandboxPolicy: SandboxPolicy.READ_ONLY,
          timeout: 60000,
        },
      };

      await persister.saveConfig(testSession);

      // 验证 JSON 文件中的时间格式
      const configFilePath = persister.getConfigFilePath();
      const rawContent = await fs.readFile(configFilePath, 'utf-8');
      const parsed = JSON.parse(rawContent);

      expect(parsed.createdAt).toBe('2025-03-15T14:30:00.500Z');

      // 验证读取后的 Date 对象
      const loadedSession = await persister.loadConfig();
      expect(loadedSession.createdAt).toBeInstanceOf(Date);
      expect(loadedSession.createdAt.toISOString()).toBe('2025-03-15T14:30:00.500Z');
    });

    it('应该支持可选的 processId 字段', async () => {
      const testSession: Session = {
        conversationId: uuidv4(),
        sessionName: 'no-process',
        jobId: uuidv4(),
        createdAt: new Date(),
        sessionDir,
        rolloutRef: '/path/to/rollout.json',
        processId: undefined, // 可选字段
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-haiku',
          cwd: '/test',
          approvalPolicy: ApprovalMode.ON_REQUEST,
          sandboxPolicy: SandboxPolicy.READ_ONLY,
          timeout: 15000,
        },
      };

      await persister.saveConfig(testSession);
      const loadedSession = await persister.loadConfig();

      expect(loadedSession.processId).toBeUndefined();
    });
  });

  describe('原子写入', () => {
    it('应该使用原子写入机制 (临时文件+重命名)', async () => {
      const testSession: Session = {
        conversationId: uuidv4(),
        sessionName: 'atomic-test',
        jobId: uuidv4(),
        createdAt: new Date(),
        sessionDir,
        rolloutRef: '/path/to/rollout.json',
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-opus',
          cwd: '/test',
          approvalPolicy: ApprovalMode.ON_REQUEST,
          sandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
          timeout: 30000,
        },
      };

      // 保存配置 (应该使用原子写入)
      await persister.saveConfig(testSession);

      // 验证没有残留的临时文件
      const files = await fs.readdir(sessionDir);
      const tempFiles = files.filter((f) => f.includes('.tmp.'));
      expect(tempFiles).toHaveLength(0);

      // 验证配置文件存在且可读取
      const loadedSession = await persister.loadConfig();
      expect(loadedSession.sessionName).toBe('atomic-test');
    });

    it('应该支持禁用原子写入 (直接写入)', async () => {
      // 创建不使用原子写入的持久化器
      const nonAtomicPersister = createConfigPersister({
        sessionDir,
        configFileName: 'non-atomic-config.json',
        atomicWrite: false,
      });

      const testSession: Session = {
        conversationId: uuidv4(),
        sessionName: 'non-atomic-test',
        jobId: uuidv4(),
        createdAt: new Date(),
        sessionDir,
        rolloutRef: '/path/to/rollout.json',
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-haiku',
          cwd: '/test',
          approvalPolicy: ApprovalMode.NEVER,
          sandboxPolicy: SandboxPolicy.DANGER_FULL_ACCESS,
          timeout: 15000,
        },
      };

      // 保存配置 (直接写入)
      await nonAtomicPersister.saveConfig(testSession);

      // 验证配置文件存在
      const configPath = nonAtomicPersister.getConfigFilePath();
      const exists = await fs
        .access(configPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('配置验证', () => {
    it('应该拒绝无效的会话配置 (保存时)', async () => {
      const invalidSession = {
        conversationId: 'invalid-not-uuid', // ❌ 不是有效的 UUID
        sessionName: 'invalid-test',
        jobId: uuidv4(),
        createdAt: new Date(),
        sessionDir,
        rolloutRef: '/path/to/rollout.json',
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-opus',
          cwd: '/test',
          approvalPolicy: ApprovalMode.ON_REQUEST,
          sandboxPolicy: SandboxPolicy.READ_ONLY,
          timeout: 30000,
        },
      } as Session;

      // 应该抛出验证错误
      await expect(persister.saveConfig(invalidSession)).rejects.toThrow(
        'Invalid session config format'
      );
    });

    it('应该拒绝无效的会话配置 (读取时)', async () => {
      // 手动写入无效的配置文件
      const invalidConfig = {
        conversationId: uuidv4(),
        sessionName: 'invalid-read',
        jobId: 'not-a-uuid', // ❌ 不是有效的 UUID
        createdAt: new Date().toISOString(),
        rolloutRef: '/path/to/rollout.json',
        config: {
          model: 'claude-3-opus',
          cwd: '/test',
          approvalPolicy: 'invalid-mode', // ❌ 无效的审批模式
          sandboxPolicy: SandboxPolicy.READ_ONLY,
          timeout: 30000,
        },
      };

      const configPath = persister.getConfigFilePath();
      await fs.writeFile(configPath, JSON.stringify(invalidConfig, null, 2), 'utf-8');

      // 应该抛出验证错误
      await expect(persister.loadConfig()).rejects.toThrow(
        'Invalid session config format'
      );
    });

    it('应该允许跳过验证以提高性能', async () => {
      // 创建不验证配置的持久化器
      const noValidatePersister = createConfigPersister({
        sessionDir,
        configFileName: 'no-validate.json',
        validateConfig: false,
      });

      // 故意创建一个类型不完全匹配的配置 (但结构正确)
      const testSession = {
        conversationId: uuidv4(),
        sessionName: 'no-validate',
        jobId: uuidv4(),
        createdAt: new Date(),
        sessionDir,
        rolloutRef: '/path/to/rollout.json',
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-opus',
          cwd: '/test',
          approvalPolicy: ApprovalMode.ON_REQUEST,
          sandboxPolicy: SandboxPolicy.READ_ONLY,
          timeout: 30000,
        },
      } as Session;

      // 应该成功 (不验证)
      await expect(noValidatePersister.saveConfig(testSession)).resolves.not.toThrow();
    });
  });

  describe('文件操作', () => {
    it('应该正确检查配置文件是否存在', async () => {
      // 初始状态: 不存在
      expect(await persister.configExists()).toBe(false);

      // 保存配置后: 存在
      const testSession: Session = {
        conversationId: uuidv4(),
        sessionName: 'exists-test',
        jobId: uuidv4(),
        createdAt: new Date(),
        sessionDir,
        rolloutRef: '/path/to/rollout.json',
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-opus',
          cwd: '/test',
          approvalPolicy: ApprovalMode.ON_REQUEST,
          sandboxPolicy: SandboxPolicy.READ_ONLY,
          timeout: 30000,
        },
      };

      await persister.saveConfig(testSession);
      expect(await persister.configExists()).toBe(true);
    });

    it('应该正确删除配置文件', async () => {
      // 先创建配置
      const testSession: Session = {
        conversationId: uuidv4(),
        sessionName: 'delete-test',
        jobId: uuidv4(),
        createdAt: new Date(),
        sessionDir,
        rolloutRef: '/path/to/rollout.json',
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-opus',
          cwd: '/test',
          approvalPolicy: ApprovalMode.ON_REQUEST,
          sandboxPolicy: SandboxPolicy.READ_ONLY,
          timeout: 30000,
        },
      };

      await persister.saveConfig(testSession);
      expect(await persister.configExists()).toBe(true);

      // 删除配置
      await persister.deleteConfig();
      expect(await persister.configExists()).toBe(false);
    });

    it('应该处理删除不存在的配置文件 (不抛出错误)', async () => {
      // 删除不存在的文件应该成功 (不抛出错误)
      await expect(persister.deleteConfig()).resolves.not.toThrow();
    });

    it('应该在读取不存在的配置文件时抛出错误', async () => {
      await expect(persister.loadConfig()).rejects.toThrow('Config file not found');
    });
  });

  describe('Rollout 引用管理', () => {
    it('应该成功更新 rollout 引用', async () => {
      // 先保存初始配置
      const testSession: Session = {
        conversationId: uuidv4(),
        sessionName: 'rollout-test',
        jobId: uuidv4(),
        createdAt: new Date(),
        sessionDir,
        rolloutRef: '/initial/rollout.json',
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-opus',
          cwd: '/test',
          approvalPolicy: ApprovalMode.ON_REQUEST,
          sandboxPolicy: SandboxPolicy.READ_ONLY,
          timeout: 30000,
        },
      };

      await persister.saveConfig(testSession);

      // 更新 rollout 引用
      const newRolloutPath = '/updated/rollout.json';
      await persister.updateRolloutRef(newRolloutPath);

      // 验证更新成功
      const loadedSession = await persister.loadConfig();
      expect(loadedSession.rolloutRef).toBe(newRolloutPath);
    });

    it('应该保存和读取独立的 rollout 引用文件', async () => {
      const rolloutPath = '/path/to/codex-rollout.json';

      // 保存 rollout 引用
      await saveRolloutRef(sessionDir, rolloutPath);

      // 验证文件已创建
      const rolloutRefPath = path.join(sessionDir, 'rollout-ref.txt');
      const exists = await fs
        .access(rolloutRefPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // 读取 rollout 引用
      const loadedPath = await loadRolloutRef(sessionDir);
      expect(loadedPath).toBe(rolloutPath);
    });

    it('应该处理不存在的 rollout 引用文件', async () => {
      await expect(loadRolloutRef(sessionDir)).rejects.toThrow(
        'Rollout reference file not found'
      );
    });
  });

  describe('边缘情况', () => {
    it('应该处理无效的 JSON 格式', async () => {
      // 手动写入无效的 JSON
      const configPath = persister.getConfigFilePath();
      await fs.writeFile(configPath, 'invalid json content', 'utf-8');

      // 应该抛出 JSON 解析错误
      await expect(persister.loadConfig()).rejects.toThrow();
    });

    it('应该在会话目录不存在时自动创建', async () => {
      // 创建一个指向不存在目录的持久化器
      const nonExistentDir = path.join(testSessionsDir, 'auto-create-dir');
      const newPersister = createConfigPersister({
        sessionDir: nonExistentDir,
      });

      const testSession: Session = {
        conversationId: uuidv4(),
        sessionName: 'auto-create-test',
        jobId: uuidv4(),
        createdAt: new Date(),
        sessionDir: nonExistentDir,
        rolloutRef: '/path/to/rollout.json',
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-opus',
          cwd: '/test',
          approvalPolicy: ApprovalMode.ON_REQUEST,
          sandboxPolicy: SandboxPolicy.READ_ONLY,
          timeout: 30000,
        },
      };

      // 保存配置时应该自动创建目录
      await expect(newPersister.saveConfig(testSession)).resolves.not.toThrow();

      // 验证目录已创建
      const dirExists = await fs
        .access(nonExistentDir)
        .then(() => true)
        .catch(() => false);
      expect(dirExists).toBe(true);
    });

    it('应该正确处理包含特殊字符的路径', async () => {
      const testSession: Session = {
        conversationId: uuidv4(),
        sessionName: 'special-chars',
        jobId: uuidv4(),
        createdAt: new Date(),
        sessionDir,
        rolloutRef: '/path/with spaces/and-special@chars#test.json',
        status: SessionStatus.ACTIVE,
        config: {
          model: 'claude-3-opus',
          cwd: '/workspace/中文路径/test',
          approvalPolicy: ApprovalMode.ON_REQUEST,
          sandboxPolicy: SandboxPolicy.READ_ONLY,
          timeout: 30000,
        },
      };

      await persister.saveConfig(testSession);
      const loadedSession = await persister.loadConfig();

      expect(loadedSession.rolloutRef).toBe('/path/with spaces/and-special@chars#test.json');
      expect(loadedSession.config.cwd).toBe('/workspace/中文路径/test');
    });
  });

  describe('工厂函数', () => {
    it('应该通过工厂函数创建 ConfigPersister', () => {
      const persister = createConfigPersister({
        sessionDir,
        configFileName: 'factory-test.json',
      });

      expect(persister).toBeInstanceOf(ConfigPersister);
      expect(persister.getConfigFilePath()).toContain('factory-test.json');
    });

    it('应该使用默认配置选项', () => {
      const persister = createConfigPersister({
        sessionDir,
      });

      // 默认文件名应该是 config.json
      expect(persister.getConfigFilePath()).toContain('config.json');
    });
  });
});