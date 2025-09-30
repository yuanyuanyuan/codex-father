/**
 * Config Persister - 配置持久化器
 *
 * 负责会话配置的读写操作
 * 参考: specs/005-docs-prd-draft/data-model.md:87-138
 *
 * 设计原则:
 * - 单一职责: 仅负责配置文件的读写
 * - 类型安全: 使用 Zod 验证配置格式
 * - 原子性: 使用临时文件+重命名确保写入原子性
 *
 * 持久化格式:
 * - 路径: sessions/<session-name>-<date>/config.json
 * - 格式: JSON
 * - 包含: model, cwd, approvalPolicy, sandboxPolicy, timeout
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import {
  Session,
  SessionSchema,
  SessionStatus,
  ApprovalMode,
  SandboxPolicy,
} from '../lib/types.js';

/**
 * 会话配置 (持久化到 config.json 的部分)
 */
export interface SessionConfig {
  conversationId: string; // Codex 会话 ID
  sessionName: string; // 用户友好的名称
  jobId: string; // 关联的作业 ID
  createdAt: string; // 创建时间 (ISO 字符串)
  rolloutRef: string; // Codex rollout 文件路径
  processId?: number; // 关联的进程 PID (MVP2)
  config: {
    model: string;
    cwd: string;
    approvalPolicy: ApprovalMode;
    sandboxPolicy: SandboxPolicy;
    timeout: number;
  };
}

/**
 * 配置持久化器配置
 */
export interface ConfigPersisterConfig {
  sessionDir: string; // 会话目录路径
  configFileName?: string; // 配置文件名 (默认: config.json)
  validateConfig?: boolean; // 是否验证配置格式 (默认: true)
  atomicWrite?: boolean; // 是否使用原子写入 (默认: true)
}

/**
 * 配置持久化器
 *
 * 职责 (Single Responsibility):
 * - 将会话配置保存到 JSON 文件
 * - 从 JSON 文件读取会话配置
 * - 验证配置格式
 */
export class ConfigPersister {
  private configFilePath: string;
  private config: Required<ConfigPersisterConfig>;

  constructor(config: ConfigPersisterConfig) {
    this.config = {
      sessionDir: config.sessionDir,
      configFileName: config.configFileName || 'config.json',
      validateConfig: config.validateConfig ?? true,
      atomicWrite: config.atomicWrite ?? true,
    };

    this.configFilePath = path.join(
      this.config.sessionDir,
      this.config.configFileName
    );
  }

  /**
   * 保存会话配置到文件
   *
   * @param session 会话对象
   */
  async saveConfig(session: Session): Promise<void> {
    // 验证配置格式 (如果启用)
    if (this.config.validateConfig) {
      const result = SessionSchema.safeParse(session);
      if (!result.success) {
        throw new Error(
          `Invalid session config format: ${JSON.stringify(result.error.errors)}`
        );
      }
    }

    // 确保目录存在
    await this.ensureSessionDirExists();

    // 序列化为 JSON (日期对象转换为 ISO 字符串)
    const configData: SessionConfig = {
      conversationId: session.conversationId,
      sessionName: session.sessionName,
      jobId: session.jobId,
      createdAt: session.createdAt.toISOString(),
      rolloutRef: session.rolloutRef,
      processId: session.processId,
      config: session.config,
    };

    const jsonContent = JSON.stringify(configData, null, 2);

    // 原子写入 (使用临时文件+重命名)
    if (this.config.atomicWrite) {
      await this.atomicWriteFile(this.configFilePath, jsonContent);
    } else {
      await fs.writeFile(this.configFilePath, jsonContent, 'utf-8');
    }
  }

  /**
   * 从文件读取会话配置
   *
   * @returns Session 对象
   */
  async loadConfig(): Promise<Session> {
    try {
      const content = await fs.readFile(this.configFilePath, 'utf-8');
      const parsed: SessionConfig = JSON.parse(content);

      // 转换为 Session 对象 (ISO 字符串转换为 Date 对象)
      const session: Session = {
        conversationId: parsed.conversationId,
        sessionName: parsed.sessionName,
        jobId: parsed.jobId,
        createdAt: new Date(parsed.createdAt),
        sessionDir: this.config.sessionDir,
        rolloutRef: parsed.rolloutRef,
        processId: parsed.processId,
        status: this.inferSessionStatus(parsed),
        config: parsed.config,
      };

      // 验证配置格式 (如果启用)
      if (this.config.validateConfig) {
        const result = SessionSchema.safeParse(session);
        if (!result.success) {
          throw new Error(
            `Invalid session config format: ${JSON.stringify(result.error.errors)}`
          );
        }
      }

      return session;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Config file not found: ${this.configFilePath}`);
      }
      throw error;
    }
  }

  /**
   * 检查配置文件是否存在
   */
  async configExists(): Promise<boolean> {
    try {
      await fs.access(this.configFilePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 删除配置文件 (危险操作,仅用于测试或清理)
   */
  async deleteConfig(): Promise<void> {
    try {
      await fs.unlink(this.configFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * 更新 rollout 引用
   *
   * @param rolloutPath Codex rollout 文件路径
   */
  async updateRolloutRef(rolloutPath: string): Promise<void> {
    const session = await this.loadConfig();
    session.rolloutRef = rolloutPath;
    await this.saveConfig(session);
  }

  /**
   * 获取配置文件路径
   */
  getConfigFilePath(): string {
    return this.configFilePath;
  }

  /**
   * 原子写入文件 (私有方法)
   *
   * 使用临时文件+重命名确保写入的原子性
   * 即使写入过程中断,也不会损坏原有文件
   */
  private async atomicWriteFile(
    filePath: string,
    content: string
  ): Promise<void> {
    const tempFilePath = `${filePath}.tmp.${Date.now()}`;

    try {
      // 写入临时文件
      await fs.writeFile(tempFilePath, content, 'utf-8');

      // 重命名临时文件 (原子操作)
      await fs.rename(tempFilePath, filePath);
    } catch (error) {
      // 清理临时文件 (如果存在)
      try {
        await fs.unlink(tempFilePath);
      } catch {
        // 忽略清理错误
      }
      throw error;
    }
  }

  /**
   * 确保会话目录存在
   */
  private async ensureSessionDirExists(): Promise<void> {
    try {
      await fs.mkdir(this.config.sessionDir, { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * 推断会话状态 (从持久化的配置中)
   *
   * 注意: 实际状态应该从事件日志中恢复,这里只是提供一个默认值
   */
  private inferSessionStatus(config: SessionConfig): Session['status'] {
    // 默认假设会话已终止 (实际状态需要从事件日志恢复)
    return SessionStatus.TERMINATED;
  }
}

/**
 * 创建配置持久化器的工厂函数
 *
 * @param config 配置对象
 * @returns ConfigPersister 实例
 */
export function createConfigPersister(
  config: ConfigPersisterConfig
): ConfigPersister {
  return new ConfigPersister(config);
}

/**
 * 保存 rollout 引用到单独的文件
 *
 * 用途: 记录 Codex 原生 rollout 文件路径,用于会话恢复 (MVP2)
 * 路径: sessions/<session-name>-<date>/rollout-ref.txt
 */
export async function saveRolloutRef(
  sessionDir: string,
  rolloutPath: string
): Promise<void> {
  const rolloutRefPath = path.join(sessionDir, 'rollout-ref.txt');

  // 确保目录存在
  await fs.mkdir(sessionDir, { recursive: true });

  // 写入 rollout 路径
  await fs.writeFile(rolloutRefPath, rolloutPath, 'utf-8');
}

/**
 * 读取 rollout 引用
 */
export async function loadRolloutRef(sessionDir: string): Promise<string> {
  const rolloutRefPath = path.join(sessionDir, 'rollout-ref.txt');

  try {
    const content = await fs.readFile(rolloutRefPath, 'utf-8');
    return content.trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Rollout reference file not found: ${rolloutRefPath}`);
    }
    throw error;
  }
}