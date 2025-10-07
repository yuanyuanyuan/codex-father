import os from 'node:os';
import type { ResourceSnapshot } from './types.js';

export interface ShouldDownscaleConfig {
  readonly cpuThreshold?: number;
  readonly memoryThreshold?: number;
  readonly hysteresis?: number;
  readonly previousDecision?: {
    readonly downscale: boolean;
    readonly timestamp: number;
  };
}

export interface ShouldDownscaleResult {
  downscale: boolean;
  reason?: string;
  hysteresisActive?: boolean;
}

export function shouldDownscale(
  snapshot: ResourceSnapshot,
  config: ShouldDownscaleConfig = {}
): ShouldDownscaleResult {
  const cpuThreshold = clamp01(config.cpuThreshold ?? 0.8);
  const memoryThreshold = Math.max(config.memoryThreshold ?? Number.POSITIVE_INFINITY, 0);
  const hysteresis = clamp01(config.hysteresis ?? 0.1);
  const previousDownscale = config.previousDecision?.downscale ?? false;

  const cpuOver = snapshot.cpuUsage >= cpuThreshold;
  const memOver = snapshot.memoryUsage >= memoryThreshold;

  if (cpuOver || memOver) {
    const reasons: string[] = [];
    if (cpuOver) {
      const cpuPercent = Math.round(snapshot.cpuUsage * 100);
      const cpuThresholdPercent = Math.round(cpuThreshold * 100);
      reasons.push(`CPU 使用率 ${cpuPercent}% 超过阈值 ${cpuThresholdPercent}%`);
    }
    if (memOver) {
      if (Number.isFinite(memoryThreshold)) {
        const memoryUsageRounded = Math.round(snapshot.memoryUsage);
        const memoryThresholdRounded = Math.round(memoryThreshold);
        reasons.push(`内存使用 ${memoryUsageRounded} 超过阈值 ${memoryThresholdRounded}`);
      } else {
        reasons.push('内存使用超出设定阈值');
      }
    }
    return {
      downscale: true,
      reason: reasons.join('；'),
    };
  }

  if (!previousDownscale) {
    return { downscale: false };
  }

  const cpuRecover = snapshot.cpuUsage <= Math.max(cpuThreshold - hysteresis, 0);
  const memHysteresis = memoryHysteresis(memoryThreshold, hysteresis);
  const memRecover =
    !Number.isFinite(memoryThreshold) ||
    snapshot.memoryUsage <= Math.max(memoryThreshold - memHysteresis, 0);

  if (cpuRecover && memRecover) {
    return { downscale: false };
  }

  return {
    downscale: true,
    hysteresisActive: true,
    reason: '滞回保护中：CPU/内存尚未降至安全带，保持降级策略',
  };
}

/**
 * ResourceMonitor 负责采集轻量级的系统资源指标喵。
 */
export class ResourceMonitor {
  /** 上一次决策结果（用于滞回判定） */
  private lastDecision:
    | {
        downscale: boolean;
        timestamp: number;
      }
    | undefined;

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
    const previousDecision = this.lastDecision;
    const decision = shouldDownscale(snapshot, {
      ...(opts && typeof opts.cpuThreshold === 'number' ? { cpuThreshold: opts.cpuThreshold } : {}),
      ...(opts && typeof opts.memoryThreshold === 'number'
        ? { memoryThreshold: opts.memoryThreshold }
        : {}),
      ...(opts && typeof opts.hysteresis === 'number' ? { hysteresis: opts.hysteresis } : {}),
      ...(previousDecision ? { previousDecision } : {}),
    });

    const wasDownscale = previousDecision?.downscale ?? false;
    const nextDecision = {
      downscale: decision.downscale,
      timestamp: snapshot.timestamp ?? Date.now(),
    } as const;
    this.lastDecision = nextDecision;

    const overloaded = decision.downscale;
    const needDownscale = !wasDownscale && decision.downscale;
    const canUpscale = wasDownscale && !decision.downscale;

    return { overloaded, shouldDownscale: needDownscale, shouldUpscale: canUpscale };
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
