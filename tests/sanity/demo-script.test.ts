import { describe, it, expect } from 'vitest';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

function runScript(relPath: string, args: string[] = []) {
  const scriptPath = resolve(process.cwd(), relPath);
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((done) => {
    const child = spawn('bash', [scriptPath, ...args], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += String(d)));
    child.stderr.on('data', (d) => (stderr += String(d)));
    child.on('close', (code) => done({ code, stdout, stderr }));
  });
}

describe('scripts/demo-ok.sh 可运行性', () => {
  it('应当成功运行并输出 DEMO_OK', async () => {
    const target = process.env.TARGET_SCRIPT || 'scripts/demo-ok.sh';
    const { code, stdout, stderr } = await runScript(target);
    expect(code).toBe(0);
    expect(stdout.trim()).toBe('DEMO_OK');
    expect(stderr.trim()).toBe('');
  }, 10_000);
});
