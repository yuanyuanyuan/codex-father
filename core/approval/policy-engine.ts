/**
 * Policy Engine - 审批策略引擎
 *
 * 负责评估命令是否需要人工审批
 * 参考: specs/005-docs-prd-draft/data-model.md:401-458
 *
 * 设计原则:
 * - 单一职责: 仅负责审批决策逻辑
 * - 开闭原则: 可扩展白名单规则,无需修改代码
 * - 类型安全: 使用 Zod 验证配置格式
 *
 * 审批模式:
 * - untrusted: 所有操作需要审批(除非在白名单)
 * - on-request: Codex 明确请求时审批
 * - on-failure: 失败时审批
 * - never: 从不审批(危险)
 */

import { ApprovalMode, ApprovalPolicy, WhitelistRule, getDefaultWhitelist } from '../lib/types.js';

/**
 * 审批决策结果
 */
export interface ApprovalDecision {
  needsApproval: boolean; // 是否需要审批
  reason: string; // 决策原因
  matchedRule?: WhitelistRule; // 匹配的白名单规则(如果有)
}

/**
 * 审批策略引擎配置
 */
export interface PolicyEngineConfig {
  policy: ApprovalPolicy; // 审批策略
  strictMode?: boolean; // 严格模式(默认: true) - 解析失败时拒绝命令
}

/**
 * 审批策略引擎
 *
 * 职责 (Single Responsibility):
 * - 根据审批模式和白名单评估命令
 * - 决定是否需要人工审批
 * - 提供决策理由
 */
export class PolicyEngine {
  private policy: ApprovalPolicy;
  private strictMode: boolean;
  private whitelistPatterns: Array<{ rule: WhitelistRule; regex: RegExp }>;

  constructor(config: PolicyEngineConfig) {
    this.policy = config.policy;
    this.strictMode = config.strictMode ?? true;

    // 预编译白名单正则表达式
    this.whitelistPatterns = this.compileWhitelist(this.policy.whitelist);
  }

  /**
   * 评估命令是否需要审批
   *
   * @param command 待评估的命令字符串
   * @param isCodexRequest 是否为 Codex 明确请求的操作
   * @param isFailed 是否为失败后的操作
   * @returns 审批决策结果
   */
  evaluateCommand(
    command: string,
    options?: {
      isCodexRequest?: boolean; // Codex 明确请求审批
      isFailed?: boolean; // 失败后的操作
    }
  ): ApprovalDecision {
    const isCodexRequest = options?.isCodexRequest ?? false;
    const isFailed = options?.isFailed ?? false;

    // 1. 检查审批模式
    switch (this.policy.mode) {
      case ApprovalMode.NEVER:
        // 从不审批(危险模式)
        return {
          needsApproval: false,
          reason: 'Approval mode is NEVER (all commands auto-approved)',
        };

      case ApprovalMode.ON_FAILURE:
        // 仅失败时审批
        if (!isFailed) {
          return {
            needsApproval: false,
            reason: 'Approval mode is ON_FAILURE, and command has not failed',
          };
        }
        // 失败时继续检查白名单
        break;

      case ApprovalMode.ON_REQUEST:
        // Codex 请求时审批
        if (!isCodexRequest) {
          return {
            needsApproval: false,
            reason: 'Approval mode is ON_REQUEST, and Codex did not request approval',
          };
        }
        // Codex 请求时继续检查白名单
        break;

      case ApprovalMode.UNTRUSTED:
        // 所有操作需要审批(除非在白名单)
        // 继续检查白名单
        break;

      default:
        // 未知模式,严格模式下拒绝
        if (this.strictMode) {
          return {
            needsApproval: true,
            reason: `Unknown approval mode: ${this.policy.mode} (strict mode enabled)`,
          };
        }
        return {
          needsApproval: false,
          reason: `Unknown approval mode: ${this.policy.mode} (strict mode disabled)`,
        };
    }

    // 2. 检查白名单
    const matchedRule = this.matchWhitelist(command);
    if (matchedRule) {
      return {
        needsApproval: false,
        reason: `Matched whitelist rule: ${matchedRule.reason}`,
        matchedRule,
      };
    }

    // 3. 检查自动批准模式(如果配置)
    if (this.policy.autoApprovePatterns) {
      for (const pattern of this.policy.autoApprovePatterns) {
        if (pattern.test(command)) {
          return {
            needsApproval: false,
            reason: `Matched auto-approve pattern: ${pattern.source}`,
          };
        }
      }
    }

    // 4. 默认需要审批
    return {
      needsApproval: true,
      reason: this.getDefaultReason(),
    };
  }

  /**
   * 批量评估多个命令
   *
   * @param commands 命令列表
   * @param options 评估选项
   * @returns 决策结果列表
   */
  evaluateCommands(
    commands: string[],
    options?: {
      isCodexRequest?: boolean;
      isFailed?: boolean;
    }
  ): ApprovalDecision[] {
    return commands.map((command) => this.evaluateCommand(command, options));
  }

  /**
   * 检查命令是否在白名单中
   *
   * @param command 命令字符串
   * @returns 匹配的白名单规则,如果没有匹配则返回 undefined
   */
  private matchWhitelist(command: string): WhitelistRule | undefined {
    for (const { rule, regex } of this.whitelistPatterns) {
      if (rule.enabled && regex.test(command)) {
        return rule;
      }
    }
    return undefined;
  }

  /**
   * 预编译白名单正则表达式
   *
   * @param whitelist 白名单规则列表
   * @returns 编译后的正则表达式数组
   */
  private compileWhitelist(
    whitelist: WhitelistRule[]
  ): Array<{ rule: WhitelistRule; regex: RegExp }> {
    const compiled: Array<{ rule: WhitelistRule; regex: RegExp }> = [];

    for (const rule of whitelist) {
      try {
        const regex = new RegExp(rule.pattern);
        compiled.push({ rule, regex });
      } catch (error) {
        // 正则表达式解析失败,严格模式下抛出错误
        if (this.strictMode) {
          throw new Error(
            `Invalid regex pattern in whitelist: "${rule.pattern}" - ${(error as Error).message}`
          );
        }
        // 在非严格模式下静默忽略无效规则，防止噪声日志干扰测试输出
      }
    }

    return compiled;
  }

  /**
   * 获取默认拒绝原因
   */
  private getDefaultReason(): string {
    switch (this.policy.mode) {
      case ApprovalMode.UNTRUSTED:
        return 'Command not in whitelist (untrusted mode)';
      case ApprovalMode.ON_REQUEST:
        return 'Codex requested approval for this command';
      case ApprovalMode.ON_FAILURE:
        return 'Command failed and requires approval to retry';
      default:
        return 'Command requires approval';
    }
  }

  /**
   * 更新审批策略
   *
   * @param policy 新的审批策略
   */
  updatePolicy(policy: ApprovalPolicy): void {
    this.policy = policy;
    this.whitelistPatterns = this.compileWhitelist(policy.whitelist);
  }

  /**
   * 添加白名单规则
   *
   * @param rule 白名单规则
   */
  addWhitelistRule(rule: WhitelistRule): void {
    this.policy.whitelist.push(rule);
    // 重新编译白名单
    this.whitelistPatterns = this.compileWhitelist(this.policy.whitelist);
  }

  /**
   * 移除白名单规则
   *
   * @param pattern 正则表达式字符串
   * @returns 是否成功移除
   */
  removeWhitelistRule(pattern: string): boolean {
    const initialLength = this.policy.whitelist.length;
    this.policy.whitelist = this.policy.whitelist.filter((rule) => rule.pattern !== pattern);

    if (this.policy.whitelist.length < initialLength) {
      // 重新编译白名单
      this.whitelistPatterns = this.compileWhitelist(this.policy.whitelist);
      return true;
    }

    return false;
  }

  /**
   * 获取当前审批策略
   */
  getPolicy(): ApprovalPolicy {
    return { ...this.policy };
  }

  /**
   * 获取审批超时时间(毫秒)
   */
  getTimeout(): number | undefined {
    return this.policy.timeout;
  }
}

/**
 * 创建审批策略引擎的工厂函数
 *
 * @param config 配置对象
 * @returns PolicyEngine 实例
 */
export function createPolicyEngine(config: PolicyEngineConfig): PolicyEngine {
  return new PolicyEngine(config);
}

/**
 * 创建默认审批策略引擎
 *
 * @param mode 审批模式(默认: ON_REQUEST)
 * @returns PolicyEngine 实例
 */
export function createDefaultPolicyEngine(
  mode: ApprovalMode = ApprovalMode.ON_REQUEST
): PolicyEngine {
  return new PolicyEngine({
    policy: {
      mode,
      whitelist: getDefaultWhitelist(),
    },
    strictMode: true,
  });
}
