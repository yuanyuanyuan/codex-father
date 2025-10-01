/**
 * Terminal UI Unit Tests - 审批终端 UI 单元测试
 *
 * 测试覆盖:
 * - 审批请求显示 (exec-command, apply-patch)
 * - 用户决策收集 (allow, deny, whitelist)
 * - 批量审批流程
 * - 超时处理
 * - 配置管理
 * - 工厂函数
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import inquirer from 'inquirer';
import { v4 as uuidv4 } from 'uuid';
import { TerminalUI, createTerminalUI, promptApproval } from '../terminal-ui.js';
import type { ApprovalRequest } from '../../lib/types.js';

describe('TerminalUI', () => {
  let ui: TerminalUI;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // 创建默认 UI 实例
    ui = createTerminalUI({
      showTimestamp: true,
      showCwd: true,
    });

    // 监听 console.log (用于验证输出)
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    // 清理所有 mock
    vi.restoreAllMocks();
  });

  describe('基本功能', () => {
    it('应该创建 TerminalUI 实例', () => {
      expect(ui).toBeInstanceOf(TerminalUI);
    });

    it('应该使用默认配置', () => {
      const defaultUI = createTerminalUI();
      const config = defaultUI.getConfig();

      expect(config.showTimestamp).toBe(true);
      expect(config.showCwd).toBe(true);
      expect(config.timeout).toBeUndefined();
    });

    it('应该使用自定义配置', () => {
      const customUI = createTerminalUI({
        showTimestamp: false,
        showCwd: false,
        timeout: 5000,
      });

      const config = customUI.getConfig();
      expect(config.showTimestamp).toBe(false);
      expect(config.showCwd).toBe(false);
      expect(config.timeout).toBe(5000);
    });
  });

  describe('exec-command 审批请求显示', () => {
    it('应该显示 exec-command 审批请求的完整信息', async () => {
      // Mock inquirer 响应
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date('2025-01-01T10:00:00Z'),
        status: 'pending',
        details: {
          command: 'npm install',
          cwd: '/workspace/project',
          reason: 'Installing dependencies',
        },
      };

      await ui.promptApproval(request);

      // 验证显示了审批标题
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Approval Required'));

      // 验证显示了 Request ID
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(request.requestId));

      // 验证显示了时间戳
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Timestamp'));

      // 验证显示了工作目录
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('/workspace/project'));

      // 验证显示了命令
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('npm install'));

      // 验证显示了原因
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Installing dependencies')
      );
    });

    it('应该隐藏时间戳 (showTimestamp: false)', async () => {
      ui.updateConfig({ showTimestamp: false });
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: {
          command: 'ls',
        },
      };

      await ui.promptApproval(request);

      // 验证没有显示时间戳
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Timestamp'));
    });

    it('应该隐藏工作目录 (showCwd: false)', async () => {
      ui.updateConfig({ showCwd: false });
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: {
          command: 'ls',
          cwd: '/workspace',
        },
      };

      await ui.promptApproval(request);

      // 验证没有显示工作目录
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Working Dir'));
    });

    it('应该处理没有 cwd 的请求', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: {
          command: 'echo test',
        },
      };

      await ui.promptApproval(request);

      // 不应该抛出错误
      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it('应该处理没有 reason 的请求', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: {
          command: 'ls',
          cwd: '/workspace',
        },
      };

      await ui.promptApproval(request);

      // 验证没有显示 Reason
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Reason'));
    });
  });

  describe('apply-patch 审批请求显示', () => {
    it('应该显示 apply-patch 审批请求的文件变更', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'apply-patch',
        createdAt: new Date(),
        status: 'pending',
        details: {
          fileChanges: [
            { type: 'create', path: '/src/new-file.ts' },
            { type: 'modify', path: '/src/existing.ts' },
            { type: 'delete', path: '/src/old-file.ts' },
          ],
        },
      };

      await ui.promptApproval(request);

      // 验证显示了文件变更数量
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('File Changes (3)'));

      // 验证显示了文件路径和类型
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[create] /src/new-file.ts')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[modify] /src/existing.ts')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[delete] /src/old-file.ts')
      );
    });

    it('应该限制最多显示 5 个文件变更', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const fileChanges = Array.from({ length: 10 }, (_, i) => ({
        type: 'create' as const,
        path: `/src/file${i}.ts`,
      }));

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'apply-patch',
        createdAt: new Date(),
        status: 'pending',
        details: { fileChanges },
      };

      await ui.promptApproval(request);

      // 验证显示了总数
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('File Changes (10)'));

      // 验证显示了省略提示
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('and 5 more files'));
    });

    it('应该处理少于 5 个文件的情况', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'apply-patch',
        createdAt: new Date(),
        status: 'pending',
        details: {
          fileChanges: [
            { type: 'create', path: '/src/file1.ts' },
            { type: 'modify', path: '/src/file2.ts' },
          ],
        },
      };

      await ui.promptApproval(request);

      // 验证没有显示省略提示
      expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('more files'));
    });
  });

  describe('用户决策收集', () => {
    it('应该收集 allow 决策', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: { command: 'ls' },
      };

      const decision = await ui.promptApproval(request);

      expect(decision).toBe('allow');

      // 验证显示了决策结果
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Approved'));
    });

    it('应该收集 deny 决策', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'deny' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: { command: 'rm -rf /' },
      };

      const decision = await ui.promptApproval(request);

      expect(decision).toBe('deny');

      // 验证显示了决策结果
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Denied'));
    });

    it('应该收集 whitelist 决策', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'whitelist' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: { command: 'git status' },
      };

      const decision = await ui.promptApproval(request);

      expect(decision).toBe('whitelist');

      // 验证显示了决策结果
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Whitelisted'));
    });

    it('应该传递正确的 inquirer 选项', async () => {
      const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: { command: 'ls' },
      };

      await ui.promptApproval(request);

      // 验证 inquirer.prompt 被调用
      expect(promptSpy).toHaveBeenCalled();

      // 获取传递给 inquirer 的选项
      const promptOptions = promptSpy.mock.calls[0][0];
      expect(promptOptions).toEqual([
        {
          type: 'list',
          name: 'decision',
          message: 'What would you like to do?',
          choices: [
            {
              name: '✅ Approve - 批准此次操作',
              value: 'allow',
              short: 'Approve',
            },
            {
              name: '❌ Deny - 拒绝此次操作',
              value: 'deny',
              short: 'Deny',
            },
            {
              name: '⏭️  Whitelist - 批准并添加到白名单',
              value: 'whitelist',
              short: 'Whitelist',
            },
          ],
          default: 'deny',
        },
      ]);
    });
  });

  describe('批量审批', () => {
    it('应该批量处理多个审批请求', async () => {
      // Mock 三个连续的审批决策
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ decision: 'allow' })
        .mockResolvedValueOnce({ decision: 'whitelist' })
        .mockResolvedValueOnce({ decision: 'deny' })
        .mockResolvedValueOnce({ continueProcessing: false });

      const requests: ApprovalRequest[] = [
        {
          requestId: uuidv4(),
          type: 'exec-command',
          createdAt: new Date(),
          status: 'pending',
          details: { command: 'ls' },
        },
        {
          requestId: uuidv4(),
          type: 'exec-command',
          createdAt: new Date(),
          status: 'pending',
          details: { command: 'pwd' },
        },
        {
          requestId: uuidv4(),
          type: 'exec-command',
          createdAt: new Date(),
          status: 'pending',
          details: { command: 'rm file.txt' },
        },
      ];

      const decisions = await ui.promptBatchApproval(requests);

      // 验证返回了所有决策
      expect(decisions).toEqual(['allow', 'whitelist', 'deny']);
    });

    it('应该在拒绝后询问是否继续', async () => {
      const promptSpy = vi
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ decision: 'deny' })
        .mockResolvedValueOnce({ continueProcessing: true })
        .mockResolvedValueOnce({ decision: 'allow' });

      const requests: ApprovalRequest[] = [
        {
          requestId: uuidv4(),
          type: 'exec-command',
          createdAt: new Date(),
          status: 'pending',
          details: { command: 'rm file.txt' },
        },
        {
          requestId: uuidv4(),
          type: 'exec-command',
          createdAt: new Date(),
          status: 'pending',
          details: { command: 'ls' },
        },
      ];

      await ui.promptBatchApproval(requests);

      // 验证询问了是否继续
      expect(promptSpy).toHaveBeenCalledWith([
        {
          type: 'confirm',
          name: 'continueProcessing',
          message: 'Continue processing remaining approvals?',
          default: false,
        },
      ]);
    });

    it('应该在用户选择不继续时停止批处理', async () => {
      vi.spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ decision: 'deny' })
        .mockResolvedValueOnce({ continueProcessing: false });

      const requests: ApprovalRequest[] = [
        {
          requestId: uuidv4(),
          type: 'exec-command',
          createdAt: new Date(),
          status: 'pending',
          details: { command: 'rm file.txt' },
        },
        {
          requestId: uuidv4(),
          type: 'exec-command',
          createdAt: new Date(),
          status: 'pending',
          details: { command: 'ls' },
        },
        {
          requestId: uuidv4(),
          type: 'exec-command',
          createdAt: new Date(),
          status: 'pending',
          details: { command: 'pwd' },
        },
      ];

      const decisions = await ui.promptBatchApproval(requests);

      // 验证只处理了第一个请求
      expect(decisions).toHaveLength(1);
      expect(decisions[0]).toBe('deny');
    });

    it('应该在批准时不询问是否继续', async () => {
      const promptSpy = vi
        .spyOn(inquirer, 'prompt')
        .mockResolvedValueOnce({ decision: 'allow' })
        .mockResolvedValueOnce({ decision: 'allow' });

      const requests: ApprovalRequest[] = [
        {
          requestId: uuidv4(),
          type: 'exec-command',
          createdAt: new Date(),
          status: 'pending',
          details: { command: 'ls' },
        },
        {
          requestId: uuidv4(),
          type: 'exec-command',
          createdAt: new Date(),
          status: 'pending',
          details: { command: 'pwd' },
        },
      ];

      await ui.promptBatchApproval(requests);

      // 验证 prompt 只被调用了 2 次 (没有 continueProcessing)
      expect(promptSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('超时处理', () => {
    it('应该在超时时拒绝审批', async () => {
      const timeoutUI = createTerminalUI({ timeout: 100 });

      // Mock inquirer 延迟响应
      vi.spyOn(inquirer, 'prompt').mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ decision: 'allow' }), 500);
          })
      );

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: { command: 'sleep 10' },
      };

      // 验证超时抛出错误
      await expect(timeoutUI.promptApproval(request)).rejects.toThrow(
        'Approval timeout after 100ms'
      );

      // 验证显示了超时消息
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Approval timeout (100ms)')
      );
    }, 1000);

    it('应该在超时前正常返回决策', async () => {
      const timeoutUI = createTerminalUI({ timeout: 1000 });

      // Mock inquirer 快速响应
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: { command: 'ls' },
      };

      const decision = await timeoutUI.promptApproval(request);

      expect(decision).toBe('allow');
    });

    it('应该在没有超时配置时无限等待', async () => {
      const noTimeoutUI = createTerminalUI({ timeout: undefined });

      // Mock inquirer 延迟响应
      vi.spyOn(inquirer, 'prompt').mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ decision: 'allow' }), 200);
          })
      );

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: { command: 'ls' },
      };

      // 应该正常等待并返回决策
      const decision = await noTimeoutUI.promptApproval(request);
      expect(decision).toBe('allow');
    }, 500);
  });

  describe('配置管理', () => {
    it('应该更新配置', () => {
      const ui = createTerminalUI({
        showTimestamp: true,
        showCwd: true,
      });

      ui.updateConfig({
        showTimestamp: false,
        timeout: 5000,
      });

      const config = ui.getConfig();

      expect(config.showTimestamp).toBe(false);
      expect(config.showCwd).toBe(true); // 未修改
      expect(config.timeout).toBe(5000);
    });

    it('应该获取当前配置', () => {
      const ui = createTerminalUI({
        showTimestamp: false,
        showCwd: false,
        timeout: 3000,
      });

      const config = ui.getConfig();

      expect(config).toEqual({
        showTimestamp: false,
        showCwd: false,
        timeout: 3000,
      });
    });

    it('应该返回配置的副本 (不影响内部状态)', () => {
      const ui = createTerminalUI();

      const config1 = ui.getConfig();
      config1.showTimestamp = false; // 修改副本

      const config2 = ui.getConfig();

      // 内部配置不应该被修改
      expect(config2.showTimestamp).toBe(true);
    });
  });

  describe('工厂函数', () => {
    it('应该通过 createTerminalUI 创建实例', () => {
      const ui = createTerminalUI();
      expect(ui).toBeInstanceOf(TerminalUI);
    });

    it('应该通过 promptApproval 简化单次审批', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: { command: 'ls' },
      };

      const decision = await promptApproval(request);

      expect(decision).toBe('allow');
    });
  });

  describe('边缘情况', () => {
    it('应该处理空的审批请求细节', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: {
          command: '',
        },
      };

      // 不应该抛出错误
      await expect(ui.promptApproval(request)).resolves.toBe('allow');
    });

    it('应该处理包含特殊字符的命令', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'exec-command',
        createdAt: new Date(),
        status: 'pending',
        details: {
          command: 'echo "Hello\nWorld" | grep "World"',
          cwd: '/path/with spaces/项目',
        },
      };

      const decision = await ui.promptApproval(request);
      expect(decision).toBe('allow');

      // 验证显示了命令
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('echo "Hello'));
    });

    it('应该处理空的文件变更列表', async () => {
      vi.spyOn(inquirer, 'prompt').mockResolvedValue({ decision: 'allow' });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        type: 'apply-patch',
        createdAt: new Date(),
        status: 'pending',
        details: {
          fileChanges: [],
        },
      };

      // 不应该抛出错误
      await expect(ui.promptApproval(request)).resolves.toBe('allow');

      // 验证显示了文件变更数量 (0)
      expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('File Changes (0)'));
    });

    it('应该处理批量审批空数组', async () => {
      const decisions = await ui.promptBatchApproval([]);

      expect(decisions).toEqual([]);
    });
  });
});
