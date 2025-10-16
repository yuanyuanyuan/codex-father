interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
}

interface DegradationStrategy {
  version: string;
  features: string[];
  fallbacks: { [feature: string]: string };
}

export class DegradationStrategy {
  private strategies: Map<string, DegradationStrategy> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // 0.42 版本策略
    this.strategies.set('0.42', {
      version: '0.42',
      features: ['basic-task-execution', 'file-operations', 'git-operations'],
      fallbacks: {
        profile: 'Use environment variables instead',
        'sendUserTurn.effort': 'Omit effort parameter',
        'sendUserTurn.summary': 'Omit summary parameter',
      },
    });

    // 0.44 版本策略
    this.strategies.set('0.44', {
      version: '0.44',
      features: [
        'basic-task-execution',
        'file-operations',
        'git-operations',
        'profile-support',
        'effort-parameter',
        'summary-parameter',
      ],
      fallbacks: {},
    });
  }

  getStrategy(version: string): DegradationStrategy | null {
    // 查找最接近的策略
    const versions = Array.from(this.strategies.keys()).sort();
    const closest = this.findClosestVersion(version, versions);
    return this.strategies.get(closest) || null;
  }

  private findClosestVersion(target: string, available: string[]): string {
    const targetParts = target.split('.').map(Number);

    let closest = available[0];
    let closestDistance = this.versionDistance(target, closest);

    for (const version of available) {
      const distance = this.versionDistance(target, version);
      if (distance < closestDistance) {
        closest = version;
        closestDistance = distance;
      }
    }

    return closest;
  }

  private versionDistance(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    return (
      Math.abs(parts1[0] - parts2[0]) * 100 +
      Math.abs(parts1[1] - parts2[1]) * 10 +
      Math.abs(parts1[2] - parts2[2])
    );
  }

  supportsFeature(feature: string, version: string): boolean {
    const strategy = this.getStrategy(version);
    return strategy ? strategy.features.includes(feature) : false;
  }

  getFallback(feature: string, version: string): string | null {
    const strategy = this.getStrategy(version);
    return strategy ? strategy.fallbacks[feature] || null : null;
  }
}

export const degradationStrategy = new DegradationStrategy();
