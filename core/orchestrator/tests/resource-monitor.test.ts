import { describe, expect, it } from 'vitest';
import { ResourceMonitor } from '../resource-monitor';

describe('resource-monitor', () => {
  it('导出 ResourceMonitor 类', () => {
    expect(typeof ResourceMonitor).toBe('function');
  });

  it('可以实例化 ResourceMonitor', () => {
    const monitor = new ResourceMonitor();
    expect(monitor).toBeInstanceOf(ResourceMonitor);
  });
});
