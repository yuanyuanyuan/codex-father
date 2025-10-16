import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

function runNodeScript(scriptRelPath: string, args: string[] = []) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolvePromise) => {
    const scriptPath = resolve(process.cwd(), scriptRelPath);
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

function extractLastJson(text: string): any | null {
  // 脚本最后输出的是格式化（多行）JSON，这里从末尾起做花括号匹配，截取最后一段完整 JSON。
  const s = text.trim();
  const end = s.lastIndexOf('}');
  if (end < 0) return null;
  let depth = 0;
  for (let i = end; i >= 0; i--) {
    const ch = s[i];
    if (ch === '}') depth++;
    else if (ch === '{') depth--;
    if (depth === 0 && ch === '{') {
      const candidate = s.slice(i, end + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }
  }
  return null;
}

describe('scripts/smoke.js 可运行性', () => {
  it('应成功执行并输出机器可读 JSON 总结', async () => {
    const { code, stdout, stderr } = await runNodeScript('scripts/smoke.js');

    // 1) 进程退出码为 0
    expect(code).toBe(0);

    // 2) 捕获到的输出中包含“总结”提示（人类可读）
    expect(stdout).toMatch(/总结: 通过/);

    // 3) 含有机器可读 JSON，并断言关键字段
    const json = extractLastJson(stdout);
    expect(json).toBeTruthy();
    expect(json.summary?.success).toBe(true);
    expect(json.summary?.passed).toBeGreaterThan(0);
    expect(json.checks?.length).toBeGreaterThan(0);

    // 4) 不应有错误输出
    expect(stderr.trim()).toBe('');
  }, 20_000);
});
