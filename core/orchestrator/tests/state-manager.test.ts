import { describe, expect, it } from 'vitest';
import { StateManager } from '../state-manager';

describe('state-manager', () => {
  it('导出 StateManager 类', () => {
    expect(typeof StateManager).toBe('function');
  });

  it('可以实例化 StateManager', () => {
    const manager = new StateManager();
    expect(manager).toBeInstanceOf(StateManager);
  });
});
