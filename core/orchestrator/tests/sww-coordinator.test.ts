import { describe, expect, it } from 'vitest';
import { SWWCoordinator } from '../sww-coordinator';

describe('sww-coordinator', () => {
  it('导出 SWWCoordinator 类', () => {
    expect(typeof SWWCoordinator).toBe('function');
  });

  it('可以实例化 SWWCoordinator', () => {
    const coordinator = new SWWCoordinator();
    expect(coordinator).toBeInstanceOf(SWWCoordinator);
  });
});
