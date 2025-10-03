/**
 * Policy Engine Unit Tests - 审批策略引擎单元测试
 *
 * 测试覆盖:
 * - 审批模式 (NEVER, ON_REQUEST, ON_FAILURE, UNTRUSTED)
 * - 白名单匹配
 * - 自动批准模式
 * - 批量评估
 * - 白名单管理
 * - 严格模式
 * - 边缘情况
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine, createPolicyEngine, createDefaultPolicyEngine } from '../policy-engine.js';
import { ApprovalMode, type ApprovalPolicy, getDefaultWhitelist } from '../../lib/types.js';

describe('PolicyEngine', () => {
  describe('审批模式: NEVER', () => {
    let engine: PolicyEngine;

    beforeEach(() => {
      engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.NEVER,
          whitelist: [],
        },
      });
    });

    it('应该自动批准所有命令', () => {
      const dangerous = engine.evaluateCommand('rm -rf /');
      expect(dangerous.needsApproval).toBe(false);
      expect(dangerous.reason).toContain('NEVER');

      const safe = engine.evaluateCommand('ls -la');
      expect(safe.needsApproval).toBe(false);
      expect(safe.reason).toContain('NEVER');
    });

    it('应该忽略白名单和其他选项', () => {
      const decision = engine.evaluateCommand('dangerous-command', {
        isCodexRequest: true,
        isFailed: true,
      });

      expect(decision.needsApproval).toBe(false);
      expect(decision.reason).toContain('NEVER');
    });
  });

  describe('审批模式: ON_REQUEST', () => {
    let engine: PolicyEngine;

    beforeEach(() => {
      engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.ON_REQUEST,
          whitelist: [],
        },
      });
    });

    it('应该在 Codex 未请求时自动批准', () => {
      const decision = engine.evaluateCommand('git push', {
        isCodexRequest: false,
      });

      expect(decision.needsApproval).toBe(false);
      expect(decision.reason).toContain('ON_REQUEST');
      expect(decision.reason).toContain('did not request');
    });

    it('应该在 Codex 请求时需要审批', () => {
      const decision = engine.evaluateCommand('git push --force', {
        isCodexRequest: true,
      });

      expect(decision.needsApproval).toBe(true);
      expect(decision.reason).toContain('Codex requested approval');
    });

    it('应该在 Codex 请求时检查白名单', () => {
      const engineWithWhitelist = createPolicyEngine({
        policy: {
          mode: ApprovalMode.ON_REQUEST,
          whitelist: [
            {
              pattern: '^git status$',
              reason: 'Safe read-only command',
              enabled: true,
            },
          ],
        },
      });

      // Codex 请求但命令在白名单中
      const decision = engineWithWhitelist.evaluateCommand('git status', {
        isCodexRequest: true,
      });

      expect(decision.needsApproval).toBe(false);
      expect(decision.reason).toContain('whitelist');
    });
  });

  describe('审批模式: ON_FAILURE', () => {
    let engine: PolicyEngine;

    beforeEach(() => {
      engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.ON_FAILURE,
          whitelist: [],
        },
      });
    });

    it('应该在未失败时自动批准', () => {
      const decision = engine.evaluateCommand('npm test', {
        isFailed: false,
      });

      expect(decision.needsApproval).toBe(false);
      expect(decision.reason).toContain('ON_FAILURE');
      expect(decision.reason).toContain('has not failed');
    });

    it('应该在失败时需要审批', () => {
      const decision = engine.evaluateCommand('npm install', {
        isFailed: true,
      });

      expect(decision.needsApproval).toBe(true);
      expect(decision.reason).toContain('failed');
    });

    it('应该在失败时检查白名单', () => {
      const engineWithWhitelist = createPolicyEngine({
        policy: {
          mode: ApprovalMode.ON_FAILURE,
          whitelist: [
            {
              pattern: '^npm install$',
              reason: 'Safe package install',
              enabled: true,
            },
          ],
        },
      });

      // 失败但命令在白名单中
      const decision = engineWithWhitelist.evaluateCommand('npm install', {
        isFailed: true,
      });

      expect(decision.needsApproval).toBe(false);
      expect(decision.reason).toContain('whitelist');
    });
  });

  describe('审批模式: UNTRUSTED', () => {
    let engine: PolicyEngine;

    beforeEach(() => {
      engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [
            {
              pattern: '^(ls|pwd|echo)',
              reason: 'Safe read-only commands',
              enabled: true,
            },
            {
              pattern: '^git status$',
              reason: 'Git status is safe',
              enabled: true,
            },
          ],
        },
      });
    });

    it('应该拒绝不在白名单中的命令', () => {
      const decision = engine.evaluateCommand('rm -rf /tmp/test');

      expect(decision.needsApproval).toBe(true);
      expect(decision.reason).toContain('not in whitelist');
    });

    it('应该批准白名单中的命令', () => {
      const lsDecision = engine.evaluateCommand('ls -la');
      expect(lsDecision.needsApproval).toBe(false);
      expect(lsDecision.reason).toContain('whitelist');
      expect(lsDecision.matchedRule).toBeDefined();

      const pwdDecision = engine.evaluateCommand('pwd');
      expect(pwdDecision.needsApproval).toBe(false);

      const gitDecision = engine.evaluateCommand('git status');
      expect(gitDecision.needsApproval).toBe(false);
    });

    it('应该忽略禁用的白名单规则', () => {
      const engineWithDisabled = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [
            {
              pattern: '^ls',
              reason: 'List files',
              enabled: false, // 禁用
            },
          ],
        },
      });

      const decision = engineWithDisabled.evaluateCommand('ls -la');
      expect(decision.needsApproval).toBe(true);
      expect(decision.matchedRule).toBeUndefined();
    });
  });

  describe('白名单匹配', () => {
    it('应该正确匹配正则表达式', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [
            {
              pattern: '^git (status|log|diff)$',
              reason: 'Read-only git commands',
              enabled: true,
            },
            {
              pattern: '^npm (test|run)',
              reason: 'NPM test commands',
              enabled: true,
            },
          ],
        },
      });

      // 匹配第一个规则
      expect(engine.evaluateCommand('git status').needsApproval).toBe(false);
      expect(engine.evaluateCommand('git log').needsApproval).toBe(false);
      expect(engine.evaluateCommand('git diff').needsApproval).toBe(false);

      // 不匹配
      expect(engine.evaluateCommand('git push').needsApproval).toBe(true);

      // 匹配第二个规则
      expect(engine.evaluateCommand('npm test').needsApproval).toBe(false);
      expect(engine.evaluateCommand('npm run build').needsApproval).toBe(false);
    });

    it('应该返回匹配的规则信息', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [
            {
              pattern: '^ls',
              reason: 'List directory contents',
              enabled: true,
            },
          ],
        },
      });

      const decision = engine.evaluateCommand('ls -la');
      expect(decision.matchedRule).toBeDefined();
      expect(decision.matchedRule?.pattern).toBe('^ls');
      expect(decision.matchedRule?.reason).toBe('List directory contents');
    });
  });

  describe('自动批准模式', () => {
    it('应该支持 autoApprovePatterns', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [],
          autoApprovePatterns: [/^echo/, /^cat .+\.txt$/],
        },
      });

      // 匹配第一个自动批准模式
      const echoDecision = engine.evaluateCommand('echo "Hello World"');
      expect(echoDecision.needsApproval).toBe(false);
      expect(echoDecision.reason).toContain('auto-approve pattern');

      // 匹配第二个自动批准模式
      const catDecision = engine.evaluateCommand('cat file.txt');
      expect(catDecision.needsApproval).toBe(false);

      // 不匹配
      const rmDecision = engine.evaluateCommand('rm file.txt');
      expect(rmDecision.needsApproval).toBe(true);
    });

    it('应该优先检查白名单再检查自动批准模式', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [
            {
              pattern: '^ls',
              reason: 'Whitelist rule',
              enabled: true,
            },
          ],
          autoApprovePatterns: [/^ls/],
        },
      });

      const decision = engine.evaluateCommand('ls -la');
      expect(decision.needsApproval).toBe(false);
      // 应该匹配白名单规则而不是自动批准模式
      expect(decision.reason).toContain('whitelist');
      expect(decision.matchedRule).toBeDefined();
    });
  });

  describe('批量评估', () => {
    it('应该批量评估多个命令', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [
            {
              pattern: '^(ls|pwd)$',
              reason: 'Safe commands',
              enabled: true,
            },
          ],
        },
      });

      const commands = ['ls', 'pwd', 'rm -rf /tmp', 'git push'];
      const decisions = engine.evaluateCommands(commands);

      expect(decisions).toHaveLength(4);

      // 前两个应该批准
      expect(decisions[0].needsApproval).toBe(false);
      expect(decisions[1].needsApproval).toBe(false);

      // 后两个应该拒绝
      expect(decisions[2].needsApproval).toBe(true);
      expect(decisions[3].needsApproval).toBe(true);
    });

    it('应该在批量评估时传递选项', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.ON_REQUEST,
          whitelist: [],
        },
      });

      const commands = ['git commit', 'git push'];
      const decisions = engine.evaluateCommands(commands, {
        isCodexRequest: true,
      });

      // 所有命令都应该需要审批(因为 Codex 请求)
      expect(decisions[0].needsApproval).toBe(true);
      expect(decisions[1].needsApproval).toBe(true);
    });
  });

  describe('白名单管理', () => {
    let engine: PolicyEngine;

    beforeEach(() => {
      engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [
            {
              pattern: '^ls',
              reason: 'List files',
              enabled: true,
            },
          ],
        },
      });
    });

    it('应该添加新的白名单规则', () => {
      // 初始状态: pwd 需要审批
      expect(engine.evaluateCommand('pwd').needsApproval).toBe(true);

      // 添加白名单规则
      engine.addWhitelistRule({
        pattern: '^pwd$',
        reason: 'Print working directory',
        enabled: true,
      });

      // 添加后: pwd 应该被批准
      expect(engine.evaluateCommand('pwd').needsApproval).toBe(false);
    });

    it('应该移除白名单规则', () => {
      // 初始状态: ls 被批准
      expect(engine.evaluateCommand('ls').needsApproval).toBe(false);

      // 移除白名单规则
      const removed = engine.removeWhitelistRule('^ls');
      expect(removed).toBe(true);

      // 移除后: ls 需要审批
      expect(engine.evaluateCommand('ls').needsApproval).toBe(true);
    });

    it('应该在移除不存在的规则时返回 false', () => {
      const removed = engine.removeWhitelistRule('^nonexistent$');
      expect(removed).toBe(false);
    });

    it('应该更新整个审批策略', () => {
      // 初始策略: UNTRUSTED 模式
      expect(engine.evaluateCommand('rm -rf /tmp').needsApproval).toBe(true);

      // 更新为 NEVER 模式
      engine.updatePolicy({
        mode: ApprovalMode.NEVER,
        whitelist: [],
      });

      // 所有命令都应该被批准
      expect(engine.evaluateCommand('rm -rf /tmp').needsApproval).toBe(false);
    });

    it('应该在更新策略后重新编译白名单', () => {
      engine.updatePolicy({
        mode: ApprovalMode.UNTRUSTED,
        whitelist: [
          {
            pattern: '^pwd$',
            reason: 'New whitelist',
            enabled: true,
          },
        ],
      });

      // 旧规则应该失效
      expect(engine.evaluateCommand('ls').needsApproval).toBe(true);

      // 新规则应该生效
      expect(engine.evaluateCommand('pwd').needsApproval).toBe(false);
    });
  });

  describe('严格模式', () => {
    it('应该在严格模式下拒绝无效正则表达式', () => {
      expect(() => {
        createPolicyEngine({
          policy: {
            mode: ApprovalMode.UNTRUSTED,
            whitelist: [
              {
                pattern: '[invalid(regex',
                reason: 'Invalid pattern',
                enabled: true,
              },
            ],
          },
          strictMode: true,
        });
      }).toThrow('Invalid regex pattern');
    });

    it('应该在非严格模式下忽略无效正则表达式', () => {
      expect(() => {
        createPolicyEngine({
          policy: {
            mode: ApprovalMode.UNTRUSTED,
            whitelist: [
              {
                pattern: '[invalid(regex',
                reason: 'Invalid pattern',
                enabled: true,
              },
              {
                pattern: '^valid$',
                reason: 'Valid pattern',
                enabled: true,
              },
            ],
          },
          strictMode: false,
        });
      }).not.toThrow();
    });

    it('非严格模式应该跳过无效规则但保留有效规则', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [
            {
              pattern: '[invalid(regex',
              reason: 'Invalid pattern',
              enabled: true,
            },
            {
              pattern: '^valid$',
              reason: 'Valid pattern',
              enabled: true,
            },
          ],
        },
        strictMode: false,
      });

      // 有效规则应该工作
      expect(engine.evaluateCommand('valid').needsApproval).toBe(false);

      // 无效规则被跳过,所以不匹配
      expect(engine.evaluateCommand('invalid').needsApproval).toBe(true);
    });
  });

  describe('策略配置', () => {
    it('应该正确获取当前策略', () => {
      const policy: ApprovalPolicy = {
        mode: ApprovalMode.ON_REQUEST,
        whitelist: getDefaultWhitelist(),
        timeout: 30000,
      };

      const engine = createPolicyEngine({ policy });
      const retrievedPolicy = engine.getPolicy();

      expect(retrievedPolicy.mode).toBe(ApprovalMode.ON_REQUEST);
      expect(retrievedPolicy.timeout).toBe(30000);
      expect(retrievedPolicy.whitelist.length).toBeGreaterThan(0);
    });

    it('应该返回策略的副本(防止外部修改)', () => {
      const policy: ApprovalPolicy = {
        mode: ApprovalMode.UNTRUSTED,
        whitelist: [],
      };

      const engine = createPolicyEngine({ policy });
      const retrievedPolicy = engine.getPolicy();

      // 修改返回的策略
      retrievedPolicy.mode = ApprovalMode.NEVER;

      // 引擎内部策略不应该被修改
      const internalPolicy = engine.getPolicy();
      expect(internalPolicy.mode).toBe(ApprovalMode.UNTRUSTED);
    });

    it('应该正确获取审批超时时间', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.ON_REQUEST,
          whitelist: [],
          timeout: 60000,
        },
      });

      expect(engine.getTimeout()).toBe(60000);
    });

    it('应该在没有设置超时时返回 undefined', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.ON_REQUEST,
          whitelist: [],
        },
      });

      expect(engine.getTimeout()).toBeUndefined();
    });
  });

  describe('工厂函数', () => {
    it('应该通过工厂函数创建 PolicyEngine', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [],
        },
      });

      expect(engine).toBeInstanceOf(PolicyEngine);
      expect(engine.getPolicy().mode).toBe(ApprovalMode.UNTRUSTED);
    });

    it('应该创建默认审批策略引擎', () => {
      const engine = createDefaultPolicyEngine();

      expect(engine).toBeInstanceOf(PolicyEngine);
      expect(engine.getPolicy().mode).toBe(ApprovalMode.ON_REQUEST);
      expect(engine.getPolicy().whitelist.length).toBeGreaterThan(0);
    });

    it('应该支持自定义默认审批模式', () => {
      const engine = createDefaultPolicyEngine(ApprovalMode.UNTRUSTED);

      expect(engine.getPolicy().mode).toBe(ApprovalMode.UNTRUSTED);
    });
  });

  describe('边缘情况', () => {
    it('应该处理空命令字符串', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [],
        },
      });

      const decision = engine.evaluateCommand('');
      expect(decision.needsApproval).toBe(true);
    });

    it('应该处理包含特殊字符的命令', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [
            {
              pattern: '^echo ".*"$',
              reason: 'Echo with quotes',
              enabled: true,
            },
          ],
        },
      });

      const decision = engine.evaluateCommand('echo "Hello, World!"');
      expect(decision.needsApproval).toBe(false);
    });

    it('应该处理多行命令', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [
            {
              pattern: 'git.*\\n.*commit',
              reason: 'Multi-line git command',
              enabled: true,
            },
          ],
        },
      });

      const multilineCommand = 'git add .\ngit commit -m "test"';
      const decision = engine.evaluateCommand(multilineCommand);
      expect(decision.needsApproval).toBe(false);
    });

    it('应该处理空白名单', () => {
      const engine = createPolicyEngine({
        policy: {
          mode: ApprovalMode.UNTRUSTED,
          whitelist: [],
        },
      });

      const decision = engine.evaluateCommand('ls');
      expect(decision.needsApproval).toBe(true);
    });

    it('应该处理批量评估空数组', () => {
      const engine = createDefaultPolicyEngine();
      const decisions = engine.evaluateCommands([]);

      expect(decisions).toHaveLength(0);
    });
  });

  describe('默认白名单', () => {
    it('应该使用默认白名单规则', () => {
      const engine = createDefaultPolicyEngine(ApprovalMode.UNTRUSTED);

      // 默认白名单应该包含安全的只读命令
      const whitelist = engine.getPolicy().whitelist;
      expect(whitelist.length).toBeGreaterThan(0);

      // 测试一些常见的安全命令是否在白名单中
      // 注意: 默认白名单包含 ^ls (with space), ^git status, ^git diff, ^cat 等
      const lsDecision = engine.evaluateCommand('ls -la'); // ✅ 匹配 ^ls
      const gitStatusDecision = engine.evaluateCommand('git status'); // ✅ 匹配 ^git status

      // 至少有一个应该被批准(如果在默认白名单中)
      const atLeastOneApproved = !lsDecision.needsApproval || !gitStatusDecision.needsApproval;
      expect(atLeastOneApproved).toBe(true);

      // 验证至少有一个规则生效
      if (!lsDecision.needsApproval) {
        expect(lsDecision.matchedRule).toBeDefined();
        expect(lsDecision.matchedRule?.pattern).toBe('^ls ');
      }
      if (!gitStatusDecision.needsApproval) {
        expect(gitStatusDecision.matchedRule).toBeDefined();
        expect(gitStatusDecision.matchedRule?.pattern).toBe('^git status');
      }
    });
  });
});
