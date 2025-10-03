import { describe, expect, it } from 'vitest';
import { ProcessOrchestrator } from '../process-orchestrator';

describe('process-orchestrator', () => {
  it('导出 ProcessOrchestrator 类', () => {
    expect(typeof ProcessOrchestrator).toBe('function');
  });

  it('可以实例化 ProcessOrchestrator', () => {
    const orchestrator = new ProcessOrchestrator();
    expect(orchestrator).toBeInstanceOf(ProcessOrchestrator);
  });
});
