import { describe, it, expect } from 'vitest';
import { performance } from 'node:perf_hooks';

import {
  PARAMETER_MAPPINGS,
  getParamMinVersion,
  isParamSupported,
  getIncompatibleParams,
  getAllParamNames,
} from '../../core/lib/validation/parameter-validator.js';

describe('参数映射表完整性', () => {
  it('至少包含 34 个参数映射', () => {
    const names = Object.keys(PARAMETER_MAPPINGS);
    expect(names.length).toBeGreaterThanOrEqual(34);
  });

  it('包含 0.44 独有参数：profile、sendUserTurn.effort、sendUserTurn.summary', () => {
    expect(PARAMETER_MAPPINGS['profile']).toBeTruthy();
    expect(PARAMETER_MAPPINGS['sendUserTurn.effort']).toBeTruthy();
    expect(PARAMETER_MAPPINGS['sendUserTurn.summary']).toBeTruthy();

    expect(getParamMinVersion('profile')).toBe('0.44.0');
    expect(getParamMinVersion('sendUserTurn.effort')).toBe('0.44.0');
    expect(getParamMinVersion('sendUserTurn.summary')).toBe('0.44.0');
  });

  it('包含通用参数：model、cwd、approvalPolicy、sandbox（均 0.42 起支持）', () => {
    expect(getParamMinVersion('model')).toBe('0.42.0');
    expect(getParamMinVersion('cwd')).toBe('0.42.0');
    expect(getParamMinVersion('approvalPolicy')).toBe('0.42.0');
    expect(getParamMinVersion('sandbox')).toBe('0.42.0');
  });
});

describe('查询函数行为', () => {
  it('getParamMinVersion 返回正确的最小版本', () => {
    expect(getParamMinVersion('profile')).toBe('0.44.0');
    expect(getParamMinVersion('model')).toBe('0.42.0');
    expect(getParamMinVersion('unknown-param')).toBeNull();
  });

  it('isParamSupported 正确判断兼容性', () => {
    // 0.44 独有参数在 0.42 不支持
    expect(isParamSupported('profile', '0.42.0')).toBe(false);
    expect(isParamSupported('profile', '0.44.0')).toBe(true);

    // 0.42 起支持的参数
    expect(isParamSupported('model', '0.42.0')).toBe(true);
    expect(isParamSupported('model', '0.41.9')).toBe(false);

    // 未知参数
    expect(isParamSupported('unknown-param', '0.44.0')).toBe(false);

    // 非法版本格式
    expect(isParamSupported('model', '0.44')).toBe(false);
  });

  it('getIncompatibleParams 返回正确的不兼容参数列表（以 0.42.0 为例包含 profile/effort/summary）', () => {
    const list = getIncompatibleParams('0.42.0');
    expect(list).toContain('profile');
    expect(list).toContain('sendUserTurn.effort');
    expect(list).toContain('sendUserTurn.summary');
    expect(list).not.toContain('model');
  });

  it('getAllParamNames 返回所有参数名并包含关键项', () => {
    const names = getAllParamNames();
    expect(names).toContain('model');
    expect(names).toContain('cwd');
    expect(names).toContain('approvalPolicy');
    expect(names).toContain('sandbox');
    expect(names).toContain('sendUserTurn.effort');
  });
});

describe('性能与边界', () => {
  it('1000 次查询 < 10ms（O(1) 查询）', () => {
    const keys = getAllParamNames().slice(0, 16);
    // 预热
    for (const k of keys) {
      void getParamMinVersion(k);
    }
    const t0 = performance.now();
    let acc: string | null = null;
    for (let i = 0; i < 1000; i++) {
      acc = getParamMinVersion(keys[i % keys.length]);
    }
    const dt = performance.now() - t0;
    expect(dt).toBeLessThan(10);
    expect(acc).not.toBeUndefined();
  });

  it('边界：空字符串与未知参数', () => {
    expect(getParamMinVersion('')).toBeNull();
    expect(getParamMinVersion('not-exist')).toBeNull();
    expect(isParamSupported('', '0.44.0')).toBe(false);
    expect(isParamSupported('model', '')).toBe(false);
  });
});
