import type { CliLogger } from '../logger.js';

// Minimal Content-Length framed stdio transport compatible with MCP JSON-RPC
// Reads from stdin, writes to stdout. Frames are:
//   Content-Length: <len>\r\n\r\n<payload>
// where payload is a single JSON object (UTF-8).

export class ContentLengthServerTransport {
  readonly sessionId: string | undefined;
  onmessage?: (message: unknown) => void;
  onerror?: (error: Error) => void;
  onclose?: () => void;

  private readonly stdin: NodeJS.ReadStream;
  private readonly stdout: NodeJS.WriteStream;
  private readonly logger: CliLogger;
  private buffer: Buffer = Buffer.alloc(0);
  private started = false;

  constructor(logger: CliLogger, stdin = process.stdin, stdout = process.stdout) {
    this.logger = logger;
    this.stdin = stdin;
    this.stdout = stdout;
    this.sessionId = undefined;
  }

  async start(): Promise<void> {
    if (this.started) {
      throw new Error('Content-Length 传输已启动。');
    }
    this.started = true;
    this.stdin.on('data', this.handleData);
    this.stdin.on('error', this.handleError);
  }

  async close(): Promise<void> {
    this.stdin.off('data', this.handleData);
    this.stdin.off('error', this.handleError);
    this.buffer = Buffer.alloc(0);
    this.onclose?.();
  }

  async send(message: unknown): Promise<void> {
    const payload = Buffer.from(JSON.stringify(message), 'utf8');
    const header = Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, 'utf8');
    const frame = Buffer.concat([header, payload]);
    return new Promise<void>((resolve) => {
      if (this.stdout.write(frame)) {
        resolve();
      } else {
        this.stdout.once('drain', () => resolve());
      }
    });
  }

  private handleData = (chunk: Buffer | string): void => {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, buf]) : buf;
    this.processBuffer();
  };

  private processBuffer(): void {
    // Process as many complete frames as available in the buffer
    while (true) {
      const headerEnd = this.indexOfSub(Buffer.from('\r\n\r\n'));
      if (headerEnd === -1) {
        return;
      } // wait for more data

      const headerBuf = this.buffer.subarray(0, headerEnd).toString('utf8');
      const lines = headerBuf.split(/\r?\n/);
      let length = -1;
      for (const line of lines) {
        const m = /^Content-Length:\s*(\d+)$/i.exec(line.trim());
        if (m) {
          length = Number(m[1]);
          break;
        }
      }
      if (length < 0) {
        const err = new Error('缺少 Content-Length 头');
        this.logger.error(err.message);
        this.onerror?.(err);
        // Drop header to avoid infinite loop
        this.buffer = this.buffer.subarray(headerEnd + 4);
        continue;
      }

      const totalNeeded = headerEnd + 4 + length;
      if (this.buffer.length < totalNeeded) {
        // wait for more data
        return;
      }

      const payload = this.buffer.subarray(headerEnd + 4, totalNeeded);
      this.buffer = this.buffer.subarray(totalNeeded);
      try {
        const obj = JSON.parse(payload.toString('utf8'));
        this.onmessage?.(obj);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error(`解析 Content-Length 帧失败：${err.message}`);
        this.onerror?.(err);
      }
    }
  }

  private indexOfSub(sub: Buffer): number {
    return this.buffer.indexOf(sub);
  }

  private handleError = (error: Error): void => {
    this.logger.error(`Content-Length 传输错误：${error.message}`);
    this.onerror?.(error);
  };
}
