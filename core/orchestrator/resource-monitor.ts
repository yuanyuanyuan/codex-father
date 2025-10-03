import os from 'node:os';
import type { ResourceSnapshot } from './types.js';

/**
 * ResourceMonitor 负责采集轻量级的系统资源指标喵。
 */
export class ResourceMonitor {
  /**
   * 采集一次资源快照。
   *
   * @returns 当前资源指标。
   */
  public captureSnapshot(): ResourceSnapshot {
    const [oneMinuteLoad = 0] = os.loadavg();
    const cpuCount = Math.max(os.cpus().length, 1);
    const memoryUsage = process.memoryUsage().rss;
    const cpuUsage = Math.min(oneMinuteLoad / cpuCount, 1);

    return {
      cpuUsage,
      memoryUsage,
      timestamp: Date.now(),
    };
  }
}
