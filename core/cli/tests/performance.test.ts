import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createPerformanceLogger, LoggerManager } from '../logger-setup.js';

describe('Performance Monitoring (T008)', () => {
  let infoSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    infoSpy = vi.fn();
    vi.spyOn(LoggerManager, 'getLogger').mockReturnValue({ info: infoSpy } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('measures operation duration and records metadata', () => {
    const perf = createPerformanceLogger();

    perf.start('load-config');
    vi.advanceTimersByTime(75);
    perf.end('load-config', { files: 4 });

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [message, meta] = infoSpy.mock.calls[0];
    expect(message).toBe('Performance: load-config');
    expect(meta).toMatchObject({ duration: 75, files: 4 });
  });

  it('ignores end calls when start was not invoked', () => {
    const perf = createPerformanceLogger();

    perf.end('missing-operation');

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('tracks multiple concurrent operations independently', () => {
    const perf = createPerformanceLogger();

    perf.start('queue:enqueue');
    vi.advanceTimersByTime(20);
    perf.start('queue:dequeue');
    vi.advanceTimersByTime(10);
    perf.end('queue:enqueue', { items: 1 });
    vi.advanceTimersByTime(30);
    perf.end('queue:dequeue', { items: 1 });

    expect(infoSpy).toHaveBeenCalledTimes(2);

    const firstCall = infoSpy.mock.calls[0];
    expect(firstCall[0]).toBe('Performance: queue:enqueue');
    expect(firstCall[1]).toMatchObject({ duration: 30, items: 1 });

    const secondCall = infoSpy.mock.calls[1];
    expect(secondCall[0]).toBe('Performance: queue:dequeue');
    expect(secondCall[1]).toMatchObject({ duration: 40, items: 1 });
  });
});
