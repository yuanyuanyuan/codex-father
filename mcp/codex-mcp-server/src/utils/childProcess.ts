import { spawn, type SpawnOptionsWithoutStdio } from 'node:child_process';

export type RunResult = { code: number; stdout: string; stderr: string };

export async function run(
  cmd: string,
  args: string[],
  input?: string,
  options?: SpawnOptionsWithoutStdio
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], ...(options ?? {}) });
    let out = '';
    let err = '';
    let settled = false;

    const finalize = (code: number) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({ code, stdout: out, stderr: err });
    };

    child.stdout.on('data', (d: Buffer) => {
      out += d.toString();
    });
    child.stderr.on('data', (d: Buffer) => {
      err += d.toString();
    });
    child.on('error', (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      err += err ? `\n${message}` : message;
      finalize(-1);
    });
    child.on('close', (code: number | null) => {
      finalize(code ?? -1);
    });
    if (input) {
      child.stdin.end(input);
    } else {
      child.stdin.end();
    }
  });
}
