import { describe, expect, it } from 'vitest';
import { ResourceMonitor } from '../resource-monitor.js';

describe('ResourceMonitor 阈值与滞回 (T026)', () => {
  it('触发高压后进入滞回区间，不立即恢复；低于滞回线才恢复', () => {
    const m = new ResourceMonitor();
    const cfg = { cpuThreshold: 0.8, memoryThreshold: 1_000_000_000, hysteresis: 0.1 };

    // 初始健康
    let r = m.evaluate({ cpuUsage: 0.5, memoryUsage: 200_000_000, timestamp: Date.now() }, cfg);
    expect(r.overloaded).toBe(false);
    expect(r.shouldDownscale).toBe(false);
    expect(r.shouldUpscale).toBe(false);

    // 超过 CPU 阈值：进入高压，需降并发
    r = m.evaluate({ cpuUsage: 0.85, memoryUsage: 200_000_000, timestamp: Date.now() }, cfg);
    expect(r.overloaded).toBe(true);
    expect(r.shouldDownscale).toBe(true);

    // 下降到阈值之下但仍在滞回区（0.8 - 0.1 = 0.7）→ 保持高压不恢复
    r = m.evaluate({ cpuUsage: 0.75, memoryUsage: 200_000_000, timestamp: Date.now() }, cfg);
    expect(r.overloaded).toBe(true);
    expect(r.shouldUpscale).toBe(false);

    // 低于滞回线（<=0.7）→ 恢复，允许上调
    r = m.evaluate({ cpuUsage: 0.65, memoryUsage: 200_000_000, timestamp: Date.now() }, cfg);
    expect(r.overloaded).toBe(false);
    expect(r.shouldUpscale).toBe(true);
  });
});
