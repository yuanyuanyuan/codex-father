/**
 * Terminal UI - 审批终端 UI
 *
 * 负责终端交互式审批界面
 * 参考: specs/005-docs-prd-draft/research.md:325-366
 *
 * 设计原则:
 * - 单一职责: 仅负责终端 UI 交互
 * - 依赖倒置: 依赖抽象的审批请求接口
 * - 用户友好: 清晰的提示、快捷操作、实时反馈
 *
 * 审批选项:
 * - ✅ Approve: 批准此次操作
 * - ❌ Deny: 拒绝此次操作
 * - ⏭️ Whitelist: 批准并添加到白名单
 */

import inquirer from 'inquirer';
import { ApprovalRequest } from '../lib/types.js';

/**
 * 审批决策结果
 */
export type ApprovalDecision = 'allow' | 'deny' | 'whitelist';

/**
 * 审批终端 UI 配置
 */
export interface TerminalUIConfig {
  showTimestamp?: boolean; // 是否显示时间戳 (默认: true)
  showCwd?: boolean; // 是否显示工作目录 (默认: true)
  timeout?: number; // 审批超时时间(毫秒, undefined = 无限等待)
}

/**
 * 审批终端 UI
 *
 * 职责 (Single Responsibility):
 * - 显示审批请求详情
 * - 收集用户审批决策
 * - 处理超时情况
 */
export class TerminalUI {
  private config: { showTimestamp: boolean; showCwd: boolean; timeout?: number };

  constructor(config?: TerminalUIConfig) {
    this.config = {
      showTimestamp: config?.showTimestamp ?? true,
      showCwd: config?.showCwd ?? true,
      ...(typeof config?.timeout === 'number' ? { timeout: config.timeout } : {}),
    };
  }

  /**
   * 显示审批提示并等待用户决策
   *
   * @param request 审批请求
   * @returns 用户决策
   */
  async promptApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
    // 显示审批请求详情
    console.log('\n╭─────────────────────────────────────────────────────╮');
    console.log('│  🔐 Approval Required - 需要审批                    │');
    console.log('╰─────────────────────────────────────────────────────╯\n');

    // 显示请求 ID
    console.log(`📋 Request ID: ${request.requestId}`);

    // 显示时间戳
    if (this.config.showTimestamp) {
      console.log(
        `⏰ Timestamp:   ${request.createdAt.toLocaleString('zh-CN', {
          timeZone: 'Asia/Shanghai',
        })}`
      );
    }

    // 根据审批类型显示不同内容
    if (request.type === 'exec-command') {
      const details = request.details as import('../lib/types.js').ExecCommandApproval;

      // 显示工作目录
      if (this.config.showCwd && details.cwd) {
        console.log(`📁 Working Dir: ${details.cwd}`);
      }

      // 显示命令
      console.log(`\n💻 Command:\n   ${details.command}\n`);

      // 显示原因
      if (details.reason) {
        console.log(`📝 Reason: ${details.reason}\n`);
      }
    } else if (request.type === 'apply-patch') {
      const details = request.details as import('../lib/types.js').ApplyPatchApproval;

      // 显示文件变更
      console.log(`\n📝 File Changes (${details.fileChanges.length}):\n`);
      for (const change of details.fileChanges.slice(0, 5)) {
        // 最多显示 5 个
        console.log(`   [${change.type}] ${change.path}`);
      }
      if (details.fileChanges.length > 5) {
        console.log(`   ... and ${details.fileChanges.length - 5} more files\n`);
      } else {
        console.log('');
      }
    }

    // 使用 inquirer 收集用户决策
    const answer = await this.collectDecisionWithTimeout(request);

    return answer;
  }

  /**
   * 批量审批多个请求
   *
   * @param requests 审批请求数组
   * @returns 决策数组
   */
  async promptBatchApproval(requests: ApprovalRequest[]): Promise<ApprovalDecision[]> {
    const decisions: ApprovalDecision[] = [];

    for (const request of requests) {
      const decision = await this.promptApproval(request);
      decisions.push(decision);

      // 如果用户拒绝,询问是否继续批处理
      if (decision === 'deny') {
        const { continueProcessing } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continueProcessing',
            message: 'Continue processing remaining approvals?',
            default: false,
          },
        ]);

        if (!continueProcessing) {
          break;
        }
      }
    }

    return decisions;
  }

  /**
   * 收集用户决策（带超时）
   *
   * @param _request 审批请求 (保留参数以保持接口一致性)
   * @returns 用户决策
   */
  private async collectDecisionWithTimeout(_request: ApprovalRequest): Promise<ApprovalDecision> {
    // 如果没有超时限制,直接收集决策
    if (typeof this.config.timeout !== 'number') {
      return this.collectDecision();
    }

    // 使用 Promise.race 实现超时
    return Promise.race([this.collectDecision(), this.createTimeoutPromise(this.config.timeout)]);
  }

  /**
   * 收集用户决策
   *
   * @returns 用户决策
   */
  private async collectDecision(): Promise<ApprovalDecision> {
    const { decision } = await inquirer.prompt([
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
        default: 'deny', // 默认拒绝（安全优先）
      },
    ]);

    // 显示决策结果
    this.displayDecisionResult(decision);

    return decision;
  }

  /**
   * 创建超时 Promise
   *
   * @param timeout 超时时间(毫秒)
   * @returns 超时 Promise
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(`Approval timeout after ${timeout}ms`);
        console.log(`\n⏱️  Approval timeout (${timeout}ms) - 自动拒绝\n`);
        reject(error);
      }, timeout);
    });
  }

  /**
   * 显示决策结果
   *
   * @param decision 用户决策
   */
  private displayDecisionResult(decision: ApprovalDecision): void {
    console.log(''); // 空行

    switch (decision) {
      case 'allow':
        console.log('✅ Decision: Approved - 已批准');
        break;
      case 'deny':
        console.log('❌ Decision: Denied - 已拒绝');
        break;
      case 'whitelist':
        console.log('⏭️  Decision: Whitelisted - 已添加到白名单');
        break;
    }

    console.log(''); // 空行
  }

  /**
   * 更新配置
   *
   * @param config 新配置
   */
  updateConfig(config: Partial<TerminalUIConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): TerminalUIConfig {
    return { ...this.config };
  }
}

/**
 * 创建审批终端 UI 的工厂函数
 *
 * @param config UI 配置
 * @returns TerminalUI 实例
 */
export function createTerminalUI(config?: TerminalUIConfig): TerminalUI {
  return new TerminalUI(config);
}

/**
 * 简单的审批提示函数（无配置）
 *
 * @param request 审批请求
 * @returns 用户决策
 */
export async function promptApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
  const ui = createTerminalUI();
  return ui.promptApproval(request);
}
