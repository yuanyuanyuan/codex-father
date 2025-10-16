import { describe, it, expect, beforeEach, vi } from 'vitest';

// 动态导入被测模块，确保在 mock 生效后再加载
async function importModule() {
  const mod = await import('../../src/lib/versionDetector');
  return mod as unknown as {
    detectCodexVersion: () => Promise<{
      version: string;
      major: number;
      minor: number;
      patch: number;
      detectedAt: number;
    }>;
    getCachedVersion: () => {
      version: string;
      major: number;
      minor: number;
      patch: number;
      detectedAt: number;
    } | null;
    clearVersionCache: () => void;
  };
}

type ExecFileCb = (err: NodeJS.ErrnoException | null, stdout?: string, stderr?: string) => void;

// 工具：设置 spawn 的模拟实现
function mockExecFile(impl: (file: string, args: string[], cb: ExecFileCb) => void) {
  vi.resetModules();
  vi.doMock('node:child_process', () => {
    return {
      spawn: (command: string, args: string[], options?: any) => {
        const childProcess = {
          stdout: {
            on: (event: string, callback: (data: Buffer) => void) => {
              if (event === 'data') {
                // 调用原始实现获取输出
                impl(command, args, (err, stdout) => {
                  if (stdout) {
                    callback(Buffer.from(stdout));
                  }
                });
              }
            }
          },
          stderr: {
            on: (event: string, callback: (data: Buffer) => void) => {
              if (event === 'data') {
                // 模拟空错误输出
                callback(Buffer.from(''));
              }
            }
          },
          on: (event: string, callback: (code: number | null, signal: string | null) => void) => {
            if (event === 'close') {
              setTimeout(() => callback(0, null), 20);
            }
          }
        };
        return childProcess;
      },
    };
  });
}

describe('versionDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('成功检测 Codex 0.42 版本', async () => {
    mockExecFile((_file, args, cb) => {
      expect(args).toEqual(['--version']);
      setTimeout(() => cb(null, 'Codex CLI v0.42.0\n'), 10);
    });

    const { detectCodexVersion, clearVersionCache } = await importModule();
    clearVersionCache();

    const info = await detectCodexVersion();
    expect(info.version).toBe('0.42.0');
    expect(info.major).toBe(0);
    expect(info.minor).toBe(42);
    expect(info.patch).toBe(0);
    expect(typeof info.detectedAt).toBe('number');
  });

  it('成功检测 Codex 0.44 版本（无 v 前缀）', async () => {
    mockExecFile((_file, _args, cb) => {
      cb(null, 'Codex CLI 0.44.0');
    });

    const { detectCodexVersion, clearVersionCache } = await importModule();
    clearVersionCache();

    const info = await detectCodexVersion();
    expect(info.version).toBe('0.44.0');
    expect(info.minor).toBe(44);
  });

  it('正确解析语义化版本号（major/minor/patch）', async () => {
    mockExecFile((_file, _args, cb) => cb(null, 'Codex CLI v1.2.3'));
    const { detectCodexVersion, clearVersionCache } = await importModule();
    clearVersionCache();
    const info = await detectCodexVersion();
    expect(info).toMatchObject({ version: '1.2.3', major: 1, minor: 2, patch: 3 });
  });

  it('缓存机制工作正常（首次检测后，后续调用使用缓存）', async () => {
    let calls = 0;
    mockExecFile((_file, _args, cb) => {
      calls += 1;
      setTimeout(() => cb(null, 'Codex CLI v0.44.0'), 30);
    });
    const { detectCodexVersion, getCachedVersion, clearVersionCache } = await importModule();
    clearVersionCache();

    const t1 = Date.now();
    const first = await detectCodexVersion();
    const firstCost = Date.now() - t1;
    expect(first.version).toBe('0.44.0');
    expect(calls).toBe(1);

    const t2 = Date.now();
    const second = await detectCodexVersion();
    const secondCost = Date.now() - t2;
    expect(second).toBe(getCachedVersion());
    expect(calls).toBe(1); // 未再次调用外部命令

    // 性能断言
    expect(firstCost).toBeLessThan(1000);
    expect(secondCost).toBeLessThan(100);
  });

  it('首次检测 < 1s，缓存后 < 100ms', async () => {
    mockExecFile((_file, _args, cb) => setTimeout(() => cb(null, 'Codex CLI v0.42.0'), 50));
    const { detectCodexVersion, clearVersionCache } = await importModule();
    clearVersionCache();

    const t1 = Date.now();
    await detectCodexVersion();
    const firstCost = Date.now() - t1;
    expect(firstCost).toBeLessThan(1000);

    const t2 = Date.now();
    await detectCodexVersion();
    const secondCost = Date.now() - t2;
    expect(secondCost).toBeLessThan(100);
  });

  it('Codex 命令不存在时抛出明确错误（包含安装指引）', async () => {
    mockExecFile((_file, _args, cb) => {
      const err = new Error('not found') as NodeJS.ErrnoException;
      // @ts-expect-error - 注入 code 属性模拟 ENOENT
      err.code = 'ENOENT';
      cb(err);
    });
    const { detectCodexVersion, clearVersionCache } = await importModule();
    clearVersionCache();
    await expect(detectCodexVersion()).rejects.toThrow(
      /无法检测 Codex 版本，请确认 Codex 已安装且在 PATH 中/u
    );
    await expect(detectCodexVersion()).rejects.toThrow(
      /codex-father 支持 Codex 0\.42 或 0\.44 版本/u
    );
  });

  it('Codex 输出格式异常时抛出明确错误（包含安装指引）', async () => {
    mockExecFile((_file, _args, cb) => cb(null, 'weird output!'));
    const { detectCodexVersion, clearVersionCache } = await importModule();
    clearVersionCache();
    await expect(detectCodexVersion()).rejects.toThrow(/无法解析 Codex 版本号/u);
    await expect(detectCodexVersion()).rejects.toThrow(/Codex 已安装且在 PATH 中/u);
  });

  it('clearVersionCache 清空缓存，清空后重新检测会再次调用命令', async () => {
    let calls = 0;
    mockExecFile((_file, _args, cb) => {
      calls += 1;
      cb(null, 'Codex CLI v0.44.0');
    });
    const { detectCodexVersion, clearVersionCache } = await importModule();

    await detectCodexVersion();
    expect(calls).toBe(1);
    clearVersionCache();

    await detectCodexVersion();
    expect(calls).toBe(2);
  });
});
