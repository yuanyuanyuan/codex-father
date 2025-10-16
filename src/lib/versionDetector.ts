import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(spawn);

interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
}

class VersionDetector {
  private cache: Map<string, VersionInfo> = new Map();
  private lastCheck: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  async detectVersion(): Promise<VersionInfo> {
    const now = Date.now();

    // 检查缓存
    if (this.cache.has('codex') && now - this.lastCheck < this.CACHE_TTL) {
      return this.cache.get('codex')!;
    }

    try {
      const { stdout } = await this.executeCommand(['--version']);
      const version = this.parseVersion(stdout.trim());

      // 更新缓存
      this.cache.set('codex', version);
      this.lastCheck = now;

      return version;
    } catch (error) {
      throw new Error(
        `Failed to detect Codex version: ${error instanceof Error ? error.message : 'Unknown error'}\n` +
          'Please ensure Codex is installed and accessible in your PATH.\n' +
          'Installation instructions: https://github.com/anthropics/codex'
      );
    }
  }

  private async executeCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const process = spawn('codex', args, { stdio: 'pipe' });
      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  }

  private parseVersion(versionString: string): VersionInfo {
    // 移除 'v' 前缀（如果存在）
    const cleanVersion = versionString.replace(/^v/, '');

    // 匹配语义化版本号
    const match = cleanVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      throw new Error(`Invalid version format: ${versionString}`);
    }

    return {
      version: cleanVersion,
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.lastCheck = 0;
  }

  // 检查版本是否满足要求
  async meetsMinimumVersion(
    minMajor: number,
    minMinor: number = 0,
    minPatch: number = 0
  ): Promise<boolean> {
    const current = await this.detectVersion();

    if (current.major > minMajor) return true;
    if (current.major < minMajor) return false;

    if (current.minor > minMinor) return true;
    if (current.minor < minMinor) return false;

    return current.patch >= minPatch;
  }
}

// 单例实例
export const versionDetector = new VersionDetector();

// 导出函数式接口
export async function getCodexVersion(): Promise<VersionInfo> {
  return versionDetector.detectVersion();
}

export async function checkCodexVersion(
  minMajor: number,
  minMinor?: number,
  minPatch?: number
): Promise<boolean> {
  return versionDetector.meetsMinimumVersion(minMajor, minMinor, minPatch);
}

export function clearVersionCache(): void {
  versionDetector.clearCache();
}
