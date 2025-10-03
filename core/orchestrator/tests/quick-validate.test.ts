import { describe, expect, it } from 'vitest';
import { quickValidate } from '../quick-validate';

describe('quick-validate', () => {
  it('导出 quickValidate 函数', () => {
    expect(typeof quickValidate).toBe('function');
  });

  it('调用 quickValidate 返回校验结果', async () => {
    const result = await quickValidate();
    expect(result).toHaveProperty('valid');
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});
