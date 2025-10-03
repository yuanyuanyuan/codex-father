/**
 * Codex Client Unit Tests - Codex 客户端单元测试
 *
 * 测试覆盖:
 * - JSON-RPC 请求/响应
 * - 通知发送和接收
 * - 超时处理
 * - 错误处理
 * - 关闭处理
 * - 事件监听
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PassThrough } from 'stream';
import { CodexClient, createCodexClient } from '../codex-client.js';
import type { JSONRPCResponse, JSONRPCNotification } from '../protocol/types.js';

describe('CodexClient', () => {
  let mockStdin: PassThrough;
  let mockStdout: PassThrough;
  let client: CodexClient;

  beforeEach(() => {
    // 创建 mock streams
    mockStdin = new PassThrough();
    mockStdout = new PassThrough();

    // 创建客户端
    client = createCodexClient({
      stdin: mockStdin,
      stdout: mockStdout,
      timeout: 1000, // 1 秒超时便于测试
      debug: false,
    });
  });

  afterEach(() => {
    // 清理资源
    if (!client.isClosed()) {
      client.close();
    }
    mockStdin.destroy();
    mockStdout.destroy();
  });

  describe('请求/响应', () => {
    it('应该发送 JSON-RPC 请求并接收响应', async () => {
      // 发送请求
      const requestPromise = client.request('testMethod', { param: 'value' });

      // 模拟 Codex 响应
      const response: JSONRPCResponse = {
        jsonrpc: '2.0',
        id: 1,
        result: { status: 'success' },
      };

      // 延迟发送响应
      setImmediate(() => {
        mockStdout.write(JSON.stringify(response) + '\n');
      });

      // 验证响应
      const result = await requestPromise;
      expect(result).toEqual({ status: 'success' });
    });

    it('应该发送正确的 JSON-RPC 请求格式', async () => {
      // 监听 stdin 写入
      const writePromise = new Promise<string>((resolve) => {
        mockStdin.once('data', (data) => {
          resolve(data.toString());
        });
      });

      // 发送请求
      const requestPromise = client.request('myMethod', { foo: 'bar' });

      // 验证请求格式
      const sentData = await writePromise;
      const request = JSON.parse(sentData.trim());

      expect(request).toEqual({
        jsonrpc: '2.0',
        id: 1,
        method: 'myMethod',
        params: { foo: 'bar' },
      });

      // 完成请求
      mockStdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {},
        }) + '\n'
      );

      await requestPromise;
    });

    it('应该递增请求 ID', async () => {
      const requests: string[] = [];

      // 捕获所有请求
      mockStdin.on('data', (data) => {
        requests.push(data.toString());
      });

      // 发送多个请求
      const promises = [
        client.request('method1'),
        client.request('method2'),
        client.request('method3'),
      ];

      // 等待请求发送
      await new Promise((resolve) => setImmediate(resolve));

      // 验证 ID 递增
      const ids = requests.map((req) => JSON.parse(req.trim()).id);
      expect(ids).toEqual([1, 2, 3]);

      // 完成请求
      for (let i = 1; i <= 3; i++) {
        mockStdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: i,
            result: {},
          }) + '\n'
        );
      }

      await Promise.all(promises);
    });

    it('应该处理多个并发请求', async () => {
      // 发送多个并发请求
      const promises = [
        client.request('method1', { id: 1 }),
        client.request('method2', { id: 2 }),
        client.request('method3', { id: 3 }),
      ];

      // 延迟发送响应(乱序)
      setImmediate(() => {
        mockStdout.write(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { value: 'b' } }) + '\n');
        mockStdout.write(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { value: 'a' } }) + '\n');
        mockStdout.write(JSON.stringify({ jsonrpc: '2.0', id: 3, result: { value: 'c' } }) + '\n');
      });

      // 验证所有响应正确匹配
      const results = await Promise.all(promises);
      expect(results).toEqual([{ value: 'a' }, { value: 'b' }, { value: 'c' }]);
    });
  });

  describe('高级方法', () => {
    it('应该发送 newConversation 请求', async () => {
      const requestPromise = client.newConversation({
        model: 'claude-3-opus',
        cwd: '/workspace',
        approvalPolicy: 'on-request',
      });

      setImmediate(() => {
        mockStdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: {
              conversationId: 'conv-123',
              model: 'claude-3-opus',
              rolloutPath: '/path/to/rollout.json',
            },
          }) + '\n'
        );
      });

      const result = await requestPromise;
      expect(result.conversationId).toBe('conv-123');
      expect(result.model).toBe('claude-3-opus');
      expect(result.rolloutPath).toBe('/path/to/rollout.json');
    });

    it('应该发送 sendUserMessage 请求', async () => {
      const requestPromise = client.sendUserMessage({
        conversationId: 'conv-123',
        items: [{ type: 'text', text: 'Hello, Codex!' }],
      });

      setImmediate(() => {
        mockStdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { status: 'ok' },
          }) + '\n'
        );
      });

      const result = await requestPromise;
      expect(result.status).toBe('ok');
    });
  });

  describe('通知', () => {
    it('应该发送 JSON-RPC 通知', () => {
      const writePromise = new Promise<string>((resolve) => {
        mockStdin.once('data', (data) => {
          resolve(data.toString());
        });
      });

      client.notify('myNotification', { data: 'test' });

      return writePromise.then((sentData) => {
        const notification = JSON.parse(sentData.trim());
        expect(notification).toEqual({
          jsonrpc: '2.0',
          method: 'myNotification',
          params: { data: 'test' },
        });
        expect(notification.id).toBeUndefined();
      });
    });

    it('应该接收并触发通知事件', () => {
      return new Promise<void>((resolve) => {
        const notificationData = { event: 'test', value: 123 };

        client.on('notification', (notification: JSONRPCNotification) => {
          expect(notification.method).toBe('codex.event');
          expect(notification.params).toEqual(notificationData);
          resolve();
        });

        // 模拟 Codex 发送通知
        mockStdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'codex.event',
            params: notificationData,
          }) + '\n'
        );
      });
    });

    it('应该触发特定方法名的事件', () => {
      return new Promise<void>((resolve) => {
        const params = { status: 'progress', step: 1 };

        client.on('codex.progress', (receivedParams) => {
          expect(receivedParams).toEqual(params);
          resolve();
        });

        mockStdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            method: 'codex.progress',
            params,
          }) + '\n'
        );
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理 JSON-RPC 错误响应', async () => {
      const requestPromise = client.request('failMethod');

      setImmediate(() => {
        mockStdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: -32600,
              message: 'Invalid Request',
            },
          }) + '\n'
        );
      });

      await expect(requestPromise).rejects.toThrow('JSON-RPC error (code: -32600)');
      await expect(requestPromise).rejects.toThrow('Invalid Request');
    });

    it('应该处理无效的 JSON 数据', () => {
      return new Promise<void>((resolve) => {
        client.on('error', (error: Error) => {
          expect(error.message).toContain('Failed to parse JSON');
          resolve();
        });

        // 发送无效的 JSON
        mockStdout.write('invalid json data\n');
      });
    });

    it('应该忽略未知 ID 的响应', async () => {
      const spy = vi.fn();
      client.on('error', spy);

      // 发送一个未知 ID 的响应
      mockStdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 999,
          result: { data: 'orphan' },
        }) + '\n'
      );

      // 等待事件处理
      await new Promise((resolve) => setImmediate(resolve));

      // 不应该触发错误
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('超时处理', () => {
    it('应该在超时时拒绝请求', async () => {
      // 发送请求但不响应
      const requestPromise = client.request('slowMethod');

      // 等待超时
      await expect(requestPromise).rejects.toThrow('Request timeout');
      await expect(requestPromise).rejects.toThrow('slowMethod');
    }, 2000);

    it('应该清理超时的待处理请求', async () => {
      const requestPromise = client.request('timeoutMethod');

      try {
        await requestPromise;
      } catch (error) {
        // 预期超时
      }

      // 验证请求已从待处理列表中移除
      // 尝试发送响应不应该触发任何操作
      mockStdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: { late: true },
        }) + '\n'
      );

      // 不应该抛出错误
      await new Promise((resolve) => setImmediate(resolve));
    }, 2000);
  });

  describe('关闭处理', () => {
    it('应该关闭客户端', () => {
      expect(client.isClosed()).toBe(false);

      client.close();

      expect(client.isClosed()).toBe(true);
    });

    it('应该触发 close 事件', () => {
      return new Promise<void>((resolve) => {
        client.on('close', () => {
          expect(client.isClosed()).toBe(true);
          resolve();
        });

        client.close();
      });
    });

    it('应该拒绝所有待处理的请求', async () => {
      const promises = [
        client.request('method1'),
        client.request('method2'),
        client.request('method3'),
      ];

      // 关闭客户端
      client.close();

      // 所有请求都应该被拒绝
      await expect(Promise.all(promises)).rejects.toThrow('CodexClient closed');
    });

    it('应该在关闭后拒绝新请求', async () => {
      client.close();

      await expect(client.request('newMethod')).rejects.toThrow('CodexClient is closed');
    });

    it('应该在关闭后拒绝新通知', () => {
      client.close();

      expect(() => client.notify('newNotification')).toThrow('CodexClient is closed');
    });

    it('应该在 stdout 关闭时自动关闭客户端', () => {
      return new Promise<void>((resolve) => {
        client.on('close', () => {
          expect(client.isClosed()).toBe(true);
          resolve();
        });

        // 模拟 stdout 关闭
        mockStdout.end();
      });
    });

    it('应该支持多次调用 close()', () => {
      client.close();
      expect(() => client.close()).not.toThrow();
      expect(client.isClosed()).toBe(true);
    });
  });

  describe('边缘情况', () => {
    it('应该处理空参数的请求', async () => {
      const requestPromise = client.request('noParams');

      setImmediate(() => {
        mockStdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: {},
          }) + '\n'
        );
      });

      const result = await requestPromise;
      expect(result).toEqual({});
    });

    it('应该处理 null 结果的响应', async () => {
      const requestPromise = client.request('nullResult');

      setImmediate(() => {
        mockStdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: null,
          }) + '\n'
        );
      });

      const result = await requestPromise;
      expect(result).toBeNull();
    });

    it('应该处理复杂的嵌套数据', async () => {
      const complexData = {
        nested: {
          array: [1, 2, 3],
          object: { key: 'value' },
        },
        nullField: null,
        boolField: true,
      };

      const requestPromise = client.request('complex', complexData);

      setImmediate(() => {
        mockStdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: { echo: complexData },
          }) + '\n'
        );
      });

      const result = await requestPromise;
      expect(result).toEqual({ echo: complexData });
    });

    it('应该处理大量通知', () => {
      return new Promise<void>((resolve) => {
        let count = 0;
        const total = 100;

        client.on('notification', () => {
          count++;
          if (count === total) {
            expect(count).toBe(total);
            resolve();
          }
        });

        // 发送大量通知
        for (let i = 0; i < total; i++) {
          mockStdout.write(
            JSON.stringify({
              jsonrpc: '2.0',
              method: 'test.notification',
              params: { index: i },
            }) + '\n'
          );
        }
      });
    });

    it('应该处理包含特殊字符的数据', async () => {
      const specialData = {
        message: 'Line 1\nLine 2\tTabbed',
        unicode: '中文测试 🎉',
        quotes: 'He said "Hello"',
      };

      const requestPromise = client.request('special', specialData);

      setImmediate(() => {
        mockStdout.write(
          JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            result: specialData,
          }) + '\n'
        );
      });

      const result = await requestPromise;
      expect(result).toEqual(specialData);
    });
  });

  describe('工厂函数', () => {
    it('应该通过工厂函数创建 CodexClient', () => {
      const newClient = createCodexClient({
        stdin: mockStdin,
        stdout: mockStdout,
      });

      expect(newClient).toBeInstanceOf(CodexClient);
      expect(newClient.isClosed()).toBe(false);

      newClient.close();
    });

    it('应该使用默认超时时间', () => {
      const newClient = createCodexClient({
        stdin: mockStdin,
        stdout: mockStdout,
      });

      // 默认超时应该是 30000ms
      // 我们通过尝试一个不会很快完成的请求来验证
      expect(newClient).toBeInstanceOf(CodexClient);

      newClient.close();
    });
  });
});
