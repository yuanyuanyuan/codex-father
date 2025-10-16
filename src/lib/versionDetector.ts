import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(spawn);

interface VersionInfo {
  version: string;
  major: number;
  minor: number;
  patch: number;
  detectedAt: number;
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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // 检查是否是命令不存在的错误
      if (errorMessage.includes('command not found') || errorMessage.includes('ENOENT')) {
        throw new Error('无法检测 Codex 版本，请确认 Codex 已安装且在 PATH 中');
      }
      
      // 检查是否是版本格式错误
      if (errorMessage.includes('Invalid version format') || errorMessage.includes('weird output')) {
        throw new Error('无法解析 Codex 版本号，请确认 Codex 已正确安装');
      }
      
      throw new Error(
        `无法检测 Codex 版本: ${errorMessage}\n` +
          '请确认 Codex 已安装且在 PATH 中'
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
    // 移除常见前缀
    let cleanVersion = versionString
      .replace(/^Codex CLI\s*/i, '') // 移除 "Codex CLI" 前缀
      .replace(/^v/, ''); // 移除 'v' 前缀（如果存在）

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
      detectedAt: Date.now(),
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.lastCheck = 0;
  }

  getCachedVersion(): VersionInfo | null {
    const now = Date.now();
    if (this.cache.has('codex') && now - this.lastCheck < this.CACHE_TTL) {
      return this.cache.get('codex')!;
    }
    return null;
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

export async function detectCodexVersion(): Promise<VersionInfo> {
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

export function getCachedVersion(): VersionInfo | null {
  return versionDetector.getCachedVersion();
}
