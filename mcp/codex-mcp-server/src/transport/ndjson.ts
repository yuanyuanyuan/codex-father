import type { CliLogger } from '../logger.js';

export class NdjsonServerTransport {
  readonly sessionId: string | undefined;
  onmessage?: (message: unknown) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  private readonly stdin: NodeJS.ReadStream;
  private readonly stdout: NodeJS.WriteStream;
  private readonly logger: CliLogger;
  private buffer = '';
  private started = false;

  constructor(logger: CliLogger, stdin = process.stdin, stdout = process.stdout) {
    this.logger = logger;
    this.stdin = stdin;
    this.stdout = stdout;
    this.sessionId = undefined;
  }

  async start() {
    if (this.started) {
      throw new Error('NDJSON 传输已启动。');
    }
    this.started = true;
    this.stdin.on('data', this.handleData);
    this.stdin.on('error', this.handleError);
  }

  async close() {
    this.stdin.off('data', this.handleData);
    this.stdin.off('error', this.handleError);
    this.buffer = '';
    this.onclose?.();
  }

  async send(message: unknown) {
    const payload = `${JSON.stringify(message)}\n`;
    return new Promise<void>((resolve) => {
      if (this.stdout.write(payload)) {
        resolve();
      } else {
        this.stdout.once('drain', () => resolve());
      }
    });
  }

  private handleData = (chunk: Buffer | string) => {
    this.buffer += chunk.toString();
    let newlineIndex = this.buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const rawLine = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      const line = rawLine.replace(/\r$/, '');
      if (!line.trim()) {
        newlineIndex = this.buffer.indexOf('\n');
        continue;
      }
      try {
        const message = JSON.parse(line);
        this.onmessage?.(message);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`解析 NDJSON 帧失败：${err.message}`);
        this.onerror?.(err);
      }
      newlineIndex = this.buffer.indexOf('\n');
    }
  };

  private handleError = (error: Error) => {
    this.logger.error(`NDJSON 传输错误：${error.message}`);
    this.onerror?.(error);
  };
}
