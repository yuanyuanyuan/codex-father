/**
 * MCP 客户端测试工具
 * 用于在测试中模拟 MCP 客户端连接和通信
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export class MCPTestClient extends EventEmitter {
  private process: ChildProcess;
  private messageId: number = 1;
  private pendingRequests: Map<
    string | number,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();

  constructor(process: ChildProcess) {
    super();
    this.process = process;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.process.stdout) {
      throw new Error('Process stdout is not available');
    }

    let buffer = '';
    this.process.stdout.on('data', (data: Buffer) => {
      buffer += data.toString();

      // 处理可能的多行 JSON 消息
      const lines = buffer.split('\n').filter((line) => line.trim());
      buffer = lines.pop() || ''; // 保留最后一个不完整的行

      for (const line of lines) {
        try {
          const message: MCPMessage = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse MCP message:', line, error);
        }
      }
    });

    this.process.on('error', (error) => {
      this.emit('error', error);
    });

    this.process.on('exit', (code, signal) => {
      this.emit('exit', code, signal);
    });
  }

  private handleMessage(message: MCPMessage): void {
    // 处理响应消息
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }

      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message);
      }
    }

    // 处理通知消息
    if (message.method && message.id === undefined) {
      this.emit('notification', message);
    }

    // 发出通用消息事件
    this.emit('message', message);
  }

  async request(method: string, params?: any, timeout: number = 30000): Promise<MCPMessage> {
    return new Promise((resolve, reject) => {
      const id = this.messageId++;
      const message: MCPMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      // 设置超时
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);

      // 存储待处理的请求
      this.pendingRequests.set(id, { resolve, reject, timeout: timeoutHandle });

      // 发送消息
      this.sendMessage(message);
    });
  }

  private sendMessage(message: MCPMessage): void {
    if (!this.process.stdin) {
      throw new Error('Process stdin is not available');
    }

    const jsonMessage = JSON.stringify(message) + '\n';
    this.process.stdin.write(jsonMessage);
  }

  async initialize(): Promise<void> {
    const response = await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: 'test-client',
        version: '1.0.0',
      },
    });

    if (response.error) {
      throw new Error(`MCP initialization failed: ${response.error.message}`);
    }

    // 发送 initialized 通知
    this.sendMessage({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
  }

  async listTools(): Promise<any> {
    const response = await this.request('tools/list');
    return response.result;
  }

  async callTool(name: string, arguments_: any): Promise<any> {
    const response = await this.request('tools/call', {
      name,
      arguments: arguments_,
    });
    return response;
  }

  close(): void {
    // 清理待处理的请求
    for (const [id, pending] of this.pendingRequests) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      pending.reject(new Error('Client closed'));
    }
    this.pendingRequests.clear();

    // 关闭进程
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
  }
}

export async function connectToMCP(process: ChildProcess): Promise<MCPTestClient> {
  const client = new MCPTestClient(process);
  await client.initialize();
  return client;
}

export function spawnMCPServer(command: string, args: string[] = [], env: any = {}): ChildProcess {
  return spawn(command, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  });
}
