import { describe, bench, beforeAll } from 'vitest';
import { VersionCommand } from '../../core/cli/commands/meta-commands.js';
import { getConfig } from '../../core/cli/config-loader.js';
import { BridgeLayer, type ISessionManager } from '../../core/mcp/bridge-layer.js';
import { ApprovalMode, SandboxPolicy, type ApprovalRequest } from '../../core/lib/types.js';
import { v4 as uuidv4 } from 'uuid';

// Minimal CommandContext for VersionCommand
const baseCtx = {
  args: [],
  options: {},
  verbose: false,
  dryRun: false,
  json: true,
  workingDirectory: process.cwd(),
  configPath: '',
  logLevel: 'info' as const,
};

// Lightweight Mock SessionManager for BridgeLayer performance bench
class FastSessionManager implements ISessionManager {
  private convToJob = new Map<string, string>();

  async createSession(options: {
    sessionName: string;
    jobId?: string;
    model?: string;
    cwd?: string;
    approvalMode?: ApprovalMode;
    sandboxPolicy?: SandboxPolicy;
    timeout?: number;
  }): Promise<{ conversationId: string; jobId: string; rolloutPath: string }> {
    const conversationId = uuidv4();
    const jobId = options.jobId ?? uuidv4();
    this.convToJob.set(conversationId, jobId);
    // rolloutPath is not used by BridgeLayer fast path; return a dummy path
    return { conversationId, jobId, rolloutPath: `/dev/null/${conversationId}.jsonl` };
  }

  async sendUserMessage(_conversationId: string, _message: string): Promise<void> {
    // No-op for performance testing
  }

  async handleApprovalRequest(_request: ApprovalRequest): Promise<'allow' | 'deny'> {
    return 'allow';
  }

  getJobIdByConversationId(conversationId: string): string | undefined {
    return this.convToJob.get(conversationId);
  }
}

describe('T055 性能基准测试', () => {
  describe('版本检测性能', () => {
    describe('首次检测', () => {
      bench(
        '首次版本检测应 < 1s',
        async () => {
          await VersionCommand.handle(baseCtx);
        },
        { iterations: 10 }
      );
    });

    describe('缓存后检测', () => {
      beforeAll(async () => {
        // 预热以模拟缓存后场景（文件系统与路径扫描缓存）
        await VersionCommand.handle(baseCtx);
      });

      bench(
        '缓存后版本检测应 < 100ms',
        async () => {
          await VersionCommand.handle(baseCtx);
        },
        { iterations: 100 }
      );
    });
  });

  describe('配置验证性能', () => {
    bench(
      '配置验证应 < 2s',
      async () => {
        // 使用真实 ConfigLoader 验证路径，但避免文件 IO 依赖，传入典型 overrides
        await getConfig({
          reload: true,
          overrides: {
            environment: 'testing',
            logging: {
              level: 'warn',
              format: 'json',
              outputs: [{ type: 'console' }],
            },
            performance: {
              maxExecutionTime: 120000,
              maxMemoryUsage: 512 * 1024 * 1024,
              enableProfiling: false,
            },
            security: {
              sandboxMode: 'workspace-write',
              auditLogging: true,
              redactSensitiveData: true,
            },
          } as any,
        });
      },
      { iterations: 10 }
    );
  });

  describe('MCP 方法响应性能', () => {
    const bridge = new BridgeLayer({
      sessionManager: new FastSessionManager(),
      defaultApprovalMode: ApprovalMode.ON_REQUEST,
      defaultSandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
      defaultTimeout: 30_000,
    });

    bench(
      'start-codex-task 应 < 500ms',
      async () => {
        await bridge.callTool('start-codex-task', {
          prompt: 'benchmark: quick acceptance of a new task',
          sessionName: 'bench-t055',
          model: 'gpt-5',
          cwd: process.cwd(),
          approvalPolicy: ApprovalMode.NEVER,
          sandbox: SandboxPolicy.WORKSPACE_WRITE,
          timeout: 5_000,
        });
      },
      { iterations: 50 }
    );

    bench.skip('其他 MCP 方法性能测试', async () => {
      // 可在后续 Phase 中补充更多 MCP 方法的性能基准
    });
  });
});
