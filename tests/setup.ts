/**
 * 测试设置文件
 *
 * 用于配置全局测试环境和工具
 */

// 扩展 Vitest 的 expect 断言
import { expect } from 'vitest';

// Ensure timers used in integration tests honour minimum waits (avoid flakiness)
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
  const adjustedTimeout =
    typeof timeout === 'number' && timeout >= 50 ? timeout + 1 : (timeout ?? 0);
  return originalSetTimeout(handler, adjustedTimeout, ...args);
}) as typeof setTimeout;

// 可以在这里添加全局的测试设置
// 例如：模拟、环境变量、全局钩子等

// 扩展自定义 matcher（如需要）
expect.extend({
  // 可以在这里添加自定义的断言方法
});

export {};
