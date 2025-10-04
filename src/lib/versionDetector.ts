import { execFile } from 'child_process';

interface VersionInfo {
  version: string; // 完整版本号，如 "0.44.0"
  major: number; // 主版本号
  minor: number; // 次版本号
  patch: number; // 补丁版本号
  detectedAt: number; // 检测时间戳（毫秒）
}

let versionCache: VersionInfo | null = null;

export function getCachedVersion(): VersionInfo | null {
  return versionCache;
}

export function clearVersionCache(): void {
  versionCache = null;
}

export async function detectCodexVersion(): Promise<VersionInfo> {
  if (versionCache) {
    return versionCache;
  }

  try {
    // 手动包装 execFile 为 Promise，避免 promisify 带来的 mock 问题
    const stdout = await new Promise<string>((resolve, reject) => {
      execFile('codex', ['--version'], (err, stdout, stderr) => {
        if (err) {
          reject(err);
        } else {
          resolve(stdout ?? '');
        }
      });
    });
    const text = String(stdout).trim();

    const match = text.match(/v?(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      throw new Error(
        `无法解析 Codex 版本号，输出: ${text}。请确认 Codex 已安装且在 PATH 中。codex-father 支持 Codex 0.42 或 0.44 版本。`
      );
    }

    const major = Number(match[1]);
    const minor = Number(match[2]);
    const patch = Number(match[3]);

    const info: VersionInfo = {
      version: `${major}.${minor}.${patch}`,
      major,
      minor,
      patch,
      detectedAt: Date.now(),
    };

    versionCache = info;
    return info;
  } catch (err: any) {
    if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        '无法检测 Codex 版本，请确认 Codex 已安装且在 PATH 中。codex-father 支持 Codex 0.42 或 0.44 版本。'
      );
    }
    // 若为我们主动抛出的解析错误，直接透传；否则补充安装指引
    if (err instanceof Error && /无法解析 Codex 版本号/.test(err.message)) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `检测 Codex 版本时出错: ${message}。请确认 Codex 已安装且在 PATH 中。codex-father 支持 Codex 0.42 或 0.44 版本。`
    );
  }
}

export type { VersionInfo };
