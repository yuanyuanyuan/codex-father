import { describe, expect, it } from 'vitest';
import * as orchestratorTypes from '../types';

describe('types', () => {
  it('模块可以正常导入', () => {
    expect(orchestratorTypes).toBeDefined();
  });

  it('导出 createDefaultOrchestratorConfig 工具', () => {
    expect(typeof orchestratorTypes.createDefaultOrchestratorConfig).toBe('function');
  });
});
