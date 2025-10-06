import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ResourceSnapshot } from '../types';

type ShouldDownscaleResult = {
  downscale: boolean;
  reason?: string;
  hysteresisActive?: boolean;
};

type ShouldDownscaleConfig = {
  cpuThreshold?: number;
  memoryThreshold?: number;
  hysteresis?: number;
  previousDecision?: {
    downscale: boolean;
    timestamp: number;
  };
};

type ShouldDownscale = (
  snapshot: ResourceSnapshot,
  config: ShouldDownscaleConfig
) => ShouldDownscaleResult;

const loadShouldDownscale = async (): Promise<ShouldDownscale | undefined> => {
  const resourceModule = await import('../resource-monitor');
  return resourceModule.shouldDownscale as ShouldDownscale | undefined;
};

describe('ResourceMonitor 阈值与滞回契约', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('导出 shouldDownscale(snapshot, cfg) 纯函数以便独立测试', async () => {
    const shouldDownscale = await loadShouldDownscale();
    expect(shouldDownscale, 'ResourceMonitor 模块需要导出 shouldDownscale 用于策略判定').toBeTypeOf(
      'function'
    );
  });

  it('CPU 使用率超阈值时应提示 downscale=true 并给出 CPU 理由', async () => {
    const shouldDownscale = await loadShouldDownscale();
    expect(shouldDownscale, '缺少 shouldDownscale 实现导致无法断言阈值逻辑').toBeTypeOf('function');
    if (typeof shouldDownscale !== 'function') {
      return;
    }

    const snapshot: ResourceSnapshot = {
      cpuUsage: 0.9,
      memoryUsage: 256,
      timestamp: Date.now(),
    };
    const result = shouldDownscale(snapshot, { cpuThreshold: 0.85 });

    expect(result.downscale, 'CPU 超过 85% 时应立即降级').toBe(true);
    expect(result.reason ?? '', '返回的理由应点明 CPU 限制').toMatch(/CPU|cpu|处理器/);
  });

  it('内存超标同样触发降级，并保留原因字段', async () => {
    const shouldDownscale = await loadShouldDownscale();
    expect(shouldDownscale, 'shouldDownscale 未达成导出契约').toBeTypeOf('function');
    if (typeof shouldDownscale !== 'function') {
      return;
    }

    const snapshot: ResourceSnapshot = {
      cpuUsage: 0.5,
      memoryUsage: 1024,
      timestamp: Date.now(),
    };
    const result = shouldDownscale(snapshot, { memoryThreshold: 512 });

    expect(result.downscale, '内存超过阈值时必须降级').toBe(true);
    expect(result.reason ?? '', '理由需说明内存触发降级').toMatch(/memory|内存|RAM/i);
  });

  it('滞回：降级后需 cpuUsage 低于阈值-hysteresis 方可恢复', async () => {
    const shouldDownscale = await loadShouldDownscale();
    expect(shouldDownscale, '缺失 shouldDownscale 将无法覆盖滞回逻辑').toBeTypeOf('function');
    if (typeof shouldDownscale !== 'function') {
      return;
    }

    const config: ShouldDownscaleConfig = {
      cpuThreshold: 0.85,
      hysteresis: 0.1,
      previousDecision: {
        downscale: true,
        timestamp: Date.now() - 1000,
      },
    };

    const snapshotStillHigh: ResourceSnapshot = {
      cpuUsage: 0.8,
      memoryUsage: 128,
      timestamp: Date.now(),
    };
    const stayResult = shouldDownscale(snapshotStillHigh, config);
    expect(stayResult.downscale, 'CPU 仍高于 0.75 时应保持降级').toBe(true);
    expect(stayResult.hysteresisActive ?? false, '滞回持续时应明确告知正在生效').toBe(true);

    const snapshotRecovered: ResourceSnapshot = {
      cpuUsage: 0.7,
      memoryUsage: 128,
      timestamp: Date.now() + 500,
    };
    const recoverResult = shouldDownscale(snapshotRecovered, config);
    expect(recoverResult.downscale, 'CPU 降至 0.75 以下时应允许恢复').toBe(false);
    expect(recoverResult.hysteresisActive ?? false, '恢复后滞回标记应关闭').toBe(false);
  });
});
