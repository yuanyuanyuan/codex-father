import os from 'node:os';
import type { ResourceSnapshot } from './types.js';

/**
 * ResourceMonitor 负责采集轻量级的系统资源指标喵。
 */
export class ResourceMonitor {
  /** 上一次判定是否处于高压区（用于滞回） */
  private lastOverloaded = false;

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

  /**
   * 根据阈值与滞回判断是否需要“降并发”或“可上调”。
   *
   * - 当 cpuUsage ≥ cpuThreshold 或 memoryUsage ≥ memoryThreshold → 标记 overloaded=true
   * - 滞回：仅当 cpuUsage ≤ (cpuThreshold - hysteresis) 且 memoryUsage ≤ (memoryThreshold - memHysteresis)
   *   时从 overloaded 恢复为 false
   */
  public evaluate(
    snapshot: ResourceSnapshot,
    opts?: { cpuThreshold?: number; memoryThreshold?: number; hysteresis?: number }
  ): { overloaded: boolean; shouldDownscale: boolean; shouldUpscale: boolean } {
    const cpuThreshold = clamp01(opts?.cpuThreshold ?? 0.8);
    const memoryThreshold = Math.max(opts?.memoryThreshold ?? Number.POSITIVE_INFINITY, 0);
    const hysteresis = clamp01(opts?.hysteresis ?? 0.1);

    const cpuOver = snapshot.cpuUsage >= cpuThreshold;
    const memOver = snapshot.memoryUsage >= memoryThreshold;
    const nowOver = cpuOver || memOver;

    // 进入高压区：立即触发 downscale，并记录状态
    if (nowOver) {
      this.lastOverloaded = true;
      return { overloaded: true, shouldDownscale: true, shouldUpscale: false };
    }

    // 滞回恢复：只有显著低于阈值才恢复（防抖）
    const cpuRecover = snapshot.cpuUsage <= Math.max(cpuThreshold - hysteresis, 0);
    const memRecover =
      snapshot.memoryUsage <=
      Math.max(memoryThreshold - memoryHysteresis(memoryThreshold, hysteresis), 0);

    if (this.lastOverloaded) {
      if (cpuRecover && memRecover) {
        this.lastOverloaded = false;
        return { overloaded: false, shouldDownscale: false, shouldUpscale: true };
      }
      // 仍在滞回区间：保持不变
      return { overloaded: true, shouldDownscale: false, shouldUpscale: false };
    }

    // 一直健康
    return { overloaded: false, shouldDownscale: false, shouldUpscale: false };
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) {
    return 1;
  }
  return Math.min(Math.max(v, 0), 1);
}

function memoryHysteresis(threshold: number, hysteresis: number): number {
  if (!Number.isFinite(threshold) || !Number.isFinite(hysteresis)) {
    return 0;
  }
  // 将内存阈值滞回按比例近似：取阈值的 hysteresis 比例
  return Math.max(0, threshold * hysteresis);
}
