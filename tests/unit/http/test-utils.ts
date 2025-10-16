import { vi } from 'vitest';

// Mock utilities for testing
export function createMockWebSocketServer() {
  return {
    on: vi.fn(),
    clients: new Set(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

export function createMockWebSocket() {
  return {
    on: vi.fn(),
    send: vi.fn(),
    readyState: 1, // WebSocket.OPEN
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
}

export function createMockTaskRunner() {
  return {
    run: vi.fn().mockResolvedValue('task-123'),
    getStatus: vi.fn().mockReturnValue({
      running: 2,
      maxConcurrency: 10,
      pending: 1,
      completed: 5,
    }),
    getResult: vi.fn(),
    cancel: vi.fn().mockResolvedValue(true),
  };
}
